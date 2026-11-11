/**
 * The Strings Theory: online demo booking.
 *
 * A Google Apps Script web app that runs as Deepak's Google account.
 *  - GET  ?action=slots  returns the open and booked demo slots for the next few days,
 *                        worked out from his Google Calendar (anything already in his
 *                        calendar blocks that time).
 *  - GET  ?action=youtube  returns the YouTube channel's latest uploads and every public
 *                        playlist with its videos, for the website's Tutorials page.
 *  - POST {action:"book", ...}  books a slot: creates an event in his calendar with a
 *                        Google Meet link, invites the student if they gave an email,
 *                        and returns the Meet link to the website.
 *
 * Setup steps are in the README ("Online demo booking"). Only the CONFIG block below
 * normally needs changing.
 */

var CONFIG = {
  CALENDAR_ID: 'primary',          // Deepak's main calendar. Bookings go here and his events block slots.
  TIMEZONE: 'Asia/Kolkata',
  DEMO_MINUTES: 30,                // length of a demo session
  DAYS_AHEAD: 14,                  // how far ahead students can book
  MIN_NOTICE_HOURS: 3,             // no bookings sooner than this
  // Demo hours for each day, as 'HH:MM-HH:MM' blocks in IST. An empty list means no demos that day.
  HOURS: {
    mon: ['10:00-13:00', '16:00-20:00'],
    tue: ['10:00-13:00', '16:00-20:00'],
    wed: ['10:00-13:00', '16:00-20:00'],
    thu: ['10:00-13:00', '16:00-20:00'],
    fri: ['10:00-13:00', '16:00-20:00'],
    sat: ['10:00-13:00', '16:00-20:00'],
    sun: []
  },
  NOTIFY_EMAIL: '',                // who gets a "new demo booked" email. Empty = the account running the script.
  SCHOOL_NAME: 'The Strings Theory',
  SCHOOL_WHATSAPP: '917008896377',
  INSTRUMENTS: ['Guitar', 'Ukulele'],
  // Book straight into the calendar with an automatic Google Meet link. The website also
  // opens WhatsApp with the booking details for Deepak. Set to false to take requests only.
  DIRECT_BOOKING: true,
  // Tutorials page
  YOUTUBE_CHANNEL_ID: 'UCOvTby3dG8NA0L4EDv21laQ',   // The Strings Theory (@stringstheory)
  YOUTUBE_CACHE_MINUTES: 60,       // new uploads and playlists show up on the site within this time
  YOUTUBE_MAX_PER_PLAYLIST: 50
};

var DAY_KEYS = ['', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']; // Utilities 'u': 1 = Monday

/* ---------- web app entry points ---------- */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'slots';
  try {
    if (action === 'slots') return json_(getSlots_());
    if (action === 'youtube') return json_(getYouTube_(e.parameter.fresh === '1'));
    if (action === 'ping') return json_({ ok: true });
    return json_({ ok: false, error: 'Unknown request.' });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: action === 'youtube' ? 'Could not load the videos.' : 'Could not load the available times. Please try again.' });
  }
}

function doPost(e) {
  var data;
  try {
    data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'Something went wrong. Please try again.' });
  }
  try {
    if (data.action === 'book') return json_(book_(data));
    return json_({ ok: false, error: 'Unknown request.' });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'We could not book that slot. Please try again, or WhatsApp us.' });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- time helpers (all in CONFIG.TIMEZONE) ---------- */

function fmt_(date, pattern) {
  return Utilities.formatDate(date, CONFIG.TIMEZONE, pattern);
}

/** Local date 'yyyy-MM-dd' + 'HH:mm' -> Date, using the zone's offset on that day. */
function localToDate_(day, hm) {
  var noon = new Date(day + 'T12:00:00Z');
  var offset = fmt_(noon, 'XXX');                      // e.g. +05:30
  if (offset === 'Z') offset = '+00:00';
  return new Date(day + 'T' + hm + ':00' + offset);
}

/** The next DAYS_AHEAD local dates starting today, as 'yyyy-MM-dd'. */
function upcomingDays_(now) {
  var days = [];
  var base = new Date(fmt_(now, 'yyyy-MM-dd') + 'T12:00:00Z');
  for (var i = 0; i < CONFIG.DAYS_AHEAD; i++) {
    days.push(Utilities.formatDate(new Date(base.getTime() + i * 86400000), 'UTC', 'yyyy-MM-dd'));
  }
  return days;
}

/** Every slot start in the booking window, grouped by day (before checking the calendar). */
function slotGrid_(now) {
  var grid = {};
  var step = CONFIG.DEMO_MINUTES * 60000;
  upcomingDays_(now).forEach(function (day) {
    var key = DAY_KEYS[Number(fmt_(localToDate_(day, '12:00'), 'u'))];
    var blocks = CONFIG.HOURS[key] || [];
    var starts = [];
    blocks.forEach(function (block) {
      var parts = block.split('-');
      var from = localToDate_(day, parts[0]).getTime();
      var to = localToDate_(day, parts[1]).getTime();
      for (var t = from; t + step <= to; t += step) starts.push(new Date(t));
    });
    grid[day] = starts;
  });
  return grid;
}

