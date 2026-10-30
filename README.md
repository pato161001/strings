# The Strings Theory — website

Four-page site for The Strings Theory music school, Rourkela: Home, About, Fees (with Razorpay payments) and Tutorials (pulled from YouTube). The pages are plain `.html` files. A few small PHP scripts in `api/` supply the fees, take payments and fetch the YouTube list. No database and no build step; it runs on any Hostinger-style shared hosting with PHP 8, and the same files also work on GitHub Pages (without payments).

## Going live on Hostinger

1. Upload everything in this folder to `public_html` (File Manager or FTP). Keep the folder structure as it is.
2. In `public_html`, copy `config.sample.php` to `config.php` and fill it in (see below). `.htaccess` blocks visitors from opening it.
3. Make sure `storage/cache` and `storage/logs` are writable (755 usually works on Hostinger).
4. Turn on SSL for the domain in hPanel, then uncomment the two "Force HTTPS" lines in `.htaccess`.
5. Open the site and check each page: `index.html`, `about.html`, `fees.html`, `tutorials.html` (short addresses like `/about` work too).

Until the Razorpay keys are in `config.php` the site still works. The fees table shows the 2026–27 prices, the checkout box offers Call and WhatsApp instead of online payment, and the Tutorials page shows a "coming soon" message.

## Hosting on GitHub Pages instead

Upload the same files to the repo as they are. Never upload `config.php`: a GitHub Pages repo is public. GitHub Pages can't run PHP, so the pages fall back to what's written in the HTML: the fees table still shows the full price list, the Fees page offers Call and WhatsApp to enrol, the Tutorials page shows "coming soon" and the Email button stays hidden. Everything else works the same. Use Hostinger, or any host with PHP, for payments and the live YouTube list.

## Filling in config.php

**Contact details** (`school`): add the school's `email` to show the Email button (leave it empty to hide it), and the opening `hours` shown on the Home page. The phone and WhatsApp number are also written into the four `.html` files (top bar buttons, enquiry form, Call buttons); if the number ever changes, search and replace `7008896377` across the `.html` files as well as in `config.php`.

**Fees** (`fees`): the 2026–27 fee structure is already filled in `config.sample.php`, so copy that `fees` section into `config.php` as it is. The fee is the same for every instrument and for in class or online. Each class time (`slots`) has a monthly price for weekdays and weekends, for 4 or 8 classes a month. `discounts` sets the advance-payment discount (3 months 5%, 6 months 10%, 12 months 15%), and `usd_rate` (95) works out the approximate US$ prices. The amount charged is always worked out on the server from these numbers, so nobody can change the price from their browser.

When the fees change, update them in two places: the `fees` section of `config.php` (what's charged, and what the table shows when PHP is running) and the price table written into `fees.html` (what shows on GitHub Pages, or if the server can't be reached). The policy notes under the table (due by the 1st, 40-minute classes, missed classes adjusted, PayPal +8%) are plain text in `fees.html`.

PayPal isn't connected to the site; online payment goes through Razorpay in rupees. Students paying by PayPal arrange it with Deepak directly.

**Razorpay** (`razorpay`):
1. The school needs its own Razorpay account with KYC done (PAN and bank account in the school's or Deepak's name).
2. Razorpay Dashboard → Account & Settings → API Keys → generate keys.
3. Start with the **test** keys (`rzp_test_…`) and make a test payment with Razorpay's test card or UPI ID.
4. When that works, swap in the **live** keys (`rzp_live_…`).

Every order and verified payment is written to `storage/logs/payments.log` (student name, phone, plan, amount, payment ID). Razorpay's dashboard is the official record.

**YouTube** (`youtube`):
1. Google Cloud Console → create a project → enable "YouTube Data API v3" → Credentials → create an API key. Restrict it to the YouTube Data API.
2. Get the channel ID (starts with `UC`): YouTube Studio → Settings → Channel → Advanced settings.
3. Put both in config, plus the public channel link for the Subscribe button.

