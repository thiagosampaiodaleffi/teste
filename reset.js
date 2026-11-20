/* Página aberta pelo link de recuperação enviado por e-mail (Supabase Auth). */
(function () {
  'use strict';

  var A = window.PatioAuth;
  var sb = A.client;
  var decided = false;

  function $(id) { return document.getElementById(id); }
  function showState(name) {
    document.querySelectorAll('[data-state]').forEach(function (s) { s.hidden = (s.getAttribute('data-state') !== name); });
    var h = document.querySelector('[data-state="' + name + '"] h1');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
  }
  function setMsg(el, text) {
    if (!text) { el.hidden = true; el.textContent = ''; el.className = 'msg'; return; }
    el.textContent = text; el.className = 'msg msg-error'; el.hidden = false;
  }
  function setBusy(btn, on) {
    btn.disabled = on;
    if (on) btn.setAttribute('aria-busy', 'true'); else btn.removeAttribute('aria-busy');
  }
  function cleanUrl() {
    try { window.history.replaceState(null, '', window.location.pathname); } catch (e) { /* ignora */ }
  }
  function invalid(text) {
    if (decided) return;
    decided = true;
    if (text) $('invalid-text').textContent = text;
    cleanUrl();
    showState('invalido');
  }
  function openForm() {
    if (decided) return;
    decided = true;
    cleanUrl();
    showState('form');
    $('nova-senha').focus();
  }

  document.querySelectorAll('.eye').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = $(btn.getAttribute('data-toggle'));
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-pressed', String(show));
      btn.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
    });
  });

  if (!A.configured || !sb) {
    invalid('Esta página ainda não está conectada ao Supabase. Preencha config.js e peça um novo link.');
    return;
  }

  var hash = A.initialHash || '';
  var isRecovery = /(^|[#&])type=recovery(&|$)/.test(hash);
  var hasError = /(^|[#&])error(_code|_description)?=/.test(hash);

  if (hasError) {
    invalid('Esse link expirou ou já foi usado. Peça um novo para continuar.');
    return;
  }
  if (!isRecovery) {
    invalid('Abra esta página pelo link que enviamos para o seu e-mail.');
    return;
  }

  // O Supabase emite PASSWORD_RECOVERY depois de validar o token do link.
  sb.auth.onAuthStateChange(function (event) {
    if (event === 'PASSWORD_RECOVERY') openForm();
  });
  sb.auth.getSession().then(function (r) {
    if (r && r.data && r.data.session) openForm();
  });
  setTimeout(function () {
    if (!decided) invalid('Não conseguimos validar o link. Ele pode ter expirado. Peça um novo.');
  }, 8000);

  $('form-nova').addEventListener('submit', async function (e) {
    e.preventDefault();
    var msg = document.querySelector('[data-state="form"] .msg');
    var p1 = $('nova-senha');
    var p2 = $('nova-confirma');
    var btn = $('btn-nova');
    setMsg(msg, '');
    p1.removeAttribute('aria-invalid');
    p2.removeAttribute('aria-invalid');

    if (p1.value.length < 8) { p1.setAttribute('aria-invalid', 'true'); setMsg(msg, 'A senha precisa ter pelo menos 8 caracteres.'); p1.focus(); return; }
    if (p1.value !== p2.value) { p2.setAttribute('aria-invalid', 'true'); setMsg(msg, 'As senhas não são iguais.'); p2.focus(); return; }

    setBusy(btn, true);
    try {
      var res = await sb.auth.updateUser({ password: p1.value });
      if (res.error) {
        var code = String(res.error.code || '');
        if (res.error.status === 401 || res.error.status === 403 || code === 'session_not_found') {
          invalid('Sua sessão de recuperação expirou. Peça um novo link.');
          return;
        }
        setMsg(msg, A.translateError(res.error));
        setBusy(btn, false);
        return;
      }
      p1.value = '';
      p2.value = '';
      // Encerra a sessão nos outros aparelhos; esta continua ativa.
      try { await sb.auth.signOut({ scope: 'others' }); } catch (e2) { /* a senha já foi trocada */ }
      showState('sucesso');
    } catch (err) {
      setMsg(msg, A.translateError(err));
      setBusy(btn, false);
    }
  });
})();
