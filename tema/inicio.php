<?php
/*
 * Portada del tema Base. Variables: $s (ajustes), $cliente (o null), $servicios (secciones con sus servicios), $packs (lista, puede estar vacía), $servicios_on, $packs_button.
 * Funciones útiles: photo_img(), horario_hoy(), politicas(), precio(). Ver TEMA.md.
 */
require __DIR__ . '/partes.php';
abrir($s['name'] . ($s['tagline'] ? ' · ' . $s['tagline'] : ''), 'inicio');
?>
<main id="main">
  <section class="portada">
    <div class="portada-foto"><?= photo_img('portada', 1600, '100vw', 'fetchpriority="high"') ?></div>
    <div class="cont portada-txt">
      <p class="etiqueta"><?= h(in_array(horario_hoy(), [t('Cerrado'), t('Cerrado hoy')], true) ? t('Hoy cerrado') : t('Hoy') . ': ' . horario_hoy()) ?></p>
      <h1><?= h($s['name']) ?></h1>
      <?php if ($s['tagline']): ?><p class="portada-frase"><?= h($s['tagline']) ?></p><?php endif; ?>
      <div class="botones">
        <a class="boton boton-acento" href="#reservar" data-book><?= t('Reservar cita') ?></a>
        <?php if ($servicios_on): ?><a class="boton boton-claro" href="#servicios"><?= t('Servicios y precios') ?></a><?php endif; ?>
        <?php if ($packs && $packs_button): ?><a class="boton boton-claro" href="#packs"><?= t('Ver packs') ?></a><?php endif; ?>
      </div>
    </div>
  </section>

  <section class="seccion" id="nosotros">
    <div class="cont dos">
      <div>
        <p class="etiqueta"><?= t('Nosotros') ?></p>
        <h2 class="titulo"><?= h($s['tagline'] ?: $s['name']) ?></h2>
        <p class="texto-grande"><?= nl2br(h($s['description'] ?: t('Escribe aquí la presentación del salón desde la app: Ajustes → Salón.'))) ?></p>
      </div>
      <figure class="foto-marco"><?= photo_img('salon', 1000, '(max-width: 800px) 100vw, 45vw', 'loading="lazy" data-zoom') ?></figure>
    </div>
  </section>

  <?php if ($servicios_on || !$packs): ?>
  <section class="seccion seccion-papel" id="servicios">
    <div class="cont">
      <p class="etiqueta"><?= t('Servicios y precios') ?></p>
      <h2 class="titulo"><?= t('Manos, pies y uñas a tu gusto') ?></h2>
      <?php if ($servicios_on): ?>
      <?php if (!$servicios['categories']): ?>
        <?php if (!$packs): ?><p><?= t('Los servicios aparecerán aquí en cuanto se añadan desde la app.') ?></p><?php endif; ?>
      <?php else: ?>
        <nav class="secciones-nav" aria-label="<?= t('Secciones de servicios') ?>">
          <?php foreach ($servicios['categories'] as $cat): ?><a href="#cat-<?= $cat['id'] ?>"><?= h($cat['name']) ?></a><?php endforeach; ?>
        </nav>
        <div class="servicios">
          <?php foreach ($servicios['categories'] as $ci => $cat): ?>
            <details class="serv-sec" id="cat-<?= $cat['id'] ?>"<?= $ci === 0 ? ' open' : '' ?>>
              <summary><h3><?= h($cat['name']) ?></h3><span class="serv-sec-n"><?= count($cat['services']) ?></span></summary>
              <ul>
                <?php foreach ($cat['services'] as $d): ?>
                  <li class="serv<?= $d['featured'] ? ' serv-destacado' : '' ?>">
                    <?php if ($d['photo']): ?><img class="serv-foto" src="<?= h($d['photo']) ?>" alt="" loading="lazy" data-zoom data-zoom-group="servicios" data-zoom-caption="<?= h($d['name']) ?>"><?php endif; ?>
                    <div class="serv-txt">
                      <p class="serv-linea"><span class="serv-nombre"><?= h($d['name']) ?></span><span class="serv-precio"><?= precio($d['price'], $d['from']) ?></span></p>
                      <?php if ($d['featured']): ?><p class="serv-marca"><?= t('Lo más pedido') ?></p><?php endif; ?>
                      <?php if ($d['description']): ?><p class="serv-desc"><?= h($d['description']) ?></p><?php endif; ?>
                      <p class="serv-pie"><span class="serv-dura"><?= h($d['duration_text']) ?></span><button class="serv-reservar" type="button" data-book data-book-service="<?= $d['id'] ?>" aria-label="<?= h(t('Reservar') . ': ' . $d['name']) ?>"><?= t('Reservar') ?></button></p>
                    </div>
                  </li>
                <?php endforeach; ?>
              </ul>
            </details>
          <?php endforeach; ?>
        </div>
        <p class="nota"><?= t('La duración es aproximada. Si tienes alergia a algún producto, dínoslo al reservar.') ?></p>
      <?php endif; ?>
      <?php endif; /* servicios_on */ ?>
    </div>
  </section>
  <?php endif; ?>

  <?php if ($packs): ?>
  <section class="seccion" id="packs">
    <div class="cont">
      <p class="etiqueta"><?= t('Packs y bonos') ?></p>
      <h2 class="titulo"><?= t('Precio cerrado, todo incluido') ?></h2>
      <?php if (count($packs) > 1): ?>
        <nav class="secciones-nav" aria-label="<?= t('Packs y bonos') ?>"><?php foreach ($packs as $m): ?><a href="#pack-<?= h($m['id']) ?>"><?= h($m['title']) ?></a><?php endforeach; ?></nav>
      <?php endif; ?>
      <?php foreach ($packs as $m): ?>
      <article class="pack" id="pack-<?= h($m['id']) ?>" aria-labelledby="pack-t-<?= h($m['id']) ?>">
        <div class="pack-cab">
          <h3 id="pack-t-<?= h($m['id']) ?>"><?= h($m['title']) ?></h3>
          <p class="pack-precio"><?= precio($m['price']) ?></p>
          <p class="pack-dias"><?= h(mb_strtoupper(mb_substr($m['days_text'], 0, 1)) . mb_substr($m['days_text'], 1)) ?><?php if (!$m['every_day']): ?> · <strong><?= $m['today'] ? t('Hoy sí') : t('Hoy no') ?></strong><?php endif; ?></p>
        </div>
        <div class="pack-grupos">
          <?php foreach ($m['groups'] as $c): ?>
            <section>
              <h4><?= h($c['name']) ?><?php if (count($c['services']) > 1): ?> <small><?= t('a elegir') ?></small><?php endif; ?></h4>
              <ul>
                <?php foreach ($c['services'] as $d): ?>
                  <li<?= $d['photo'] ? ' class="con-foto"' : '' ?>><?php if ($d['photo']): ?><img class="pack-foto" src="<?= h($d['photo']) ?>" alt="" loading="lazy" data-zoom data-zoom-group="pack-<?= h($m['id']) ?>" data-zoom-caption="<?= h($d['name']) ?>"><?php endif; ?><span><?= h($d['name']) ?><?php if ($d['extra'] > 0): ?> <span class="pack-sup" title="<?= t('Suplemento') ?>">+<?= euros($d['extra']) ?> €</span><?php endif; ?><?php if ($d['desc'] !== ''): ?><small><?= h($d['desc']) ?></small><?php endif; ?></span></li>
                <?php endforeach; ?>
              </ul>
            </section>
          <?php endforeach; ?>
        </div>
        <?php if ($m['note'] !== ''): ?><p class="pack-nota"><?= nl2br(h($m['note'])) ?></p><?php endif; ?>
        <p class="nota"><?= t('Para reservar un pack, elige «Aún no lo sé» en la reserva y dinos en las notas cuál quieres.') ?></p>
      </article>
      <?php endforeach; ?>
    </div>
  </section>
  <?php endif; ?>

  <section class="seccion" id="reservar">
    <div class="cont dos dos-centro">
      <div>
        <p class="etiqueta"><?= t('Reservas') ?></p>
        <h2 class="titulo"><?= t('Reserva tu cita en un minuto') ?></h2>
        <p><?= t('Elige el servicio, el día y la hora. Te enviaremos un WhatsApp para confirmar la reserva. Cancelar es siempre gratis.') ?></p>
        <a class="boton boton-acento" href="#reservar" data-book><?= t('Reservar cita') ?></a>
      </div>
      <div class="politicas">
        <?php foreach (politicas() as $p): ?>
          <details><summary><?= h($p['titulo'] ?: t('Información')) ?></summary><p><?= h($p['texto']) ?></p></details>
        <?php endforeach; ?>
        <details><summary><?= t('Si llegas tarde') ?></summary><p><?= t('Guardamos tu cita %d minutos desde la hora reservada.', (int)$s['late_minutes']) ?></p></details>
      </div>
    </div>
  </section>

  <section class="seccion seccion-papel app" id="app">
    <div class="cont">
      <p class="etiqueta"><?= t('En tu móvil') ?></p>
      <h2 class="titulo"><?= t('Ten %s a un toque', h($s['name'])) ?></h2>
      <p><?= t('Instala la web como una app para reservar y ver los servicios más rápido.') ?></p>
      <button class="boton boton-acento" type="button" data-install hidden><?= t('Instalar la app') ?></button>
      <p data-install-help class="nota"><?= t('En Android o en el ordenador, abre el menú del navegador y elige «Instalar».') ?></p>
      <p data-install-ios hidden class="nota"><?= t('En iPhone: pulsa Compartir y luego «Añadir a pantalla de inicio».') ?></p>
      <p data-install-done hidden class="nota"><?= t('Ya la tienes instalada.') ?></p>
    </div>
  </section>
</main>
<?php cerrar();
