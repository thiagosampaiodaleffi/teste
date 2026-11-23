/* Visualização 3D do veículo (canvas, sem biblioteca): gira com arrasto/setas e mostra pontos clicáveis por região.
 * API: Car3D.REGIONS, Car3D.create(canvas, { onPick(regionId), getCounts() -> {regionId: n} }) */
(function () {
  'use strict';

  /* Regiões: anchor = ponto 3D no carro (x frente, y cima, z direita); n = normal da superfície (visibilidade).
   * Regiões sem anchor entram só na lista (interior, motor, rodas...). */
  var REGIONS = [
    { id: 'pc-diant', nome: 'Para-choque dianteiro', grupo: 'Frente', a: [2.25, 0.55, 0], n: [1, 0, 0] },
    { id: 'capo', nome: 'Capô', grupo: 'Frente', a: [1.45, 1.08, 0], n: [0, 1, 0] },
    { id: 'para-brisa', nome: 'Para-brisa', grupo: 'Teto e vidros', a: [0.55, 1.36, 0], n: [0.6, 0.8, 0] },
    { id: 'teto', nome: 'Teto', grupo: 'Teto e vidros', a: [-0.4, 1.64, 0], n: [0, 1, 0] },
    { id: 'vidro-tras', nome: 'Vidro traseiro', grupo: 'Teto e vidros', a: [-1.28, 1.36, 0], n: [-0.6, 0.8, 0] },
    { id: 'porta-malas', nome: 'Tampa traseira / porta-malas', grupo: 'Traseira', a: [-1.8, 1.08, 0], n: [0, 1, 0] },
    { id: 'pc-tras', nome: 'Para-choque traseiro', grupo: 'Traseira', a: [-2.25, 0.55, 0], n: [-1, 0, 0] },
    { id: 'pl-diant-d', nome: 'Para-lama dianteiro direito', grupo: 'Lado direito', a: [1.55, 0.72, 0.92], n: [0, 0, 1] },
    { id: 'porta-diant-d', nome: 'Porta dianteira direita', grupo: 'Lado direito', a: [0.35, 0.72, 0.92], n: [0, 0, 1] },
    { id: 'porta-tras-d', nome: 'Porta traseira direita', grupo: 'Lado direito', a: [-0.85, 0.72, 0.92], n: [0, 0, 1] },
    { id: 'pl-tras-d', nome: 'Lateral traseira direita', grupo: 'Lado direito', a: [-1.75, 0.72, 0.92], n: [0, 0, 1] },
    { id: 'pl-diant-e', nome: 'Para-lama dianteiro esquerdo', grupo: 'Lado esquerdo', a: [1.55, 0.72, -0.92], n: [0, 0, -1] },
    { id: 'porta-diant-e', nome: 'Porta dianteira esquerda', grupo: 'Lado esquerdo', a: [0.35, 0.72, -0.92], n: [0, 0, -1] },
    { id: 'porta-tras-e', nome: 'Porta traseira esquerda', grupo: 'Lado esquerdo', a: [-0.85, 0.72, -0.92], n: [0, 0, -1] },
    { id: 'pl-tras-e', nome: 'Lateral traseira esquerda', grupo: 'Lado esquerdo', a: [-1.75, 0.72, -0.92], n: [0, 0, -1] },
    { id: 'rodas', nome: 'Rodas e pneus', grupo: 'Outras regiões' },
    { id: 'interior', nome: 'Interior', grupo: 'Outras regiões' },
    { id: 'motor', nome: 'Motor e mecânica', grupo: 'Outras regiões' },
    { id: 'outra', nome: 'Outra região', grupo: 'Outras regiões' }
  ];
  var BY_ID = {}; REGIONS.forEach(function (r) { BY_ID[r.id] = r; });

  var VIEWS = { tras34: [145, 18], frente: [-90, 12], direita: [0, 10], traseira: [90, 12], esquerda: [180, 10], topo: [0, 84], padrao: [-35, 18] };

  /* ---------- geometria ---------- */
  var BODY = { c: [0, 0.7, 0] }, CAB = { c: [-0.4, 1.34, 0] };
  function box(x0, x1, y0, y1, z0, z1, part, col, glassFaces) {
    var v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    var q = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]];
    return q.map(function (f) { return { p: f.map(function (i) { return v[i]; }), part: part, col: col }; });
  }
  var FACES = [];
  FACES = FACES.concat(box(-2.25, 2.25, 0.3, 1.08, -0.9, 0.9, BODY, 'body'));
  // cabine em tronco (vidros inclinados)
  (function () {
    var b = [[-1.55, 1.08, -0.84], [0.75, 1.08, -0.84], [0.75, 1.08, 0.84], [-1.55, 1.08, 0.84]];
    var t = [[-1.05, 1.66, -0.7], [0.15, 1.66, -0.7], [0.15, 1.66, 0.7], [-1.05, 1.66, 0.7]];
    FACES.push({ p: [t[0], t[1], t[2], t[3]], part: CAB, col: 'roof' });
    FACES.push({ p: [b[1], b[2], t[2], t[1]], part: CAB, col: 'glass' });   // para-brisa
    FACES.push({ p: [b[0], b[3], t[3], t[0]], part: CAB, col: 'glass' });   // traseiro
    FACES.push({ p: [b[0], b[1], t[1], t[0]], part: CAB, col: 'glass' });   // esquerda (z-)
    FACES.push({ p: [b[3], b[2], t[2], t[3]], part: CAB, col: 'glass' });   // direita (z+)
  })();

  function disc(cx, cy, z, r, nz, col, n) {
    var pts = []; for (var i = 0; i < (n || 18); i++) { var a = i / (n || 18) * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, z]); }
    return { p: pts, nrm: [0, 0, nz], col: col };
  }
  function quad(x0, x1, y0, y1, z, nrm, col) { return { p: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], nrm: nrm, col: col }; }
  function quadX(x, y0, y1, z0, z1, nx, col) { return { p: [[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]], nrm: [nx, 0, 0], col: col }; }
  var DECALS = [];
  [[1.4, 1], [-1.4, 1], [1.4, -1], [-1.4, -1]].forEach(function (w) {
    var z = w[1] > 0 ? 0.915 : -0.915;
    DECALS.push(disc(w[0], 0.4, z, 0.4, w[1], 'tire'));
    DECALS.push(disc(w[0], 0.4, z * 1.002, 0.22, w[1], 'hub', 12));
  });
  DECALS.push(quadX(2.255, 0.62, 0.85, -0.78, -0.4, 1, 'light'), quadX(2.255, 0.62, 0.85, 0.4, 0.78, 1, 'light'), quadX(2.255, 0.5, 0.62, -0.35, 0.35, 1, 'grille'));
  DECALS.push(quadX(-2.255, 0.7, 0.88, -0.8, -0.4, -1, 'tail'), quadX(-2.255, 0.7, 0.88, 0.4, 0.8, -1, 'tail'));

  var PAL = { body: [47, 107, 85], roof: [40, 92, 73], glass: [168, 196, 190], tire: [30, 38, 35], hub: [190, 200, 196], light: [250, 245, 220], grille: [40, 48, 45], tail: [196, 70, 52] };

  /* ---------- projeção ---------- */
  function rot(p, yaw, pitch) {
    var x = p[0], y = p[1] - 0.85, z = p[2];
    var cy = Math.cos(yaw), sy = Math.sin(yaw);
    var x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
  }
  function rotN(n, yaw, pitch) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw);
    var x1 = n[0] * cy + n[2] * sy, z1 = -n[0] * sy + n[2] * cy;
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    return [x1, n[1] * cp - z1 * sp, n[1] * sp + z1 * cp];
  }
  var D = 11;
  function proj(v, W, H) {
    var s = Math.min(W / 6.3, H / 3.3), k = D / (D - v[2]);
    return [W / 2 + v[0] * s * k, H * 0.52 - v[1] * s * k];
  }
  var LIGHT = (function () { var l = [0.35, 0.8, 0.55], m = Math.sqrt(l[0] * l[0] + l[1] * l[1] + l[2] * l[2]); return [l[0] / m, l[1] / m, l[2] / m]; })();
  function shade(col, n) {
    var c = PAL[col], d = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]), f = 0.62 + 0.5 * d;
    return 'rgb(' + Math.min(255, Math.round(c[0] * f)) + ',' + Math.min(255, Math.round(c[1] * f)) + ',' + Math.min(255, Math.round(c[2] * f)) + ')';
  }
  function norm3(a, b, c) {
    var u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    var n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], m = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]) || 1;
    return [n[0] / m, n[1] / m, n[2] / m];
  }

  /* desenha a cena em ctx (W x H em px CSS). Devolve a posição dos pontos para clique. */
  function draw(ctx, W, H, yaw, pitch, counts, hover, bg) {
    var i, f, spots = {};
    ctx.clearRect(0, 0, W, H);
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); }
    // sombra no chão
    var sh = []; for (i = 0; i < 40; i++) { var a = i / 40 * Math.PI * 2; sh.push(proj(rot([Math.cos(a) * 2.9, 0, Math.sin(a) * 1.25], yaw, pitch), W, H)); }
    ctx.beginPath(); sh.forEach(function (p, j) { j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.closePath();
    ctx.fillStyle = 'rgba(14,31,25,.13)'; ctx.fill();

    var list = [];
    FACES.forEach(function (face) {
      var rp = face.p.map(function (p) { return rot(p, yaw, pitch); });
      var cen = [0, 0, 0]; rp.forEach(function (p) { cen[0] += p[0] / rp.length; cen[1] += p[1] / rp.length; cen[2] += p[2] / rp.length; });
      var partC = rot(face.part.c, yaw, pitch), out = [cen[0] - partC[0], cen[1] - partC[1], cen[2] - partC[2]];
      var n = norm3(rp[0], rp[1], rp[2]); if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) n = [-n[0], -n[1], -n[2]];
      if (n[2] <= 0.001) return;
      list.push({ rp: rp, n: n, col: face.col, d: cen[2] + (face.part === CAB ? 0.02 : 0) });
    });
    list.sort(function (a, b) { return a.d - b.d; });
    function fill(item, stroke) {
      ctx.beginPath(); item.rp.forEach(function (p, j) { var q = proj(p, W, H); j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath();
      ctx.fillStyle = shade(item.col, item.n); ctx.fill();
      if (stroke) { ctx.strokeStyle = 'rgba(10,30,22,.35)'; ctx.lineWidth = 1; ctx.stroke(); }
    }
    list.forEach(function (it) { fill(it, true); });
    // detalhes (rodas, faróis...) só quando de frente para o observador
    DECALS.forEach(function (dc) {
      var rn = rotN(dc.nrm, yaw, pitch); if (rn[2] <= 0.05) return;
      fill({ rp: dc.p.map(function (p) { return rot(p, yaw, pitch); }), n: rn, col: dc.col }, false);
    });

    // pontos das regiões
    REGIONS.forEach(function (r) {
      if (!r.a) return;
      var rn = rotN(r.n, yaw, pitch); if (rn[2] < 0.12) return;
      var q = proj(rot(r.a, yaw, pitch), W, H), c = counts && counts[r.id] || 0, on = hover === r.id, R = on ? 13 : 10.5;
      spots[r.id] = q;
      ctx.beginPath(); ctx.arc(q[0], q[1], R + 4, 0, 7); ctx.fillStyle = c ? 'rgba(178,69,46,.22)' : 'rgba(111,227,176,.28)'; ctx.fill();
      ctx.beginPath(); ctx.arc(q[0], q[1], R, 0, 7); ctx.fillStyle = c ? '#B2452E' : '#fff'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = c ? '#fff' : '#183D32'; ctx.stroke();
      ctx.fillStyle = c ? '#fff' : '#183D32'; ctx.font = '700 11px Inter,system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(c ? String(c) : '+', q[0], q[1] + 0.5);
    });
    if (hover && spots[hover]) {
      var t = BY_ID[hover].nome, q2 = spots[hover];
      ctx.font = '600 12px Inter,system-ui,sans-serif'; var w = ctx.measureText(t).width + 16, x = Math.max(4, Math.min(W - w - 4, q2[0] - w / 2)), y = q2[1] - 38; if (y < 4) y = q2[1] + 20;
      ctx.fillStyle = '#0D241C'; ctx.beginPath(); (ctx.roundRect ? ctx.roundRect(x, y, w, 24, 8) : ctx.rect(x, y, w, 24)); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(t, x + 8, y + 12.5);
    }
    return spots;
  }

  function create(canvas, opts) {
    var ctx = canvas.getContext('2d'), yaw = VIEWS.padrao[0] * Math.PI / 180, pitch = VIEWS.padrao[1] * Math.PI / 180;
    var W = 0, H = 0, spots = {}, hover = null, drag = null, raf = 0, anim = null;
    function size() {
      var r = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(200, r.width); H = Math.max(160, r.height);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function render() { raf = 0; if (!W) size(); spots = draw(ctx, W, H, yaw, pitch, opts.getCounts ? opts.getCounts() : {}, hover); }
    function schedule() { if (!raf) raf = requestAnimationFrame(render); }
    function hit(e) {
      var r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = null, bd = 18;
      Object.keys(spots).forEach(function (id) { var d = Math.hypot(spots[id][0] - x, spots[id][1] - y); if (d < bd) { bd = d; best = id; } });
      return best;
    }
    canvas.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, yaw: yaw, pitch: pitch, moved: false }; try { canvas.setPointerCapture(e.pointerId); } catch (x) {} });
    canvas.addEventListener('pointermove', function (e) {
      if (drag) {
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
        if (drag.moved) { yaw = drag.yaw + dx * 0.012; pitch = Math.max(-0.1, Math.min(1.5, drag.pitch + dy * 0.01)); anim = null; hover = null; schedule(); }
      } else { var h = hit(e); if (h !== hover) { hover = h; canvas.classList.toggle('pick', !!h); schedule(); } }
    });
    canvas.addEventListener('pointerup', function (e) {
      var d = drag; drag = null;
      if (d && !d.moved) { var h = hit(e); if (h && opts.onPick) opts.onPick(h); }
    });
    canvas.addEventListener('pointerleave', function () { if (hover) { hover = null; schedule(); } });
    canvas.addEventListener('keydown', function (e) {
      var k = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, -0.08], ArrowDown: [0, 0.08] }[e.key];
      if (k) { e.preventDefault(); yaw += k[0]; pitch = Math.max(-0.1, Math.min(1.5, pitch + k[1])); schedule(); }
    });
    window.addEventListener('resize', function () { size(); schedule(); });
    if (window.ResizeObserver) new ResizeObserver(function () { size(); schedule(); }).observe(canvas);

    function setView(name) {
      var v = VIEWS[name]; if (!v) return;
      var ty = v[0] * Math.PI / 180, tp = v[1] * Math.PI / 180, n = 0;
      // gira pelo caminho mais curto
      var dy = ((ty - yaw) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI, y0 = yaw, p0 = pitch;
      anim = {};
      var me = anim;
      (function step() {
        if (anim !== me) return; n++; var t = Math.min(1, n / 18), e = 1 - Math.pow(1 - t, 3);
        yaw = y0 + dy * e; pitch = p0 + (tp - p0) * e; render();
        if (t < 1) requestAnimationFrame(step); else anim = null;
      })();
    }
    size(); render();
    return {
      setView: setView, refresh: schedule, size: function () { size(); schedule(); },
      /* posição do ponto de uma região na tela (ou null se estiver escondido) — usado por testes */
      spot: function (id) { render(); return spots[id] ? { x: spots[id][0], y: spots[id][1] } : null; },
      state: function () { return { yaw: yaw, pitch: pitch }; }
    };
  }

  /* desenha uma vista fora da tela (para o relatório em PDF) */
  function snapshot(w, h, viewName, counts) {
    var c = document.createElement('canvas'), dpr = 2; c.width = w * dpr; c.height = h * dpr;
    var ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var v = VIEWS[viewName] || VIEWS.padrao;
    draw(ctx, w, h, v[0] * Math.PI / 180, v[1] * Math.PI / 180, counts || {}, null, '#F4F7F3');
    return c;
  }

  window.Car3D = { REGIONS: REGIONS, BY_ID: BY_ID, VIEWS: VIEWS, create: create, snapshot: snapshot };
})();
