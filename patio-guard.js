/* Protege a página do Pátio: só abre com sessão válida do Supabase. */
(function () {
  'use strict';

  var A = window.PatioAuth;
  var sb = A && A.client;
  var booted = false;

  var leaving = false;
  function toLogin() {
    if (leaving) return; // um único redirecionamento, mesmo que vários eventos peçam
    leaving = true;
    window.location.replace(A ? A.pageUrl('index.html') : 'index.html');
  }
  if (!A || !A.configured || !sb) { toLogin(); return; }

  function networkProblem(err) {
    var m = String((err && err.message) || '').toLowerCase();
    return !err || err.status === undefined || err.status === 0 || err.status >= 500 ||
      m.indexOf('fetch') !== -1 || m.indexOf('network') !== -1;
  }

  // Devolve o usuário se a sessão é válida; falha se não houver sessão ou o servidor a recusar.
  function verify() {
    return sb.auth.getSession().then(function (r) {
      var session = r && r.data && r.data.session;
      if (!session) throw new Error('sem sessão');
      return sb.auth.getUser().then(function (u) {
        if (u && u.data && u.data.user) return u.data.user;
        // Sem internet, mantém quem já estava logado; qualquer outra recusa derruba a sessão.
        if (u && u.error && networkProblem(u.error)) return session.user;
        return sb.auth.signOut().catch(function () {}).then(function () { throw new Error('sessão inválida'); });
      });
    });
  }

  function open(user) {
    window.PATIO_USER = user;
    document.documentElement.classList.add('auth-ok');
    if (!booted) { booted = true; window.__bootPatio(); }
  }

  verify().then(open).catch(toLogin);

  // Voltar pelo histórico após sair: reconfirma a sessão antes de mostrar a página.
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) verify().catch(toLogin);
  });

  // Sair em outra aba também fecha esta.
  sb.auth.onAuthStateChange(function (event) {
    if (event === 'SIGNED_OUT') toLogin();
  });

  var btn = document.getElementById('btn-sair');
  btn.addEventListener('click', function () {
    btn.disabled = true;
    sb.auth.signOut().catch(function () {}).then(toLogin);
  });
})();
