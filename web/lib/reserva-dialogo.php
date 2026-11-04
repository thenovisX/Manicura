<?php
/*
 * Ventana de reserva en una sola pantalla (la controla sdk/salon.js). Se abre con cualquier elemento que tenga data-book.
 * Pensada para reservar con tres toques: el servicio (o ya viene elegido con data-book-service), la hora y «Reservar».
 * Arriba va el servicio, debajo el día y la hora, y cuando eliges hora aparece «¿A nombre de quién?». Si el cliente ya
 * reservó desde ese móvil (o tiene cuenta), sus datos salen puestos y no tiene que escribir nada.
 * Abajo, siempre a la vista, una barra con lo que se reserva y el botón «Reservar».
 * Sus colores y tipografías se cambian desde el tema con variables CSS (--r-bg, --r-text, --r-accent…; ver TEMA.md).
 * Todas sus clases empiezan por bk- para no chocar con el tema.
 */
$s = settings();
$c = current_customer();
$wa = wa_number($s['whatsapp']);
$servicios = reserva_servicios();
$maxP = (int)$s['max_people'];
?>
<dialog class="bk" id="bk" aria-labelledby="bk-title">
  <form class="bk-in" id="bk-form" method="dialog" novalidate>
    <header class="bk-head">
      <h2 class="bk-h" id="bk-title"><?= t('Reservar cita') ?></h2>
      <button class="bk-close" type="button" data-close aria-label="<?= t('Cerrar') ?>">×</button>
    </header>

    <div class="bk-body" id="bk-body">
      <?php if ($servicios): ?>
      <section class="bk-blk" id="bk-b-svc" aria-labelledby="bk-svc-t">
        <h3 class="bk-blk-t" id="bk-svc-t"><?= t('¿Qué te hacemos?') ?></h3>
        <div class="bk-picked" id="bk-picked" hidden>
          <span><b id="bk-picked-n"></b><small id="bk-picked-m"></small></span>
          <button type="button" class="bk-link" id="bk-svc-change"><?= t('Cambiar') ?></button>
        </div>
        <div class="bk-svcs" id="bk-svcs">
          <?php foreach ($servicios as $sec): ?>
            <?php if (count($servicios) > 1): ?><p class="bk-svc-sec"><?= h($sec['name']) ?></p><?php endif; ?>
            <?php foreach ($sec['services'] as $d): ?>
              <button type="button" class="bk-svc" data-svc="<?= $d['id'] ?>"><b><?= h($d['name']) ?></b><small><?= h($d['time']) ?></small><em><?= h($d['price']) ?></em></button>
            <?php endforeach; ?>
          <?php endforeach; ?>
          <button type="button" class="bk-svc bk-svc-nose" data-svc="0"><b><?= t('Aún no lo sé') ?></b><small><?= t('Te ayudamos a elegir en el salón') ?></small></button>
        </div>
      </section>
      <?php endif; ?>

      <section class="bk-blk" id="bk-b-when" aria-labelledby="bk-when-t" <?= $servicios ? 'hidden' : '' ?>>
        <h3 class="bk-blk-t" id="bk-when-t"><?= t('¿Cuándo te viene bien?') ?></h3>
        <div class="bk-days" id="bk-days" role="radiogroup" aria-label="<?= t('Día') ?>"></div>
        <div id="bk-slots" class="bk-slots" aria-live="polite"></div>
        <?php if ($maxP > 1): ?>
        <details class="bk-mas" id="bk-people-d">
          <summary><?= t('¿Venís varias personas?') ?></summary>
          <div class="bk-chips" id="bk-people" role="radiogroup" aria-label="<?= t('Personas') ?>">
            <?php for ($i = 1; $i <= min(6, $maxP); $i++): ?>
              <label><input type="radio" name="people" value="<?= $i ?>" <?= $i === 1 ? 'checked' : '' ?>><span><?= $i ?></span></label>
            <?php endfor; ?>
          </div>
          <p class="bk-help"><?= t('Cada persona ocupa un puesto a la vez. Si queréis servicios distintos, decídnoslo en la nota.') ?></p>
        </details>
        <?php endif; ?>
      </section>

      <section class="bk-blk" id="bk-b-who" aria-labelledby="bk-who-t" hidden>
        <h3 class="bk-blk-t" id="bk-who-t"><?= t('¿A nombre de quién?') ?></h3>
        <p class="bk-who" id="bk-who" hidden>
          <span class="bk-who-av" id="bk-who-av" aria-hidden="true"></span>
          <span><strong id="bk-who-n"></strong><small id="bk-who-p"></small></span>
          <button type="button" class="bk-link" id="bk-not-me"><?= t('No soy yo') ?></button>
        </p>
        <div class="bk-fields" id="bk-fields">
          <label><span><?= t('Tu nombre') ?></span><input name="name" maxlength="80" autocomplete="name" autocapitalize="words" enterkeyhint="next"></label>
          <label><span><?= t('Tu móvil') ?></span><input name="phone" type="tel" inputmode="tel" maxlength="30" autocomplete="tel" enterkeyhint="done"></label>
          <p class="bk-help"><?= t('Te mandamos un WhatsApp para confirmar. Nada más.') ?></p>
          <label class="bk-check"><input type="checkbox" id="bk-remember" checked><span><?= t('Recordar mis datos en este dispositivo') ?></span></label>
        </div>
        <details class="bk-mas" id="bk-notes-d">
          <summary><?= t('Añadir una nota o un email (opcional)') ?></summary>
          <label><span><?= t('Nota para el salón') ?></span><textarea name="notes" rows="2" maxlength="500" placeholder="<?= t('Diseño o color que te gustaría, alergias, si vienes con gel de otro salón…') ?>"></textarea></label>
          <label><span><?= t('Email para recibir la confirmación') ?></span><input name="email" type="email" maxlength="120" autocomplete="email"></label>
        </details>
        <label class="bk-hp" aria-hidden="true"><?= t('No rellenar') ?> <input name="website" tabindex="-1" autocomplete="off"></label>
        <p class="bk-legal"><?= t('Al pulsar «Reservar» aceptas las <a href="legal.php#politicas" target="_blank">políticas de reserva</a> y las <a href="legal.php#condiciones" target="_blank">condiciones</a>, y has leído la <a href="legal.php#privacidad" target="_blank">privacidad</a>.') ?> <?= t('Cancelar es siempre gratis.') ?></p>
        <details class="bk-mas bk-mas-chica">
          <summary><?= t('Protección de datos') ?></summary>
          <p class="bk-help"><?= t('Responsable: %s. Finalidad: gestionar tu reserva; el teléfono solo se usa para enviarte el WhatsApp de confirmación. Tus datos se borran 24 horas después de la reserva y no se ceden a nadie. Puedes acceder a ellos, corregirlos o borrarlos escribiendo a %s.', h($s['owner_name'] ?: $s['name']), h($s['email'] ?: $s['phone'] ?: t('nuestro contacto'))) ?> <a href="legal.php#privacidad" target="_blank"><?= t('Más información') ?></a>.</p>
        </details>
      </section>
    </div>

    <footer class="bk-foot" id="bk-foot">
      <p class="bk-err" id="bk-err" role="alert"></p>
      <div class="bk-bar">
        <p class="bk-sum" aria-live="polite"><b id="bk-sum1"></b><small id="bk-sum2"></small></p>
        <button class="bk-btn bk-btn-main" type="button" id="bk-send" disabled><?= t('Reservar') ?></button>
      </div>
      <?php if ($s['phone'] || $wa): ?>
      <p class="bk-alt"><?= t('¿Prefieres llamar o escribir?') ?>
        <?php if ($s['phone']): ?><a id="bk-call" href="<?= h(tel_href($s['phone'])) ?>"><?= t('Llamar') ?></a><?php endif; ?>
        <?php if ($wa): ?><a href="https://wa.me/<?= h($wa) ?>" target="_blank" rel="noopener">WhatsApp</a><?php endif; ?>
        <small id="bk-call-txt"></small>
      </p>
      <?php endif; ?>
    </footer>

    <section class="bk-done" id="bk-done" hidden>
      <p class="bk-done-mark" aria-hidden="true">✓</p>
      <h3 class="bk-h" id="bk-done-t"><?= t('¡Petición enviada!') ?></h3>
      <p class="bk-done-cita" id="bk-done-cita"></p>
      <p id="bk-done-msg"></p>
      <p class="bk-done-more" id="bk-done-more"></p>
      <button class="bk-btn bk-btn-main" type="button" data-close><?= t('Hecho') ?></button>
    </section>
  </form>
</dialog>
