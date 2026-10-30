<?php
/**
 * Fee calculation. The server always recomputes the amount from config,
 * so a visitor can't change what they pay by editing the page.
 *
 * Price = monthly fee for (class time, weekdays/weekends, classes a month)
 *         x months paid for, minus the advance-payment discount.
 */

function fee_instruments(): array
{
    return (array) config('fees.instruments', []);
}

function fee_modes(): array
{
    return ['offline' => 'In class', 'online' => 'Online'];
}

function fee_days(): array
{
    return ['weekday' => 'Weekdays', 'weekend' => 'Weekends'];
}

function fee_slots(): array
{
    return (array) config('fees.slots', []);
}

/** Classes-a-month options, from the first slot's weekday prices, e.g. [4, 8]. */
function fee_class_counts(): array
{
    $slots = fee_slots();
    $first = $slots ? reset($slots) : [];
    return array_map('intval', array_keys((array) ($first['weekday'] ?? [])));
}

/** Months a student can pay for at once => percent off, e.g. [1 => 0, 3 => 5]. */
function fee_discounts(): array
{
    $out = [];
    foreach ((array) config('fees.discounts', [1 => 0]) as $months => $pct) {
        $out[(int) $months] = (float) $pct;
    }
    return $out;
}

function fee_monthly(string $slot, string $days, int $classes): ?float
{
    $v = fee_slots()[$slot][$days][$classes] ?? null;
    return ($v === null || $v <= 0) ? null : (float) $v;
}

/** True when at least one price is set, so online payment can be offered. */
function fees_configured(): bool
{
    foreach (fee_slots() as $key => $slot) {
        foreach (array_keys(fee_days()) as $d) {
            foreach (fee_class_counts() as $n) {
                if (fee_monthly((string) $key, $d, $n) !== null) {
                    return true;
                }
            }
        }
    }
    return false;
}

/**
 * Work out what to charge.
 * Returns ['ok' => true, 'amount' => rupees, 'label' => '...', ...] or ['ok' => false, 'error' => '...'].
 */
function fee_quote(array $in): array
{
    $instrument = (string) ($in['instrument'] ?? '');
    $mode       = (string) ($in['mode'] ?? '');
    $slot       = (string) ($in['slot'] ?? '');
    $days       = (string) ($in['days'] ?? '');
    $classes    = (int) ($in['classes'] ?? 0);
    $months     = (int) ($in['months'] ?? 0);

    if (!isset(fee_instruments()[$instrument])) {
        return ['ok' => false, 'error' => 'Please choose an instrument.'];
    }
    if (!isset(fee_modes()[$mode])) {
        return ['ok' => false, 'error' => 'Please choose in class or online.'];
    }
    if (!isset(fee_slots()[$slot])) {
        return ['ok' => false, 'error' => 'Please choose a class time.'];
    }
    if (!isset(fee_days()[$days])) {
        return ['ok' => false, 'error' => 'Please choose weekdays or weekends.'];
    }
    if (!in_array($classes, fee_class_counts(), true)) {
        return ['ok' => false, 'error' => 'Please choose how many classes a month.'];
    }
    $discounts = fee_discounts();
    if (!isset($discounts[$months])) {
        return ['ok' => false, 'error' => 'Please choose how many months to pay for.'];
    }
    $monthly = fee_monthly($slot, $days, $classes);
    if ($monthly === null) {
        return ['ok' => false, 'error' => 'Online payment isn\'t available for this option yet. Please call us to enroll.'];
    }

    $subtotal = $monthly * $months;
    $discount = round($subtotal * $discounts[$months] / 100);
    $label = fee_instruments()[$instrument] . ', ' . strtolower(fee_modes()[$mode]) . ', '
           . strtolower(fee_days()[$days]) . ' ' . (fee_slots()[$slot]['short'] ?? fee_slots()[$slot]['name']) . ' IST, '
           . $classes . ' classes a month, ' . months_label($months);

    return [
        'ok'       => true,
        'amount'   => $subtotal - $discount,
        'monthly'  => $monthly,
        'subtotal' => $subtotal,
        'discount' => $discount,
        'label'    => $label,
    ];
}
