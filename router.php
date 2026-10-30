<?php
/**
 * Local development only: php -S localhost:8000 router.php
 * Mimics .htaccess: blocks private folders, serves /about as about.html. Not used on Hostinger.
 */
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if (preg_match('#^/(lib|storage)(/|$)#', $path) || preg_match('#^/(config|config\\.sample|router)\\.php$#', $path)) {
    http_response_code(403);
    exit('Forbidden');
}
if ($path === '/') {
    header('Content-Type: text/html; charset=utf-8');
    readfile(__DIR__ . '/index.html');
    return true;
}
if (is_file(__DIR__ . $path)) {
    return false;
}
$page = trim($path, '/');
if (preg_match('/^[a-z-]+$/', $page) && is_file(__DIR__ . "/$page.html")) {
    header('Content-Type: text/html; charset=utf-8');
    readfile(__DIR__ . "/$page.html");
    return true;
}
http_response_code(404);
echo 'Not found';