function busyBetween_(from, to) {
  var res = Calendar.Freebusy.query({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    timeZone: CONFIG.TIMEZONE,
    items: [{ id: CONFIG.CALENDAR_ID }]
  });
  var cals = res.calendars || {};
  var cal = cals[CONFIG.CALENDAR_ID] || cals[Object.keys(cals)[0]] || {};
  return (cal.busy || []).map(function (b) {
    return { start: new Date(b.start).getTime(), end: new Date(b.end).getTime() };
  });
}

function overlaps_(start, end, busy) {
  for (var i = 0; i < busy.length; i++) {
    if (start < busy[i].end && end > busy[i].start) return true;
  }
  return false;
}

/* ---------- slots ---------- */

function getSlots_() {
  var now = new Date();
  var grid = slotGrid_(now);
  var days = Object.keys(grid);
  var first = localToDate_(days[0], '00:00');
  var last = new Date(localToDate_(days[days.length - 1], '00:00').getTime() + 86400000);
  var busy = busyBetween_(first, last);
  var earliest = now.getTime() + CONFIG.MIN_NOTICE_HOURS * 3600000;
  var len = CONFIG.DEMO_MINUTES * 60000;

  var out = {};
  days.forEach(function (day) {
    out[day] = grid[day].map(function (start) {
      var s = start.getTime();
      var slot = { t: start.toISOString(), label: fmt_(start, 'h:mm a'), open: true };
      if (s < earliest) { slot.open = false; slot.reason = 'soon'; }
      else if (overlaps_(s, s + len, busy)) { slot.open = false; slot.reason = 'booked'; }
      return slot;
    });
  });
  return {
    ok: true,
    tz: CONFIG.TIMEZONE,
    minutes: CONFIG.DEMO_MINUTES,
    instruments: CONFIG.INSTRUMENTS,
    days: out
  };
}

/* ---------- booking ---------- */

function clean_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
}

function normalisePhone_(raw) {
  var digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.charAt(0) === '0') digits = digits.slice(1);
  if (digits.length === 10) digits = '91' + digits;      // Indian mobile without country code
  return digits.length >= 11 && digits.length <= 15 ? digits : '';
}

