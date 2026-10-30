<?php
/**
 * Minimal Razorpay client: create an order, fetch an order, verify a payment signature.
 * Docs: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/
 */

function razorpay_configured(): bool
{
    return config('razorpay.key_id') !== '' && config('razorpay.key_secret') !== ''
        && config('razorpay.key_id') !== null && config('razorpay.key_secret') !== null;
}

function razorpay_request(string $method, string $path, ?array $body = null): array
{
    $base = rtrim((string) config('razorpay.api_base', 'https://api.razorpay.com/v1'), '/');
    $ch = curl_init($base . '/' . ltrim($path, '/'));
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_USERPWD        => config('razorpay.key_id') . ':' . config('razorpay.key_secret'),
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_CUSTOMREQUEST  => $method,
    ];
    if ($body !== null) {
        $opts[CURLOPT_POSTFIELDS] = json_encode($body);
    }
    curl_setopt_array($ch, $opts);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($raw === false) {
        return ['ok' => false, 'status' => 0, 'error' => 'Could not reach Razorpay: ' . $err];
    }
    $data = json_decode($raw, true) ?: [];
    if ($status < 200 || $status >= 300) {
        return ['ok' => false, 'status' => $status, 'error' => $data['error']['description'] ?? 'Razorpay error', 'data' => $data];
    }
    return ['ok' => true, 'status' => $status, 'data' => $data];
}

/** $amountRupees is converted to paise, as Razorpay expects. */
function razorpay_create_order(float $amountRupees, string $receipt, array $notes): array
{
    return razorpay_request('POST', 'orders', [
        'amount'   => (int) round($amountRupees * 100),
        'currency' => 'INR',
        'receipt'  => $receipt,
        'notes'    => $notes,
    ]);
}

function razorpay_fetch_order(string $orderId): array
{
    return razorpay_request('GET', 'orders/' . rawurlencode($orderId));
}

/** Checks that the payment really came from Razorpay for this order. */
function razorpay_signature_valid(string $orderId, string $paymentId, string $signature): bool
{
    $expected = hash_hmac('sha256', $orderId . '|' . $paymentId, (string) config('razorpay.key_secret'));
    return hash_equals($expected, $signature);
}
