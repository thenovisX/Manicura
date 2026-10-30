# Cómo hacer un tema

El tema es el diseño de la web. Vive entero en `web/tema/` y es lo único que cambia de un cliente a otro. El backend le da los datos y se encarga de reservas, cuentas, emails, cookies y textos legales.

## Archivos obligatorios

| Archivo | Para qué | Variables que recibe |
|---|---|---|
| `tema.php` | Configuración: nombre, versión, colores, huecos de foto. **Solo constantes** (lo leen también la API y el panel). | — |
| `inicio.php` | Portada (`/`) | `$servicios`, `$packs`, `$servicios_on`, `$packs_button` |
| `cuenta.php` | Entrar, registrarse y «Mi cuenta» (`cuenta.php`) | `$reservas`, `$activada`, `$enlace_caducado`, `$registro` |
| `legal.php` | Información legal (`legal.php`) | `$secciones` |
| `borrar.php` | Borrar mis datos (`borrar-datos.php`): pedir el enlace y confirmar el borrado. Pinta `borrar_form()` en «pedir» e «invalido» | `$estado`, `$contacto`, `$resumen`, `$hecho`, `$borrar_boton` |
| `recuperar.php` | Recuperar la contraseña (`recuperar.php`): pedir el enlace (`<form data-api="c_forgot">` + `[data-forgot-ok]`) y elegir la nueva (`<form data-api="c_reset">` con `<input type="hidden" name="t">`). Si el tema no lo tiene, sale una página sencilla. | `$estado` (`pedir`, `nueva`, `invalido`), `$token` |
| `confirmar.php` | Página del enlace del WhatsApp (`confirmar.php`) | `$ok`, `$pendiente`, `$estado`, `$reserva` (con `service`, `duration` y `end`), `$fecha`, `$error`, `$ics_url`, `$confirmar_form`, `$cancelar_form` |

Todas reciben también `$s` (los ajustes del salón) y `$cliente` (el cliente con sesión, o `null`).

Opcionales:

| Archivo | Para qué | Variables que recibe |
|---|---|---|
| `servicios.php` | Página propia de servicios y precios (`servicios.php`). Si el tema no la tiene, `servicios.php` lleva a `./#servicios`. | `$servicios`, `$packs`, `$servicios_on`, `$packs_button` |
| `packs.php` | Página propia de los packs y bonos (`packs.php`). Si el tema no la tiene, lleva a `./#packs`. | `$packs`, `$servicios`, `$servicios_on` |
| `reservar.php` | Página «Cómo reservar» (`reservar.php`): políticas, horario… Si no existe, lleva a `./#reservar`. | — |
| `lang.php` | Traducciones de los textos del propio tema (ver «Idiomas»). | — |

El resto es libre: `partes.php` (cabecera y pie compartidos), `assets/` (CSS, JS, fuentes, imágenes). Para enlazar un archivo de `assets/` con su versión: `<?= asset('tema.css') ?>`. Si tu tema tiene `servicios.php`, `packs.php` o `reservar.php`, enlázalas desde el menú y entran solas en el sitemap.

## Lo que tiene que tener cada página (obligatorio)

```php
<!doctype html>
<html lang="<?= html_lang() ?>">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= h($s['name']) ?></title>
<?php head_tags(); ?>          <!-- SEO, aviso de cookies, iconos de la app, estilos del SDK -->
<link rel="stylesheet" href="<?= asset('tema.css') ?>">
</head>
<body>
  …tu diseño…
  <footer>
    … enlaces a legal.php#aviso, legal.php#privacidad, legal.php#cookies …
    <?= cookies_link() ?>      <!-- «Configurar cookies»: obligatorio por ley -->
  </footer>
<?php body_end(); ?>           <!-- ventana de reserva + SDK -->
</body>
</html>
```

## Reglas legales para el diseño

