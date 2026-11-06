<?php
declare(strict_types=1);

/*
 * Funciones opcionales para que las clientas vuelvan. Todas empiezan apagadas y se activan en la app
 * (Ajustes → Clientas):
 *
 *  - Pedir reseña (review_on): unas horas después de la cita le llega un WhatsApp con el enlace para dejar
 *    una reseña en Google. Como mucho una vez cada 6 meses a la misma clienta, si tiene ficha.
 *  - Volver a reservar (rebook_on): botón «Reservar lo mismo» en la cuenta de la web.
 *  - Aviso «te toca volver» (rebook_remind_on): cada servicio puede decir a los cuántos días se repite (por
 *    ejemplo, el relleno de gel a los 21) y ese día le llega un WhatsApp con el enlace para reservar lo mismo.
 *    No sale si ya tiene otra cita apuntada o si pidió no recibir avisos.
 *  - Fichas de clientas (fichas_on): historial de visitas, notas del salón y las veces que no vino.
 *  - Enlace para compartir (share_on): botón en Inicio con los enlaces de reserva para Google e Instagram.
 *
 * Los datos personales de las reservas se borran 24 h después (purge_old_reservations). Las fichas y el aviso
 * «te toca volver» necesitan el nombre y el teléfono más tiempo: se guardan cifrados en la tabla clients solo si
 * está activada alguna de esas dos funciones, y se borran solos a los 2 años de la última visita.
 *
 * Con la API de Meta configurada (Ajustes → Avanzado → WhatsApp automático) los mensajes salen solos. Sin ella,
 * Inicio enseña la lista de mensajes pendientes con un botón para mandarlos a mano desde el WhatsApp del móvil.
 */

const CLIENT_KEEP_DAYS = 730;   // las fichas se borran a los 2 años de la última visita
const REVIEW_BIT = 4;           // bit de la columna reminders de reservations: reseña ya pedida
const REVIEW_AGAIN_DAYS = 180;  // no se vuelve a pedir reseña a la misma clienta antes de 6 meses
const REBOOK_LATE_DAYS = 14;    // un aviso «te toca volver» que no salió a su día se olvida a las 2 semanas

/** Huella del teléfono para buscar sin descifrar (mismo formato que phone_norm: sin prefijo de España). */
function phone_idx(string $phone): string
{
    $n = phone_norm($phone);
    return strlen($n) < 6 ? '' : hash_hmac('sha256', $n, 'phone-idx|' . (cfg()['secret'] ?? ''));
}

/** ¿Hay que guardar a las clientas más allá de las 24 h? */
function clients_on(): bool
{
    $s = settings();
    return $s['fichas_on'] || $s['rebook_remind_on'];
}

function review_ready(): bool
{
    $s = settings();
    return $s['review_on'] && $s['review_url'] !== '';
}

/** Enlace que abre la web con la ventana de reserva (y el servicio ya elegido, si se indica). */
function booking_link(int $serviceId = 0, string $l = 'es'): string
{
    $q = $serviceId > 0 ? 'reservar=' . $serviceId : 'reservar';
    return base_url() . '/?' . $q . ($l !== 'es' ? '&lang=' . $l : '');
}

/* ---------- Fichas ---------- */

function client_by_idx(string $idx): ?array
{
    if ($idx === '') return null;
    return q('SELECT * FROM clients WHERE phone_idx = ?', [$idx])->fetch() ?: null;
}

