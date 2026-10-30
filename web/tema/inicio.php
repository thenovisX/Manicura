<?php
/*
 * Portada del tema Laca. Variables: $s (ajustes), $cliente (o null), $servicios (secciones con sus servicios), $packs (lista, puede estar vacía), $servicios_on, $packs_button.
 * Todo el contenido se pinta en HTML y se ve sin JavaScript; assets/tema.js solo añade el movimiento (ver fuente/src/).
 */
require __DIR__ . '/partes.php';
abrir($s['name'] . ($s['tagline'] ? ' · ' . $s['tagline'] : ''), 'inicio');

// Tonos de esmalte para las muestras de color de cada servicio y de cada pack
$tonos = ['#e6c6bd', '#c9877f', '#8e1b36', '#f2a7b8', '#5a0f22', '#d98c6a', '#b36a7c', '#f0d9cf'];
$tono = fn(int $i) => $tonos[$i % count($tonos)];
// Letra oscura sobre los tonos claros y clara sobre los oscuros
$tinta = function (string $c): string {
    [$r, $g, $b] = array_map('hexdec', str_split(ltrim($c, '#'), 2));
    return (0.2126 * $r + 0.7152 * $g + 0.0722 * $b) / 255 > 0.5 ? 'var(--negro)' : 'var(--papel)';
};

// El nombre gigante se ajusta a su largo: total de letras (una línea) y palabra más larga (móvil)
$nombre = $s['name'];
$letras = max(3, mb_strlen($nombre));
$palabra = max(3, ...array_map('mb_strlen', preg_split('/\s+/u', $nombre) ?: [$nombre]));

$cerrado = in_array(horario_hoy(), [t('Cerrado'), t('Cerrado hoy')], true);
$cinta = array_values(array_filter(array_map('trim', explode(',', $s['ribbon']))));
if (!$cinta) $cinta = array_values(array_filter([$s['tagline'], t('Reserva online'), t('Te confirmamos por WhatsApp'), t('Cancelar es siempre gratis')]));

