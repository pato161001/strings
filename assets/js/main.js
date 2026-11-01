/* Shared: phone contact button, scroll reveals, enquiry form that hands off to WhatsApp. */

// On phones the contact buttons fold into one; this opens and closes them.
(function () {
  'use strict';
  var stack = document.getElementById('fab-stack');
  var toggle = stack && stack.querySelector('.fab-toggle');
  if (!toggle) return;
  function set(open) {
    stack.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close contact options' : 'Contact options');
  }
  toggle.addEventListener('click', function () { set(!stack.classList.contains('is-open')); });
  stack.addEventListener('click', function (ev) {
    if (ev.target.closest('.fab') && !ev.target.closest('.fab-toggle')) set(false);
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && stack.classList.contains('is-open')) { set(false); toggle.focus(); }
  });
  document.addEventListener('click', function (ev) {
    if (!stack.contains(ev.target)) set(false);
  });
})();

// Sections ease in as they scroll into view. Content stays visible if this never runs.
(function () {
  'use strict';
  var items = document.querySelectorAll('[data-reveal]');
  if (!items.length) return;
  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('in'); });
    return;
  }
  // Stagger siblings that share a parent: heading, then text, then picture.
  var counts = new Map();
  items.forEach(function (el) {
    var n = counts.get(el.parentNode) || 0;
    el.style.setProperty('--d', Math.min(n, 5) * 80 + 'ms');
    counts.set(el.parentNode, n + 1);
  });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  items.forEach(function (el) { io.observe(el); });
})();

(function () {
  'use strict';

  var dialog = document.getElementById('enquiry');
  if (!dialog || typeof dialog.showModal !== 'function') return; // old browsers keep the plain WhatsApp link

  var form = document.getElementById('enquiry-form');
  var done = dialog.querySelector('.enquiry__done');
  var errorBox = form.querySelector('.form-error');
  var number = form.getAttribute('data-whatsapp');

  function open(ev) {
    ev.preventDefault();
    // Buttons like "Book a private class" pre-select the class type.
    var preset = ev.currentTarget.getAttribute('data-class');
    if (preset && form.elements['class']) form.elements['class'].value = preset;
    var inst = ev.currentTarget.getAttribute('data-instrument');
    if (inst && form.elements.instrument) form.elements.instrument.value = inst;
    form.hidden = false;
    done.hidden = true;
    errorBox.hidden = true;
    dialog.showModal();
    form.elements.name.focus();
  }

  document.querySelectorAll('[data-open-enquiry]').forEach(function (el) {
    el.addEventListener('click', open);
  });
  dialog.querySelectorAll('[data-close-enquiry]').forEach(function (el) {
    el.addEventListener('click', function () { dialog.close(); });
  });
  // Click on the dimmed area outside the panel closes it.
  dialog.addEventListener('click', function (ev) {
    if (ev.target === dialog) {
      var r = dialog.getBoundingClientRect();
      var inside = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      if (!inside) dialog.close();
    }
  });

  function fail(msg, field) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
    form.querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
    var el = form.elements[field];
    if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); }
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = form.elements;
    var name = f.name.value.trim();
    var phone = f.phone.value.trim();
    if (!name) return fail('Please enter your name.', 'name');
    if (phone.replace(/\D/g, '').length < 10) return fail('Please enter a 10-digit mobile number.', 'phone');

    var lines = [
      "Hi Deepak, I'd like to book a first lesson at The Strings Theory.",
      '',
      'Name: ' + name,
      'Phone: ' + phone,
      'Class: ' + f['class'].value,
      'Instrument: ' + f.instrument.value,
      'Where: ' + f.mode.value
    ];
    var msg = f.message.value.trim();
    if (msg) lines.push('', msg);

    var url = 'https://wa.me/' + number + '?text=' + encodeURIComponent(lines.join('\n'));
    // With 'noopener' window.open always returns null, so detach the opener by hand instead.
    var win = window.open(url, '_blank');
    if (win) { win.opener = null; } else { window.location.href = url; }

    form.hidden = true;
    done.hidden = false;
    form.reset();
    done.querySelector('button').focus();
  });
})();
