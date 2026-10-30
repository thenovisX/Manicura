<?php
declare(strict_types=1);

/** Duración por defecto de un servicio nuevo, en minutos. */
const SERVICE_MINUTES = 60;

/** «45 min», «1 h», «1 h 30 min». */
function minutes_text(int $m): string
{
    if ($m < 60) return $m . ' min';
    return intdiv($m, 60) . ' h' . ($m % 60 ? ' ' . ($m % 60) . ' min' : '');
}

function service_out(array $d): array
{
    return [
        'id' => (int)$d['id'], 'category_id' => (int)$d['category_id'], 'name' => $d['name'],
        'description' => $d['description'], 'price' => (float)$d['price'], 'from' => (bool)$d['price_from'],
        'duration' => (int)$d['duration'], 'duration_text' => minutes_text((int)$d['duration']),
        'photo' => $d['photo'] === '' ? '' : (preg_match('#^https?://#', $d['photo']) ? $d['photo'] : base_url() . '/' . $d['photo']),
        'available' => (bool)$d['available'], 'featured' => (bool)$d['featured'], 'position' => (int)$d['position'],
    ];
}

/** Servicios agrupados por secciones (Manos, Pies, Uñas…). $all = incluir los que no se ofrecen ahora (para el panel). */
function services_data(bool $all): array
{
    $cats = q('SELECT * FROM categories ORDER BY position, id')->fetchAll();
    $services = q('SELECT * FROM services ' . ($all ? '' : 'WHERE available = 1 ') . 'ORDER BY position, id')->fetchAll();
    $by = [];
    foreach ($services as $d) $by[(int)$d['category_id']][] = service_out($d);
    $out = [];
    foreach ($cats as $c) {
        $items = $by[(int)$c['id']] ?? [];
        if (!$all && !$items) continue;
        $out[] = ['id' => (int)$c['id'], 'name' => $c['name'], 'position' => (int)$c['position'], 'services' => $items];
    }
    return ['categories' => $out];
}

/** Servicio que se puede reservar online (disponible), o null. */
function bookable_service(int $id): ?array
{
    if ($id <= 0) return null;
    $d = q('SELECT * FROM services WHERE id = ? AND available = 1', [$id])->fetch();
    return $d ? service_out($d) : null;
}

function save_category(array $in): array
{
    $name = str_in($in, 'name', 80, true, 'nombre de la sección');
    $id = (int)($in['id'] ?? 0);
    if ($id) {
        q('UPDATE categories SET name = ? WHERE id = ?', [$name, $id]);
    } else {
        $pos = (int)q('SELECT COALESCE(MAX(position), 0) + 1 FROM categories')->fetchColumn();
        q('INSERT INTO categories (name, position) VALUES (?, ?)', [$name, $pos]);
        $id = (int)db()->lastInsertId();
    }
    return ['id' => $id, 'name' => $name];
}

function delete_category(int $id): void
{
    $n = (int)q('SELECT COUNT(*) FROM services WHERE category_id = ?', [$id])->fetchColumn();
    if ($n) throw new ValidationError("Esta sección tiene $n servicios. Muévelos o bórralos antes.");
    q('DELETE FROM categories WHERE id = ?', [$id]);
}

function get_service(int $id): array
{
    $d = q('SELECT * FROM services WHERE id = ?', [$id])->fetch();
    if (!$d) throw new ValidationError('El servicio no existe');
    return $d;
}