function book_(d) {
  if (!CONFIG.DIRECT_BOOKING) return { ok: false, code: 'off', error: 'Online booking is off. Please send your request on WhatsApp.' };
  // Bots fill every field, people never see this one.
  if (clean_(d.website, 200)) return { ok: true, booking: null };

  var name = clean_(d.name, 80);
  var phone = normalisePhone_(d.phone);
  var email = clean_(d.email, 120).toLowerCase();
  var instrument = clean_(d.instrument, 30);
  var level = clean_(d.level, 40);
  var notes = clean_(d.notes, 500);

  if (!name) return { ok: false, field: 'name', error: "Please enter the student's name." };
  if (!phone) return { ok: false, field: 'phone', error: 'Please enter a WhatsApp number with country code if outside India.' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, field: 'email', error: "That email address doesn't look right." };
  if (CONFIG.INSTRUMENTS.indexOf(instrument) === -1) return { ok: false, field: 'instrument', error: 'Please choose an instrument.' };

  var start = new Date(String(d.start || ''));
  if (isNaN(start.getTime())) return { ok: false, code: 'invalid', error: 'Please pick a time slot.' };
  var end = new Date(start.getTime() + CONFIG.DEMO_MINUTES * 60000);
  var now = new Date();

  // The slot has to be one we actually offer.
  var offered = false;
  var grid = slotGrid_(now);
  Object.keys(grid).forEach(function (day) {
    grid[day].forEach(function (s) { if (s.getTime() === start.getTime()) offered = true; });
  });
  if (!offered || start.getTime() < now.getTime() + CONFIG.MIN_NOTICE_HOURS * 3600000) {
    return { ok: false, code: 'invalid', error: 'That time is no longer available. Please pick another slot.' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    // One upcoming demo per WhatsApp number.
    var existing = Calendar.Events.list(CONFIG.CALENDAR_ID, {
      privateExtendedProperty: 'tstDemoPhone=' + phone,
      timeMin: now.toISOString(),
      singleEvents: true,
      maxResults: 5
    });
    var already = (existing.items || []).filter(function (ev) { return ev.status !== 'cancelled'; })[0];
    if (already) {
      var when = fmt_(new Date(already.start.dateTime || already.start.date), "EEE d MMM 'at' h:mm a");
      return { ok: false, code: 'duplicate', error: 'This number already has a demo booked for ' + when + '. WhatsApp us if you need to change it.' };
    }

    // Check the slot again now that we hold the lock.
    if (overlaps_(start.getTime(), end.getTime(), busyBetween_(start, end))) {
      return { ok: false, code: 'taken', error: 'Sorry, someone just booked that slot. Please pick another time.' };
    }

    var description = [
      'Online demo session booked on the website.',
      '',
      'Student: ' + name,
      'Instrument: ' + instrument,
      level ? 'Level: ' + level : '',
      'WhatsApp: +' + phone + '  (https://wa.me/' + phone + ')',
      email ? 'Email: ' + email : '',
      notes ? '\nNotes: ' + notes : ''
    ].filter(function (l) { return l !== ''; }).join('\n');

    var event = {
      summary: instrument + ' demo: ' + name + ' | ' + CONFIG.SCHOOL_NAME,
      description: description,
      start: { dateTime: start.toISOString(), timeZone: CONFIG.TIMEZONE },
      end: { dateTime: end.toISOString(), timeZone: CONFIG.TIMEZONE },
      attendees: email ? [{ email: email, displayName: name }] : [],
      conferenceData: {
        createRequest: { requestId: Utilities.getUuid(), conferenceSolutionKey: { type: 'hangoutsMeet' } }
      },
      extendedProperties: { private: { tstDemo: '1', tstDemoPhone: phone } },
      reminders: { useDefault: true }
    };
    var created = Calendar.Events.insert(event, CONFIG.CALENDAR_ID, {
      conferenceDataVersion: 1,
      sendUpdates: email ? 'all' : 'none'
    });

    var meetUrl = meetLink_(created);
    for (var tries = 0; !meetUrl && tries < 4; tries++) {   // Meet can take a moment to attach
      Utilities.sleep(800);
      created = Calendar.Events.get(CONFIG.CALENDAR_ID, created.id);
      meetUrl = meetLink_(created);
    }

    var label = fmt_(start, "EEEE d MMMM 'at' h:mm a") + ' IST';
    notifyOwner_(name, instrument, level, phone, email, notes, label, meetUrl);

    return {
      ok: true,
      booking: {
        id: created.id,
        start: start.toISOString(),
        end: end.toISOString(),
        label: label,
        minutes: CONFIG.DEMO_MINUTES,
        meetUrl: meetUrl || '',
        invited: !!email
      }
    };
  } finally {
    lock.releaseLock();
  }
}

function meetLink_(ev) {
  if (!ev) return '';
  if (ev.hangoutLink) return ev.hangoutLink;
  var points = (ev.conferenceData && ev.conferenceData.entryPoints) || [];
  for (var i = 0; i < points.length; i++) {
    if (points[i].entryPointType === 'video') return points[i].uri;
  }
  return '';
}

function notifyOwner_(name, instrument, level, phone, email, notes, label, meetUrl) {
  var to = CONFIG.NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();
  if (!to) return;
  var body = [
    'A new online demo was booked on the website.',
    '',
    'When: ' + label,
    'Student: ' + name,
    'Instrument: ' + instrument + (level ? ' (' + level + ')' : ''),
    'WhatsApp: https://wa.me/' + phone,
    email ? 'Email: ' + email : 'Email: not given',
    notes ? 'Notes: ' + notes : '',
    '',
    'Google Meet: ' + (meetUrl || 'see the event in your calendar')
  ].filter(function (l, i, a) { return l !== '' || (a[i - 1] !== ''); }).join('\n');
  try {
    MailApp.sendEmail(to, 'New demo booked: ' + name + ', ' + label, body);
  } catch (err) {
    console.error('notify failed', err);   // the booking still stands
  }
}

/* ---------- YouTube (Tutorials page) ---------- */

function getYouTube_(fresh) {
  var cache = CacheService.getScriptCache();
  if (!fresh) {
    var hit = cacheGet_(cache, 'yt');
    if (hit) return hit;
  }
  var data = fetchYouTube_();
  cachePut_(cache, 'yt', data, CONFIG.YOUTUBE_CACHE_MINUTES * 60);
  return data;
}

function fetchYouTube_() {
  var id = CONFIG.YOUTUBE_CHANNEL_ID;
  var ch = (YouTube.Channels.list('snippet,contentDetails,statistics', { id: id }).items || [])[0];
  if (!ch) return { ok: false, error: 'Channel not found.' };
  var uploadsId = ch.contentDetails.relatedPlaylists.uploads;

  var playlists = [];
  var token = null;
  do {
    var page = YouTube.Playlists.list('snippet,contentDetails', { channelId: id, maxResults: 50, pageToken: token || undefined });
    (page.items || []).forEach(function (pl) {
      playlists.push({ id: pl.id, title: pl.snippet.title, description: (pl.snippet.description || '').slice(0, 280), count: pl.contentDetails.itemCount, thumb: bestThumb_(pl.snippet.thumbnails) });
    });
    token = page.nextPageToken;
  } while (token);

  var all = {};
  function items(playlistId, limit) {
    var out = [], tok = null;
    do {
      var res = YouTube.PlaylistItems.list('snippet,contentDetails,status', { playlistId: playlistId, maxResults: 50, pageToken: tok || undefined });
      (res.items || []).forEach(function (it) {
        var vid = it.contentDetails && it.contentDetails.videoId;
        var privacy = it.status && it.status.privacyStatus;
        if (!vid || privacy === 'private' || privacy === 'privacyStatusUnspecified') return;
        if (it.snippet.title === 'Private video' || it.snippet.title === 'Deleted video') return;
        out.push(vid);
        if (!all[vid]) all[vid] = { id: vid, title: it.snippet.title, published: it.contentDetails.videoPublishedAt || it.snippet.publishedAt || '', thumb: bestThumb_(it.snippet.thumbnails) };
      });
      tok = res.nextPageToken;
    } while (tok && out.length < limit);
    return out.slice(0, limit);
  }

  var latest = items(uploadsId, 12);
  playlists.forEach(function (pl) { pl.videos = items(pl.id, CONFIG.YOUTUBE_MAX_PER_PLAYLIST); });
  playlists = playlists.filter(function (pl) { return pl.videos.length; });

  // Durations, 50 videos per request
  var ids = Object.keys(all);
  for (var i = 0; i < ids.length; i += 50) {
    var vres = YouTube.Videos.list('contentDetails', { id: ids.slice(i, i + 50).join(','), maxResults: 50 });
    (vres.items || []).forEach(function (v) { if (all[v.id]) all[v.id].duration = isoDuration_(v.contentDetails.duration); });
  }
  function expand(list) { return list.map(function (vid) { return all[vid]; }); }

  return {
    ok: true,
    updated: new Date().toISOString(),
    channel: {
      id: id,
      title: ch.snippet.title,
      handle: ch.snippet.customUrl || '',
      url: 'https://www.youtube.com/' + (ch.snippet.customUrl || ('channel/' + id)),
      thumb: bestThumb_(ch.snippet.thumbnails),
      videos: Number(ch.statistics.videoCount || 0),
      subscribers: ch.statistics.hiddenSubscriberCount ? null : Number(ch.statistics.subscriberCount || 0)
    },
    uploads: { id: uploadsId, videos: expand(latest) },
    playlists: playlists.map(function (pl) { pl.videos = expand(pl.videos); return pl; })
  };
}

function bestThumb_(t) {
  t = t || {};
  var pick = t.high || t.medium || t.standard || t.maxres || t['default'];
  return pick ? pick.url : '';
}

/** PT1H2M3S -> 1:02:03, PT4M5S -> 4:05 */
function isoDuration_(iso) {
  var m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || '');
  if (!m) return '';
  var h = +(m[1] || 0), min = +(m[2] || 0), sec = +(m[3] || 0);
  var ss = String(sec).padStart(2, '0');
  return h ? h + ':' + String(min).padStart(2, '0') + ':' + ss : min + ':' + ss;
}

