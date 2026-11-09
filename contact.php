<?php
/*
 * Webbi contact form handler (runs on Hostinger, or any host with PHP).
 * Receives the form on /fr/contact/ and /en/contact/ and emails it to $TO.
 *
 * For best delivery, create a mailbox like no-reply@yourdomain in Hostinger (hPanel → Emails)
 * so the "From" address below exists. Replies go straight to the visitor (Reply-To).
 */

$TO = 'webbicontacts@gmail.com';
$MAX_PER_HOUR = 5;            // per visitor IP
$MIN_SECONDS_ON_PAGE = 3;     // bots submit instantly

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function reply($code, $data) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    reply(405, ['ok' => false, 'error' => 'method']);
}

function field($key, $max) {
    $v = isset($_POST[$key]) ? trim((string) $_POST[$key]) : '';
    $v = str_replace("\0", '', $v);
    if (function_exists('mb_substr')) {
        return mb_substr($v, 0, $max, 'UTF-8');
    }
    return substr($v, 0, $max);
}
function one_line($v) {
    return trim(preg_replace('/[\r\n\t]+/', ' ', $v)); // blocks header injection
}

// spam traps: hidden field must stay empty; the form must have been open a few seconds
$honeypot = field('website', 200);
$started  = (int) field('t', 20);
if ($honeypot !== '' || ($started > 0 && (time() * 1000 - $started) < $MIN_SECONDS_ON_PAGE * 1000)) {
    reply(200, ['ok' => true]); // pretend it worked so bots move on
}

$lang     = field('lang', 2) === 'en' ? 'en' : 'fr';
$name     = one_line(field('name', 120));
$email    = one_line(field('email', 200));
$phone    = one_line(field('phone', 40));
$business = one_line(field('business', 160));
$plan     = one_line(field('plan', 20));
$message  = field('message', 5000);

if ($name === '' || $message === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    reply(400, ['ok' => false, 'error' => 'invalid']);
}

// simple rate limit per IP
$ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
$rateFile = rtrim(sys_get_temp_dir(), '/') . '/webbi_rate_' . md5($ip);
$now = time();
$hits = [];
if (is_readable($rateFile)) {
    $hits = array_filter(array_map('intval', explode(',', (string) file_get_contents($rateFile))), function ($t) use ($now) {
        return $t > $now - 3600;
    });
}
if (count($hits) >= $MAX_PER_HOUR) {
    reply(429, ['ok' => false, 'error' => 'rate']);
}
$hits[] = $now;
@file_put_contents($rateFile, implode(',', $hits), LOCK_EX);

$plans = [
    'starter' => 'Essentiel / Starter',
    'growth'  => 'Croissance / Growth',
    'premium' => 'Premium',
    'custom'  => 'Soumission sur mesure / Custom quote',
    'unsure'  => 'Pas encore décidé / Not sure yet',
];
$planLabel = isset($plans[$plan]) ? $plans[$plan] : '-';

$host = isset($_SERVER['HTTP_HOST']) ? preg_replace('/^www\./i', '', preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'])) : 'localhost';
$host = preg_replace('/[^a-z0-9.\-]/i', '', $host);
$from = 'no-reply@' . $host;

$subject = 'Nouvelle demande de site Web / New website request: ' . $name;
$body = implode("\n", [
    'Nom / Name: ' . $name,
    'Courriel / Email: ' . $email,
    'Téléphone / Phone: ' . ($phone !== '' ? $phone : '-'),
    'Entreprise / Business: ' . ($business !== '' ? $business : '-'),
    'Forfait / Package: ' . $planLabel,
    'Langue / Language: ' . strtoupper($lang),
    '',
    'Message:',
    $message,
    '',
    '---',
    'Envoyé depuis / Sent from ' . $host . ' · ' . date('Y-m-d H:i'),
]);

$headers = [
    'From: Webbi <' . $from . '>',
    'Reply-To: ' . $name . ' <' . $email . '>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
];
$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';

$sent = @mail($TO, $encodedSubject, $body, implode("\r\n", $headers), '-f' . $from);

reply($sent ? 200 : 500, ['ok' => (bool) $sent]);