- **Nada de recursos de otras webs**: ni Google Fonts desde Google, ni imágenes o scripts de otros dominios. Descarga las fuentes a `tema/assets/fonts/` (las de Google Fonts tienen licencia libre). La política de privacidad dice que todo se sirve desde el propio servidor.
- **Mapas**: si incrustas Google Maps, cárgalo solo cuando el visitante pulse un botón («Mostrar el mapa») y pon `const TEMA_GOOGLE_MAPS = true;` en `tema.php`. Así se añade el aviso en la página de cookies.
- **Scripts y seguridad (CSP)**: la web manda una cabecera Content-Security-Policy. Los scripts del tema van en archivos de `tema/assets/` (`<script src="…" defer>`); si necesitas un `<script>` en línea, ponle `nonce="<?= csp_nonce() ?>"`. Nada de `onclick="…"` ni `onsubmit="…"`: usa `addEventListener` en `tema.js` (para pedir confirmación antes de enviar un formulario basta con `data-confirm="¿Seguro…?"`). Si incrustas algo de otro dominio, añádelo a `send_csp()` en `lib/core.php`.
- **No cambies los textos legales** desde el tema: salen de `lib/legal.php` y se rellenan solos.
- **Precios claros**: si un servicio tiene precio «desde» (`from`), pinta «desde» delante (`precio($d['price'], $d['from'])` ya lo hace).

## Datos del salón: `$s`

`name`, `tagline` (frase corta), `description` (presentación), `address`, `city`, `phone`, `whatsapp`, `email`, `instagram`, `facebook`, `tiktok`, `tripadvisor` (enlace de reseñas: Google, Fresha, Treatwell…), `maps_url`, `ribbon` (frases destacadas, separadas por comas), `footer_title`, `hours`, `closed_dates`, `late_minutes` (minutos que se guarda la cita), `capacity` (puestos), `default_minutes`, `policies`, `max_people`, `days_ahead`, `owner_name`, `owner_nif`.

Imprime siempre con `h()`: `<?= h($s['name']) ?>`.

`$s` ya viene traducido al idioma de la visita en los textos propios del salón (`tagline`, `description`, `footer_title`, `ribbon` y `policies`): imprimes `$s['tagline']` y sale en el idioma que toca. El nombre y los datos de contacto nunca se traducen.

## Funciones disponibles

| Función | Devuelve |
|---|---|
| `h($texto)` | Texto escapado para HTML |
| `asset('archivo.css')` | `tema/assets/archivo.css?v=…` |
| `photo_img('portada', 1200, '100vw')` | `<img>` completo con `srcset` y `alt` |
| `photo('portada', 1200)` / `photo_abs(...)` | Solo la dirección de la foto (relativa / completa) |
| `photo_credits()` | Autores de las fotos de ejemplo que siguen puestas (para el pie) |
| `horario()` | `[['dia' => 'Martes', 'texto' => '10:00–14:00 y 16:00–20:30', 'hoy' => bool], …]` |
| `horario_hoy()` | Horario de hoy, `'Cerrado'` o `'Cerrado hoy'` |
| `politicas()` | `[['titulo' => 'Retrasos', 'texto' => '…'], …]` |
| `redes()` | `['Instagram' => url, …]` (solo las configuradas) |
| `tel_href($tel)`, `wa_href()`, `maps_href()` | Enlaces para llamar, WhatsApp y «Cómo llegar» |
| `precio(12.5)` / `precio(25, true)` | `12,50 €` / `desde 25,00 €` (traducido) |
| `reserva_servicios()` | Servicios por secciones para un selector propio: `[['name' => 'Manos', 'services' => [['id', 'name', 'price' (texto), 'duration', 'time'], …]], …]` |
| `cookies_link()` | Enlace «Configurar cookies» (traducido) |
| `borrar_form('clase-del-botón')` | Formulario «Borrar mis datos» (email o teléfono). Ponlo en la página legal o en las políticas y enlaza `borrar-datos.php` desde el pie |
| `selector_idioma('mi-clase')` | Banderas circulares para cambiar de idioma (vacío si solo hay uno). Ponlo en la cabecera |
| `html_lang()` | `es-ES`, `en-GB`, `pt-PT` o `gl-ES`, para `<html lang>` |
| `t('texto en español', …)` | Texto fijo en el idioma de la visita (admite `%s` y `%d`) |
| `tr('texto del salón')` | Texto del salón traducido (solo si lo imprimes sin pasar por `$s`, `$servicios` o `politicas()`) |
| `tema_tiene('servicios')` | ¿Existe `tema/servicios.php`? |
| `servicios_publicos()` | Los servicios con nombres y descripciones en el idioma de la visita (ya vienen en `$servicios`) |
| `services_data(false)` | Los servicios sin traducir |

