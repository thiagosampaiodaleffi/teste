/* Gráficos do Dashboard em SVG/HTML puro (sem bibliotecas): rápidos, testáveis e sem dependência externa.
 * Cada função devolve HTML. As alturas/larguras vão em data-h / data-w / data-bg (aplicadas por PatioUI.dyn). */
(function () {
  'use strict';
  var U = window.PatioUI, C = {};

  C.COLORS = ['#183D32', '#3A7A63', '#718B78', '#B9C7B5', '#C9A66B', '#A65F3B', '#4F6D8A', '#8C8579'];

  /* Mini-gráfico de linha com área. fmtv formata o valor da dica. */
  C.spark = function (values, buckets, fmtv) {
    var W = 120, H = 36, P = 3, n = values.length;
    if (!n) return '';
    var max = Math.max.apply(null, values), min = Math.min.apply(null, values);
    if (max === min) { max += 1; min -= 1; }
    function X(i) { return n === 1 ? W / 2 : P + i * (W - 2 * P) / (n - 1); }
    function Y(v) { return H - P - (v - min) / (max - min) * (H - 2 * P); }
    var pts = values.map(function (v, i) { return X(i).toFixed(1) + ',' + Y(v).toFixed(1); });
    var line = 'M' + pts.join(' L'), area = line + ' L' + X(n - 1).toFixed(1) + ',' + H + ' L' + X(0).toFixed(1) + ',' + H + ' Z';
    var step = n === 1 ? W : (W - 2 * P) / (n - 1);
    var hits = values.map(function (v, i) {
      return '<rect class="hit" x="' + (X(i) - step / 2).toFixed(1) + '" y="0" width="' + step.toFixed(1) + '" height="' + H + '" data-tip="' +
        U.esc(buckets[i].range) + '|' + U.esc(fmtv(v)) + '"/>';
    }).join('');
    return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Evolução no período">' +
      '<path class="spark-area" d="' + area + '"/><path class="spark-line" d="' + line + '"/>' + hits + '</svg>';
  };

  /* Rosca. items: [{label, value}] */
  C.donut = function (items, centerTop, centerSub) {
    var total = items.reduce(function (s, x) { return s + x.value; }, 0);
    var R = 15.9155, acc = 0, segs = '';
    if (total > 0) items.forEach(function (x, i) {
      if (!x.value) return;
      var len = x.value / total * 100;
      segs += '<circle class="seg" r="' + R + '" cx="21" cy="21" fill="none" stroke="' + C.COLORS[i % C.COLORS.length] + '" stroke-width="5.2" ' +
        'stroke-dasharray="' + Math.max(0, len - 0.6).toFixed(2) + ' ' + (100 - Math.max(0, len - 0.6)).toFixed(2) + '" stroke-dashoffset="' + (25 - acc).toFixed(2) + '" ' +
        'data-drill="origin:' + U.esc(x.label) + '" data-tip="' + U.esc(x.label) + '|' + U.int(x.value) + ' leads · ' + U.pct(len) + '"/>';
      acc += len;
    });
    return '<div class="donut"><svg viewBox="0 0 42 42" role="img" aria-label="Leads por origem"><circle r="' + R + '" cx="21" cy="21" fill="none" class="donut-track" stroke-width="5.2"/>' + segs + '</svg>' +
      '<div class="donut-c"><b>' + U.esc(centerTop) + '</b><span>' + U.esc(centerSub) + '</span></div></div>';
  };

  /* Colunas pareadas entrada x saída por intervalo */
  C.columns = function (flow) {
    var max = 1;
    flow.forEach(function (f) { max = Math.max(max, f.entradas, f.saidas); });
    var every = Math.ceil(flow.length / 8);
    return '<div class="cols" role="img" aria-label="Entradas e saídas de veículos por período">' + flow.map(function (f, i) {
      return '<div class="col" data-tip="' + U.esc(f.range) + '|Entradas: ' + f.entradas + '|Saídas: ' + f.saidas + '">' +
        '<div class="col-bars"><i class="b-in" data-h="' + (f.entradas / max * 100).toFixed(1) + '"></i><i class="b-out" data-h="' + (f.saidas / max * 100).toFixed(1) + '"></i></div>' +
        '<span class="col-l">' + (i % every === 0 ? U.esc(f.label) : '') + '</span></div>';
    }).join('') + '</div>';
  };

  /* Barras horizontais. items: [{label, value, display, sub, drill, color}] */
  C.hbars = function (items, opts) {
    opts = opts || {};
    var max = 0; items.forEach(function (x) { max = Math.max(max, x.value); });
    if (!max) max = 1;
    return '<ul class="hbars">' + items.map(function (x, i) {
      var drill = x.drill ? ' data-drill="' + U.esc(x.drill) + '" tabindex="0" role="button"' : '';
      return '<li class="hb' + (x.drill ? ' click' : '') + '"' + drill + '><div class="hb-top"><span class="hb-l">' + U.esc(x.label) + '</span><span class="hb-v">' + x.display + '</span></div>' +
        '<div class="hb-track"><i data-w="' + (x.value / max * 100).toFixed(1) + '" data-bg="' + (x.color || C.COLORS[opts.mono ? 0 : i % C.COLORS.length]) + '"></i></div>' +
        (x.sub ? '<div class="hb-sub">' + x.sub + '</div>' : '') + '</li>';
    }).join('') + '</ul>';
  };

  /* Funil: cada etapa com barra proporcional ao topo e conversão em relação à etapa anterior */
  C.funnel = function (stages) {
    var top = stages[0].count || 1;
    return '<ol class="funnel">' + stages.map(function (s, i) {
      var prev = i ? stages[i - 1].count : null;
      var conv = prev ? s.count / prev * 100 : null;
      return '<li class="fn click" tabindex="0" role="button" data-drill="funnel:' + s.key + '" data-count="' + s.count + '">' +
        '<div class="fn-top"><span class="fn-l">' + U.esc(s.label) + '</span><span class="fn-v">' + U.int(s.count) + '</span></div>' +
        '<div class="fn-track"><i data-w="' + Math.max(s.count / top * 100, s.count ? 1.5 : 0).toFixed(1) + '" data-bg="' + C.COLORS[Math.min(i, 4) === 4 ? 1 : i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : 2] + '"></i></div>' +
        '<div class="fn-sub">' + (conv == null ? 'Entrada do funil' : U.pct(conv) + ' da etapa anterior · ' + U.pct(s.count / top * 100) + ' dos leads') + '</div></li>';
    }).join('') + '</ol>';
  };

  window.PatioCharts = C;
})();
