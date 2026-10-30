<?php
/*
 * Piezas comunes del tema Laca: abrir() pinta el <head>, el fondo de laca y la cabecera (con «Reservar» siempre a la vista); cerrar(), el pie.
 * Lo único obligatorio en cualquier tema: llamar a head_tags() dentro de <head> y a body_end() antes de </body>,
 * y tener en el pie los enlaces legales y cookies_link().
 */

function abrir(string $titulo, string $clase = ''): void
{
    $s = settings();
    $c = current_customer();
    ?>
<!doctype html>
<html lang="<?= html_lang() ?>" class="sin-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title><?= h($titulo) ?></title>
<?php head_tags(); ?>
<link rel="preload" href="tema/assets/fonts/fraunces-latin-soft-italic.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="tema/assets/fonts/hanken-grotesk-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="<?= asset('tema.css') ?>">
<script src="<?= asset('tema.js') ?>" defer></script>
</head>
<body class="laca <?= h($clase) ?>">
<div class="liquido" aria-hidden="true"></div>
<a class="skip" href="#main"><?= t('Saltar al contenido') ?></a>
<header class="cab">
  <a class="cab-marca" href="./"><?= h($s['name']) ?></a>
  <nav class="cab-nav" id="menu" aria-label="<?= t('Principal') ?>">
    <?php if (servicios_on() || !packs_public()): ?><a href="./#servicios"><?= t('Servicios') ?></a><?php endif; ?>
    <?php if (packs_public()): ?><a href="./#packs"><?= t('Packs') ?></a><?php endif; ?>
    <a href="./#nosotros"><?= t('Nosotros') ?></a>
    <a href="./#visitanos"><?= t('Visítanos') ?></a>
    <a href="cuenta.php"><?= $c ? t('Mi cuenta') : t('Entrar') ?></a>
  </nav>
  <?= selector_idioma('cab-idiomas') ?>
  <a class="pill pill-llena cab-reservar" href="./#reservar" data-book><?= t('Reservar') ?></a>
  <button class="cab-menu" type="button" aria-expanded="false" aria-controls="menu" aria-label="<?= t('Menú') ?>" data-menu><span></span><span></span></button>
</header>
    <?php
}

function cerrar(): void
{
    $s = settings();
    ?>
<footer class="pie" id="visitanos">
  <p class="pie-titulo"><?= h($s['footer_title'] ?: t('Visítanos')) ?></p>
  <div class="pie-bloque pie-dir">
    <h2><?= t('Visítanos') ?></h2>
    <?php if ($s['address']): ?><p><?= h($s['address']) ?><?= $s['city'] ? '<br>' . h($s['city']) : '' ?><br><a class="subraya" href="<?= h(maps_href()) ?>" target="_blank" rel="noopener"><?= t('Cómo llegar') ?> ↗</a></p><?php endif; ?>
    <p>
      <?php if ($s['phone']): ?><a href="<?= h(tel_href($s['phone'])) ?>"><?= h($s['phone']) ?></a><br><?php endif; ?>
      <?php if ($s['email']): ?><a href="mailto:<?= h($s['email']) ?>"><?= h($s['email']) ?></a><br><?php endif; ?>
      <?php if (wa_href()): ?><a href="<?= h(wa_href()) ?>" target="_blank" rel="noopener">WhatsApp ↗</a><?php endif; ?>
    </p>
    <?php if (redes()): ?><p class="pie-redes"><?php foreach (redes() as $n => $u): ?><a href="<?= h($u) ?>" target="_blank" rel="noopener"><?= $n ?></a><?php endforeach; ?></p><?php endif; ?>
  </div>
  <div class="pie-bloque pie-horario">
    <h2><?= t('Horario') ?></h2>
    <ul>
      <?php foreach (horario() as $d): ?><li<?= $d['hoy'] ? ' class="hoy"' : '' ?>><span><?= $d['dia'] ?></span><span><?= h($d['texto']) ?></span></li><?php endforeach; ?>
    </ul>
  </div>
  <nav class="pie-bloque pie-links" aria-label="<?= t('Información') ?>">
    <h2><?= t('Información') ?></h2>
    <a href="cuenta.php"><?= t('Mi cuenta') ?></a><a href="legal.php#politicas"><?= t('Políticas de reserva') ?></a><a href="legal.php#aviso"><?= t('Aviso legal') ?></a><a href="legal.php#privacidad"><?= t('Privacidad') ?></a><a href="borrar-datos.php"><?= t('Borrar mis datos') ?></a><a href="legal.php#cookies">Cookies</a><?= cookies_link() ?>
  </nav>
  <p class="pie-legal">© <?= date('Y') ?> <?= h($s['name']) ?>.<?php $cr = photo_credits(); if ($cr): ?> <?= t('Fotos de') ?> <?php $i = 0; foreach ($cr as $p): ?><?= $i++ ? ', ' : '' ?><a href="<?= h($p['url']) ?>" target="_blank" rel="noopener"><?= h($p['by']) ?></a><?php endforeach; ?> <?= t('en Unsplash') ?>.<?php endif; ?></p>
</footer>
<?php body_end(); ?>
</body>
</html>
    <?php
}
