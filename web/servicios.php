<?php
declare(strict_types=1);
/* Página de servicios y precios (opcional). Si el tema tiene tema/servicios.php se pinta; si no, se va a los servicios de la portada. */
require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/pagina.php';
if (!installed()) { header('Location: install.php'); exit; }
if (!tema_tiene('servicios')) { header('Location: ./#servicios', true, 302); exit; }

tema_render('servicios', [
    'servicios' => servicios_publicos(),   // igual que en la portada
    'packs' => packs_public(),             // packs y bonos activos traducidos; [] si no hay
    'servicios_on' => servicios_on(),      // ¿el salón quiere mostrar la lista de servicios?
    'packs_button' => packs_button(),      // ¿quiere el botón «Ver packs» en la portada?
]);