The site asks YouTube for the video list at most once an hour (`cache_minutes`) and keeps the last good list if YouTube is unreachable. Videos are sorted into Guitar, Piano, Singing, Ukulele and Theory from words in their titles ("ukulele", "piano", "sing", "chords", "scale"…), and tagged beginner, intermediate or advanced the same way. To refresh immediately after uploading, delete `storage/cache/youtube.json`.

## Still needed from Deepak

- Weekly opening hours (`school.hours`)
- School email address
- Razorpay account and keys; YouTube API key and channel ID
- Parents' permission for the class photos that show children
- Confirm the songs on the Home page setlist are ones he teaches (edit in `index.html`)

## The look

Yellow, black and white, built on GraySpark's original "voltage yellow" system: near-black `#0A0A0A`, white `#FAFAFA`, yellow `#FCDF00`; Anton for headlines, Archivo for text, Caveat for the handwritten setlist; a light film-grain overlay. All colours and type sizes are variables at the top of `assets/css/style.css`, so a colour change happens in one place.

Sections fade up as they scroll into view (skipped for visitors who ask for reduced motion, and the content still shows if JavaScript is off). On phones the four contact buttons fold into one yellow button.

## How the pieces fit

```
index.html, about.html, fees.html, tutorials.html   pages (each has its own copy of the top bar, footer,
                                                    floating contact buttons and enquiry form; edit all four)
assets/css/style.css                            all styles
assets/js/site.js                               reads api/site.php and fills in email, hours, batch timings, YouTube link
assets/js/main.js                               enquiry form → opens WhatsApp with the details filled in
assets/js/fees.js                               fee table, notes and Razorpay checkout, from api/site.php
assets/js/tutorials.js                          video list, instrument filters and player, from api/videos.php
api/site.php                                    public settings from config.php (no keys)
api/videos.php                                  Deepak's YouTube uploads, cached
api/create-order.php                            creates a Razorpay order for the server-calculated amount
api/verify-payment.php                          checks Razorpay's payment signature and logs the payment
lib/                                            settings loader, fee maths, Razorpay and YouTube helpers
storage/                                        cache and logs (blocked from the web)
```

**Enquiry form**: the floating "Enquire" button opens a form; on submit it opens WhatsApp with a ready-made message to the school's number. Nothing is stored on the server.

**Payments**: the browser asks `api/create-order.php` for an order, Razorpay Checkout takes the payment, and `api/verify-payment.php` confirms the signature before the success screen shows. For extra safety on a busy site, add a Razorpay webhook for `payment.captured` later so payments are recorded even if a visitor closes the tab mid-way.

## Running it locally

```
cp config.sample.php config.php
php -S localhost:8000 router.php
```

`router.php` copies the short addresses and folder blocking from `.htaccess` for the built-in PHP server. It isn't used on Hostinger.

## Photos and credits

Deepak's own photos: the home page hero (on stage, black and white), private and group class photos (`private-*.jpg`, `group-*.jpg`, `group-online.jpg`), the About portrait poster (`deepak-poster.jpg`; it includes hand-drawn band names, among them the NIRVANA wordmark), the About background (`about-stage.jpg`), the ukulele illustration (`deepak-ukulele.jpg`) and the On stage gallery (`live-*.jpg`, `deepak.jpg`). The logo and favicons are made from the school's logo file.

The online-class screenshots are cropped so meeting codes and the parent's and students' name labels don't show. Get parents' permission before publishing photos of children.

Stock photos still in use, from Unsplash (free under the Unsplash License): Arthur Ogleznev (guitar course card, tutorial placeholders), Juan Pablo (piano card), Timothy Dachraoui (singing card), Raquel Moss (ukulele card), Chris Marlin (amp behind the reviews), Dmitrii E. (piano behind the fees heading). Swap them for real photos whenever you like; keep the same file names.