$pasos = [
    ['t' => t('Limar'), 'd' => t('Forma, largo y borde. Cuadrada, almendra o redonda: la decides tú.'), 'x' => '8%', 'y' => '16%', 'tono' => '#e6c6bd'],
    ['t' => t('Cuidar'), 'd' => t('Cutícula limpia y piel hidratada, sin tirones ni prisas.'), 'x' => '50%', 'y' => '56%', 'tono' => '#c9877f'],
    ['t' => t('Esmaltar'), 'd' => t('Capas finas, curadas una a una, pegadas a la piel.'), 'x' => '12%', 'y' => '52%', 'tono' => '#8e1b36'],
    ['t' => t('Sellar'), 'd' => t('Un brillo de espejo que dura semanas.'), 'x' => '46%', 'y' => '14%', 'tono' => '#f2a7b8'],
];
?>
<main id="main">
  <section class="portada" style="--letras: <?= $letras ?>; --palabra: <?= $palabra ?>">
    <p class="portada-hoy aparece"><span class="punto<?= $cerrado ? ' punto-off' : '' ?>"></span><?= h($cerrado ? t('Hoy cerrado') : t('Hoy') . ' · ' . horario_hoy()) ?></p>
    <figure class="portada-arco" data-parallax="-18"><?= photo_img('portada', 900, '(max-width: 760px) 60vw, 26vw', 'fetchpriority="high"') ?></figure>
    <?php if ($s['tagline']): ?><p class="portada-frase aparece"><?= h($s['tagline']) ?><?php if ($s['city']): ?><br><em><?= h(t('en %s', trim(preg_replace('/^\d+\s*/', '', $s['city'])))) ?></em><?php endif; ?></p><?php endif; ?>
    <h1 class="portada-t" data-split><?= h($nombre) ?></h1>
    <div class="portada-pie aparece">
      <p><?= t('Manos, pies y uñas a tu gusto.') ?><br><?= t('Reserva online y te confirmamos por WhatsApp.') ?></p>
      <a class="pill pill-llena pill-grande" href="#reservar" data-book data-magnet><?= t('Reservar cita') ?></a>
      <?php if ($servicios_on): ?><a class="pill" href="#servicios"><?= t('Servicios y precios') ?></a><?php endif; ?>
      <?php if ($packs && $packs_button): ?><a class="pill" href="#packs"><?= t('Ver packs') ?></a><?php endif; ?>
    </div>
  </section>

  <div class="cinta" aria-label="<?= h(implode(' · ', $cinta)) ?>">
    <div class="cinta-pista" aria-hidden="true">
      <?php for ($r = 0; $r < 2; $r++): ?><span><?php foreach ($cinta as $f): ?><b><?= h($f) ?></b><i></i><?php endforeach; ?></span><?php endfor; ?>
    </div>
  </div>

  <section class="viaje" aria-label="<?= t('Cómo trabajamos') ?>">
    <div class="viaje-escena">
      <div class="viaje-gota" aria-hidden="true"></div>
      <?php foreach ($pasos as $i => $p): ?>
        <article class="capa" style="--x: <?= $p['x'] ?>; --y: <?= $p['y'] ?>">
          <i style="background: <?= $p['tono'] ?>" aria-hidden="true"></i>
          <p class="capa-n"><?= sprintf('%02d', $i + 1) ?></p>
          <h2><?= h($p['t']) ?></h2>
          <p><?= h($p['d']) ?></p>
        </article>
      <?php endforeach; ?>
    </div>
    <p class="viaje-n" aria-hidden="true"><b>01</b> / <?= sprintf('%02d', count($pasos)) ?></p>
  </section>

  <section class="nosotros" id="nosotros">
    <p class="etiqueta"><?= t('Nosotros') ?></p>
    <p class="nosotros-txt" data-encender><?= nl2br(h($s['description'] ?: t('Escribe aquí la presentación del salón desde la app: Ajustes → Salón.'))) ?></p>
    <figure class="nosotros-arco" data-parallax="12"><?= photo_img('salon', 900, '(max-width: 760px) 70vw, 30vw', 'loading="lazy" data-zoom data-cursor="' . h(t('Ver')) . '"') ?></figure>
    <div class="frasco" aria-hidden="true"><span></span></div>
  </section>

  <?php if ($servicios_on || !$packs): ?>
  <section class="servicios" id="servicios">
    <p class="etiqueta"><?= t('Servicios y precios') ?></p>
    <?php if ($servicios_on && $servicios['categories']): ?>
      <nav class="cats-nav" aria-label="<?= t('Secciones de servicios') ?>">
        <?php foreach ($servicios['categories'] as $cat): ?><a class="pill" href="#cat-<?= $cat['id'] ?>"><?= h($cat['name']) ?></a><?php endforeach; ?>
      </nav>
      <?php $n = 0; foreach ($servicios['categories'] as $ci => $cat): ?>
        <div class="cat" id="cat-<?= $cat['id'] ?>">
          <h2 class="cat-t"><span><?= h($cat['name']) ?></span><span aria-hidden="true"><?= h($cat['name']) ?></span></h2>
          <ul>
            <?php foreach ($cat['services'] as $i => $d): $n++; ?>
              <li class="serv<?= $d['featured'] ? ' serv-destacado' : '' ?>" style="--sangria: <?= (($i + $ci) % 3) * 6 ?>vw; --tono: <?= $tono($n) ?>"<?= $d['photo'] ? ' data-foto="' . h($d['photo']) . '"' : '' ?>>
                <span class="serv-n"><?= sprintf('%02d', $i + 1) ?></span>
                <div class="serv-txt">
                  <h3><?= h($d['name']) ?><?php if ($d['featured']): ?> <em><?= t('Lo más pedido') ?></em><?php endif; ?></h3>
                  <?php if ($d['description']): ?><p><?= h($d['description']) ?></p><?php endif; ?>
                </div>
                <?php if ($d['photo']): ?><img class="serv-foto" src="<?= h($d['photo']) ?>" alt="" loading="lazy" data-zoom data-cursor="<?= h(t('Ver')) ?>" data-zoom-group="servicios" data-zoom-caption="<?= h($d['name']) ?>"><?php endif; ?>
                <span class="serv-dura"><?= h($d['duration_text']) ?></span>
                <span class="serv-precio"><?= precio($d['price'], $d['from']) ?></span>
                <button class="serv-reservar" type="button" data-book data-book-service="<?= $d['id'] ?>" aria-label="<?= h(t('Reservar') . ': ' . $d['name']) ?>"><?= t('Reservar') ?> <span aria-hidden="true">↗</span></button>
              </li>
            <?php endforeach; ?>
          </ul>
        </div>
      <?php endforeach; ?>
      <p class="nota"><?= t('La duración es aproximada. Si tienes alergia a algún producto, dínoslo al reservar.') ?></p>
      <div class="muestra" aria-hidden="true"></div>
    <?php elseif (!$packs): ?>
      <h2 class="titulo"><?= t('Manos, pies y uñas a tu gusto') ?></h2>
      <p><?= t('Los servicios aparecerán aquí en cuanto se añadan desde la app.') ?></p>
    <?php endif; ?>
    <figure class="trabajos" data-parallax="-10"><?= photo_img('trabajos', 900, '(max-width: 760px) 80vw, 28vw', 'loading="lazy" data-zoom data-cursor="' . h(t('Ver')) . '"') ?></figure>
  </section>
  <?php endif; ?>

  <?php if ($packs): ?>
  <section class="packs" id="packs">
    <div class="packs-cab">
      <p class="etiqueta"><?= t('Packs y bonos') ?></p>
      <h2><?= t('Precio cerrado,') ?><br><em><?= t('todo incluido') ?></em></h2>
      <p class="nota"><?= t('Para reservar un pack, elige «Aún no lo sé» en la reserva y dinos en las notas cuál quieres.') ?></p>
    </div>
    <div class="packs-pista">
      <?php foreach ($packs as $pi => $m): ?>
      <article class="pack" id="pack-<?= h($m['id']) ?>" aria-labelledby="pack-t-<?= h($m['id']) ?>" style="--tono: <?= $tono($pi + 2) ?>; --tinta: <?= $tinta($tono($pi + 2)) ?>; --giro: <?= [-4, 3, -2, 5][$pi % 4] ?>deg">
        <p class="pack-dias"><?= h(mb_strtoupper(mb_substr($m['days_text'], 0, 1)) . mb_substr($m['days_text'], 1)) ?><?php if (!$m['every_day']): ?> · <strong><?= $m['today'] ? t('Hoy sí') : t('Hoy no') ?></strong><?php endif; ?></p>
        <h3 id="pack-t-<?= h($m['id']) ?>"><?= h($m['title']) ?></h3>
        <div class="pack-grupos">
          <?php foreach ($m['groups'] as $c): ?>
            <section>
              <h4><?= h($c['name']) ?><?php if (count($c['services']) > 1): ?> <small><?= t('a elegir') ?></small><?php endif; ?></h4>
              <ul>
                <?php foreach ($c['services'] as $d): ?>
                  <li><?php if ($d['photo']): ?><img class="pack-foto" src="<?= h($d['photo']) ?>" alt="" loading="lazy" data-zoom data-zoom-group="pack-<?= h($m['id']) ?>" data-zoom-caption="<?= h($d['name']) ?>"><?php endif; ?><?= h($d['name']) ?><?php if ($d['extra'] > 0): ?> <span class="pack-sup" title="<?= t('Suplemento') ?>">+<?= euros($d['extra']) ?> €</span><?php endif; ?><?php if ($d['desc'] !== ''): ?><small><?= h($d['desc']) ?></small><?php endif; ?></li>
                <?php endforeach; ?>
              </ul>
            </section>
          <?php endforeach; ?>
        </div>
        <?php if ($m['note'] !== ''): ?><p class="pack-nota"><?= nl2br(h($m['note'])) ?></p><?php endif; ?>
        <p class="pack-precio"><?= precio($m['price']) ?></p>
      </article>
      <?php endforeach; ?>
    </div>
    <?php if (count($packs) > 1): ?><p class="packs-n" aria-hidden="true"><b>01</b> / <?= sprintf('%02d', count($packs)) ?> <i></i> <?= t('Desliza') ?></p><?php endif; ?>
  </section>
  <?php endif; ?>

  <section class="cierre" id="reservar">
    <p class="cierre-t" aria-hidden="true"><?php for ($r = 0; $r < 3; $r++): ?><?= t('Reserva') ?> · <?php endfor; ?></p>
    <div class="cierre-txt">
      <p class="etiqueta"><?= t('Reservas') ?></p>
      <h2><?= t('Tu cita en un minuto') ?></h2>
      <p><?= t('Elige el servicio, el día y la hora. Te enviaremos un WhatsApp para confirmar la reserva. Cancelar es siempre gratis.') ?></p>
      <a class="pill pill-llena pill-grande" href="#reservar" data-book data-magnet><?= t('Reservar cita') ?></a>
      <div class="politicas">
        <?php foreach (politicas() as $p): ?>
          <details><summary><?= h($p['titulo'] ?: t('Información')) ?></summary><p><?= h($p['texto']) ?></p></details>
        <?php endforeach; ?>
        <details><summary><?= t('Si llegas tarde') ?></summary><p><?= t('Guardamos tu cita %d minutos desde la hora reservada.', (int)$s['late_minutes']) ?></p></details>
      </div>
    </div>
  </section>

  <section class="app" id="app">
    <p class="etiqueta"><?= t('En tu móvil') ?></p>
    <h2><?= t('Ten %s a un toque', h($s['name'])) ?></h2>
    <p><?= t('Instala la web como una app para reservar y ver los servicios más rápido.') ?></p>
    <button class="pill pill-llena" type="button" data-install hidden><?= t('Instalar la app') ?></button>
    <p data-install-help class="nota"><?= t('En Android o en el ordenador, abre el menú del navegador y elige «Instalar».') ?></p>
    <p data-install-ios hidden class="nota"><?= t('En iPhone: pulsa Compartir y luego «Añadir a pantalla de inicio».') ?></p>
    <p data-install-done hidden class="nota"><?= t('Ya la tienes instalada.') ?></p>
  </section>
</main>
<a class="pill pill-llena flota" href="#reservar" data-book><?= t('Reservar cita') ?></a>
<?php cerrar();
