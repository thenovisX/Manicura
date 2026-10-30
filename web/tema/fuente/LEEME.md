# Fuente del JavaScript del tema Laca

`../assets/tema.js` sale de aquí. Si solo cambias textos, colores o el CSS no hace falta nada de esto.

```bash
cd web/tema/fuente
npm install
npm run build     # compila y minifica src/ en ../assets/tema.js
npm run dev       # lo mismo, sin minificar y recompilando al guardar
```

Después sube `TEMA_VERSION` en `tema.php` para que los navegadores descarguen el nuevo.

- `src/main.js`: arranque, menú del móvil, scroll con inercia (Lenis) y escenas (GSAP + ScrollTrigger + SplitType).
- `src/liquido.js`: el fondo de laca líquida (shader de OGL, un WebGL mínimo). Reacciona al ratón, a los toques y al servicio que señalas.
- `src/cursor.js`: el cursor magnético (solo con ratón).

Todo se empaqueta en un solo archivo servido desde el propio servidor: nada de CDN (lo exige la política de privacidad y la CSP, ver TEMA.md).
Con «reducir movimiento» activado en el sistema no hay inercia, ni escenas fijas, ni animación del fondo. Sin JavaScript se ve todo el contenido.

Las fuentes (Fraunces y Hanken Grotesk, licencia OFL) están ya copiadas en `../assets/fonts/`; Fraunces viene de `@fontsource-variable/fraunces` (ejes de peso y `SOFT`).
Esta carpeta no se sube a Hostinger (la quita el flujo `hostinger.yml`) y, por si acaso, su `.htaccess` la bloquea.
