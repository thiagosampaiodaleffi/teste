/* Cliente Supabase compartilhado por todas as páginas. */
(function () {
  'use strict';

  var cfg = window.PATIO_CONFIG || {};
  var url = String(cfg.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  var key = String(cfg.SUPABASE_ANON_KEY || '').trim();

  function jwtRole(token) {
    try {
      var payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(payload)).role || '';
    } catch (e) {
      return '';
    }
  }

  var looksValid = /^https:\/\/[^\s]+$/.test(url) && key.length > 20;
  var unsafeKey = jwtRole(key) === 'service_role' || /^sb_secret_/.test(key);
  var configured = looksValid && !unsafeKey;

  var api = {
    configured: configured,
    unsafeKey: unsafeKey,
    client: null,
    // O Supabase limpa o hash da URL ao processar o link do e-mail; guardamos antes.
    initialHash: window.location.hash,
    initialSearch: window.location.search
  };

  if (configured && window.supabase && typeof window.supabase.createClient === 'function') {
    api.client = window.supabase.createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // "implicit" permite abrir o link do e-mail em outro navegador ou aparelho.
        flowType: 'implicit'
      }
    });
  }

  api.pageUrl = function (name) {
    return new URL(name, window.location.href).href;
  };

  api.translateError = function (err) {
    if (!err) return 'Algo deu errado. Tente novamente.';
    var code = String(err.code || '').toLowerCase();
    var msg = String(err.message || '').toLowerCase();
    var status = err.status;

    if (code === 'invalid_credentials' || msg.indexOf('invalid login credentials') !== -1) {
      return 'E-mail ou senha incorretos.';
    }
    if (code === 'email_not_confirmed' || msg.indexOf('email not confirmed') !== -1) {
      return 'Confirme seu e-mail antes de entrar. Procure a mensagem na sua caixa de entrada.';
    }
    if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' ||
        status === 429 || msg.indexOf('rate limit') !== -1) {
      return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.';
    }
    if (code === 'weak_password' || msg.indexOf('password should be') !== -1) {
      return 'Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.';
    }
    if (code === 'same_password' || msg.indexOf('different from the old password') !== -1) {
      return 'A nova senha precisa ser diferente da atual.';
    }
    if (code === 'user_already_exists' || msg.indexOf('already registered') !== -1) {
      return 'Este e-mail já possui cadastro. Tente entrar ou recuperar a senha.';
    }
    if (code === 'signup_disabled' || msg.indexOf('signups not allowed') !== -1) {
      return 'Novos cadastros estão desativados no momento.';
    }
    if (code === 'validation_failed' && msg.indexOf('provider') !== -1) {
      return 'O login com Google ainda não foi ativado neste projeto.';
    }
    if (msg.indexOf('failed to fetch') !== -1 || msg.indexOf('network') !== -1) {
      return 'Sem conexão com o servidor. Verifique sua internet e tente de novo.';
    }
    return 'Algo deu errado. Tente novamente em instantes.';
  };

  window.PatioAuth = api;
})();