### Los servicios: `$servicios`

```php
$servicios['categories'] = [
  ['id' => 2, 'name' => 'Uñas', 'services' => [
     ['id' => 7, 'name' => 'Uñas de gel', 'description' => '…', 'price' => 35.0, 'from' => false,
      'duration' => 90, 'duration_text' => '1 h 30 min',
      'photo' => 'https://…/uploads/…jpg' o '', 'featured' => true],
  ]],
];
```

Solo vienen los servicios disponibles y las secciones con servicios. `from` es `true` si el precio es «desde» (por ejemplo, el nail art). `duration` está en minutos y es lo que ocupa la cita; `duration_text` ya viene escrito y traducido.

Pon junto a cada servicio un botón que abra la reserva con ese servicio elegido: `<button type="button" data-book data-book-service="<?= $d['id'] ?>">Reservar</button>`.

## Huecos de foto: `TEMA_FOTOS`

```php
const TEMA_FOTOS = [
    'portada' => ['label' => 'Portada', 'src' => 'https://images.unsplash.com/photo-…', 'alt' => '…', 'by' => 'Autor', 'url' => 'https://unsplash.com/photos/…'],
    'sala'    => ['label' => 'Nosotros', 'src' => 'tema/assets/img/sala.jpg', 'alt' => '…'],
];
```

Cada hueco aparece en la app (Ajustes → Fotos de la web) con su `label` para que el cliente ponga la suya. La primera es la principal (Google y redes sociales). Las fotos de Unsplash se descargan una vez y se sirven desde el propio servidor.

## Confirmar la reserva: el botón es obligatorio

Abrir el enlace del WhatsApp **no confirma** la reserva: WhatsApp, Telegram y los antivirus del correo abren los enlaces solos para hacer la vista previa, y confirmarían reservas sin que nadie las viera. Cuando `$pendiente` es `true`, la página tiene que mostrar los datos y el botón que pinta `<?= $confirmar_form('Confirmar mi reserva', 'mi-clase-de-boton') ?>`. La reserva se confirma cuando el cliente lo pulsa.

Pon también `<?= $cancelar_form('Cancelar la reserva', 'mi-clase') ?>`: deja al cliente cancelar desde el mismo enlace, mientras la reserva está pendiente o confirmada. Después la página muestra «Reserva cancelada» (en `$error`), y lo mismo si el salón la cancela o la borra desde el panel.

## Reservar: `data-book`

Cualquier elemento con `data-book` abre la ventana de reserva, por ejemplo `<a href="#reservar" data-book>Reservar cita</a>`. No hace falta nada más. Con `data-book-service="ID"` la ventana se abre con ese servicio ya elegido.

La ventana pregunta qué servicio quiere (por secciones, con precio y duración, o «Aún no lo sé»), cuántas personas vienen (hasta `max_people`; cada persona ocupa un puesto), el día y la hora. Solo ofrece las horas en las que el servicio cabe entero antes del cierre del turno y hay puestos libres durante toda la cita. Las horas salen agrupadas en «Mañana» y «Tarde».

Si el salón tiene teléfono, la ventana empieza preguntando **«¿Cómo quieres reservar?»**: reservar online o llamar. «Llamar» se desactiva y avisa («Ahora estamos cerrados. Podrás llamarnos hoy a las 20:00») cuando la hora del salón queda fuera de su horario de apertura o es un día cerrado. Sin teléfono, la ventana va directa a la reserva online.

Para que la ventana y el aviso de cookies combinen con tu diseño, define estas variables en tu CSS:

