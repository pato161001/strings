<?php
/**
 * GET -> public site settings the .html pages read: contact details, fees
 * and whether online payment is on. Nothing secret is returned (no Razorpay keys).
 */
require dirname(__DIR__) . '/lib/bootstrap.php';
require TST_ROOT . '/lib/fees.php';
require TST_ROOT . '/lib/razorpay.php';

json_response([
    'ok' => true,
    'school' => [
        'name'          => config('school.name'),
        'phone_display' => config('school.phone_display'),
        'phone_tel'     => config('school.phone_tel'),
        'whatsapp'      => preg_replace('/\D/', '', (string) config('school.whatsapp')),
        'email'         => trim((string) config('school.email')),
        'address'       => config('school.address'),
        'hours'         => config('school.hours'),
    ],
    'fees' => [
        'year'          => (string) config('fees.year'),
        'instruments'   => fee_instruments(),
        'modes'         => fee_modes(),
        'days'          => fee_days(),
        'slots'         => fee_slots(),
        'class_counts'  => fee_class_counts(),
        'discounts'     => fee_discounts(),
        'usd_rate'      => (float) config('fees.usd_rate', 0),
        'class_minutes' => (int) config('fees.class_minutes', 0),
        'paypal_extra'  => (float) config('fees.paypal_extra', 0),
        'batch_timings' => (string) config('fees.batch_timings'),
    ],
    'pay_online' => razorpay_configured() && fees_configured(),
]);
