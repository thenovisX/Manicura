// JavaScript del tema Laca. Se compila a assets/tema.js con `npm run build` (ver LEEME.md).
// La reserva, la cuenta y las cookies las hace el SDK (sdk/salon.js); aquí solo va el movimiento:
// laca líquida (OGL), scroll con inercia (Lenis), escenas fijas (GSAP + ScrollTrigger), letras (SplitType) y cursor.
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import SplitType from 'split-type';
import { liquido } from './liquido.js';
import { cursor } from './cursor.js';

gsap.registerPlugin(ScrollTrigger);
// Las páginas interiores no tienen todas las piezas de la portada: sin avisos por las que faltan
gsap.config({ nullTargetWarn: false });

const html = document.documentElement;
html.classList.replace('sin-js', 'js');
const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (quieto) html.classList.add('quieto');

// Pantalla táctil (sin ratón) y móviles modestos: menos trabajo para la GPU
const tactil = matchMedia('(hover: none), (pointer: coarse)').matches;
const modesto = !!(navigator.connection?.saveData || (navigator.deviceMemory && navigator.deviceMemory <= 2));
if (tactil) html.classList.add('tactil');
// La barra del navegador del móvil cambia la altura al bajar: no recalcular las escenas por eso
ScrollTrigger.config({ ignoreMobileResize: true });

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

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

// Lenis: scroll con inercia, sincronizado con el reloj de GSAP para que ScrollTrigger no tiemble
function scrollSuave() {
  if (quieto) return null;
  const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, prevent: (n) => n.closest?.('dialog, [data-lenis-prevent]') });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  // Con una ventana abierta (reserva, foto ampliada, cookies) la página no se mueve
  const revisar = () => ($('dialog[open]') || html.classList.contains('menu-abierto') ? lenis.stop() : lenis.start());
  new MutationObserver(revisar).observe(document.body, { attributes: true, attributeFilter: ['open'], subtree: true, childList: true });
  new MutationObserver(revisar).observe(html, { attributes: true, attributeFilter: ['class'] });

  // Enlaces a secciones de esta misma página (#servicios, ./#packs…): viaje suave
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href*="#"]');
    if (!a || a.hasAttribute('data-book') || e.defaultPrevented) return;
    const url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || !url.hash) return;
    const el = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!el) return;
    e.preventDefault();
    lenis.scrollTo(el, { offset: -10, duration: 1.6 });
    history.replaceState(null, '', url.hash);
  });
  if (location.hash) addEventListener('load', () => { const el = document.getElementById(location.hash.slice(1)); if (el) lenis.scrollTo(el, { immediate: true }); });
  return lenis;
}

