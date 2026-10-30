/* App de gestión del salón: reservas de hoy, calendario, servicios y ajustes.
 * Funciona igual dentro de la app Android (Capacitor) y desde el navegador (/panel/ en iPhone). */
(function () {
  'use strict';

  /* ---------- Utilidades ---------- */
  const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const LS = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } },
  };
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const todayISO = () => iso(new Date());
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const DIAS_C = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const fmtDay = (s) => { const d = parseISO(s); return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`; };
  const fmtShort = (s) => { const d = parseISO(s); return `${DIAS_C[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`; };
  const euro = (n) => Number(n).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
  const telHref = (t) => 'tel:' + String(t).replace(/[^\d+]/g, '');
  const waHref = (t) => { let n = String(t).replace(/\D/g, ''); if (n.length === 9) n = '34' + n; return 'https://wa.me/' + n; };
  const ACTIVE = ['pendiente', 'esperando', 'confirmada'];
  /** Minutos que dura una cita sin servicio (Ajustes → Reservas → Puestos y huecos). */
  const defaultMin = () => Number((S.settings && S.settings.default_minutes) ?? 60) || 60;
  const toMin = (hm) => { const [h, m] = String(hm).split(':').map(Number); return h * 60 + m; };
  const fromMin = (n) => `${pad(Math.floor(n / 60) % 24)}:${pad(n % 60)}`;
  /** 45 → «45 min»; 90 → «1 h 30 min». */
  const minText = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`);
  /** Minutos que dura una reserva: los de su servicio o, si no lleva, los de por defecto. */
  const resMin = (r) => Number(r.duration) || defaultMin();
  /** Hora a la que acaba una reserva. */
  const endTime = (r) => r.end || fromMin(toMin(r.time) + resMin(r));
  /** Reservas de hoy que se están atendiendo ahora (entre su hora y el final de su servicio). */
  function inHouse(list) {
    const d = new Date();
    const now = d.getHours() * 60 + d.getMinutes();
    return list.filter((r) => r.date === todayISO() && ACTIVE.includes(r.status) && toMin(r.time) <= now && now < toMin(r.time) + resMin(r));
  }
  /** Lo que se reserva: «Manicura rusa · 2 personas» o «1 persona». */
  const resWhat = (r) => {
    const ppl = `${r.people} ${r.people === 1 ? 'persona' : 'personas'}`;
    return r.service ? r.service + (r.people > 1 ? ` · ${ppl}` : '') : ppl;
  };
  const STATUS = { pendiente: 'Petición nueva', esperando: 'Esperando al cliente', confirmada: 'Confirmada', rechazada: 'Rechazada', cancelada: 'Cancelada' };
  const WEEK = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 7: 'Domingo' };

  const ICON = {
    pet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z"/></svg>',
    wa: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3Z"/></svg>',
    hoy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
    servicios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2h4v5h-4zM8 7h8l1 4v10a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V11z"/><path d="M7 13h10"/></svg>',
    ajustes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    phone: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
    web: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>',
    plate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M10 3h4v4h-4zM8.5 7h7l.8 3.5V20a1 1 0 0 1-1 1H8.7a1 1 0 0 1-1-1v-9.5z"/></svg>',
  };

  /* ---------- Estado ---------- */
  const defaultBase = NATIVE ? '' : new URL('..', location.href).href.replace(/\/$/, '');
  const S = {
    base: LS.get('base') || defaultBase,
    token: LS.get('token') || '',
    salon: LS.get('salon') || '',
    tab: LS.get('tab') || 'hoy',
    lastId: Number(LS.get('lastId')) || 0,
    settings: null,
    svc: null,
    res: {},          // reservas cargadas, por id
    openSets: new Set(),
    setTab: 'local',  // pestaña abierta en Ajustes
    advOpen: false,   // ¿«Avanzado» desplegado?
    calMonth: todayISO().slice(0, 7),
    calDay: todayISO(),
    me: (() => { try { return JSON.parse(LS.get('me') || 'null'); } catch (e) { return null; } })(),
    hoyDay: todayISO(),
    hoyAll: [],
    query: '',
    pending: 0,
  };

  /* ---------- Permisos del usuario ---------- */
  // Sin datos (servidor antiguo) se comporta como administrador
  const isAdmin = () => !S.me || S.me.role === 'admin';
  const can = (perm) => isAdmin() || (S.me.perms || []).includes(perm);
  const norm = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  /* ---------- API ---------- */
  async function api(route, { body = null, form = null } = {}) {
    const opts = { method: 'GET', headers: {} };
    if (S.token) opts.headers['X-Token'] = S.token;
    if (form) { opts.method = 'POST'; opts.body = form; }
    else if (body) { opts.method = 'POST'; opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res;
    try {
      res = await fetch(S.base + '/api/?r=' + route, opts);
    } catch (e) {
      throw new Error('No hay conexión con la web. Revisa internet.');
    }
    let json;
    try { json = await res.json(); } catch (e) {
      throw new Error(`La web no responde bien (código ${res.status}). Revisa la dirección.`);
    }
    if (res.status === 401 && route !== 'login') {
      logoutLocal();
      throw new Error(json.error || 'Vuelve a iniciar sesión');
    }
    if (!json.ok) throw new Error(json.error || 'Algo ha fallado');
    return json.data;
  }

  async function loadSettings(force) {
    if (!S.settings || force) S.settings = await api('settings');
    return S.settings;
  }

  /* ---------- Avisos ---------- */
  function toast(msg, type = '') {
    const t = document.createElement('div');
    t.className = 't ' + type;
    t.textContent = msg;
    $('#toast').appendChild(t);
    setTimeout(() => t.remove(), type === 'new' ? 6000 : 3200);
  }

  let LocalNotif = null;
  if (NATIVE && window.Capacitor.registerPlugin) {
    try { LocalNotif = window.Capacitor.registerPlugin('LocalNotifications'); } catch (e) { LocalNotif = null; }
  }

  async function askNotifications() {
    try {
      if (LocalNotif) {
        const p = await LocalNotif.requestPermissions();
        return p.display === 'granted';
      }
      if ('Notification' in window) return (await Notification.requestPermission()) === 'granted';
    } catch (e) { /* no soportado */ }
    return false;
  }

  async function notifyNew(list) {
    const label = { confirmada: 'Confirmada por el cliente: ', cancelada: 'Cancelada por el cliente: ' };
    const lines = list.map((r) => (label[r.status] || 'Petición nueva: ') + `${r.name} · ${r.people} pers. · ${fmtShort(r.date)} ${r.time}`);
    toast(list.length > 1 ? `${list.length} novedades. ${lines[0]}` : lines[0], 'new');
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    try {
      if (LocalNotif) {
        await LocalNotif.schedule({
          notifications: list.map((r, i) => ({ id: (r.id * 10 + ({ pendiente: 1, confirmada: 2, cancelada: 3 }[r.status] || 0)) % 2147483647, title: { confirmada: 'Reserva confirmada', cancelada: 'Reserva cancelada' }[r.status] || 'Petición de reserva', body: lines[i] })),
        });
      } else if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker) {
        const reg = await navigator.serviceWorker.ready;
        list.forEach((r, i) => reg.showNotification({ confirmada: 'Reserva confirmada', cancelada: 'Reserva cancelada' }[r.status] || 'Petición de reserva', { body: lines[i], tag: 'res-' + r.id + '-' + r.status, icon: 'icons/icon-192.png' }));
      }
    } catch (e) { /* sin permiso */ }
  }

  async function notifyErase(n) {
    const body = n === 1 ? 'Un cliente pide borrar sus datos. Mándale el enlace desde Ajustes → Clientes con cuenta.' : `${n} clientes piden borrar sus datos. Ajustes → Clientes con cuenta.`;
    toast(body, 'new');
    try {
      if (LocalNotif) await LocalNotif.schedule({ notifications: [{ id: 2000000000 + (Date.now() % 100000000), title: 'Borrar datos', body }] });
      else if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker) (await navigator.serviceWorker.ready).showNotification('Borrar datos', { body, tag: 'borrar', icon: 'icons/icon-192.png' });
    } catch (e) { /* sin permiso */ }
  }

  async function poll() {
    if (!S.token) return;
    try {
      const c = await api('changes&since=' + S.lastId);
      const isNew = S.lastId > 0 && c.new.length > 0;
      S.lastId = c.last_id;
      LS.set('lastId', String(c.last_id));
      setBadge(c.pending);
      // Peticiones para borrar datos (solo las ve el administrador)
      if (isAdmin() && typeof c.erase === 'number') {
        if (S.eraseN !== undefined && c.erase > S.eraseN) notifyErase(c.erase);
        S.eraseN = c.erase;
      }
      if (isNew) {
        notifyNew(c.new);
        if (S.tab === 'hoy' || S.tab === 'cal' || S.tab === 'pet') render();
      }
    } catch (e) { /* se reintenta en el siguiente ciclo */ }
  }

  function setBadge(n) {
    S.pending = n;
    const b = $('#badge');
    if (!b) return;
    b.hidden = !n;
    b.textContent = n > 99 ? '99+' : String(n);
  }

  /* ---------- Hojas (ventanas desde abajo) ---------- */
  let sheetOpen = false;
  function openSheet(title, html, mount) {
    closeSheet(true);
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-grab"></div>
      <div class="sheet-head"><h2>${esc(title)}</h2><button class="close" type="button" aria-label="Cerrar">×</button></div>
      <div class="sheet-body">${html}</div></div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('.close')) closeSheet(); });
    if (!sheetOpen) history.pushState({ sheet: 1 }, '');
    sheetOpen = true;
    const first = $('input:not([type=hidden]):not([type=checkbox]), select, textarea', wrap);
    if (mount) mount($('.sheet-body', wrap));
    if (first && !('ontouchstart' in window)) first.focus();
    return wrap;
  }
  function closeSheet(silent) {
    const w = $('.sheet-wrap');
    if (w) w.remove();
    if (sheetOpen && !silent) { sheetOpen = false; history.back(); }
  }
  window.addEventListener('popstate', () => {
    if (sheetOpen) { sheetOpen = false; const w = $('.sheet-wrap'); if (w) w.remove(); }
  });

  function busy(btn, on, text) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = text || 'Guardando…'; btn.disabled = true; }
    else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
  }

  /* ---------- Pantallas de acceso ---------- */
  function normalizeBase(v) {
    v = v.trim().replace(/\s+/g, '');
    if (!v) return '';
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
    return v.replace(/\/+$/, '').replace(/\/(panel|api)$/i, '').replace(/\/index\.php$/i, '');
  }

  function renderSetup(error = '') {
    $('#app').innerHTML = `<section class="gate">
      <img class="gate-logo" src="icons/icon-192.png" alt="">
      <h1>Conecta la app con la web del salón</h1>
      <p>Escribe la dirección de la web. Solo hay que hacerlo una vez.</p>
      <form id="setup" class="form" novalidate>
        <label>Dirección de la web
          <input name="base" type="url" inputmode="url" autocomplete="url" autocapitalize="off" placeholder="tusalon.com" value="${esc(S.base)}" required>
        </label>
        ${error ? `<p class="err">${esc(error)}</p>` : ''}
        <button class="btn btn-main btn-block" type="submit">Conectar</button>
      </form></section>`;
    $('#setup').addEventListener('submit', async (e) => {
      e.preventDefault();
      const base = normalizeBase(e.target.base.value);
      if (!base) return renderSetup('Escribe la dirección de la web.');
      const btn = $('button', e.target);
      busy(btn, true, 'Comprobando…');
      try {
        const r = await fetch(base + '/api/?r=ping').then((x) => x.json());
        if (!r.ok) throw new Error(r.error);
        S.base = base;
        S.salon = r.data.salon;
        LS.set('base', base);
        LS.set('salon', r.data.salon);
        renderLogin();
      } catch (err) {
        renderSetup(err.message && !/fetch|JSON|token/i.test(err.message) ? err.message
          : 'No se encuentra la web en esa dirección. Comprueba que está bien escrita y que la web está instalada.');
      }
    });
  }

  function renderLogin(error = '', notice = '') {
    $('#app').innerHTML = `<section class="gate">
      <img class="gate-logo" src="icons/icon-192.png" alt="">
      <h1>${esc(S.salon || 'Gestión del salón')}</h1>
      <p>Entra con el usuario que creaste al instalar la web.</p>
      <form id="login" class="form" novalidate>
        <label>Usuario <input name="username" autocomplete="username" autocapitalize="off" required value="${esc(LS.get('user') || '')}"></label>
        <label>Contraseña <input name="password" type="password" autocomplete="current-password" required></label>
        ${error ? `<p class="err">${esc(error)}</p>` : ''}
        ${notice ? `<p class="ok">${esc(notice)}</p>` : ''}
        <button class="btn btn-main btn-block" type="submit">Entrar</button>
        <button class="link" type="button" id="forgot">¿Has olvidado la contraseña?</button>
        ${NATIVE ? `<button class="link" type="button" id="change-base">Cambiar la dirección de la web (${esc(S.base.replace(/^https?:\/\//, ''))})</button>` : ''}
      </form></section>`;
    const f = $('#login');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('button[type=submit]', f);
      busy(btn, true, 'Entrando…');
      try {
        const r = await api('login', { body: { username: f.username.value, password: f.password.value } });
        S.token = r.token;
        S.salon = r.salon;
        LS.set('token', r.token);
        LS.set('user', r.user);
        S.me = r.me || null;
        LS.set('me', JSON.stringify(S.me));
        LS.set('salon', r.salon);
        startApp();
        askNotifications();
      } catch (err) {
        renderLogin(err.message);
      }
    });
    const cb = $('#change-base');
    if (cb) cb.addEventListener('click', () => renderSetup());
    $('#forgot').addEventListener('click', () => renderForgot(f.username.value));
  }

  /* Recuperar la contraseña: se pide con el usuario o el email y llega un enlace de un solo uso (1 hora) */
  function renderForgot(user = '', error = '') {
    $('#app').innerHTML = `<section class="gate">
      <img class="gate-logo" src="icons/icon-192.png" alt="">
      <h1>Recuperar la contraseña</h1>
      <p>Escribe tu usuario o tu email. Te mandaremos un enlace para elegir una contraseña nueva al email de tu usuario (si eres administrador y no tienes email puesto, al email de avisos del salón).</p>
      <form id="forgot-f" class="form" novalidate>
        <label>Usuario o email <input name="username" autocomplete="username" autocapitalize="off" required value="${esc(user)}"></label>
        ${error ? `<p class="err">${esc(error)}</p>` : ''}
        <button class="btn btn-main btn-block" type="submit">Enviar el enlace</button>
        <button class="link" type="button" id="back-login">Volver a entrar</button>
      </form></section>`;
    const f = $('#forgot-f');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!f.username.value.trim()) return renderForgot('', 'Escribe tu usuario o tu email.');
      busy($('button[type=submit]', f), true, 'Enviando…');
      try {
        await api('forgot', { body: { username: f.username.value.trim() } });
        renderLogin('', 'Si el usuario existe y tiene email, te hemos mandado un enlace. Caduca en 1 hora. Mira también en spam.');
      } catch (err) { renderForgot(f.username.value, err.message); }
    });
    $('#back-login').addEventListener('click', () => renderLogin());
  }

  async function renderReset(token) {
    $('#app').innerHTML = `<section class="gate"><img class="gate-logo" src="icons/icon-192.png" alt=""><h1>Contraseña nueva</h1><p>Comprobando el enlace…</p></section>`;
    let who;
    try { who = await api('reset_check', { body: { t: token } }); }
    catch (err) { return renderForgot('', err.message); }
    $('#app').innerHTML = `<section class="gate">
      <img class="gate-logo" src="icons/icon-192.png" alt="">
      <h1>Contraseña nueva</h1>
      <p>Elige la nueva contraseña del usuario «${esc(who.username)}». Al guardarla se cierran sus sesiones abiertas en otros móviles.</p>
      <form id="reset-f" class="form" novalidate>
        <label>Nueva contraseña <input name="password" type="password" autocomplete="new-password" minlength="8" required></label>
        <p class="hint">Mínimo 8 caracteres.</p>
        <p class="err" hidden></p>
        <button class="btn btn-main btn-block" type="submit">Guardar contraseña</button>
      </form></section>`;
    const f = $('#reset-f');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('button[type=submit]', f);
      busy(btn, true);
      try {
        const r = await api('reset', { body: { t: token, password: f.password.value } });
        LS.set('user', r.username);
        renderLogin('', 'Contraseña cambiada. Ya puedes entrar con la nueva.');
      } catch (err) {
        const box = $('.err', f);
        box.textContent = err.message;
        box.hidden = false;
        busy(btn, false);
      }
    });
  }

  function logoutLocal() {
    S.token = '';
    S.settings = null;
    LS.del('token');
    renderLogin();
  }

  /* ---------- Estructura principal ---------- */
  // Menú de abajo (móvil): Inicio, Agenda, botón grande «Nueva cita», Peticiones y Servicios. Ajustes va arriba a la derecha.
  const TABS = [
    ['hoy', 'Inicio', ICON.home],
    ['cal', 'Agenda', ICON.cal],
    ['pet', 'Peticiones', ICON.bell],
    ['servicios', 'Servicios', ICON.servicios],
    ['ajustes', 'Ajustes', ICON.ajustes],
  ];
  const TITLES = { pet: 'Peticiones', hoy: 'Inicio', cal: 'Agenda', servicios: 'Servicios', ajustes: 'Ajustes' };

  function startApp() {
    const tab = ([k, label, icon]) => `<button type="button" class="tab-${k}" data-tab="${k}">${icon}<span>${label}</span>${k === 'pet' ? '<b class="badge" id="badge" hidden></b>' : ''}</button>`;
    const newBtn = can('reservas') ? `<button type="button" class="tab-new" data-new-cita aria-label="Nueva cita">${ICON.plus}<span>Nueva cita</span></button>` : '';
    $('#app').innerHTML = `
      <header class="bar">
        <div class="bar-txt"><p class="bar-sub" id="bar-sub">${esc(S.salon)}</p><h1 id="title"></h1></div>
        <button class="icon-btn" id="refresh" type="button" aria-label="Actualizar">${ICON.refresh}</button>
        <button class="icon-btn me-btn" type="button" data-tab="ajustes" aria-label="Ajustes">${ICON.ajustes}</button>
      </header>
      <main id="view"></main>
      <div id="fab-slot"></div>
      <nav class="tabs${newBtn ? '' : ' no-new'}" aria-label="Secciones">
        <p class="tabs-brand">${esc(S.salon)}</p>
        ${tab(TABS[0])}${tab(TABS[1])}${newBtn}${tab(TABS[2])}${tab(TABS[3])}${tab(TABS[4])}
      </nav>`;
    $('.me-btn').addEventListener('click', () => go('ajustes'));
    const nb = $('[data-new-cita]');
    if (nb) nb.addEventListener('click', () => editReservation(null, newCitaDay()));
    $('.tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (b) go(b.dataset.tab);
    });
    $('#refresh').addEventListener('click', async (e) => {
      const b = e.currentTarget;
      b.classList.add('busy');
      S.settings = null;
      await Promise.all([render(), poll()]);
      b.classList.remove('busy');
    });
    $('#view').addEventListener('click', onViewClick);
    $('#view').addEventListener('change', onViewChange);
    $('#view').addEventListener('input', onViewInput);
    pullToRefresh();
    go(S.tab);
    poll();
    // Permisos al día (por si el administrador los ha cambiado)
    api('me').then((d) => {
      if (!d.me || JSON.stringify(d.me) === JSON.stringify(S.me)) return;
      S.me = d.me;
      LS.set('me', JSON.stringify(S.me));
      render();
    }).catch(() => {});
  }

  function hasDirty() { return $$('form[data-dirty]', $('#view') || document).length > 0; }
  function go(tab) {
    if (!TABS.some((t) => t[0] === tab)) tab = 'hoy';
    if (S.tab === 'ajustes' && tab !== 'ajustes' && hasDirty() && !confirm('Tienes cambios sin guardar en Ajustes. ¿Salir sin guardarlos?')) return;
    if (tab === 'hoy' && S.tab !== 'hoy') { S.hoyDay = todayISO(); S.query = ''; }
    S.tab = tab;
    LS.set('tab', tab);
    $$('.tabs [data-tab]').forEach((b) => { if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    window.scrollTo(0, 0);
    render();
  }

  /** Deslizar hacia abajo desde arriba del todo para actualizar (como en las apps del móvil). */
  function pullToRefresh() {
    const ind = document.createElement('div');
    ind.className = 'ptr';
    ind.innerHTML = ICON.refresh;
    document.body.appendChild(ind);
    let y0 = null, dy = 0;
    window.addEventListener('touchstart', (e) => {
      y0 = window.scrollY <= 0 && !$('.sheet-wrap') && e.touches.length === 1 ? e.touches[0].clientY : null;
      dy = 0;
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (y0 === null) return;
      dy = Math.max(0, e.touches[0].clientY - y0);
      ind.style.transform = `translate(-50%, ${Math.min(dy, 110) - 50}px) rotate(${dy * 3}deg)`;
      ind.classList.toggle('ready', dy > 80);
      ind.classList.toggle('on', dy > 10);
    }, { passive: true });
    window.addEventListener('touchend', async () => {
      if (y0 === null) return;
      const go2 = dy > 80;
      y0 = null;
      ind.classList.remove('ready');
      if (!go2) { ind.style.transform = ''; ind.classList.remove('on'); return; }
      ind.classList.add('busy');
      ind.style.transform = 'translate(-50%, 40px)';
      S.settings = null;
      await Promise.all([render(), poll()]);
      ind.classList.remove('busy', 'on');
      ind.style.transform = '';
    });
  }

  /** Día que sale ya puesto al pulsar «Nueva cita»: el que estás mirando en Inicio o en la Agenda. */
  function newCitaDay() {
    const d = S.tab === 'cal' ? S.calDay : S.tab === 'hoy' ? S.hoyDay : todayISO();
    return d < todayISO() ? todayISO() : d;
  }
  function setTitle(t) { $('#title').textContent = t; }
  function setFab(label, onClick) {
    const slot = $('#fab-slot');
    slot.innerHTML = label ? `<button class="fab" type="button">${ICON.plus}<span>${esc(label)}</span></button>` : '';
    if (label) $('.fab', slot).addEventListener('click', onClick);
  }

  let renderSeq = 0;
  async function render() {
    const seq = ++renderSeq;
    const view = $('#view');
    if (!view) return;
    setTitle(TITLES[S.tab]);
    document.body.dataset.tab = S.tab;
    setFab('', null);
    if (!view.dataset.tab || view.dataset.tab !== S.tab) view.innerHTML = '<div class="spin dark" aria-label="Cargando"></div>';
    view.dataset.tab = S.tab;
    try {
      const html = await ({ pet: viewPet, hoy: viewHoy, cal: viewCal, servicios: viewServicios, ajustes: viewAjustes })[S.tab]();
      if (seq !== renderSeq) return;
      view.innerHTML = html;
      afterRender[S.tab] && afterRender[S.tab](view);
    } catch (err) {
      if (seq !== renderSeq || !S.token) return;
      view.innerHTML = `<div class="err-box"><p>${esc(err.message)}</p><button class="btn btn-dark btn-sm" data-retry>Reintentar</button></div>`;
    }
  }
  const afterRender = {};

  /* ---------- Tarjetas de reserva ---------- */
  function resCard(r, showDate) {
    S.res[r.id] = r;
    const actions = [];
    if (!can('reservas')) {
      // Solo ver: sin aceptar ni rechazar
    } else if (r.status === 'pendiente') {
      actions.push(waButton(r, 'Confirmar por WhatsApp'));
      actions.push(`<button class="btn btn-sm b-no" data-status="rechazada" data-id="${r.id}">Rechazar</button>`);
    } else if (r.status === 'esperando') {
      actions.push(waButton(r, 'Reenviar'));
    }
    if (ACTIVE.includes(r.status) && r.phone && r.status !== 'pendiente') {
      actions.push(`<a class="btn btn-sm btn-quiet b-call" href="${esc(telHref(r.phone))}" aria-label="Llamar a ${esc(r.name)}">${ICON.phone}<span>Llamar</span></a>`);
      if (r.status === 'confirmada') actions.push(`<a class="btn btn-sm btn-quiet b-chat" href="${esc(waHref(r.phone))}" target="_blank" rel="noopener" aria-label="Escribir a ${esc(r.name)} por WhatsApp">${ICON.wa}<span>WhatsApp</span></a>`);
    }
    const when = ACTIVE.includes(r.status) ? `${esc(r.time)} – ${endTime(r)}` : esc(r.time);
    return `<article class="res st-${r.status}" data-open="${r.id}">
      <div class="res-top">
        <span class="avatar" style="--h:${hue(r.name)}" aria-hidden="true">${esc(initials(r.name))}</span>
        <div class="res-main">
          <p class="res-name">${esc(r.name)}</p>
          <p class="res-what">${esc(resWhat(r))}</p>
        </div>
        <div class="res-time">${showDate ? `<small>${esc(fmtShort(r.date))}</small>` : ''}<b>${when}</b></div>
      </div>
      <p class="res-meta"><span class="chip chip-${r.status}">${STATUS[r.status]}</span>${r.customer ? '<span class="by-hand">con cuenta</span>' : ''}</p>
      ${r.notes ? `<p class="res-notes">${esc(r.notes)}</p>` : ''}
      ${actions.length ? `<div class="res-actions">${actions.join('')}</div>` : ''}
    </article>`;
  }

  /** «María Pérez» → «MP», para el círculo de la tarjeta. */
  const initials = (n) => String(n).trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0)).join('').toUpperCase() || '?';
  /** Un color fijo para cada nombre (siempre el mismo para la misma persona). */
  const hue = (n) => [...String(n)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

  /** Botón que abre WhatsApp con el mensaje y el enlace ya escritos para el cliente (o lo manda solo con la API de Meta). */
  function waButton(r, label, big) {
    if (!r.wa_url) {
      return `<button class="btn ${big ? '' : 'btn-sm '}b-ok" data-status="confirmada" data-id="${r.id}">Confirmar</button>`;
    }
    if (r.wa_auto) {
      label = r.status === 'pendiente' ? 'Aceptar y enviar WhatsApp automático' : 'Reenviar WhatsApp automático';
      return `<button class="btn ${big ? '' : 'btn-sm '}b-wa" data-wa-auto="${r.id}">${ICON.wa}<span>${esc(label)}</span></button>`;
    }
    return `<a class="btn ${big ? '' : 'btn-sm '}b-wa" href="${esc(r.wa_url)}" target="_blank" rel="noopener" data-wa-send="${r.id}">${ICON.wa}<span>${esc(label)}</span></a>`;
  }

  function daySummary(list) {
    const act = list.filter((r) => ACTIVE.includes(r.status));
    const pend = act.filter((r) => r.status !== 'confirmada').length;
    if (!act.length) return 'Sin citas';
    return `<b>${act.length}</b> ${act.length === 1 ? 'cita' : 'citas'}${pend ? ` · <b>${pend}</b> sin confirmar` : ''}`;
  }

  function turnosHTML(list) {
    const manana = list.filter((r) => r.time < '14:00');
    const tarde = list.filter((r) => r.time >= '14:00');
    const n = (l) => l.filter((r) => ACTIVE.includes(r.status)).length;
    let html = '';
    if (manana.length) html += `<h2 class="sec">Mañana <span>${n(manana)} ${n(manana) === 1 ? 'cita' : 'citas'}</span></h2>` + manana.map((r) => resCard(r)).join('');
    if (tarde.length) html += `<h2 class="sec">Tarde <span>${n(tarde)} ${n(tarde) === 1 ? 'cita' : 'citas'}</span></h2>` + tarde.map((r) => resCard(r)).join('');
    return html;
  }

  /* ---------- HOY ---------- */
  async function viewHoy() {
    const t = todayISO();
    [S.hoyAll] = await Promise.all([api(`reservations&from=${t}&to=${iso(addDays(new Date(), 180))}`), loadSettings()]);
    const newReq = S.hoyAll.filter((r) => r.status === 'pendiente').length;
    // Saludo con el resumen del día, como la portada de una app
    const now = new Date();
    const h = now.getHours();
    const hello = h < 6 ? 'Buenas noches' : h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
    const nowMin = h * 60 + now.getMinutes();
    const today = S.hoyAll.filter((r) => r.date === t && ACTIVE.includes(r.status));
    const next = today.filter((r) => toMin(r.time) >= nowMin).sort((x, y) => x.time.localeCompare(y.time))[0];
    const left = today.filter((r) => toMin(r.time) + resMin(r) > nowMin).length;
    let html = `<section class="hero">
      <p class="hero-date">${esc(fmtDay(t))}</p>
      <h2 class="hero-hi">${hello}</h2>
      <p class="hero-sum">${!today.length ? 'Hoy no tienes citas apuntadas.' : left ? `Te ${left === 1 ? 'queda' : 'quedan'} <b>${left} ${left === 1 ? 'cita' : 'citas'}</b> hoy.` : 'Ya has terminado las citas de hoy.'}</p>
      ${next ? `<button type="button" class="hero-next" data-open="${next.id}"><span>Siguiente</span><b>${esc(next.time)}</b> ${esc(next.name.split(' ')[0])} · ${esc(next.service || resWhat(next))}</button>` : ''}
    </section>`;
    if (newReq) {
      html += `<button type="button" class="pet-call" data-goto-tab="pet">
        <span class="pet-ico">${ICON.bell}<b>${newReq}</b></span>
        <span class="pet-txt"><b>${newReq === 1 ? 'Una clienta quiere cita' : `${newReq} clientas quieren cita`}</b><small>Toca para aceptar o rechazar</small></span>
        <span class="pet-go" aria-hidden="true">›</span></button>`;
    }
    const quick = [
      can('reservas') && `<button type="button" class="qa qa-main" data-new-cita>${ICON.plus}<span>Nueva cita</span></button>`,
      `<button type="button" class="qa" data-goto-tab="cal">${ICON.cal}<span>Ver agenda</span></button>`,
      can('servicios') && `<button type="button" class="qa" data-new-service>${ICON.servicios}<span>Añadir servicio</span></button>`,
      S.base && `<a class="qa" href="${esc(S.base)}/" target="_blank" rel="noopener">${ICON.web}<span>Ver mi web</span></a>`,
    ].filter(Boolean);
    html += `<nav class="quick" aria-label="Accesos rápidos">${quick.join('')}</nav>`;
    html += `<label class="search">${ICON.search}<input type="search" id="hoy-q" placeholder="Buscar una cita por nombre o teléfono" value="${esc(S.query)}" autocomplete="off" enterkeyhint="search"></label>`;
    html += '<div id="hoy-body"></div>';
    return html;
  }
  afterRender.hoy = (view) => renderHoyBody(view);

  function dayStrip() {
    const t = todayISO();
    let out = '<div class="strip" role="tablist" aria-label="Próximos días">';
    for (let i = 0; i < 14; i++) {
      const d = iso(addDays(new Date(), i));
      const act = S.hoyAll.filter((r) => r.date === d && ACTIVE.includes(r.status));
      const pend = act.some((r) => r.status !== 'confirmada');
      const dd = parseISO(d);
      const name = i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : DIAS_C[dd.getDay()];
      out += `<button type="button" role="tab" class="strip-d${d === S.hoyDay ? ' sel' : ''}" data-hoy-day="${d}" aria-selected="${d === S.hoyDay}" aria-label="${esc(fmtDay(d))}: ${act.length} citas">
        <span class="sd-n">${name}</span><b>${dd.getDate()}</b><span class="sd-p">${act.length ? `${act.length} ${act.length === 1 ? 'cita' : 'citas'}` : 'libre'}</span>${pend ? '<i class="pd"></i>' : ''}</button>`;
    }
    return out + '</div>';
  }

  function renderHoyBody(view) {
    const box = $('#hoy-body', view);
    if (!box) return;
    const q = S.query.trim().toLowerCase();
    if (q) {
      const qd = q.replace(/\D/g, '');
      const found = S.hoyAll.filter((r) => r.name.toLowerCase().includes(q) || (qd.length >= 3 && String(r.phone).replace(/\D/g, '').includes(qd)));
      box.innerHTML = `<h2 class="sec">Resultados <span>${found.length}</span></h2>`
        + (found.length ? found.map((r) => resCard(r, true)).join('') : '<div class="empty"><p>No hay ninguna reserva próxima con ese nombre o teléfono.</p></div>');
      return;
    }
    const list = S.hoyAll.filter((r) => r.date === S.hoyDay);
    const t = todayISO();
    let html = dayStrip();
    if (S.hoyDay === t) {
      const here = inHouse(S.hoyAll);
      const ppl = here.reduce((a, r) => a + r.people, 0);
      const cap = Number(S.settings.capacity) || 0;
      html += `<div class="local${ppl ? ' on' : ''}">
        <p class="local-n"><b>${ppl}</b>${cap ? `<span> de ${cap}</span>` : ''}</p>
        <div><p class="local-t">${ppl === 1 ? 'puesto ocupado ahora' : 'puestos ocupados ahora'}</p>
        <p class="local-s">${here.length ? here.map((r) => `${esc(r.name.split(' ')[0])}${r.people > 1 ? ` (${r.people})` : ''} hasta las ${endTime(r)}`).join(' · ') : 'Cada cita ocupa su puesto hasta que acaba su servicio.'}</p></div>
        ${cap ? `<i class="local-bar" style="--p:${Math.min(100, Math.round(ppl / cap * 100))}%"></i>` : ''}
      </div>`;
    }
    html += `<div class="day-head"><p class="day-date">${esc(fmtDay(S.hoyDay))}</p><p class="day-sum">${daySummary(list)}</p></div>`;
    html += list.length ? turnosHTML(list)
      : `<div class="empty"><p>${S.hoyDay === t ? 'Hoy no hay citas todavía.' : 'Este día no hay citas.'}</p>${can('reservas') ? `<button class="btn btn-line btn-sm" data-new="${S.hoyDay}">Apuntar una cita</button>` : ''}</div>`;
    box.innerHTML = html;
    const sel = $('.strip-d.sel', box);
    if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  /* ---------- PETICIONES ---------- */
  async function viewPet() {
    const [d] = await Promise.all([api('requests'), loadSettings()]);
    let html = !can('reservas') ? '<p class="pet-intro">Puedes ver las peticiones, pero tu usuario no puede aceptarlas ni rechazarlas.</p>' : `<ol class="how"><li>Pulsa <b>Confirmar por WhatsApp</b>.</li><li>Se abre WhatsApp con el mensaje escrito: dale a <b>enviar</b>.</li><li>Cuando el cliente toque el enlace, la cita queda <b>confirmada</b>.</li></ol>`;
    html += `<h2 class="sec">Nuevas <span>${d.nuevas.length}</span></h2>`;
    html += d.nuevas.length ? d.nuevas.map((r) => resCard(r, true)).join('')
      : '<div class="empty"><p>No hay peticiones nuevas.</p></div>';
    html += `<h2 class="sec">Esperando que el cliente confirme <span>${d.esperando.length}</span></h2>`;
    html += d.esperando.length ? d.esperando.map((r) => resCard(r, true)).join('')
      : '<div class="empty"><p>Ninguna reserva pendiente del cliente.</p></div>';
    if (d.esperando.length) html += '<p class="help" style="color:var(--granito)">Si un cliente te confirma por teléfono, abre su reserva y pulsa «Ya ha confirmado».</p>';
    return html;
  }

  /* ---------- CALENDARIO ---------- */
  async function viewCal() {
    const [settings, month, dayList] = await Promise.all([
      loadSettings(),
      api('month&month=' + S.calMonth),
      api(`reservations&from=${S.calDay}&to=${S.calDay}`),
    ]);
    const [y, m] = S.calMonth.split('-').map(Number);
    const first = new Date(y, m - 1, 1, 12);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(y, m, 0).getDate();
    const t = todayISO();
    const closedDates = settings.closed_dates || [];
    const isClosed = (d) => closedDates.includes(d) || !(settings.hours[String(((parseISO(d).getDay() + 6) % 7) + 1)] || []).length;

    let cells = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => `<div class="cal-wd">${d}</div>`).join('');
    for (let i = 0; i < offset; i++) cells += '<div class="cd blank"></div>';
    for (let d = 1; d <= days; d++) {
      const ds = `${S.calMonth}-${pad(d)}`;
      const info = month.days[ds];
      const cls = ['cd', ds === S.calDay && 'sel', ds === t && 'today', ds < t && 'past', isClosed(ds) && 'closed'].filter(Boolean).join(' ');
      const label = `${d} de ${MESES[m - 1]}${info ? `, ${info.count} ${info.count === 1 ? 'cita' : 'citas'}` : ''}${info && info.pending ? `, ${info.pending} por confirmar` : ''}${isClosed(ds) ? ', cerrado' : ''}`;
      cells += `<button type="button" class="${cls}" data-day="${ds}" aria-label="${esc(label)}"><span class="n">${d}</span>${info ? `<span class="p">${info.count}</span>` : ''}${info && info.pending ? '<i class="pd"></i>' : ''}</button>`;
    }

    const dayClosed = closedDates.includes(S.calDay);
    const weekClosed = !(settings.hours[String(((parseISO(S.calDay).getDay() + 6) % 7) + 1)] || []).length;

    return `<section class="cal">
        <div class="cal-head">
          <button class="cal-nav" type="button" data-month="-1" aria-label="Mes anterior">‹</button>
          <h2>${MESES[m - 1]} ${y}</h2>
          <button class="cal-nav" type="button" data-month="1" aria-label="Mes siguiente">›</button>
        </div>
        <div class="cal-grid">${cells}</div>
        <div class="cal-legend"><span><i style="background:var(--alga)"></i>número de citas</span><span><i style="background:#D89A2B;border-radius:50%"></i>por confirmar</span><span><i style="background:repeating-linear-gradient(-45deg,#F4EFEF 0 3px,#DDCFD3 3px 6px)"></i>cerrado</span></div>
      </section>
      <div class="day-head" style="margin-top:20px"><p class="day-date">${esc(fmtDay(S.calDay))}</p><p class="day-sum">${weekClosed ? 'Día de cierre semanal' : dayClosed ? 'Cerrado este día' : daySummary(dayList)}</p></div>
      <div class="day-tools">
        ${S.calDay !== t ? '<button class="btn btn-quiet btn-sm" data-goto-today>Ir a hoy</button>' : ''}
        ${can('reservas') && !weekClosed && S.calDay >= t ? `<button class="btn btn-line btn-sm" data-close-day="${dayClosed ? 'open' : 'close'}">${dayClosed ? 'Abrir este día' : 'Cerrar este día (festivo, vacaciones…)'}</button>` : ''}
      </div>
      ${dayList.length ? turnosHTML(dayList) : '<div class="empty"><p>No hay citas este día.</p></div>'}`;
  }

  async function toggleClosedDay(action) {
    const s = await loadSettings();
    let list = (s.closed_dates || []).filter((d) => d !== S.calDay);
    if (action === 'close') {
      const n = (await api(`reservations&from=${S.calDay}&to=${S.calDay}`)).filter((r) => ACTIVE.includes(r.status)).length;
      if (n && !confirm(`Ya hay ${n} reservas ese día. Si lo cierras no entrarán más, pero las que hay siguen ahí. ¿Cerrar?`)) return;
      list.push(S.calDay);
    }
    S.settings = await api('settings_save', { body: { closed_dates: list } });
    toast(action === 'close' ? 'Día cerrado: no se aceptan reservas online' : 'Día abierto otra vez');
    render();
  }

  /* ---------- Ficha y edición de reservas ---------- */
  function showReservation(id) {
    const r = S.res[id];
    if (!r) return;
    const btns = [];
    const edit = can('reservas');
    if (!edit) {
      // Solo ver
    } else if (r.status === 'pendiente') {
      btns.push(waButton(r, 'Confirmar por WhatsApp', true), `<button class="btn btn-quiet" data-s="rechazada">Rechazar</button>`);
    } else if (r.status === 'esperando') {
      btns.push(waButton(r, 'Reenviar WhatsApp', true), `<button class="btn btn-quiet" data-s="confirmada">Ya ha confirmado</button>`);
      // Si el envío automático falla, se puede mandar a mano como antes
      if (r.wa_auto) btns.push(`<a class="btn btn-quiet" href="${esc(r.wa_url)}" target="_blank" rel="noopener" data-wa-send="${r.id}">Enviar a mano</a>`);
    } else if (r.status === 'confirmada') {
      btns.push(`<button class="btn btn-quiet" data-s="cancelada">Cancelar reserva</button>`);
    } else {
      btns.push(`<button class="btn btn-quiet" data-s="confirmada">Volver a confirmar</button>`);
    }
    openSheet(r.name, `
      <dl class="detail">
        <dt>Día</dt><dd>${esc(fmtDay(r.date))}</dd>
        <dt>Hora</dt><dd>${esc(r.time)} a ${esc(endTime(r))} <span class="help">(${minText(resMin(r))})</span></dd>
        <dt>Servicio</dt><dd>${r.service ? esc(r.service) : 'Sin elegir'}</dd>
        <dt>Personas</dt><dd>${r.people}</dd>
        <dt>Estado</dt><dd><span class="chip chip-${r.status}">${STATUS[r.status]}</span></dd>
        ${r.lang && r.lang !== 'es' ? `<dt>Idioma</dt><dd>${{ en: 'Inglés', pt: 'Portugués', gl: 'Gallego' }[r.lang] || r.lang} <span class="help">(el WhatsApp y los emails le llegan en su idioma)</span></dd>` : ''}
        ${r.phone ? `<dt>Teléfono</dt><dd>${esc(r.phone)}</dd>` : '<dt>Datos</dt><dd>Borrados (pasaron 24 h)</dd>'}
        ${r.email ? `<dt>Email</dt><dd>${esc(r.email)}</dd>` : ''}
        ${r.notes ? `<dt>Notas</dt><dd>${esc(r.notes)}</dd>` : ''}
        <dt>Entró</dt><dd>${r.source === 'web' ? (r.customer ? 'Por la web, cliente con cuenta' : 'Por la web') : 'Apuntada a mano'}, ${esc(fmtShort(r.created_at.slice(0, 10)))} ${esc(r.created_at.slice(11, 16))}</dd>
      </dl>
      <div class="actions">
        ${btns.length ? `<div class="actions-row">${btns.join('')}</div>` : ''}
        ${r.phone ? `<div class="actions-row">
          <a class="btn btn-line" href="${esc(telHref(r.phone))}">Llamar</a>
          <a class="btn btn-line" href="${esc(waHref(r.phone))}" target="_blank" rel="noopener">WhatsApp</a>
        </div>` : ''}
        ${r.status === 'confirmada' && r.email === '' && r.source === 'web' ? '<p class="help">Este cliente no dejó email: avísale por teléfono o WhatsApp.</p>' : ''}
        ${edit ? '<button class="btn btn-quiet" data-edit>Editar datos</button><button class="btn btn-danger" data-del>Borrar reserva</button>' : '<p class="help">Tu usuario puede ver las reservas, pero no cambiarlas.</p>'}
      </div>`, (body) => {
      $$('[data-wa-send]', body).forEach((a) => a.addEventListener('click', () => { markSent(r.id); closeSheet(); }));
      $$('[data-wa-auto]', body).forEach((b) => b.addEventListener('click', () => autoSend(r.id, b)));
      $$('[data-s]', body).forEach((b) => b.addEventListener('click', async () => {
        if (b.dataset.s === 'rechazada') { rejectFlow(r); return; }
        const q2 = { cancelada: `¿Cancelar la reserva de ${r.name}?` }[b.dataset.s];
        if (q2 && !confirm(q2 + (r.email ? ' Le llegará un email avisándole.' : ''))) return;
        busy(b, true, '…');
        try { await setStatus(r.id, b.dataset.s); closeSheet(); } catch (err) { toast(err.message, 'err'); busy(b, false); }
      }));
      if (!edit) return;
      $('[data-edit]', body).addEventListener('click', () => editReservation(r));
      $('[data-del]', body).addEventListener('click', async () => {
        if (!confirm('¿Borrar esta reserva? Desaparece de la app y, si el cliente abre su enlace, verá «Reserva cancelada».')) return;
        try { await api('reservation_delete', { body: { id: r.id } }); closeSheet(); toast('Reserva borrada'); render(); }
        catch (err) { toast(err.message, 'err'); }
      });
    });
  }

  /* Rechazar: se puede mandar un WhatsApp al cliente con las horas libres de ese día (o decirle que esperamos verle otro día) */
  async function rejectFlow(r) {
    let info;
    try { info = await api('reject_info&id=' + r.id); } catch (err) { toast(err.message, 'err'); return; }
    const sel = new Set(info.slots.slice(0, 4));
    const compose = () => (sel.size ? info.text_slots.replace('{horas}', [...sel].sort().join(', ')) : info.text_none);
    openSheet(`Rechazar la reserva de ${r.name}`, `
      <form class="form" id="rej" novalidate>
        <p class="help" style="margin:0">${esc(resWhat(r))} · ${esc(fmtDay(r.date))} a las ${esc(r.time)}</p>
        ${info.wa_number ? `
          <div class="field">Horas libres ese día para esta cita (${minText(resMin(r))}${r.people > 1 ? `, ${r.people} personas` : ''})
            ${info.slots.length ? `<div class="chips rej-slots">${info.slots.map((h) => `<label><input type="checkbox" value="${h}" ${sel.has(h) ? 'checked' : ''}><span>${h}</span></label>`).join('')}</div>
              <p class="help">Marca las que quieras ofrecerle. Si no marcas ninguna, el mensaje le dice que esperas verle otro día.</p>`
            : '<p class="help">No queda sitio a horas cercanas. El mensaje le dirá que esperas verle otro día.</p>'}
          </div>
          <label>Mensaje de WhatsApp${r.lang && r.lang !== 'es' ? ` <span class="help">(en ${{ en: 'inglés', pt: 'portugués', gl: 'gallego' }[r.lang] || r.lang}, su idioma)</span>` : ''}<textarea name="msg" rows="6">${esc(compose())}</textarea></label>
          <div class="actions">
            <a class="btn b-wa" id="rej-wa" href="#" target="_blank" rel="noopener">${ICON.wa}<span>Rechazar y enviar WhatsApp</span></a>
            <button class="btn btn-quiet" type="button" data-rej-only>Rechazar sin enviar mensaje</button>
          </div>` : `
          <p class="help">Esta reserva no tiene teléfono: no se le puede mandar WhatsApp.</p>
          <div class="actions"><button class="btn btn-danger" type="button" data-rej-only>Rechazar</button></div>`}
        ${r.email ? '<p class="help">Además le llega un email avisándole.</p>' : ''}
      </form>`, (body) => {
      const f = $('#rej', body);
      const wa = $('#rej-wa', body);
      const sync = () => { if (wa) wa.href = 'https://wa.me/' + info.wa_number + '?text=' + encodeURIComponent(f.msg.value); };
      sync();
      if (f.msg) f.msg.addEventListener('input', sync);
      $$('.rej-slots input', body).forEach((cb) => cb.addEventListener('change', () => {
        if (cb.checked) sel.add(cb.value); else sel.delete(cb.value);
        f.msg.value = compose();
        sync();
      }));
      const done = async () => { try { await setStatus(r.id, 'rechazada'); closeSheet(); } catch (err) { toast(err.message, 'err'); } };
      if (wa) wa.addEventListener('click', () => { setTimeout(done, 300); });
      $('[data-rej-only]', body).addEventListener('click', () => { if (confirm(`¿Rechazar la reserva de ${r.name} sin mandarle mensaje?`)) done(); });
    });
  }

  async function setStatus(id, status) {
    const r = await api('reservation_status', { body: { id, status } });
    S.res[id] = r;
    const msg = { esperando: 'WhatsApp preparado', confirmada: 'Reserva confirmada', rechazada: 'Reserva rechazada', cancelada: 'Reserva cancelada' }[status];
    toast(msg + (r.email && r.source === 'web' ? '. Le llega un email al cliente.' : ''));
    render();
    poll();
  }

  /** Tras abrir WhatsApp: la reserva pasa a «esperando al cliente». */
  async function markSent(id) {
    const r = S.res[id];
    if (r && r.status === 'esperando') { toast('WhatsApp abierto: pulsa enviar'); return; }
    try {
      await api('reservation_status', { body: { id, status: 'esperando' } });
      toast('Pulsa enviar en WhatsApp. La reserva queda esperando a que el cliente confirme.');
      setTimeout(render, 400);
      poll();
    } catch (err) { toast(err.message, 'err'); }
  }

  /** Acepta la reserva y el servidor manda el WhatsApp con la API de Meta (o lo reenvía si ya esperaba). */
  async function autoSend(id, btn) {
    const r = S.res[id];
    if (btn) busy(btn, true, 'Enviando…');
    try {
      const x = r && r.status === 'esperando'
        ? await api('reservation_whatsapp', { body: { id } })
        : await api('reservation_status', { body: { id, status: 'esperando' } });
      S.res[id] = x;
      if (x.wa_sent) toast('WhatsApp enviado. La reserva queda esperando a que el cliente confirme.');
      else toast(`No se pudo enviar el WhatsApp: ${x.wa_error || 'error desconocido'}. Abre la reserva y pulsa «Enviar a mano».`, 'err');
      closeSheet();
      render();
      poll();
    } catch (err) { toast(err.message, 'err'); if (btn) busy(btn, false); }
  }

  async function editReservation(r, date) {
    const isNew = !r;
    r = r || { name: '', phone: '', email: '', date: date || todayISO(), time: '', people: 1, notes: '', service_id: 0, service: '', duration: 0 };
    if (!S.svc) { try { S.svc = await api('admin_services'); } catch (e) { S.svc = { categories: [] }; } }
    const all = S.svc.categories.flatMap((c) => c.services);
    // Si el servicio de la reserva ya no está en la lista (borrado), se ofrece igualmente para no perderlo
    const gone = r.service_id && !all.some((d) => d.id === r.service_id) ? `<option value="${r.service_id}" data-min="${r.duration}" selected>${esc(r.service)} (ya no está en la lista)</option>` : '';
    const ownMin = r.service_id && all.some((d) => d.id === r.service_id && d.duration !== r.duration) ? r.duration : '';
    openSheet(isNew ? 'Nueva cita' : 'Editar cita', `
      <form class="form" id="res-edit" novalidate>
        <label>Nombre <input name="name" value="${esc(r.name)}" autocomplete="off" required></label>
        <label>Teléfono <input name="phone" type="tel" value="${esc(r.phone)}" required></label>
        <label>Servicio
          <select name="service_id">
            <option value="0" data-min="0">Sin elegir (${minText(defaultMin())})</option>
            ${S.svc.categories.filter((c) => c.services.length).map((c) => `<optgroup label="${esc(c.name)}">${c.services.map((d) => `<option value="${d.id}" data-min="${d.duration}" ${d.id === r.service_id ? 'selected' : ''}>${esc(d.name)} · ${minText(d.duration)}</option>`).join('')}</optgroup>`).join('')}
            ${gone}
          </select>
        </label>
        <div class="row">
          <label>Día <input type="date" name="date" value="${esc(r.date)}" required></label>
          <label>Hora <input type="time" name="time" value="${esc(r.time)}" step="300" required list="slot-list"></label>
        </div>
        <datalist id="slot-list"></datalist>
        <div class="field slot-box" hidden><span id="slot-t"></span><div class="slot-chips" id="slot-chips"></div></div>
        <p class="help" id="slot-info"></p>
        <div class="row">
          <label>Personas <input type="number" name="people" min="1" max="50" inputmode="numeric" value="${r.people}" required></label>
          <label>Duración (min)<input type="number" name="duration" min="5" max="600" step="5" inputmode="numeric" value="${ownMin}" placeholder=""></label>
        </div>
        <label>Email <span class="help">(opcional)</span><input name="email" type="email" value="${esc(r.email)}"></label>
        <label>Notas <textarea name="notes" rows="2">${esc(r.notes)}</textarea></label>
        <div class="actions"><button class="btn btn-main" type="submit">${isNew ? 'Guardar cita' : 'Guardar cambios'}</button></div>
      </form>`, (body) => {
      const f = $('#res-edit', body);
      const info = $('#slot-info', body);
      // La duración sale del servicio; se puede cambiar a mano (por ejemplo, dos servicios seguidos)
      const svcMin = () => Number(f.service_id.selectedOptions[0].dataset.min) || defaultMin();
      const minutes = () => Number(f.duration.value) || svcMin();
      const loadSlots = async () => {
        f.duration.placeholder = String(svcMin());
        try {
          const d = await api(`slots_admin&date=${f.date.value}&minutes=${minutes()}${isNew ? '' : '&exclude=' + r.id}`);
          $('#slot-list', body).innerHTML = d.slots.map((s) => `<option value="${s.time}">${s.left} libres</option>`).join('');
          // Horas libres como botones: tocar una la pone en «Hora»
          const free = d.slots.filter((s) => s.left > 0);
          $('.slot-box', body).hidden = !free.length;
          $('#slot-t', body).textContent = `Horas libres para ${minText(d.minutes)} (toca una)`;
          $('#slot-chips', body).innerHTML = free.map((s) => `<button type="button" class="slot-chip${s.time === f.time.value ? ' sel' : ''}" data-slot="${s.time}">${s.time}</button>`).join('');
          info.textContent = free.length ? '' : (d.reason || 'Ese día no queda ningún hueco libre.');
        } catch (e) { info.textContent = ''; }
      };
      $('#slot-chips', body).addEventListener('click', (e) => {
        const b = e.target.closest('[data-slot]');
        if (!b) return;
        f.time.value = b.dataset.slot;
        $$('.slot-chip', body).forEach((x) => x.classList.toggle('sel', x === b));
      });
      f.time.addEventListener('change', () => $$('.slot-chip', body).forEach((x) => x.classList.toggle('sel', x.dataset.slot === f.time.value)));
      f.date.addEventListener('change', loadSlots);
      f.service_id.addEventListener('change', () => { f.duration.value = ''; loadSlots(); });
      f.duration.addEventListener('change', loadSlots);
      loadSlots();
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = $('button[type=submit]', f);
        const data = Object.fromEntries(new FormData(f));
        if (!isNew) data.id = r.id;
        busy(btn, true);
        try {
          await api('reservation_save', { body: data });
          closeSheet();
          toast(isNew ? 'Cita apuntada' : 'Cambios guardados');
          render();
        } catch (err) { toast(err.message, 'err'); busy(btn, false); }
      });
    });
  }

  /* ---------- SERVICIOS ---------- */
  async function viewServicios() {
    S.svc = await api('admin_services');
    const canEdit = can('servicios');
    if (canEdit) setFab('Nuevo servicio', () => editService(null));
    const cats = S.svc.categories;
    const packsCard = packsBlock(canEdit);
    if (!cats.length) {
      return packsCard + (canEdit ? `<div class="empty"><p>Aún no hay servicios. Empieza creando una sección, por ejemplo «Manos».</p><button class="btn btn-main btn-sm" data-cat-new>Crear sección</button></div>` : '<div class="empty"><p>Aún no hay servicios.</p></div>');
    }
    const off = cats.reduce((a, c) => a + c.services.filter((d) => !d.available).length, 0);
    let html = !canEdit ? '<p class="help" style="color:var(--granito);margin:0 0 8px">Solo lectura: tu usuario no puede cambiar los servicios.</p>' : '';
    html += `<div class="toolbar">${canEdit ? '<button class="btn btn-quiet btn-sm" data-cat-new>Nueva sección</button>' : ''}${S.base ? `<a class="btn btn-quiet btn-sm" href="${esc(S.base)}/#servicios" target="_blank" rel="noopener">Ver en la web</a>` : ''}</div>`;
    html += `<label class="search">${ICON.search}<input type="search" id="serv-q" placeholder="Buscar servicio" autocomplete="off" enterkeyhint="search"></label>`;
    if (cats.length > 1) html += `<div class="mcat-all"><button class="link-btn" type="button" data-cats-all>${cats.every((c) => catOpen().has(c.id)) ? 'Cerrar todas' : 'Abrir todas'}</button></div>`;
    if (cats.length > 1) html += `<nav class="jump" aria-label="Ir a una sección">${cats.map((c) => `<a href="#mcat-${c.id}" data-jump="${c.id}">${esc(c.name)} <span>${c.services.length}</span></a>`).join('')}</nav>`;
    if (off) html += `<p class="alert">${off} ${off === 1 ? 'servicio está desactivado' : 'servicios están desactivados'}: no ${off === 1 ? 'sale' : 'salen'} en la web ni se ${off === 1 ? 'puede' : 'pueden'} reservar.</p>`;
    html += '<p class="help" style="margin:4px 0 0;color:var(--granito)">Toca un servicio para cambiarlo. El interruptor de la derecha lo enciende o lo apaga: apagado no sale en la web ni se puede reservar.</p>';
    for (const c of cats) {
      const coff = c.services.filter((d) => !d.available).length;
      html += `<details class="mcat" id="mcat-${c.id}" data-cat-id="${c.id}"${catOpen().has(c.id) ? ' open' : ''}>
        <summary class="mcat-head"><h2>${esc(c.name)}</h2><span class="mcat-n">${c.services.length} ${c.services.length === 1 ? 'servicio' : 'servicios'}${coff ? ` · <b>${coff} desactivado${coff === 1 ? '' : 's'}</b>` : ''}</span><span class="mcat-chev" aria-hidden="true"></span></summary>
        <div class="mcat-body">${canEdit ? `<div class="mcat-tools"><button class="link-btn" data-cat="${c.id}">Editar sección</button></div>` : ''}`;
      if (!c.services.length) html += '<p class="help" style="color:var(--granito)">Sin servicios todavía.</p>';
      for (const d of c.services) {
        html += `<div class="mdish${d.available ? '' : ' off'}" data-name="${esc((d.name + ' ' + d.description).toLowerCase())}">
          ${d.photo ? `<img class="md-img" src="${esc(d.photo)}" alt="" loading="lazy">` : `<div class="md-img">${ICON.plate}</div>`}
          <button class="md-body" type="button" data-service="${d.id}">
            <p class="md-name">${esc(d.name)}</p>
            <p class="md-meta">${d.from ? 'desde ' : ''}${euro(d.price)} · ${minText(d.duration)}${d.featured ? ' · destacado' : ''}${d.available ? '' : ' · <span class="md-off">desactivado</span>'}</p>
          </button>
          <label class="sw" title="Se puede reservar"><input type="checkbox" data-toggle="${d.id}" ${d.available ? 'checked' : ''} ${canEdit ? '' : 'disabled'} aria-label="${esc(d.name)}: se puede reservar"><span></span></label>
        </div>`;
      }
      html += '</div></details>';
    }
    // Packs y la lista de la web, después de los servicios (lo que más se usa va primero)
    return html + '<div class="packs-zone">' + packsCard + '</div>';
  }

  /* Secciones de servicios abiertas (se recuerdan en este móvil) */
  let catOpenSet = null;
  function catOpen() {
    if (!catOpenSet) {
      // La primera vez se ven todas las secciones abiertas: así se entiende enseguida qué hay dentro
      let saved = null;
      try { saved = localStorage.getItem('serviciosAbiertos'); } catch (e) { /* sin almacenamiento */ }
      try { catOpenSet = new Set(saved === null ? (S.svc ? S.svc.categories.map((c) => c.id) : []) : JSON.parse(saved)); } catch (e) { catOpenSet = new Set(); }
    }
    return catOpenSet;
  }
  function catOpenSave() {
    try { localStorage.setItem('serviciosAbiertos', JSON.stringify([...catOpen()])); } catch (e) { /* sin almacenamiento */ }
  }
  document.addEventListener('toggle', (e) => {
    const d = e.target;
    if (!d.matches || !d.matches('details.mcat') || d.dataset.searching) return;
    const id = Number(d.dataset.catId);
    if (d.open) catOpen().add(id); else catOpen().delete(id);
    catOpenSave();
    const all = $('[data-cats-all]');
    if (all) all.textContent = $$('details.mcat').every((x) => x.open) ? 'Cerrar todas' : 'Abrir todas';
  }, true);

  /* ---------- Packs y bonos, y lista de servicios en la web ---------- */
  const DM_DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const DM_DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  function dmDaysText(days) {
    const d = [...days].sort((a, b) => a - b);
    if (d.length === 7) return 'todos los días';
    if (!d.length) return 'ningún día';
    if (d.length >= 3 && d[d.length - 1] - d[0] === d.length - 1) return `de ${DM_DAY_NAMES[d[0] - 1]} a ${DM_DAY_NAMES[d[d.length - 1] - 1]}`;
    const n = d.map((x) => DM_DAY_NAMES[x - 1]);
    return n.length > 1 ? n.slice(0, -1).join(', ') + ' y ' + n[n.length - 1] : n[0];
  }
  function packsBlock(canEdit) {
    const ms = S.svc.packs || [];
    const card = (m, i) => {
      const nd = m.groups.reduce((a, c) => a + c.services.length, 0);
      const sum = nd ? m.groups.filter((c) => c.services.length).map((c) => `<b>${esc(c.name)}</b>: ${c.services.map((d) => esc(d.name) + (d.extra > 0 ? ` <span class="dm-sup">+${euro(d.extra)}</span>` : '')).join(', ')}`).join('<br>') : 'Todavía no tiene servicios.';
      return `<section class="card dm-card${m.on ? ' is-on' : ''}">
        <div class="dm-head">
          <div><h2>${esc(m.title || 'Pack')}</h2>
          <p class="dm-meta">${m.price > 0 ? euro(m.price) : 'Sin precio'} · ${esc(dmDaysText(m.days))} · <b>${m.on ? 'sale en la web' : 'no sale en la web'}</b></p></div>
          <label class="sw" title="Mostrar en la web"><input type="checkbox" data-pack-toggle="${esc(m.id)}" ${m.on ? 'checked' : ''} ${canEdit ? '' : 'disabled'} aria-label="Mostrar «${esc(m.title)}» en la web"><span></span></label>
        </div>
        <p class="dm-sum">${sum}</p>
        ${canEdit ? `<div class="actions-row"><button class="btn btn-line btn-sm" type="button" data-pack-edit="${esc(m.id)}">Editar pack</button>${ms.length > 1 ? `<button class="icon-mini" type="button" data-pack-move="${esc(m.id)}:-1" aria-label="Subir pack" ${i === 0 ? 'disabled' : ''}>↑</button><button class="icon-mini" type="button" data-pack-move="${esc(m.id)}:1" aria-label="Bajar pack" ${i === ms.length - 1 ? 'disabled' : ''}>↓</button>` : ''}</div>` : ''}
      </section>`;
    };
    return `<div class="sec-t"><h2>Packs y bonos</h2>${canEdit ? '<button class="link-btn" type="button" data-pack-new>+ Nuevo pack</button>' : ''}</div>
      ${ms.length ? ms.map(card).join('') : '<p class="help" style="color:var(--granito);margin:0 0 12px">Sin packs. Crea uno: manos y pies, pack novia, bono de 5 manicuras…</p>'}
      ${ms.length ? `<label class="switch-row dm-btn-row">Botón «Ver packs» en la portada <span class="sw"><input type="checkbox" data-packs-btn ${S.svc.packs_button ? 'checked' : ''} ${canEdit ? '' : 'disabled'}><span></span></span></label>` : ''}
      <section class="card dm-card servicios-card${S.svc.servicios_on ? ' is-on' : ''}">
        <div class="dm-head">
          <div><h2>Lista de servicios y precios</h2><p class="dm-meta"><b>${S.svc.servicios_on ? 'sale en la web' : 'no sale en la web'}</b></p></div>
          <label class="sw" title="Mostrar los servicios en la web"><input type="checkbox" data-servicios-toggle ${S.svc.servicios_on ? 'checked' : ''} ${canEdit ? '' : 'disabled'} aria-label="Mostrar la lista de servicios en la web"><span></span></label>
        </div>
        <p class="dm-sum">${S.svc.servicios_on ? 'Se pueden reservar los servicios activados.' : 'No sale en la web, pero los servicios activados se siguen pudiendo elegir al reservar.'}</p>
      </section>`;
  }
  async function togglePack(input) {
    const id = input.dataset.packToggle;
    try {
      await api('pack_toggle', { body: { id, on: input.checked } });
      toast(input.checked ? 'El pack ya sale en la web' : 'Pack quitado de la web');
      render();
    } catch (err) {
      input.checked = !input.checked;
      toast(err.message, 'err');
      if (/precio|servicio|días/i.test(err.message)) editPackSheet(S.svc.packs.find((m) => m.id === id));
    }
  }
  async function toggleServicios(input) {
    try {
      await api('servicios_toggle', { body: { on: input.checked } });
      toast(input.checked ? 'Los servicios vuelven a salir en la web' : 'Lista de servicios quitada de la web');
      render();
    } catch (err) { input.checked = !input.checked; toast(err.message, 'err'); }
  }
  function editPackSheet(orig) {
    const isNew = !orig;
    const m = isNew
      ? { id: '', on: false, title: (S.svc.packs || []).length ? '' : 'Pack manos y pies', price: 0, days: [1, 2, 3, 4, 5, 6, 7], note: '', groups: [{ name: 'Manos', services: [] }, { name: 'Pies', services: [] }] }
      : JSON.parse(JSON.stringify(orig));
    m.groups.forEach((c) => { if (!c.services.length) c.services.push({ name: '', extra: 0, desc: '' }); });
    const money = (v) => (v ? Number(v).toFixed(2).replace('.', ',').replace(',00', '') : '');
    const groupHtml = (c, i) => `
      <div class="dm-course" data-ci="${i}">
        <div class="dm-course-head">
          <input class="dm-cname" value="${esc(c.name)}" placeholder="Manos, Pies, Extra…" maxlength="60" aria-label="Nombre del apartado">
          <button type="button" class="icon-mini" data-c-up="${i}" aria-label="Subir apartado" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="icon-mini" data-c-down="${i}" aria-label="Bajar apartado" ${i === m.groups.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" class="icon-mini danger" data-c-del="${i}" aria-label="Quitar apartado">×</button>
        </div>
        ${c.services.map((d, j) => `
          <div class="dm-dish" data-di="${j}" data-photo="${esc(d.photo || '')}" data-photo-url="${esc(d.photo_url || '')}">
            <label class="dm-ph" title="${d.photo ? 'Cambiar foto' : 'Añadir foto'}">${d.photo_url ? `<img src="${esc(d.photo_url)}" alt="">` : ICON.plate}<input type="file" accept="image/*" data-d-photo="${i}:${j}" aria-label="Foto de ${esc(d.name || 'este servicio')}"></label>${d.photo ? `<button type="button" class="dm-ph-del" data-d-nophoto="${i}:${j}" aria-label="Quitar foto">×</button>` : ''}
            <input class="dm-dname" value="${esc(d.name)}" placeholder="Servicio incluido" maxlength="120" aria-label="Servicio">
            <label class="dm-extra"><span>+€</span><input class="dm-dextra" inputmode="decimal" value="${money(d.extra)}" placeholder="0" aria-label="Suplemento en euros"></label>
            <button type="button" class="icon-mini danger" data-d-del="${i}:${j}" aria-label="Quitar servicio">×</button>
            <input class="dm-ddesc" value="${esc(d.desc)}" placeholder="Descripción (opcional)" maxlength="200" aria-label="Descripción">
          </div>`).join('')}
        <button type="button" class="link-btn" data-d-add="${i}">+ Añadir servicio</button>
      </div>`;
    openSheet(isNew ? 'Nuevo pack' : 'Editar pack', `
      <form class="form" id="dm-edit" novalidate>
        <label class="switch-row">Mostrar en la web <span class="sw"><input type="checkbox" name="on" ${m.on ? 'checked' : ''}><span></span></span></label>
        <div class="row">
          <label>Nombre <input name="title" value="${esc(m.title)}" maxlength="80" placeholder="Pack novia, Manos y pies…" required></label>
          <label>Precio (€) <input name="price" inputmode="decimal" value="${money(m.price)}" placeholder="45"></label>
        </div>
        <div class="field">Días que se ofrece
          <div class="chips dm-days">${DM_DAYS.map((d, i) => `<label><input type="checkbox" name="days" value="${i + 1}" ${m.days.includes(i + 1) ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div>
        </div>
        <div class="field">Qué incluye
          <p class="help">Cada apartado es una parte del pack (Manos, Pies…). Si en un apartado pones varios servicios, el cliente elige uno. Si alguno cuesta más, pon el suplemento en «+€» y en la web saldrá «+5 €».</p>
          <div id="dm-groups"></div>
          <button type="button" class="btn btn-quiet btn-sm" data-c-add>+ Añadir apartado</button>
        </div>
        <label>Nota <span class="help">(opcional)</span><textarea name="note" rows="2" maxlength="300" placeholder="Válido un mes desde la compra. Nail art aparte.">${esc(m.note)}</textarea></label>
        <div class="actions"><button class="btn btn-main" type="submit">${isNew ? 'Crear pack' : 'Guardar pack'}</button>${isNew ? '' : '<button type="button" class="btn btn-danger" data-pack-del>Borrar pack</button>'}</div>
      </form>`, (body) => {
      const f = $('#dm-edit', body);
      const box = $('#dm-groups', body);
      const read = () => {
        m.groups = $$('.dm-course', box).map((cb) => ({
          name: $('.dm-cname', cb).value,
          services: $$('.dm-dish', cb).map((db) => ({
            name: $('.dm-dname', db).value, extra: $('.dm-dextra', db).value.replace(',', '.') || 0, desc: $('.dm-ddesc', db).value,
            photo: db.dataset.photo, photo_url: db.dataset.photoUrl,
          })),
        }));
      };
      const draw = (focus) => {
        box.innerHTML = m.groups.map(groupHtml).join('') || '<p class="help">Sin apartados. Añade uno.</p>';
        if (focus) { const el = $(focus, box); if (el) el.focus(); }
      };
      draw();
      body.addEventListener('click', (e) => {
        const t = e.target;
        let k;
        if (t.closest('[data-c-add]')) { read(); m.groups.push({ name: '', services: [{ name: '', extra: 0, desc: '' }] }); draw(`[data-ci="${m.groups.length - 1}"] .dm-cname`); return; }
        if ((k = t.closest('[data-d-nophoto]'))) { e.preventDefault(); read(); const [i, j] = k.dataset.dNophoto.split(':').map(Number); Object.assign(m.groups[i].services[j], { photo: '', photo_url: '' }); draw(); return; }
        if ((k = t.closest('[data-d-add]'))) { read(); const i = +k.dataset.dAdd; m.groups[i].services.push({ name: '', extra: 0, desc: '' }); draw(`[data-ci="${i}"] [data-di="${m.groups[i].services.length - 1}"] .dm-dname`); return; }
        if ((k = t.closest('[data-d-del]'))) { read(); const [i, j] = k.dataset.dDel.split(':').map(Number); m.groups[i].services.splice(j, 1); draw(); return; }
        if ((k = t.closest('[data-c-del]'))) {
          read(); const i = +k.dataset.cDel;
          if (m.groups[i].services.some((d) => d.name.trim()) && !confirm(`¿Quitar el apartado «${m.groups[i].name || 'sin nombre'}» y sus servicios?`)) return;
          m.groups.splice(i, 1); draw(); return;
        }
        if ((k = t.closest('[data-c-up]')) || (k = t.closest('[data-c-down]'))) {
          read(); const up = 'cUp' in k.dataset; const i = +(up ? k.dataset.cUp : k.dataset.cDown); const j = up ? i - 1 : i + 1;
          [m.groups[i], m.groups[j]] = [m.groups[j], m.groups[i]]; draw(); return;
        }
      });
      body.addEventListener('change', async (e) => {
        const inp = e.target.closest('[data-d-photo]');
        if (!inp || !inp.files[0]) return;
        const [i, j] = inp.dataset.dPhoto.split(':').map(Number);
        const lab = inp.closest('.dm-ph');
        lab.classList.add('is-busy');
        try {
          const fd = new FormData();
          fd.append('photo', await shrinkImage(inp.files[0], 1200), 'foto.jpg');
          const r = await api('pack_photo', { form: fd });
          read();
          Object.assign(m.groups[i].services[j], r);
          draw();
          toast('Foto añadida. Pulsa «Guardar pack» para que se quede.');
        } catch (err) { lab.classList.remove('is-busy'); toast(err.message, 'err'); }
      });
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        read();
        const btn = $('button[type=submit]', f);
        busy(btn, true);
        try {
          const saved = await api('pack_save', { body: {
            id: m.id, on: f.on.checked, title: f.title.value, price: f.price.value, note: f.note.value,
            days: $$('input[name=days]:checked', f).map((x) => Number(x.value)), groups: m.groups,
          } });
          closeSheet();
          toast(saved.on ? 'Pack guardado y en la web' : 'Pack guardado (no sale en la web)');
          render();
        } catch (err) { toast(err.message, 'err'); busy(btn, false); }
      });
      const del = $('[data-pack-del]', body);
      if (del) del.addEventListener('click', async () => {
        if (!confirm(`¿Borrar el pack «${orig.title}»? Si solo no lo ofreces estos días, mejor usa el interruptor.`)) return;
        try { await api('pack_delete', { body: { id: m.id } }); closeSheet(); toast('Pack borrado'); render(); }
        catch (err) { toast(err.message, 'err'); }
      });
    });
  }


  function findService(id) {
    for (const c of S.svc.categories) for (const d of c.services) if (d.id === id) return d;
    return null;
  }

  async function shrinkImage(file, max = 1600) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * scale);
      c.height = Math.round(bmp.height * scale);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
      return blob || file;
    } catch (e) {
      return file;
    }
  }

  function editService(d) {
    const isNew = !d;
    const cats = S.svc.categories;
    if (!cats.length) { editCategory(null); return; }
    d = d || { name: '', description: '', price: '', from: false, duration: 60, category_id: cats[0].id, photo: '', available: true, featured: false };
    let newPhoto = null;
    let removePhoto = false;
    openSheet(isNew ? 'Nuevo servicio' : 'Editar servicio', `
      <form class="form" id="service-edit" novalidate>
        <div class="photo">
          ${d.photo ? `<img src="${esc(d.photo)}" alt="" id="ph-img">` : `<div class="ph" id="ph-img">${ICON.plate}</div>`}
          <div class="photo-btns">
            <span class="btn btn-quiet btn-sm file-btn">${d.photo ? 'Cambiar foto' : 'Añadir foto'}<input type="file" accept="image/*" id="ph-in" aria-label="Foto del servicio"></span>
            ${d.photo ? '<button type="button" class="link-btn" id="ph-del">Quitar foto</button>' : ''}
          </div>
        </div>
        <label>Nombre <input name="name" value="${esc(d.name)}" required maxlength="120"></label>
        <div class="row">
          <label>Precio (€) <input name="price" inputmode="decimal" value="${d.price === '' ? '' : Number(d.price).toFixed(2).replace('.', ',')}" placeholder="25" required></label>
          <label>Duración (min) <input name="duration" type="number" min="5" max="600" step="5" inputmode="numeric" value="${d.duration}" required></label>
        </div>
        <label>Sección <select name="category_id">${cats.map((c) => `<option value="${c.id}" ${c.id === d.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
        <p class="help" style="margin-top:-6px">La duración es lo que ocupa el puesto: con 60, quien reserva a las 10:00 lo tiene hasta las 11:00.</p>
        <label>Descripción <span class="help">(opcional)</span><textarea name="description" rows="2" maxlength="400">${esc(d.description)}</textarea></label>
        <label class="switch-row">Precio «desde» (varía según el diseño) <span class="sw"><input type="checkbox" name="from" ${d.from ? 'checked' : ''}><span></span></span></label>
        <label class="switch-row">Se puede reservar (sale en la web) <span class="sw"><input type="checkbox" name="available" ${d.available ? 'checked' : ''}><span></span></span></label>
        <label class="switch-row">Destacado («Lo más pedido») <span class="sw"><input type="checkbox" name="featured" ${d.featured ? 'checked' : ''}><span></span></span></label>
        <div class="actions">
          <button class="btn btn-main" type="submit">${isNew ? 'Añadir servicio' : 'Guardar cambios'}</button>
          ${isNew ? '' : `<div class="actions-row"><button type="button" class="btn btn-quiet btn-sm" data-move="-1">Subir</button><button type="button" class="btn btn-quiet btn-sm" data-move="1">Bajar</button></div>
          <button type="button" class="btn btn-danger" data-del>Borrar servicio</button>`}
        </div>
      </form>`, (body) => {
      const f = $('#service-edit', body);
      $('#ph-in', body).addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        newPhoto = await shrinkImage(file);
        removePhoto = false;
        const img = document.createElement('img');
        img.id = 'ph-img';
        img.alt = '';
        img.src = URL.createObjectURL(newPhoto);
        $('#ph-img', body).replaceWith(img);
      });
      const del = $('#ph-del', body);
      if (del) del.addEventListener('click', () => {
        removePhoto = true;
        newPhoto = null;
        $('#ph-img', body).outerHTML = `<div class="ph" id="ph-img">${ICON.plate}</div>`;
        del.remove();
      });
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = $('button[type=submit]', f);
        const fd = new FormData();
        if (!isNew) fd.append('id', d.id);
        fd.append('name', f.name.value);
        fd.append('price', f.price.value);
        fd.append('category_id', f.category_id.value);
        fd.append('description', f.description.value);
        fd.append('duration', f.duration.value);
        fd.append('from', f.from.checked ? '1' : '0');
        fd.append('available', f.available.checked ? '1' : '0');
        fd.append('featured', f.featured.checked ? '1' : '0');
        if (removePhoto) fd.append('remove_photo', '1');
        if (newPhoto) fd.append('photo', newPhoto, 'foto.jpg');
        busy(btn, true, newPhoto ? 'Subiendo foto…' : 'Guardando…');
        try {
          await api('service_save', { form: fd });
          closeSheet();
          toast(isNew ? 'Servicio añadido' : 'Servicio guardado');
          render();
        } catch (err) { toast(err.message, 'err'); busy(btn, false); }
      });
      $$('[data-move]', body).forEach((b) => b.addEventListener('click', async () => {
        await api('service_move', { body: { id: d.id, dir: Number(b.dataset.move) } });
        toast(b.dataset.move === '-1' ? 'Servicio subido' : 'Servicio bajado');
        render();
      }));
      const dd = $('[data-del]', body);
      if (dd) dd.addEventListener('click', async () => {
        if (!confirm(`¿Borrar el servicio «${d.name}»? Si solo no lo haces por un tiempo, mejor usa el interruptor «Se puede reservar». Las reservas que ya lo tienen no cambian.`)) return;
        try { await api('service_delete', { body: { id: d.id } }); closeSheet(); toast('Servicio borrado'); render(); }
        catch (err) { toast(err.message, 'err'); }
      });
    });
  }

  function editCategory(c) {
    const isNew = !c;
    openSheet(isNew ? 'Nueva sección' : 'Editar sección', `
      <form class="form" id="cat-edit" novalidate>
        <label>Nombre de la sección <input name="name" value="${esc(c ? c.name : '')}" placeholder="Manos, Pies, Uñas, Extras…" required maxlength="80"></label>
        <div class="actions">
          <button class="btn btn-main" type="submit">${isNew ? 'Crear sección' : 'Guardar'}</button>
          ${isNew ? '' : `<div class="actions-row"><button type="button" class="btn btn-quiet btn-sm" data-move="-1">Subir</button><button type="button" class="btn btn-quiet btn-sm" data-move="1">Bajar</button></div>
          <button type="button" class="btn btn-danger" data-del>Borrar sección</button>`}
        </div>
      </form>`, (body) => {
      const f = $('#cat-edit', body);
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = $('button[type=submit]', f);
        busy(btn, true);
        try {
          await api('category_save', { body: { id: c ? c.id : 0, name: f.name.value } });
          closeSheet();
          toast(isNew ? 'Sección creada' : 'Sección guardada');
          render();
        } catch (err) { toast(err.message, 'err'); busy(btn, false); }
      });
      $$('[data-move]', body).forEach((b) => b.addEventListener('click', async () => {
        await api('category_move', { body: { id: c.id, dir: Number(b.dataset.move) } });
        render();
      }));
      const dd = $('[data-del]', body);
      if (dd) dd.addEventListener('click', async () => {
        if (!confirm(`¿Borrar la sección «${c.name}»?`)) return;
        try { await api('category_delete', { body: { id: c.id } }); closeSheet(); toast('Sección borrada'); render(); }
        catch (err) { toast(err.message, 'err'); }
      });
    });
  }

  /* ---------- AJUSTES ---------- */
  const SAVED_SECRET = 'Guardada (escribe otra para cambiarla)';
  async function viewAjustes() {
    const s = await loadSettings(true);
    const field = (k, label, type = 'text', extra = '') =>
      `<label>${label}<input name="${k}" type="${type}" value="${esc(s[k])}" ${extra}></label>`;
    // unit: lo que se pinta a la derecha de la casilla (min, días, personas…)
    const num = (k, label, help, min = 0, unit = '') =>
      `<label>${label}<span class="unit"><input name="${k}" type="number" inputmode="numeric" min="${min}" value="${esc(s[k])}">${unit ? `<i>${unit}</i>` : ''}</span>${help ? `<span class="help">${help}</span>` : ''}</label>`;
    // Editor de horario por días. pre: prefijo de los data-* (por si hiciera falta otro horario en la misma pantalla)
    const hoursEditor = (pre, src, openLabel) => Object.keys(WEEK).map((d) => {
      const r = (src || {})[d] || [];
      const id = pre + d;
      const rng = (i) => `<div class="range"><input type="time" data-h="${id}-${i}-0" value="${esc(r[i] ? r[i][0] : '')}" aria-label="${WEEK[d]} franja ${i + 1} desde"> a <input type="time" data-h="${id}-${i}-1" value="${esc(r[i] ? r[i][1] : '')}" aria-label="${WEEK[d]} franja ${i + 1} hasta"></div>`;
      return `<div class="hours-row"><span>${WEEK[d]}</span><div class="hours-day">
        <label class="switch-row" style="padding:6px 10px">${openLabel} <span class="sw"><input type="checkbox" data-open="${id}" ${r.length ? 'checked' : ''}><span></span></span></label>
        <div data-ranges="${id}" ${r.length ? '' : 'hidden'}>${rng(0)}${rng(1)}<p class="help">Deja vacía la segunda franja si solo hay un turno.</p></div>
      </div></div>`;
    }).join('');
    const hoursRows = hoursEditor('', s.hours, 'Abre');

    const sec = (id, title, desc, inner) => `<details class="card set" data-set="${id}" ${S.openSets.has(id) ? 'open' : ''}>
        <summary><span>${title}<small>${desc}</small></span></summary>
        <div class="set-body">${inner}</div></details>`;
    const photos = (s.web_photos || []).map((p) => `<div class="wph">
        <img src="${esc(p.url)}" alt="" loading="lazy">
        <p>${esc(p.label)}${p.custom ? '<small>Foto propia</small>' : '<small>Foto de ejemplo</small>'}</p>
        <div class="wph-btns">
          <span class="btn btn-quiet btn-sm file-btn">Cambiar<input type="file" accept="image/*" data-wph="${p.key}" aria-label="Cambiar foto: ${esc(p.label)}"></span>
          ${p.custom ? `<button type="button" class="link-btn" data-wph-reset="${p.key}">Quitar</button>` : ''}
        </div></div>`).join('');

    const admin = can('ajustes');
    // Cada pestaña agrupa secciones plegables. Los ajustes técnicos que casi nunca se tocan van dentro de «Avanzado».
    const local = !admin ? '' : `
      ${sec('datos', 'Nombre y presentación', 'Cómo se llama tu salón y cómo lo presentas', `
        <form class="form" data-form="datos" novalidate>
          ${field('name', 'Nombre del salón', 'text', 'required maxlength="60"')}
          ${field('tagline', 'Frase corta', 'text', 'placeholder="Manicura rusa, uñas de gel y nail art"')}
          <p class="help">Sale debajo del nombre, en la portada de la web.</p>
          <label>Presentación <textarea name="description" rows="4" maxlength="1000">${esc(s.description)}</textarea><span class="help">Sale en grande en la sección «Nosotros». Cuenta qué técnicas trabajáis, qué productos usáis y qué hace especial al salón.</span></label>
          <button class="btn btn-main" type="submit">Guardar</button>
        </form>`)}
      ${sec('contacto', 'Contacto y dirección', 'Dónde estáis y cómo os pueden llamar o escribir', `
        <form class="form" data-form="contacto" novalidate>
          ${field('address', 'Calle y número', 'text', 'placeholder="Rúa do Príncipe, 10"')}
          ${field('city', 'Código postal y ciudad', 'text', 'placeholder="36202 Vigo"')}
          ${field('maps_url', 'Enlace de Google Maps', 'url', 'placeholder="https://maps.app.goo.gl/…"')}
          <p class="help">Opcional. Si lo dejas vacío, el botón «Cómo llegar» busca la dirección.</p>
          <div class="row">${field('phone', 'Teléfono', 'tel')}${field('whatsapp', 'WhatsApp', 'tel')}</div>
          ${field('email', 'Email de contacto', 'email')}
          <p class="help">Es el que ven los clientes en la web.</p>
          ${field('notify_email', 'Email donde te avisamos de las reservas', 'email')}
          <p class="help">Puede ser el mismo. Aquí llega un email con cada reserva nueva.</p>
          <button class="btn btn-main" type="submit">Guardar</button>
        </form>`)}
      ${sec('redes', 'Redes sociales y reseñas', 'Instagram, Facebook, TikTok y dónde dejan reseñas', `
        <form class="form" data-form="redes" novalidate>
          ${field('instagram', 'Instagram', 'text', 'placeholder="@tusalon" autocapitalize="off"')}
          ${field('facebook', 'Facebook', 'text', 'placeholder="tusalon o enlace" autocapitalize="off"')}
          ${field('tiktok', 'TikTok', 'text', 'placeholder="@tusalon" autocapitalize="off"')}
          ${field('tripadvisor', 'Reseñas (Google, Treatwell, Booksy…)', 'url', 'placeholder="https://g.page/r/…/review" autocapitalize="off"')}
          <p class="help">Puedes poner el usuario o el enlace completo. Las que dejes vacías no salen en la web.</p>
          <button class="btn btn-main" type="submit">Guardar</button>
        </form>`)}
      ${sec('fotos', 'Fotos de la web', 'Portada, «Nosotros» y trabajos', `
        <p class="help">Usa fotos horizontales para la portada. Se recortan solas para encajar.</p>
        <div class="wph-grid">${photos}</div>`)}
      ${sec('textos', 'Otros textos de la web', 'Frases destacadas y título del pie', `
        <form class="form" data-form="textos" novalidate>
          ${field('ribbon', 'Frases destacadas', 'text', 'placeholder="Manicura rusa, Uñas de gel, Nail art"')}
          <p class="help">Separadas por comas. Si lo dejas vacío, se usa la frase corta.</p>
          ${field('footer_title', 'Título grande del pie', 'text', 'placeholder="¿Te hacemos las uñas?" maxlength="40"')}
          <p class="help">Estos textos solo se ven si el diseño de la web los usa.</p>
          <button class="btn btn-main" type="submit">Guardar</button>
        </form>`)}
      ${sec('legal', 'Datos legales', 'Titular y NIF para el aviso legal', `
        <form class="form" data-form="legal" novalidate>
          ${field('owner_name', 'Titular (nombre o empresa)')}
          ${field('owner_nif', 'NIF / CIF')}
          ${field('owner_registry', 'Datos del Registro Mercantil (solo sociedades)', 'text', 'placeholder="Inscrita en el R. M. de Pontevedra, tomo…, folio…, hoja…"')}
          <p class="help">Salen en el aviso legal y al pie de los emails. Para que el aviso legal esté completo hace falta también el email de contacto.</p>
          <button class="btn btn-main" type="submit">Guardar</button>
        </form>`)}`;

    const horarios = !admin ? '' : `
      ${sec('horario', 'Horario de apertura', 'Qué días abres y a qué horas', `
        <form class="form" data-form="horario" novalidate>
          <p class="help">Es el horario que sale en la web y en el que se puede reservar. Para cerrar un día suelto (festivo, vacaciones), hazlo desde la Agenda.</p>
          ${hoursRows}
          <button class="btn btn-main" type="submit">Guardar horario</button>
        </form>`)}`;

    const reservas = !admin ? '' : `
      ${sec('reservas', 'Puestos y huecos', 'Cuántas personas atendéis a la vez y cada cuánto se reserva', `
        <form class="form" data-form="reservas" novalidate>
          <p class="help">Cada reserva llega a Peticiones y la confirmas enviando un WhatsApp al cliente. Cada cita ocupa un puesto lo que dura su servicio (lo pones en cada servicio, en la pestaña Servicios).</p>
          ${num('capacity', 'Puestos', 'Cuántas personas podéis atender a la vez: manicuristas o mesas de trabajo.', 1, 'puestos')}
          ${num('default_minutes', 'Duración si no eligen servicio', 'Para las reservas sin servicio («Aún no lo sé») y las que apuntas a mano sin servicio.', 5, 'min')}
          ${num('slot_minutes', 'Intervalo entre reservas', 'Cada cuánto se ofrece una hora para reservar. Con 15: 10:00, 10:15, 10:30…', 5, 'min')}
          ${num('max_people', 'Personas por reserva online', 'Cada una ocupa un puesto. Para grupos más grandes (novias, cumpleaños) tendrán que escribirte.', 1, 'personas')}
          <button class="btn btn-main" type="submit">Guardar</button>
        </form>`)}
      ${sec('reservas-cuando', 'Cuándo se puede reservar', 'Con cuánta antelación y hasta qué hora', `
        <form class="form" data-form="reservas-cuando" novalidate>
          ${num('days_ahead', 'Reservar como mucho con', 'Hasta cuántos días en el futuro se puede reservar.', 1, 'días')}
          ${num('min_notice', 'Aviso mínimo', 'Con 120, nadie puede reservar para dentro de menos de 2 horas.', 0, 'min')}
          ${num('last_before', 'Última cita antes del cierre', 'El servicio siempre tiene que acabar antes de cerrar. Con 30 y cierre a las 20:30, además, la última cita empieza como tarde a las 20:00.', 0, 'min')}
          <button class="btn btn-main" type="submit">Guardar</button>
        </form>`)}
      ${sec('politicas', 'Normas para el cliente', 'Retrasos, cancelaciones y otras normas', `
        <form class="form" data-form="politicas" novalidate>
          <p class="help">Salen en la web y el cliente tiene que aceptarlas al reservar. Cancelar es siempre gratis para el cliente.</p>
          ${num('late_minutes', 'Cortesía si llegan tarde', 'Cuánto tiempo guardas la cita si el cliente se retrasa.', 0, 'min')}
          <label>Otras normas <textarea name="policies" rows="5">${esc(s.policies)}</textarea><span class="help">Una por línea: «Título: texto». Ej.: «Retirada: si vienes con gel de otro salón, reserva también la retirada».</span></label>
          <button class="btn btn-main" type="submit">Guardar</button>
        </form>`)}`;

    // Secciones de «Avanzado». Para añadir un ajuste técnico nuevo, añade aquí otra sec(…).
    const avanzado = !admin ? '' : [
      sec('correo', 'Envío de emails (SMTP)', s.smtp_on ? `Activado con ${esc(s.smtp_user)}` : 'Enviar los emails desde tu Gmail', `
        <form class="form" data-form="correo" novalidate>
          <p class="help">Los emails a los clientes (activar la cuenta, confirmación de la reserva…) salen por defecto del correo del hosting y a veces acaban en spam. Con tu Gmail llegan mejor.</p>
          <ol class="steps">
            <li>Entra en <a href="https://myaccount.google.com/security" target="_blank" rel="noopener">myaccount.google.com/security</a> y activa la <b>verificación en 2 pasos</b>.</li>
            <li>Abre <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener">myaccount.google.com/apppasswords</a>, escribe un nombre (por ejemplo «Web salón») y pulsa <b>Crear</b>.</li>
            <li>Copia la contraseña de 16 letras que te da Google y pégala aquí abajo.</li>
          </ol>
          ${field('smtp_user', 'Tu dirección de Gmail', 'email', 'placeholder="tusalon@gmail.com" autocapitalize="off" autocomplete="off"')}
          <label>Contraseña de aplicación <input name="smtp_pass" type="password" autocomplete="new-password" placeholder="${s.smtp_pass_set ? SAVED_SECRET : 'abcd efgh ijkl mnop'}"><span class="help">No es la contraseña de tu cuenta de Google. Se guarda cifrada.</span></label>
          <label class="switch-row">Enviar los emails con esta cuenta <span class="sw"><input type="checkbox" name="smtp_on" ${s.smtp_on ? 'checked' : ''}><span></span></span></label>
          <details class="adv"><summary>Otro proveedor de correo</summary>
            <div class="row">
              ${field('smtp_host', 'Servidor', 'text', 'placeholder="smtp.gmail.com" autocapitalize="off"')}
              <label>Puerto <select name="smtp_port"><option value="465" ${Number(s.smtp_port) === 465 ? 'selected' : ''}>465 (SSL)</option><option value="587" ${Number(s.smtp_port) === 587 ? 'selected' : ''}>587 (TLS)</option></select></label>
            </div>
            <p class="help">Para el correo de Hostinger: smtp.hostinger.com, puerto 465, con tu email y su contraseña.</p>
          </details>
          ${s.smtp_error ? `<p class="err-box">Último error al enviar: ${esc(s.smtp_error)}</p>` : ''}
          <button class="btn btn-main" type="submit">Guardar</button>
          <button class="btn btn-line" type="button" data-mail-test>Enviar un email de prueba</button>
          <p class="help">La prueba llega a «${esc(s.notify_email || s.email || 'el email de avisos')}». Gmail permite unos 500 emails al día, de sobra para un salón.</p>
        </form>`),
      sec('whatsapp', 'WhatsApp automático', s.wa_on || s.wa_remind_on ? [s.wa_on && 'sale solo al aceptar', s.wa_remind_on && 'recordatorios activados'].filter(Boolean).join(' · ').replace(/^./, (c) => c.toUpperCase()) : 'Confirmaciones y recordatorios sin abrir el móvil', `
        <form class="form" data-form="whatsapp" novalidate>
          <p class="help">Con la API oficial de WhatsApp Business (Meta), al aceptar una reserva el mensaje con el enlace para confirmar le llega al cliente solo. Si algo falla, puedes seguir mandándolo a mano.</p>
          <ol class="steps">
            <li>En <a href="https://business.facebook.com" target="_blank" rel="noopener">business.facebook.com</a> crea una app de WhatsApp y registra el número del salón.</li>
            <li>Crea una plantilla de categoría <b>Utilidad</b> con 5 variables: {{1}} nombre, {{2}} día, {{3}} hora, {{4}} servicio y {{5}} enlace. Por ejemplo: «Hola {{1}}, tenemos hueco el {{2}} a las {{3}} ({{4}}). Confírmala aquí: {{5}}». Espera a que Meta la apruebe.</li>
            <li>Copia el <b>identificador del número de teléfono</b> y un <b>token de acceso permanente</b> (de un usuario del sistema) y pégalos aquí.</li>
          </ol>
          ${field('wa_phone_id', 'Identificador del número de teléfono', 'text', 'placeholder="123456789012345" inputmode="numeric" autocomplete="off"')}
          <label>Token de acceso de Meta <input name="wa_token" type="password" autocomplete="new-password" data-saved="Guardado (escribe otro para cambiarlo)" placeholder="${s.wa_token_set ? 'Guardado (escribe otro para cambiarlo)' : 'EAAG…'}"><span class="help">Se guarda cifrado y nunca vuelve a la app.</span></label>
          <div class="row">
            ${field('wa_template', 'Nombre de la plantilla', 'text', 'placeholder="confirmar_reserva" autocapitalize="off" autocomplete="off"')}
            ${field('wa_template_lang', 'Idioma de la plantilla', 'text', 'placeholder="es" autocapitalize="off" autocomplete="off"')}
          </div>
          <p class="help">Si la plantilla está traducida en Meta a inglés (en) o portugués (pt_PT), al cliente le llega en su idioma. Sin plantilla, Meta solo entrega el mensaje si el cliente te ha escrito en las últimas 24 horas.</p>
          <label class="switch-row">Enviar el WhatsApp automáticamente al aceptar <span class="sw"><input type="checkbox" name="wa_on" ${s.wa_on ? 'checked' : ''}><span></span></span></label>
          <p><b>Recordatorios</b></p>
          <p class="help">A las reservas confirmadas les llega un WhatsApp 24 horas y 12 horas antes con el día, la hora y las personas. Si confirman con menos tiempo, solo les llega el que aún toque.</p>
          ${field('wa_remind_template', 'Plantilla del recordatorio', 'text', 'placeholder="recordatorio_reserva" autocapitalize="off" autocomplete="off"')}
          <p class="help">Otra plantilla de Utilidad con 4 variables: {{1}} nombre, {{2}} día, {{3}} hora y {{4}} personas. Por ejemplo: «Hola {{1}}, te recordamos tu reserva el {{2}} a las {{3}} ({{4}}). ¡Te esperamos!». Usa el mismo idioma que la de confirmar.</p>
          <label class="switch-row">Enviar recordatorios 24 h y 12 h antes <span class="sw"><input type="checkbox" name="wa_remind_on" ${s.wa_remind_on ? 'checked' : ''}><span></span></span></label>
          <details class="adv"><summary>Tarea programada (opcional)</summary>
            <p class="help">Los recordatorios salen solos mientras alguien visita la web o usa la app. Para que salgan a su hora aunque no entre nadie, crea en Hostinger (Avanzado → Cron Jobs) una tarea cada 10 minutos que abra esta dirección:</p>
            <label>Dirección para el cron <input type="text" readonly value="${esc(s.cron_url || '')}"></label>
          </details>
          ${s.wa_error ? `<p class="err-box">Último error al enviar: ${esc(s.wa_error)}</p>` : ''}
          <button class="btn btn-main" type="submit">Guardar</button>
          <button class="btn btn-line" type="button" data-wa-test>Enviar un WhatsApp de prueba</button>
          <p class="help">La prueba llega al WhatsApp del salón (${esc(s.whatsapp || s.phone || 'el de Contacto')}).</p>
        </form>`),
      sec('traductor', 'Traductor automático', s.tr_provider === 'google' ? 'Google Translate, con clave' : 'MyMemory, gratis y sin cuenta', `
        <form class="form" data-form="traductor" novalidate>
          <label>Traductor <select name="tr_provider">
            <option value="mymemory" ${s.tr_provider !== 'google' ? 'selected' : ''}>MyMemory (gratis, sin cuenta)</option>
            <option value="google" ${s.tr_provider === 'google' ? 'selected' : ''}>Google Translate (con clave)</option>
          </select></label>
          <p class="help">MyMemory es gratis y traduce unos 50.000 caracteres al día, de sobra para la lista de servicios. Google traduce mejor y regala 500.000 caracteres al mes: crea una clave de «Cloud Translation API» en console.cloud.google.com.</p>
          <label>Clave de Google <input name="tr_google_key" type="password" autocomplete="off" placeholder="${s.tr_google_key_set ? SAVED_SECRET : 'AIza…'}"><span class="help">Solo hace falta con Google Translate. Se guarda cifrada.</span></label>
          <button class="btn btn-main" type="submit">Guardar</button>
        </form>`),
      sec('seo', 'Google y estadísticas', 'Descripción en Google, Search Console, Analytics y Píxel de Meta', `
        <form class="form" data-form="seo" novalidate>
          <label>Descripción para Google <textarea name="seo_description" rows="3" maxlength="300" placeholder="Salón de manicura y pedicura en Vigo: semipermanente, uñas de gel y nail art. Reserva cita online.">${esc(s.seo_description)}</textarea><span class="help">Es el texto que sale en Google debajo del nombre. Unas 150 letras, con los servicios principales y la ciudad.</span></label>
          ${field('gsc_verify', 'Código de Google Search Console', 'text', 'placeholder="Pega aquí el código o la etiqueta meta" autocapitalize="off"')}
          ${field('ga_id', 'Google Analytics 4 (ID de medición)', 'text', 'placeholder="G-AB12CD34EF" autocapitalize="characters"')}
          ${field('gtm_id', 'Google Tag Manager (opcional)', 'text', 'placeholder="GTM-AB12CD3" autocapitalize="characters"')}
          ${field('pixel_id', 'Píxel de Meta: Facebook e Instagram (opcional)', 'text', 'placeholder="123456789012345" inputmode="numeric"')}
          <p class="help">Analytics y los píxeles solo se activan para los visitantes que acepten las cookies. El mapa del sitio para Google está en ${esc(S.base.replace(/^https?:\/\//, ''))}/sitemap.xml</p>
          <button class="btn btn-main" type="submit">Guardar</button>
        </form>`),
    ].join('');

    const tecnica = !admin ? '' : `
      ${sec('idiomas', 'Idiomas de la web', 'Español, inglés, portugués y gallego; los servicios se traducen solos', `
        <form class="form" data-form="idiomas" novalidate>
          <p class="help">La web sale con banderas para cambiar de idioma. Los textos de la web ya están traducidos; los servicios, los packs, la frase corta, la presentación y las políticas se traducen solas cada vez que las cambias. El nombre, la dirección, el teléfono y los emails no se traducen.</p>
          ${[['en', 'Inglés'], ['pt', 'Portugués'], ['gl', 'Gallego']].map(([k, n]) => `<label class="switch-row">${n} <span class="sw"><input type="checkbox" name="langs" value="${k}" ${(s.langs || []).includes(k) ? 'checked' : ''}><span></span></span></label>`).join('')}
          <div id="tr-status" class="tr-status"><p class="help">Comprobando traducciones…</p></div>
          <div class="actions-row"><button class="btn btn-line btn-sm" type="button" data-tr-run>Traducir ahora</button><button class="btn btn-quiet btn-sm" type="button" data-tr-list>Revisar traducciones</button></div>
          <button class="btn btn-main" type="submit">Guardar</button>
        </form>`)}
      <details class="set-adv" data-adv ${S.advOpen ? 'open' : ''}>
        <summary><span>Avanzado<small>Correo, WhatsApp automático, traductor, Google y estadísticas. Se configura una vez y no hace falta volver a tocarlo.</small></span></summary>
        <div class="set-adv-body">${avanzado}</div>
      </details>`;

    const cuenta = `
      ${!admin ? '<p class="set-intro">Tu usuario no puede cambiar los ajustes de la web. Aquí tienes los avisos y tu contraseña.</p>' : ''}
      ${isAdmin() ? sec('usuarios', 'Usuarios', 'Quién entra en la app y qué puede hacer', `
        <p class="help">Todos los usuarios pueden ver las reservas y los servicios. Tú decides quién puede cambiar cada cosa.</p>
        <div id="users-box"><p class="help">Cargando…</p></div>
        <button class="btn btn-line btn-sm" type="button" data-user-new>Nuevo usuario</button>`) : ''}
      ${isAdmin() ? sec('clientes', 'Clientes con cuenta', 'Cuentas creadas en la web y peticiones para borrar datos', `
        <div id="cus-box"><p class="help">Cargando…</p></div>`) : ''}
      ${sec('avisos', 'Avisos de reservas', 'Nuevas, confirmadas y canceladas, en este móvil', `
        <p class="help">Con la app abierta (o en segundo plano) revisa cada 30 segundos si hay reservas nuevas, reservas que el cliente ha confirmado y reservas que el cliente ha cancelado, y te avisa con una notificación. Además, cada reserva llega por email a «${esc(s.notify_email || s.email || 'el email de avisos')}».</p>
        <button class="btn btn-line btn-sm" type="button" data-notif>Activar avisos en este móvil</button>`)}
      ${sec('password', 'Contraseña', 'Cambiar la contraseña y el email para recuperarla', `
        <form class="form" data-form="password" novalidate>
          <label>Contraseña actual <input name="current" type="password" autocomplete="current-password"></label>
          <label>Nueva contraseña <input name="new" type="password" autocomplete="new-password" minlength="8"><span class="help">Mínimo 8 caracteres</span></label>
          <button class="btn btn-dark" type="submit">Cambiar contraseña</button>
        </form>
        <form class="form" data-form="me_email" novalidate>
          <label>Tu email para recuperar la contraseña <input name="email" type="email" autocomplete="email" value="${esc((S.me && S.me.email) || '')}" placeholder="tu@email.com"><span class="help">Si olvidas la contraseña, en la pantalla de entrada pulsa «¿Has olvidado la contraseña?» y te llegará aquí un enlace para cambiarla.${isAdmin() ? ' Si lo dejas vacío, llegará al email de avisos del salón.' : ' Si lo dejas vacío, tendrá que cambiártela el administrador.'}</span></label>
          <button class="btn btn-line" type="submit">Guardar email</button>
        </form>`)}
      <section class="card">
        <h2>Sesión</h2>
        <p>Conectado a ${esc(S.base.replace(/^https?:\/\//, ''))} como ${esc(LS.get('user') || '')}${S.me ? (S.me.role === 'admin' ? ' (administrador)' : ' (empleado)') : ''}.</p>
        <div class="actions-row">
          <a class="btn btn-quiet btn-sm" href="${esc(S.base)}/" target="_blank" rel="noopener">Ver la web</a>
          <button class="btn btn-danger btn-sm" type="button" data-logout>Cerrar sesión</button>
        </div>
      </section>`;

    const panes = [
      ['local', 'Salón', 'Información del salón', 'Lo que ven tus clientes en la web: nombre, contacto, fotos y datos legales.', local],
      ['horarios', 'Horario', 'Horario', 'Qué días y a qué horas abres.', horarios],
      ['reservas', 'Reservas', 'Reglas de reservas', 'Cómo y cuándo pueden reservar tus clientes por internet.', reservas],
      ['tecnica', 'Técnico', 'Configuración técnica', 'Idiomas de la web y, en «Avanzado», el correo, el WhatsApp automático, el traductor y Google.', tecnica],
      ['cuenta', 'Cuenta', 'Tu cuenta y tu equipo', 'Usuarios, avisos en el móvil, contraseña y sesión.', cuenta],
    ].filter((p) => p[4].trim());
    if (!panes.some((p) => p[0] === S.setTab)) S.setTab = panes[0][0];

    return `
      <label class="search">${ICON.search}<input type="search" id="set-q" placeholder="Buscar en ajustes (horario, Gmail, fotos…)" autocomplete="off" enterkeyhint="search"></label>
      <p class="set-none" hidden>No hay ningún ajuste con esa palabra.</p>
      <div class="set-tabs" role="tablist" aria-label="Categorías de ajustes">
        ${panes.map(([id, short]) => `<button type="button" role="tab" id="set-tab-${id}" aria-controls="set-pane-${id}" aria-selected="${S.setTab === id}" data-set-tab="${id}">${short}</button>`).join('')}
      </div>
      ${panes.map(([id, , title, intro, html]) => `<div class="set-pane" role="tabpanel" id="set-pane-${id}" aria-labelledby="set-tab-${id}" data-pane="${id}" ${S.setTab === id ? '' : 'hidden'}>
        <h2 class="set-pane-h">${title}</h2>
        <p class="set-intro">${intro}${admin && id !== 'cuenta' ? ' Lo que cambies se ve en la web al momento.' : ''}</p>
        ${html}
      </div>`).join('')}`;
  }

  afterRender.ajustes = (view) => {
    view.classList.remove('is-searching');
    $$('[data-set-tab]', view).forEach((b) => b.addEventListener('click', () => {
      const q = $('#set-q', view);
      if (q && q.value) { q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); }
      S.setTab = b.dataset.setTab;
      $$('[data-set-tab]', view).forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      $$('.set-pane', view).forEach((p) => { p.hidden = p.dataset.pane !== S.setTab; });
      window.scrollTo({ top: 0 });
    }));
    const adv = $('[data-adv]', view);
    if (adv) adv.addEventListener('toggle', () => { if (!view.classList.contains('is-searching')) S.advOpen = adv.open; });
    $$('details[data-set]', view).forEach((d) => d.addEventListener('toggle', () => {
      // Lo que abre el buscador no se recuerda: al borrar la búsqueda vuelve como estaba
      const sq = $('#set-q', view);
      if (sq && sq.value.trim()) return;
      if (d.open) S.openSets.add(d.dataset.set); else S.openSets.delete(d.dataset.set);
    }));
    $$('[data-wph]', view).forEach((inp) => inp.addEventListener('change', async () => {
      const file = inp.files[0];
      if (!file) return;
      const box = inp.closest('.wph');
      box.classList.add('is-busy');
      try {
        const fd = new FormData();
        fd.append('key', inp.dataset.wph);
        fd.append('photo', await shrinkImage(file, 2200), 'foto.jpg');
        await api('web_photo', { form: fd });
        toast('Foto cambiada. Ya se ve en la web.');
        render();
      } catch (err) { toast(err.message, 'err'); box.classList.remove('is-busy'); }
    }));
    $$('[data-wph-reset]', view).forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('¿Quitar tu foto y volver a la de ejemplo?')) return;
      try { await api('web_photo_reset', { body: { key: b.dataset.wphReset } }); toast('Foto quitada'); render(); }
      catch (err) { toast(err.message, 'err'); }
    }));
    $$('[data-open]', view).forEach((cb) => cb.addEventListener('change', () => {
      const box = $(`[data-ranges="${cb.dataset.open}"]`, view);
      box.hidden = !cb.checked;
      if (cb.checked && !$(`[data-h="${cb.dataset.open}-0-0"]`, view).value) {
        $(`[data-h="${cb.dataset.open}-0-0"]`, view).value = '13:00';
        $(`[data-h="${cb.dataset.open}-0-1"]`, view).value = '16:00';
      }
    }));
    $$('form[data-form]', view).forEach((f) => f.addEventListener('submit', (e) => saveSettingsForm(e, f)));
    if ($('#users-box', view)) loadUsers();
    if ($('#cus-box', view)) loadCustomers();
    if ($('#tr-status', view)) loadTrStatus();
    const trRun = $('[data-tr-run]', view);
    if (trRun) trRun.addEventListener('click', async () => {
      busy(trRun, true, 'Traduciendo…');
      try { const r = await api('tr_run', { body: {} }); toast(r.done ? `${r.done} textos traducidos` : (r.error ? 'El traductor no responde ahora' : 'Ya estaba todo traducido')); renderTrStatus(r); }
      catch (err) { toast(err.message, 'err'); }
      busy(trRun, false);
    });
    const trList = $('[data-tr-list]', view);
    if (trList) trList.addEventListener('click', () => reviewTranslations());
    const un = $('[data-user-new]', view);
    if (un) un.addEventListener('click', () => editUser(null));
    const mt = $('[data-mail-test]', view);
    if (mt) mt.addEventListener('click', async () => {
      const f = mt.closest('form');
      if (f.dataset.dirty) { toast('Guarda primero los cambios', 'err'); return; }
      busy(mt, true, 'Enviando…');
      try { const r = await api('mail_test', { body: {} }); toast(`Email de prueba enviado a ${r.to}. Míralo (y la carpeta de spam).`); }
      catch (err) { toast(err.message, 'err'); render(); }
      busy(mt, false);
    });
    const wt = $('[data-wa-test]', view);
    if (wt) wt.addEventListener('click', async () => {
      if (wt.closest('form').dataset.dirty) { toast('Guarda primero los cambios', 'err'); return; }
      busy(wt, true, 'Enviando…');
      try { const r = await api('whatsapp_test', { body: {} }); toast(`WhatsApp de prueba enviado al +${r.to}.`); }
      catch (err) { toast(err.message, 'err'); }
      busy(wt, false);
    });
    $('[data-notif]', view).addEventListener('click', async () => {
      const ok = await askNotifications();
      toast(ok ? 'Avisos activados' : 'El móvil no ha dado permiso. Actívalo en Ajustes del móvil → Notificaciones.', ok ? '' : 'err');
    });
    $('[data-logout]', view).addEventListener('click', async () => {
      if (!confirm('¿Cerrar sesión en este móvil?')) return;
      try { await api('logout', { body: {} }); } catch (e) { /* da igual */ }
      logoutLocal();
    });
  };

  /* ---------- Idiomas: estado y revisión de las traducciones ---------- */
  const LANG_NAME = { en: 'Inglés', pt: 'Portugués', gl: 'Gallego' };
  function renderTrStatus(st) {
    const box = $('#tr-status');
    if (!box) return;
    const ls = Object.keys(st.langs || {});
    box.innerHTML = !ls.length ? '<p class="help">Solo está activado el español.</p>'
      : `<p class="help">Textos del salón traducidos (servicios, frase, presentación, políticas):</p>`
        + ls.map((l) => `<div class="tr-bar"><span>${LANG_NAME[l]}</span><i style="--p:${st.total ? Math.round(st.langs[l] / st.total * 100) : 100}%"></i><b>${st.langs[l]} de ${st.total}</b></div>`).join('')
        + (st.error ? `<p class="err-box">Último aviso del traductor: ${esc(st.error)}</p>` : '')
        + (ls.some((l) => st.langs[l] < st.total) && !st.error ? '<p class="help">Lo que falta se traduce solo en unos minutos mientras la app está abierta. Hasta entonces sale en español.</p>' : '');
  }
  async function loadTrStatus() {
    try { renderTrStatus(await api('tr_status')); } catch (e) { /* sin estado */ }
  }
  async function reviewTranslations() {
    let d;
    try { d = await api('tr_list'); } catch (err) { toast(err.message, 'err'); return; }
    if (!d.items.length) { toast('Todavía no hay textos que traducir'); return; }
    openSheet('Revisar traducciones', `
      <p class="help">Corrige lo que quieras: lo que cambies a mano ya no se vuelve a traducir solo. Se guarda al salir de cada casilla.</p>
      <label class="search">${ICON.search}<input type="search" id="tr-q" placeholder="Buscar texto" autocomplete="off"></label>
      <div class="tr-list">${d.items.map((it) => `<div class="tr-item" data-src="${esc(norm(it.src))}">
        <p class="tr-src"><small>${esc(it.where)}</small>${esc(it.src)}</p>
        ${d.langs.map((l) => `<label>${LANG_NAME[l]}${it.tr[l] && it.tr[l].manual ? ' <span class="tag">corregida</span>' : ''}
          <textarea rows="${it.src.length > 60 ? 3 : 1}" data-h="${it.h}" data-l="${l}" placeholder="Sin traducir todavía">${esc(it.tr[l] ? it.tr[l].txt : '')}</textarea></label>`).join('')}
      </div>`).join('')}</div>`, (body) => {
      $('#tr-q', body).addEventListener('input', (e) => {
        const q = norm(e.target.value.trim());
        $$('.tr-item', body).forEach((it) => { it.hidden = !!q && !it.dataset.src.includes(q); });
      });
      $$('textarea[data-h]', body).forEach((ta) => {
        ta.dataset.orig = ta.value;
        ta.addEventListener('change', async () => {
          try {
            await api('tr_save', { body: { h: ta.dataset.h, lang: ta.dataset.l, txt: ta.value } });
            ta.dataset.orig = ta.value;
            toast('Traducción guardada');
          } catch (err) { toast(err.message, 'err'); ta.value = ta.dataset.orig; }
        });
      });
    });
  }

  /* ---------- Usuarios (solo administradores) ---------- */
  const PERM_LABEL = { reservas: 'Reservas', servicios: 'Servicios', ajustes: 'Ajustes' };
  /* ---------- Clientes con cuenta y peticiones de borrado ---------- */
  async function loadCustomers() {
    const box = $('#cus-box');
    if (!box) return;
    try {
      const d = await api('customers');
      S.customers = d.customers;
      const fd = (v) => (v ? fmtShort(v.slice(0, 10)) : '');
      let html = '';
      if (d.erase.length) {
        html += `<div class="er-box"><p class="er-t">Piden borrar sus datos (${d.erase.length})</p>
          <p class="help">Escribieron su teléfono en la web. Mándales el enlace por WhatsApp: cuando lo abran y pulsen «Borrar mis datos», se borra todo (cuenta y reservas).</p>
          ${d.erase.map((r) => `<div class="er-row"><span><b>${esc(r.phone)}</b><small>${esc(fd(r.created_at))} ${esc(r.created_at.slice(11, 16))}</small></span>
            <span class="er-btns"><button class="btn btn-sm b-wa" type="button" data-er-wa="${r.id}">${ICON.wa}<span>Enviar enlace</span></button><button class="btn btn-sm btn-quiet" type="button" data-er-no="${r.id}">Descartar</button></span></div>`).join('')}
        </div>`;
      }
      html += `<p class="help">${d.customers.length} ${d.customers.length === 1 ? 'cuenta' : 'cuentas'}. Cada cliente puede borrar su cuenta desde «Mi cuenta» o pedir el borrado de todos sus datos en la web (Políticas → Borrar todos mis datos).</p>`;
      if (d.customers.length > 5) html += `<label class="search">${ICON.search}<input type="search" id="cus-q" placeholder="Buscar por nombre, email o teléfono" autocomplete="off"></label>`;
      html += '<div class="cus-list">' + (d.customers.map((c) => `<button type="button" class="user-row cus-row" data-cus="${c.id}" data-q="${esc((c.name + ' ' + c.email + ' ' + c.phone).toLowerCase())}">
          <span class="user-main"><b>${esc(c.name)}</b><small>${esc(c.email)}${c.phone ? ' · ' + esc(c.phone) : ''}</small></span>
          <span class="user-tags"><i class="tag">${c.reservations} ${c.reservations === 1 ? 'reserva' : 'reservas'}</i>${c.verified ? '' : '<i class="tag tag-ver">sin activar</i>'}</span>
        </button>`).join('') || '<p class="help">Todavía nadie ha creado una cuenta.</p>') + '</div>';
      box.innerHTML = html;
      const q = $('#cus-q', box);
      if (q) q.addEventListener('input', () => { const v = q.value.trim().toLowerCase(); $$('.cus-row', box).forEach((b) => { b.hidden = !!v && !b.dataset.q.includes(v); }); });
      $$('[data-cus]', box).forEach((b) => b.addEventListener('click', () => showCustomer(S.customers.find((c) => c.id === Number(b.dataset.cus)))));
      $$('[data-er-wa]', box).forEach((b) => b.addEventListener('click', async () => {
        busy(b, true, 'Preparando…');
        try {
          // Se prepara el enlace y el botón pasa a abrir WhatsApp con el mensaje listo
          const r = await api('erase_whatsapp', { body: { id: Number(b.dataset.erWa) } });
          const a = document.createElement('a');
          a.className = 'btn btn-sm b-wa';
          a.href = r.wa_url; a.target = '_blank'; a.rel = 'noopener';
          a.innerHTML = `${ICON.wa}<span>Abrir WhatsApp</span>`;
          a.addEventListener('click', () => setTimeout(loadCustomers, 800));
          b.replaceWith(a);
        } catch (err) { toast(err.message, 'err'); busy(b, false); }
      }));
      $$('[data-er-no]', box).forEach((b) => b.addEventListener('click', async () => {
        if (!confirm('¿Descartar esta petición? No se borrará nada.')) return;
        try { await api('erase_dismiss', { body: { id: Number(b.dataset.erNo) } }); toast('Petición descartada'); loadCustomers(); }
        catch (err) { toast(err.message, 'err'); }
      }));
    } catch (err) { box.innerHTML = `<p class="err-box">${esc(err.message)}</p>`; }
  }

  function showCustomer(c) {
    const fd = (v) => (v ? `${fmtShort(v.slice(0, 10))} ${v.slice(11, 16)}` : '—');
    openSheet(c.name, `
      <dl class="detail">
        <dt>Email</dt><dd>${esc(c.email)}${c.verified ? '' : ' <span class="help">(sin activar)</span>'}</dd>
        ${c.phone ? `<dt>Teléfono</dt><dd>${esc(c.phone)}</dd>` : ''}
        <dt>Cuenta creada</dt><dd>${esc(fd(c.created_at))}</dd>
        <dt>Última vez que entró</dt><dd>${esc(fd(c.last_login))}</dd>
        <dt>Reservas</dt><dd>${c.reservations}${c.last_reservation ? ` · la última para el ${esc(fmtShort(c.last_reservation))}` : ''}</dd>
      </dl>
      <div class="actions">
        <div class="actions-row">
          ${c.phone ? `<a class="btn btn-line" href="${esc(telHref(c.phone))}">Llamar</a><a class="btn btn-line" href="${esc(waHref(c.phone))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
          <a class="btn btn-line" href="mailto:${esc(c.email)}">Email</a>
        </div>
        <button class="btn btn-danger" type="button" data-cus-del>Borrar cuenta</button>
        <p class="help">Borra la cuenta (nombre, email, teléfono y contraseña). Sus reservas se quedan, pero ya no estarán unidas a ninguna cuenta.</p>
      </div>`, (body) => {
      $('[data-cus-del]', body).addEventListener('click', async () => {
        if (!confirm(`¿Borrar la cuenta de ${c.name}? No se puede deshacer.`)) return;
        try { await api('customer_delete', { body: { id: c.id } }); closeSheet(); toast('Cuenta borrada'); loadCustomers(); }
        catch (err) { toast(err.message, 'err'); }
      });
    });
  }

  async function loadUsers() {
    const box = $('#users-box');
    try {
      const d = await api('users');
      S.users = d.users;
      S.permInfo = d.perms;
      box.innerHTML = d.users.map((u) => `<button type="button" class="user-row${u.active ? '' : ' off'}" data-user="${u.id}">
          <span class="user-main"><b>${esc(u.name || u.username)}</b><small>${esc(u.username)}${u.active ? '' : ' · desactivado'}</small></span>
          <span class="user-tags">${u.role === 'admin' ? '<i class="tag tag-admin">Administrador</i>' : (u.perms.length ? u.perms.map((p) => `<i class="tag">${PERM_LABEL[p] || p}</i>`).join('') : '<i class="tag tag-ver">Solo ver</i>')}</span>
        </button>`).join('');
      $$('[data-user]', box).forEach((b) => b.addEventListener('click', () => editUser(S.users.find((u) => u.id === Number(b.dataset.user)))));
    } catch (err) { box.innerHTML = `<p class="err-box">${esc(err.message)}</p>`; }
  }

  function editUser(u) {
    const isNew = !u;
    u = u || { username: '', name: '', role: 'staff', perms: [], active: true, email: '' };
    const info = S.permInfo || { reservas: 'Gestionar reservas', servicios: 'Cambiar los servicios', ajustes: 'Cambiar los ajustes' };
    const self = S.me && u.id === S.me.id;
    openSheet(isNew ? 'Nuevo usuario' : 'Editar usuario', `
      <form class="form" id="user-edit" novalidate>
        <div class="row">
          <label>Usuario <input name="username" value="${esc(u.username)}" autocapitalize="off" autocomplete="off" required placeholder="manicurista1"></label>
          <label>Nombre <input name="name" value="${esc(u.name)}" placeholder="Laura"></label>
        </div>
        <label>Email <input name="email" type="email" value="${esc(u.email || '')}" autocomplete="off" placeholder="laura@correo.com"><span class="help">Opcional. Sirve para que pueda recuperar la contraseña él solo.</span></label>
        <label>${isNew ? 'Contraseña' : 'Nueva contraseña'} <input name="password" type="password" autocomplete="new-password" minlength="8" placeholder="${isNew ? 'Mínimo 8 caracteres' : 'Déjala vacía para no cambiarla'}"></label>
        <div class="field">Tipo de usuario
          <div class="chips">
            <label><input type="radio" name="role" value="staff" ${u.role !== 'admin' ? 'checked' : ''}><span>Empleado</span></label>
            <label><input type="radio" name="role" value="admin" ${u.role === 'admin' ? 'checked' : ''}><span>Administrador</span></label>
          </div>
          <span class="help">El administrador puede hacerlo todo, también crear y cambiar usuarios.</span>
        </div>
        <div class="field" id="perm-box" ${u.role === 'admin' ? 'hidden' : ''}>Qué puede hacer (ver las reservas y los servicios pueden todos)
          ${Object.entries(info).map(([k, label]) => `<label class="switch-row">${esc(label)} <span class="sw"><input type="checkbox" name="perms" value="${k}" ${u.perms.includes(k) ? 'checked' : ''}><span></span></span></label>`).join('')}
        </div>
        <label class="switch-row">Usuario activo (puede entrar) <span class="sw"><input type="checkbox" name="active" ${u.active ? 'checked' : ''} ${self ? 'disabled' : ''}><span></span></span></label>
        <div class="actions">
          <button class="btn btn-main" type="submit">${isNew ? 'Crear usuario' : 'Guardar cambios'}</button>
          ${!isNew && !self ? '<button type="button" class="btn btn-danger" data-del>Borrar usuario</button>' : ''}
        </div>
      </form>`, (body) => {
      const f = $('#user-edit', body);
      $$('[name=role]', f).forEach((r) => r.addEventListener('change', () => { $('#perm-box', f).hidden = f.role.value === 'admin'; }));
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = $('button[type=submit]', f);
        const data = { id: u.id || 0, username: f.username.value, name: f.name.value, email: f.email.value.trim(), password: f.password.value, role: f.role.value,
          perms: $$('[name=perms]:checked', f).map((x) => x.value), active: self ? true : f.active.checked };
        busy(btn, true);
        try {
          const saved = await api('user_save', { body: data });
          if (self) { S.me = saved; LS.set('me', JSON.stringify(saved)); }
          closeSheet();
          toast(isNew ? 'Usuario creado. Ya puede entrar en la app con su usuario y contraseña.' : 'Usuario guardado');
          loadUsers();
        } catch (err) { toast(err.message, 'err'); busy(btn, false); }
      });
      const del = $('[data-del]', f);
      if (del) del.addEventListener('click', async () => {
        if (!confirm(`¿Borrar el usuario «${u.username}»? Dejará de poder entrar en la app.`)) return;
        try { await api('user_delete', { body: { id: u.id } }); closeSheet(); toast('Usuario borrado'); loadUsers(); }
        catch (err) { toast(err.message, 'err'); }
      });
    });
  }

  async function saveSettingsForm(e, f) {
    e.preventDefault();
    const btn = $('button[type=submit]', f);
    const kind = f.dataset.form;
    let body = {};
    if (kind === 'password') {
      busy(btn, true);
      try {
        await api('password', { body: { current: f.current.value, new: f.new.value } });
        f.reset();
        toast('Contraseña cambiada');
      } catch (err) { toast(err.message, 'err'); }
      busy(btn, false);
      return;
    }
    if (kind === 'me_email') {
      busy(btn, true);
      try {
        S.me = await api('me_email', { body: { email: f.email.value.trim() } });
        LS.set('me', JSON.stringify(S.me));
        toast(S.me.email ? 'Email guardado' : 'Email quitado');
      } catch (err) { toast(err.message, 'err'); }
      busy(btn, false);
      return;
    }
    if (kind === 'horario') {
      const pre = '';
      const hours = {};
      for (let d = 1; d <= 7; d++) {
        hours[d] = [];
        if (!$(`[data-open="${pre}${d}"]`, f).checked) continue;
        for (let i = 0; i < 2; i++) {
          const a = $(`[data-h="${pre}${d}-${i}-0"]`, f).value;
          const b = $(`[data-h="${pre}${d}-${i}-1"]`, f).value;
          if (!a && !b) continue;
          if (!a || !b || b <= a) { toast(`Revisa el horario del ${WEEK[d].toLowerCase()}: la hora de cierre tiene que ser posterior a la de apertura.`, 'err'); return; }
          hours[d].push([a, b]);
        }
      }
      body = { hours };
    } else if (kind === 'idiomas') {
      body = { langs: ['es'].concat($$('[name=langs]:checked', f).map((x) => x.value)) };
    } else {
      $$('input[name], textarea[name], select[name]', f).forEach((el) => { body[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
    }
    busy(btn, true);
    try {
      S.settings = await api('settings_save', { body });
      if (body.name) { S.salon = body.name; LS.set('salon', body.name); $('#bar-sub').textContent = body.name; }
      delete f.dataset.dirty;
      btn.classList.remove('is-dirty');
      if (btn.dataset.orig) { btn.dataset.label = btn.dataset.orig; delete btn.dataset.orig; }
      toast($('[data-adv]', $('#view')) && $('[data-adv]', $('#view')).contains(f) ? 'Guardado' : 'Guardado. Ya se ve en la web.');
      // Las claves y contraseñas no vuelven del servidor: se vacía la casilla y se avisa de que ya hay una guardada
      $$('input[type=password][name]', f).forEach((pw) => { if (pw.value) { pw.value = ''; pw.placeholder = pw.dataset.saved || SAVED_SECRET; } });
      if (kind === 'idiomas' || kind === 'traductor') loadTrStatus();
    } catch (err) { toast(err.message, 'err'); }
    busy(btn, false);
  }

  /* ---------- Clics generales ---------- */
  function onViewClick(e) {
    const t = e.target;
    if (t.closest('[data-retry]')) return render();
    const wa = t.closest('[data-wa-send]');
    if (wa) { e.stopPropagation(); markSent(Number(wa.dataset.waSend)); return; }
    const wauto = t.closest('[data-wa-auto]');
    if (wauto) { e.stopPropagation(); autoSend(Number(wauto.dataset.waAuto), wauto); return; }
    const hd = t.closest('[data-hoy-day]');
    if (hd) { S.hoyDay = hd.dataset.hoyDay; return renderHoyBody($('#view')); }
    const jp = t.closest('[data-jump]');
    if (t.closest('[data-cats-all]')) {
      const ds = $$('details.mcat'); const open = !ds.every((x) => x.open);
      ds.forEach((d) => { d.open = open; });
      return;
    }
    if (jp) { e.preventDefault(); const el = $('#mcat-' + jp.dataset.jump); if (el) el.open = true; if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - $('.bar').offsetHeight - 8, behavior: 'smooth' }); return; }
    const gt = t.closest('[data-goto-tab]');
    if (gt) return go(gt.dataset.gotoTab);
    const st = t.closest('[data-status]');
    if (st) {
      e.stopPropagation();
      const rr = S.res[Number(st.dataset.id)];
      if (st.dataset.status === 'rechazada' && rr) { rejectFlow(rr); return; }
      busy(st, true, '…');
      setStatus(Number(st.dataset.id), st.dataset.status).catch((err) => { toast(err.message, 'err'); busy(st, false); });
      return;
    }
    if (t.closest('a')) return;
    const open = t.closest('[data-open]');
    if (open && (open.classList.contains('res') || open.classList.contains('hero-next'))) return showReservation(Number(open.dataset.open));
    if (t.closest('[data-new-service]')) return editService(null);
    if (t.closest('[data-new-cita]')) return editReservation(null, newCitaDay());
    const nw = t.closest('[data-new]');
    if (nw) return editReservation(null, nw.dataset.new);
    const day = t.closest('[data-day]');
    if (day) { S.calDay = day.dataset.day; return render(); }
    const mon = t.closest('[data-month]');
    if (mon) {
      const [y, m] = S.calMonth.split('-').map(Number);
      const d = new Date(y, m - 1 + Number(mon.dataset.month), 1, 12);
      S.calMonth = iso(d).slice(0, 7);
      S.calDay = S.calMonth === todayISO().slice(0, 7) ? todayISO() : iso(d);
      return render();
    }
    if (t.closest('[data-goto-today]')) { S.calDay = todayISO(); S.calMonth = S.calDay.slice(0, 7); return render(); }
    const cd = t.closest('[data-close-day]');
    if (cd) return toggleClosedDay(cd.dataset.closeDay).catch((err) => toast(err.message, 'err'));
    const dish = t.closest('[data-service]');
    if (dish) return can('servicios') ? editService(findService(Number(dish.dataset.service))) : null;
    if (t.closest('[data-cat-new]')) return editCategory(null);
    if (t.closest('[data-pack-new]')) return editPackSheet(null);
    const me = t.closest('[data-pack-edit]');
    if (me) return editPackSheet(S.svc.packs.find((m) => m.id === me.dataset.packEdit));
    const mm = t.closest('[data-pack-move]');
    if (mm) { const [id, dir] = mm.dataset.packMove.split(':'); return api('pack_move', { body: { id, dir: Number(dir) } }).then(render).catch((err) => toast(err.message, 'err')); }
    const cat = t.closest('[data-cat]');
    if (cat) return editCategory(S.svc.categories.find((c) => c.id === Number(cat.dataset.cat)));
  }

  function onViewInput(e) {
    const t = e.target;
    if (t.id === 'hoy-q') { S.query = t.value; renderHoyBody($('#view')); return; }
    if (t.id === 'set-q') {
      const q = norm(t.value.trim());
      let n = 0;
      const sets = $$('details.set', $('#view'));
      // Primero por el título de la sección; si ninguna coincide, por todo lo que hay dentro
      const byTitle = sets.some((d) => norm($('summary', d).textContent).includes(q));
      sets.forEach((d) => {
        const txt = byTitle ? $('summary', d).textContent : d.textContent + ' ' + $$('input[placeholder]', d).map((i) => i.placeholder).join(' ');
        const hit = !q || norm(txt).includes(q);
        d.hidden = !hit;
        if (hit) n++;
        d.open = q ? hit : S.openSets.has(d.dataset.set);
      });
      // Al buscar se mira en todas las pestañas a la vez; al borrar, vuelve la pestaña que estaba abierta
      const view = $('#view');
      view.classList.toggle('is-searching', !!q);
      $$('.set-pane', view).forEach((p) => { p.hidden = q ? !$$('details.set', p).some((d) => !d.hidden) : p.dataset.pane !== S.setTab; });
      const adv = $('[data-adv]', view);
      if (adv) { const any = $$('details.set', adv).some((d) => !d.hidden); adv.hidden = !!q && !any; adv.open = q ? any : S.advOpen; }
      $$('.set-intro', view).forEach((p) => { p.hidden = !!q; });
      $('.set-tabs', view).hidden = !!q;
      $('.set-none', view).hidden = !q || n > 0;
      return;
    }
    if (t.id === 'serv-q') {
      const q = t.value.trim().toLowerCase();
      $$('.mcat', $('#view')).forEach((sec) => {
        let n = 0;
        $$('.mdish', sec).forEach((d) => { const on = !q || d.dataset.name.includes(q); d.hidden = !on; if (on) n++; });
        sec.hidden = !!q && n === 0;
        // Al buscar se abren las secciones con resultados; al borrar la búsqueda vuelven como estaban
        sec.dataset.searching = '1';
        sec.open = q ? n > 0 : catOpen().has(Number(sec.dataset.catId));
        setTimeout(() => { delete sec.dataset.searching; }, 0);
      });
      const j = $('.jump', $('#view'));
      if (j) j.hidden = !!q;
      return;
    }
    const f = t.closest('form[data-form]');
    if (f && f.dataset.form !== 'password' && f.dataset.form !== 'me_email') {
      if (!f.dataset.dirty) {
        f.dataset.dirty = '1';
        const b = $('button[type=submit]', f);
        if (b) { b.classList.add('is-dirty'); b.dataset.orig = b.textContent; b.textContent = 'Guardar cambios'; }
      }
    }
  }

  async function onViewChange(e) {
    const mt = e.target.closest('[data-pack-toggle]');
    if (mt) return togglePack(mt);
    const mb = e.target.closest('[data-packs-btn]');
    if (mb) return api('packs_button_toggle', { body: { on: mb.checked } }).then(() => { toast(mb.checked ? 'El botón «Ver packs» sale en la portada' : 'Botón «Ver packs» quitado de la portada'); S.svc.packs_button = mb.checked; }).catch((err) => { mb.checked = !mb.checked; toast(err.message, 'err'); });
    if (e.target.closest('[data-servicios-toggle]')) return toggleServicios(e.target.closest('[data-servicios-toggle]'));
    const tg = e.target.closest('[data-toggle]');
    if (!tg) { if (e.target.closest('form[data-form]')) onViewInput(e); return; }
    const id = Number(tg.dataset.toggle);
    const on = tg.checked;
    tg.disabled = true;
    try {
      const d = await api('service_toggle', { body: { id, available: on } });
      toast(on ? `«${d.name}» se puede reservar otra vez` : `«${d.name}» desactivado: ya no sale en la web`);
      render();
    } catch (err) {
      tg.checked = !on;
      tg.disabled = false;
      toast(err.message, 'err');
    }
  }

  /* ---------- Arranque ---------- */
  /** Enlace del email para cambiar la contraseña (panel/#reset=…). Devuelve true si lo atiende. */
  function resetFromHash() {
    const m = /^#reset=([a-f0-9]{64})$/.exec(location.hash);
    if (!m || !S.base) return false;
    // Se quita el token de la dirección para que no quede en el historial
    history.replaceState(null, '', location.pathname + location.search);
    renderReset(m[1]);
    return true;
  }
  window.addEventListener('hashchange', resetFromHash);

  function boot() {
    if (resetFromHash()) return;
    if (!S.base) return renderSetup();
    if (!S.token) return renderLogin();
    startApp();
  }

  setInterval(poll, 30000);
  // El contador de puestos ocupados se actualiza solo cada minuto
  setInterval(() => { if (S.tab === 'hoy' && !S.query && !$('.sheet-wrap') && $('#hoy-body')) renderHoyBody($('#view')); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.token) { poll(); if (S.tab === 'hoy') render(); } });

  if (!NATIVE && 'serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo offline */ });
  }
  boot();
})();
