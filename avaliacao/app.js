/* Avaliação de veículos · registro de reparos (categoria única: REPAROS).
 * Dados no Supabase (avaliacoes, reparos, Storage), compartilhados pela equipe da loja. Ver data.js. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var R = window.Car3D.REGIONS, RB = window.Car3D.BY_ID, D = window.PatioAvalData, F = window.PatioFipe;
  var TIPOS = ['Amassado', 'Risco ou arranhão', 'Trinca ou quebra', 'Ferrugem', 'Pintura danificada', 'Peça faltando', 'Desgaste', 'Problema mecânico', 'Problema elétrico', 'Outro'];
  var STATUS = { em_avaliacao: 'Em avaliação', aprovado: 'Aprovado', reprovado: 'Reprovado' };
  var cur = null, car = null, modal = { id: null, foto: null, removed: false }, toastT = 0, lastFocus = null, pending = {}, timer = 0, thumbs = {}, routeSeq = 0, fipeState = {};

  /* ---------- utilitários ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function round2(n) { return Math.round((n + 1e-9) * 100) / 100; }
  var brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  var dec = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function money(n) { return brl.format(n || 0); }
  function parseMoney(s) {
    s = String(s == null ? '' : s).replace(/R\$|\s/g, '');
    if (s === '') return 0;
    if (s.indexOf(',') !== -1) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    return /^\d+(\.\d+)?$/.test(s) ? round2(parseFloat(s)) : NaN;
  }
  function fmtInput(n) { return n ? dec.format(n) : ''; }
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 4200); }
  function dateBR(ts) { return ts ? new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'; }
  function dateTimeBR(ts) { return ts ? dateBR(ts) + ' às ' + new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'; }
  function title(av) { var t = ((av.marca || '') + ' ' + (av.modelo || '')).trim(); return t || 'Novo veículo'; }
  function errMsg(e) {
    var m = String((e && (e.message || e.code)) || '');
    if (/usuario_nao_encontrado/.test(m)) return 'Esse e-mail ainda não tem conta no Pátio. Peça para a pessoa criar a conta e tente de novo.';
    if (/somente_admin/.test(m)) return 'Só administradores podem alterar a equipe.';
    if (/ultimo_admin/.test(m)) return 'A loja precisa ter pelo menos um administrador.';
    if (/row-level security|permission denied|42501/.test(m)) return 'Você não tem permissão para essa ação.';
    if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
    return 'Não foi possível concluir (' + m.slice(0, 120) + ').';
  }

  /* ---------- placa (antiga AAA-1234 ou Mercosul AAA1A23) ---------- */
  function plateNorm(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7); }
  function plateKind(p) { return /^[A-Z]{3}\d{4}$/.test(p) ? 'antiga' : /^[A-Z]{3}\d[A-Z]\d{2}$/.test(p) ? 'mercosul' : null; }
  function plateHint(raw) {
    var p = plateNorm(raw), el = $('placa-h'), k = plateKind(p);
    el.className = k ? 'plate-ok' : (p.length === 7 ? 'plate-bad' : 'muted');
    el.textContent = !p ? 'Informe a placa (antiga ou Mercosul).' : k ? 'Placa válida (' + (k === 'mercosul' ? 'padrão Mercosul' : 'padrão antigo') + ').' : p.length === 7 ? 'Formato de placa inválido.' : 'Placa incompleta.';
    return k;
  }

  /* ---------- totais ---------- */
  function totals(av) {
    var t = { qtd: av.reparos.length, pecas: 0, mao: 0, reparos: 0, diretos: 0 };
    av.reparos.forEach(function (r) { t.pecas += r.pecas || 0; t.mao += r.mao || 0; t.reparos += r.total || 0; if (r.direto) t.diretos++; });
    t.pecas = round2(t.pecas); t.mao = round2(t.mao); t.reparos = round2(t.reparos);
    t.compra = av.compra || 0; t.invest = round2(t.compra + t.reparos);
    t.venda = av.venda == null ? null : av.venda;
    t.margem = t.venda ? round2(t.venda - t.invest) : null;
    t.margemPct = t.venda > 0 ? round2(t.margem / t.venda * 100) : null;
    return t;
  }

  /* ---------- salvamento automático dos dados do veículo ---------- */
  function setState(s) { var el = $('saved-at'); if (el) el.textContent = s; }
  function queue(patch) { Object.keys(patch).forEach(function (k) { pending[k] = patch[k]; }); setState('Salvando…'); clearTimeout(timer); timer = setTimeout(flush, 700); }
  function flush() {
    clearTimeout(timer);
    if (!cur || !Object.keys(pending).length) return Promise.resolve();
    var p = pending, id = cur.id; pending = {};
    return D.update(id, p).then(function (r) {
      if (cur && cur.id === id) { cur.atualizado = r.atualizado; cur.atualizadoPor = r.atualizadoPor; renderHist(); }
      setState('Salvo na sua conta às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '.');
    }).catch(function (e) {
      Object.keys(p).forEach(function (k) { if (!(k in pending)) pending[k] = p[k]; });
      setState('Não salvo — edite novamente para tentar de novo.'); toast(errMsg(e));
    });
  }
  function touch(patch) { Object.keys(patch).forEach(function (k) { cur[k] = patch[k]; }); queue(patch); }

  /* ---------- telas ---------- */
  function show(view) { $('view-list').hidden = view !== 'list'; $('view-edit').hidden = view !== 'edit'; $('crumb-sep').hidden = $('crumb-cur').hidden = view !== 'edit'; }
  function renderList() {
    var box = $('list'); box.innerHTML = '<div class="loading"><span class="spin"></span>Carregando avaliações…</div>';
    return D.list().then(function (items) {
      renderMigrar();
      if (!items.length) {
        box.innerHTML = '<div class="empty card"><div class="empty-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4.5h6M9 13l2.2 2.2L15.5 11"/></svg></div><h3>Nenhuma avaliação ainda</h3><p class="muted">Comece cadastrando um veículo. Você poderá fotografar avarias, estimar os custos e gerar o relatório em PDF. A equipe da loja vê tudo em tempo real.</p><button type="button" class="btn primary" data-new>+ Nova avaliação</button></div>';
        return;
      }
      box.innerHTML = items.map(function (av) {
        var t = totals(av);
        return '<a class="acard card" href="#a-' + av.id + '" data-id="' + av.id + '"><div class="a-top"><span class="plate">' + esc(av.placa || 'SEM PLACA') + '</span><span class="stbadge ' + esc(av.status) + '">' + esc(STATUS[av.status] || av.status) + '</span></div>' +
          '<h3>' + esc(title(av)) + (av.versao ? ' <small class="muted">' + esc(av.versao) + '</small>' : '') + '</h3><p class="muted">' + esc([av.anoFab && av.anoMod ? av.anoFab + '/' + av.anoMod : (av.anoMod || av.anoFab), av.cor, av.km ? av.km + ' km' : ''].filter(Boolean).join(' · ') || 'Dados do veículo pendentes') + '</p>' +
          '<p class="a-by">Responsável: ' + esc(D.nome(av.criadoPor)) + ' · atualizada em ' + dateBR(av.atualizado) + '</p>' +
          '<div class="a-foot"><span><b>' + t.qtd + '</b> ' + (t.qtd === 1 ? 'reparo' : 'reparos') + '</span><span class="a-inv"><small>Investimento total</small><b>' + money(t.invest) + '</b></span></div></a>';
      }).join('');
    }).catch(function (e) { box.innerHTML = '<div class="empty card"><h3>Não foi possível carregar</h3><p class="muted">' + esc(errMsg(e)) + '</p><button type="button" class="btn" data-retry>Tentar de novo</button></div>'; });
  }

  function fillForm() {
    var m = { 'v-placa': cur.placa, 'v-marca': cur.marca, 'v-modelo': cur.modelo, 'v-versao': cur.versao, 'v-anofab': cur.anoFab, 'v-anomod': cur.anoMod, 'v-comb': cur.combustivel, 'v-motor': cur.motorizacao, 'v-km': cur.km, 'v-cor': cur.cor };
    Object.keys(m).forEach(function (id) { $(id).value = m[id] == null ? '' : m[id]; });
    $('v-compra').value = fmtInput(cur.compra); $('v-venda').value = fmtInput(cur.venda); $('v-status').value = cur.status;
    plateHint(cur.placa);
  }
  function renderHist() { $('hist').textContent = 'Criada por ' + D.nome(cur.criadoPor) + ' em ' + dateBR(cur.criado) + ' · Última atualização por ' + D.nome(cur.atualizadoPor) + ' em ' + dateTimeBR(cur.atualizado); }
  function renderHead() { var t = title(cur); $('t-edit').textContent = t; $('crumb-cur').textContent = t; document.title = 'Pátio · ' + t; }
  function counts() { var c = {}; if (cur) cur.reparos.forEach(function (r) { c[r.regiao] = (c[r.regiao] || 0) + 1; }); return c; }

  function open(av) {
    cur = av; pending = {}; fillForm(); show('edit'); renderHead(); renderHist(); renderRepairs(); renderSummary(); setState('As alterações são salvas automaticamente.');
    $('fipe-box').hidden = true; $('btn-fipe').setAttribute('aria-expanded', 'false'); $('fp-st').textContent = '';
    if (!car) car = window.Car3D.create($('car'), { onPick: function (id) { openModal({ regiao: id }); }, getCounts: counts }); else car.size();
    window.scrollTo(0, 0);
  }

  function loadThumb(img) {
    var path = img.getAttribute('data-path');
    if (thumbs[path]) { img.src = thumbs[path]; return; }
    D.photo(path).then(function (b) { if (b) { thumbs[path] = URL.createObjectURL(b); img.src = thumbs[path]; } }).catch(function () { img.alt = 'Não foi possível carregar a foto'; });
  }
  function renderRepairs() {
    $('rep-count').textContent = cur.reparos.length;
    var box = $('repairs');
    if (!cur.reparos.length) { box.innerHTML = '<p class="muted empty-s">Nenhum reparo registrado. Fotografe uma avaria ou toque em um ponto do veículo em 3D.</p>'; return; }
    box.innerHTML = cur.reparos.map(function (r, i) {
      var reg = RB[r.regiao] ? RB[r.regiao].nome : r.regiao;
      var thumb = r.fotoPath ? '<img class="thumb" data-path="' + esc(r.fotoPath) + '" alt="Foto da avaria: ' + esc(r.tipo) + ' em ' + esc(reg) + '">' : '<div class="thumb none" aria-hidden="true">sem foto</div>';
      return '<article class="rep" data-id="' + r.id + '">' + thumb + '<div class="rep-b"><div class="rep-t"><span class="n">' + (i + 1) + '</span><b>' + esc(reg) + '</b><span class="tag">' + esc(r.tipo) + '</span></div>' +
        (r.desc ? '<p>' + esc(r.desc) + '</p>' : '') + (r.obs ? '<p class="muted small">Obs.: ' + esc(r.obs) + '</p>' : '') +
        '<div class="costs">' + (r.direto ? '<span>Custo total informado diretamente</span>' : '<span>Peças <b>' + money(r.pecas) + '</b></span><span>Mão de obra <b>' + money(r.mao) + '</b></span>') + '<span class="tot">Total <b>' + money(r.total) + '</b></span></div></div>' +
        '<div class="rep-a"><button type="button" class="btn small" data-edit="' + r.id + '">Editar</button><button type="button" class="btn small ghost" data-rm="' + r.id + '">Excluir</button></div></article>';
    }).join('');
    box.querySelectorAll('img[data-path]').forEach(loadThumb);
  }
  function renderSummary() {
    var t = totals(cur);
    function row(l, v, cls, raw) { return '<div class="' + (cls || '') + '"><dt>' + l + '</dt><dd data-raw="' + raw + '">' + v + '</dd></div>'; }
    var mg = t.margem == null ? '—' : money(t.margem) + ' <small>(' + dec.format(t.margemPct) + '%)</small>';
    $('summary').innerHTML = row('Reparos registrados', t.qtd, '', t.qtd) + row('Custo total de peças', money(t.pecas), '', t.pecas) + row('Custo total de mão de obra', money(t.mao), '', t.mao) +
      row('Custo total dos reparos', money(t.reparos), 'strong', t.reparos) + row('Valor de compra do veículo', money(t.compra), '', t.compra) + row('Investimento total <small>(compra + reparos)</small>', money(t.invest), 'big', t.invest) +
      row('Preço de venda pretendido', t.venda == null ? '—' : money(t.venda), 'margin', t.venda == null ? '' : t.venda) +
      row('Margem bruta estimada', mg, 'margin ' + (t.margem == null ? '' : t.margem < 0 ? 'neg' : 'pos'), t.margem == null ? '' : t.margem) + row('Margem sobre o preço de venda', t.margemPct == null ? '—' : dec.format(t.margemPct) + '%', 'margin ' + (t.margemPct == null ? '' : t.margemPct < 0 ? 'neg' : 'pos'), t.margemPct == null ? '' : t.margemPct);
    var n = $('sum-note'); n.hidden = !t.diretos;
    if (t.diretos) n.textContent = t.diretos + (t.diretos === 1 ? ' reparo teve' : ' reparos tiveram') + ' o custo total informado diretamente: ' + (t.diretos === 1 ? 'ele entra' : 'eles entram') + ' no total dos reparos, mas não nas somas de peças e mão de obra.';
    if (car) car.refresh();
  }

  /* ---------- formulário de reparo ---------- */
  function fillSelects() {
    var groups = {}, html = '<option value="">Selecione…</option>';
    R.forEach(function (r) { (groups[r.grupo] = groups[r.grupo] || []).push(r); });
    Object.keys(groups).forEach(function (g) { html += '<optgroup label="' + esc(g) + '">' + groups[g].map(function (r) { return '<option value="' + r.id + '">' + esc(r.nome) + '</option>'; }).join('') + '</optgroup>'; });
    $('r-regiao').innerHTML = html;
    $('r-tipo').innerHTML = '<option value="">Selecione…</option>' + TIPOS.map(function (t) { return '<option>' + esc(t) + '</option>'; }).join('');
  }
  function setDireto(on) {
    $('r-direto').checked = on; $('r-pecas').disabled = on; $('r-mao').disabled = on; $('r-total').readOnly = !on;
    $('r-total-h').textContent = on ? 'Informe o valor total do reparo.' : 'Calculado automaticamente: peças + mão de obra.';
    if (!on) calcTotal();
  }
  function calcTotal() { var p = parseMoney($('r-pecas').value), m = parseMoney($('r-mao').value); $('r-total').value = fmtInput(round2((isNaN(p) ? 0 : p) + (isNaN(m) ? 0 : m))); }
  function showPhoto() {
    var f = modal.foto, v = $('photo-view');
    v.innerHTML = f && f.url ? '<img src="' + f.url + '" alt="Fotografia da avaria">' : (f && f.path ? '<span class="muted"><span class="spin"></span>Carregando foto…</span>' : '<span class="muted">Nenhuma fotografia</span>');
    $('photo-del').hidden = !f; $('photo-pick').textContent = f ? 'Trocar foto' : 'Tirar ou escolher foto';
  }
  function openModal(o) {
    o = o || {}; lastFocus = document.activeElement;
    var r = o.id ? cur.reparos.filter(function (x) { return x.id === o.id; })[0] : null;
    modal = { id: r ? r.id : null, foto: o.foto || (r && r.fotoPath ? { path: r.fotoPath } : null), removed: false };
    $('m-title').textContent = r ? 'Editar reparo' : 'Registrar reparo';
    $('r-regiao').value = r ? r.regiao : (o.regiao || ''); $('r-tipo').value = r ? r.tipo : '';
    $('r-desc').value = r ? r.desc : ''; $('r-obs').value = r ? r.obs : '';
    $('r-pecas').value = r && !r.direto ? fmtInput(r.pecas) : ''; $('r-mao').value = r && !r.direto ? fmtInput(r.mao) : '';
    setDireto(!!(r && r.direto)); if (r) $('r-total').value = fmtInput(r.total); else calcTotal();
    $('r-err').hidden = true; $('r-save').disabled = false; showPhoto();
    if (modal.foto && modal.foto.path) { var fp = modal.foto; D.photo(fp.path).then(function (b) { if (b && modal.foto === fp) { fp.url = thumbs[fp.path] || (thumbs[fp.path] = URL.createObjectURL(b)); showPhoto(); } }).catch(function () {}); }
    $('modal').hidden = false; document.body.classList.add('lock-scroll'); $('r-regiao').focus();
  }
  function closeModal() { $('modal').hidden = true; document.body.classList.remove('lock-scroll'); if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {} }
  function submitModal(e) {
    e.preventDefault();
    var reg = $('r-regiao').value, tipo = $('r-tipo').value, direto = $('r-direto').checked, err = '';
    var p = direto ? 0 : parseMoney($('r-pecas').value), m = direto ? 0 : parseMoney($('r-mao').value), t = direto ? parseMoney($('r-total').value) : 0;
    if (!reg) err = 'Escolha a região do veículo afetada.';
    else if (!tipo) err = 'Escolha o tipo de avaria.';
    else if (isNaN(p) || isNaN(m) || isNaN(t) || p < 0 || m < 0 || t < 0) err = 'Informe valores em reais válidos (exemplo: 1.250,00).';
    else if (direto && !(t > 0)) err = 'Informe o custo total do reparo.';
    if (err) { var el = $('r-err'); el.textContent = err; el.hidden = false; return; }
    var old = modal.id ? cur.reparos.filter(function (x) { return x.id === modal.id; })[0] : null;
    var rep = { id: modal.id || D.uuid(), fotoPath: old ? old.fotoPath : null, regiao: reg, tipo: tipo, desc: $('r-desc').value.trim(), pecas: p, mao: m, direto: direto, total: direto ? t : round2(p + m), obs: $('r-obs').value.trim(), ordem: old ? old.ordem : cur.reparos.length };
    var foto = modal.foto && modal.foto.blob ? { blob: modal.foto.blob } : (modal.removed ? false : null);
    var btn = $('r-save'); btn.disabled = true; btn.textContent = 'Salvando…';
    D.saveRepair(cur, rep, foto).then(function (saved) {
      var i = -1; cur.reparos.forEach(function (x, k) { if (x.id === saved.id) i = k; });
      if (i >= 0) cur.reparos[i] = saved; else cur.reparos.push(saved);
      renderRepairs(); renderSummary(); closeModal(); toast('Reparo salvo.'); cur.atualizado = Date.now(); cur.atualizadoPor = D.state.userId; renderHist();
    }).catch(function (x) { var el2 = $('r-err'); el2.textContent = errMsg(x); el2.hidden = false; })
      .then(function () { btn.disabled = false; btn.textContent = 'Salvar reparo'; });
  }

  /* foto: reduz para até 1000 px e envia como JPEG */
  function processPhoto(file) {
    return new Promise(function (ok, bad) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(1, 1000 / Math.max(img.width, img.height)), w = Math.max(1, Math.round(img.width * s)), h = Math.max(1, Math.round(img.height * s));
        var c = document.createElement('canvas'); c.width = w; c.height = h; var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { if (!b) return bad(new Error('falha')); ok({ blob: b, url: URL.createObjectURL(b), w: w, h: h }); }, 'image/jpeg', 0.72);
      };
      img.onerror = function () { URL.revokeObjectURL(url); bad(new Error('imagem inválida')); };
      img.src = url;
    });
  }
  function pickPhoto(thenModal) {
    var f = $('file'); f.value = ''; f.onchange = function () {
      var file = f.files && f.files[0]; if (!file) return;
      processPhoto(file).then(function (ph) { if (thenModal) openModal({ foto: ph }); else { modal.foto = ph; modal.removed = false; showPhoto(); } }).catch(function () { toast('Não foi possível ler essa imagem.'); });
    };
    f.click();
  }

  /* ---------- identificação pela tabela FIPE ---------- */
  function fpStatus(t, cls, loading) { var el = $('fp-st'); el.className = 'fipe-st' + (cls ? ' ' + cls : ''); el.innerHTML = (loading ? '<span class="spin"></span>' : '') + esc(t); }
  function fillOpts(sel, list, ph) { sel.innerHTML = '<option value="">' + esc(ph) + '</option>' + list.map(function (x) { return '<option value="' + esc(x.code) + '">' + esc(x.name) + '</option>'; }).join(''); sel.disabled = !list.length; }
  function fpReset(from) {
    if (from <= 1) { $('fp-marca').innerHTML = ''; $('fp-marca').disabled = true; }
    if (from <= 2) { $('fp-modelo').innerHTML = ''; $('fp-modelo').disabled = true; $('fp-filtro').value = ''; $('fp-filtro').disabled = true; fipeState.models = []; }
    if (from <= 3) { $('fp-ano').innerHTML = ''; $('fp-ano').disabled = true; }
  }
  function fpLoad(label, p, onOk) {
    fpStatus(label, '', true);
    return p.then(function (r) { fpStatus('', ''); onOk(r); }).catch(function (e) { fpStatus(F.msg(e), 'bad'); });
  }
  function fpBrands() { fpReset(1); fpLoad('Carregando marcas…', F.brands($('fp-tipo').value), function (l) { fillOpts($('fp-marca'), l, 'Selecione a marca'); }); }
  function fpFilter() {
    var q = $('fp-filtro').value.trim().toLowerCase(), list = (fipeState.models || []).filter(function (m) { return !q || m.name.toLowerCase().indexOf(q) !== -1; });
    fillOpts($('fp-modelo'), list, list.length ? 'Selecione o modelo (' + list.length + ')' : 'Nenhum modelo encontrado');
  }
  function fillVehicle(d) {
    var s = F.split(d.modeloFipe), yr = d.anoModelo && d.anoModelo >= 1900 && d.anoModelo <= new Date().getFullYear() + 1 ? d.anoModelo : '';
    var patch = { marca: d.marca, modelo: s.modelo, versao: s.versao, combustivel: d.combustivel, motorizacao: s.motorizacao, origem: 'consulta' };
    if (yr) patch.anoMod = yr;
    touch(patch);
    $('v-marca').value = patch.marca; $('v-modelo').value = patch.modelo; $('v-versao').value = patch.versao; $('v-comb').value = patch.combustivel; $('v-motor').value = patch.motorizacao; if (yr) $('v-anomod').value = yr;
    renderHead(); fpStatus('Dados preenchidos pela tabela FIPE' + (d.codigoFipe ? ' (código ' + d.codigoFipe + ')' : '') + '. Confira e ajuste o que for preciso; o ano de fabricação deve ser informado manualmente.', 'good');
  }
  function initFipe() {
    $('fp-tipo').innerHTML = Object.keys(F.TYPES).map(function (k) { return '<option value="' + k + '">' + F.TYPES[k] + '</option>'; }).join('');
    $('btn-fipe').onclick = function () {
      var box = $('fipe-box'); box.hidden = !box.hidden; $('btn-fipe').setAttribute('aria-expanded', String(!box.hidden));
      if (!box.hidden && !$('fp-marca').options.length) fpBrands();
    };
    $('fp-tipo').onchange = fpBrands;
    $('fp-marca').onchange = function () {
      fpReset(2); fpReset(3); var b = this.value; if (!b) return;
      fpLoad('Carregando modelos…', F.models($('fp-tipo').value, b), function (l) { fipeState.models = l; $('fp-filtro').disabled = false; fpFilter(); });
    };
    $('fp-filtro').oninput = fpFilter;
    $('fp-modelo').onchange = function () {
      fpReset(3); var m = this.value; if (!m) return;
      fpLoad('Carregando anos…', F.years($('fp-tipo').value, $('fp-marca').value, m), function (l) { fillOpts($('fp-ano'), l, 'Selecione o ano e o combustível'); });
    };
    $('fp-ano').onchange = function () {
      var y = this.value; if (!y) return;
      fpLoad('Buscando dados do veículo…', F.detail($('fp-tipo').value, $('fp-marca').value, $('fp-modelo').value, y), fillVehicle);
    };
  }

  /* ---------- PDF ---------- */
  function blobInfo(b) {
    return new Promise(function (ok, bad) {
      var fr = new FileReader(); fr.onload = function () { var im = new Image(); im.onload = function () { ok({ d: fr.result, w: im.width, h: im.height }); }; im.onerror = function () { bad(new Error('foto')); }; im.src = fr.result; }; fr.onerror = function () { bad(new Error('foto')); }; fr.readAsDataURL(b);
    });
  }
  function loadPhotos() {
    var out = {};
    return Promise.all(cur.reparos.filter(function (r) { return r.fotoPath; }).map(function (r) {
      return D.photo(r.fotoPath).then(function (b) { return b ? blobInfo(b) : null; }).then(function (i) { if (i) out[r.id] = i; }).catch(function () {});
    })).then(function () { return out; });
  }
  function buildPDF(photos) {
    photos = photos || {};
    var P = window.PatioPDF, d = new P.Doc(), t = totals(cur), M = 40, W = P.PW - 2 * M, y;
    var GREEN = [24, 61, 50], MUTED = [102, 119, 111], LINE = [221, 228, 222], SOFT = [243, 246, 242], RED = [178, 69, 46];
    function band() { d.rect(0, 0, P.PW, 64, GREEN); d.text(M, 30, 'Pátio', 19, { bold: true, color: [255, 255, 255] }); d.text(M, 48, 'Relatório de avaliação · Reparos', 10.5, { color: [183, 242, 214] }); d.text(P.PW - M - 130, 40, 'Emitido em ' + dateBR(Date.now()), 9.5, { color: [200, 218, 208] }); }
    function ensure(h) { if (y + h > P.PH - 50) { d.addPage(); y = M; } }
    function money2(n) { return money(n); }
    band(); y = 92;
    d.text(M, y, title(cur), 20, { bold: true });
    var st = STATUS[cur.status] || cur.status, sw = P.textWidth(st, 10, true) + 20; d.rect(P.PW - M - sw, y - 15, sw, 20, cur.status === 'aprovado' ? [226, 245, 235] : cur.status === 'reprovado' ? [248, 228, 222] : [248, 239, 214]); d.text(P.PW - M - sw + 10, y - 1, st, 10, { bold: true, color: cur.status === 'aprovado' ? [23, 134, 90] : cur.status === 'reprovado' ? RED : [138, 106, 31] });
    y += 18; d.text(M, y, cur.versao || '', 10.5, { color: MUTED }); y += 16;

    // dados completos do veículo (2 colunas)
    var info = [['Placa', cur.placa || '—'], ['Marca', cur.marca || '—'], ['Modelo', cur.modelo || '—'], ['Versão', cur.versao || '—'],
      ['Ano de fabricação', cur.anoFab || '—'], ['Ano do modelo', cur.anoMod || '—'], ['Combustível', cur.combustivel || '—'], ['Motorização', cur.motorizacao || '—'],
      ['Quilometragem', cur.km ? cur.km + ' km' : '—'], ['Cor', cur.cor || '—'], ['Responsável', D.nome(cur.criadoPor)], ['Última atualização', dateBR(cur.atualizado) + ' · ' + D.nome(cur.atualizadoPor)]];
    var rows = Math.ceil(info.length / 2), colW = W / 2;
    d.rect(M, y, W, rows * 22 + 12, SOFT);
    info.forEach(function (it, k) { var cx = M + (k % 2) * colW + 12, cy = y + 22 + Math.floor(k / 2) * 22; d.text(cx, cy, it[0], 8.5, { color: MUTED }); d.text(cx + 92, cy, String(it[1]), 10, { bold: true }); });
    y += rows * 22 + 12 + 18;

    // vistas 3D
    var counts_ = counts(), w1 = (W - 12) / 2, h1 = w1 * 0.56;
    ['padrao', 'tras34'].forEach(function (v, k) { var c = window.Car3D.snapshot(560, 314, v, counts_); d.image(c.toDataURL('image/jpeg', 0.85), c.width, c.height, M + k * (w1 + 12), y, w1, h1); });
    y += h1 + 12; d.text(M, y, 'Pontos vermelhos numerados indicam a quantidade de reparos em cada região.', 8.5, { color: MUTED }); y += 22;

    // resumo financeiro
    ensure(250); d.text(M, y, 'Resumo financeiro', 12.5, { bold: true }); y += 8;
    var fr = [['Reparos registrados', String(t.qtd)], ['Custo total de peças', money2(t.pecas)], ['Custo total de mão de obra', money2(t.mao)], ['Custo total dos reparos', money2(t.reparos)], ['Valor de compra do veículo', money2(t.compra)]];
    d.rect(M, y, W, fr.length * 20 + 34, SOFT);
    fr.forEach(function (r, k) { var yy = y + 18 + k * 20; d.text(M + 12, yy, r[0], 10.5); d.text(M + W - 12 - P.textWidth(r[1], 10.5, true), yy, r[1], 10.5, { bold: true }); if (k < fr.length - 1) d.line(M + 12, yy + 6, M + W - 12, yy + 6, LINE); });
    var yi = y + fr.length * 20 + 22; d.text(M + 12, yi, 'Investimento total (compra + reparos)', 11.5, { bold: true, color: GREEN }); var inv = money2(t.invest); d.text(M + W - 12 - P.textWidth(inv, 13, true), yi, inv, 13, { bold: true, color: GREEN });
    y += fr.length * 20 + 34 + 10;
    var mg = [['Preço de venda pretendido', t.venda == null ? 'não informado' : money2(t.venda)], ['Margem bruta estimada', t.margem == null ? '—' : money2(t.margem) + '  (' + dec.format(t.margemPct) + '%)']];
    d.rect(M, y, W, 54, [238, 245, 240]);
    mg.forEach(function (r, k) { var yy = y + 20 + k * 20; d.text(M + 12, yy, r[0], 10.5); d.text(M + W - 12 - P.textWidth(r[1], 10.5, true), yy, r[1], 10.5, { bold: true, color: t.margem != null && t.margem < 0 && k === 1 ? RED : [20, 32, 28] }); });
    y += 54 + 12;
    d.text(M, y, 'Margem = preço de venda menos investimento total. Não inclui outras despesas operacionais.', 8.5, { color: MUTED }); y += 14;
    if (t.diretos) { d.text(M, y, t.diretos + (t.diretos === 1 ? ' reparo com custo total informado diretamente (sem separar peças e mão de obra).' : ' reparos com custo total informado diretamente (sem separar peças e mão de obra).'), 8.5, { color: MUTED }); y += 14; }
    y += 10;

    // reparos
    ensure(150); d.text(M, y, 'Reparos registrados', 12.5, { bold: true }); y += 14;
    if (!cur.reparos.length) d.text(M, y + 8, 'Nenhum reparo registrado.', 10.5, { color: MUTED });
    cur.reparos.forEach(function (r, k) {
      var reg = RB[r.regiao] ? RB[r.regiao].nome : r.regiao, tw_ = W - 150, lines = r.desc ? d.wrap(r.desc, 10, tw_) : [], ol = r.obs ? d.wrap('Obs.: ' + r.obs, 9, tw_) : [], ph = photos[r.id];
      var bh = Math.max(ph || true ? 112 : 70, 62 + lines.length * 13 + ol.length * 12), bs = bh + 14;
      ensure(bs); d.line(M, y, M + W, y, LINE); var top = y + 12;
      if (ph) { var sc = Math.min(130 / ph.w, 98 / ph.h); d.image(ph.d, ph.w, ph.h, M, top, ph.w * sc, ph.h * sc); }
      else { d.rect(M, top, 130, 98, SOFT); d.text(M + 40, top + 52, 'sem foto', 9, { color: MUTED }); }
      var x = M + 146, yy = top + 10;
      d.text(x, yy, (k + 1) + '. ' + reg, 11.5, { bold: true }); yy += 14; d.text(x, yy, r.tipo, 9.5, { color: GREEN, bold: true }); yy += 15;
      lines.forEach(function (l) { d.text(x, yy, l, 10); yy += 13; });
      ol.forEach(function (l) { d.text(x, yy, l, 9, { color: MUTED }); yy += 12; });
      yy = Math.max(yy + 4, top + 84);
      d.text(x, yy, r.direto ? 'Custo total informado diretamente' : 'Peças ' + money2(r.pecas) + '   ·   Mão de obra ' + money2(r.mao), 9.5, { color: MUTED });
      var tt = 'Total ' + money2(r.total); d.text(M + W - P.textWidth(tt, 11, true), yy, tt, 11, { bold: true });
      y += bs;
    });
    d.pages.forEach(function (p, k) { d.cur = p; d.text(M, P.PH - 24, 'Pátio · Avaliação de veículos · ' + (cur.placa || title(cur)), 8.5, { color: MUTED }); var s = 'Página ' + (k + 1) + ' de ' + d.pages.length; d.text(P.PW - M - P.textWidth(s, 8.5), P.PH - 24, s, 8.5, { color: MUTED }); });
    return d;
  }

  /* ---------- equipe ---------- */
  function renderTeam() {
    var admin = D.state.papel === 'admin';
    $('members').innerHTML = D.state.membros.map(function (m) {
      return '<li><span class="who"><b>' + esc(m.nome || m.email) + (m.user_id === D.state.userId ? ' (você)' : '') + '</b><small>' + esc(m.email) + ' · ' + (m.papel === 'admin' ? 'Administrador' : 'Avaliador') + '</small></span>' +
        (admin && m.user_id !== D.state.userId ? '<button type="button" class="btn small ghost" data-rmmember="' + m.user_id + '">Remover</button>' : '') + '</li>';
    }).join('');
    $('team-form').hidden = !admin; $('team-err').hidden = true;
  }
  function openTeam() { lastFocus = document.activeElement; $('team').hidden = false; document.body.classList.add('lock-scroll'); D.loadMembers().then(renderTeam).catch(function (e) { toast(errMsg(e)); }); renderTeam(); }
  function closeTeam() { $('team').hidden = true; document.body.classList.remove('lock-scroll'); if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {} }

  /* ---------- migração do navegador ---------- */
  function renderMigrar() {
    var n = D.localItems().length, b = $('migrar');
    if (n > 0) { b.hidden = false; b.innerHTML = '<span>Encontramos <b>' + n + '</b> ' + (n === 1 ? 'avaliação salva' : 'avaliações salvas') + ' só neste navegador (versão anterior). Envie para a sua conta para a equipe ver e para não perder.</span><button type="button" class="btn primary" id="btn-migrar">Enviar para a conta</button>'; }
    else if (D.hasBackup()) { b.hidden = false; b.innerHTML = '<span>Suas avaliações antigas foram enviadas e conferidas. Uma cópia de segurança continua guardada neste navegador.</span><button type="button" class="btn" id="btn-drop">Apagar a cópia local</button>'; }
    else b.hidden = true;
  }
  function doMigrar() {
    var btn = $('btn-migrar'); btn.disabled = true;
    D.migrate(function (i, n) { btn.textContent = 'Enviando ' + i + ' de ' + n + '…'; }).then(function (rep) {
      var msg = rep.concluida ? 'Migração concluída e conferida: ' + rep.ok + ' avaliações, ' + rep.fotos + ' fotos.' : 'Migração incompleta: ' + rep.ok + ' de ' + rep.total + ' enviadas. Nada foi apagado do navegador.';
      if (rep.avisos.length) msg += ' ' + rep.avisos.join(' ');
      if (rep.erros.length) msg += ' Erros: ' + rep.erros.join('; ');
      toast(msg); return renderList();
    }).catch(function (e) { toast(errMsg(e)); btn.disabled = false; });
  }

  /* ---------- rota e eventos ---------- */
  function route() {
    var seq = ++routeSeq, h = location.hash.replace('#', '');
    return flush().then(function () {
      if (seq !== routeSeq) return;
      if (h.indexOf('a-') === 0) {
        show('edit'); $('t-edit').textContent = 'Carregando…';
        return D.get(h.slice(2)).then(function (av) { if (seq !== routeSeq) return; if (!av) { toast('Avaliação não encontrada.'); location.hash = ''; return; } open(av); })
          .catch(function (e) { toast(errMsg(e)); location.hash = ''; });
      }
      cur = null; show('list'); document.title = 'Pátio · Avaliação de veículos'; return renderList();
    });
  }
  function newAval() {
    D.create({}).then(function (av) { location.hash = '#a-' + av.id; }).catch(function (e) { toast(errMsg(e)); });
  }
  function confirmClick(btn, label, fn) {
    if (btn.dataset.armed) { clearTimeout(+btn.dataset.armed); delete btn.dataset.armed; btn.textContent = btn.dataset.old; fn(); return; }
    btn.dataset.old = btn.textContent; btn.textContent = label; btn.dataset.armed = setTimeout(function () { delete btn.dataset.armed; btn.textContent = btn.dataset.old; }, 4000);
  }

  function start(user) {
    var meta = (user && user.user_metadata) || {}, name = meta.full_name || meta.name || (user && user.email) || 'U';
    $('av').textContent = String(name).trim().charAt(0).toUpperCase();
    fillSelects(); initFipe();
    $('list').innerHTML = '<div class="loading"><span class="spin"></span>Conectando à sua conta…</div>';
    D.init(window.PatioAuth.client, user).then(function () {
      $('btn-nova').onclick = newAval; $('btn-equipe').onclick = openTeam;
      $('btn-voltar').onclick = function () { location.hash = ''; };
      $('btn-foto').onclick = function () { pickPhoto(true); };
      $('btn-add').onclick = function () { openModal({}); };
      $('btn-del').onclick = function () { confirmClick($('btn-del'), 'Clique de novo para excluir', function () { var av = cur; pending = {}; D.remove(av).then(function () { cur = null; location.hash = ''; toast('Avaliação excluída.'); }).catch(function (e) { toast(errMsg(e)); }); }); };
      $('btn-pdf').onclick = function () {
        var b = $('btn-pdf'); b.disabled = true; b.textContent = 'Gerando PDF…';
        flush().then(loadPhotos).then(function (ph) { var d = buildPDF(ph); d.save('avaliacao-' + ((cur.placa || title(cur)).toLowerCase().replace(/[^a-z0-9]+/g, '-')) + '.pdf'); toast('Relatório PDF gerado.'); })
          .catch(function () { toast('Não foi possível gerar o PDF.'); }).then(function () { b.disabled = false; b.textContent = 'Gerar relatório PDF'; });
      };
      document.querySelectorAll('[data-view]').forEach(function (b) { b.onclick = function () { if (car) car.setView(b.getAttribute('data-view')); }; });

      var map = { 'v-marca': 'marca', 'v-modelo': 'modelo', 'v-versao': 'versao', 'v-anofab': 'anoFab', 'v-anomod': 'anoMod', 'v-comb': 'combustivel', 'v-motor': 'motorizacao', 'v-km': 'km', 'v-cor': 'cor' };
      Object.keys(map).forEach(function (id) {
        $(id).addEventListener('input', function () {
          var v = this.value; if (id === 'v-anofab' || id === 'v-anomod' || id === 'v-km') { v = v.replace(/\D/g, ''); this.value = v; }
          if ((id === 'v-anofab' || id === 'v-anomod') && v && (v.length !== 4 || +v < 1900 || +v > 2100)) return; // só salva ano completo
          var p = {}; p[map[id]] = v; if (cur.origem === 'consulta' && (id === 'v-marca' || id === 'v-modelo')) p.origem = 'manual'; touch(p); renderHead();
        });
      });
      $('v-placa').addEventListener('input', function () {
        var p = plateNorm(this.value); this.value = p.length > 3 && plateKind(p) === 'antiga' ? p.slice(0, 3) + '-' + p.slice(3) : p;
        var k = plateHint(p); if (k || !p) touch({ placa: p });
      });
      $('v-status').addEventListener('change', function () { touch({ status: this.value }); flush(); });
      $('v-compra').addEventListener('input', function () { var n = parseMoney(this.value); touch({ compra: isNaN(n) ? 0 : n }); renderSummary(); });
      $('v-compra').addEventListener('blur', function () { this.value = fmtInput(cur.compra); });
      $('v-venda').addEventListener('input', function () { var n = parseMoney(this.value); touch({ venda: this.value.trim() === '' || isNaN(n) ? null : n }); renderSummary(); });
      $('v-venda').addEventListener('blur', function () { this.value = fmtInput(cur.venda); });

      $('r-pecas').addEventListener('input', calcTotal); $('r-mao').addEventListener('input', calcTotal);
      $('r-direto').addEventListener('change', function () { setDireto(this.checked); if (this.checked) { $('r-total').value = ''; $('r-total').focus(); } });
      $('photo-pick').onclick = function () { pickPhoto(false); };
      $('photo-del').onclick = function () { modal.foto = null; modal.removed = true; showPhoto(); };
      $('form').addEventListener('submit', submitModal);
      $('team-form').addEventListener('submit', function (e) {
        e.preventDefault(); var em = $('team-email').value.trim(), err = $('team-err'); err.hidden = true;
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { err.textContent = 'Informe um e-mail válido.'; err.hidden = false; return; }
        D.addMember(em, $('team-papel').value).then(function () { $('team-email').value = ''; renderTeam(); toast('Funcionário adicionado.'); }).catch(function (x) { err.textContent = errMsg(x); err.hidden = false; });
      });
      document.addEventListener('click', function (e) {
        if (e.target.closest('[data-close]')) { closeModal(); return; }
        if (e.target.closest('[data-close-team]')) { closeTeam(); return; }
        if (e.target.closest('[data-new]')) { newAval(); return; }
        if (e.target.closest('[data-retry]')) { route(); return; }
        if (e.target.closest('#btn-migrar')) { doMigrar(); return; }
        if (e.target.closest('#btn-drop')) { var bd = e.target.closest('#btn-drop'); confirmClick(bd, 'Confirmar: apagar cópia local', function () { D.dropBackup(); renderMigrar(); }); return; }
        var rmm = e.target.closest('[data-rmmember]'); if (rmm) { confirmClick(rmm, 'Confirmar?', function () { D.removeMember(rmm.getAttribute('data-rmmember')).then(renderTeam).catch(function (x) { var er = $('team-err'); er.textContent = errMsg(x); er.hidden = false; }); }); return; }
        var ed = e.target.closest('[data-edit]'); if (ed) { openModal({ id: ed.getAttribute('data-edit') }); return; }
        var rm = e.target.closest('[data-rm]');
        if (rm) confirmClick(rm, 'Confirmar?', function () {
          var id = rm.getAttribute('data-rm'), rep = cur.reparos.filter(function (x) { return x.id === id; })[0];
          D.removeRepair(rep).then(function () { cur.reparos = cur.reparos.filter(function (x) { return x.id !== id; }); renderRepairs(); renderSummary(); toast('Reparo excluído.'); }).catch(function (x) { toast(errMsg(x)); });
        });
      });
      document.addEventListener('keydown', function (e) { if (e.key !== 'Escape') return; if (!$('modal').hidden) closeModal(); else if (!$('team').hidden) closeTeam(); });
      window.addEventListener('hashchange', route);
      window.addEventListener('beforeunload', function () { if (Object.keys(pending).length) flush(); });
      document.documentElement.classList.add('ready');
      return route();
    }).catch(function (e) {
      $('list').innerHTML = '<div class="empty card"><h3>Não foi possível conectar</h3><p class="muted">' + esc(errMsg(e)) + '</p><button type="button" class="btn" onclick="location.reload()">Recarregar</button></div>';
    });
  }

  window.PatioAval = { totals: totals, parseMoney: parseMoney, plateKind: plateKind, buildPDF: buildPDF, car: function () { return car; }, current: function () { return cur; }, flush: flush };
  window.PatioGuard.start({ logoutId: 'btn-sair', onReady: start });
})();
