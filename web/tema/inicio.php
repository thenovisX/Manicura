<?php
/*
 * Portada del tema Laca. Variables: $s (ajustes), $cliente (o null), $servicios (secciones con sus servicios), $packs (lista, puede estar vacía), $servicios_on, $packs_button.
 * Pensada para entenderse de un vistazo: qué es, cómo se reserva, qué cuesta cada cosa y un botón «Reservar» siempre a mano.
 * Todo el contenido se pinta en HTML y se ve sin JavaScript; assets/tema.js solo pone el fondo, el menú del móvil y el botón flotante.
 */
require __DIR__ . '/partes.php';
abrir($s['name'] . ($s['tagline'] ? ' · ' . $s['tagline'] : ''), 'inicio');

$cerrado = in_array(horario_hoy(), [t('Cerrado'), t('Cerrado hoy')], true);
$ciudad = trim(preg_replace('/^\d+\s*/', '', (string)$s['city']));
$hayServicios = $servicios_on && $servicios['categories'];
?>
<main id="main">
  <section class="hero">
    <div class="hero-txt">
      <p class="hoy"><span class="punto<?= $cerrado ? ' punto-off' : '' ?>"></span><?= h($cerrado ? t('Hoy cerrado') : t('Hoy abierto') . ' · ' . horario_hoy()) ?></p>
      <h1 class="hero-t"><?= h($s['name']) ?></h1>
      <?php if ($s['tagline'] || $ciudad): ?><p class="hero-frase"><?= h($s['tagline'] ?: t('Salón de uñas')) ?><?php if ($ciudad): ?> <em><?= h(t('en %s', $ciudad)) ?></em><?php endif; ?></p><?php endif; ?>
      <p class="hero-lead"><?= t('Reserva online en un minuto: eliges el servicio, ves el precio y lo que dura, y escoges día y hora. Te confirmamos por WhatsApp.') ?></p>
      <div class="botones">
        <a class="pill pill-llena pill-grande" href="#reservar" data-book><?= t('Reservar cita') ?></a>
        <?php if ($hayServicios): ?><a class="pill pill-grande" href="#servicios"><?= t('Ver servicios y precios') ?></a><?php endif; ?>
      </div>
    </div>
    <figure class="hero-foto"><?= photo_img('portada', 900, '(max-width: 760px) 90vw, 40vw', 'fetchpriority="high"') ?></figure>
  </section>

  <section class="pasos" aria-labelledby="pasos-t">
    <h2 id="pasos-t" class="sec-t"><?= t('Cómo reservar') ?></h2>
    <ol>
      <li><b>1</b><h3><?= t('Elige el servicio') ?></h3><p><?= t('Verás el precio y cuánto dura antes de seguir.') ?></p></li>
      <li><b>2</b><h3><?= t('Elige día y hora') ?></h3><p><?= t('Solo aparecen las horas que están libres.') ?></p></li>
      <li><b>3</b><h3><?= t('Revisa y envía') ?></h3><p><?= t('Te escribimos por WhatsApp para confirmar. Cancelar es siempre gratis.') ?></p></li>
    </ol>
  </section>

  <?php if ($servicios_on || !$packs): ?>
  <section class="servicios" id="servicios" aria-labelledby="servicios-t">
    <div class="sec-cab">
      <h2 id="servicios-t" class="sec-t"><?= t('Servicios y precios') ?></h2>
      <?php if ($hayServicios): ?><p class="nota"><?= t('La duración es aproximada. Si tienes alergia a algún producto, dínoslo al reservar.') ?></p><?php endif; ?>
    </div>
    <?php if ($hayServicios): ?>
      <?php if (count($servicios['categories']) > 1): ?>
      <nav class="cats-nav" aria-label="<?= t('Secciones de servicios') ?>">
        <?php foreach ($servicios['categories'] as $cat): ?><a class="pill pill-chica" href="#cat-<?= $cat['id'] ?>"><?= h($cat['name']) ?></a><?php endforeach; ?>
      </nav>
      <?php endif; ?>
      <?php foreach ($servicios['categories'] as $cat): ?>
        <div class="cat" id="cat-<?= $cat['id'] ?>">
          <h3 class="cat-t"><?= h($cat['name']) ?></h3>
          <ul class="servs">
            <?php foreach ($cat['services'] as $d): ?>
              <li class="serv<?= $d['featured'] ? ' serv-destacado' : '' ?>">
                <?php if ($d['photo']): ?><img class="serv-foto" src="<?= h($d['photo']) ?>" alt="" loading="lazy" data-zoom data-zoom-group="servicios" data-zoom-caption="<?= h($d['name']) ?>"><?php endif; ?>
                <div class="serv-txt">
                  <h4><?= h($d['name']) ?><?php if ($d['featured']): ?> <em><?= t('Lo más pedido') ?></em><?php endif; ?></h4>
                  <?php if ($d['description']): ?><p><?= h($d['description']) ?></p><?php endif; ?>
                </div>
                <p class="serv-datos"><span class="serv-dura"><?= h($d['duration_text']) ?></span><strong class="serv-precio"><?= precio($d['price'], $d['from']) ?></strong></p>
                <button class="pill serv-reservar" type="button" data-book data-book-service="<?= $d['id'] ?>" aria-label="<?= h(t('Reservar') . ': ' . $d['name']) ?>"><?= t('Reservar') ?></button>
              </li>
            <?php endforeach; ?>
          </ul>
        </div>
      <?php endforeach; ?>
    <?php elseif (!$packs): ?>
      <p><?= t('Los servicios aparecerán aquí en cuanto se añadan desde la app.') ?></p>
    <?php endif; ?>
  </section>
  <?php endif; ?>

  <?php if ($packs): ?>
  <section class="packs" id="packs" aria-labelledby="packs-t">
    <div class="sec-cab">
      <h2 id="packs-t" class="sec-t"><?= t('Packs y bonos') ?></h2>
      <p class="nota"><?= t('Precio cerrado, todo incluido.') ?></p>
    </div>
    <div class="packs-lista">
      <?php foreach ($packs as $m): ?>
      <article class="pack" id="pack-<?= h($m['id']) ?>" aria-labelledby="pack-t-<?= h($m['id']) ?>">
        <h3 id="pack-t-<?= h($m['id']) ?>"><?= h($m['title']) ?></h3>
        <p class="pack-dias"><?= h(mb_strtoupper(mb_substr($m['days_text'], 0, 1)) . mb_substr($m['days_text'], 1)) ?><?php if (!$m['every_day']): ?> · <strong><?= $m['today'] ? t('Hoy sí') : t('Hoy no') ?></strong><?php endif; ?></p>
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
        <div class="pack-pie">
          <p class="pack-precio"><?= precio($m['price']) ?></p>
          <button class="pill pill-llena" type="button" data-book data-book-notes="<?= h(t('Quiero el pack «%s».', $m['title'])) ?>"><?= t('Reservar este pack') ?></button>
        </div>
      </article>
      <?php endforeach; ?>
    </div>
  </section>
  <?php endif; ?>

  <section class="nosotros" id="nosotros" aria-labelledby="nosotros-t">
    <div class="nosotros-txt">
      <h2 id="nosotros-t" class="sec-t"><?= t('Nosotros') ?></h2>
      <p><?= nl2br(h($s['description'] ?: t('Escribe aquí la presentación del salón desde la app: Ajustes → Salón.'))) ?></p>
    </div>
    <figure class="nosotros-foto"><?= photo_img('salon', 900, '(max-width: 760px) 90vw, 36vw', 'loading="lazy" data-zoom') ?></figure>
  </section>

  <section class="cierre" id="reservar" aria-labelledby="reservar-t">
    <h2 id="reservar-t" class="sec-t"><?= t('Reserva tu cita') ?></h2>
    <p><?= t('Elige el servicio, el día y la hora. Antes de enviar verás un resumen con todo. Te enviaremos un WhatsApp para confirmar la reserva.') ?></p>
    <a class="pill pill-llena pill-grande" href="#reservar" data-book><?= t('Reservar cita') ?></a>
    <div class="politicas">
      <h3><?= t('Antes de venir') ?></h3>
      <?php foreach (politicas() as $p): ?>
        <details><summary><?= h($p['titulo'] ?: t('Información')) ?></summary><p><?= h($p['texto']) ?></p></details>
      <?php endforeach; ?>
      <details><summary><?= t('Si llegas tarde') ?></summary><p><?= t('Guardamos tu cita %d minutos desde la hora reservada.', (int)$s['late_minutes']) ?></p></details>
    </div>
  </section>

  <section class="app" id="app">
    <h2><?= t('Ten %s a un toque', h($s['name'])) ?></h2>
    <p><?= t('Instala la web como una app para reservar y ver los servicios más rápido.') ?></p>
    <button class="pill" type="button" data-install hidden><?= t('Instalar la app') ?></button>
    <p data-install-help class="nota"><?= t('En Android o en el ordenador, abre el menú del navegador y elige «Instalar».') ?></p>
    <p data-install-ios hidden class="nota"><?= t('En iPhone: pulsa Compartir y luego «Añadir a pantalla de inicio».') ?></p>
    <p data-install-done hidden class="nota"><?= t('Ya la tienes instalada.') ?></p>
  </section>
</main>
<a class="pill pill-llena flota" href="#reservar" data-book><?= t('Reservar cita') ?></a>
<?php cerrar();