function save_service(array $in, ?array $file): array
{
    $id = (int)($in['id'] ?? 0);
    $cat = (int)($in['category_id'] ?? 0);
    if (!q('SELECT id FROM categories WHERE id = ?', [$cat])->fetch()) throw new ValidationError('Elige una sección');
    $name = str_in($in, 'name', 120, true, 'nombre del servicio');
    $desc = mb_substr(trim((string)($in['description'] ?? '')), 0, 400);
    $price = round((float)str_replace(',', '.', (string)($in['price'] ?? '0')), 2);
    if ($price < 0 || $price > 9999) throw new ValidationError('Precio no válido');
    $from = filter_var($in['from'] ?? false, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
    $dur = (int)($in['duration'] ?? SERVICE_MINUTES);
    if ($dur < 5 || $dur > 600) throw new ValidationError('La duración tiene que estar entre 5 minutos y 10 horas');
    $available = filter_var($in['available'] ?? true, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
    $featured = filter_var($in['featured'] ?? false, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;

    if ($id) {
        $old = get_service($id);
        q('UPDATE services SET category_id=?, name=?, description=?, price=?, price_from=?, duration=?, available=?, featured=? WHERE id=?',
            [$cat, $name, $desc, $price, $from, $dur, $available, $featured, $id]);
    } else {
        $pos = (int)q('SELECT COALESCE(MAX(position), 0) + 1 FROM services WHERE category_id = ?', [$cat])->fetchColumn();
        q('INSERT INTO services (category_id, name, description, price, price_from, duration, photo, available, featured, position) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [$cat, $name, $desc, $price, $from, $dur, '', $available, $featured, $pos]);
        $id = (int)db()->lastInsertId();
        $old = get_service($id);
    }

    if (filter_var($in['remove_photo'] ?? false, FILTER_VALIDATE_BOOLEAN) && $old['photo']) {
        remove_upload($old['photo']);
        q("UPDATE services SET photo = '' WHERE id = ?", [$id]);
    }
    if ($file && ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
        $path = store_photo($file, $id);
        if ($old['photo']) remove_upload($old['photo']);
        q('UPDATE services SET photo = ? WHERE id = ?', [$path, $id]);
    }
    return service_out(get_service($id));
}

function toggle_service(int $id, bool $available): array
{
    get_service($id);
    q('UPDATE services SET available = ? WHERE id = ?', [$available ? 1 : 0, $id]);
    return service_out(get_service($id));
}

function delete_service(int $id): void
{
    $d = get_service($id);
    if ($d['photo']) remove_upload($d['photo']);
    q('DELETE FROM services WHERE id = ?', [$id]);
}

/** Sube o baja un servicio (dir = -1 / 1) dentro de su sección. */
function move_service(int $id, int $dir): void
{
    $d = get_service($id);
    $list = q('SELECT id FROM services WHERE category_id = ? ORDER BY position, id', [$d['category_id']])->fetchAll(PDO::FETCH_COLUMN);
    $i = array_search($id, array_map('intval', $list), true);
    $j = $i + ($dir < 0 ? -1 : 1);
    if ($i === false || $j < 0 || $j >= count($list)) return;
    [$list[$i], $list[$j]] = [$list[$j], $list[$i]];
    foreach ($list as $pos => $did) q('UPDATE services SET position = ? WHERE id = ?', [$pos + 1, (int)$did]);
}

function move_category(int $id, int $dir): void
{
    $list = array_map('intval', q('SELECT id FROM categories ORDER BY position, id')->fetchAll(PDO::FETCH_COLUMN));
    $i = array_search($id, $list, true);
    $j = $i + ($dir < 0 ? -1 : 1);
    if ($i === false || $j < 0 || $j >= count($list)) return;
    [$list[$i], $list[$j]] = [$list[$j], $list[$i]];
    foreach ($list as $pos => $cid) q('UPDATE categories SET position = ? WHERE id = ?', [$pos + 1, $cid]);
}

/* ---------- Fotos ---------- */

function uploads_dir(): string
{
    $dir = dirname(__DIR__) . '/uploads';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    return $dir;
}

function remove_upload(string $rel): void
{
    // Solo archivos sueltos de uploads/ (nada de «uploads/../config.php»)
    if (!preg_match('#^uploads/[A-Za-z0-9_-][A-Za-z0-9._-]*$#', $rel) || str_contains($rel, '..')) return;
    $f = dirname(__DIR__) . '/' . $rel;
    if (is_file($f)) @unlink($f);
}

function store_photo(array $file, int $serviceId): string
{
    return store_image($file, 'servicio-' . $serviceId, 1200);
}

function store_image(array $file, string $prefix, int $max): string
{
    if ($file['error'] !== UPLOAD_ERR_OK) {
        throw new ValidationError($file['error'] === UPLOAD_ERR_INI_SIZE || $file['error'] === UPLOAD_ERR_FORM_SIZE
            ? 'La foto pesa demasiado' : 'No se pudo subir la foto');
    }
    if ($file['size'] > 12 * 1024 * 1024) throw new ValidationError('La foto pesa demasiado (máx. 12 MB)');
    $info = @getimagesize($file['tmp_name']);
    if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) {
        throw new ValidationError('La foto tiene que ser JPG, PNG o WEBP');
    }
    $name = 'uploads/' . $prefix . '-' . bin2hex(random_bytes(4)) . '.jpg';
    $dest = dirname(__DIR__) . '/' . $name;
    uploads_dir();

    if (!function_exists('imagecreatetruecolor')) {
        if ($info[2] !== IMAGETYPE_JPEG) throw new ValidationError('Sube la foto en JPG');
        move_uploaded_file($file['tmp_name'], $dest);
        return $name;
    }
    $src = match ($info[2]) {
        IMAGETYPE_JPEG => @imagecreatefromjpeg($file['tmp_name']),
        IMAGETYPE_PNG  => @imagecreatefrompng($file['tmp_name']),
        IMAGETYPE_WEBP => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($file['tmp_name']) : false,
    };
    if (!$src) throw new ValidationError('No se pudo leer la foto');

    // Corrige el giro de las fotos hechas con el móvil
    if ($info[2] === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
        $o = (int)(@exif_read_data($file['tmp_name'])['Orientation'] ?? 1);
        $rot = [3 => 180, 6 => -90, 8 => 90][$o] ?? 0;
        if ($rot) $src = imagerotate($src, $rot, 0);
    }
    $w = imagesx($src);
    $hgt = imagesy($src);
    $scale = min(1, $max / max($w, $hgt));
    $nw = (int)round($w * $scale);
    $nh = (int)round($hgt * $scale);
    $dst = imagecreatetruecolor($nw, $nh);
    imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
    imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $hgt);
    imagejpeg($dst, $dest, 82);
    return $name;
}

/* ---------- Fotos de la web (portada, nosotros, galería) ---------- */


function web_photo_set(string $key, ?array $file): array
{
    if (!isset(tema_fotos()[$key])) throw new ValidationError('Foto no válida');
    if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) throw new ValidationError('Elige una foto');
    $photos = settings()['photos'];
    $path = store_image($file, 'web-' . $key, array_key_first(tema_fotos()) === $key ? 2200 : 1600);
    if (!empty($photos[$key])) remove_upload($photos[$key]);
    $photos[$key] = $path;
    web_photos_save($photos);
    return web_photos_info();
}

function web_photo_reset(string $key): array
{
    $photos = settings()['photos'];
    if (!empty($photos[$key])) remove_upload($photos[$key]);
    unset($photos[$key]);
    web_photos_save($photos);
    return web_photos_info();
}

function web_photos_save(array $photos): void
{
    q("DELETE FROM settings WHERE k = 'photos'");
    q("INSERT INTO settings (k, v) VALUES ('photos', ?)", [json_encode($photos, JSON_UNESCAPED_SLASHES)]);
    settings(true);
}

/** Para el panel: cada hueco con su nombre, la foto actual y si es propia. */
function web_photos_info(): array
{
    $own = settings()['photos'];
    $o = [];
    foreach (tema_fotos() as $k => $info) {
        $label = $info['label'] ?? $k;
        $url = photo($k, 600);
        if (!preg_match('#^https?://#', $url)) $url = base_url() . '/' . $url;
        $o[] = ['key' => $k, 'label' => $label, 'url' => $url, 'custom' => !empty($own[$k])];
    }
    return $o;
}

/* ---------- Packs y bonos (pack novia, manos y pies, bono de 5 manicuras…) y lista de servicios ---------- */

/*
 * Cada pack tiene un precio cerrado y varios apartados (Manos, Pies, Extra…) con los servicios que incluye.
 * Si en un apartado hay varios, el cliente elige uno; uno puede llevar suplemento («+5 €»). Cada pack se activa
 * y desactiva por separado desde la app, y la lista de servicios también (setting servicios_on).
 */
function pack_norm(array $m): array
{
    return [
        'id'      => preg_replace('/[^a-z0-9]/', '', (string)($m['id'] ?? '')) ?: substr(sha1(json_encode($m)), 0, 8),
        'on'      => (bool)($m['on'] ?? false),
        'title'   => (string)($m['title'] ?? '') ?: 'Pack manos y pies',
        'price'   => (float)($m['price'] ?? 0),
        'days'    => array_values(array_map('intval', (array)($m['days'] ?? [1, 2, 3, 4, 5, 6, 7]))),
        'note'    => (string)($m['note'] ?? ''),
        'groups'  => array_values(array_map(fn($c) => [
            'name'     => (string)($c['name'] ?? ''),
            'services' => array_values(array_map(fn($d) => [
                'name'      => (string)($d['name'] ?? ''),
                'desc'      => (string)($d['desc'] ?? ''),
                'extra'     => (float)($d['extra'] ?? 0),
                'photo'     => (string)($d['photo'] ?? ''),
                'photo_url' => ($d['photo'] ?? '') === '' ? '' : base_url() . '/' . $d['photo'],
            ], (array)($c['services'] ?? []))),
        ], (array)($m['groups'] ?? []))),
    ];
}

/** Todos los packs, en orden (para la app). */
function packs_all(): array
{
    return array_values(array_map('pack_norm', (array)(settings()['packs'] ?? [])));
}

function packs_store(array $list): void
{
    q("DELETE FROM settings WHERE k = 'packs'");
    q("INSERT INTO settings (k, v) VALUES ('packs', ?)", [json_encode(array_values($list), JSON_UNESCAPED_UNICODE)]);
    settings(true);
}

function pack_find(array $list, string $id): int
{
    foreach ($list as $i => $m) if ($m['id'] === $id) return $i;
    throw new ValidationError('Ese pack ya no existe');
}

/** Crea (sin id) o guarda un pack. Devuelve el pack guardado. */
function pack_save(array $in): array
{
    $money = function ($v, string $what): float {
        $v = round((float)str_replace(',', '.', (string)$v), 2);
        if ($v < 0 || $v > 9999) throw new ValidationError('Precio no válido: ' . $what);
        return $v;
    };
    $txt = fn($v, int $max) => mb_substr(trim((string)$v), 0, $max);
    $list = packs_all();
    $id = preg_replace('/[^a-z0-9]/', '', (string)($in['id'] ?? ''));
    $m = [
        'id'    => $id ?: bin2hex(random_bytes(4)),
        'on'    => filter_var($in['on'] ?? false, FILTER_VALIDATE_BOOLEAN),
        'title' => $txt($in['title'] ?? '', 80) ?: 'Pack manos y pies',
        'price' => $money($in['price'] ?? 0, 'pack'),
        'days'  => array_values(array_unique(array_filter(array_map('intval', (array)($in['days'] ?? [])), fn($d) => $d >= 1 && $d <= 7))),
        'note'  => $txt($in['note'] ?? '', 300),
        'groups' => [],
    ];
    sort($m['days']);
    foreach (array_slice((array)($in['groups'] ?? []), 0, 12) as $c) {
        $name = $txt($c['name'] ?? '', 60);
        $services = [];
        foreach (array_slice((array)($c['services'] ?? []), 0, 30) as $d) {
            $dn = $txt($d['name'] ?? '', 120);
            if ($dn === '') continue;
            $photo = (string)($d['photo'] ?? '');
            if (!preg_match('#^uploads/pack-[a-z0-9-]+\.jpg$#', $photo) || !is_file(dirname(__DIR__) . '/' . $photo)) $photo = '';
            $services[] = ['name' => $dn, 'desc' => $txt($d['desc'] ?? '', 200), 'extra' => $money($d['extra'] ?? 0, $dn), 'photo' => $photo];
        }
        if ($name === '' && !$services) continue;
        if ($name === '') throw new ValidationError('Ponle nombre a cada apartado del pack (Manos, Pies…)');
        $m['groups'][] = ['name' => $name, 'services' => $services];
    }
    if ($m['on']) {
        if ($m['price'] <= 0) throw new ValidationError('Pon el precio del pack para activarlo');
        if (!array_filter($m['groups'], fn($c) => $c['services'])) throw new ValidationError('Añade al menos un servicio para activar el pack');
        if (!$m['days']) throw new ValidationError('Elige qué días se ofrece el pack');
    }
    if ($id) {
        $i = pack_find($list, $id);
        $old = $list[$i];
        $list[$i] = $m;
    } else {
        if (count($list) >= 20) throw new ValidationError('Como mucho 20 packs');
        $list[] = $m;
    }
    packs_store($list);
    if (!empty($old)) pack_photos_cleanup(pack_photos($old), pack_photos($m));
    return pack_norm($m);
}

/** Fotos que usa un pack. */
function pack_photos(array $m): array
{
    $o = [];
    foreach ($m['groups'] as $c) foreach ($c['services'] as $d) if (!empty($d['photo'])) $o[] = $d['photo'];
    return $o;
}

/** Borra las fotos que ya no usa ningún pack. */
function pack_photos_cleanup(array $before, array $after = []): void
{
    $used = [];
    foreach (packs_all() as $mm) foreach (pack_photos($mm) as $f) $used[$f] = true;
    foreach (array_diff($before, $after) as $f) if (empty($used[$f])) remove_upload($f);
}

/** Sube la foto de un servicio de un pack; se guarda en el pack al pulsar «Guardar». Devuelve la ruta y la URL. */
function pack_photo_upload(?array $file): array
{
    if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) throw new ValidationError('No ha llegado ninguna foto');
    $path = store_image($file, 'pack', 1200);
    return ['photo' => $path, 'photo_url' => base_url() . '/' . $path];
}

