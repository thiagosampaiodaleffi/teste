/* Fonte de dados de DEMONSTRAÇÃO do Dashboard.
 *
 * Gera um conjunto fictício e consistente (mesma semente = mesmos números) com ~800 dias de
 * histórico terminando hoje. Todas as telas leem os dados por window.DashboardData.load().
 *
 * PARA INTEGRAR COM O SUPABASE: crie outro arquivo que defina window.DashboardData com o mesmo
 * contrato (veja dashboard/README.md) e troque o <script> no dashboard.html. Nada mais muda.
 */
(function () {
  'use strict';

  var DAYS = 800;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rnd = mulberry32(20261120);
  function ri(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
  function rf(a, b) { return a + rnd() * (b - a); }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  function wpick(pairs) {
    var t = 0, i;
    for (i = 0; i < pairs.length; i++) t += pairs[i][1];
    var r = rnd() * t;
    for (i = 0; i < pairs.length; i++) { r -= pairs[i][1]; if (r <= 0) return pairs[i][0]; }
    return pairs[pairs.length - 1][0];
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12); }
  function round100(n) { return Math.round(n / 100) * 100; }

  var UNITS = [
    { id: 'matriz', nome: 'Matriz' },
    { id: 'norte', nome: 'Filial Norte' },
    { id: 'sul', nome: 'Filial Sul' }
  ];
  var UNIT_W = [['matriz', 50], ['norte', 28], ['sul', 22]];

  // peso = quanto cada vendedor recebe do movimento da sua unidade
  var SELLERS = [
    { id: 's1', nome: 'Rafael Moura', unitId: 'matriz', peso: 1.5 },
    { id: 's2', nome: 'Camila Duarte', unitId: 'matriz', peso: 1.2 },
    { id: 's3', nome: 'Bruno Teixeira', unitId: 'matriz', peso: 0.8 },
    { id: 's4', nome: 'Patrícia Lemos', unitId: 'norte', peso: 1.3 },
    { id: 's5', nome: 'Diego Fontes', unitId: 'norte', peso: 0.9 },
    { id: 's6', nome: 'Juliana Prado', unitId: 'sul', peso: 1.2 },
    { id: 's7', nome: 'Marcelo Antunes', unitId: 'sul', peso: 1.0 },
    { id: 's8', nome: 'Aline Cardoso', unitId: 'sul', peso: 0.7 }
  ];

  var CATALOG = [
    ['Fiat', 'Argo', 62000], ['Fiat', 'Strada', 88000], ['Fiat', 'Mobi', 48000], ['Fiat', 'Toro', 128000],
    ['Volkswagen', 'Polo', 78000], ['Volkswagen', 'T-Cross', 99000], ['Volkswagen', 'Nivus', 105000], ['Volkswagen', 'Gol', 46000],
    ['Chevrolet', 'Onix', 58000], ['Chevrolet', 'Tracker', 112000], ['Chevrolet', 'S10', 190000],
    ['Hyundai', 'HB20', 62000], ['Hyundai', 'Creta', 118000],
    ['Toyota', 'Corolla', 118000], ['Toyota', 'Hilux', 230000],
    ['Honda', 'Civic', 98000], ['Honda', 'HR-V', 125000],
    ['Jeep', 'Compass', 135000], ['Jeep', 'Renegade', 95000],
    ['Renault', 'Kwid', 42000], ['Renault', 'Duster', 82000],
    ['Nissan', 'Kicks', 92000], ['Ford', 'Ranger', 205000], ['Peugeot', '208', 70000]
  ];

  // nome, peso no volume, retorno médio (%)
  var BANKS = [
    ['Santander', 22, 4.1], ['Bradesco', 18, 3.6], ['Itaú', 16, 3.2], ['Banco BV', 14, 4.8],
    ['Banco Pan', 11, 5.4], ['Omni', 8, 5.9], ['Safra', 6, 3.0], ['Banco do Brasil', 5, 2.7]
  ];
  var ORIGINS = [
    ['Avaliação', 9], ['Financiamento', 8], ['Webmotors', 24], ['Passante', 14],
    ['Carteira', 10], ['Mercado Livre', 12], ['WhatsApp', 17], ['Outros', 6]
  ];

  var LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  var usedPlates = {};
  function plate() {
    var p;
    do {
      p = LETTERS.charAt(ri(0, 23)) + LETTERS.charAt(ri(0, 23)) + LETTERS.charAt(ri(0, 23)) +
        ri(0, 9) + LETTERS.charAt(ri(0, 23)) + ri(0, 9) + ri(0, 9);
    } while (usedPlates[p]);
    usedPlates[p] = 1;
    return p;
  }

  function sellersOf(unitId) { return SELLERS.filter(function (s) { return s.unitId === unitId; }); }
  function sellerFor(unitId) {
    return wpick(sellersOf(unitId).map(function (s) { return [s.id, s.peso]; }));
  }

  function newVehicle(unitId, entradaDate, canal, propriedade) {
    var m = pick(CATALOG);
    var ano = Math.min(2025, 2025 - Math.floor(Math.pow(rnd(), 1.6) * 9));
    var anuncio = round100(Math.max(m[2] * 0.45, m[2] * (1 - 0.055 * (2025 - ano))));
    return {
      id: 'v' + (++vid), unitId: unitId, marca: m[0], modelo: m[1], ano: ano, placa: plate(),
      canal: canal, propriedade: propriedade,
      custo: round100(anuncio * rf(0.84, 0.93)), preparo: ri(4, 35) * 100, anuncio: anuncio,
      entrada: iso(entradaDate), saida: null, saidaTipo: null, precoVenda: null,
      temAnuncio: true, servicoPendente: false, recebimentoPendente: false
    };
  }
  var vid = 0;

  function build() {
    var today = new Date();
    today = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
    var todayIso = iso(today);

    var vehicles = [], sales = [], leads = [], avaliacoes = [];
    var lid = 0, sid = 0, aid = 0;

    var dowSales = [0.25, 1, 1, 1, 1.05, 1.15, 1.5];
    var dowLeads = [0.6, 1.05, 1.05, 1, 1, 1.1, 1.25];

    function count(rate) { return Math.floor(rate) + (rnd() < rate % 1 ? 1 : 0); }
    function capDate(d) { return d > todayIso ? null : d; }

    for (var di = -DAYS; di <= 0; di++) {
      var date = addDays(today, di);
      var dateIso = iso(date);
      var dow = date.getDay();
      var trend = 1 + 0.12 * Math.sin(di / 52) + 0.0001 * (di + DAYS);

      /* ----- vendas (cada venda tira um veículo do estoque) ----- */
      var nSales = count(1.45 * trend * dowSales[dow]);
      for (var k = 0; k < nSales; k++) {
        var unitId = wpick(UNIT_W);
        var canal = rnd() < 0.82 ? 'showroom' : 'atacado';
        var aging = Math.min(170, Math.round(Math.exp(rf(Math.log(3), Math.log(160)))));
        var v = newVehicle(unitId, addDays(date, -aging), canal, rnd() < 0.74 ? 'proprio' : 'consignado');
        v.saida = dateIso; v.saidaTipo = 'venda';
        v.precoVenda = round100(v.anuncio * rf(0.95, 1.0));
        vehicles.push(v);

        var sellerId = sellerFor(unitId);
        var sale = {
          id: 'm' + (++sid), data: dateIso, vehicleId: v.id, sellerId: sellerId, unitId: unitId, canal: canal,
          marca: v.marca, modelo: v.modelo, ano: v.ano, placa: v.placa,
          precoVenda: v.precoVenda, custo: v.custo, preparo: v.preparo,
          lucro: v.precoVenda - v.custo - v.preparo,
          financiado: false, banco: null, valorFinanciado: 0, retornoPct: 0, retornoValor: 0
        };
        if (rnd() < (canal === 'showroom' ? 0.62 : 0.07)) {
          var bank = wpick(BANKS.map(function (b) { return [b[0], b[1]]; }));
          var base = BANKS.filter(function (b) { return b[0] === bank; })[0][2];
          sale.financiado = true; sale.banco = bank;
          sale.valorFinanciado = round100(sale.precoVenda * rf(0.45, 0.85));
          sale.retornoPct = Math.round((base + rf(-0.6, 0.9)) * 100) / 100;
          sale.retornoValor = Math.round(sale.valorFinanciado * sale.retornoPct / 100);
        }
        sales.push(sale);

        // o lead que virou essa venda, com as etapas anteriores datadas para trás
        var dNeg = addDays(date, -ri(0, 6)), dVis = addDays(dNeg, -ri(0, 4)),
          dAg = addDays(dVis, -ri(0, 3)), dLead = addDays(dAg, -ri(0, 2));
        leads.push({
          id: 'l' + (++lid), unitId: unitId, sellerId: sellerId, origem: wpick(ORIGINS),
          dLead: iso(dLead), dAg: iso(dAg), dVis: iso(dVis), dNeg: iso(dNeg), dVenda: dateIso, saleId: sale.id, aberta: false
        });
      }

      /* ----- devoluções de consignados (saída que não é venda) ----- */
      if (rnd() < 0.1) {
        var dv = newVehicle(wpick(UNIT_W), addDays(date, -ri(60, 150)), 'showroom', 'consignado');
        dv.saida = dateIso; dv.saidaTipo = 'devolucao';
        vehicles.push(dv);
      }

      /* ----- leads que não viraram venda (ainda) ----- */
      var nLeads = count(21 * trend * dowLeads[dow]);
      for (var j = 0; j < nLeads; j++) {
        var u2 = wpick(UNIT_W);
        var L = {
          id: 'l' + (++lid), unitId: u2, sellerId: sellerFor(u2), origem: wpick(ORIGINS),
          dLead: dateIso, dAg: null, dVis: null, dNeg: null, dVenda: null, saleId: null, aberta: false
        };
        if (rnd() < 0.33) {
          L.dAg = capDate(iso(addDays(date, ri(0, 3))));
          if (L.dAg && rnd() < 0.6) {
            L.dVis = capDate(iso(addDays(parseIso(L.dAg), ri(0, 4))));
            if (L.dVis && rnd() < 0.5) {
              L.dNeg = capDate(iso(addDays(parseIso(L.dVis), ri(0, 5))));
              if (L.dNeg && diffDays(todayIso, L.dNeg) <= 25) L.aberta = true;
            }
          }
        }
        leads.push(L);
      }

      /* ----- avaliações ----- */
      var nAv = count(2.4 * dowLeads[dow]);
      for (var q = 0; q < nAv; q++) {
        var cm = pick(CATALOG), yr = ri(2015, 2025);
        var status = (di >= -2 && rnd() < 0.45) ? 'pendente' : (rnd() < 0.6 ? 'aprovada' : 'reprovada');
        avaliacoes.push({
          id: 'a' + (++aid), data: dateIso, unitId: wpick(UNIT_W), marca: cm[0], modelo: cm[1], ano: yr,
          valor: round100(Math.max(cm[2] * 0.4, cm[2] * (1 - 0.055 * (2025 - yr))) * rf(0.8, 0.92)), status: status
        });
      }
    }

    /* ----- estoque atual (veículos ainda não vendidos) ----- */
    for (var s = 0; s < 94; s++) {
      var age = Math.floor(175 * Math.pow(rnd(), 1.6));
      var sv = newVehicle(wpick(UNIT_W), addDays(today, -age), rnd() < 0.78 ? 'showroom' : 'atacado', rnd() < 0.7 ? 'proprio' : 'consignado');
      sv.temAnuncio = age > 2 && rnd() < 0.88;
      sv.servicoPendente = rnd() < 0.17;
      sv.recebimentoPendente = age <= 9 && rnd() < 0.35;
      vehicles.push(sv);
    }

    function parseIso(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
    function diffDays(a, b) { return Math.round((parseIso(a) - parseIso(b)) / 864e5); }

    var unitById = {}, sellerById = {};
    UNITS.forEach(function (u) { unitById[u.id] = u; });
    SELLERS.forEach(function (x) { sellerById[x.id] = x; });

    return {
      mode: 'demo', today: todayIso, units: UNITS, sellers: SELLERS, unitById: unitById, sellerById: sellerById,
      origins: ORIGINS.map(function (o) { return o[0]; }), banks: BANKS.map(function (b) { return b[0]; }),
      vehicles: vehicles, sales: sales, leads: leads, avaliacoes: avaliacoes
    };
  }

  var cache = null;
  window.DashboardData = {
    mode: 'demo',
    label: 'Dados de demonstração',
    load: function () {
      if (!cache) cache = build();
      return Promise.resolve(cache);
    }
  };
})();