function escenas(lenis, laca) {
  const splits = [];
  const mm = gsap.matchMedia();

  // La cabecera se esconde al bajar y vuelve al subir
  const cab = $('.cab');
  let ultimo = 0;
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (st) => {
      const y = st.scroll();
      cab?.classList.toggle('cab-oculta', y > 300 && y > ultimo && !html.classList.contains('menu-abierto'));
      cab?.classList.toggle('cab-fondo', y > 60);
      ultimo = y;
    },
  });

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    // Título: cada letra entra girando en X e Y con física elástica, y al bajar se abre y se hunde
    const t = $('[data-split]');
    if (t) {
      const s = new SplitType(t, { types: 'words,chars' }); splits.push(s);
      gsap.from(s.chars, {
        rotateX: -110, rotateY: 70, yPercent: 60, opacity: 0, transformOrigin: '50% 100% -60px',
        duration: 2.2, ease: 'elastic.out(1, 0.45)', stagger: 0.06, delay: 0.25,
      });
      if ($('.portada')) {
        gsap.to(s.chars, {
          yPercent: (i) => -20 - i * 12, rotateX: (i) => (i % 2 ? 25 : -25), opacity: 0.12, ease: 'none',
          scrollTrigger: { trigger: '.portada', start: 'top top', end: 'bottom top', scrub: true },
        });
      }
    }
    gsap.from('.aparece', { y: 30, opacity: 0, duration: 1.2, ease: 'power3.out', stagger: 0.1, delay: 0.9 });
    gsap.from('.portada-arco', { clipPath: 'inset(100% 0 0 0 round 999px 999px 24px 24px)', duration: 1.8, ease: 'expo.out', delay: 0.5 });

    // Fotos con parallax suave (data-parallax = cuánto se desplazan, en %)
    $$('[data-parallax]').forEach((el) => {
      const k = innerWidth < 761 ? 0.35 : 1;
      gsap.fromTo(el, { yPercent: -el.dataset.parallax * k }, {
        yPercent: +el.dataset.parallax * k, ease: 'none',
        scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
    // Los arcos se abren de abajo arriba al entrar
    $$('.nosotros-arco, .trabajos').forEach((el) => {
      gsap.from(el, { clipPath: 'inset(100% 0 0 0 round 999px 999px 24px 24px)', duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 85%' } });
    });

    // Cinta: corre sola y acelera (y se inclina) con la velocidad del scroll
    const pista = $('.cinta-pista');
    if (pista) {
      let x = 0, inclina = 0;
      gsap.ticker.add(() => {
        const v = lenis ? lenis.velocity : 0;
        x -= 0.6 + Math.abs(v) * 0.35;
        const w = pista.scrollWidth / 2;
        if (w && x <= -w) x += w;
        inclina += (Math.max(-12, Math.min(12, v * 0.6)) - inclina) * 0.1;
        pista.style.transform = `translate3d(${x}px,0,0) skewX(${-inclina}deg)`;
      });
    }

    // Viaje en 3D: la pantalla se fija y cada paso emerge desde el fondo y pasa de largo
    const capas = $$('.capa');
    if (capas.length) {
      const n = $('.viaje-n b');
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: '.viaje', start: 'top top', end: () => '+=' + innerHeight * capas.length * (tactil ? 0.9 : 1.1), pin: true, scrub: 1, anticipatePin: 1,
          onUpdate: (st) => { if (n) n.textContent = String(Math.min(capas.length, Math.floor(st.progress * capas.length) + 1)).padStart(2, '0'); },
        },
      });
      // El desenfoque es caro en el móvil: allí las capas solo crecen y se desvanecen
      const borroso = (px) => (tactil ? {} : { filter: `blur(${px}px)` });
      // En el móvil las capas comparten sitio: cada una se va del todo antes de que llegue la siguiente
      const entra = tactil ? 0.75 : 1, sale = tactil ? 0.45 : 0.9, espera = tactil ? 0.85 : 1.15;
      capas.forEach((c, i) => {
        const t = i * 1.1 + (tactil && i ? 0.35 : 0);
        tl.fromTo(c, { scale: 0.5, opacity: 0, z: -600, ...borroso(14) }, { scale: 1, opacity: 1, z: 0, ...borroso(0), duration: entra, ease: 'power2.out' }, t);
        if (i < capas.length - 1) tl.to(c, { scale: tactil ? 1.5 : 2.6, opacity: 0, z: 400, ...borroso(10), duration: sale, ease: 'power2.in' }, i * 1.1 + espera);
      });
      tl.fromTo('.viaje-gota', { scale: 0.4, rotate: -30 }, { scale: 1.6, rotate: 30, duration: capas.length * 1.1 + 1, ease: 'none' }, 0);
    }

    // Presentación: las palabras se encienden al pasar
    $$('[data-encender]').forEach((el) => {
      const s = new SplitType(el, { types: 'words' }); splits.push(s);
      gsap.fromTo(s.words, { opacity: 0.12 }, { opacity: 1, stagger: 0.05, ease: 'none', scrollTrigger: { trigger: el, start: 'top 75%', end: 'bottom 55%', scrub: true } });
    });
    if ($('.nosotros')) gsap.to('.frasco', { yPercent: -40, rotate: 18, ease: 'none', scrollTrigger: { trigger: '.nosotros', start: 'top bottom', end: 'bottom top', scrub: true } });

    // Servicios: cada fila sube desde la profundidad; los nombres de sección se deslizan
    $$('.serv').forEach((el) => {
      gsap.from(el, { y: 80, opacity: 0, rotateX: -35, transformOrigin: '50% 0', duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 94%' } });
    });
    $$('.cat-t').forEach((el) => {
      gsap.fromTo(el, { xPercent: 10 }, { xPercent: -14, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    // Reservar: la palabra gigante se desliza
    if ($('.cierre')) gsap.fromTo('.cierre-t', { xPercent: 6 }, { xPercent: -36, ease: 'none', scrollTrigger: { trigger: '.cierre', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.fromTo('.pie-marca', { yPercent: 40 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.pie', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  });

  // Packs: en pantallas anchas la sección se fija y las tarjetas cruzan de lado
  mm.add('(prefers-reduced-motion: no-preference) and (min-width: 761px) and (min-height: 600px)', () => {
    const pista = $('.packs-pista');
    if (!pista) return;
    html.classList.add('packs-fijos');
    const recorrido = () => Math.max(0, pista.scrollWidth - innerWidth + 60);
    gsap.to(pista, {
      x: () => -recorrido(), ease: 'none',
      scrollTrigger: { trigger: '.packs', start: 'top top', end: () => '+=' + recorrido(), pin: true, scrub: 1, invalidateOnRefresh: true },
    });
    $$('.pack', pista).forEach((p) => {
      gsap.fromTo(p, { rotate: 0 }, { rotate: () => getComputedStyle(p).getPropertyValue('--giro'), ease: 'none', scrollTrigger: { trigger: '.packs', start: 'top 60%', end: 'top top', scrub: true } });
    });
    return () => html.classList.remove('packs-fijos');
  });

  // Muestra de esmalte que sigue al ratón por la lista de servicios y tiñe la laca de fondo
  const muestra = $('.muestra');
  if (muestra && matchMedia('(pointer: fine)').matches) {
    const p = { x: 0, y: 0 }, m = { x: 0, y: 0 };
    addEventListener('pointermove', (e) => { m.x = e.clientX; m.y = e.clientY; }, { passive: true });
    gsap.ticker.add(() => {
      p.x += (m.x - p.x) * 0.1; p.y += (m.y - p.y) * 0.1;
      muestra.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -50%) rotate(${(m.x - p.x) * 0.2}deg)`;
    });
    $$('.serv').forEach((li) => {
      li.addEventListener('pointerenter', () => {
        const tono = getComputedStyle(li).getPropertyValue('--tono').trim();
        muestra.style.backgroundColor = tono;
        muestra.style.backgroundImage = li.dataset.foto ? `url("${li.dataset.foto.replace(/"/g, '%22')}")` : '';
        muestra.classList.add('on');
        laca.tono(tono);
      });
    });
    $('.servicios')?.addEventListener('pointerleave', () => { muestra.classList.remove('on'); laca.tono(null); });
  }

  // Pista de packs deslizable (móvil, pantallas bajas): contador y barra de avance
  const pistaPacks = $('.packs-pista'), cuenta = $('.packs-n');
  if (pistaPacks && cuenta) {
    const packs = $$('.pack', pistaPacks), b = $('b', cuenta);
    const avance = () => {
      const max = pistaPacks.scrollWidth - pistaPacks.clientWidth;
      const p = max > 0 ? pistaPacks.scrollLeft / max : 0;
      b.textContent = String(Math.round(p * (packs.length - 1)) + 1).padStart(2, '0');
      cuenta.style.setProperty('--avance', String(Math.max(0.1, p)));
    };
    pistaPacks.addEventListener('scroll', avance, { passive: true });
    avance();
  }

  // En el móvil, la fila de servicio que pasa por el centro de la pantalla se «esmalta» y tiñe la laca
  if (tactil) {
    $$('.serv').forEach((li) => {
      ScrollTrigger.create({
        trigger: li, start: 'top 58%', end: 'bottom 42%',
        onToggle: (st) => {
          li.classList.toggle('activa', st.isActive);
          if (st.isActive) laca.tono(getComputedStyle(li).getPropertyValue('--tono').trim());
        },
      });
    });
    ScrollTrigger.create({ trigger: '.servicios', start: 'top bottom', end: 'bottom top', onLeave: () => laca.tono(null), onLeaveBack: () => laca.tono(null) });
  }

  // Botón flotante «Reservar cita» (móvil): entre la portada y la sección de reservar
  const flota = $('.flota');
  if (flota && $('.portada')) {
    const ver = () => {
      const y = scrollY, cierre = $('.cierre');
      const fin = cierre ? cierre.getBoundingClientRect().top + y - innerHeight * 0.6 : Infinity;
      // Durante el viaje en 3D no se pone delante de la escena
      const v = $('.viaje')?.getBoundingClientRect();
      const enViaje = v && v.top <= 1 && v.bottom >= innerHeight - 1;
      flota.classList.toggle('on', y > innerHeight * 0.8 && y < fin && !enViaje);
    };
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: ver });
    ver();
  }

  // Las fuentes cambian la altura de los textos: se recalculan las escenas al cargarlas
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  addEventListener('load', () => ScrollTrigger.refresh());
  return splits;
}

function iniciar() {
  menu();
  const laca = liquido($('.liquido'), { quieto: quieto || modesto, calma: !document.body.classList.contains('inicio') });
  cursor();
  const lenis = scrollSuave();
  escenas(lenis, laca);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
else iniciar();
