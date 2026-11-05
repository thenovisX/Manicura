<?php
/*
 * Portada del tema Laca. Variables: $s (ajustes), $cliente (o null), $servicios (secciones con sus servicios), $packs (lista, puede estar vacía), $servicios_on, $packs_button.
 * Hecha para reservar sin pensar: cada servicio es una tarjeta que se toca entera y abre la reserva con ese servicio ya elegido.
 * Luego solo queda tocar una hora y «Reservar». Todo el contenido se pinta en HTML y se ve sin JavaScript.
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
      <p class="hero-frase"><?= h($s['tagline'] ?: t('Salón de uñas')) ?><?php if ($ciudad): ?> <em><?= h(t('en %s', $ciudad)) ?></em><?php endif; ?></p>
      <div class="botones">
        <a class="pill pill-llena pill-grande" href="#reservar" data-book><?= t('Reservar cita') ?></a>
        <?php if ($hayServicios): ?><a class="pill pill-grande" href="#servicios"><?= t('Ver precios') ?></a><?php endif; ?>
      </div>
      <ul class="hero-claves">
        <li><b>1</b><?= t('Toca un servicio') ?></li>
        <li><b>2</b><?= t('Elige la hora') ?></li>
        <li><b>3</b><?= t('Listo: te confirmamos por WhatsApp') ?></li>
      </ul>
    </div>
    <figure class="hero-foto"><?= photo_img('portada', 900, '(max-width: 760px) 92vw, 42vw', 'fetchpriority="high"') ?></figure>
  </section>

  <?php if ($servicios_on || !$packs): ?>
  <section class="servicios" id="servicios" aria-labelledby="servicios-t">
    <div class="sec-cab">
      <h2 id="servicios-t" class="sec-t"><?= t('¿Qué te hacemos hoy?') ?></h2>
      <?php if ($hayServicios): ?><p class="nota"><?= t('Toca el que quieras y elige la hora. Sin registrarte.') ?></p><?php endif; ?>
    </div>
    <?php if ($hayServicios): ?>
      <?php if (count($servicios['categories']) > 1): ?>
      <nav class="cats-nav" aria-label="<?= t('Secciones de servicios') ?>">
        <?php foreach ($servicios['categories'] as $cat): ?><a class="chip" href="#cat-<?= $cat['id'] ?>"><?= h($cat['name']) ?></a><?php endforeach; ?>
      </nav>
      <?php endif; ?>
      <?php foreach ($servicios['categories'] as $cat): ?>
        <div class="cat" id="cat-<?= $cat['id'] ?>">
          <?php if (count($servicios['categories']) > 1): ?><h3 class="cat-t"><?= h($cat['name']) ?></h3><?php endif; ?>
          <ul class="servs">
            <?php foreach ($cat['services'] as $d): ?>
              <li class="serv<?= $d['featured'] ? ' serv-destacado' : '' ?>">
                <?php if ($d['photo']): ?><img class="serv-foto" src="<?= h($d['photo']) ?>" alt="" loading="lazy" data-zoom data-zoom-group="servicios" data-zoom-caption="<?= h($d['name']) ?>"><?php endif; ?>
                <div class="serv-txt">
                  <?php if ($d['featured']): ?><p class="serv-tag"><?= t('Lo más pedido') ?></p><?php endif; ?>
                  <h4><?= h($d['name']) ?></h4>
                  <?php if ($d['description']): ?><p><?= h($d['description']) ?></p><?php endif; ?>
                </div>
                <div class="serv-pie">
                  <p class="serv-datos"><strong class="serv-precio"><?= precio($d['price'], $d['from']) ?></strong><span class="serv-dura"><?= h($d['duration_text']) ?></span></p>
                  <button class="serv-btn" type="button" data-book data-book-service="<?= $d['id'] ?>" aria-label="<?= h(t('Reservar') . ': ' . $d['name']) ?>"><?= t('Reservar') ?></button>
                </div>
              </li>
            <?php endforeach; ?>
          </ul>
        </div>
      <?php endforeach; ?>
      <p class="nota servs-nota"><?= t('La duración es aproximada. Si tienes alergia a algún producto, dínoslo al reservar.') ?></p>
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
        <div class="pack-cab">
          <h3 id="pack-t-<?= h($m['id']) ?>"><?= h($m['title']) ?></h3>
          <p class="pack-precio"><?= precio($m['price']) ?></p>
        </div>
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
        <button class="pill pill-llena pack-btn" type="button" data-book data-book-notes="<?= h(t('Quiero el pack «%s».', $m['title'])) ?>"><?= t('Reservar este pack') ?></button>
      </article>
      <?php endforeach; ?>
    </div>
  </section>
  <?php endif; ?>

  <section class="nosotros" id="nosotros" aria-labelledby="nosotros-t">
    <figure class="nosotros-foto"><?= photo_img('salon', 900, '(max-width: 760px) 92vw, 40vw', 'loading="lazy" data-zoom') ?></figure>
    <div class="nosotros-txt">
      <h2 id="nosotros-t" class="sec-t"><?= t('Nosotros') ?></h2>
      <p><?= nl2br(h($s['description'] ?: t('Escribe aquí la presentación del salón desde la app: Ajustes → Salón.'))) ?></p>
    </div>
  </section>

  <section class="cierre" id="reservar" aria-labelledby="reservar-t">
    <div class="cierre-caja">
      <h2 id="reservar-t" class="sec-t"><?= t('¿Te reservamos un hueco?') ?></h2>
      <p><?= t('Elige el servicio y la hora. Te escribimos por WhatsApp para confirmar. Cancelar es siempre gratis.') ?></p>
      <a class="pill pill-llena pill-grande" href="#reservar" data-book><?= t('Reservar cita') ?></a>
    </div>
    <div class="politicas">
      <h3><?= t('Antes de venir') ?></h3>
      <?php foreach (politicas() as $p): ?>
        <details><summary><?= h($p['titulo'] ?: t('Información')) ?></summary><p><?= h($p['texto']) ?></p></details>
      <?php endforeach; ?>
      <details><summary><?= t('Si llegas tarde') ?></summary><p><?= t('Guardamos tu cita %d minutos desde la hora reservada.', (int)$s['late_minutes']) ?></p></details>
      <details class="app" id="app"><summary><?= t('Tenerla como app en el móvil') ?></summary>
        <p><?= t('Instala la web como una app para reservar y ver los servicios más rápido.') ?></p>
        <button class="pill" type="button" data-install hidden><?= t('Instalar la app') ?></button>
        <p data-install-help class="nota"><?= t('En Android o en el ordenador, abre el menú del navegador y elige «Instalar».') ?></p>
        <p data-install-ios hidden class="nota"><?= t('En iPhone: pulsa Compartir y luego «Añadir a pantalla de inicio».') ?></p>
        <p data-install-done hidden class="nota"><?= t('Ya la tienes instalada.') ?></p>
      </details>
    </div>
  </section>
</main>
<a class="pill pill-llena flota" href="#reservar" data-book><?= t('Reservar cita') ?></a>
<?php cerrar();