/** ¿Sale el botón «Ver packs» en la portada? */
function packs_button(): bool
{
    return (bool)(settings()['packs_button'] ?? true);
}

function packs_button_toggle(bool $on): bool
{
    q("DELETE FROM settings WHERE k = 'packs_button'");
    q("INSERT INTO settings (k, v) VALUES ('packs_button', ?)", [json_encode($on)]);
    settings(true);
    return $on;
}

/** Solo activar o desactivar (el interruptor de la app). */
function pack_toggle(string $id, bool $on): array
{
    $list = packs_all();
    return pack_save(['on' => $on] + $list[pack_find($list, $id)]);
}

function pack_delete(string $id): void
{
    $list = packs_all();
    $old = array_splice($list, pack_find($list, $id), 1)[0];
    packs_store($list);
    pack_photos_cleanup(pack_photos($old));
}

function pack_move(string $id, int $dir): void
{
    $list = packs_all();
    $i = pack_find($list, $id);
    $j = $i + ($dir < 0 ? -1 : 1);
    if (!isset($list[$j])) return;
    [$list[$i], $list[$j]] = [$list[$j], $list[$i]];
    packs_store($list);
}

/** ¿Sale la lista de servicios en la web? */
function servicios_on(): bool
{
    return (bool)(settings()['servicios_on'] ?? true);
}

