/* Gerador mínimo de PDF (A4, Helvetica, imagens JPEG) — sem bibliotecas.
 * const d = new PatioPDF(); d.text(...); d.image(dataUrl, x, y, w, h); d.save('arquivo.pdf'); */
(function () {
  'use strict';
  var PW = 595.28, PH = 841.89;
  var CP1252 = { 0x2013: 0x96, 0x2014: 0x97, 0x2022: 0x95, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2026: 0x85, 0x20AC: 0x80 };

  function enc(s) { // texto -> string "latin1" escapada para PDF
    var o = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i); if (CP1252[c]) c = CP1252[c]; else if (c > 255) c = 63;
      if (c === 40 || c === 41 || c === 92) o += '\\' + String.fromCharCode(c);
      else if (c < 32) o += ' ';
      else o += String.fromCharCode(c);
    }
    return o;
  }
  function bytes(str) { var u = new Uint8Array(str.length); for (var i = 0; i < str.length; i++) u[i] = str.charCodeAt(i) & 255; return u; }
  function num(n) { return (Math.round(n * 100) / 100).toString(); }
  function rgb(c) { return c.map(function (x) { return num(x / 255); }).join(' '); }

  /* largura aproximada em pontos (Helvetica) */
  function tw(s, size, bold) {
    var w = 0;
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      w += /[ijl.,;:'|!]/.test(ch) ? 0.26 : /[ftr()\-\/ I]/.test(ch) ? 0.34 : /[mwMW@]/.test(ch) ? 0.84 : /[A-Z]/.test(ch) ? 0.68 : /[0-9]/.test(ch) ? 0.556 : 0.52;
    }
    return w * size * (bold ? 1.06 : 1) * 1.02;
  }

  function Doc() { this.pages = []; this.images = []; this.cur = null; this.addPage(); }
  Doc.prototype.addPage = function () { this.cur = { ops: [] }; this.pages.push(this.cur); return this; };
  Doc.prototype.text = function (x, y, str, size, o) { // y = linha de base, medida do topo da página
    o = o || {};
    this.cur.ops.push('BT /' + (o.bold ? 'F2' : 'F1') + ' ' + num(size) + ' Tf ' + rgb(o.color || [20, 32, 28]) + ' rg 1 0 0 1 ' + num(x) + ' ' + num(PH - y) + ' Tm (' + enc(String(str)) + ') Tj ET');
  };
  Doc.prototype.rect = function (x, y, w, h, fill, stroke) { // y = topo
    var op = num(x) + ' ' + num(PH - y - h) + ' ' + num(w) + ' ' + num(h) + ' re';
    if (fill) this.cur.ops.push(rgb(fill) + ' rg ' + op + ' f');
    if (stroke) this.cur.ops.push(rgb(stroke) + ' RG 0.6 w ' + op + ' S');
  };
  Doc.prototype.line = function (x1, y1, x2, y2, color) { this.cur.ops.push(rgb(color || [220, 226, 221]) + ' RG 0.6 w ' + num(x1) + ' ' + num(PH - y1) + ' m ' + num(x2) + ' ' + num(PH - y2) + ' l S'); };
  Doc.prototype.image = function (dataUrl, w, h, x, y, dw, dh) { // w,h = pixels originais; y = topo
    var m = /^data:image\/jpeg;base64,(.+)$/.exec(dataUrl); if (!m) return false;
    var bin = atob(m[1]), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    this.images.push({ w: w, h: h, data: u });
    this.cur.ops.push('q ' + num(dw) + ' 0 0 ' + num(dh) + ' ' + num(x) + ' ' + num(PH - y - dh) + ' cm /Im' + (this.images.length - 1) + ' Do Q');
    return true;
  };
  Doc.prototype.wrap = function (str, size, width, bold) {
    var out = [];
    String(str).split(/\r?\n/).forEach(function (par) {
      var words = par.split(/\s+/), line = '';
      words.forEach(function (w) {
        var t = line ? line + ' ' + w : w;
        if (tw(t, size, bold) > width && line) { out.push(line); line = w; } else line = t;
      });
      out.push(line);
    });
    return out;
  };

  Doc.prototype.build = function () {
    var chunks = [], offs = [], pos = 0, self = this;
    function put(x) { var b = typeof x === 'string' ? bytes(x) : x; chunks.push(b); pos += b.length; }
    function obj(n, body, stream) {
      offs[n] = pos; put(n + ' 0 obj\n' + body + (stream ? '\nstream\n' : '\n')); if (stream) { put(stream); put('\nendstream\n'); } put('endobj\n');
    }
    var nImg = this.images.length, base = 5 + nImg, n;
    put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    var kids = this.pages.map(function (p, i) { return (base + i * 2 + 1) + ' 0 R'; }).join(' ');
    var xo = this.images.map(function (im, i) { return '/Im' + i + ' ' + (5 + i) + ' 0 R'; }).join(' ');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [' + kids + '] /Count ' + this.pages.length + ' >>');
    obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    this.images.forEach(function (im, i) {
      obj(5 + i, '<< /Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + im.data.length + ' >>', im.data);
    });
    this.pages.forEach(function (p, i) {
      var content = bytes(p.ops.join('\n')), cn = base + i * 2, pn = cn + 1;
      obj(cn, '<< /Length ' + content.length + ' >>', content);
      obj(pn, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + num(PW) + ' ' + num(PH) + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ' + xo + ' >> >> /Contents ' + cn + ' 0 R >>');
    });
    var total = base + this.pages.length * 2, xref = pos;
    var x = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
    for (n = 1; n < total; n++) x += ('0000000000' + offs[n]).slice(-10) + ' 00000 n \n';
    put(x + 'trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF');
    return new Blob(chunks, { type: 'application/pdf' });
  };
  Doc.prototype.save = function (name) {
    var blob = this.build(), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    return blob;
  };

  window.PatioPDF = { Doc: Doc, PW: PW, PH: PH, textWidth: tw };
})();
