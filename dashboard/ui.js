/* Componentes reutilizáveis do Dashboard: formatação pt-BR, etiqueta de variação, dica flutuante e painel de detalhes. */
(function () {
  'use strict';
  var U = {};

  var nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  U.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  U.int = function (n) { return nf0.format(n); };
  U.money = function (n) { return brl0.format(Math.round(n)); };
  U.moneyK = function (n) { // 1.234.567 -> "R$ 1,23 mi" para eixos e etiquetas curtas
    var a = Math.abs(n);
    if (a >= 1e6) return 'R$ ' + (n / 1e6).toFixed(2).replace('.', ',') + ' mi';
    if (a >= 1e4) return 'R$ ' + nf0.format(n / 1e3) + ' mil';
    return brl0.format(Math.round(n));
  };
  U.pct = function (n) { return nf1.format(n) + '%'; };
  U.date = function (s) { return s ? s.slice(8) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '—'; };
  U.fmt = function (t, v) {
    if (t === 'm') return U.money(v);
    if (t === 'n') return U.int(v);
    if (t === 'p') return U.pct(v);
    if (t === 'd') return U.date(v);
    return U.esc(v);
  };

  /* Variação percentual contra o período anterior. dir: up | down | flat | none */
  U.delta = function (cur, prev) {
    if (!prev) return { dir: cur ? 'up' : 'none', pct: null, txt: cur ? 'novo' : '—' };
    var p = (cur - prev) / Math.abs(prev) * 100;
    if (Math.abs(p) < 0.05) return { dir: 'flat', pct: 0, txt: '0,0%' };
    return { dir: p > 0 ? 'up' : 'down', pct: p, txt: (p > 0 ? '+' : '−') + nf1.format(Math.abs(p)) + '%' };
  };
  /* Variação em pontos percentuais (para taxas) */
  U.deltaPts = function (cur, prev) {
    var d = cur - prev;
    if (Math.abs(d) < 0.05) return { dir: 'flat', pct: 0, txt: '0,0 p.p.' };
    return { dir: d > 0 ? 'up' : 'down', pct: d, txt: (d > 0 ? '+' : '−') + nf1.format(Math.abs(d)) + ' p.p.' };
  };
  U.deltaPill = function (d, label) {
    var arrow = d.dir === 'up' ? '▲' : d.dir === 'down' ? '▼' : '•';
    return '<span class="delta delta-' + d.dir + '" data-dir="' + d.dir + '"><span aria-hidden="true">' + arrow + '</span> ' + d.txt + '</span>' +
      (label ? '<span class="delta-label">' + U.esc(label) + '</span>' : '');
  };

  /* O CSP da página não aceita style="" no HTML. Larguras, alturas e cores vão por data-* e são aplicadas aqui. */
  U.dyn = function (root) {
    var i, el, list = root.querySelectorAll('[data-w],[data-h],[data-bg],[data-l]');
    for (i = 0; i < list.length; i++) {
      el = list[i];
      if (el.dataset.w != null) el.style.width = el.dataset.w + '%';
      if (el.dataset.h != null) el.style.height = el.dataset.h + '%';
      if (el.dataset.l != null) el.style.left = el.dataset.l + '%';
      if (el.dataset.bg) el.style.background = el.dataset.bg;
    }
  };

  /* ---------- dica flutuante (hover, foco e toque) ---------- */
  var tip;
  function ensureTip() {
    if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true; document.body.appendChild(tip); }
    return tip;
  }
  function showTip(el, x, y) {
    var t = ensureTip(), parts = (el.getAttribute('data-tip') || '').split('|');
    t.innerHTML = '<strong>' + U.esc(parts[0]) + '</strong>' + (parts[1] ? '<span>' + U.esc(parts[1]) + '</span>' : '') + (parts[2] ? '<span>' + U.esc(parts[2]) + '</span>' : '');
    t.hidden = false;
    var w = t.offsetWidth, h = t.offsetHeight, vw = document.documentElement.clientWidth;
    var left = Math.max(8, Math.min(vw - w - 8, x - w / 2));
    var top = y - h - 14; if (top < 8) top = y + 18;
    t.style.left = left + 'px'; t.style.top = top + 'px';
  }
  function hideTip() { if (tip) tip.hidden = true; }
  U.initTips = function () {
    document.addEventListener('mouseover', function (e) {
      var el = e.target.closest && e.target.closest('[data-tip]');
      if (el) showTip(el, e.clientX, e.clientY); else hideTip();
    });
    document.addEventListener('mousemove', function (e) {
      var el = e.target.closest && e.target.closest('[data-tip]');
      if (el) showTip(el, e.clientX, e.clientY);
    });
    document.addEventListener('mouseleave', hideTip);
    document.addEventListener('focusin', function (e) {
      var el = e.target.closest && e.target.closest('[data-tip]');
      if (el) { var r = el.getBoundingClientRect(); showTip(el, r.left + r.width / 2, r.top); }
    });
    document.addEventListener('focusout', hideTip);
    document.addEventListener('scroll', hideTip, true);
  };

  /* ---------- painel lateral de detalhes (clique nos indicadores) ---------- */
  var MAXROWS = 300;
  U.drawer = {
    el: null, last: null, data: null,
    init: function () {
      var d = this, el = document.getElementById('drawer');
      d.el = el;
      el.addEventListener('click', function (e) {
        if (e.target.closest('[data-close]')) d.close();
        if (e.target.closest('[data-csv]')) d.csv();
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !el.hidden) d.close(); });
    },
    open: function (cfg) {
      var d = this, el = d.el;
      d.data = cfg; d.last = document.activeElement;
      el.querySelector('[data-title]').textContent = cfg.title;
      el.querySelector('[data-sub]').textContent = cfg.sub || '';
      var rows = cfg.rows, shown = rows.slice(0, MAXROWS);
      var head = '<tr>' + cfg.columns.map(function (c) { return '<th class="' + (c.t === 't' ? '' : 'num') + '">' + U.esc(c.l) + '</th>'; }).join('') + '</tr>';
      var body = shown.map(function (r) {
        return '<tr>' + cfg.columns.map(function (c) { return '<td class="' + (c.t === 't' ? '' : 'num') + '">' + U.fmt(c.t, r[c.k]) + '</td>'; }).join('') + '</tr>';
      }).join('');
      el.querySelector('[data-count]').textContent = rows.length === 0 ? 'Nenhum registro no período.' :
        U.int(rows.length) + (rows.length === 1 ? ' registro' : ' registros') + (rows.length > MAXROWS ? ' · mostrando os ' + MAXROWS + ' primeiros (o CSV leva todos)' : '');
      el.querySelector('[data-table]').innerHTML = rows.length ? '<thead>' + head + '</thead><tbody>' + body + '</tbody>' : '';
      el.hidden = false;
      document.body.classList.add('drawer-open');
      var btn = el.querySelector('[data-close]'); if (btn) btn.focus();
    },
    close: function () {
      var el = this.el; el.hidden = true; document.body.classList.remove('drawer-open');
      if (this.last && this.last.focus) try { this.last.focus(); } catch (e) {}
    },
    csv: function () {
      var cfg = this.data; if (!cfg) return;
      function cell(v) { v = v == null ? '' : String(v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
      var lines = [cfg.columns.map(function (c) { return cell(c.l); }).join(';')];
      cfg.rows.forEach(function (r) { lines.push(cfg.columns.map(function (c) { return cell(r[c.k]); }).join(';')); });
      var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = (cfg.file || 'detalhes') + '.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    }
  };

  window.PatioUI = U;
})();
