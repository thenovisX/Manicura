<?php
declare(strict_types=1);

function schema_sql(bool $sqlite): array
{
    $ai = $sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT PRIMARY KEY AUTO_INCREMENT';
    $tail = $sqlite ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    return [
        "CREATE TABLE IF NOT EXISTS settings (k VARCHAR(64) PRIMARY KEY, v TEXT NOT NULL)$tail",
        "CREATE TABLE IF NOT EXISTS users (id $ai, username VARCHAR(60) NOT NULL UNIQUE, pass_hash VARCHAR(255) NOT NULL, created_at DATETIME NOT NULL,
            name VARCHAR(80) NOT NULL DEFAULT '', role VARCHAR(10) NOT NULL DEFAULT 'admin', perms VARCHAR(255) NOT NULL DEFAULT '', active TINYINT NOT NULL DEFAULT 1,
            email VARCHAR(512) NOT NULL DEFAULT '', email_idx VARCHAR(64) NOT NULL DEFAULT '')$tail",
        "CREATE TABLE IF NOT EXISTS tokens (token CHAR(64) PRIMARY KEY, user_id INT NOT NULL, created_at DATETIME NOT NULL, last_used DATETIME NOT NULL)$tail",
        "CREATE TABLE IF NOT EXISTS login_attempts (id $ai, ip VARCHAR(64) NOT NULL, at DATETIME NOT NULL)$tail",
        "CREATE TABLE IF NOT EXISTS categories (id $ai, name VARCHAR(80) NOT NULL, position INT NOT NULL DEFAULT 0)$tail",
        "CREATE TABLE IF NOT EXISTS services (id $ai, category_id INT NOT NULL, name VARCHAR(120) NOT NULL, description TEXT NOT NULL,
            price DECIMAL(8,2) NOT NULL DEFAULT 0, price_from TINYINT NOT NULL DEFAULT 0, duration INT NOT NULL DEFAULT 60, photo VARCHAR(255) NOT NULL DEFAULT '',
            available TINYINT NOT NULL DEFAULT 1, featured TINYINT NOT NULL DEFAULT 0, position INT NOT NULL DEFAULT 0)$tail",
        "CREATE TABLE IF NOT EXISTS reservations (id $ai, name VARCHAR(512) NOT NULL, phone VARCHAR(255) NOT NULL, email VARCHAR(512) NOT NULL DEFAULT '', email_idx VARCHAR(64) NOT NULL DEFAULT '',
            rdate DATE NOT NULL, rtime CHAR(5) NOT NULL, people INT NOT NULL, notes TEXT NOT NULL,
            service_id INT NOT NULL DEFAULT 0, service VARCHAR(120) NOT NULL DEFAULT '', duration INT NOT NULL DEFAULT 0, status VARCHAR(20) NOT NULL DEFAULT 'pendiente',
            source VARCHAR(10) NOT NULL DEFAULT 'web', ip VARCHAR(64) NOT NULL DEFAULT '', created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
            customer_id INT NOT NULL DEFAULT 0, verify_token VARCHAR(255) NOT NULL DEFAULT '', seq INT NOT NULL DEFAULT 0,
            cancel_by VARCHAR(12) NOT NULL DEFAULT '', deleted TINYINT NOT NULL DEFAULT 0, lang CHAR(2) NOT NULL DEFAULT 'es',
            reminders TINYINT NOT NULL DEFAULT 0)$tail",
        "CREATE TABLE IF NOT EXISTS translations (h CHAR(40) NOT NULL, lang CHAR(2) NOT NULL, src TEXT NOT NULL, txt TEXT NOT NULL, manual TINYINT NOT NULL DEFAULT 0, at DATETIME NOT NULL, PRIMARY KEY (h, lang))$tail",
        "CREATE TABLE IF NOT EXISTS customers (id $ai, name VARCHAR(512) NOT NULL, email VARCHAR(512) NOT NULL, email_idx VARCHAR(64) NOT NULL DEFAULT '', phone VARCHAR(255) NOT NULL DEFAULT '',
            pass_hash VARCHAR(255) NOT NULL, created_at DATETIME NOT NULL, last_login DATETIME NULL,
            verified_at DATETIME NULL, verify_hash VARCHAR(64) NOT NULL DEFAULT '', verify_expires DATETIME NULL)$tail",
        "CREATE TABLE IF NOT EXISTS audit_log (id $ai, at DATETIME NOT NULL, customer_id INT NOT NULL DEFAULT 0, event VARCHAR(40) NOT NULL,
            detail VARCHAR(255) NOT NULL DEFAULT '', ip VARCHAR(512) NOT NULL DEFAULT '', ua VARCHAR(255) NOT NULL DEFAULT '')$tail",
        "CREATE TABLE IF NOT EXISTS erase_requests (id $ai, kind VARCHAR(10) NOT NULL, contact VARCHAR(512) NOT NULL, token_hash CHAR(64) NOT NULL DEFAULT '',
            status VARCHAR(10) NOT NULL DEFAULT 'nueva', ip VARCHAR(64) NOT NULL DEFAULT '', created_at DATETIME NOT NULL, expires_at DATETIME NULL)$tail",
        "CREATE TABLE IF NOT EXISTS password_resets (id $ai, kind VARCHAR(10) NOT NULL, subject_id INT NOT NULL, token_hash CHAR(64) NOT NULL,
            created_at DATETIME NOT NULL, expires_at DATETIME NOT NULL, used_at DATETIME NULL)$tail",
        'CREATE INDEX idx_reset_hash ON password_resets (token_hash)',
        'CREATE INDEX idx_res_date ON reservations (rdate)',
        'CREATE INDEX idx_service_cat ON services (category_id)',
        'CREATE INDEX idx_res_customer ON reservations (customer_id)',
        'CREATE INDEX idx_res_email ON reservations (email_idx)',
        'CREATE INDEX idx_cus_email ON customers (email_idx)',
    ];
}

