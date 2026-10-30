<?php
declare(strict_types=1);
/*
 * CONFIGURACIÓN DEL TEMA. Solo constantes (lo leen también la API y el panel).
 * Este es el tema «Laca»: una portada clara (servicios, precios y «Reservar» a la vista) sobre un fondo de laca muy lento. Para un proyecto nuevo, cambia lo que hay
 * en web/tema/ y nada más. El contrato completo está en TEMA.md, en la raíz del repositorio.
 * El JavaScript se compila desde web/tema/fuente/ (ver su LEEME.md).
 */

const TEMA_NOMBRE = 'Laca';
/** Súbela cuando cambies el CSS o el JS del tema, para que los navegadores descarguen la versión nueva. */
const TEMA_VERSION = '6';

/** Colores para el icono de la app, la barra del navegador y el manifest. */
const TEMA_COLORES = [
    'fondo'  => '#0B0507',   // fondo del icono y color de la barra del navegador en el móvil
    'texto'  => '#F6ECE8',   // letra del icono
    'acento' => '#F2A7B8',   // destello del icono
];

/**
 * Huecos de foto. El cliente las cambia desde la app (Ajustes → Fotos de la web).
 * La primera es la principal (Google y redes sociales la usan como imagen de la web).
 * 'src' puede ser un archivo del tema ('tema/assets/img/portada.jpg') o una foto de Unsplash
 * (https://images.unsplash.com/photo-…; se sirve desde tu servidor). Con Unsplash pon también 'by' y 'url' para los créditos.
 * Las de este tema son dibujos de ejemplo (gotas de esmalte): cámbialas por fotos del salón y de sus trabajos.
 */
const TEMA_FOTOS = [
    'portada' => [
        'label' => 'Portada',
        'src' => 'tema/assets/img/portada.jpg',
        'alt' => 'Gotas de esmalte en tonos rosa',
    ],
    'salon' => [
        'label' => 'Nosotros',
        'src' => 'tema/assets/img/salon.jpg',
        'alt' => 'El salón',
    ],
    'trabajos' => [
        'label' => 'Trabajos',
        'src' => 'tema/assets/img/servicios.jpg',
        'alt' => 'Uñas recién hechas en el salón',
    ],
];

/** ¿El tema incrusta un mapa de Google (con botón «Mostrar el mapa»)? Cambia el texto de cookies. */
const TEMA_GOOGLE_MAPS = false;
