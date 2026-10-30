<?php
/**
 * POST JSON { instrument, mode, slot, days, classes, months, name, phone, email }
 * → creates a Razorpay order for the amount set in config.php and returns what Checkout needs.
 */
require dirname(__DIR__) . '/lib/bootstrap.php';
require TST_ROOT . '/lib/fees.php';
require TST_ROOT . '/lib/razorpay.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
}
if (!razorpay_configured()) {
    json_response(['ok' => false, 'error' => 'Online payment isn\'t switched on yet. Please call us to enroll.'], 503);
}

$in = json_input();
$name  = trim(mb_substr((string) ($in['name'] ?? ''), 0, 80));
$phone = preg_replace('/[^\d+]/', '', (string) ($in['phone'] ?? ''));
$email = trim(mb_substr((string) ($in['email'] ?? ''), 0, 120));

if ($name === '') {
    json_response(['ok' => false, 'error' => 'Please enter the student\'s name.', 'field' => 'name'], 422);
}
if (strlen(preg_replace('/\D/', '', $phone)) < 10) {
    json_response(['ok' => false, 'error' => 'Please enter a 10-digit mobile number.', 'field' => 'phone'], 422);
}
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_response(['ok' => false, 'error' => 'That email address doesn\'t look right.', 'field' => 'email'], 422);
}

$quote = fee_quote($in);
if (!$quote['ok']) {
    json_response(['ok' => false, 'error' => $quote['error']], 422);
}

$receipt = 'tst_' . date('ymdHis') . '_' . bin2hex(random_bytes(3));
$notes = [
    'student' => $name,
    'phone'   => $phone,
    'email'   => $email,
    'plan'    => $quote['label'],
    'discount' => $quote['discount'] > 0 ? rupees($quote['discount']) : 'none',
];

$res = razorpay_create_order($quote['amount'], $receipt, $notes);
if (!$res['ok']) {
    write_log('payments.log', ['event' => 'order_failed', 'receipt' => $receipt, 'error' => $res['error']]);
    json_response(['ok' => false, 'error' => 'We couldn\'t start the payment. Please try again, or call us.'], 502);
}

write_log('payments.log', ['event' => 'order_created', 'order_id' => $res['data']['id'], 'amount' => $quote['amount']] + $notes);

json_response([
    'ok'          => true,
    'key_id'      => config('razorpay.key_id'),
    'order_id'    => $res['data']['id'],
    'amount'      => $res['data']['amount'],       // paise
    'currency'    => 'INR',
    'name'        => config('school.name'),
    'description' => $quote['label'],
    'prefill'     => ['name' => $name, 'contact' => $phone, 'email' => $email],
]);
