/* JavaScript del tema Base: el menú del móvil y abrir la sección de servicios a la que se salta. La reserva y la cuenta las hace el SDK (sdk/salon.js). */
(function () {
  'use strict';
  var btn = document.querySelector('[data-menu]');
  var nav = document.getElementById('menu');
  if (!btn || !nav) return;
  function set(open) {
    nav.classList.toggle('abierto', open);
    btn.setAttribute('aria-expanded', String(open));
  }
  btn.addEventListener('click', function () { set(!nav.classList.contains('abierto')); });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
  // Al abrir la reserva se cierra el menú
  document.addEventListener('salon:antes-de-reservar', function () { set(false); });
})();

// Secciones de servicios desplegables: al tocar un enlace a una sección (#cat-…), se abre
(function () {
  function abrir() {
    var el = location.hash && document.getElementById(location.hash.slice(1));
    if (el && el.tagName === 'DETAILS') { el.open = true; el.scrollIntoView({ block: 'start' }); }
  }
  window.addEventListener('hashchange', abrir);
  document.addEventListener('click', function (e) { if (e.target.closest('a[href^="#cat-"]')) setTimeout(abrir, 0); });
  abrir();
})();
