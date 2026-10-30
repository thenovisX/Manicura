// JavaScript del tema Laca. Se compila a assets/tema.js con `npm run build` (ver LEEME.md).
// La reserva, la cuenta y las cookies las hace el SDK (sdk/salon.js). Aquí solo va lo que acompaña sin distraer:
// el fondo de laca (OGL, muy lento y oscuro), el menú del móvil, la cabecera con fondo al bajar y el botón flotante «Reservar cita».
import { liquido } from './liquido.js';

const html = document.documentElement;
html.classList.replace('sin-js', 'js');
const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (quieto) html.classList.add('quieto');
// Móviles modestos o con ahorro de datos: el fondo queda como una imagen fija
const modesto = !!(navigator.connection?.saveData || (navigator.deviceMemory && navigator.deviceMemory <= 2));

const $ = (s, c = document) => c.querySelector(s);

function menu() {
  const btn = $('[data-menu]'), nav = $('#menu');
  if (!btn || !nav) return;
  const set = (open) => {
    nav.classList.toggle('abierto', open);
    html.classList.toggle('menu-abierto', open);
    btn.setAttribute('aria-expanded', String(open));
  };
  btn.addEventListener('click', () => set(!nav.classList.contains('abierto')));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  document.addEventListener('salon:antes-de-reservar', () => set(false));
}

// Cabecera con fondo en cuanto bajas, y botón flotante «Reservar cita» (móvil) cuando ya no se ve el de la portada
function alBajar() {
  const cab = $('.cab'), flota = $('.flota'), hero = $('.hero .pill-llena'), cierre = $('.cierre');
  let pendiente = false;
  const ver = () => {
    pendiente = false;
    cab?.classList.toggle('cab-fondo', scrollY > 20);
    if (flota && hero) {
      const pasado = hero.getBoundingClientRect().bottom < 0;
      const alFinal = cierre && cierre.getBoundingClientRect().top < innerHeight * 0.7;
      flota.classList.toggle('on', pasado && !alFinal);
    }
  };
  addEventListener('scroll', () => { if (!pendiente) { pendiente = true; requestAnimationFrame(ver); } }, { passive: true });
  ver();
}

function iniciar() {
  menu();
  alBajar();
  liquido($('.liquido'), { quieto: quieto || modesto, calma: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
else iniciar();
