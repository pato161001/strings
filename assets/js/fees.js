/* Fees page: price table and Razorpay checkout, built from api/site.php.
   Without the server (static hosting) the page keeps the table written into
   fees.html and the Call / WhatsApp enroll box. The server always recalculates
   the amount it charges. */
(function () {
  'use strict';
  if (!window.TST_SITE) return;

  var ICONS = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    sunrise: '<path d="M17 18a5 5 0 0 0-10 0"/><path d="M12 2v7M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1M8 6l4-4 4 4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'
  };

  function rupees(n) {
    if (n === null || n === undefined) return 'Ask us';
    return '₹' + Math.round(n).toLocaleString('en-IN');
  }
  function monthsLabel(n) { return n === 1 ? '1 month' : n + ' months'; }
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function price(fees, slot, days, n) {
    var v = fees.slots[slot] && fees.slots[slot][days] ? fees.slots[slot][days][n] : null;
    return v === undefined || v === null || v <= 0 ? null : v;
  }

  window.TST_SITE.then(function (cfg) {
    if (!cfg || !cfg.fees || !cfg.fees.slots) return;
    renderTable(cfg.fees);
    if (cfg.pay_online) setupCheckout(cfg.fees);
  });

  function renderTable(fees) {
    var table = document.getElementById('fee-table');
    if (!table) return;
    table.querySelectorAll('tbody').forEach(function (b) { b.remove(); });
    Object.keys(fees.slots).forEach(function (key) {
      var s = fees.slots[key];
      var body = el('tbody');
      var head = el('tr', { 'class': 'slot-row' });
      var th = el('th', { colspan: '3', scope: 'rowgroup' });
      var icon = el('span', { 'class': 'slot-icon', 'aria-hidden': 'true' });
      icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[s.icon] || ICONS.sun) + '</svg>';
      th.appendChild(icon);
      th.appendChild(document.createTextNode(s.name));
      head.appendChild(th);
      body.appendChild(head);
      fees.class_counts.forEach(function (n) {
        var tr = el('tr');
        tr.appendChild(el('th', { scope: 'row' }, n + ' classes'));
        ['weekday', 'weekend'].forEach(function (d) {
          var v = price(fees, key, d, n);
          var td = el('td');
          td.appendChild(el('strong', {}, rupees(v)));
          if (v !== null && fees.usd_rate) td.appendChild(el('span', { 'class': 'usd' }, 'US$' + Math.round(v / fees.usd_rate)));
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });
      table.appendChild(body);
    });
  }

  function setupCheckout(fees) {
    var section = document.querySelector('.checkout');
    var offline = section.querySelector('.checkout__offline');
    var wrap = section.querySelector('.checkout__form-wrap');
    var done = section.querySelector('.checkout__done');
    var form = document.getElementById('checkout');
    var errorBox = form.querySelector('.form-error');
    var payBtn = form.querySelector('[data-pay]');
    var busy = false;

    function chip(name, value, label, checked) {
      var l = el('label', { 'class': 'chip' });
      var input = el('input', { type: 'radio', name: name, value: String(value) });
      input.checked = input.defaultChecked = !!checked; // defaultChecked so "Enroll another student" resets to it
      l.appendChild(input);
      l.appendChild(el('span', {}, label));
      return l;
    }
    function fill(name, entries) {
      var box = form.querySelector('[data-chips="' + name + '"]');
      entries.forEach(function (e, i) { box.appendChild(chip(name, e[0], e[1], i === 0)); });
    }
    function pairs(obj, fn) { return Object.keys(obj).map(function (k) { return [k, fn ? fn(k, obj[k]) : obj[k]]; }); }

    fill('instrument', pairs(fees.instruments));
    fill('mode', pairs(fees.modes));
    fill('slot', pairs(fees.slots, function (k, s) { return s.short || s.name; }));
    fill('days', pairs(fees.days));
    fill('classes', fees.class_counts.map(function (n) { return [n, n + ' a month']; }));
    fill('months', Object.keys(fees.discounts).map(Number).sort(function (a, b) { return a - b; }).map(function (m) {
      var pct = fees.discounts[m];
      return [m, monthsLabel(m) + (pct ? ', ' + pct + '% off' : '')];
    }));

    offline.hidden = true;
    wrap.hidden = false;

    function value(name) {
      var e = form.querySelector('[name="' + name + '"]:checked');
      return e ? e.value : null;
    }
    function currentQuote() {
      var q = {
        instrument: value('instrument'), mode: value('mode'), slot: value('slot'), days: value('days'),
        classes: parseInt(value('classes') || '0', 10), months: parseInt(value('months') || '1', 10)
      };
      var s = fees.slots[q.slot] || {};
      q.monthly = price(fees, q.slot, q.days, q.classes);
      q.pct = fees.discounts[q.months] || 0;
      q.subtotal = q.monthly === null ? null : q.monthly * q.months;
      q.discount = q.subtotal === null ? 0 : Math.round(q.subtotal * q.pct / 100);
      q.total = q.subtotal === null ? null : q.subtotal - q.discount;
      q.label = fees.instruments[q.instrument] + ', ' + (fees.modes[q.mode] || '') + ', ' +
        (fees.days[q.days] || '').toLowerCase() + ' ' + (s.short || s.name || '') + ' IST, ' +
        q.classes + ' classes a month, ' + monthsLabel(q.months);
      return q;
    }
    function render() {
      var q = currentQuote();
      form.querySelector('[data-summary-label]').textContent =
        rupees(q.monthly) + ' a month' + (q.months > 1 ? ' × ' + q.months : '');
      form.querySelector('[data-summary-subtotal]').textContent = rupees(q.subtotal);
      var discRow = form.querySelector('[data-summary-discount-row]');
      discRow.hidden = !q.discount;
      form.querySelector('[data-summary-discount-label]').textContent = 'Advance payment, ' + q.pct + '% off';
      form.querySelector('[data-summary-discount]').textContent = '−' + rupees(q.discount);
      form.querySelector('[data-summary-total]').textContent = rupees(q.total);
      payBtn.textContent = q.total === null ? 'Call us for this option' : 'Pay ' + rupees(q.total);
      payBtn.disabled = q.total === null || busy;
    }
    function showError(msg, field) {
      errorBox.textContent = msg;
      errorBox.hidden = false;
      form.querySelectorAll('[aria-invalid]').forEach(function (e) { e.removeAttribute('aria-invalid'); });
      if (field) {
        var f = form.querySelector('[name="' + field + '"]');
        if (f) { f.setAttribute('aria-invalid', 'true'); f.focus(); }
      }
    }
    function clearError() {
      errorBox.hidden = true;
      form.querySelectorAll('[aria-invalid]').forEach(function (e) { e.removeAttribute('aria-invalid'); });
    }
    function setBusy(on, label) {
      busy = on;
      payBtn.disabled = on;
      if (label) payBtn.textContent = label;
      if (!on) render();
    }
    function postJSON(url, body) {
      return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (res) { return res.json().catch(function () { return { ok: false, error: 'Something went wrong. Please try again.' }; }); });
    }
    var razorpayLoading = null;
    function loadRazorpay() {
      if (window.Razorpay) return Promise.resolve();
      if (razorpayLoading) return razorpayLoading;
      razorpayLoading = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = 'https://checkout.razorpay.com/v1/checkout.js';
        s.onload = resolve;
        s.onerror = function () { razorpayLoading = null; reject(new Error('load')); };
        document.head.appendChild(s);
      });
      return razorpayLoading;
    }
    function showDone(result, q) {
      wrap.hidden = true;
      done.hidden = false;
      done.querySelector('[data-done-line]').textContent = (result.student || 'You') + ' is enrolled: ' + (result.plan || q.label) + '.';
      done.querySelector('[data-done-id]').textContent = result.payment_id;
      done.focus();
    }

    form.addEventListener('change', function () { clearError(); render(); });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (busy) return;
      clearError();
      var q = currentQuote();
      var name = form.elements.name.value.trim();
      var phone = form.elements.phone.value.trim();
      var email = form.elements.email.value.trim();
      if (!name) return showError("Please enter the student's name.", 'name');
      if (phone.replace(/\D/g, '').length < 10) return showError('Please enter a 10-digit mobile number.', 'phone');
      if (q.total === null) return showError('Online payment isn\'t available for this option yet. Please call us to enroll.');

      setBusy(true, 'Starting payment…');
      Promise.all([
        postJSON('api/create-order.php', {
          instrument: q.instrument, mode: q.mode, slot: q.slot, days: q.days, classes: q.classes, months: q.months,
          name: name, phone: phone, email: email
        }),
        loadRazorpay().catch(function () { return 'load-failed'; })
      ]).then(function (results) {
        var order = results[0];
        if (results[1] === 'load-failed') { setBusy(false); return showError('The payment window couldn\'t load. Check your connection and try again.'); }
        if (!order.ok) { setBusy(false); return showError(order.error || 'We couldn\'t start the payment.', order.field); }

        var rzp = new window.Razorpay({
          key: order.key_id,
          order_id: order.order_id,
          amount: order.amount,
          currency: order.currency,
          name: order.name,
          description: order.description,
          prefill: order.prefill,
          notes: { plan: order.description },
          theme: { color: '#FCDF00' },
          modal: { ondismiss: function () { setBusy(false); } },
          handler: function (response) {
            setBusy(true, 'Confirming payment…');
            postJSON('api/verify-payment.php', response).then(function (result) {
              if (result.ok) { showDone(result, q); }
              else { setBusy(false); showError(result.error || 'We couldn\'t confirm the payment. Please call us.'); }
            }).catch(function () {
              setBusy(false);
              showError('We couldn\'t confirm the payment because the connection dropped. Please call us with payment ID ' + response.razorpay_payment_id + '.');
            });
          }
        });
        rzp.on('payment.failed', function (resp) {
          setBusy(false);
          var reason = resp && resp.error && resp.error.description ? resp.error.description : 'The payment didn\'t go through.';
          showError(reason + ' You can try again. If money was deducted, call us and we\'ll sort it out.');
        });
        rzp.open();
      }).catch(function () {
        setBusy(false);
        showError('We couldn\'t reach the server. Check your connection and try again.');
      });
    });

    done.querySelector('[data-reset]').addEventListener('click', function () {
      form.reset();
      done.hidden = true;
      wrap.hidden = false;
      busy = false;
      render();
      form.elements.name.focus();
    });

    render();
  }
})();