```css
:root {
  --r-bg: #fff;            /* fondo */
  --r-text: #222;          /* texto */
  --r-muted: #666;         /* texto secundario */
  --r-line: rgba(0,0,0,.14);
  --r-field: transparent;  /* fondo de los campos */
  --r-accent: #b0466b;     /* botón principal y elementos elegidos */
  --r-accent-text: #fff;
  --r-radius: 14px;
  --r-btn-radius: 999px;
  --r-font: "Mi fuente", sans-serif;
  --r-font-title: "Mi fuente de títulos", serif;
}
```

Todas sus clases empiezan por `bk-` (reserva), `ck-` (cookies) y `r-` (idiomas, avisos y fotos ampliadas): no uses esos prefijos en tu tema.

## Idiomas

La web sale en español, inglés, portugués y gallego (el salón activa los que quiera en la app: Ajustes → Idiomas de la web). El backend ya traduce a mano la ventana de reserva, el aviso de cookies, los textos legales, los errores, la cuenta y los emails y WhatsApp al cliente. El tema solo tiene que hacer tres cosas:

1. `<html lang="<?= html_lang() ?>">` y `<?= selector_idioma('mi-clase') ?>` en la cabecera. Sus clases son `.r-langs`, `.r-lang` (`.is-on` la actual) y `.r-flag`; el CSS base está en `sdk/salon.css` y lo adaptas desde tu CSS.
2. Escribir los textos fijos del tema con `t('texto en español')` y ponerles la traducción en `tema/lang.php`:

```php
<?php
return [
    'dict' => [
        'Nuestra historia' => ['en' => 'Our story', 'pt' => 'A nossa história', 'gl' => 'A nosa historia'],
        'Hola, %s' => ['en' => 'Hello, %s', 'pt' => 'Olá, %s', 'gl' => 'Ola, %s'],
    ],
    'js' => ['Texto usado desde JavaScript'],   // opcional: claves que el JS del tema pide con Salon.t('…')
];
```

   Si falta una traducción, el texto sale en español. Los textos comunes («Servicios», «Reservar cita», «Cómo llegar», días…) ya están en `lib/lang/textos.php`; no hace falta repetirlos.
3. No traducir a mano los servicios, los packs ni los datos del salón: salen traducidos solos en `$s`, `$servicios`, `$packs` y `politicas()`. Se traducen al guardar en la app (traductor automático, corregible a mano).

Los textos legales cambian de idioma solos; en la página legal puedes mostrar `legal_aviso_traduccion()` (vacío en español).

## Packs y lista de servicios

El salón crea en la app (pestaña Servicios) los packs y bonos que quiera (novia, mani + pedi, bono de 5 sesiones…), cada uno con su interruptor, y también puede quitar la lista de servicios de la web.

- `$servicios_on`: `false` si el salón ha ocultado la lista de servicios. Entonces no la pintes (los servicios siguen en `$servicios`, pero no deben verse).
- `$packs`: lista de packs activos, en el orden de la app, ya traducidos. Vacía si no hay ninguno:

```php
[
  [
    'id' => 'a1b2c3d4', 'title' => 'Mani + pedi', 'price' => 45.0, 'note' => 'Esmaltado semipermanente en manos y pies',
    'days' => [2, 3, 4], 'days_text' => 'de martes a jueves',
    'every_day' => false, 'today' => true,   // ¿todos los días? ¿se puede hoy?
    'groups' => [
      ['name' => 'Manos', 'services' => [['name' => 'Manicura semipermanente', 'desc' => '', 'extra' => 0.0, 'photo' => 'https://…/uploads/pack-….jpg'], …]],   // photo puede ser ''
      ['name' => 'Pies', 'services' => [['name' => 'Pedicura spa', 'desc' => '', 'extra' => 5.0], …]],   // extra = suplemento
    ],
  ],
  …
]
```

- `$packs_button`: si es `true` (y hay packs), pon en la portada un botón «Ver packs» que lleve a los packs. El salón lo activa o lo quita desde la app.

