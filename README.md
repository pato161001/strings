# The Strings Theory — website

Seven-page site for The Strings Theory, a guitar and ukulele school with studios in Basanti Nagar and Chhend Colony (Rourkela) and SBI Colony, Kesora (Bhubaneswar): Home, About, Fees (with Razorpay payments), Tutorials (every playlist from the YouTube channel), a syllabus page each for guitar and ukulele, and Book a demo (online demo booking with automatic Google Meet links). The pages are plain `.html` files. A few small PHP scripts in `api/` supply the fees and take payments; a Google Apps Script in Deepak's Google account handles demo booking and the YouTube playlists. No database and no build step; it runs on any Hostinger-style shared hosting with PHP 8, and the same files also work on GitHub Pages (without payments).

## Going live on Hostinger

1. Upload everything in this folder to `public_html` (File Manager or FTP). Keep the folder structure as it is.
2. In `public_html`, copy `config.sample.php` to `config.php` and fill it in (see below). `.htaccess` blocks visitors from opening it.
3. Make sure `storage/cache` and `storage/logs` are writable (755 usually works on Hostinger).
4. Turn on SSL for the domain in hPanel, then uncomment the two "Force HTTPS" lines in `.htaccess`.
5. Open the site and check each page: `index.html`, `about.html`, `fees.html`, `tutorials.html` (short addresses like `/about` work too).

Until the Razorpay keys are in `config.php` the site still works. The fees table shows the 2026–27 prices, the checkout box offers Call and WhatsApp instead of online payment, and the Tutorials page shows a "coming soon" message.

## Hosting on GitHub Pages instead

Upload the same files to the repo as they are. Never upload `config.php`: a GitHub Pages repo is public. GitHub Pages can't run PHP, so the pages fall back to what's written in the HTML: the fees table still shows the full price list, the Fees page offers Call and WhatsApp to enroll, and the Email button stays hidden. Everything else works the same, including demo booking and the Tutorials playlists (they run through the Google Apps Script, not PHP). Use Hostinger, or any host with PHP, for online fee payments.

## Filling in config.php

**Contact details** (`school`): add the school's `email` to show the Email button (leave it empty to hide it), and the opening `hours` shown on the Home page. The studio addresses are written into the footer of each `.html` file and the Studios list on the Home page; edit those if a studio moves. The phone and WhatsApp number are also written into the four `.html` files (top bar buttons, enquiry form, Call buttons); if the number ever changes, search and replace `7008896377` across the `.html` files as well as in `config.php`.

**Fees** (`fees`): the 2026–27 fee structure is already filled in `config.sample.php`, so copy that `fees` section into `config.php` as it is. The fee is the same for every instrument and for in class or online. Each class time (`slots`) has a monthly price for weekdays and weekends, for 4 or 8 classes a month. `discounts` sets the advance-payment discount (3 months 5%, 6 months 10%, 12 months 15%), and `usd_rate` (95) works out the approximate US$ prices. The amount charged is always worked out on the server from these numbers, so nobody can change the price from their browser.

When the fees change, update them in two places: the `fees` section of `config.php` (what's charged, and what the table shows when PHP is running) and the price table written into `fees.html` (what shows on GitHub Pages, or if the server can't be reached). The policy notes under the table (due by the 1st, 40-minute classes, missed classes adjusted, PayPal +8%) are plain text in `fees.html`.

PayPal isn't connected to the site; online payment goes through Razorpay in rupees. Students paying by PayPal arrange it with Deepak directly.

**Razorpay** (`razorpay`):
1. The school needs its own Razorpay account with KYC done (PAN and bank account in the school's or Deepak's name).
2. Razorpay Dashboard → Account & Settings → API Keys → generate keys.
3. Start with the **test** keys (`rzp_test_…`) and make a test payment with Razorpay's test card or UPI ID.
4. When that works, swap in the **live** keys (`rzp_live_…`).

Every order and verified payment is written to `storage/logs/payments.log` (student name, phone, plan, amount, payment ID). Razorpay's dashboard is the official record.

## Google Apps Script: demo booking and Tutorials playlists

One small script in Deepak's Google account (`apps-script/`) does two jobs: online demo booking, and the YouTube playlists on the Tutorials page. Its web app link goes in `assets/js/booking-config.js`.

### Tutorials page

The page shows Deepak's channel ([@stringstheory](https://www.youtube.com/@stringstheory)): a big player, a Latest uploads row, a jump menu, and one section per public playlist with Play all, On YouTube and a scrolling row of videos. Clicking a video plays it in the big player and carries on through that playlist. New uploads and playlists appear on their own within an hour (`YOUTUBE_CACHE_MINUTES`); empty and private items are left out. The playlists follow the order YouTube lists them in. If the script can't be reached, the player still plays the channel's latest uploads and a button links to the playlists on YouTube.

### Online demo booking (Book a demo page)

Students pick a date and a time on `book-demo.html`, fill in their details and get a Google Meet link on the spot, with a Copy button. Behind it is a small Google Apps Script that runs in Deepak's own Google account:

