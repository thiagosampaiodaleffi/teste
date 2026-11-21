/* Painel base: só abre com sessão válida do Supabase. */
(function () {
  'use strict';

  var A = window.PatioAuth;
  var sb = A.client;

  function $(id) { return document.getElementById(id); }
  function toLogin(extra) { window.location.replace(A.pageUrl('index.html') + (extra || '')); }

  // O OAuth devolve erro no hash (#error=...) quando o Google recusa ou o provedor está desativado.
  var oauthFailed = /(^|[#&?])error(_code|_description)?=/.test(A.initialHash + A.initialSearch);

  if (!A.configured || !sb) { toLogin(); return; }

  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    var first = parts[0].charAt(0);
    var last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
    return (first + last).toUpperCase();
  }

  function fill(user) {
    var meta = user.user_metadata || {};
    var app = user.app_metadata || {};
    var name = meta.full_name || meta.name || '';
    var shown = name || user.email || 'usuário';
    var firstName = String(shown).trim().split(/\s+/)[0];

    $('dash-title').textContent = 'Olá, ' + firstName;
    $('dash-email').textContent = user.email || '';
    $('d-nome').textContent = name || 'Não informado';
    $('d-email').textContent = user.email || '—';
    $('d-metodo').textContent = app.provider === 'google' ? 'Google' : 'E-mail e senha';
    $('d-confirmado').textContent = user.email_confirmed_at ? 'Sim' : 'Não';
    $('d-criada').textContent = user.created_at
      ? new Date(user.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
      : '—';

    var avatar = meta.avatar_url || meta.picture || '';
    if (/^https:\/\//.test(avatar)) {
      var img = $('avatar-img');
      img.src = avatar;
      img.hidden = false;
      img.addEventListener('error', function () { img.hidden = true; $('avatar-initials').hidden = false; });
      $('avatar-initials').hidden = true;
    }
    $('avatar-initials').textContent = initials(shown);

    $('dash-loading').hidden = true;
    $('dash').hidden = false;
    document.title = 'Painel · Pátio';
  }

  sb.auth.getSession().then(function (r) {
    var session = r && r.data && r.data.session;
    if (!session) { toLogin(oauthFailed ? '?erro=oauth' : ''); return; }
    // Confirma com o servidor que o usuário ainda existe e a sessão é válida.
    return sb.auth.getUser().then(function (u) {
      if (u.error || !u.data || !u.data.user) { return sb.auth.signOut().then(function () { toLogin(); }); }
      // Depois do login (inclusive Google e link de confirmação) segue para o Pátio.
      window.location.replace(A.pageUrl('inicio.html'));
    });
  }).catch(function () { toLogin(); });

  sb.auth.onAuthStateChange(function (event) {
    if (event === 'SIGNED_OUT') toLogin();
  });

  $('btn-sair').addEventListener('click', async function () {
    var btn = $('btn-sair');
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    try { await sb.auth.signOut(); } catch (e) { /* mesmo com falha de rede, segue para o login */ }
    toLogin();
  });
})();
