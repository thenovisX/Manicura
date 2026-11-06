/*
 * SDK de la web del salón. Lo carga body_end() en todas las páginas. Hace tres cosas:
 *
 * 1. Ventana de reserva: cualquier elemento con data-book la abre (no hace falta nada más). Con
 *    data-book-service="ID" se abre con ese servicio ya elegido y con data-book-notes="texto" con las notas escritas.
 * 2. Cuenta del cliente: formularios con data-api="c_login|c_register|c_profile|c_delete|c_forgot|c_reset", botones
 *    data-cancel="ID", data-confirm-res="ID", data-logout y data-resend. Ver TEMA.md.
 * 3. Instalar como app (data-install, data-install-ios, data-install-help, data-install-done).
 *
 * Además deja window.Salon con la API para temas que quieran hacer su propia interfaz:
 *   Salon.api('slots&date=2026-11-02').then(d => …)
 *   Salon.abrirReserva()      // o Salon.abrirReserva(idDelServicio)
 *   document.addEventListener('salon:reserva', e => console.log(e.detail))
 */
(function () {
  'use strict';
  var R = window.SALON || {};
  /* Servicios de la ventana de reserva por id: { 12: { id, name, price, duration, time } } */
  var SVC = {};
  (R.services || []).forEach(function (c) { c.services.forEach(function (d) { SVC[d.id] = d; }); });
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  /* Idioma: window.I18N trae las traducciones del idioma actual (vacío en español) */
  var I = window.I18N || {};
  var LANG = document.documentElement.lang.slice(0, 2);
  function T(str) {
    var x = I[str] || str, args = Array.prototype.slice.call(arguments, 1), k = 0;
    return args.length ? x.replace(/%[sd]/g, function () { return String(args[k++]); }) : x;
  }
  var DIAS_L = I._days ? [I._days[6]].concat(I._days.slice(0, 6)) : ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var DIAS = I._days ? DIAS_L.map(function (d) { return d.slice(0, 3); }) : ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  var MESES = I._months || ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
  function longDay(s) {
    var d = parse(s), dn = DIAS_L[d.getDay()], n = d.getDate(), m = MESES[d.getMonth()];
    return LANG === 'en' ? dn + ' ' + n + ' ' + m : LANG === 'pt' ? dn + ', ' + n + ' de ' + m : dn + ' ' + n + ' de ' + m;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /** Llama a la API: api('ruta') hace GET; api('ruta', datos) hace POST con JSON. Devuelve una promesa con data. */
  function api(route, body) {
    var opts = { credentials: 'same-origin', headers: {} };
    if (body !== undefined) {
      opts.method = 'POST';
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch('api/?r=' + route, opts).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: T('El servidor no responde bien. Inténtalo de nuevo.') }; });
    }, function () {
      return { ok: false, error: T('Sin conexión. Revisa internet e inténtalo de nuevo.') };
    }).then(function (j) {
      if (!j.ok) throw new Error(j.error || T('Algo ha fallado'));
      return j.data;
    });
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'r-toast';
    t.setAttribute('role', 'status');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }

  function emit(name, detail) {
    try { document.dispatchEvent(new CustomEvent('salon:' + name, { detail: detail })); } catch (e) { /* navegador antiguo */ }
  }

  /* ---------- Reserva en una pantalla: servicio, hora y «Reservar» ---------- */
  var dlg = $('#bk');
  var B = { people: 1, service: null, date: R.today, time: '', slots: [], minutes: 0, done: false, tries: 0, days: null, want: '' };
  var KEY = 'salon_contacto';

  /* Datos de contacto recordados en este dispositivo (solo si el cliente deja marcada «Recordar mis datos») */
  function getSaved() {
    try { var j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j && j.name && j.phone) return j; } catch (e) { /* sin almacenamiento */ }
    var c = R.customer;
    return c && c.name && c.phone ? { name: c.name, phone: c.phone, email: c.email || '' } : null;
  }
  function setSaved(d) { try { if (d) localStorage.setItem(KEY, JSON.stringify(d)); else localStorage.removeItem(KEY); } catch (e) { /* sin almacenamiento */ } }
  var WHO = null; // datos recordados que se están usando (o null: hay que escribirlos)

  function isClosed(day) {
    if ((R.closed || []).indexOf(day) !== -1) return true;
    var wd = String(((parse(day).getDay() + 6) % 7) + 1);
    return !((R.hours || {})[wd] || []).length;
  }

  /* ---------- ¿Está abierto ahora? (hora del salón, no la del móvil) ---------- */
  var NOW0 = R.now && R.now.match(/(\d+)-(\d+)-(\d+) (\d+):(\d+)/);
  var OFFSET = NOW0 ? Date.UTC(+NOW0[1], +NOW0[2] - 1, +NOW0[3], +NOW0[4], +NOW0[5]) - Date.now() : null;
  function restNow() {
    if (OFFSET === null) { var n = new Date(); return { day: iso(n), time: pad(n.getHours()) + ':' + pad(n.getMinutes()) }; }
    var d = new Date(Date.now() + OFFSET);
    return { day: d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()), time: pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) };
  }
  function rangesOf(day) {
    if (isClosed(day)) return [];
    return (R.hours || {})[String(((parse(day).getDay() + 6) % 7) + 1)] || [];
  }
  function whenText(k, time, day) {
    return k === 0 ? T('hoy a las %s', time) : k === 1 ? T('mañana a las %s', time) : T('el %s a las %s', DIAS_L[parse(day).getDay()], time);
  }
  function callStatus() {
    var n = restNow(), r = rangesOf(n.day), i;
    for (i = 0; i < r.length; i++) if (n.time >= r[i][0] && n.time < r[i][1]) return { open: true };
    for (i = 0; i < r.length; i++) if (r[i][0] > n.time) return { open: false, next: whenText(0, r[i][0], n.day) };
    for (var k = 1; k <= 14; k++) {
      var day = addDays(n.day, k), rr = rangesOf(day);
      if (rr.length) return { open: false, next: whenText(k, rr[0][0], day) };
    }
    return { open: false, next: '' };
  }
  function updateCall() {
    var a = $('#bk-call'), txt = $('#bk-call-txt');
    if (!a || !txt) return;
    var st = callStatus();
    a.hidden = !st.open;
    txt.textContent = st.open ? '' : st.next ? T('Ahora estamos cerrados. Podrás llamarnos %s.', st.next) : T('Ahora estamos cerrados.');
  }

  /** 45 → «45 min»; 90 → «1 h 30 min». */
  function minText(m) {
    return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '');
  }
  function shortDay(day) {
    var k = (parse(day) - parse(R.today)) / 864e5;
    var d = parse(day);
    var lbl = k === 0 ? T('hoy') : k === 1 ? T('mañana') : DIAS_L[d.getDay()];
    return lbl.charAt(0).toUpperCase() + lbl.slice(1) + ' ' + d.getDate() + ' ' + MESES[d.getMonth()].slice(0, 3);
  }
  var hasSvcs = function () { return !!$('#bk-svcs', dlg); };

  /** «10:30» + 45 → «11:15». */
  function addMin(t, m) {
    var x = +t.slice(0, 2) * 60 + +t.slice(3, 5) + (m || 0);
    return pad(Math.floor(x / 60) % 24) + ':' + pad(x % 60);
  }
  function svcMinutes() {
    var s = SVC[B.service];
    return B.minutes || (s && s.duration) || 0;
  }

  /**
   * Resumen fijo de abajo: arriba qué se reserva (servicio y precio) y debajo cuándo (día y de qué hora a qué hora).
   * El botón «Reservar» solo se activa cuando ya hay hora.
   */
  function bar() {
    var s = SVC[B.service];
    var what = s ? s.name : B.service === 0 ? T('Aún no lo sé') : T('Tu cita');
    var price = s && s.price ? s.price + (B.people > 1 ? ' ' + T('por persona') : '') : '';
    var m = svcMinutes();
    var line2 = [];
    if (hasSvcs() && B.service === null) { what = T('Elige un servicio'); price = ''; }
    else if (B.time) line2.push(shortDay(B.date) + ' · ' + B.time + (m ? '–' + addMin(B.time, m) : ''));
    else line2.push(m ? minText(m) : '', T('Elige día y hora'));
    if (B.people > 1) line2.push(B.people + ' ' + T('personas'));
    // El precio va aparte para que nunca lo corte un nombre de servicio largo
    $('#bk-sum1').innerHTML = '<span>' + esc(what) + '</span>' + (price ? '<span class="bk-sum-p">' + esc(price) + '</span>' : '');
    $('#bk-sum2').textContent = line2.filter(Boolean).join(' · ');
    $('#bk-sum2').classList.toggle('is-on', !!B.time);
    $('#bk-send').disabled = !B.time;
    $('#bk-send').textContent = T('Reservar');
  }

  function showSvcPicked() {
    var s = SVC[B.service];
    $('#bk-picked').hidden = false;
    $('#bk-svcs').hidden = true;
    $('#bk-picked-n').textContent = s ? s.name : T('Aún no lo sé');
    $('#bk-picked-m').textContent = s ? [s.time, s.price].filter(Boolean).join(' · ') : T('Te ayudamos a elegir en el salón');
  }
  function showSvcList() {
    $('#bk-picked').hidden = true;
    $('#bk-svcs').hidden = false;
    $$('.bk-svc', dlg).forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.svc === B.service)); });
  }

  function maxDays() { return Math.min(R.daysAhead || 30, 30); }

  /** Tira de días: día de la semana, número y un punto si quedan horas libres (como en las apps de citas). */
  function renderDays() {
    var box = $('#bk-days');
    box.innerHTML = '';
    for (var i = 0; i < maxDays(); i++) {
      var day = addDays(R.today, i);
      var d = parse(day);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'bk-day';
      b.setAttribute('role', 'radio');
      b.dataset.day = day;
      b.disabled = isClosed(day);
      b.setAttribute('aria-checked', String(day === B.date));
      b.innerHTML = '<small>' + (i === 0 ? T('hoy') : i === 1 ? T('mañana') : DIAS[d.getDay()]) + '</small><b>' + d.getDate() + '</b><i aria-hidden="true"></i>';
      box.appendChild(b);
    }
    paintDays();
    monthLabel();
  }

  /** Marca cada día según los huecos que le quedan: punto = hay hora; «completo» = no queda nada. */
  function paintDays() {
    var map = {};
    (B.days || []).forEach(function (x) { map[x.date] = x; });
    $$('.bk-day', dlg).forEach(function (b) {
      var day = b.dataset.day, x = map[day], closed = isClosed(day);
      var full = !closed && x && !x.free;
      b.classList.toggle('is-full', !!full);
      b.classList.toggle('is-free', !!(x && x.free));
      $('i', b).textContent = closed ? T('cerrado') : full ? T('completo') : '';
      b.setAttribute('aria-label', longDay(day) + (closed ? ', ' + T('cerrado') : full ? ', ' + T('completo') : x ? ', ' + T('%d horas libres', x.free) : ''));
    });
    asap();
  }

  /** «noviembre 2026» encima de la tira, según el primer día que se ve. */
  function monthLabel() {
    var box = $('#bk-days'), lbl = $('#bk-month');
    if (!box || !lbl) return;
    var first = $$('.bk-day', box).filter(function (b) { return b.offsetLeft + b.offsetWidth / 2 >= box.scrollLeft + box.offsetLeft; })[0];
    var d = parse(first ? first.dataset.day : B.date), m = MESES[d.getMonth()];
    lbl.textContent = m.charAt(0).toUpperCase() + m.slice(1) + ' ' + d.getFullYear();
    var prev = $('#bk-prev'), next = $('#bk-next');
    if (prev) prev.disabled = box.scrollLeft < 4;
    if (next) next.disabled = box.scrollLeft + box.clientWidth >= box.scrollWidth - 4;
  }

  /** Primer día con hueco (desde «desde», sin contarlo) según la tira, o null. */
  function nextFree(desde) {
    var list = (B.days || []).filter(function (x) { return x.free && x.date > desde; });
    return list[0] || null;
  }

  /** Atajo «Lo antes posible»: el primer hueco libre de todos, a un toque. */
  function asap() {
    var a = $('#bk-asap');
    if (!a) return;
    var x = (B.days || []).filter(function (y) { return y.free; })[0];
    a.hidden = !x || (B.date === x.date && B.time === x.first);
    if (!x) return;
    a.dataset.day = x.date;
    a.dataset.time = x.first;
    $('#bk-asap-w').textContent = shortDay(x.date) + ' · ' + x.first;
  }

  /** Pide a la API cuántas horas libres quedan cada día (para el servicio y las personas elegidas). */
  function loadDays() {
    var key = B.service + '|' + B.people;
    B.daysKey = key;
    return api('days&from=' + R.today + '&n=' + maxDays() + (B.service ? '&service=' + B.service : '') + '&people=' + B.people).then(function (d) {
      if (B.daysKey !== key) return null;
      B.days = d;
      paintDays();
      return d;
    }, function () { B.days = null; return null; });
  }

  function pickDate(day) {
    B.date = day;
    B.time = '';
    $$('.bk-day', dlg).forEach(function (b) {
      var on = b.dataset.day === day;
      b.setAttribute('aria-checked', String(on));
      if (on) { var box = b.parentNode; box.scrollLeft = Math.max(0, b.offsetLeft - box.offsetLeft - 74); } // deja ver el día de antes
    });
    monthLabel();
    asap();
    bar();
  }

  function slotBtn(s) {
    var ok = s.left >= B.people;
    return ok
      ? '<button type="button" class="bk-slot" data-time="' + s.time + '" aria-pressed="' + (s.time === B.time) + '">' + s.time + '</button>'
      : '<button type="button" class="bk-slot bk-slot-busy" disabled aria-label="' + s.time + ', ' + T('ocupado') + '">' + s.time + '</button>';
  }

  /** Horas del día en dos grupos, mañana y tarde. Las ocupadas se ven apagadas para que se entienda qué queda. */
  function renderSlots() {
    var box = $('#bk-slots');
    var free = B.slots.filter(function (s) { return s.left >= B.people; });
    if (!free.length) {
      var nx = nextFree(B.date);
      box.innerHTML = '<div class="bk-none"><p class="bk-msg">' + esc(B.reason || (B.people > 1 ? T('No queda hueco para %d personas ese día.', B.people) : T('No queda ningún hueco libre ese día.'))) + '</p>' +
        (nx ? '<button type="button" class="bk-btn bk-go" data-go="' + nx.date + '">' + esc(T('Ver el %s', shortDay(nx.date).toLowerCase())) + ' <span aria-hidden="true">→</span></button>' : '<p class="bk-msg">' + T('Prueba otro día.') + '</p>') + '</div>';
      return;
    }
    var groups = [
      [T('Por la mañana'), B.slots.filter(function (s) { return s.time < '14:00'; })],
      [T('Por la tarde'), B.slots.filter(function (s) { return s.time >= '14:00'; })]
    ];
    box.innerHTML = groups.filter(function (g) { return g[1].length; }).map(function (g) {
      var n = g[1].filter(function (s) { return s.left >= B.people; }).length;
      return '<div class="bk-tg"><p class="bk-tg-t"><span>' + g[0] + '</span><small>' + (n ? (n === 1 ? T('1 hora libre') : T('%d horas libres', n)) : T('completo')) + '</small></p>' +
        '<div class="bk-slot-grid">' + g[1].map(slotBtn).join('') + '</div></div>';
    }).join('');
  }

  /** Marca una hora como elegida y enseña «¿A nombre de quién?». */
  function pickTime(t) {
    B.time = t;
    $$('.bk-slot', dlg).forEach(function (s) { s.setAttribute('aria-pressed', String(s.dataset.time === t)); });
    $('#bk-err').textContent = '';
    asap();
    bar();
    showWho();
  }

  /** Carga las horas del día elegido. Con auto = true, si ese día no queda nada pasa solo al siguiente con hueco. */
  function loadSlots(auto) {
    var box = $('#bk-slots'), day = B.date;
    box.innerHTML = '<div class="bk-load" aria-label="' + T('Buscando horas libres…') + '">' + new Array(9).join('<span></span>') + '</div>';
    api('slots&date=' + encodeURIComponent(day) + (B.service ? '&service=' + B.service : '')).then(function (d) {
      if (day !== B.date) return; // ya han elegido otro día
      B.slots = d.slots;
      B.minutes = d.minutes;
      B.reason = d.open ? '' : d.reason + '.';
      if (auto && B.tries < 10 && !B.slots.some(function (s) { return s.left >= B.people; })) {
        var nx = nextFree(day);
        if (nx) { B.tries++; pickDate(nx.date); loadSlots(true); return; }
        if (!B.days) {
          for (var i = 1; i <= 30; i++) {
            var d2 = addDays(day, i);
            if (d2 > addDays(R.today, maxDays() - 1)) break;
            if (!isClosed(d2)) { B.tries++; pickDate(d2); loadSlots(true); return; }
          }
        }
      }
      if (B.time && !B.slots.some(function (s) { return s.time === B.time && s.left >= B.people; })) B.time = '';
      renderSlots();
      if (B.want) {
        var w = B.want;
        B.want = '';
        // Si mientras tanto esa hora se ha ocupado (o ya no da tiempo), la siguiente libre de ese día
        var ok = B.slots.filter(function (s) { return s.time >= w && s.left >= B.people; })[0];
        if (ok) { pickTime(ok.time); return; }
      }
      bar();
    }).catch(function (e) {
      box.innerHTML = '<p class="bk-msg">' + esc(e.message) + '</p>';
    });
  }

  /** Bloque «¿A nombre de quién?»: si hay datos recordados, una línea con «No soy yo»; si no, nombre y móvil. */
  function renderWho() {
    var f = $('#bk-form');
    $('#bk-who').hidden = !WHO;
    $('#bk-fields').hidden = !!WHO;
    if (WHO) {
      $('#bk-who-n').textContent = WHO.name;
      $('#bk-who-p').textContent = WHO.phone;
      $('#bk-who-av').textContent = WHO.name.trim().charAt(0).toUpperCase();
      f.name.value = WHO.name;
      f.phone.value = WHO.phone;
      if (WHO.email && !f.email.value) f.email.value = WHO.email;
    }
  }

  function setService(id) {
    B.service = id === 0 || SVC[id] ? id : null;
    B.minutes = 0;
    B.time = '';
  }

  function goWhen() {
    var w = $('#bk-b-when');
    w.hidden = false;
    B.tries = 0;
    B.days = null;
    paintDays();
    // Primero qué días tienen hueco (para saltar directamente al primero) y luego las horas de ese día
    loadDays().then(function (d) {
      var x = d && d.filter(function (y) { return y.date === B.date; })[0];
      if (d && x && !x.free) { var nx = nextFree(B.date); if (nx) pickDate(nx.date); }
      loadSlots(true);
    });
  }

  function resetDone() {
    B.done = false;
    B.time = '';
    var f = $('#bk-form');
    f.notes.value = '';
    $('#bk-notes-d').open = false;
    $('#bk-done').hidden = true;
    $('#bk-body').hidden = false;
    $('#bk-foot').hidden = false;
    $('#bk-err').textContent = '';
  }

  function openBooking() {
    if (!dlg) return;
    if (B.done) resetDone();
    $('#bk-err').textContent = '';
    WHO = getSaved();
    renderWho();
    // data-book-service="ID" en el botón deja el servicio elegido (p. ej. «Reservar» junto a cada servicio) y
    // data-book-notes="texto" rellena la nota (p. ej. «Pack novia»: el servicio queda en «Aún no lo sé»)
    var pre = openBooking.service && SVC[openBooking.service] ? openBooking.service : openBooking.notes ? 0 : null;
    if (openBooking.notes) { $('#bk-form').notes.value = openBooking.notes; $('#bk-notes-d').open = true; }
    if (pre !== null || hasSvcs()) setService(pre);
    renderDays();
    if (isClosed(B.date) || B.date < R.today) {
      B.date = R.today;
      for (var i = 0; i < 30; i++) { var d = addDays(R.today, i); if (!isClosed(d)) { B.date = d; break; } }
    }
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    pickDate(B.date);
    $('#bk-b-who').hidden = true;
    if (!hasSvcs()) { B.service = 0; goWhen(); }
    else if (B.service !== null) { showSvcPicked(); goWhen(); }
    else { showSvcList(); $('#bk-b-when').hidden = true; }
    updateCall();
    bar();
    $('#bk-body').scrollTop = 0;
    emit('reserva-abierta', {});
  }

  /** Muestra el bloque del nombre y lo baja a la vista. */
  function showWho() {
    var w = $('#bk-b-who'), was = w.hidden;
    w.hidden = false;
    if (was) setTimeout(function () { w.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); }, 30);
  }

  /** Enlace «Añadir a mi calendario»: un .ics con la cita (hora local del salón). */
  function icsHref(what, day, time, mins) {
    var d = day.replace(/-/g, ''), a = time.replace(':', '') + '00', b = addMin(time, mins).replace(':', '') + '00';
    var place = (R.name || '').replace(/[,;\\]/g, ' ');
    var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//salon//reserva//ES', 'BEGIN:VEVENT',
      'UID:' + d + a + '-' + Math.random().toString(36).slice(2) + '@salon', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
      'DTSTART:' + d + 'T' + a, 'DTEND:' + d + 'T' + b,
      'SUMMARY:' + (what + (place ? ' · ' + place : '')).replace(/[,;\\]/g, ' '), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
  }

  function send() {
    var f = $('#bk-form'), err = $('#bk-err');
    err.textContent = '';
    if (!B.time) { err.textContent = T('Elige una hora.'); return; }
    var name = f.name.value.trim(), phone = f.phone.value.trim();
    if (!name || !phone) {
      WHO = null;
      renderWho();
      showWho();
      err.textContent = !name && !phone ? T('Escribe tu nombre y tu móvil.') : !name ? T('Falta tu nombre.') : T('Falta un teléfono móvil.');
      var inp = !name ? f.name : f.phone;
      setTimeout(function () { inp.focus(); }, 60);
      return;
    }
    var data = {
      people: B.people, service_id: B.service || 0, date: B.date, time: B.time,
      name: name, phone: phone, email: f.email.value.trim(),
      notes: f.notes.value.trim(), website: f.website.value,
      privacy: 1 // el botón dice que al pulsarlo se aceptan las políticas (texto justo encima)
    };
    var btn = $('#bk-send');
    btn.disabled = true;
    btn.textContent = T('Enviando…');
    api('reserve', data).then(function (r) {
      if (WHO || $('#bk-remember').checked) setSaved({ name: name, phone: phone, email: data.email });
      B.done = true;
      $('#bk-body').hidden = true;
      $('#bk-foot').hidden = true;
      $('#bk-done').hidden = false;
      var m = svcMinutes(), dd = parse(B.date), sv = SVC[B.service];
      $('#bk-done-dia').textContent = DIAS_L[dd.getDay()];
      $('#bk-done-num').textContent = dd.getDate();
      $('#bk-done-mes').textContent = MESES[dd.getMonth()];
      $('#bk-done-cita').textContent = B.time + (m ? '–' + addMin(B.time, m) : '') + (sv ? ' · ' + sv.name : '');
      $('#bk-ics').href = icsHref(sv ? sv.name : T('Cita'), B.date, B.time, m || 60);
      $('#bk-done-msg').textContent = T('Te escribimos por WhatsApp al %s para confirmarla.', phone);
      var more = $('#bk-done-more');
      if (r.linked) more.innerHTML = T('La verás en <a href="cuenta.php">tu cuenta</a>, donde también podrás cancelarla.');
      else more.textContent = T('Hasta que la confirmes en ese WhatsApp, la cita queda pendiente.');
      emit('reserva', r);
    }).catch(function (e) {
      err.textContent = e.message;
      bar();
    });
  }

  if (dlg) {
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-book]');
      if (!b) return;
      e.preventDefault();
      emit('antes-de-reservar', {});
      openBooking.service = +b.dataset.bookService || 0;
      openBooking.notes = b.dataset.bookNotes || '';
      openBooking();
    });
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg || e.target.closest('[data-close]')) { dlg.close(); return; }
      var sv = e.target.closest('.bk-svc');
      if (sv) {
        setService(+sv.dataset.svc);
        if (B.service === 0) $('#bk-notes-d').open = true;
        showSvcPicked();
        $('#bk-b-who').hidden = true;
        goWhen();
        bar();
        return;
      }
      if (e.target.closest('#bk-svc-change')) {
        showSvcList();
        B.time = '';
        $('#bk-b-when').hidden = true;
        $('#bk-b-who').hidden = true;
        bar();
        return;
      }
      var day = e.target.closest('.bk-day');
      if (day && !day.disabled) { pickDate(day.dataset.day); loadSlots(false); return; }
      var go = e.target.closest('[data-go]');
      if (go) { pickDate(go.dataset.go); loadSlots(false); return; }
      var fast = e.target.closest('#bk-asap');
      if (fast) {
        if (fast.dataset.day === B.date && B.slots.length) { pickTime(fast.dataset.time); return; }
        B.want = fast.dataset.time;
        pickDate(fast.dataset.day);
        loadSlots(false);
        return;
      }
      var arrow = e.target.closest('#bk-prev, #bk-next');
      if (arrow) {
        var strip = $('#bk-days');
        strip.scrollBy({ left: (arrow.id === 'bk-next' ? 1 : -1) * (strip.clientWidth - 70), behavior: 'smooth' });
        return;
      }
      var slot = e.target.closest('.bk-slot');
      if (slot && !slot.disabled) { pickTime(slot.dataset.time); return; }
      if (e.target.closest('#bk-not-me')) {
        WHO = null;
        setSaved(null);
        var f = $('#bk-form');
        f.name.value = ''; f.phone.value = ''; f.email.value = '';
        renderWho();
        f.name.focus();
        return;
      }
      if (e.target.closest('#bk-send')) send();
    });
    dlg.addEventListener('change', function (e) {
      if (e.target.name === 'people') {
        B.people = +e.target.value;
        B.time = '';
        renderSlots();
        bar();
        loadDays();
      }
    });
    var strip = $('#bk-days');
    if (strip) strip.addEventListener('scroll', function () { if (!B.raf) B.raf = requestAnimationFrame(function () { B.raf = 0; monthLabel(); }); }, { passive: true });
    // Intro en el móvil: del nombre al teléfono, y del teléfono a reservar
    dlg.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || !e.target.name) return;
      if (e.target.name === 'name') { e.preventDefault(); $('#bk-form').phone.focus(); }
      else if (e.target.name === 'phone' || e.target.name === 'email') { e.preventDefault(); send(); }
    });

    if (location.hash === '#reservar' && /[?&]app=1/.test(location.search)) setTimeout(openBooking, 300);
  }

  /* ---------- Ampliar fotos ---------- */
  // Cualquier <img data-zoom> se amplía al tocarla. Opcionales: data-zoom-src (foto grande), data-zoom-caption (pie)
  // y data-zoom-group="nombre" (las flechas pasan solo entre fotos del mismo grupo; sin grupo, todas las de la página).
  var ZOOM = 'img[data-zoom]';
  var lb, lbImg, lbCap, lbList = [], lbI = 0, lbX0 = null;

  function zoomCaption(img) {
    if (img.dataset.zoomCaption) return img.dataset.zoomCaption;
    var fig = img.closest('figure'), fc = fig && $('figcaption', fig);
    return fc ? fc.textContent.trim() : (img.alt || '');
  }
  function zoomSrc(img) {
    if (img.dataset.zoomSrc) return img.dataset.zoomSrc;
    var ss = img.getAttribute('srcset');
    if (!ss) return img.currentSrc || img.src;
    var best = '', w = 0;
    ss.split(/,\s+/).forEach(function (c) {
      var p = c.trim().split(/\s+/), n = parseInt(p[1], 10) || 0;
      if (p[0] && n >= w) { w = n; best = p[0]; }
    });
    return best || img.src;
  }
  function lbShow(i) {
    lbI = (i + lbList.length) % lbList.length;
    var img = lbList[lbI];
    lbImg.src = zoomSrc(img);
    lbImg.alt = img.alt || zoomCaption(img);
    lbCap.textContent = zoomCaption(img);
  }
  function lbBuild() {
    lb = document.createElement('dialog');
    lb.className = 'r-lb';
    lb.setAttribute('aria-label', T('Ampliar foto'));
    lb.innerHTML = '<div class="r-lb-in"><button type="button" class="r-lb-x" aria-label="' + T('Cerrar') + '">×</button>' +
      '<button type="button" class="r-lb-nav r-lb-prev" aria-label="' + T('Anterior') + '">‹</button>' +
      '<figure><img alt=""><figcaption></figcaption></figure>' +
      '<button type="button" class="r-lb-nav r-lb-next" aria-label="' + T('Siguiente') + '">›</button></div>';
    document.body.appendChild(lb);
    lbImg = $('img', lb);
    lbCap = $('figcaption', lb);
    lb.addEventListener('click', function (e) {
      if (e.target.closest('.r-lb-prev')) return lbShow(lbI - 1);
      if (e.target.closest('.r-lb-next')) return lbShow(lbI + 1);
      lb.close();
    });
    lb.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') lbShow(lbI - 1);
      else if (e.key === 'ArrowRight') lbShow(lbI + 1);
    });
    lb.addEventListener('pointerdown', function (e) { lbX0 = e.clientX; });
    lb.addEventListener('pointerup', function (e) {
      if (lbX0 !== null && lbList.length > 1 && Math.abs(e.clientX - lbX0) > 50) lbShow(lbI + (e.clientX < lbX0 ? 1 : -1));
      lbX0 = null;
    });
    lb.addEventListener('close', function () { lbImg.removeAttribute('src'); });
  }
  function zoomOpen(img) {
    if (!lb) lbBuild();
    var g = img.dataset.zoomGroup || '';
    lbList = $$(ZOOM).filter(function (x) { return (x.dataset.zoomGroup || '') === g && x.offsetParent !== null; });
    var i = lbList.indexOf(img);
    if (i < 0) { lbList = [img]; i = 0; }
    lb.classList.toggle('r-lb-one', lbList.length < 2);
    lbShow(i);
    if (typeof lb.showModal === 'function') lb.showModal(); else lb.setAttribute('open', '');
  }
  function zoomPrepare() {
    $$(ZOOM).forEach(function (img) {
      if (img.getAttribute('role') === 'button') return;
      img.setAttribute('tabindex', '0');
      img.setAttribute('role', 'button');
      var c = zoomCaption(img);
      img.setAttribute('aria-label', T('Ampliar foto') + (c ? ': ' + c : ''));
    });
  }
  zoomPrepare();
  document.addEventListener('click', function (e) {
    var img = e.target.closest && e.target.closest(ZOOM);
    if (img) zoomOpen(img);
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches(ZOOM)) { e.preventDefault(); zoomOpen(e.target); }
  });

  /* ---------- Cuenta del cliente ---------- */
  // Pestañas: un contenedor con data-tabs y botones role="tab" con aria-controls
  $$('[data-tabs] [role=tab]').forEach(function (tab) {
    tab.addEventListener('click', function () {
      $$('[role=tab]', tab.closest('[data-tabs]')).forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', String(on));
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
    });
  });

  // Formularios normales que piden confirmación antes de enviarse: <form method="post" data-confirm="¿Seguro…?">
  // (sustituye a onsubmit="…", que la Content-Security-Policy no deja ejecutar)
  $$('form[data-confirm]:not([data-api])').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      if (!confirm(f.dataset.confirm)) e.preventDefault();
    });
  });

  // Formularios: <form data-api="c_login"> … <p data-error></p> <button type="submit">
  $$('form[data-api]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (f.dataset.confirm && !confirm(f.dataset.confirm)) return;
      var data = {};
      new FormData(f).forEach(function (v, k) { data[k] = v; });
      var btn = $('button[type=submit]', f), err = $('[data-error], .form-err', f), label = btn.textContent;
      if (err) err.textContent = '';
      btn.disabled = true;
      btn.textContent = T('Un momento…');
      api(f.dataset.api, data).then(function (r) {
        emit(f.dataset.api, r);
        if (f.dataset.api === 'c_register' && r && r.pending) {
          // Registro hecho: falta abrir el enlace del email. Se muestra el bloque data-registro-ok.
          f.hidden = true;
          $$('[data-tabs]').forEach(function (t) { t.hidden = true; });
          var ok = $('[data-registro-ok]');
          if (ok) ok.hidden = false;
          $$('[data-registro-email]').forEach(function (el) { el.textContent = r.email; });
          $$('[data-resend]').forEach(function (b) { b.dataset.email = r.email; });
          return;
        }
        if (f.dataset.api === 'c_forgot') {
          // Misma respuesta exista o no la cuenta: se enseña el aviso de «revisa tu email»
          f.hidden = true;
          var sent = $('[data-forgot-ok]');
          if (sent) sent.hidden = false; else toast(T('Revisa tu email'));
          return;
        }
        if (f.dataset.api === 'c_profile') {
          toast(T('Datos guardados'));
          btn.disabled = false;
          btn.textContent = label;
          $$('input[type=password]', f).forEach(function (i) { i.value = ''; });
        } else {
          location.href = f.dataset.redirect || (f.dataset.api === 'c_delete' ? './' : 'cuenta.php');
        }
      }).catch(function (ex) {
        if (err) err.textContent = ex.message; else toast(ex.message);
        btn.disabled = false;
        btn.textContent = label;
      });
    });
  });

  $$('[data-resend]').forEach(function (b) {
    b.addEventListener('click', function () {
      b.disabled = true;
      api('c_resend', { email: b.dataset.email }).then(function () { toast(T('Email enviado otra vez')); }, function (e) { toast(e.message); })
        .then(function () { setTimeout(function () { b.disabled = false; }, 30000); });
    });
  });

  $$('[data-logout], #logout').forEach(function (b) {
    b.addEventListener('click', function () {
      api('c_logout', {}).then(function () { location.href = './'; }, function (e) { toast(e.message); });
    });
  });

  $$('[data-confirm-res]').forEach(function (b) {
    b.addEventListener('click', function () {
      b.disabled = true;
      api('c_confirm', { id: +b.dataset.confirmRes }).then(function () {
        toast(T('Reserva confirmada'));
        setTimeout(function () { location.reload(); }, 700);
      }).catch(function (e) { toast(e.message); b.disabled = false; });
    });
  });

  $$('[data-cancel]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!confirm(b.dataset.when ? T('¿Cancelar la reserva del %s?', b.dataset.when) : T('¿Cancelar la reserva?'))) return;
      b.disabled = true;
      api('c_cancel', { id: +b.dataset.cancel }).then(function () {
        toast(T('Reserva cancelada'));
        setTimeout(function () { location.reload(); }, 700);
      }).catch(function (e) { toast(e.message); b.disabled = false; });
    });
  });

  /* ---------- Instalar como app ---------- */
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var installBtn = $('[data-install]'), iosTip = $('[data-install-ios]'), help = $('[data-install-help]'), done = $('[data-install-done]');
  var deferred = null;
  if (done && standalone) { done.hidden = false; if (help) help.hidden = true; }
  else if (iosTip && /iphone|ipad|ipod/i.test(navigator.userAgent)) { iosTip.hidden = false; if (help) help.hidden = true; }
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    if (installBtn) { installBtn.hidden = false; if (help) help.hidden = true; }
  });
  if (installBtn) installBtn.addEventListener('click', function () {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.then(function (c) {
      if (c.outcome === 'accepted') { installBtn.hidden = true; if (done) done.hidden = false; }
      deferred = null;
    });
  });
  window.addEventListener('appinstalled', function () { if (installBtn) installBtn.hidden = true; if (done) done.hidden = false; });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* sin modo app */ });
  }

  // Borrar mis datos: formularios de borrar_form()
  document.addEventListener('submit', function (e) {
    var f = e.target.closest && e.target.closest('form[data-erase]');
    if (!f) return;
    e.preventDefault();
    var btn = f.querySelector('button[type=submit]'), msg = f.querySelector('.r-erase-msg');
    btn.disabled = true;
    msg.classList.remove('is-err');
    api('erase_request', { contact: f.contact.value, website: f.website.value }).then(function (d) {
      msg.textContent = d.message || '';
      f.contact.value = '';
    }, function (err) {
      msg.textContent = err.message;
      msg.classList.add('is-err');
    }).then(function () { btn.disabled = false; });
  });

  window.Salon = { api: api, toast: toast, t: T, abrirReserva: function (service) { openBooking.service = +service || 0; openBooking.notes = ''; openBooking(); }, ampliarFotos: zoomPrepare, datos: R };
})();
