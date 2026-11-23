/* Página inicial do Pátio: saudação, módulos em destaque, módulos adicionais e central de ajuda.
 * O acesso de cada módulo vem de MODULES (hoje fixo, para demonstração). Para ligar a planos/permissões reais,
 * substitua `status` por um valor vindo do banco (ex.: tabela de assinaturas por loja). */
(function () {
  'use strict';

  /* status: ok (disponível) | lock (sem acesso) | off (não contratado) | soon (em breve) */
  var MODULES = [
    { id: 'dashboard', t: 'Dashboard Executivo', d: 'Vendas, lucro, funil e metas da operação em uma única visão.', href: 'dashboard.html', status: 'ok', icon: 'chart', tag: 'Visão geral', featured: true },
    { id: 'estoque', t: 'Estoque de veículos', d: 'Cadastro, preços, status e giro de cada carro do pátio.', href: 'patio.html', status: 'ok', icon: 'car', tag: 'Operação', featured: true },
    { id: 'leads', t: 'Leads e atendimento', d: 'Funil comercial, agenda de visitas e retorno aos clientes.', status: 'soon', icon: 'users' },
    { id: 'avaliacao', t: 'Avaliação de veículos', d: 'Registre avarias, estime reparos e calcule o investimento de cada veículo.', href: 'avaliacao.html', status: 'ok', icon: 'check' },
    { id: 'fiscal', t: 'Vendas e fiscal', d: 'Fechamento de vendas, financeiro e emissão de notas.', status: 'off', icon: 'receipt' },
    { id: 'fin', t: 'Financiamentos', d: 'Fichas, simulações e acompanhamento das propostas.', status: 'lock', icon: 'wallet' },
    { id: 'site', t: 'Site da loja', d: 'Vitrine online, destaques e anúncios do estoque.', status: 'lock', icon: 'globe' },
    { id: 'transf', t: 'Transferência digital', d: 'Documentação e transferência de veículos sem papel.', status: 'off', icon: 'shield' },
    { id: 'metas', t: 'Metas e benefícios', d: 'Objetivos da equipe, níveis e recompensas.', status: 'soon', icon: 'gift' }
  ];
  var STATUS = {
    ok: { l: 'Disponível', cls: 'ok' }, lock: { l: 'Sem acesso', cls: 'lock' },
    off: { l: 'Não contratado', cls: 'off' }, soon: { l: 'Em breve', cls: 'soon' }
  };
  /* Canal de suporte: preencha quando existir (e-mail ou link). Vazio = a tela avisa que ainda não foi configurado. */
  var SUPPORT = { email: '', url: '' };
  var FAQ = [
    ['Como volto a esta tela?', 'Clique no logotipo Pátio, no canto superior esquerdo de qualquer página.'],
    ['O que significa “Sem acesso”?', 'O módulo faz parte do seu plano, mas o seu usuário ainda não tem permissão. Peça ao administrador da loja.'],
    ['O que significa “Não contratado”?', 'O módulo não está no plano atual da loja. Abra o card para ver o que ele oferece.'],
    ['Os números do Dashboard são reais?', 'Nesta versão são dados de demonstração. A ligação com o banco de dados é a próxima etapa.']
  ];

  var ICONS = {
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    car: '<path d="M5 16.5h14M3.5 16.5V12l2-4.5a2 2 0 0 1 1.8-1.2h9.4a2 2 0 0 1 1.8 1.2l2 4.5v4.5"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/><path d="M3.5 12h17"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.5-3.4 3-5 6-5s5.5 1.6 6 5M16 5a3 3 0 0 1 0 6M18 15c2 .5 3.2 2 3.5 5"/>',
    check: '<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4.5h6M9 13l2.2 2.2L15.5 11"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/>',
    wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3M4 7.5V17a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 7.5z"/><circle cx="16" cy="13.5" r="1.2"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/>',
    shield: '<path d="M12 3l7 3v5.5c0 4.3-3 7.6-7 9.5-4-1.9-7-5.2-7-9.5V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
    gift: '<rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5 12.5V20h14v-7.5M12 8.5V20M12 8.5C10 8.5 8 7.5 8 6a2 2 0 0 1 4 0M12 8.5C14 8.5 16 7.5 16 6a2 2 0 0 0-4 0"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
  };
  function svg(n) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[n] + '</svg>'; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var $ = function (id) { return document.getElementById(id); };

  function art(id) { // ilustração discreta de cada card em destaque
    if (id === 'dashboard') return '<svg class="art" viewBox="0 0 220 90" aria-hidden="true"><path class="a-fill" d="M0 70 L30 58 L60 64 L90 40 L120 46 L150 22 L180 30 L220 8 V90 H0Z"/><path class="a-line" d="M0 70 L30 58 L60 64 L90 40 L120 46 L150 22 L180 30 L220 8"/><circle class="a-dot" cx="150" cy="22" r="4"/></svg>';
    return '<svg class="art" viewBox="0 0 220 90" aria-hidden="true"><g class="a-bars"><rect x="10" y="48" width="22" height="42" rx="5"/><rect x="42" y="30" width="22" height="60" rx="5"/><rect x="74" y="40" width="22" height="50" rx="5"/><rect x="106" y="16" width="22" height="74" rx="5"/><rect x="138" y="34" width="22" height="56" rx="5"/><rect x="170" y="24" width="22" height="66" rx="5"/></g></svg>';
  }

  function featuredCard(m) {
    return '<a class="fcard" href="' + m.href + '" data-m="' + m.id + '"><span class="glow" aria-hidden="true"></span>' +
      '<span class="f-top"><span class="ico">' + svg(m.icon) + '</span><span class="tag">' + esc(m.tag) + '</span></span>' +
      '<span class="f-t">' + esc(m.t) + '</span><span class="f-d">' + esc(m.d) + '</span>' + art(m.id) +
      '<span class="f-go"><span class="status ok"><i class="dot ok"></i>Disponível</span><span class="go">Abrir<span class="arr">' + svg('arrow') + '</span></span></span></a>';
  }
  function moreCard(m) {
    var s = STATUS[m.status];
    var tag = m.href ? 'a' : 'button', attrs = m.href ? ' href="' + m.href + '"' : ' type="button"';
    return '<' + tag + attrs + ' class="mcard ' + s.cls + '" data-m="' + m.id + '"><span class="ico">' + svg(m.icon) + '</span>' +
      '<span class="m-b"><span class="m-t">' + esc(m.t) + '</span><span class="m-d">' + esc(m.d) + '</span>' +
      '<span class="status ' + s.cls + '"><i class="dot ' + s.cls + '"></i>' + (m.status === 'lock' || m.status === 'off' ? '<span class="lk">' + svg('lock') + '</span>' : '') + s.l + '</span></span></' + tag + '>';
  }

  var modal, lastFocus;
  function openModal(html) {
    lastFocus = document.activeElement; $('modal-body').innerHTML = html; modal.hidden = false; document.body.classList.add('lock-scroll');
    var c = modal.querySelector('.x'); if (c) c.focus();
  }
  function closeModal() { modal.hidden = true; document.body.classList.remove('lock-scroll'); if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {} }

  function moduleModal(m) {
    var s = STATUS[m.status], msg = {
      lock: 'Este módulo faz parte do seu plano, mas o seu usuário ainda não tem permissão para abri-lo. Peça ao administrador da loja para liberar o acesso.',
      off: 'Este módulo não está contratado pela sua loja. Quando ele fizer parte do plano, aparecerá aqui como disponível.',
      soon: 'Estamos preparando este módulo. Ele será liberado em uma próxima etapa da plataforma.'
    }[m.status];
    openModal('<span class="ico big">' + svg(m.icon) + '</span><h3 id="m-title">' + esc(m.t) + '</h3><span class="status ' + s.cls + '"><i class="dot ' + s.cls + '"></i>' + s.l + '</span>' +
      '<p>' + esc(m.d) + '</p><p class="muted">' + msg + '</p><div class="m-act"><button type="button" class="pill" data-close>Entendi</button></div>');
  }
  function helpModal() {
    var contact = SUPPORT.email || SUPPORT.url
      ? '<p>' + (SUPPORT.email ? 'E-mail: <b>' + esc(SUPPORT.email) + '</b>' : '') + (SUPPORT.url ? ' <a href="' + esc(SUPPORT.url) + '" target="_blank" rel="noopener">Abrir canal de suporte</a>' : '') + '</p>'
      : '<p class="muted">O canal de suporte desta loja ainda não foi configurado. Fale com o administrador do sistema.</p>';
    openModal('<span class="ico big">' + '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5M12 16.8h.01"/></svg>' + '</span><h3 id="m-title">Central de ajuda</h3>' +
      '<div class="faq">' + FAQ.map(function (f) { return '<details><summary>' + esc(f[0]) + '</summary><p>' + esc(f[1]) + '</p></details>'; }).join('') + '</div>' +
      '<h4>Fale com o suporte</h4>' + contact + '<div class="m-act"><button type="button" class="pill" data-close>Fechar</button></div>');
  }

  function start(user) {
    var meta = (user && user.user_metadata) || {};
    var full = meta.full_name || meta.name || ((user && user.email) || 'Usuário').split('@')[0];
    var first = String(full).trim().split(/\s+/)[0];
    first = first.charAt(0).toUpperCase() + first.slice(1);
    var h = new Date().getHours(), g = h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    $('hello').textContent = g + ', ' + first;
    $('me-n').textContent = full; $('av').textContent = first.charAt(0);
    $('today').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

    $('featured').innerHTML = MODULES.filter(function (m) { return m.featured; }).map(featuredCard).join('');
    $('more').innerHTML = MODULES.filter(function (m) { return !m.featured; }).map(moreCard).join('');

    modal = $('modal');
    $('help-btn').onclick = helpModal;
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { closeModal(); return; }
      var c = e.target.closest('button.mcard');
      if (c) moduleModal(MODULES.filter(function (m) { return m.id === c.getAttribute('data-m'); })[0]);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

    // brilho que acompanha o mouse nos cards em destaque
    document.querySelectorAll('.fcard').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px'); el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
    document.documentElement.classList.add('ready');
  }

  window.PatioGuard.start({ logoutId: 'btn-sair', onReady: start });
})();
