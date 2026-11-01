/* Book a demo: month calendar, time slots (booked ones shown struck through) and
   student details. Free times come from Deepak's Google Calendar through the Google
   Apps Script set in booking-config.js. Submitting opens WhatsApp with the request
   ready to send to Deepak, who confirms and sends the Google Meet link. */
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
  var lastWaUrl = '';

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
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

    var when = niceDay(chosen.day) + ' at ' + chosen.label + ' IST';
    var mine = localDiffers(chosen.t) ? ' (' + fmtTime(chosen.t, localTz) + ' my time)' : '';
    var lines = [
      "Hi Deepak, I'd like to book an online demo.",
      '',
      'Date and time: ' + when + mine,
      'Instrument: ' + instrument,
      'Level: ' + f.level.value,
      "Student's name: " + f.name.value.trim(),
      'WhatsApp: ' + f.phone.value.trim()
    ];
    if (email) lines.push('Email: ' + email);
    if (f.notes.value.trim()) lines.push('Notes: ' + f.notes.value.trim());
    lines.push('', 'Please confirm and send me the Google Meet link.');
    lastWaUrl = 'https://wa.me/' + schoolWa + '?text=' + encodeURIComponent(lines.join('\n'));

    var win = window.open(lastWaUrl, '_blank');
    if (win) { try { win.opener = null; } catch (e) { /* ignore */ } }
    showDone(when + mine, instrument, !win);
  });

  /* ---------- done ---------- */

  function showDone(when, instrument, blocked) {
    grid.hidden = true;
    done.hidden = false;
    done.querySelector('[data-done-when]').textContent = when;
    done.querySelector('[data-done-what]').textContent = (data.minutes || 30) + '-minute online ' + instrument.toLowerCase() + ' demo with Deepak.';
    done.querySelector('[data-wa-open]').href = lastWaUrl;
    done.querySelector('[data-blocked]').hidden = !blocked;
    done.focus();
    done.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  done.querySelector('[data-again]').addEventListener('click', function () {
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