Pon los packs en su propia sección (`id="packs"`), separada de los servicios. Usa `id="pack-<?= h($m['id']) ?>"` en cada pack para poder enlazarlo. Si un servicio del pack tiene foto, ponle `data-zoom`. Pinta el suplemento como `+<?= euros($d['extra']) ?> €` solo si `extra > 0`, «Hoy sí / Hoy no» solo si no es `every_day`, y «a elegir» si un apartado tiene más de un servicio. Textos fijos ya traducidos: «Packs», «Hoy sí», «Hoy no», «a elegir», «Suplemento». Los packs no tienen duración propia: el tema Base explica que se reservan eligiendo «Aún no lo sé» y diciendo en las notas cuál. Fuera de los temas, `packs_public()` y `servicios_on()` dan lo mismo.

## Fotos ampliables

Cualquier `<img data-zoom>` se amplía a pantalla grande al tocarla, con flechas, deslizar el dedo y teclado (Escape cierra). Opcionales: `data-zoom-src="…"` (foto grande), `data-zoom-caption="…"` (pie) y `data-zoom-group="trabajos"` (las flechas pasan solo entre fotos del mismo grupo). Con `photo_img()` basta pasar `'loading="lazy" data-zoom'` como último parámetro. Si añades fotos con JavaScript, llama a `Salon.ampliarFotos()`.

## Cuenta del cliente: atributos `data-*`

El SDK da el comportamiento; el tema solo pone el HTML.

| Atributo | Qué hace |
|---|---|
| `<form data-api="c_login">` | Entrar. Campos `email`, `password`. Al terminar va a `cuenta.php`. |
| `<form data-api="c_register">` | Crear cuenta. Campos `name`, `email`, `phone`, `password`, `privacy` (casilla) y `website` (campo trampa oculto). |
| `<form data-api="c_profile">` | Guardar datos. `name`, `phone`, `email`, `password`, `new_password`. |
| `<form data-api="c_delete" data-confirm="¿Seguro?">` | Borrar la cuenta. Campo `password`. |
| `<form data-api="c_forgot">` | Pedir el enlace para cambiar la contraseña. Campo `email`. Al terminar oculta el formulario y muestra `[data-forgot-ok]`. Enlázalo desde «Entrar» con `<a href="recuperar.php">`. |
| `<form data-api="c_reset">` | Guardar la contraseña nueva. Campos `t` (oculto) y `password`. Al terminar va a `cuenta.php`. |
| `<p data-error>` dentro del form | Ahí se escribe el error. |
| `<div data-tabs>` + botones `role="tab" aria-controls="id"` | Pestañas (Entrar / Crear cuenta). |
| `<div data-registro-ok hidden>` | Se muestra al registrarse («Revisa tu email»). Dentro: `<b data-registro-email>`, `<button data-resend>`. |
| `<button data-cancel="ID" data-when="texto">` | Cancelar una reserva. |
| `<button data-confirm-res="ID">` | Confirmar una reserva que espera al cliente. |
| `<button data-logout>` | Cerrar sesión. |
| `<a href="api/?r=c_export" download>` | Descargar sus datos. |

## Instalar como app

`<button data-install hidden>` aparece cuando el navegador permite instalar. Opcionales: `data-install-help` (instrucciones genéricas), `data-install-ios hidden` (instrucciones para iPhone) y `data-install-done hidden` (ya instalada).

## JavaScript propio

En `window.Salon` tienes:

- `Salon.api('slots&date=2026-11-03&service=7')` y `Salon.api('reserve', {...})`: llamadas a la API (ver API.md);
- `Salon.abrirReserva(idServicio)`: abre la reserva (con ese servicio elegido, o sin él);
- `Salon.t('Texto')`: traduce un texto con el idioma actual (las claves van en `tema/lang.php`, sección `js`);
- `Salon.toast('Texto')`;
- `Salon.datos`: horario, días cerrados, servicios y cliente.

Eventos en `document`: `salon:antes-de-reservar`, `salon:reserva-abierta`, `salon:reserva` (con la respuesta) y `salon:c_login`, `salon:c_register`…

Si quieres hacer tu propia ventana de reserva, llama a `body_end(['reserva' => false])` y usa la API.

## Icono de la app

Por defecto se genera con la inicial del salón y los colores de `TEMA_COLORES`. Para usar un logo, pon un PNG cuadrado (512×512 o más) en `tema/assets/icono.png`.