/** Crea la ficha a partir de una reserva (o la devuelve si ya existe). */
function client_ensure(array $r): ?array
{
    $idx = phone_idx($r['phone']);
    if ($idx === '') return null;
    $c = client_by_idx($idx);
    if ($c) return $c;
    try {
        q('INSERT INTO clients (phone_idx, name, phone, email, lang, notes, visits, noshows, no_msgs, rebook_service_id, rebook_service, rebook_sent, created_at, updated_at)
           VALUES (?,?,?,?,?,?,0,0,0,0,\'\',0,?,?)', [$idx, enc($r['name']), enc($r['phone']), enc($r['email'] ?? ''), $r['lang'] ?? 'es', '', now(), now()]);
    } catch (Throwable $e) { /* la creó otra petición a la vez */ }
    return client_by_idx($idx);
}

/**
 * Pasa a la ficha una cita que ya ha terminado, justo antes de que se borren sus datos. La llama
 * purge_old_reservations() con el mismo corte de 24 h.
 */
function clients_record(string $d, string $t): void
{
    if (!clients_on()) return;
    $rows = q("SELECT * FROM reservations WHERE (rdate < ? OR (rdate = ? AND rtime <= ?)) AND phone <> '' AND deleted = 0 AND status = 'confirmada'", [$d, $d, $t])->fetchAll();
    foreach ($rows as $row) {
        try { client_add_visit($row); } catch (Throwable $e) { error_log('[salon] Ficha: ' . $e->getMessage()); }
    }
}

function client_add_visit(array $row): void
{
    $r = res_out($row);
    $c = client_ensure($r);
    if (!$c) return;
    $noshow = (int)($row['noshow'] ?? 0) ? 1 : 0;
    q('INSERT INTO client_visits (client_id, rdate, rtime, service, noshow) VALUES (?,?,?,?,?)', [$c['id'], $r['date'], $r['time'], $r['service'], $noshow]);
    $s = settings();
    $set = 'name = ?, phone = ?, lang = ?, visits = visits + ?, noshows = noshows + ?, updated_at = ?';
    $args = [enc($r['name']), enc($r['phone']), $r['lang'], 1 - $noshow, $noshow, now()];
    if ($r['email'] !== '') { $set .= ', email = ?'; $args[] = enc($r['email']); }
    if (!$c['last_visit'] || $r['date'] >= $c['last_visit']) {
        $set .= ', last_visit = ?';
        $args[] = $r['date'];
        // Aviso «te toca volver»: desde la última visita, con los días que diga su servicio
        $days = $r['service_id'] ? (int)(q('SELECT return_days FROM services WHERE id = ?', [$r['service_id']])->fetchColumn() ?: 0) : 0;
        if ($s['rebook_remind_on'] && !$noshow && $days > 0) {
            $set .= ', rebook_at = ?, rebook_service_id = ?, rebook_service = ?, rebook_sent = 0';
            array_push($args, date('Y-m-d', strtotime($r['date'] . " +$days days")), $r['service_id'], $r['service']);
        } elseif (!$noshow) {
            $set .= ', rebook_at = NULL, rebook_sent = 0';
        }
    }
    $args[] = $c['id'];
    q("UPDATE clients SET $set WHERE id = ?", $args);
}

/** Borra las fichas de quien lleva 2 años sin venir (y las que nunca tuvieron visitas). */
function clients_cleanup(): void
{
    $cut = date('Y-m-d', time() - CLIENT_KEEP_DAYS * 86400);
    $old = q('SELECT id FROM clients WHERE (last_visit IS NOT NULL AND last_visit < ?) OR (last_visit IS NULL AND created_at < ?)', [$cut, $cut . ' 00:00:00'])->fetchAll(PDO::FETCH_COLUMN);
    foreach ($old as $id) client_delete((int)$id);
}

function client_delete(int $id): void
{
    q('DELETE FROM client_visits WHERE client_id = ?', [$id]);
    q('DELETE FROM clients WHERE id = ?', [$id]);
}

/** Lo que se pinta en la tarjeta de una cita: visitas, faltas y si tiene notas (solo con las fichas activadas). */
function client_brief(array $row): ?array
{
    if (!settings()['fichas_on']) return null;
    $idx = (string)($row['phone_idx'] ?? '');
    if ($idx === '') return null;
    $c = client_by_idx($idx);
    // Más las citas que ya han pasado pero aún no están en la ficha (las de las últimas 24 h)
    $d = today();
    $live = [0, 0];
    foreach (q("SELECT noshow, COUNT(*) AS n FROM reservations WHERE phone_idx = ? AND deleted = 0 AND status = 'confirmada' AND (rdate < ? OR (rdate = ? AND rtime <= ?)) GROUP BY noshow",
        [$idx, $d, $d, date('H:i')])->fetchAll() as $x) $live[(int)$x['noshow'] ? 1 : 0] += (int)$x['n'];
    return [
        'visits' => ($c ? (int)$c['visits'] : 0) + $live[0],
        'noshows' => ($c ? (int)$c['noshows'] : 0) + $live[1],
        'notes' => $c && dec($c['notes']) !== '',
    ];
}

/** Ficha completa para el panel, desde una cita ($resId) o desde la lista de fichas ($clientId). */
function client_card(int $resId, int $clientId): array
{
    $c = null;
    $idx = '';
    $base = null;
    if ($resId) {
        $row = q('SELECT * FROM reservations WHERE id = ?', [$resId])->fetch();
        if (!$row) throw new ValidationError('La reserva no existe');
        $base = res_out($row);
        $idx = (string)$row['phone_idx'] ?: phone_idx($base['phone']);
        if ($idx === '') throw new ValidationError('Esta cita no tiene teléfono: no tiene ficha');
        $c = client_by_idx($idx);
    } else {
        $c = q('SELECT * FROM clients WHERE id = ?', [$clientId])->fetch() ?: null;
        if (!$c) throw new ValidationError('Esa ficha ya no existe');
        $idx = $c['phone_idx'];
    }
    $out = [
        'id' => $c ? (int)$c['id'] : 0,
        'name' => $c ? dec($c['name']) : $base['name'],
        'phone' => $c ? dec($c['phone']) : $base['phone'],
        'email' => $c ? dec($c['email']) : $base['email'],
        'notes' => $c ? dec($c['notes']) : '',
        'no_msgs' => $c ? (bool)$c['no_msgs'] : false,
        'visits' => $c ? (int)$c['visits'] : 0,
        'noshows' => $c ? (int)$c['noshows'] : 0,
        'last_visit' => $c['last_visit'] ?? '',
        'rebook_at' => $c && !$c['rebook_sent'] ? (string)($c['rebook_at'] ?? '') : '',
        'rebook_service' => $c ? (string)$c['rebook_service'] : '',
        'upcoming' => [], 'history' => [],
    ];
    // Citas que aún tienen sus datos (las de los próximos días y las de las últimas 24 h)
    $now = date('Y-m-d H:i');
    foreach (q('SELECT * FROM reservations WHERE phone_idx = ? AND deleted = 0 ORDER BY rdate DESC, rtime DESC LIMIT 30', [$idx])->fetchAll() as $row) {
        $r = res_out($row);
        $item = ['id' => $r['id'], 'date' => $r['date'], 'time' => $r['time'], 'service' => $r['service'], 'status' => $r['status'], 'noshow' => (bool)$row['noshow']];
        if ($r['date'] . ' ' . $r['time'] >= $now && in_array($r['status'], RES_ACTIVE, true)) { array_unshift($out['upcoming'], $item); continue; }
        if ($r['status'] !== 'confirmada') continue;
        $out['history'][] = $item;
        if ($item['noshow']) $out['noshows']++; else $out['visits']++;
        if ($out['last_visit'] === '' || $r['date'] > $out['last_visit']) $out['last_visit'] = $r['date'];
    }
    if ($c) {
        foreach (q('SELECT * FROM client_visits WHERE client_id = ? ORDER BY rdate DESC, rtime DESC LIMIT 40', [$c['id']])->fetchAll() as $v) {
            $out['history'][] = ['id' => 0, 'date' => $v['rdate'], 'time' => $v['rtime'], 'service' => $v['service'], 'status' => 'confirmada', 'noshow' => (bool)$v['noshow']];
        }
    }
    return $out;
}

/** Guarda las notas de la ficha y si quiere avisos. Si aún no tenía ficha, se crea con los datos de la cita. */
function client_save(array $in): array
{
    $resId = (int)($in['res_id'] ?? 0);
    $id = (int)($in['id'] ?? 0);
    if (!$id) {
        $row = $resId ? q('SELECT * FROM reservations WHERE id = ?', [$resId])->fetch() : null;
        if (!$row) throw new ValidationError('La reserva no existe');
        $c = client_ensure(res_out($row));
        if (!$c) throw new ValidationError('Esta cita no tiene teléfono: no tiene ficha');
        $id = (int)$c['id'];
    }
    $notes = mb_substr(trim((string)($in['notes'] ?? '')), 0, 1000);
    $noMsgs = filter_var($in['no_msgs'] ?? false, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
    q('UPDATE clients SET notes = ?, no_msgs = ?, updated_at = ? WHERE id = ?', [enc($notes), $noMsgs, now(), $id]);
    return client_card($resId, $resId ? 0 : $id);
}

/** Lista de fichas para Ajustes → Clientas, con buscador por nombre o teléfono. */
function clients_list(string $search = ''): array
{
    $search = mb_strtolower(trim($search));
    $digits = preg_replace('/\D/', '', $search);
    $out = [];
    foreach (q('SELECT * FROM clients ORDER BY last_visit DESC, id DESC')->fetchAll() as $c) {
        $name = dec($c['name']);
        $phone = dec($c['phone']);
        if ($search !== '' && !str_contains(mb_strtolower($name), $search) && !(strlen($digits) >= 3 && str_contains(preg_replace('/\D/', '', $phone), $digits))) continue;
        $out[] = ['id' => (int)$c['id'], 'name' => $name, 'phone' => $phone, 'visits' => (int)$c['visits'], 'noshows' => (int)$c['noshows'],
            'last_visit' => (string)($c['last_visit'] ?? ''), 'notes' => dec($c['notes']) !== ''];
        if (count($out) >= 200) break;
    }
    return ['clients' => $out, 'total' => (int)q('SELECT COUNT(*) FROM clients')->fetchColumn()];
}

/** «No vino»: se marca en una cita confirmada cuya hora ya ha pasado (y se puede quitar). */
function reservation_noshow(int $id, bool $on): array
{
    $row = q('SELECT * FROM reservations WHERE id = ? AND deleted = 0', [$id])->fetch();
    if (!$row) throw new ValidationError('La reserva no existe');
    if ($row['status'] !== 'confirmada') throw new ValidationError('Solo se puede marcar en una cita confirmada');
    if (strtotime($row['rdate'] . ' ' . $row['rtime']) > time()) throw new ValidationError('Aún no ha llegado la hora de la cita');
    if ($row['phone'] === '') throw new ValidationError('Ya han pasado 24 horas: los datos de esta cita se han borrado');
    q('UPDATE reservations SET noshow = ?, updated_at = ? WHERE id = ?', [$on ? 1 : 0, now(), $id]);
    return get_reservation_admin($id);
}

/* ---------- Reseñas y avisos «te toca volver» ---------- */

/** «Relleno de gel» → «relleno de gel», para que quede bien en medio de la frase. */
function lc_first(string $v): string
{
    return mb_strtolower(mb_substr($v, 0, 1)) . mb_substr($v, 1);
}

function review_text(array $r): string
{
    return with_lang($r['lang'] ?: 'es', fn() => t('Hola %s, gracias por venir a %s. Si te ha gustado, ¿nos dejas una reseña en Google? Nos ayuda muchísimo:', wa_first_name($r), settings()['name'])
        . "\n" . settings()['review_url']);
}

function rebook_text(array $c): string
{
    return with_lang($c['lang'] ?: 'es', fn() => t('Hola %s, ya va siendo hora de tu %s en %s. Si quieres, reserva en un momento aquí:', wa_first_name($c), lc_first(tr($c['service'])), settings()['name'])
        . "\n" . booking_link((int)$c['service_id'], lang()) . "\n\n" . t('Si no quieres recibir estos avisos, contéstanos «no».'));
}

/** Citas a las que toca pedir reseña: terminadas hace las horas indicadas y aún con sus datos. */
function reviews_due(int $limit = 20): array
{
    if (!review_ready()) return [];
    $s = settings();
    $now = time();
    $out = [];
    $rows = q("SELECT * FROM reservations WHERE status = 'confirmada' AND deleted = 0 AND noshow = 0 AND phone <> '' AND (reminders & ?) = 0 AND rdate BETWEEN ? AND ? ORDER BY rdate, rtime",
        [REVIEW_BIT, date('Y-m-d', $now - 86400), date('Y-m-d', $now)])->fetchAll();
    foreach ($rows as $row) {
        $end = strtotime($row['rdate'] . ' ' . $row['rtime']) + res_minutes($row) * 60;
        if ($end + max(1, (int)$s['review_hours']) * 3600 > $now) continue;
        if ($end < $now - 20 * 3600) continue; // ya es tarde para pedirla
        $c = client_by_idx((string)$row['phone_idx']);
        if ($c && ($c['no_msgs'] || ($c['reviewed_at'] && strtotime($c['reviewed_at']) > $now - REVIEW_AGAIN_DAYS * 86400))) continue;
        $out[] = $row;
        if (count($out) >= $limit) break;
    }
    return $out;
}

function review_mark(int $id): bool
{
    $row = q('SELECT reminders, phone_idx FROM reservations WHERE id = ?', [$id])->fetch();
    if (!$row) return false;
    $claimed = q('UPDATE reservations SET reminders = ? WHERE id = ? AND reminders = ?', [(int)$row['reminders'] | REVIEW_BIT, $id, (int)$row['reminders']])->rowCount() > 0;
    if ($claimed && $row['phone_idx'] !== '') q('UPDATE clients SET reviewed_at = ? WHERE phone_idx = ?', [now(), $row['phone_idx']]);
    return $claimed;
}

/** Fichas a las que toca el aviso «te toca volver» (sin otra cita apuntada y sin haber pedido que no). */
function rebook_due(int $limit = 20): array
{
    $s = settings();
    if (!$s['rebook_remind_on']) return [];
    $today = today();
    $out = [];
    $rows = q('SELECT * FROM clients WHERE rebook_at IS NOT NULL AND rebook_at <= ? AND rebook_at >= ? AND rebook_sent = 0 AND no_msgs = 0 ORDER BY rebook_at',
        [$today, date('Y-m-d', time() - REBOOK_LATE_DAYS * 86400)])->fetchAll();
    $ph = implode(',', array_fill(0, count(RES_ACTIVE), '?'));
    foreach ($rows as $c) {
        $has = (int)q("SELECT COUNT(*) FROM reservations WHERE phone_idx = ? AND deleted = 0 AND rdate >= ? AND status IN ($ph)", array_merge([$c['phone_idx'], $today], RES_ACTIVE))->fetchColumn();
        if ($has) { q('UPDATE clients SET rebook_sent = 1 WHERE id = ?', [$c['id']]); continue; }
        $out[] = $c;
        if (count($out) >= $limit) break;
    }
    return $out;
}

/** La ficha en el formato de los mensajes (como una reserva: name, phone, lang, service, service_id). */
function rebook_target(array $c): array
{
    return ['name' => dec($c['name']), 'phone' => dec($c['phone']), 'lang' => $c['lang'] ?: 'es',
        'service' => (string)$c['rebook_service'], 'service_id' => (int)$c['rebook_service_id']];
}

/**
 * Con la API de Meta: manda solas las reseñas y los avisos que toquen. Como los recordatorios, se ejecuta con
 * las visitas a la web y a la app (como mucho cada 5 minutos) y desde cron.php. Cada envío se marca antes.
 */
function followups_run(bool $force = false): int
{
    if (!wa_creds_ready() || (!review_ready() && !settings()['rebook_remind_on'])) return 0;
    $last = (int)(q("SELECT v FROM settings WHERE k = '_followups'")->fetchColumn() ?: 0);
    if (!$force && $last > time() - 300) return 0;
    q("DELETE FROM settings WHERE k = '_followups'");
    q("INSERT INTO settings (k, v) VALUES ('_followups', ?)", [(string)time()]);
    $s = settings();
    $sent = 0;
    foreach (reviews_due(5) as $row) {
        if (!review_mark((int)$row['id'])) continue;
        $r = res_out($row);
        $ok = wa_deliver($r, $s['review_template'], fn() => [wa_first_name($r), $s['name'], $s['review_url']], fn() => review_text($r));
        if ($ok === '') $sent++;
    }
    foreach (rebook_due(5) as $c) {
        if (!q('UPDATE clients SET rebook_sent = 1 WHERE id = ? AND rebook_sent = 0', [$c['id']])->rowCount()) continue;
        $t = rebook_target($c);
        $ok = wa_deliver($t, $s['rebook_template'], fn() => [wa_first_name($t), tr($t['service']), booking_link($t['service_id'], lang())], fn() => rebook_text($t));
        if ($ok === '') $sent++;
    }
    return $sent;
}

/** Sin la API de Meta: lo que hay que mandar a mano, con el WhatsApp ya escrito. */
function followups_pending(): array
{
    $o = ['reviews' => [], 'rebook' => [], 'auto' => wa_creds_ready()];
    if ($o['auto']) return $o;
    foreach (reviews_due() as $row) {
        $r = res_out($row);
        $o['reviews'][] = ['id' => $r['id'], 'name' => $r['name'], 'service' => $r['service'], 'date' => $r['date'], 'time' => $r['time'],
            'wa_url' => 'https://wa.me/' . wa_number($r['phone']) . '?text=' . rawurlencode(review_text($r))];
    }
    foreach (rebook_due() as $c) {
        $t = rebook_target($c);
        $o['rebook'][] = ['id' => (int)$c['id'], 'name' => $t['name'], 'service' => $t['service'], 'last_visit' => (string)$c['last_visit'],
            'wa_url' => 'https://wa.me/' . wa_number($t['phone']) . '?text=' . rawurlencode(rebook_text($t))];
    }
    return $o;
}

/** Desde Inicio: el mensaje ya se ha mandado a mano (o no se quiere mandar). */
function followup_done(string $kind, int $id): void
{
    if ($kind === 'review') review_mark($id);
    elseif ($kind === 'rebook') q('UPDATE clients SET rebook_sent = 1 WHERE id = ?', [$id]);
    else throw new ValidationError('Aviso no válido');
}
