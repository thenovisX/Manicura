// Cursor magnético: un círculo que sigue al ratón con retraso (lerp) y se agranda en modo «difference»
// sobre enlaces, botones y títulos. Los elementos con data-magnet se dejan atraer. Solo con ratón.
export function cursor() {
  if (!matchMedia('(pointer: fine)').matches) return;
  const el = document.createElement('div');
  el.className = 'cursor';
  el.setAttribute('aria-hidden', 'true');
  const txt = document.createElement('span');
  el.appendChild(txt);
  document.body.appendChild(el);
  document.documentElement.classList.add('con-cursor');

  const pos = { x: innerWidth / 2, y: innerHeight / 2 }, raton = { ...pos };
  let escala = 1, objetivo = 1, visible = false, iman = null;

  addEventListener('pointermove', (e) => {
    raton.x = e.clientX; raton.y = e.clientY;
    if (!visible) { visible = true; el.style.opacity = '1'; pos.x = raton.x; pos.y = raton.y; }
    const t = e.target.closest?.('a,button,summary,label,[data-cursor],h1,h2,[role=button],input,select,textarea');
    const campo = t && t.matches('input,select,textarea');
    el.classList.toggle('activo', !!t && !campo);
    el.classList.toggle('oculto', !!campo);
    // data-cursor="Texto" escribe esa palabra dentro del círculo
    const etiqueta = t?.closest('[data-cursor]')?.dataset.cursor || '';
    txt.textContent = etiqueta;
    el.classList.toggle('con-texto', !!etiqueta);
    objetivo = !t ? 1 : etiqueta ? 5.2 : t.matches('h1,h2') ? 4.2 : 2.6;

    const m = e.target.closest?.('[data-magnet]');
    if (iman && iman !== m) iman.style.transform = '';
    iman = m;
    if (m) {
      const r = m.getBoundingClientRect();
      m.style.transform = `translate(${(e.clientX - (r.left + r.width / 2)) * 0.25}px, ${(e.clientY - (r.top + r.height / 2)) * 0.35}px)`;
    }
  }, { passive: true });
  document.addEventListener('pointerleave', () => { visible = false; el.style.opacity = '0'; });
  addEventListener('pointerdown', () => el.classList.add('pulsa'));
  addEventListener('pointerup', () => el.classList.remove('pulsa'));

  const loop = () => {
    pos.x += (raton.x - pos.x) * 0.16;
    pos.y += (raton.y - pos.y) * 0.16;
    escala += (objetivo - escala) * 0.14;
    el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%) scale(${escala})`;
    txt.style.transform = `scale(${1 / escala})`;
    requestAnimationFrame(loop);
  };
  loop();
}
