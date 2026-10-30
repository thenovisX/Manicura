import { Renderer, Program, Mesh, Triangle, Vec2, Vec3 } from 'ogl';

// Plano a pantalla completa con un shader de «laca en reposo»: pliegues grandes de esmalte oscuro que
// se mueven muy despacio, con un brillo suave que se acerca al ratón (o al dedo) sin empujar el líquido.
// Se tiñe poco a poco del color del servicio que señalas y se oscurece al bajar, pero el dibujo no se
// desplaza con el scroll: así no marea. Sin WebGL queda un degradado (ver .liquido.sin-webgl en tema.css).
const frag = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uScroll;
uniform float uHover;
uniform float uCalma;
uniform vec3 uTono;
uniform float uTinte;
uniform vec3 uGota; // x, y, momento del último toque
varying vec2 vUv;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), u.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < OCT; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}

void main(){
  vec2 uv = vUv;
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  // Escala grande y tiempo lento: pocos pliegues, anchos, que respiran en vez de agitarse
  vec2 p = (uv - 0.5) * asp * 1.25;
  vec2 m = (uMouse - 0.5) * asp * 1.25;
  float t = uTime * 0.012;
  float d = length(p - m);

  // Deformación por capas (domain warping), suave: el líquido se pliega sin remolinos
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 1.2 * q + vec2(1.7, 9.2) + t * 0.7), fbm(p + 1.2 * q + vec2(8.3, 2.8) - t * 0.7));
  float f = fbm(p + 1.5 * r);

  // Normal aproximada para el reflejo de la laca (ancho y suave, sin destellos)
  float e = 0.02;
  float fx = fbm(p + 1.5 * r + vec2(e, 0.0)) - f;
  float fy = fbm(p + 1.5 * r + vec2(0.0, e)) - f;
  vec3 n = normalize(vec3(-fx * 18.0, -fy * 18.0, 1.0));
  vec3 l = normalize(vec3(m - p, 1.2));
  float spec = pow(max(dot(reflect(-l, n), vec3(0.0, 0.0, 1.0)), 0.0), 40.0);

  // Al tocar, un resplandor que se enciende y se apaga despacio (sin ondas ni empujes)
  vec2 g = (uGota.xy - 0.5) * asp * 1.25;
  float age = uTime - uGota.z;
  float brillo = exp(-length(p - g) * 3.0) * smoothstep(0.0, 0.6, age) * exp(-age * 0.8);

  vec3 negro = vec3(0.043, 0.020, 0.028);
  vec3 granate = mix(vec3(0.38, 0.045, 0.11), uTono * 0.55, uTinte);
  vec3 rosa = mix(vec3(0.93, 0.62, 0.70), uTono, uTinte * 0.6);
  vec3 col = mix(negro, granate, smoothstep(0.45, 1.05, f * f * 1.8 + length(q) * 0.25));
  col = mix(col, negro, smoothstep(0.6, 1.0, length(r)) * 0.7);
  col += rosa * spec * (0.35 + 0.35 * exp(-d * 1.2)) * (0.85 + uHover * 0.15);
  col += rosa * 0.04 * exp(-d * d * 2.0);
  col += rosa * brillo * 0.08;

  // Viñeta, oscurecido con el scroll y en las páginas interiores
  col *= 1.0 - 0.55 * smoothstep(0.4, 1.6, length((uv - 0.5) * asp * 1.6));
  col *= mix(1.0, 0.45, clamp(uScroll, 0.0, 1.0));
  col *= 1.0 - uCalma * 0.6;
  col += (hash(uv * uRes) - 0.5) * 0.02; // grano fijo (si cambiara en cada imagen, parpadearía)
  gl_FragColor = vec4(col, 1.0);
}`;

const vert = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`;

