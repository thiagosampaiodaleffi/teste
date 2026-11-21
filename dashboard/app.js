/* Dashboard Executivo: estado dos filtros, renderização das seções e detalhamento ao clicar nos indicadores.
 * Fonte de dados: window.DashboardData.load() (hoje demonstração; ver README.md para trocar pelo Supabase). */
(function () {
  'use strict';
  var U = window.PatioUI, C = window.PatioCharts, M = window.PatioMetrics;
  var KEY = 'patio.dash.filters.v1';
  var ds, state = { preset: 'mes', from: '', to: '', unit: 'all', sort: 'lucro', dir: -1 }, res, $ = function (id) { return document.getElementById(id); };

  function load() { try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) Object.keys(s).forEach(function (k) { if (k in state) state[k] = s[k]; }); } catch (e) {} }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  function card(cls, inner, drill) {
    return '<div class="card ' + cls + '">' + inner + '</div>';
  }

  /* ---------- indicadores principais ---------- */
  function kpis(r) {
    var c = r.cur, p = r.prev, s = r.series, lab = r.range.compareLabel;
    var list = [
      { id: 'vendas', l: 'Vendas realizadas', raw: c.vendas, v: U.int(c.vendas), d: U.delta(c.vendas, p.vendas), sp: s.vendas, f: U.int, drill: 'sales', hint: 'Veículos vendidos' },
      { id: 'lucro', l: 'Lucro bruto', raw: c.lucro, v: U.money(c.lucro), d: U.delta(c.lucro, p.lucro), sp: s.lucro, f: U.money, drill: 'profit', hint: 'Venda − custo − preparo' },
      { id: 'leads', l: 'Leads recebidos', raw: c.leads, v: U.int(c.leads), d: U.delta(c.leads, p.leads), sp: s.leads, f: U.int, drill: 'funnel:lead', hint: 'Novos contatos' },
      { id: 'ticket', l: 'Ticket médio', raw: Math.round(c.ticket), v: U.money(c.ticket), d: U.delta(c.ticket, p.ticket), sp: s.ticket, f: U.money, drill: 'sales', hint: 'Receita ÷ vendas' }
    ];
    $('kpis').innerHTML = list.map(function (k) {
      return '<button type="button" class="card kpi click" data-kpi="' + k.id + '" data-raw="' + k.raw + '" data-drill="' + k.drill + '">' +
        '<span class="kpi-l">' + k.l + '</span><span class="kpi-v">' + k.v + '</span>' +
        '<span class="kpi-d">' + U.deltaPill(k.d, lab) + '</span>' +
        '<span class="kpi-s">' + C.spark(k.sp, s.buckets, k.f) + '</span>' +
        '<span class="kpi-h">' + k.hint + ' · anterior: ' + (k.id === 'vendas' ? U.int(p.vendas) : k.id === 'lucro' ? U.money(p.lucro) : k.id === 'leads' ? U.int(p.leads) : U.money(p.ticket)) + '</span></button>';
    }).join('');
  }

  /* ---------- estoque e giro ---------- */
  function stock(r) {
    var st = r.stock, t = st.total || 1;
    function tile(l, n, key) {
      return '<button type="button" class="tile click" data-raw="' + n + '" data-drill="stock:' + key + '"><span class="tile-v">' + U.int(n) + '</span><span class="tile-l">' + l + '</span></button>';
    }
    var aging = st.aging.map(function (a, i) {
      return { label: a.label, value: a.count, display: U.int(a.count) + ' <small>' + U.pct(a.count / t * 100) + '</small>', drill: 'stock:' + a.key,
        color: ['#3A7A63', '#B9C7B5', '#C9A66B', '#A65F3B'][i] };
    });
    var stack = st.aging.map(function (a, i) {
      return a.count ? '<i data-w="' + (a.count / t * 100).toFixed(2) + '" data-bg="' + ['#3A7A63', '#B9C7B5', '#C9A66B', '#A65F3B'][i] + '" data-tip="' + U.esc(a.label) + '|' + a.count + ' veículos"></i>' : '';
    }).join('');
    $('stock').innerHTML =
      '<div class="stock-total click" role="button" tabindex="0" data-raw="' + st.total + '" data-drill="stock:total"><span class="big">' + U.int(st.total) + '</span><span class="muted">veículos em estoque' + (st.asOf !== ds.today ? ' em ' + U.date(st.asOf) : '') + '</span></div>' +
      '<div class="tiles">' + tile('Showroom', st.showroom, 'showroom') + tile('Atacado', st.atacado, 'atacado') + tile('Próprio', st.proprio, 'proprio') + tile('Consignado', st.consignado, 'consignado') + '</div>' +
      '<h4>Tempo em estoque</h4><div class="stack">' + stack + '</div>' + C.hbars(aging);
    var pd = r.pend;
    function pt(l, n, k, tone) { return '<button type="button" class="pend click ' + (n ? tone : '') + '" data-raw="' + n + '" data-drill="pend:' + k + '"><span class="pend-v">' + U.int(n) + '</span><span class="pend-l">' + l + '</span></button>'; }
    $('pend').innerHTML = pt('Avaliações', pd.avaliacao, 'avaliacao', 'warn') + pt('Negociações abertas', pd.negociacao, 'negociacao', 'info') +
      pt('Recebimentos', pd.recebimento, 'recebimento', 'warn') + pt('Serviços', pd.servico, 'servico', 'warn') + pt('Sem anúncio', pd.anuncio, 'anuncio', 'bad');
  }

  /* ---------- avaliações e movimentações ---------- */
  function avals(r) {
    var c = r.cur, p = r.prev, lab = r.range.compareLabel;
    var total = c.apr + c.rej + c.pend;
    function t(l, v, d, drill, raw) {
      return '<button type="button" class="tile click" data-raw="' + raw + '" data-drill="' + drill + '"><span class="tile-v">' + v + '</span><span class="tile-l">' + l + '</span>' + (d ? '<span class="tile-d">' + U.deltaPill(d) + '</span>' : '') + '</button>';
    }
    $('avals').innerHTML =
      t('Avaliações realizadas', U.int(total), U.delta(total, p.apr + p.rej + p.pend), 'aval:all', total) +
      t('Aprovadas', U.int(c.apr), U.delta(c.apr, p.apr), 'aval:aprovada', c.apr) +
      t('Taxa de aprovação', U.pct(c.aprPct), U.deltaPts(c.aprPct, p.aprPct), 'aval:real', c.aprPct.toFixed(1)) +
      t('Entradas', U.int(c.entradas), U.delta(c.entradas, p.entradas), 'mov:entrada', c.entradas) +
      t('Saídas', U.int(c.saidas), U.delta(c.saidas, p.saidas), 'mov:saida', c.saidas);
    $('flow').innerHTML = '<div class="legend"><span><i class="b-in"></i>Entradas</span><span><i class="b-out"></i>Saídas</span></div>' + C.columns(r.flow);
    var mv = M.lists.movements(ds, r.range, state.unit).slice(0, 8);
    $('moves').innerHTML = mv.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>Data</th><th>Mov.</th><th>Veículo</th><th>Ano</th><th>Placa</th><th class="num">Valor</th></tr></thead><tbody>' +
      mv.map(function (m) { return '<tr><td>' + U.date(m.data) + '</td><td><span class="chip ' + (m.tipo === 'Entrada' ? 'in' : 'out') + '">' + U.esc(m.tipo) + '</span></td><td><b>' + U.esc(m.marca) + '</b> ' + U.esc(m.modelo) + '</td><td>' + m.ano + '</td><td class="mono">' + m.placa + '</td><td class="num">' + U.money(m.valor) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' : '<p class="empty">Nenhuma movimentação no período.</p>';
  }

  /* ---------- funil e origens ---------- */
  function funnel(r) {
    $('funnel').innerHTML = C.funnel(r.funnel);
    var tot = r.cur.leads;
    var o = r.origins.slice();
    $('origins').innerHTML = C.donut(o.map(function (x) { return { label: x.nome, value: x.count }; }), U.int(tot), 'leads') +
      '<ul class="legend-list">' + o.map(function (x, i) {
        return '<li class="click" tabindex="0" role="button" data-raw="' + x.count + '" data-drill="origin:' + U.esc(x.nome) + '"><i data-bg="' + C.COLORS[i % 8] + '"></i><span>' + U.esc(x.nome) + '</span><b>' + U.int(x.count) + '</b><small>' + (tot ? U.pct(x.count / tot * 100) : '0,0%') + '</small></li>';
      }).join('') + '</ul>';
  }

  /* ---------- vendedores ---------- */
  var SCOLS = [['nome', 'Vendedor', 't'], ['leads', 'Leads', 'n'], ['ag', 'Agend.', 'n'], ['vis', 'Visitas', 'n'], ['neg', 'Negoc.', 'n'], ['vendas', 'Vendas', 'n'], ['conv', 'Conversão', 'p'], ['lucro', 'Lucro gerado', 'm']];
  function sellers(r) {
    var rows = r.sellers.slice().sort(function (a, b) {
      var x = a[state.sort], y = b[state.sort];
      return (typeof x === 'string' ? x.localeCompare(y, 'pt-BR') : x - y) * state.dir;
    });
    var maxL = 1; rows.forEach(function (s) { maxL = Math.max(maxL, s.lucro); });
    $('sellers').innerHTML = '<table class="tbl" id="sellers-tbl"><thead><tr><th class="rk">#</th>' + SCOLS.map(function (c) {
      var on = state.sort === c[0];
      return '<th class="' + (c[2] === 't' ? '' : 'num') + '" aria-sort="' + (on ? (state.dir > 0 ? 'ascending' : 'descending') : 'none') + '"><button type="button" class="th-btn' + (on ? ' on' : '') + '" data-sort="' + c[0] + '">' + c[1] + '<span aria-hidden="true">' + (on ? (state.dir > 0 ? ' ▲' : ' ▼') : '') + '</span></button></th>';
    }).join('') + '</tr></thead><tbody>' + rows.map(function (s, i) {
      return '<tr class="click" tabindex="0" data-drill="seller:' + s.id + '" data-seller="' + s.id + '"><td class="rk">' + (i + 1) + '</td><td><b>' + U.esc(s.nome) + '</b><small class="muted"> · ' + U.esc(ds.unitById[s.unitId].nome) + '</small></td>' +
        '<td class="num">' + U.int(s.leads) + '</td><td class="num">' + U.int(s.ag) + '</td><td class="num">' + U.int(s.vis) + '</td><td class="num">' + U.int(s.neg) + '</td><td class="num"><b>' + U.int(s.vendas) + '</b></td>' +
        '<td class="num"><span class="conv">' + U.pct(s.conv) + '</span></td><td class="num lucro"><span class="lbar" data-w="' + (s.lucro / maxL * 100).toFixed(1) + '"></span><b>' + U.money(s.lucro) + '</b></td></tr>';
    }).join('') + '</tbody></table>';
  }

  /* ---------- lucro por veículo ---------- */
  function profit(r) {
    var rows = r.topProfit, mx = rows.length ? rows[0].lucro : 1;
    $('profit').innerHTML = rows.length ? '<div class="scroll"><table class="tbl"><thead><tr><th class="rk">#</th><th>Placa</th><th>Marca</th><th>Modelo</th><th>Ano</th><th class="num">Lucro bruto</th></tr></thead><tbody>' +
      rows.map(function (s, i) { return '<tr><td class="rk">' + (i + 1) + '</td><td class="mono">' + s.placa + '</td><td>' + U.esc(s.marca) + '</td><td>' + U.esc(s.modelo) + '</td><td>' + s.ano + '</td><td class="num lucro"><span class="lbar" data-w="' + (s.lucro / mx * 100).toFixed(1) + '"></span><b>' + U.money(s.lucro) + '</b></td></tr>'; }).join('') +
      '</tbody></table></div>' : '<p class="empty">Nenhuma venda no período.</p>';
  }

  /* ---------- financeiro ---------- */
  function finance(r) {
    var c = r.cur, p = r.prev, lab = r.range.compareLabel;
    function f(l, v, d, raw) { return '<button type="button" class="tile click wide" data-raw="' + raw + '" data-drill="fin:"><span class="tile-v">' + v + '</span><span class="tile-l">' + l + '</span><span class="tile-d">' + U.deltaPill(d, lab) + '</span></button>'; }
    $('fin').innerHTML = f('Total financiado', U.money(c.fin), U.delta(c.fin, p.fin), Math.round(c.fin)) +
      f('Retorno total líquido', U.money(c.ret), U.delta(c.ret, p.ret), Math.round(c.ret)) +
      f('Retorno médio', U.pct(c.retPct), U.deltaPts(c.retPct, p.retPct), c.retPct.toFixed(2));
    var mv = 1; r.banks.forEach(function (b) { mv = Math.max(mv, b.volume); });
    $('banks').innerHTML = r.banks.length ? '<div class="scroll"><table class="tbl"><thead><tr><th class="rk">#</th><th>Banco</th><th class="num">Volume financiado</th><th class="num">% retorno</th><th class="num">Retorno (R$)</th></tr></thead><tbody>' +
      r.banks.map(function (b, i) { return '<tr class="click" tabindex="0" data-drill="bank:' + U.esc(b.nome) + '"><td class="rk">' + (i + 1) + '</td><td><b>' + U.esc(b.nome) + '</b><small class="muted"> · ' + b.n + ' contratos</small></td><td class="num lucro"><span class="lbar" data-w="' + (b.volume / mv * 100).toFixed(1) + '"></span><b>' + U.money(b.volume) + '</b></td><td class="num">' + U.pct(b.pct) + '</td><td class="num">' + U.money(b.retorno) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' : '<p class="empty">Nenhum financiamento no período.</p>';
  }

  /* ---------- detalhamento ---------- */
  var COL = {
    sale: [{ k: 'data', l: 'Data', t: 'd' }, { k: 'veic', l: 'Veículo', t: 't' }, { k: 'ano', l: 'Ano', t: 't' }, { k: 'placa', l: 'Placa', t: 't' }, { k: 'vendedor', l: 'Vendedor', t: 't' }, { k: 'unid', l: 'Unidade', t: 't' }, { k: 'valor', l: 'Venda', t: 'm' }, { k: 'lucro', l: 'Lucro', t: 'm' }],
    fin: [{ k: 'data', l: 'Data', t: 'd' }, { k: 'veic', l: 'Veículo', t: 't' }, { k: 'placa', l: 'Placa', t: 't' }, { k: 'banco', l: 'Banco', t: 't' }, { k: 'fin', l: 'Financiado', t: 'm' }, { k: 'pct', l: '% retorno', t: 'p' }, { k: 'ret', l: 'Retorno', t: 'm' }],
    lead: [{ k: 'data', l: 'Data', t: 'd' }, { k: 'origem', l: 'Origem', t: 't' }, { k: 'vendedor', l: 'Vendedor', t: 't' }, { k: 'unid', l: 'Unidade', t: 't' }, { k: 'status', l: 'Situação', t: 't' }],
    aval: [{ k: 'data', l: 'Data', t: 'd' }, { k: 'veic', l: 'Veículo', t: 't' }, { k: 'ano', l: 'Ano', t: 't' }, { k: 'unid', l: 'Unidade', t: 't' }, { k: 'valor', l: 'Valor avaliado', t: 'm' }, { k: 'status', l: 'Situação', t: 't' }],
    mov: [{ k: 'data', l: 'Data', t: 'd' }, { k: 'tipo', l: 'Movimento', t: 't' }, { k: 'veic', l: 'Veículo', t: 't' }, { k: 'ano', l: 'Ano', t: 't' }, { k: 'placa', l: 'Placa', t: 't' }, { k: 'valor', l: 'Valor', t: 'm' }],
    stock: [{ k: 'entrada', l: 'Entrada', t: 'd' }, { k: 'dias', l: 'Dias em estoque', t: 'n' }, { k: 'veic', l: 'Veículo', t: 't' }, { k: 'ano', l: 'Ano', t: 't' }, { k: 'placa', l: 'Placa', t: 't' }, { k: 'canal', l: 'Canal', t: 't' }, { k: 'prop', l: 'Propriedade', t: 't' }, { k: 'unid', l: 'Unidade', t: 't' }, { k: 'valor', l: 'Anúncio', t: 'm' }]
  };
  function uName(id) { return ds.unitById[id].nome; }
  function sName(id) { return ds.sellerById[id].nome; }
  var capit = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
  function mapSale(s) { return { data: s.data, veic: s.marca + ' ' + s.modelo, ano: s.ano, placa: s.placa, vendedor: sName(s.sellerId), unid: uName(s.unitId), valor: s.precoVenda, lucro: s.lucro }; }
  function mapFin(s) { return { data: s.data, veic: s.marca + ' ' + s.modelo, placa: s.placa, banco: s.banco, fin: s.valorFinanciado, pct: s.retornoPct, ret: s.retornoValor }; }
  function mapLead(x) { var l = x.l; return { data: x.data, origem: l.origem, vendedor: sName(l.sellerId), unid: uName(l.unitId), status: l.dVenda ? 'Vendido' : l.aberta ? 'Em negociação' : 'Em andamento' }; }
  function mapAval(a) { return { data: a.data, veic: a.marca + ' ' + a.modelo, ano: a.ano, unid: uName(a.unitId), valor: a.valor, status: capit(a.status) }; }
  function mapStock(x) { var v = x.v; return { entrada: v.entrada, dias: x.dias, veic: v.marca + ' ' + v.modelo, ano: v.ano, placa: v.placa, canal: capit(v.canal), prop: capit(v.propriedade), unid: uName(v.unitId), valor: v.anuncio }; }

  function drill(spec) {
    var i = spec.indexOf(':'), kind = i < 0 ? spec : spec.slice(0, i), arg = i < 0 ? '' : spec.slice(i + 1), r = res.range, u = state.unit, per = U.date(r.from) + ' a ' + U.date(r.to), rows, cols, title, file = 'patio-' + kind;
    if (kind === 'sales') { rows = M.lists.sales(ds, r, u).map(mapSale); cols = COL.sale; title = 'Vendas realizadas'; }
    else if (kind === 'profit') { rows = M.lists.sales(ds, r, u).sort(function (a, b) { return b.lucro - a.lucro; }).map(mapSale); cols = COL.sale; title = 'Lucro bruto por venda'; }
    else if (kind === 'funnel') {
      var nm = { lead: 'Leads recebidos', ag: 'Agendamentos', vis: 'Visitas', neg: 'Negociações', venda: 'Vendas concluídas' }[arg];
      rows = M.lists.leads(ds, r, u, arg).map(mapLead); cols = COL.lead; title = nm;
    }
    else if (kind === 'origin') { rows = M.lists.leads(ds, r, u, 'lead').filter(function (x) { return x.l.origem === arg; }).map(mapLead); cols = COL.lead; title = 'Leads · ' + arg; }
    else if (kind === 'seller') {
      rows = M.lists.sales(ds, r, u).filter(function (s) { return s.sellerId === arg; }).map(mapSale); cols = COL.sale; title = 'Vendas · ' + sName(arg);
    }
    else if (kind === 'aval') { rows = M.lists.avaliacoes(ds, r, u, arg === 'all' ? null : arg).map(mapAval); cols = COL.aval; title = { all: 'Avaliações realizadas', aprovada: 'Avaliações aprovadas', real: 'Avaliações concluídas (base da taxa)' }[arg]; }
    else if (kind === 'mov') { rows = M.lists.movements(ds, r, u, arg); cols = COL.mov; rows = rows.map(function (m) { return { data: m.data, tipo: m.tipo, veic: m.marca + ' ' + m.modelo, ano: m.ano, placa: m.placa, valor: m.valor }; }); title = arg === 'entrada' ? 'Entradas de veículos' : 'Saídas de veículos'; }
    else if (kind === 'stock') {
      rows = M.lists.stock(ds, res.stock.asOf, u, arg).map(mapStock); cols = COL.stock;
      title = 'Estoque · ' + ({ total: 'todos', showroom: 'showroom', atacado: 'atacado', proprio: 'próprio', consignado: 'consignado', a30: '0–30 dias', a60: '30–60 dias', a90: '60–90 dias', a90p: 'mais de 90 dias' }[arg]);
      per = 'Posição em ' + U.date(res.stock.asOf);
    }
    else if (kind === 'pend') {
      var p = M.lists.pend(ds, u, arg); title = 'Pendências · ' + { avaliacao: 'avaliações', negociacao: 'negociações', recebimento: 'recebimentos', servico: 'serviços', anuncio: 'veículos sem anúncio' }[arg]; per = 'Situação atual';
      if (p.type === 'aval') { rows = p.rows.map(mapAval); cols = COL.aval; } else if (p.type === 'lead') { rows = p.rows.map(mapLead); cols = COL.lead; } else { rows = p.rows.map(mapStock); cols = COL.stock; }
    }
    else if (kind === 'fin' || kind === 'bank') { rows = M.lists.financed(ds, r, u, arg || null).map(mapFin); cols = COL.fin; title = arg ? 'Financiamentos · ' + arg : 'Contratos financiados'; }
    else return;
    var un = u === 'all' ? 'Todas as unidades' : uName(u);
    U.drawer.open({ title: title, sub: per + ' · ' + un, columns: cols, rows: rows, file: file });
  }

  /* ---------- tela ---------- */
  function render() {
    var range = M.range(state.preset, ds.today, state.from, state.to);
    res = M.compute(ds, range, state.unit);
    $('period-sub').textContent = U.date(range.from) + ' a ' + U.date(range.to) + ' · ' + (state.unit === 'all' ? 'todas as unidades' : uName(state.unit)) + ' · ' + range.compareLabel + ' (' + U.date(range.prevFrom) + ' a ' + U.date(range.prevTo) + ')';
    kpis(res); stock(res); avals(res); funnel(res); sellers(res); profit(res); finance(res);
    U.dyn(document.getElementById('main'));
    $('custom-range').hidden = state.preset !== 'custom';
  }

  function bind() {
    var ps = $('f-period'), us = $('f-unit'), fr = $('f-from'), to = $('f-to');
    ps.innerHTML = M.PRESETS.map(function (p) { return '<option value="' + p[0] + '">' + p[1] + '</option>'; }).join('');
    us.innerHTML = '<option value="all">Todas as unidades</option>' + ds.units.map(function (u) { return '<option value="' + u.id + '">' + U.esc(u.nome) + '</option>'; }).join('');
    if (!state.from) { state.from = M.add(ds.today, -29); state.to = ds.today; }
    ps.value = state.preset; us.value = state.unit; fr.value = state.from; to.value = state.to;
    ps.onchange = function () { state.preset = ps.value; save(); render(); };
    us.onchange = function () { state.unit = us.value; save(); render(); };
    function dates() { if (fr.value && to.value) { state.from = fr.value; state.to = to.value; save(); render(); } }
    fr.onchange = dates; to.onchange = dates;

    document.addEventListener('click', function (e) {
      var th = e.target.closest('[data-sort]');
      if (th) { var k = th.getAttribute('data-sort'); if (state.sort === k) state.dir = -state.dir; else { state.sort = k; state.dir = k === 'nome' ? 1 : -1; } save(); sellers(res); U.dyn($('sellers')); return; }
      var d = e.target.closest('[data-drill]');
      if (d) drill(d.getAttribute('data-drill'));
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var d = e.target.closest && e.target.closest('[data-drill]');
      if (d && d.tagName !== 'BUTTON') { e.preventDefault(); drill(d.getAttribute('data-drill')); }
    });

    var menu = $('menu-btn'), body = document.body;
    menu.onclick = function () { var o = body.classList.toggle('nav-open'); menu.setAttribute('aria-expanded', o); };
    $('scrim').onclick = function () { body.classList.remove('nav-open'); menu.setAttribute('aria-expanded', 'false'); };
    $('refresh').onclick = function () { render(); };
  }

  window.DashboardApp = {
    start: function (user) {
      load();
      var who = (user && (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name) || user.email)) || 'Usuário';
      $('user-name').textContent = who; $('user-av').textContent = who.trim().charAt(0).toUpperCase();
      $('data-badge').textContent = window.DashboardData.label;
      U.initTips(); U.drawer.init();
      window.DashboardData.load().then(function (d) { ds = d; bind(); render(); document.documentElement.classList.add('dash-ready'); })
        .catch(function () { $('main').innerHTML = '<p class="empty">Não foi possível carregar os dados.</p>'; });
    }
  };
})();
