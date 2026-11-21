/* Motor de métricas do Dashboard: períodos, comparação com o período anterior e todos os indicadores.
 * Funções puras: recebem os dados (DashboardData.load()), o período e a unidade, e devolvem números.
 * Nada aqui toca na tela. Datas são strings ISO (AAAA-MM-DD), que comparam corretamente como texto.
 */
(function () {
  'use strict';

  var M = {};

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function add(s, n) { var d = parse(s); return iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12)); }
  function diff(a, b) { return Math.round((parse(a) - parse(b)) / 864e5); }
  function inR(d, f, t) { return !!d && d >= f && d <= t; }
  function monthStart(s) { return s.slice(0, 8) + '01'; }
  function monthEnd(s) { var d = parse(s); return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12)); }
  function minStr(a, b) { return a < b ? a : b; }

  M.iso = iso; M.parse = parse; M.add = add; M.diff = diff;

  M.PRESETS = [
    ['mes', 'Este mês'], ['mespassado', 'Mês passado'], ['d7', 'Últimos 7 dias'],
    ['d30', 'Últimos 30 dias'], ['d90', 'Últimos 90 dias'], ['ano', 'Este ano'], ['custom', 'Personalizado']
  ];

  /* ---------- períodos ---------- */
  M.range = function (preset, today, cFrom, cTo) {
    var from, to, pf, pt, label = 'vs. período anterior', name;
    var prevMonthEnd = add(monthStart(today), -1);

    if (preset === 'mes') {
      from = monthStart(today); to = today;
      pf = monthStart(prevMonthEnd);
      pt = minStr(add(pf, diff(to, from)), prevMonthEnd);
      label = 'vs. mês anterior'; name = 'Este mês';
    } else if (preset === 'mespassado') {
      from = monthStart(prevMonthEnd); to = prevMonthEnd;
      var beforeEnd = add(from, -1);
      pf = monthStart(beforeEnd); pt = beforeEnd;
      label = 'vs. mês anterior'; name = 'Mês passado';
    } else if (preset === 'ano') {
      from = today.slice(0, 4) + '-01-01'; to = today;
      var py = String(+today.slice(0, 4) - 1);
      pf = py + '-01-01';
      pt = minStr(py + today.slice(4), py + '-12-31');
      if (pt.slice(5) === '02-29' || diff(pt, pf) < 0) pt = py + '-02-28';
      label = 'vs. ano anterior'; name = 'Este ano';
    } else if (preset === 'custom' && cFrom && cTo) {
      from = cFrom <= cTo ? cFrom : cTo; to = cFrom <= cTo ? cTo : cFrom;
      var len = diff(to, from) + 1;
      pt = add(from, -1); pf = add(pt, -(len - 1));
      name = 'Personalizado';
    } else {
      var n = preset === 'd7' ? 7 : preset === 'd90' ? 90 : 30;
      from = add(today, -(n - 1)); to = today;
      pt = add(from, -1); pf = add(pt, -(n - 1));
      name = 'Últimos ' + n + ' dias';
    }
    return { preset: preset, name: name, from: from, to: to, prevFrom: pf, prevTo: pt, days: diff(to, from) + 1, compareLabel: label };
  };

  /* ---------- totais de um período ---------- */
  function stats(ds, f, t, unit) {
    var o = { vendas: 0, lucro: 0, receita: 0, leads: 0, ag: 0, vis: 0, neg: 0, apr: 0, rej: 0, pend: 0,
      entradas: 0, saidas: 0, fin: 0, ret: 0, nfin: 0 };
    var all = unit === 'all', i, x;
    for (i = 0; i < ds.sales.length; i++) {
      x = ds.sales[i];
      if ((!all && x.unitId !== unit) || !inR(x.data, f, t)) continue;
      o.vendas++; o.lucro += x.lucro; o.receita += x.precoVenda;
      if (x.financiado) { o.nfin++; o.fin += x.valorFinanciado; o.ret += x.retornoValor; }
    }
    for (i = 0; i < ds.leads.length; i++) {
      x = ds.leads[i];
      if (!all && x.unitId !== unit) continue;
      if (inR(x.dLead, f, t)) o.leads++;
      if (inR(x.dAg, f, t)) o.ag++;
      if (inR(x.dVis, f, t)) o.vis++;
      if (inR(x.dNeg, f, t)) o.neg++;
    }
    for (i = 0; i < ds.avaliacoes.length; i++) {
      x = ds.avaliacoes[i];
      if ((!all && x.unitId !== unit) || !inR(x.data, f, t)) continue;
      if (x.status === 'aprovada') o.apr++; else if (x.status === 'reprovada') o.rej++; else o.pend++;
    }
    for (i = 0; i < ds.vehicles.length; i++) {
      x = ds.vehicles[i];
      if (!all && x.unitId !== unit) continue;
      if (inR(x.entrada, f, t)) o.entradas++;
      if (inR(x.saida, f, t)) o.saidas++;
    }
    o.real = o.apr + o.rej;
    o.aprPct = o.real ? o.apr / o.real * 100 : 0;
    o.ticket = o.vendas ? o.receita / o.vendas : 0;
    o.retPct = o.fin ? o.ret / o.fin * 100 : 0;
    o.conv = o.leads ? o.vendas / o.leads * 100 : 0;
    return o;
  }
  M.stats = stats;

  /* ---------- séries (sparklines e fluxo) ---------- */
  M.buckets = function (from, to, mode) {
    var days = diff(to, from) + 1, out = [], cur, end, b;
    var daily = mode === 'bars' ? days <= 14 : days <= 31;
    var weekly = days <= 120;
    if (daily) {
      for (cur = from; cur <= to; cur = add(cur, 1)) out.push({ from: cur, to: cur, label: cur.slice(8) + '/' + cur.slice(5, 7) });
    } else if (weekly) {
      for (cur = from; cur <= to; cur = add(cur, 7)) {
        end = minStr(add(cur, 6), to);
        out.push({ from: cur, to: end, label: cur.slice(8) + '/' + cur.slice(5, 7) });
      }
    } else {
      for (cur = from; cur <= to; cur = add(monthEnd(cur), 1)) {
        end = minStr(monthEnd(cur), to);
        b = { from: cur, to: end, label: cur.slice(5, 7) + '/' + cur.slice(2, 4) };
        out.push(b);
      }
    }
    out.forEach(function (x) {
      x.range = x.from === x.to ? fmtD(x.from) : fmtD(x.from) + ' a ' + fmtD(x.to);
    });
    return out;
  };
  function fmtD(s) { return s.slice(8) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4); }

  function series(ds, r, unit) {
    var bk = M.buckets(r.from, r.to, 'spark');
    var all = unit === 'all';
    var res = { buckets: bk, vendas: [], lucro: [], leads: [], ticket: [], fin: [], ret: [] };
    bk.forEach(function (b) {
      var s = stats(ds, b.from, b.to, unit);
      res.vendas.push(s.vendas); res.lucro.push(s.lucro); res.leads.push(s.leads);
      res.ticket.push(Math.round(s.ticket)); res.fin.push(s.fin); res.ret.push(s.ret);
    });
    return res;
  }

  /* ---------- estoque no fim do período ---------- */
  function stockAt(ds, asOf, unit) {
    var list = [];
    ds.vehicles.forEach(function (v) {
      if (unit !== 'all' && v.unitId !== unit) return;
      if (v.entrada <= asOf && (!v.saida || v.saida > asOf)) {
        list.push({ v: v, dias: diff(asOf, v.entrada) });
      }
    });
    return list;
  }
  M.agingKey = function (d) { return d <= 30 ? 'a30' : d <= 60 ? 'a60' : d <= 90 ? 'a90' : 'a90p'; };
  M.AGING = [['a30', '0–30 dias'], ['a60', '30–60 dias'], ['a90', '60–90 dias'], ['a90p', '+ de 90 dias']];

  /* ---------- tudo junto ---------- */
  M.compute = function (ds, r, unit) {
    var cur = stats(ds, r.from, r.to, unit);
    var prev = stats(ds, r.prevFrom, r.prevTo, unit);
    var all = unit === 'all';

    // estoque e pendências
    var asOf = minStr(r.to, ds.today);
    var stockList = stockAt(ds, asOf, unit);
    var stock = { asOf: asOf, total: stockList.length, list: stockList, showroom: 0, atacado: 0, proprio: 0, consignado: 0,
      aging: M.AGING.map(function (a) { return { key: a[0], label: a[1], count: 0 }; }) };
    stockList.forEach(function (x) {
      stock[x.v.canal]++; stock[x.v.propriedade]++;
      var k = M.agingKey(x.dias);
      stock.aging.forEach(function (a) { if (a.key === k) a.count++; });
    });
    var now = stockAt(ds, ds.today, unit);
    var pend = {
      avaliacao: ds.avaliacoes.filter(function (a) { return a.status === 'pendente' && (all || a.unitId === unit); }).length,
      negociacao: ds.leads.filter(function (l) { return l.aberta && (all || l.unitId === unit); }).length,
      recebimento: now.filter(function (x) { return x.v.recebimentoPendente; }).length,
      servico: now.filter(function (x) { return x.v.servicoPendente; }).length,
      anuncio: now.filter(function (x) { return !x.v.temAnuncio; }).length
    };

    // funil e origens
    var funnel = [
      { key: 'lead', label: 'Leads recebidos', count: cur.leads },
      { key: 'ag', label: 'Agendamentos', count: cur.ag },
      { key: 'vis', label: 'Visitas', count: cur.vis },
      { key: 'neg', label: 'Negociações', count: cur.neg },
      { key: 'venda', label: 'Vendas concluídas', count: cur.vendas }
    ];
    var originCount = {};
    ds.origins.forEach(function (o) { originCount[o] = 0; });
    var sellerMap = {};
    ds.sellers.forEach(function (s) {
      if (all || s.unitId === unit) sellerMap[s.id] = { id: s.id, nome: s.nome, unitId: s.unitId, leads: 0, ag: 0, vis: 0, neg: 0, vendas: 0, lucro: 0, conv: 0 };
    });
    ds.leads.forEach(function (l) {
      if (!all && l.unitId !== unit) return;
      var sm = sellerMap[l.sellerId];
      if (inR(l.dLead, r.from, r.to)) { originCount[l.origem]++; if (sm) sm.leads++; }
      if (sm) {
        if (inR(l.dAg, r.from, r.to)) sm.ag++;
        if (inR(l.dVis, r.from, r.to)) sm.vis++;
        if (inR(l.dNeg, r.from, r.to)) sm.neg++;
      }
    });
    var salesIn = ds.sales.filter(function (s) { return (all || s.unitId === unit) && inR(s.data, r.from, r.to); });
    salesIn.forEach(function (s) { var sm = sellerMap[s.sellerId]; if (sm) { sm.vendas++; sm.lucro += s.lucro; } });
    var sellers = Object.keys(sellerMap).map(function (k) {
      var s = sellerMap[k]; s.conv = s.leads ? s.vendas / s.leads * 100 : 0; return s;
    });
    var origins = ds.origins.map(function (o) { return { nome: o, count: originCount[o] }; });

    // lucro por veículo
    var topProfit = salesIn.slice().sort(function (a, b) { return b.lucro - a.lucro; }).slice(0, 8);

    // bancos
    var bankMap = {};
    salesIn.forEach(function (s) {
      if (!s.financiado) return;
      var b = bankMap[s.banco] || (bankMap[s.banco] = { nome: s.banco, volume: 0, retorno: 0, n: 0 });
      b.volume += s.valorFinanciado; b.retorno += s.retornoValor; b.n++;
    });
    var banks = Object.keys(bankMap).map(function (k) { var b = bankMap[k]; b.pct = b.volume ? b.retorno / b.volume * 100 : 0; return b; })
      .sort(function (a, b) { return b.volume - a.volume; });

    // fluxo entradas x saídas
    var flow = M.buckets(r.from, r.to, 'bars').map(function (b) {
      var s = stats(ds, b.from, b.to, unit);
      return { label: b.label, range: b.range, entradas: s.entradas, saidas: s.saidas };
    });

    return { range: r, unit: unit, cur: cur, prev: prev, series: series(ds, r, unit), stock: stock, pend: pend,
      funnel: funnel, origins: origins, sellers: sellers, topProfit: topProfit, banks: banks, flow: flow };
  };

  /* ---------- listas para o detalhamento (clique nos indicadores) ---------- */
  M.lists = {
    sales: function (ds, r, unit) {
      return ds.sales.filter(function (s) { return (unit === 'all' || s.unitId === unit) && inR(s.data, r.from, r.to); })
        .sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : 0; });
    },
    leads: function (ds, r, unit, stage) {
      var f = { lead: 'dLead', ag: 'dAg', vis: 'dVis', neg: 'dNeg', venda: 'dVenda' }[stage || 'lead'];
      return ds.leads.filter(function (l) { return (unit === 'all' || l.unitId === unit) && inR(l[f], r.from, r.to); })
        .sort(function (a, b) { return a[f] < b[f] ? 1 : a[f] > b[f] ? -1 : 0; })
        .map(function (l) { return { l: l, data: l[f] }; });
    },
    avaliacoes: function (ds, r, unit, only) {
      return ds.avaliacoes.filter(function (a) {
        if ((unit !== 'all' && a.unitId !== unit) || !inR(a.data, r.from, r.to)) return false;
        return only === 'aprovada' ? a.status === 'aprovada' : only === 'real' ? a.status !== 'pendente' : true;
      }).sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : 0; });
    },
    movements: function (ds, r, unit, tipo) {
      var out = [];
      ds.vehicles.forEach(function (v) {
        if (unit !== 'all' && v.unitId !== unit) return;
        if ((!tipo || tipo === 'entrada') && inR(v.entrada, r.from, r.to)) {
          out.push({ tipo: 'Entrada', data: v.entrada, marca: v.marca, modelo: v.modelo, ano: v.ano, placa: v.placa, valor: v.custo });
        }
        if ((!tipo || tipo === 'saida') && inR(v.saida, r.from, r.to)) {
          out.push({ tipo: v.saidaTipo === 'venda' ? 'Saída · venda' : 'Saída · devolução', data: v.saida, marca: v.marca, modelo: v.modelo,
            ano: v.ano, placa: v.placa, valor: v.saidaTipo === 'venda' ? v.precoVenda : v.anuncio });
        }
      });
      return out.sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : 0; });
    },
    pend: function (ds, unit, kind) {
      var all = unit === 'all';
      if (kind === 'avaliacao') return { type: 'aval', rows: ds.avaliacoes.filter(function (a) { return a.status === 'pendente' && (all || a.unitId === unit); }) };
      if (kind === 'negociacao') return { type: 'lead', rows: ds.leads.filter(function (l) { return l.aberta && (all || l.unitId === unit); }).map(function (l) { return { l: l, data: l.dNeg }; }) };
      var now = stockAt(ds, ds.today, unit).filter(function (x) {
        return kind === 'recebimento' ? x.v.recebimentoPendente : kind === 'servico' ? x.v.servicoPendente : !x.v.temAnuncio;
      });
      return { type: 'stock', rows: now };
    },
    stock: function (ds, asOf, unit, filter) {
      var list = stockAt(ds, asOf, unit);
      if (filter && filter !== 'total') {
        list = list.filter(function (x) {
          return x.v.canal === filter || x.v.propriedade === filter || M.agingKey(x.dias) === filter;
        });
      }
      return list.sort(function (a, b) { return b.dias - a.dias; });
    },
    financed: function (ds, r, unit, bank) {
      return M.lists.sales(ds, r, unit).filter(function (s) { return s.financiado && (!bank || s.banco === bank); });
    }
  };

  window.PatioMetrics = M;
})();