function servicios_toggle(bool $on): bool
{
    q("DELETE FROM settings WHERE k = 'servicios_on'");
    q("INSERT INTO settings (k, v) VALUES ('servicios_on', ?)", [json_encode($on)]);
    settings(true);
    return $on;
}

/**
 * Los packs activos para la web, traducidos. Cada uno lleva además 'today' (¿se ofrece hoy?),
 * 'every_day' (todos los días) y 'days_text' («de lunes a viernes»).
 */
function packs_public(): array
{
    $out = [];
    $closedToday = in_array(today(), settings()['closed_dates'], true);
    foreach (packs_all() as $m) {
        if (!$m['on']) continue;
        $m['groups'] = array_values(array_filter($m['groups'], fn($c) => $c['services']));
        if (!$m['groups']) continue;
        $m['title'] = tr($m['title']);
        $m['note'] = tr($m['note']);
        foreach ($m['groups'] as &$c) {
            $c['name'] = tr($c['name']);
            foreach ($c['services'] as &$d) { $d['name'] = tr($d['name']); $d['desc'] = tr($d['desc']); unset($d['photo']); $d['photo'] = $d['photo_url']; unset($d['photo_url']); }
            unset($d);
        }
        unset($c);
        $m['today'] = in_array((int)date('N'), $m['days'], true) && !$closedToday;
        $m['every_day'] = count($m['days']) === 7;
        $m['days_text'] = days_text($m['days']);
        $out[] = $m;
    }
    return $out;
}

/** «de lunes a viernes», «todos los días», «martes, jueves y sábado». */
function days_text(array $days): string
{
    sort($days);
    if (count($days) === 7) return t('todos los días');
    if (!$days) return '';
    $consec = count($days) >= 3 && $days === range($days[0], end($days));
    if ($consec) return t('de %s a %s', day_name($days[0]), day_name(end($days)));
    $names = array_map('day_name', $days);
    $last = array_pop($names);
    return $names ? implode(', ', $names) . ' ' . t('y') . ' ' . $last : $last;
}

/** 14,50 € → «14,50»; 15 → «15». */
function euros(float $p): string
{
    return fmod($p, 1.0) == 0.0 ? number_format($p, 0, ',', '.') : number_format($p, 2, ',', '.');
}
