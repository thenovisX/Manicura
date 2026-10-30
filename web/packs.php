<?php
declare(strict_types=1);
/* Página de los packs y bonos (opcional). Si el tema tiene tema/packs.php se pinta; si no, se va a los packs de la portada. */
require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/pagina.php';
if (!installed()) { header('Location: install.php'); exit; }
$packs = packs_public();
if (!$packs || !tema_tiene('packs')) { header('Location: ./' . ($packs ? '#packs' : ''), true, 302); exit; }

tema_render('packs', [
    'packs' => $packs,                     // igual que en la portada
    'servicios' => servicios_publicos(),   // por si el tema quiere enlazar a los servicios sueltos
    'servicios_on' => servicios_on(),
]);
