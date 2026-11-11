/* Book a demo: month calendar, time slots (booked ones shown struck through) and
   student details. Talks to the Google Apps Script set in booking-config.js, which
   books the slot in Deepak's Google Calendar and creates a Google Meet link.
   The student gets the link to copy, and WhatsApp opens with the booking details
   ready to send to Deepak, so he can reschedule if needed. */
(function () {
  'use strict';

  var root = document.querySelector('[data-booker]');
  if (!root) return;

  var endpoint = (window.TST_BOOKING_URL || '').trim();
  var off = root.querySelector('.booker__off');
  var grid = root.querySelector('.booker__grid');
  var done = root.querySelector('.booker__done');
  if (!endpoint || !window.fetch) { off.hidden = false; grid.hidden = true; return; }

  var monthEl = root.querySelector('.cal__month');
  var daysEl = root.querySelector('.cal__days');
  var prevBtn = root.querySelector('[data-cal-prev]');
  var nextBtn = root.querySelector('[data-cal-next]');
  var hint = root.querySelector('.booker__hint');
  var slotWrap = root.querySelector('.booker__slotswrap');
  var slotsEl = root.querySelector('.slots');
  var slotMeta = root.querySelector('[data-slot-meta]');
  var form = document.getElementById('demo-form');
  var summary = form.querySelector('.booker__summary');
  var errorBox = form.querySelector('.form-error');

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var data = null, keys = [], viewYear = 0, viewMonth = 0, selectedDay = null, chosen = null;

  // Show the visitor's own time next to IST if they are in another time zone (NRI students).
  var localTz = '';
  try { localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* old browser */ }
  function fmtTime(iso, tz) {
    try { return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz }).format(new Date(iso)).replace(/\s?([ap])\.?m\.?$/i, function (m, x) { return ' ' + x.toUpperCase() + 'M'; }); }
    catch (e) { return ''; }
  }
  function localDiffers(iso) {
    if (!localTz) return false;
    return fmtTime(iso, localTz) !== fmtTime(iso, 'Asia/Kolkata');
  }

  function parseKey(k) { var p = k.split('-'); return { y: +p[0], m: +p[1] - 1, d: +p[2] }; }
  function keyOf(y, m, d) { return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }
  function niceDay(k, long) {
    var p = parseKey(k);
    var dow = new Date(Date.UTC(p.y, p.m, p.d)).getUTCDay();
    return (long ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dow] : DOW[dow]) + ', ' + p.d + ' ' + (long ? MONTHS[p.m] : MONTHS[p.m].slice(0, 3));
  }
  function openCount(k) { return (data.days[k] || []).filter(function (s) { return s.open; }).length; }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /* ---------- loading ---------- */

  function load(keepDay) {
    hint.textContent = 'Loading available times…';
    daysEl.setAttribute('aria-busy', 'true');
    return fetch(endpoint + (endpoint.indexOf('?') === -1 ? '?' : '&') + 'action=slots', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.ok || !res.days) throw new Error('bad');
        data = res;
        keys = Object.keys(res.days).sort();
        slotMeta.textContent = 'IST · ' + res.minutes + ' min on Google Meet';
        var first = parseKey(keys[0]);
        if (!keepDay || !data.days[selectedDay] || !openCount(selectedDay)) {
          selectedDay = null;
          for (var i = 0; i < keys.length; i++) { if (openCount(keys[i])) { selectedDay = keys[i]; break; } }
        }
        var focus = selectedDay ? parseKey(selectedDay) : first;
        viewYear = focus.y; viewMonth = focus.m;
        daysEl.removeAttribute('aria-busy');
        renderCalendar();
        renderSlots();
      })
      .catch(function () {
        daysEl.removeAttribute('aria-busy');
        hint.innerHTML = '';
        hint.appendChild(document.createTextNode("We couldn't load the available times. "));
        var retry = el('button', 'linklike', 'Try again');
        retry.type = 'button';
        retry.addEventListener('click', function () { load(); });
        hint.appendChild(retry);
        hint.appendChild(document.createTextNode(' or WhatsApp us to book.'));
      });
  }

  /* ---------- calendar ---------- */

  function monthHasDays(y, m) {
    return keys.some(function (k) { var p = parseKey(k); return p.y === y && p.m === m; });
  }

  function renderCalendar() {
    monthEl.textContent = MONTHS[viewMonth] + ' ' + viewYear;
    var py = viewMonth === 0 ? viewYear - 1 : viewYear, pm = (viewMonth + 11) % 12;
    var ny = viewMonth === 11 ? viewYear + 1 : viewYear, nm = (viewMonth + 1) % 12;
    prevBtn.disabled = !monthHasDays(py, pm);
    nextBtn.disabled = !monthHasDays(ny, nm);

    daysEl.textContent = '';
    var lead = (new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay() + 6) % 7; // Monday first
    var count = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
    for (var i = 0; i < lead; i++) daysEl.appendChild(el('span', 'cal__day cal__day--empty'));
    for (var d = 1; d <= count; d++) {
      var k = keyOf(viewYear, viewMonth, d);
      var slots = data.days[k];
      var b = el('button', 'cal__day');
      b.type = 'button';
      b.textContent = d;
      b.setAttribute('data-day', k);
      if (!slots) {
        b.disabled = true; b.classList.add('is-out');
        b.setAttribute('aria-label', niceDay(k, true) + ', not bookable');
      } else if (!slots.length) {
        b.disabled = true; b.classList.add('is-closed'); b.title = 'No demos this day';
        b.setAttribute('aria-label', niceDay(k, true) + ', no demos');
      } else {
        var open = openCount(k);
        if (!open) {
          b.disabled = true; b.classList.add('is-full'); b.title = 'Fully booked';
          b.setAttribute('aria-label', niceDay(k, true) + ', fully booked');
        } else {
          b.classList.add('is-open');
          b.title = open + ' of ' + slots.length + ' slots open';
          b.setAttribute('aria-label', niceDay(k, true) + ', ' + open + ' slots open');
          b.appendChild(el('span', 'cal__dot'));
        }
      }
      if (k === selectedDay) { b.classList.add('is-selected'); b.setAttribute('aria-pressed', 'true'); }
      daysEl.appendChild(b);
    }
  }

  daysEl.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-day]');
    if (!b || b.disabled) return;
    selectedDay = b.getAttribute('data-day');
    if (chosen && chosen.day !== selectedDay) chosen = null;
    renderCalendar();
    renderSlots();
    renderSummary();
  });
  prevBtn.addEventListener('click', function () {
    viewMonth = (viewMonth + 11) % 12; if (viewMonth === 11) viewYear--; renderCalendar();
  });
  nextBtn.addEventListener('click', function () {
    viewMonth = (viewMonth + 1) % 12; if (viewMonth === 0) viewYear++; renderCalendar();
  });

  /* ---------- slots ---------- */

  function renderSlots() {
    slotsEl.textContent = '';
    if (!selectedDay) {
      slotWrap.hidden = true;
      hint.textContent = 'No open demo slots in the next ' + keys.length + ' days. WhatsApp us and we will find a time.';
      return;
    }
    var slots = data.days[selectedDay];
    hint.textContent = openCount(selectedDay) + ' of ' + slots.length + ' slots open on ' + niceDay(selectedDay) + '.';
    slotWrap.hidden = false;
    slots.forEach(function (s) {
      var b = el('button', 'slot');
      b.type = 'button';
      b.appendChild(el('span', 'slot__time', s.label));
      if (s.open) {
        b.setAttribute('data-t', s.t);
        b.setAttribute('aria-pressed', chosen && chosen.t === s.t ? 'true' : 'false');
        if (localDiffers(s.t)) b.appendChild(el('small', 'slot__local', fmtTime(s.t, localTz) + ' your time'));
      } else {
        b.disabled = true;
        b.classList.add('is-taken');
        b.appendChild(el('small', 'slot__tag', s.reason === 'booked' ? 'Booked' : 'Closed'));
      }
      slotsEl.appendChild(b);
    });
  }

  slotsEl.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-t]');
    if (!b) return;
    var t = b.getAttribute('data-t');
    var slot = data.days[selectedDay].filter(function (s) { return s.t === t; })[0];
    chosen = { t: t, label: slot.label, day: selectedDay };
    slotsEl.querySelectorAll('[data-t]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    renderSummary();
    clearError();
  });

  function renderSummary() {
    if (!chosen) {
      summary.classList.remove('is-ready');
      summary.textContent = 'Pick a date and a time to continue.';
      return;
    }
    summary.classList.add('is-ready');
    summary.textContent = '';
    summary.appendChild(el('strong', '', niceDay(chosen.day) + ' at ' + chosen.label + ' IST'));
    var extra = (data.minutes || 30) + ' min online demo on Google Meet';
    if (localDiffers(chosen.t)) extra += ' · ' + fmtTime(chosen.t, localTz) + ' your time';
    summary.appendChild(el('span', '', extra));
  }

  /* ---------- form ---------- */

  function showError(msg, field) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
    form.querySelectorAll('[aria-invalid]').forEach(function (e) { e.removeAttribute('aria-invalid'); });
    if (field && form.elements[field] && form.elements[field].focus) {
      var f = form.elements[field];
      if (f.setAttribute) f.setAttribute('aria-invalid', 'true');
      f.focus();
    }
  }
  function clearError() {
    errorBox.hidden = true;
    form.querySelectorAll('[aria-invalid]').forEach(function (e) { e.removeAttribute('aria-invalid'); });
  }

  // ?instrument=Ukulele from the course cards and syllabus pages
  var wanted = (new URLSearchParams(location.search).get('instrument') || '').replace(/[^A-Za-z]/g, '');
  if (wanted) {
    var radio = form.querySelector('[name="instrument"][value="' + wanted + '"]');
    if (radio) radio.checked = true;
  }

  form.addEventListener('input', clearError);
  var schoolWa = (root.getAttribute('data-whatsapp') || '917008896377').replace(/\D/g, '');
  var submit = form.querySelector('[type="submit"]');
  var submitLabel = submit.innerHTML;
  var busy = false, lastWaUrl = '';

  function waLink(lines) { return 'https://wa.me/' + schoolWa + '?text=' + encodeURIComponent(lines.join('\n')); }
  function details(p) {
    var out = [
      'Date and time: ' + p.when + p.mine,
      'Instrument: ' + p.instrument,
      'Level: ' + p.level,
      "Student's name: " + p.name,
      'WhatsApp: ' + p.phone
    ];
    if (p.email) out.push('Email: ' + p.email);
    if (p.notes) out.push('Notes: ' + p.notes);
    return out;
  }

  // WhatsApp opens in a new tab. Browsers only allow that straight after a click, so the tab
  // is opened at once with a "booking…" note and pointed at WhatsApp when the booking is done.
  function openHolder() {
    var w = null;
    try { w = window.open('', '_blank'); } catch (e) { w = null; }
    if (w) {
      try {
        w.document.write('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Booking your demo…</title>' +
          '<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0A0A0A;color:#FAFAFA;font:600 18px system-ui,sans-serif;text-align:center">' +
          '<p>Booking your demo…<br><span style="color:#FCDF00">WhatsApp will open in a moment.</span></p></body>');
        w.document.close();
      } catch (e) { /* ignore */ }
    }
    return w;
  }
  function sendTo(win, url) {
    if (!win || win.closed) return false;
    try { win.location.href = url; return true; } catch (e) { return false; }
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (busy) return;
    clearError();
    var f = form.elements;
    if (f.website.value) return; // bots fill the hidden field
    var instrument = (form.querySelector('[name="instrument"]:checked') || {}).value;
    if (!chosen) { showError('Please pick a date and a time first.'); slotWrap.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    if (!instrument) return showError('Please choose an instrument.');
    if (!f.name.value.trim()) return showError("Please enter the student's name.", 'name');
    if (f.phone.value.replace(/\D/g, '').length < 10) return showError('Please enter a WhatsApp number (add the country code if you are outside India).', 'phone');
    var email = f.email.value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showError("That email address doesn't look right.", 'email');

    var p = {
      when: niceDay(chosen.day) + ' at ' + chosen.label + ' IST',
      mine: localDiffers(chosen.t) ? ' (' + fmtTime(chosen.t, localTz) + ' my time)' : '',
      instrument: instrument, level: f.level.value, name: f.name.value.trim(), phone: f.phone.value.trim(),
      email: email, notes: f.notes.value.trim(), start: chosen.t
    };

    var win = openHolder();
    busy = true;
    submit.disabled = true;
    submit.textContent = 'Booking your demo…';

    // text/plain keeps this a "simple" request, which Apps Script accepts from any site
    fetch(endpoint, { method: 'POST', body: JSON.stringify({
      action: 'book', start: p.start, instrument: p.instrument, level: p.level, name: p.name,
      phone: p.phone, email: p.email, notes: p.notes, website: f.website.value
    }) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok && res.booking) {
          var b = res.booking;
          lastWaUrl = waLink(["Hi Deepak, I've booked an online demo on the website.", ''].concat(details(p),
            b.meetUrl ? ['Google Meet: ' + b.meetUrl] : [], ['', 'Please let me know if the time needs to change.']));
          var opened = sendTo(win, lastWaUrl);
          return showDone(p, b, opened);
        }
        if (res && res.code === 'off') { // automatic booking switched off in the script: send a request instead
          lastWaUrl = waLink(["Hi Deepak, I'd like to book an online demo.", ''].concat(details(p), ['', 'Please confirm and send me the Google Meet link.']));
          return showDone(p, null, sendTo(win, lastWaUrl));
        }
        if (win && !win.closed) win.close();
        var msg = (res && res.error) || 'We could not book that slot. Please try again.';
        if (res && (res.code === 'taken' || res.code === 'invalid')) {
          chosen = null; renderSummary();
          return load(true).then(function () { showError(msg); });
        }
        showError(msg, res && res.field);
      })
      .catch(function () {
        if (win && !win.closed) win.close();
        showError('We could not reach the booking system. Check your connection and try again, or WhatsApp us.');
      })
      .then(function () {
        busy = false;
        submit.disabled = false;
        submit.innerHTML = submitLabel;
      });
  });

  /* ---------- done ---------- */

  function gcalDate(iso) { return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }

  function showDone(p, b, opened) {
    var booked = !!b;
    var url = booked ? (b.meetUrl || '') : '';
    grid.hidden = true;
    done.hidden = false;
    done.querySelector('[data-done-kicker]').textContent = booked ? "You're booked" : 'Almost there';
    done.querySelector('[data-done-when]').textContent = p.when + p.mine;
    done.querySelector('[data-done-what]').textContent = (data.minutes || 30) + '-minute online ' + p.instrument.toLowerCase() + ' demo with Deepak.';

    done.querySelector('.meet-box').hidden = !url;
    done.querySelector('[data-meet-url]').textContent = url;
    var join = done.querySelector('[data-join]');
    join.hidden = !url; join.href = url || '#';
    var gcal = done.querySelector('[data-gcal]');
    gcal.hidden = !booked;
    if (booked) {
      gcal.href = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
        '&text=' + encodeURIComponent(p.instrument + ' demo, The Strings Theory') +
        '&dates=' + gcalDate(b.start) + '/' + gcalDate(b.end) +
        '&details=' + encodeURIComponent('Online ' + p.instrument.toLowerCase() + ' demo with Deepak, The Strings Theory.' + (url ? '\nJoin: ' + url : '')) +
        (url ? '&location=' + encodeURIComponent(url) : '');
    }
    done.querySelector('[data-wa-title]').textContent = booked ? 'Let Deepak know' : 'Send your request';
    done.querySelector('[data-wa-text]').textContent = booked
      ? (opened ? 'WhatsApp has opened with your booking details filled in. Tap send so Deepak has them; he will message you if the time needs to change.'
                : 'Send your booking details to Deepak on WhatsApp, so he can message you if the time needs to change.')
      : (opened ? 'WhatsApp has opened with your request filled in. Tap send, and Deepak will confirm the time and send you the Google Meet link.'
                : 'Send your request to Deepak on WhatsApp. He will confirm the time and send you the Google Meet link.');
    done.querySelector('[data-wa-open]').href = lastWaUrl;
    done.querySelector('[data-wa-open] span').textContent = opened ? 'Open WhatsApp again' : 'Send to Deepak on WhatsApp';
    done.querySelector('[data-invite-note]').textContent = booked && b.invited ? 'We have also emailed a calendar invite to ' + p.email + '.' : '';
    done.focus();
    done.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  var copyBtn = done.querySelector('[data-copy]');
  var copyStatus = done.querySelector('[data-copy-status]');
  copyBtn.addEventListener('click', function () {
    var text = done.querySelector('[data-meet-url]').textContent;
    function ok() {
      copyBtn.textContent = 'Copied';
      copyStatus.textContent = 'Meet link copied.';
      setTimeout(function () { copyBtn.textContent = 'Copy link'; copyStatus.textContent = ''; }, 2500);
    }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); ok(); } catch (e) { copyStatus.textContent = 'Select the link and copy it.'; }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(ok, fallback);
    else fallback();
  });

  done.querySelector('[data-again]').addEventListener('click', function () {
    form.reset();
    if (wanted) { var r = form.querySelector('[name="instrument"][value="' + wanted + '"]'); if (r) r.checked = true; }
    chosen = null;
    done.hidden = true;
    grid.hidden = false;
    renderSummary();
    load(true);
    root.scrollIntoView({ block: 'start' });
  });

  renderSummary();
  load();
})();
