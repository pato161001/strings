<?php
/**
 * POST JSON { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * → checks the signature Razorpay returned to the browser and records the payment.
 */
require dirname(__DIR__) . '/lib/bootstrap.php';
require TST_ROOT . '/lib/razorpay.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
}
if (!razorpay_configured()) {
    json_response(['ok' => false, 'error' => 'Online payment isn\'t switched on.'], 503);
}

$in = json_input();
$orderId   = (string) ($in['razorpay_order_id'] ?? '');
$paymentId = (string) ($in['razorpay_payment_id'] ?? '');
$signature = (string) ($in['razorpay_signature'] ?? '');

if (!preg_match('/^order_\w+$/', $orderId) || !preg_match('/^pay_\w+$/', $paymentId) || $signature === '') {
    json_response(['ok' => false, 'error' => 'Payment details are missing.'], 422);
}

if (!razorpay_signature_valid($orderId, $paymentId, $signature)) {
    write_log('payments.log', ['event' => 'signature_mismatch', 'order_id' => $orderId, 'payment_id' => $paymentId]);
    json_response(['ok' => false, 'error' => 'We couldn\'t confirm this payment. If money left your account, call us with this ID: ' . $paymentId], 400);
}

// Pull the order back so the log has the student's details and amount.
$order = razorpay_fetch_order($orderId);
$notes = $order['ok'] ? ($order['data']['notes'] ?? []) : [];
$amount = $order['ok'] ? (($order['data']['amount'] ?? 0) / 100) : null;

write_log('payments.log', ['event' => 'payment_verified', 'order_id' => $orderId, 'payment_id' => $paymentId, 'amount' => $amount] + (array) $notes);

json_response([
    'ok'         => true,
    'payment_id' => $paymentId,
    'plan'       => $notes['plan'] ?? null,
    'student'    => $notes['student'] ?? null,
]);
