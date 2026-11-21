/* Protege a página do Pátio (estoque): usa o guarda genérico auth-guard.js. */
window.PatioGuard.start({ logoutId: 'btn-sair', onReady: function () { window.__bootPatio(); } });
