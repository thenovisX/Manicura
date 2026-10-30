<?php
declare(strict_types=1);
/* Portada. La lógica está aquí; el diseño, en tema/inicio.php. */
require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/pagina.php';
if (!installed()) { header('Location: install.php'); exit; }

tema_render('inicio', [
    'servicios' => servicios_publicos(),   // ['categories' => [...con 'services']] con nombres y descripciones en el idioma de la visita
    'packs' => packs_public(),             // packs y bonos activos traducidos; [] si no hay
    'servicios_on' => servicios_on(),      // ¿el salón quiere mostrar la lista de servicios?
    'packs_button' => packs_button(),      // ¿quiere el botón «Ver packs» en la portada?
]);