// CacheService keeps up to 100 KB per key, so big results are split into parts.
function cachePut_(cache, key, obj, seconds) {
  var s = JSON.stringify(obj), size = 90000, parts = Math.ceil(s.length / size), map = {};
  for (var i = 0; i < parts; i++) map[key + '_' + i] = s.slice(i * size, (i + 1) * size);
  map[key + '_n'] = String(parts);
  try { cache.putAll(map, Math.min(seconds, 21600)); } catch (err) { console.error('cache put failed', err); }
}
function cacheGet_(cache, key) {
  var n = Number(cache.get(key + '_n') || 0);
  if (!n) return null;
  var names = [];
  for (var i = 0; i < n; i++) names.push(key + '_' + i);
  var got = cache.getAll(names), s = '';
  for (var j = 0; j < n; j++) { if (got[names[j]] == null) return null; s += got[names[j]]; }
  try { return JSON.parse(s); } catch (err) { return null; }
}

/** Run this once from the editor to grant permissions and check everything works. */
function setupCheck() {
  var slots = getSlots_();
  var open = 0;
  Object.keys(slots.days).forEach(function (d) { slots.days[d].forEach(function (s) { if (s.open) open++; }); });
  console.log('Calendar connected. Open demo slots in the next ' + CONFIG.DAYS_AHEAD + ' days: ' + open);
  var yt = getYouTube_(true);
  if (yt.ok) console.log('YouTube connected: ' + yt.channel.title + ', ' + yt.playlists.length + ' playlists, ' + yt.uploads.videos.length + ' latest uploads.');
  else console.log('YouTube: ' + yt.error);
}