- **Availability comes from his Google Calendar.** Demo hours are set in the script (Monday to Saturday, 10 AM to 1 PM and 4 PM to 8 PM, 30-minute demos, up to 14 days ahead, at least 3 hours' notice). Anything already in his calendar blocks that time, so to take a slot off, add an event to his calendar.
- **Each booking becomes a calendar event** with a Google Meet link and the student's name, instrument, level, WhatsApp number and notes. Deepak also gets an email for every booking. If the student gives an email address, Google sends them a calendar invite too.
- **No double bookings.** Two students can't take the same slot, and each WhatsApp number can only hold one upcoming demo.
- **To cancel or move a demo,** delete or move the event in Google Calendar; the slot frees up straight away.

It works the same on GitHub Pages and Hostinger, and needs no server keys. Until it's set up, the page shows "Book your demo on WhatsApp" instead of the calendar.

### Setting it up (about 5 minutes, signed in as Deepak)

1. Sign in to the Google account whose calendar should hold the demos, then open <https://script.google.com> and click **New project**. Name it "The Strings Theory demo booking".
2. Delete what's in `Code.gs` and paste in everything from `apps-script/Code.gs`.
3. Click **Project Settings** (the gear icon) and tick **Show "appsscript.json" manifest file in editor**. Back in the **Editor**, open `appsscript.json` and replace its contents with `apps-script/appsscript.json`. This switches on the Google Calendar service the script uses.
4. Look over the `CONFIG` block at the top of `Code.gs`: demo hours for each day, demo length, how far ahead students can book, and minimum notice. Save (Ctrl + S).
5. Pick **setupCheck** in the function list at the top and click **Run**. Google asks for permission: **Review permissions**, choose the account, then **Advanced → Go to The Strings Theory demo booking (unsafe) → Allow**. (The warning appears for any private script; it only gets access to this account's calendar and email.) The log should say "Calendar connected" with the number of open slots, and "YouTube connected" with the number of playlists.
6. Click **Deploy → New deployment**, choose the type **Web app**, set **Execute as: Me** and **Who has access: Anyone**, then **Deploy**. Copy the **Web app URL** (it ends in `/exec`).
7. Paste that URL between the quotes in `assets/js/booking-config.js` and upload that file.

To change the demo hours later, edit `CONFIG`, save, then **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. The URL stays the same, so the website doesn't need changing.

**Updating to a new version of the script** (for example when the Tutorials playlists were added): paste the new `Code.gs` and `appsscript.json` over the old ones, save, run **setupCheck** once more and allow the new permission it asks for (read-only access to YouTube), then **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**.

Google Meet links from a personal Gmail account are free; one-to-one calls have no practical time limit, so 30-minute demos are fine.

## Still needed from Deepak

- Weekly opening hours (`school.hours`)
- School email address
- Razorpay account and keys
- Set up the demo booking script in his Google account (steps above), and confirm the demo hours and length
- Parents' permission for the class photos that show children
- Confirm the songs on the Home page setlist are ones he teaches (edit in `index.html`)

## The look

Yellow, black and white, built on GraySpark's original "voltage yellow" system: near-black `#0A0A0A`, white `#FAFAFA`, yellow `#FCDF00`; Anton for headlines, Archivo for text, Caveat for the handwritten setlist; a light film-grain overlay. All colours and type sizes are variables at the top of `assets/css/style.css`, so a colour change happens in one place.

Sections fade up as they scroll into view (skipped for visitors who ask for reduced motion, and the content still shows if JavaScript is off). On phones the four contact buttons fold into one yellow button.

## How the pieces fit

```
index.html, about.html, fees.html, tutorials.html,
guitar-syllabus.html, ukulele-syllabus.html,
book-demo.html                                  pages (each has its own copy of the top bar, footer,
                                                    floating contact buttons and enquiry form; edit all seven)
assets/css/style.css                            all styles
assets/js/site.js                               reads api/site.php and fills in email, hours and batch timings
assets/js/main.js                               enquiry form → opens WhatsApp with the details filled in
assets/js/fees.js                               fee table, notes and Razorpay checkout, from api/site.php
assets/js/tutorials.js                          Tutorials: player, jump menu and a row per YouTube playlist, from the Apps Script
assets/js/gallery.js                            circular photo gallery in the Home page's Private classes section
assets/js/booker.js                             Book a demo: calendar, time slots, form and the Meet link screen
assets/js/booking-config.js                     the Google Apps Script link (one line), used by Book a demo and Tutorials
apps-script/                                    the booking backend that runs in Deepak's Google account (see below)
api/site.php                                    public settings from config.php (no keys)
api/create-order.php                            creates a Razorpay order for the server-calculated amount
api/verify-payment.php                          checks Razorpay's payment signature and logs the payment
lib/                                            settings loader, fee maths and Razorpay helpers
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

Deepak's own photos: the home page hero (on stage, black and white), private and group class photos (`private-*.jpg`, `group-*.jpg`, `group-online.jpg`), the About portrait poster (`deepak-poster.jpg`; it includes hand-drawn band names, among them the NIRVANA wordmark), the About background (`about-stage.jpg`), the ukulele illustration (`deepak-ukulele.jpg`, also on the Home ukulele card and the ukulele syllabus) and the On stage gallery (`live-*.jpg`, `deepak.jpg`). The logo and favicons are made from the school's logo file.

The online-class screenshots are cropped so meeting codes and the parent's and students' name labels don't show. Get parents' permission before publishing photos of children.

Stock photo still in use, from Unsplash (free under the Unsplash License): Chris Marlin (amp behind the reviews). Swap it for a real photo whenever you like; keep the same file name.
