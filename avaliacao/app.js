/* Avaliação de veículos · registro de reparos (categoria única: REPAROS).
 * Dados por usuário em localStorage ('patio.aval.v1.<id>'). Troque load()/save() por chamadas ao banco quando houver tabela. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var R = window.Car3D.REGIONS, RB = window.Car3D.BY_ID;
  var TIPOS = ['Amassado', 'Risco ou arranhão', 'Trinca ou quebra', 'Ferrugem', 'Pintura danificada', 'Peça faltando', 'Desgaste', 'Problema mecânico', 'Problema elétrico', 'Outro'];
  var KEY = 'patio.aval.v1.anon', store = { items: [] }, cur = null, car = null, modal = { id: null, foto: null }, toastT = 0, lastFocus = null;

  /* ---------- utilitários ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function round2(n) { return Math.round((n + 1e-9) * 100) / 100; }
  var brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  var dec = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function money(n) { return brl.format(n || 0); }
  function parseMoney(s) { // "1.234,56" | "1234.56" | "R$ 80" -> número; vazio -> 0; inválido -> NaN
    s = String(s == null ? '' : s).replace(/R\$|\s/g, '');
    if (s === '') return 0;
    if (s.indexOf(',') !== -1) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    return /^\d+(\.\d+)?$/.test(s) ? round2(parseFloat(s)) : NaN;
  }
  function fmtInput(n) { return n ? dec.format(n) : ''; }
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 3500); }
  function dateBR(ts) { return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  function title(av) { var t = ((av.marca || '') + ' ' + (av.modelo || '')).trim(); return t || 'Novo veículo'; }

  /* ---------- dados ---------- */
  function load() { try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && Array.isArray(s.items)) store = s; } catch (e) {} }
  function save() {
    if (cur) cur.atualizado = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(store)); var el = $('saved-at'); if (el && cur) el.textContent = 'Salvo automaticamente às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '.'; return true; }
    catch (e) { toast('Não foi possível salvar: o espaço do navegador acabou. Remova fotos de reparos antigos.'); return false; }
  }
  function totals(av) {
    var t = { qtd: av.reparos.length, pecas: 0, mao: 0, reparos: 0, diretos: 0 };
    av.reparos.forEach(function (r) { t.pecas += r.pecas || 0; t.mao += r.mao || 0; t.reparos += r.total || 0; if (r.direto) t.diretos++; });
    t.pecas = round2(t.pecas); t.mao = round2(t.mao); t.reparos = round2(t.reparos);
    t.compra = av.compra || 0; t.invest = round2(t.compra + t.reparos);
    return t;
  }

  /* ---------- telas ---------- */
  function show(view) { $('view-list').hidden = view !== 'list'; $('view-edit').hidden = view !== 'edit'; $('crumb-sep').hidden = $('crumb-cur').hidden = view !== 'edit'; }
  function renderList() {
    var box = $('list'), items = store.items.slice().sort(function (a, b) { return b.atualizado - a.atualizado; });
    if (!items.length) {
      box.innerHTML = '<div class="empty card"><div class="empty-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4.5h6M9 13l2.2 2.2L15.5 11"/></svg></div><h3>Nenhuma avaliação ainda</h3><p class="muted">Comece cadastrando um veículo. Você poderá fotografar avarias, estimar os custos e gerar o relatório em PDF.</p><button type="button" class="btn primary" data-new>+ Nova avaliação</button></div>';
      return;
    }
    box.innerHTML = items.map(function (av) {
      var t = totals(av);
      return '<a class="acard card" href="#a-' + av.id + '" data-id="' + av.id + '"><div class="a-top"><span class="plate">' + esc(av.placa || 'SEM PLACA') + '</span><span class="muted small">' + dateBR(av.atualizado) + '</span></div>' +
        '<h3>' + esc(title(av)) + '</h3><p class="muted">' + esc([av.ano, av.cor, av.km ? av.km + ' km' : ''].filter(Boolean).join(' · ') || 'Dados do veículo pendentes') + '</p>' +
        '<div class="a-foot"><span><b>' + t.qtd + '</b> ' + (t.qtd === 1 ? 'reparo' : 'reparos') + '</span><span class="a-inv"><small>Investimento total</small><b>' + money(t.invest) + '</b></span></div></a>';
    }).join('');
  }

  function open(id) {
    var av = store.items.filter(function (x) { return x.id === id; })[0];
    if (!av) { location.hash = ''; return; }
    cur = av;
    $('v-marca').value = av.marca || ''; $('v-modelo').value = av.modelo || ''; $('v-ano').value = av.ano || ''; $('v-placa').value = av.placa || '';
    $('v-km').value = av.km || ''; $('v-cor').value = av.cor || ''; $('v-compra').value = fmtInput(av.compra);
    show('edit'); renderHead(); renderRepairs(); renderSummary();
    if (!car) car = window.Car3D.create($('car'), { onPick: function (id) { openModal({ regiao: id }); }, getCounts: counts });
    else car.size();
    window.scrollTo(0, 0);
  }
  function renderHead() { var t = title(cur); $('t-edit').textContent = t; $('crumb-cur').textContent = t; document.title = 'Pátio · ' + t; }
  function counts() { var c = {}; if (cur) cur.reparos.forEach(function (r) { c[r.regiao] = (c[r.regiao] || 0) + 1; }); return c; }

  function renderRepairs() {
    $('rep-count').textContent = cur.reparos.length;
    var box = $('repairs');
    if (!cur.reparos.length) { box.innerHTML = '<p class="muted empty-s">Nenhum reparo registrado. Fotografe uma avaria ou toque em um ponto do veículo em 3D.</p>'; return; }
    box.innerHTML = cur.reparos.map(function (r, i) {
      var reg = RB[r.regiao] ? RB[r.regiao].nome : r.regiao;
      var thumb = r.foto ? '<img class="thumb" src="' + r.foto.d + '" alt="Foto da avaria: ' + esc(r.tipo) + ' em ' + esc(reg) + '">' : '<div class="thumb none" aria-hidden="true">sem foto</div>';
      return '<article class="rep" data-id="' + r.id + '">' + thumb + '<div class="rep-b"><div class="rep-t"><span class="n">' + (i + 1) + '</span><b>' + esc(reg) + '</b><span class="tag">' + esc(r.tipo) + '</span></div>' +
        (r.desc ? '<p>' + esc(r.desc) + '</p>' : '') + (r.obs ? '<p class="muted small">Obs.: ' + esc(r.obs) + '</p>' : '') +
        '<div class="costs">' + (r.direto ? '<span>Custo total informado diretamente</span>' : '<span>Peças <b>' + money(r.pecas) + '</b></span><span>Mão de obra <b>' + money(r.mao) + '</b></span>') + '<span class="tot">Total <b>' + money(r.total) + '</b></span></div></div>' +
        '<div class="rep-a"><button type="button" class="btn small" data-edit="' + r.id + '">Editar</button><button type="button" class="btn small ghost" data-rm="' + r.id + '">Excluir</button></div></article>';
    }).join('');
  }
  function renderSummary() {
    var t = totals(cur);
    function row(l, v, cls, raw) { return '<div class="' + (cls || '') + '"><dt>' + l + '</dt><dd data-raw="' + raw + '">' + v + '</dd></div>'; }
    $('summary').innerHTML = row('Reparos registrados', t.qtd, '', t.qtd) + row('Custo total de peças', money(t.pecas), '', t.pecas) + row('Custo total de mão de obra', money(t.mao), '', t.mao) +
      row('Custo total estimado dos reparos', money(t.reparos), 'strong', t.reparos) + row('Valor de compra do veículo', money(t.compra), '', t.compra) + row('Investimento total <small>(compra + reparos)</small>', money(t.invest), 'big', t.invest);
    var n = $('sum-note');
    n.hidden = !t.diretos; if (t.diretos) n.textContent = t.diretos + (t.diretos === 1 ? ' reparo teve' : ' reparos tiveram') + ' o custo total informado diretamente: ' + (t.diretos === 1 ? 'ele entra' : 'eles entram') + ' no total dos reparos, mas não nas somas de peças e mão de obra.';
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
  function calcTotal() {
    var p = parseMoney($('r-pecas').value), m = parseMoney($('r-mao').value);
    $('r-total').value = fmtInput(round2((isNaN(p) ? 0 : p) + (isNaN(m) ? 0 : m)));
  }
  function showPhoto() {
    var f = modal.foto, v = $('photo-view');
    v.innerHTML = f ? '<img src="' + f.d + '" alt="Fotografia da avaria">' : '<span class="muted">Nenhuma fotografia</span>';
    $('photo-del').hidden = !f; $('photo-pick').textContent = f ? 'Trocar foto' : 'Tirar ou escolher foto';
  }
  function openModal(o) {
    o = o || {}; lastFocus = document.activeElement;
    var r = o.id ? cur.reparos.filter(function (x) { return x.id === o.id; })[0] : null;
    modal = { id: r ? r.id : null, foto: o.foto || (r && r.foto) || null };
    $('m-title').textContent = r ? 'Editar reparo' : 'Registrar reparo';
    $('r-regiao').value = r ? r.regiao : (o.regiao || ''); $('r-tipo').value = r ? r.tipo : '';
    $('r-desc').value = r ? r.desc : ''; $('r-obs').value = r ? r.obs : '';
    $('r-pecas').value = r && !r.direto ? fmtInput(r.pecas) : ''; $('r-mao').value = r && !r.direto ? fmtInput(r.mao) : '';
    setDireto(!!(r && r.direto)); if (r) $('r-total').value = fmtInput(r.total); else calcTotal();
    $('r-err').hidden = true; showPhoto();
    $('modal').hidden = false; document.body.classList.add('lock-scroll');
    $('r-regiao').focus();
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
    var rep = { id: modal.id || uid(), foto: modal.foto, regiao: reg, tipo: tipo, desc: $('r-desc').value.trim(), pecas: p, mao: m, direto: direto, total: direto ? t : round2(p + m), obs: $('r-obs').value.trim() };
    var i = -1; cur.reparos.forEach(function (x, k) { if (x.id === rep.id) i = k; });
    if (i >= 0) cur.reparos[i] = rep; else cur.reparos.push(rep);
    if (!save()) { if (i < 0) cur.reparos.pop(); return; }
    renderRepairs(); renderSummary(); closeModal(); toast('Reparo salvo.');
  }

  /* foto: reduz para até 1000 px e guarda como JPEG (economiza espaço e entra direto no PDF) */
  function processPhoto(file) {
    return new Promise(function (ok, bad) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(1, 1000 / Math.max(img.width, img.height)), w = Math.max(1, Math.round(img.width * s)), h = Math.max(1, Math.round(img.height * s));
        var c = document.createElement('canvas'); c.width = w; c.height = h; var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url); ok({ d: c.toDataURL('image/jpeg', 0.72), w: w, h: h });
      };
      img.onerror = function () { URL.revokeObjectURL(url); bad(new Error('imagem inválida')); };
      img.src = url;
    });
  }
  function pickPhoto(thenModal) {
    var f = $('file'); f.value = ''; f.onchange = function () {
      var file = f.files && f.files[0]; if (!file) return;
      processPhoto(file).then(function (ph) { if (thenModal) openModal({ foto: ph }); else { modal.foto = ph; showPhoto(); } }).catch(function () { toast('Não foi possível ler essa imagem.'); });
    };
    f.click();
  }

  /* ---------- relatório em PDF ---------- */
  function buildPDF() {
    var P = window.PatioPDF, d = new P.Doc(), t = totals(cur), M = 40, W = P.PW - 2 * M, y;
    var GREEN = [24, 61, 50], MUTED = [102, 119, 111], LINE = [221, 228, 222], SOFT = [243, 246, 242];
    function band() { d.rect(0, 0, P.PW, 64, GREEN); d.text(M, 30, 'Pátio', 19, { bold: true, color: [255, 255, 255] }); d.text(M, 48, 'Relatório de avaliação · Reparos', 10.5, { color: [183, 242, 214] }); d.text(P.PW - M - 130, 40, 'Emitido em ' + dateBR(Date.now()), 9.5, { color: [200, 218, 208] }); }
    function ensure(h) { if (y + h > P.PH - 50) { d.addPage(); y = M; } }
    band(); y = 92;
    d.text(M, y, title(cur), 20, { bold: true }); y += 18;
    d.text(M, y, [cur.placa && 'Placa ' + cur.placa, cur.ano, cur.cor, cur.km && cur.km + ' km'].filter(Boolean).join('  ·  ') || 'Dados do veículo não informados', 10.5, { color: MUTED }); y += 22;

    // vistas 3D
    var counts_ = counts(), w1 = (W - 12) / 2, h1 = w1 * 0.56, i;
    ['padrao', 'tras34'].forEach(function (v, k) {
      var c = window.Car3D.snapshot(560, 314, v, counts_), data = c.toDataURL('image/jpeg', 0.85);
      d.image(data, c.width, c.height, M + k * (w1 + 12), y, w1, h1);
    });
    y += h1 + 8; d.text(M, y + 4, 'Pontos vermelhos numerados indicam a quantidade de reparos em cada região.', 8.5, { color: MUTED }); y += 22;

    // resumo
    d.text(M, y, 'Resumo financeiro', 12.5, { bold: true }); y += 8;
    var rows = [['Reparos registrados', String(t.qtd)], ['Custo total de peças', money(t.pecas)], ['Custo total de mão de obra', money(t.mao)], ['Custo total estimado dos reparos', money(t.reparos)], ['Valor de compra do veículo', money(t.compra)]];
    d.rect(M, y, W, rows.length * 20 + 34, SOFT);
    rows.forEach(function (r, k) { var yy = y + 18 + k * 20; d.text(M + 12, yy, r[0], 10.5); d.text(M + W - 12 - P.textWidth(r[1], 10.5, true), yy, r[1], 10.5, { bold: true }); if (k < rows.length - 1) d.line(M + 12, yy + 6, M + W - 12, yy + 6, LINE); });
    var yi = y + rows.length * 20 + 22; d.text(M + 12, yi, 'Investimento total (compra + reparos)', 11.5, { bold: true, color: GREEN }); var inv = money(t.invest); d.text(M + W - 12 - P.textWidth(inv, 13, true), yi, inv, 13, { bold: true, color: GREEN });
    y += rows.length * 20 + 34 + 28;
    if (t.diretos) { d.text(M, y - 12, t.diretos + (t.diretos === 1 ? ' reparo com custo total informado diretamente (sem separar peças e mão de obra).' : ' reparos com custo total informado diretamente (sem separar peças e mão de obra).'), 8.5, { color: MUTED }); y += 6; }

    // reparos
    ensure(40); d.text(M, y, 'Reparos registrados', 12.5, { bold: true }); y += 14;
    if (!cur.reparos.length) d.text(M, y + 8, 'Nenhum reparo registrado.', 10.5, { color: MUTED });
    cur.reparos.forEach(function (r, k) {
      var reg = RB[r.regiao] ? RB[r.regiao].nome : r.regiao, tw_ = W - 150, lines = r.desc ? d.wrap(r.desc, 10, tw_) : [], ol = r.obs ? d.wrap('Obs.: ' + r.obs, 9, tw_) : [];
      var bh = Math.max(r.foto ? 112 : 70, 62 + lines.length * 13 + ol.length * 12), bs = bh + 14;
      ensure(bs); d.line(M, y, M + W, y, LINE); var top = y + 12;
      if (r.foto) { var sc = Math.min(130 / r.foto.w, 98 / r.foto.h); d.image(r.foto.d, r.foto.w, r.foto.h, M, top, r.foto.w * sc, r.foto.h * sc); }
      else { d.rect(M, top, 130, 98, SOFT); d.text(M + 40, top + 52, 'sem foto', 9, { color: MUTED }); }
      var x = M + 146, yy = top + 10;
      d.text(x, yy, k + 1 + '. ' + reg, 11.5, { bold: true }); yy += 14; d.text(x, yy, r.tipo, 9.5, { color: GREEN, bold: true }); yy += 15;
      lines.forEach(function (l) { d.text(x, yy, l, 10); yy += 13; });
      ol.forEach(function (l) { d.text(x, yy, l, 9, { color: MUTED }); yy += 12; });
      yy = Math.max(yy + 4, top + 84);
      var costs = r.direto ? 'Custo total informado diretamente' : 'Peças ' + money(r.pecas) + '   ·   Mão de obra ' + money(r.mao);
      d.text(x, yy, costs, 9.5, { color: MUTED }); var tt = 'Total ' + money(r.total); d.text(M + W - P.textWidth(tt, 11, true), yy, tt, 11, { bold: true });
      y += bs;
    });
    d.pages.forEach(function (p, k) { d.cur = p; d.text(M, P.PH - 24, 'Pátio · Avaliação de veículos', 8.5, { color: MUTED }); var s = 'Página ' + (k + 1) + ' de ' + d.pages.length; d.text(P.PW - M - P.textWidth(s, 8.5), P.PH - 24, s, 8.5, { color: MUTED }); });
    return d;
  }

  /* ---------- eventos ---------- */
  function route() {
    var h = location.hash.replace('#', '');
    if (h.indexOf('a-') === 0) { open(h.slice(2)); }
    else { cur = null; show('list'); document.title = 'Pátio · Avaliação de veículos'; renderList(); }
  }
  function newAval() {
    var av = { id: uid(), criado: Date.now(), atualizado: Date.now(), marca: '', modelo: '', ano: '', placa: '', km: '', cor: '', compra: 0, reparos: [] };
    store.items.push(av); save(); location.hash = '#a-' + av.id;
  }
  function confirmClick(btn, label, fn) { // exclusão em dois cliques, sem diálogo do navegador
    if (btn.dataset.armed) { clearTimeout(+btn.dataset.armed); delete btn.dataset.armed; btn.textContent = btn.dataset.old; fn(); return; }
    btn.dataset.old = btn.textContent; btn.textContent = label; btn.dataset.armed = setTimeout(function () { delete btn.dataset.armed; btn.textContent = btn.dataset.old; }, 4000);
  }

  function start(user) {
    var meta = (user && user.user_metadata) || {}, name = meta.full_name || meta.name || (user && user.email) || 'U';
    $('av').textContent = String(name).trim().charAt(0).toUpperCase();
    KEY = 'patio.aval.v1.' + ((user && user.id) || 'anon');
    load(); fillSelects();

    $('btn-nova').onclick = newAval;
    $('list').addEventListener('click', function (e) { if (e.target.closest('[data-new]')) newAval(); });
    $('btn-voltar').onclick = function () { location.hash = ''; };
    $('btn-foto').onclick = function () { pickPhoto(true); };
    $('btn-add').onclick = function () { openModal({}); };
    $('btn-del').onclick = function () { var b = $('btn-del'); confirmClick(b, 'Clique de novo para excluir', function () { store.items = store.items.filter(function (x) { return x !== cur; }); cur = null; save(); location.hash = ''; toast('Avaliação excluída.'); }); };
    $('btn-pdf').onclick = function () {
      var b = $('btn-pdf'); b.disabled = true;
      try { var d = buildPDF(); d.save('avaliacao-' + ((cur.placa || title(cur)).toLowerCase().replace(/[^a-z0-9]+/g, '-')) + '.pdf'); toast('Relatório PDF gerado.'); }
      catch (e) { toast('Não foi possível gerar o PDF.'); }
      b.disabled = false;
    };
    document.querySelectorAll('[data-view]').forEach(function (b) { b.onclick = function () { if (car) car.setView(b.getAttribute('data-view')); }; });

    var map = { 'v-marca': 'marca', 'v-modelo': 'modelo', 'v-ano': 'ano', 'v-placa': 'placa', 'v-km': 'km', 'v-cor': 'cor' };
    Object.keys(map).forEach(function (id) {
      $(id).addEventListener('input', function () {
        var v = this.value; if (id === 'v-placa') { v = v.toUpperCase().replace(/[^A-Z0-9-]/g, ''); this.value = v; } if (id === 'v-ano' || id === 'v-km') { v = v.replace(/\D/g, ''); this.value = v; }
        cur[map[id]] = v; save(); renderHead();
      });
    });
    $('v-compra').addEventListener('input', function () { var n = parseMoney(this.value); cur.compra = isNaN(n) ? 0 : n; save(); renderSummary(); });
    $('v-compra').addEventListener('blur', function () { this.value = fmtInput(cur.compra); });

    $('r-pecas').addEventListener('input', calcTotal); $('r-mao').addEventListener('input', calcTotal);
    $('r-direto').addEventListener('change', function () { setDireto(this.checked); if (this.checked) { $('r-total').value = ''; $('r-total').focus(); } });
    $('r-regiao').addEventListener('change', function () { var s = this.value; if (car && s && RB[s] && RB[s].a) car.refresh(); });
    $('photo-pick').onclick = function () { pickPhoto(false); };
    $('photo-del').onclick = function () { modal.foto = null; showPhoto(); };
    $('form').addEventListener('submit', submitModal);
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { closeModal(); return; }
      var ed = e.target.closest('[data-edit]'); if (ed) { openModal({ id: ed.getAttribute('data-edit') }); return; }
      var rm = e.target.closest('[data-rm]'); if (rm) confirmClick(rm, 'Confirmar?', function () { var id = rm.getAttribute('data-rm'); cur.reparos = cur.reparos.filter(function (x) { return x.id !== id; }); save(); renderRepairs(); renderSummary(); toast('Reparo excluído.'); });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('modal').hidden) closeModal(); });
    window.addEventListener('hashchange', route);
    route();
    document.documentElement.classList.add('ready');
  }

  window.PatioAval = { totals: totals, parseMoney: parseMoney, store: function () { return store; }, buildPDF: buildPDF, car: function () { return car; } };
  window.PatioGuard.start({ logoutId: 'btn-sair', onReady: start });
})();