/**
 * Servicios de ejemplo para que la web no salga vacía. Se editan desde la app.
 * Cada uno: [nombre, descripción, precio, duración en minutos, destacado, precio «desde»].
 */
function sample_services(): array
{
    return [
        'Manos' => [
            ['Manicura express', 'Limado, cutículas, hidratación y esmalte normal.', 15.0, 30, 0, 0],
            ['Manicura semipermanente', 'Esmaltado que dura hasta tres semanas sin perder brillo.', 22.0, 45, 1, 0],
            ['Manicura rusa', 'Limpieza profunda de cutícula con torno y esmaltado semipermanente.', 32.0, 75, 1, 0],
            ['Retirada de semipermanente', 'Sin dañar la uña natural.', 8.0, 15, 0, 0],
        ],
        'Uñas' => [
            ['Uñas de gel', 'Construcción completa con tips o molde, forma y largo a elegir.', 40.0, 90, 1, 0],
            ['Relleno de gel', 'Hasta cuatro semanas desde la última sesión.', 30.0, 75, 0, 0],
            ['Uñas acrílicas', 'Construcción completa en acrílico.', 45.0, 90, 0, 0],
            ['Nail art', 'Diseños a mano, piedras, foil o efecto espejo. Precio según el diseño.', 3.0, 15, 0, 1],
        ],
        'Pies' => [
            ['Pedicura completa', 'Baño, durezas, cutículas, exfoliación, masaje y esmalte.', 30.0, 60, 0, 0],
            ['Pedicura semipermanente', 'Pedicura completa con esmaltado de larga duración.', 35.0, 60, 1, 0],
            ['Spa de pies', 'Pedicura completa con mascarilla y parafina.', 42.0, 75, 0, 0],
        ],
        'Extras' => [
            ['Parafina de manos', 'Hidratación intensa para manos secas.', 10.0, 15, 0, 0],
            ['Reparación de una uña', '', 4.0, 10, 0, 0],
        ],
    ];
}
