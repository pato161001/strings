<?php
/**
 * Loads settings and shared helpers. Every page and API script starts here.
 */
declare(strict_types=1);

define('TST_ROOT', dirname(__DIR__));
define('TST_STORAGE', TST_ROOT . '/storage');

$configFile = TST_ROOT . '/config.php';
if (!is_file($configFile)) {
    // Fall back to the sample so the site still renders before setup is finished.
    $configFile = TST_ROOT . '/config.sample.php';
}
$GLOBALS['tst_config'] = require $configFile;

function config(string $path, $default = null)
{
    $value = $GLOBALS['tst_config'];
    foreach (explode('.', $path) as $key) {
        if (!is_array($value) || !array_key_exists($key, $value)) {
            return $default;
        }
        $value = $value[$key];
    }
    return $value;
}

/** Escape text for HTML output. */
function e($value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Format rupees the Indian way, e.g. 12500 → ₹12,500. */
function rupees($amount): string
{
    if ($amount === null) {
        return 'Ask us';
    }
    $amount = (int) round((float) $amount);
    $s = (string) $amount;
    if (strlen($s) > 3) {
        $last3 = substr($s, -3);
        $rest = substr($s, 0, -3);
        $rest = preg_replace('/\B(?=(\d{2})+(?!\d))/', ',', $rest);
        $s = $rest . ',' . $last3;
    }
    return '₹' . $s;
}

function months_label(int $n): string
{
    return $n === 1 ? '1 month' : $n . ' months';
}

function whatsapp_link(string $text = ''): string
{
    $url = 'https://wa.me/' . preg_replace('/\D/', '', (string) config('school.whatsapp'));
    return $text === '' ? $url : $url . '?text=' . rawurlencode($text);
}

/** Send a JSON response and stop. */
function json_response(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Read a JSON request body. */
function json_input(): array
{
    $raw = file_get_contents('php://input') ?: '';
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/** Append one line to a log file in storage/logs. */
function write_log(string $file, array $row): void
{
    $dir = TST_STORAGE . '/logs';
    if (!is_dir($dir)) {
        @mkdir($dir, 0750, true);
    }
    $row = array_merge(['time' => date('c')], $row);
    @file_put_contents($dir . '/' . $file, json_encode($row, JSON_UNESCAPED_UNICODE) . PHP_EOL, FILE_APPEND | LOCK_EX);
}
