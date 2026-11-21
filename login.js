/* Tela de acesso: entrar, criar conta, recuperar senha. Tudo via Supabase Auth. */
(function () {
  'use strict';

  var A = window.PatioAuth;
  var sb = A.client;
  var ROUTES = ['entrar', 'criar', 'esqueci', 'enviado', 'confirmar'];
  var TITLES = {
    entrar: 'Entrar', criar: 'Criar conta', esqueci: 'Recuperar senha',
    enviado: 'Verifique seu e-mail', confirmar: 'Confirme seu e-mail'
  };
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var state = { resetEmail: '', signupEmail: '', timer: null, firstRender: true };

  function $(id) { return document.getElementById(id); }
  function viewEl(name) { return document.querySelector('[data-view="' + name + '"]'); }
  function msgOf(name) { return viewEl(name).querySelector('.msg'); }

  function setMsg(el, text, kind) {
    if (!el) return;
    if (!text) { el.hidden = true; el.textContent = ''; el.className = 'msg'; return; }
    el.textContent = text;
    el.className = 'msg msg-' + (kind || 'error');
    el.hidden = false;
  }
  function setBusy(btn, on) {
    btn.disabled = on;
    if (on) btn.setAttribute('aria-busy', 'true'); else btn.removeAttribute('aria-busy');
  }
  function markInvalid(input, bad) {
    if (bad) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  }

  /* ---------- rotas por hash (#entrar, #criar, ...) ---------- */
  function currentRoute() {
    var r = window.location.hash.replace(/^#/, '');
    if (ROUTES.indexOf(r) === -1) r = 'entrar';
    if (r === 'enviado' && !state.resetEmail) r = 'esqueci';
    if (r === 'confirmar' && !state.signupEmail) r = 'criar';
    return r;
  }
  function render() {
    var r = currentRoute();
    ROUTES.forEach(function (n) { viewEl(n).hidden = (n !== r); });
    document.querySelectorAll('.msg').forEach(function (m) { setMsg(m, ''); });
    document.querySelectorAll('input[aria-invalid]').forEach(function (i) { markInvalid(i, false); });
    document.title = TITLES[r] + ' · Pátio';
    var h = viewEl(r).querySelector('h1');
    if (h && !state.firstRender) { h.setAttribute('tabindex', '-1'); h.focus(); }
    state.firstRender = false;
  }
  function go(route) {
    if (window.location.hash === '#' + route) render();
    else window.location.hash = '#' + route;
  }
  window.addEventListener('hashchange', render);

  /* ---------- verificação de configuração ---------- */
  function ready(msgEl) {
    if (A.unsafeKey) {
      setMsg(msgEl, 'A chave configurada é secreta (service_role). Use somente a chave pública (anon) em config.js.');
      return false;
    }
    if (!A.configured) {
      setMsg(msgEl, 'O acesso ainda não está conectado ao Supabase. Preencha o arquivo config.js.');
      return false;
    }
    if (!sb) {
      setMsg(msgEl, 'Não foi possível carregar o serviço de autenticação. Recarregue a página.');
      return false;
    }
    return true;
  }

  var banner = $('config-warning');
  if (A.unsafeKey) {
    banner.textContent = 'Chave secreta detectada em config.js. Troque pela chave pública (anon) antes de continuar.';
    banner.hidden = false;
  } else if (!A.configured) {
    banner.textContent = 'Esta tela está pronta, mas ainda não está conectada ao Supabase. Preencha SUPABASE_URL e SUPABASE_ANON_KEY em config.js.';
    banner.hidden = false;
  } else if (!sb) {
    banner.textContent = 'Não foi possível carregar a biblioteca de autenticação. Verifique sua conexão e recarregue.';
    banner.hidden = false;
  }

  /* ---------- mostrar / ocultar senha ---------- */
  document.querySelectorAll('.eye').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = $(btn.getAttribute('data-toggle'));
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-pressed', String(show));
      btn.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
    });
  });

  /* ---------- entrar ---------- */
  $('form-entrar').addEventListener('submit', async function (e) {
    e.preventDefault();
    var msg = msgOf('entrar');
    var email = $('login-email').value.trim();
    var password = $('login-senha').value;
    var btn = $('btn-entrar');
    setMsg(msg, '');
    markInvalid($('login-email'), false);
    markInvalid($('login-senha'), false);

    if (!EMAIL_RE.test(email)) { markInvalid($('login-email'), true); setMsg(msg, 'Informe um e-mail válido.'); $('login-email').focus(); return; }
    if (!password) { markInvalid($('login-senha'), true); setMsg(msg, 'Informe sua senha.'); $('login-senha').focus(); return; }
    if (!ready(msg)) return;

    setBusy(btn, true);
    try {
      var res = await sb.auth.signInWithPassword({ email: email, password: password });
      if (res.error) { setMsg(msg, A.translateError(res.error)); setBusy(btn, false); return; }
      window.location.replace(A.pageUrl('inicio.html'));
    } catch (err) {
      setMsg(msg, A.translateError(err));
      setBusy(btn, false);
    }
  });

  /* ---------- Google (entrar e cadastrar) ---------- */
  document.querySelectorAll('[data-google]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      var msg = btn.closest('[data-view]').querySelector('.msg');
      setMsg(msg, '');
      if (!ready(msg)) return;
      setBusy(btn, true);
      try {
        var res = await sb.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: A.pageUrl('painel.html') }
        });
        if (res.error) { setMsg(msg, A.translateError(res.error)); setBusy(btn, false); }
      } catch (err) {
        setMsg(msg, A.translateError(err));
        setBusy(btn, false);
      }
    });
  });
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) document.querySelectorAll('.btn[aria-busy]').forEach(function (b) { setBusy(b, false); });
  });

  /* ---------- criar conta ---------- */
  $('form-criar').addEventListener('submit', async function (e) {
    e.preventDefault();
    var msg = msgOf('criar');
    var name = $('criar-nome').value.trim();
    var email = $('criar-email').value.trim();
    var password = $('criar-senha').value;
    var btn = $('btn-criar');
    setMsg(msg, '');
    ['criar-nome', 'criar-email', 'criar-senha'].forEach(function (id) { markInvalid($(id), false); });

    if (name.length < 2) { markInvalid($('criar-nome'), true); setMsg(msg, 'Informe seu nome completo.'); $('criar-nome').focus(); return; }
    if (!EMAIL_RE.test(email)) { markInvalid($('criar-email'), true); setMsg(msg, 'Informe um e-mail válido.'); $('criar-email').focus(); return; }
    if (password.length < 8) { markInvalid($('criar-senha'), true); setMsg(msg, 'A senha precisa ter pelo menos 8 caracteres.'); $('criar-senha').focus(); return; }
    if (!ready(msg)) return;

    setBusy(btn, true);
    try {
      var res = await sb.auth.signUp({
        email: email,
        password: password,
        options: { data: { full_name: name }, emailRedirectTo: A.pageUrl('painel.html') }
      });
      if (res.error) { setMsg(msg, A.translateError(res.error)); setBusy(btn, false); return; }
      if (res.data && res.data.session) {
        window.location.replace(A.pageUrl('inicio.html'));
        return;
      }
      state.signupEmail = email;
      $('confirm-email').textContent = email;
      $('criar-senha').value = '';
      setBusy(btn, false);
      go('confirmar');
    } catch (err) {
      setMsg(msg, A.translateError(err));
      setBusy(btn, false);
    }
  });

  /* ---------- recuperar senha ---------- */
  function sendReset(email) {
    return sb.auth.resetPasswordForEmail(email, { redirectTo: A.pageUrl('redefinir-senha.html') });
  }
  function startCooldown(btn, seconds) {
    clearInterval(state.timer);
    var left = seconds;
    function tick() {
      if (left <= 0) {
        clearInterval(state.timer);
        btn.disabled = false;
        btn.textContent = 'Reenviar e-mail';
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Reenviar em ' + left + 's';
      left -= 1;
    }
    tick();
    state.timer = setInterval(tick, 1000);
  }

  $('form-esqueci').addEventListener('submit', async function (e) {
    e.preventDefault();
    var msg = msgOf('esqueci');
    var input = $('esqueci-email');
    var email = input.value.trim();
    var btn = $('btn-esqueci');
    setMsg(msg, '');
    markInvalid(input, false);

    if (!EMAIL_RE.test(email)) { markInvalid(input, true); setMsg(msg, 'Informe um e-mail válido.'); input.focus(); return; }
    if (!ready(msg)) return;

    setBusy(btn, true);
    try {
      var res = await sendReset(email);
      if (res.error) { setMsg(msg, A.translateError(res.error)); setBusy(btn, false); return; }
      state.resetEmail = email;
      $('sent-email').textContent = email;
      startCooldown($('btn-reenviar'), 60);
      setBusy(btn, false);
      go('enviado');
    } catch (err) {
      setMsg(msg, A.translateError(err));
      setBusy(btn, false);
    }
  });

  $('btn-reenviar').addEventListener('click', async function () {
    var btn = $('btn-reenviar');
    var msg = msgOf('enviado');
    setMsg(msg, '');
    if (!state.resetEmail || !ready(msg)) return;
    btn.disabled = true;
    try {
      var res = await sendReset(state.resetEmail);
      if (res.error) { setMsg(msg, A.translateError(res.error)); btn.disabled = false; return; }
      setMsg(msg, 'Enviamos um novo link. Pode levar alguns instantes para chegar.', 'info');
      startCooldown(btn, 60);
    } catch (err) {
      setMsg(msg, A.translateError(err));
      btn.disabled = false;
    }
  });

  /* ---------- início ---------- */
  render();

  if (/(^|[?&])erro=oauth(&|$)/.test(window.location.search)) {
    setMsg(msgOf('entrar'), 'Não foi possível entrar com o Google. Tente novamente.');
  }

  if (sb) {
    sb.auth.getSession().then(function (r) {
      if (r && r.data && r.data.session) window.location.replace(A.pageUrl('inicio.html'));
    });
  }
})();
