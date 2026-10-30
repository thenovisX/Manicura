import { Renderer, Program, Mesh, Triangle, Vec2, Vec3 } from 'ogl';

// Plano a pantalla completa con un shader de «laca líquida»: esmalte oscuro que se deforma, atrapa
// reflejos donde está el ratón, se tiñe del color del servicio que señalas y hace ondas al tocar.
// Se oscurece a medida que bajas. Sin WebGL queda un degradado (ver .liquido.sin-webgl en tema.css).
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
  vec2 p = (uv - 0.5) * asp * 2.2;
  vec2 m = (uMouse - 0.5) * asp * 2.2;
  float t = uTime * 0.06;

  // El ratón empuja el líquido
  float d = length(p - m);
  p += (p - m) * 0.35 * exp(-d * d * 2.2) * (0.6 + uHover * 0.6);

  // Onda al tocar: un anillo que se abre y se apaga
  vec2 g = (uGota.xy - 0.5) * asp * 2.2;
  float age = uTime - uGota.z;
  float dg = length(p - g);
  float ring = sin(dg * 14.0 - age * 9.0) * exp(-age * 1.6) * (1.0 - smoothstep(age * 1.3 - 0.4, age * 1.3 + 0.2, dg));
  p += normalize(p - g + 0.0001) * ring * 0.06;

  // Deformación por capas (domain warping)
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + t * 1.4), fbm(p + 3.0 * q + vec2(8.3, 2.8) - t));
  float f = fbm(p + 3.5 * r + uScroll * 0.6);

  // Normal aproximada para el reflejo especular de la laca
  float e = 0.01;
  float fx = fbm(p + 3.5 * r + vec2(e, 0.0) + uScroll * 0.6) - f;
  float fy = fbm(p + 3.5 * r + vec2(0.0, e) + uScroll * 0.6) - f;
  vec3 n = normalize(vec3(-fx * 28.0, -fy * 28.0, 1.0));
  vec3 l = normalize(vec3(m - p, 1.4));
  float spec = pow(max(dot(reflect(-l, n), vec3(0.0, 0.0, 1.0)), 0.0), 26.0);

  vec3 negro = vec3(0.043, 0.020, 0.028);
  vec3 granate = mix(vec3(0.38, 0.045, 0.11), uTono * 0.55, uTinte);
  vec3 rosa = mix(vec3(0.93, 0.62, 0.70), uTono, uTinte * 0.6);
  vec3 col = mix(negro, granate, smoothstep(0.25, 0.85, f * f * 1.8 + length(q) * 0.25));
  col = mix(col, negro, smoothstep(0.55, 1.0, length(r)) * 0.6);
  col += rosa * spec * (0.55 + 0.45 * exp(-d * 1.4));
  col += rosa * 0.05 * exp(-d * d * 3.0);
  col += rosa * abs(ring) * 0.12;

  // Viñeta, oscurecido con el scroll y en las páginas interiores
  col *= 1.0 - 0.55 * smoothstep(0.4, 1.6, length((uv - 0.5) * asp * 1.6));
  col *= mix(1.0, 0.35, clamp(uScroll, 0.0, 1.0));
  col *= 1.0 - uCalma * 0.6;
  col += (hash(uv * uRes + uTime) - 0.5) * 0.025; // grano
  gl_FragColor = vec4(col, 1.0);
}`;

const vert = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`;

const hex = (c) => { const n = parseInt(c.replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

export function liquido(el, { quieto, calma }) {
  const tactil = matchMedia('(pointer: coarse)').matches;
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
  const program = new Program(gl, { vertex: vert, fragment: `#define OCT ${tactil ? 4 : 5}\n` + frag, uniforms: u });
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

  const size = () => { renderer.setSize(innerWidth, innerHeight); u.uRes.value.set(innerWidth, innerHeight); };
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

  const t0 = performance.now();
  let raf = 0;
  const frame = () => {
    u.uTime.value = (performance.now() - t0) / 1000;
    u.uMouse.value.lerp(destino, 0.05);
    u.uHover.value += (hover - u.uHover.value) * 0.06;
    u.uTinte.value += (tinte - u.uTinte.value) * 0.05;
    u.uTono.value.lerp(tono, 0.05);
    const max = document.documentElement.scrollHeight - innerHeight;
    u.uScroll.value += ((max > 0 ? scrollY / max : 0) - u.uScroll.value) * 0.08;
    renderer.render({ scene: mesh });
  };
  const loop = () => { frame(); raf = requestAnimationFrame(loop); };
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
