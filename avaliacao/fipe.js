/* Tabela FIPE (API pública e gratuita, sem chave) para identificar o veículo: marca > modelo > ano/combustível.
 * Limite do serviço sem conta: 500 consultas/dia por endereço. Respostas ficam em cache na sessão. */
(function () {
  'use strict';
  var BASE = 'https://fipe.parallelum.com.br/api/v2';
  var TYPES = { cars: 'Carros', motorcycles: 'Motos', trucks: 'Caminhões' };

  function norm(list) {
    if (!Array.isArray(list)) list = (list && (list.modelos || list.models || list.items)) || [];
    return list.map(function (x) { return { code: String(x.code != null ? x.code : x.codigo), name: String(x.name != null ? x.name : x.nome) }; });
  }
  function get(path) {
    var key = 'fipe:' + path;
    try { var c = sessionStorage.getItem(key); if (c) return Promise.resolve(JSON.parse(c)); } catch (e) {}
    var ctl = window.AbortController ? new AbortController() : null, t = setTimeout(function () { if (ctl) ctl.abort(); }, 15000);
    return fetch(BASE + path, ctl ? { signal: ctl.signal } : {}).then(function (r) {
      clearTimeout(t);
      if (r.status === 429) { var e = new Error('limite'); e.limit = true; throw e; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) { try { sessionStorage.setItem(key, JSON.stringify(j)); } catch (e) {} return j; })
      .catch(function (e) { clearTimeout(t); throw e; });
  }
  function msg(e) { return e && e.limit ? 'O limite diário gratuito da tabela FIPE foi atingido. Preencha os dados manualmente.' : 'Não foi possível consultar a tabela FIPE agora. Preencha os dados manualmente.'; }

  /* "Civic Sedan EXL 2.0 Flex 16V Aut.4p" -> { modelo: 'Civic', versao: 'Sedan EXL 2.0 Flex 16V Aut.4p', motorizacao: '2.0 16V' } (sugestão, editável) */
  function split(name) {
    var parts = String(name).trim().split(/\s+/), modelo = parts[0] || '', versao = parts.slice(1).join(' ');
    var m = /\b(\d[.,]\d)\b/.exec(name), mot = '';
    if (m) { mot = m[1].replace(',', '.'); var extra = /\b(TSI|TFSI|TDI|Turbo|T-Jet|THP|Hybrid|Híbrido|(?:8|12|16|20|24)V)\b/gi, x, seen = {}; while ((x = extra.exec(name))) { var k = x[1].toUpperCase(); if (!seen[k]) { seen[k] = 1; mot += ' ' + x[1]; } } }
    return { modelo: modelo, versao: versao || '', motorizacao: mot };
  }
  window.PatioFipe = {
    TYPES: TYPES, msg: msg, split: split,
    brands: function (t) { return get('/' + t + '/brands').then(norm); },
    models: function (t, b) { return get('/' + t + '/brands/' + b + '/models').then(norm); },
    years: function (t, b, m) { return get('/' + t + '/brands/' + b + '/models/' + m + '/years').then(norm); },
    detail: function (t, b, m, y) {
      return get('/' + t + '/brands/' + b + '/models/' + m + '/years/' + y).then(function (d) {
        return { marca: d.brand || d.Marca || '', modeloFipe: d.model || d.Modelo || '', anoModelo: Number(d.modelYear || d.AnoModelo) || null, combustivel: d.fuel || d.Combustivel || '', codigoFipe: d.codeFipe || d.CodigoFipe || '' };
      });
    }
  };
})();