const hex = (c) => { const n = parseInt(c.replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

export function liquido(el, { quieto, calma }) {
  const tactil = matchMedia('(hover: none), (pointer: coarse)').matches;
  let renderer;
  try {
    renderer = new Renderer({ dpr: Math.min(devicePixelRatio, tactil ? 1 : 1.5) * (tactil ? 0.6 : 0.8), alpha: false, antialias: false, powerPreference: 'high-performance' });
    if (!renderer.gl) throw new Error('sin WebGL');
  } catch (e) {
    el.classList.add('sin-webgl');
    return { tono() {} };
  }
  const gl = renderer.gl;
  el.appendChild(gl.canvas);

  const u = {
    uTime: { value: 0 }, uRes: { value: new Vec2() }, uMouse: { value: new Vec2(0.62, 0.55) },
    uScroll: { value: 0 }, uHover: { value: 0 }, uCalma: { value: calma ? 1 : 0 },
    uTono: { value: new Vec3(0.95, 0.65, 0.72) }, uTinte: { value: 0 }, uGota: { value: new Vec3(0.5, 0.5, -99) },
  };
  const program = new Program(gl, { vertex: vert, fragment: `#define OCT ${tactil ? 3 : 4}\n` + frag, uniforms: u });
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

  // Con «reducir movimiento» el fondo es una imagen fija: al cambiar el tamaño se vuelve a pintar
  const size = () => { renderer.setSize(innerWidth, innerHeight); u.uRes.value.set(innerWidth, innerHeight); if (quieto) renderer.render({ scene: mesh }); };
  size();
  addEventListener('resize', size);

  const destino = new Vec2(0.62, 0.55);
  const tono = new Vec3(0.95, 0.65, 0.72);
  let hover = 0, tinte = 0;
  addEventListener('pointermove', (e) => {
    destino.set(e.clientX / innerWidth, 1 - e.clientY / innerHeight);
    hover = e.target.closest?.('a,button,[data-cursor]') ? 1 : 0;
  }, { passive: true });
  addEventListener('pointerdown', (e) => {
    u.uGota.value.set(e.clientX / innerWidth, 1 - e.clientY / innerHeight, u.uTime.value);
  }, { passive: true });
  // Con el dedo: el brillo sigue al dedo mientras deslizas y, si no tocas, pasea solo por la pantalla
  let tocado = -99;
  if (tactil) {
    addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      if (t) { destino.set(t.clientX / innerWidth, 1 - t.clientY / innerHeight); tocado = u.uTime.value; }
    }, { passive: true });
  }

  const t0 = performance.now();
  let raf = 0;
  const frame = () => {
    u.uTime.value = (performance.now() - t0) / 1000;
    if (tactil && u.uTime.value - tocado > 2.5) {
      const k = u.uTime.value * 0.05;
      destino.set(0.5 + Math.sin(k) * 0.18, 0.5 + Math.cos(k * 1.3) * 0.15);
    }
    // Todo llega con mucho retraso: el brillo se desliza, no persigue al ratón
    u.uMouse.value.lerp(destino, 0.015);
    u.uHover.value += (hover - u.uHover.value) * 0.06;
    u.uTinte.value += (tinte * 0.7 - u.uTinte.value) * 0.02;
    u.uTono.value.lerp(tono, 0.02);
    const max = document.documentElement.scrollHeight - innerHeight;
    u.uScroll.value += ((max > 0 ? scrollY / max : 0) - u.uScroll.value) * 0.03;
    renderer.render({ scene: mesh });
  };
  // En el móvil basta con 30 imágenes por segundo: el líquido se mueve despacio y la batería lo agradece
  let impar = false;
  const loop = () => { impar = !impar; if (!tactil || impar) frame(); raf = requestAnimationFrame(loop); };
  if (quieto) { u.uTime.value = 12; renderer.render({ scene: mesh }); }
  else {
    loop();
    // En segundo plano no gasta batería
    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) loop();
    });
  }

  return {
    /** Tiñe la laca del color de un servicio (o lo quita con null). */
    tono(c) {
      if (!c) { tinte = 0; return; }
      tono.set(...hex(c)); tinte = 1;
    },
  };
}
