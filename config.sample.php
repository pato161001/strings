<?php
/**
 * The Strings Theory — site settings.
 *
 * Copy this file to config.php and fill it in. config.php is blocked from
 * being downloaded by .htaccess, so the Razorpay secret and API keys stay private.
 * Never commit config.php to a public repository.
 */
return [

    // Contact details shown across the site and used by the floating buttons.
    'school' => [
        'name'          => 'The Strings Theory',
        'phone_display' => '070088 96377',
        'phone_tel'     => '+917008896377',
        'whatsapp'      => '917008896377',          // country code + number, digits only
        'email'         => '',                      // e.g. hello@thestringstheory.in — leave empty to hide the Email button
        'address'       => 'Near Rajasthan Seva Sadan, Basanti Nagar, Rourkela, Odisha 769012',
        'hours'         => 'Opens 8 AM',            // TODO: confirm weekly hours with Deepak
        'instagram'     => 'https://www.instagram.com/the_stringstheory/',
        'maps_url'      => 'https://maps.google.com/?q=The+Strings+Theory+Basanti+Nagar+Rourkela',
        'site_url'      => 'https://www.thestringstheory.in',
    ],

    // Fees for the 2026-27 academic year, in rupees per month, the same for every instrument.
    // Each class time has a weekday and a weekend price, for 4 or 8 classes a month.
    // Set a price to null to show "Ask us" and turn off online payment for that option.
    'fees' => [
        'year' => '2026–27',
        'instruments' => ['guitar' => 'Guitar', 'piano' => 'Piano', 'singing' => 'Singing', 'ukulele' => 'Ukulele'],
        'slots' => [
            'day' => [
                'name' => '9 AM – 9 PM', 'short' => '9 AM–9 PM', 'icon' => 'sun',
                'weekday' => [4 => 2000, 8 => 3200],
                'weekend' => [4 => 2500, 8 => 4200],
            ],
            'early' => [
                'name' => '5 AM – 9 AM & 9 PM – 11 PM', 'short' => '5–9 AM or 9–11 PM', 'icon' => 'sunrise',
                'weekday' => [4 => 2500, 8 => 4200],
                'weekend' => [4 => 3000, 8 => 5000],
            ],
            'night' => [
                'name' => '11 PM – 5 AM', 'short' => '11 PM–5 AM', 'icon' => 'moon',
                'weekday' => [4 => 3200, 8 => 4800],
                'weekend' => [4 => 4000, 8 => 6800],
            ],
        ],
        'discounts'     => [1 => 0, 3 => 5, 6 => 10, 12 => 15],   // months paid at once => percent off the total
        'usd_rate'      => 95,                       // US$ prices on the fees page are rupees / this, rounded
        'class_minutes' => 40,
        'paypal_extra'  => 8,                        // percent added for PayPal payments (shown as a note)
        'batch_timings' => '',                       // optional line for the Home page group classes, e.g. '8 AM to 8 PM'
    ],

    // Razorpay: Dashboard → Account & Settings → API Keys.
    // Use the rzp_test_ keys while testing, then swap in the rzp_live_ keys.
    'razorpay' => [
        'key_id'     => '',
        'key_secret' => '',
    ],

    // YouTube Data API v3: create a key in Google Cloud Console and enable "YouTube Data API v3".
    // channel_id starts with "UC" (YouTube Studio → Settings → Channel → Advanced settings).
    'youtube' => [
        'api_key'       => '',
        'channel_id'    => '',
        'channel_url'   => '',                      // public link for the Subscribe button
        'cache_minutes' => 60,                      // how long to reuse the video list before asking YouTube again
        'max_videos'    => 150,
    ],
];
