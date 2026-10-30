# Fuente del JavaScript del tema Laca

`../assets/tema.js` sale de aquí. Si solo cambias textos, colores o el CSS no hace falta nada de esto.

```bash
cd web/tema/fuente
npm install
npm run build     # compila y minifica src/ en ../assets/tema.js
npm run dev       # lo mismo, sin minificar y recompilando al guardar
```

Después sube `TEMA_VERSION` en `tema.php` para que los navegadores descarguen el nuevo.

- `src/main.js`: arranque, menú del móvil, fondo de la cabecera al bajar y botón flotante «Reservar cita». Nada más: la web tiene que entenderse sin animaciones que distraigan.
- `src/liquido.js`: el fondo de laca (shader de OGL, un WebGL mínimo). Se mueve muy despacio a propósito para no marear: el brillo sigue al ratón o al dedo con retraso y el dibujo no se desplaza con el scroll.

Todo se empaqueta en un solo archivo servido desde el propio servidor: nada de CDN (lo exige la política de privacidad y la CSP, ver TEMA.md).
Con «reducir movimiento» activado en el sistema el fondo queda quieto. Sin JavaScript se ve todo el contenido.

Las fuentes (Fraunces y Hanken Grotesk, licencia OFL) están ya copiadas en `../assets/fonts/`; Fraunces viene de `@fontsource-variable/fraunces` (ejes de peso y `SOFT`).
Esta carpeta no se sube a Hostinger (la quita el flujo `hostinger.yml`) y, por si acaso, su `.htaccess` la bloquea.
