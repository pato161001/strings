/* Fees page: live summary and Razorpay checkout. */
(function () {
  'use strict';

  var form = document.getElementById('checkout');
  var dataEl = document.getElementById('fee-data');
  if (!form || !dataEl) return;

  var data = JSON.parse(dataEl.textContent);
  var wrap = document.querySelector('.checkout__form-wrap');
  var done = document.querySelector('.checkout__done');
  var errorBox = form.querySelector('.form-error');
  var payBtn = form.querySelector('[data-pay]');
  var busy = false;

  function rupees(n) {
    if (n === null || n === undefined) return 'Ask us';
    return '₹' + Math.round(n).toLocaleString('en-IN');
  }
  function monthsLabel(n) { return n === 1 ? '1 month' : n + ' months'; }
  function value(name) {
    var el = form.querySelector('[name="' + name + '"]:checked');
    return el ? el.value : null;
  }

  function currentQuote() {
    var course = value('course');
    var mode = value('mode');
    var months = parseInt(value('months') || '1', 10);
    var c = data.courses[course] || {};
    var monthly = c[mode];
    var newStudentEl = form.querySelector('[name="new_student"]');
    var newStudent = newStudentEl ? newStudentEl.checked : false;
    var admission = newStudent && data.admission !== null ? data.admission : 0;
    var tuition = monthly == null ? null : monthly * months;
    return {
      course: course, mode: mode, months: months, newStudent: newStudent,
      label: (c.name || '') + ', ' + (data.modes[mode] || '').toLowerCase() + ', ' + monthsLabel(months),
      tuition: tuition,
      admission: admission,
      total: tuition == null ? null : tuition + admission
    };
  }

  // Disable modes that have no price for the chosen course.
  function syncModes() {
    var c = data.courses[value('course')] || {};
    var modeInputs = form.querySelectorAll('[name="mode"]');
    var current = value('mode');
    modeInputs.forEach(function (input) {
      input.disabled = c[input.value] == null;
    });
    if (current && c[current] == null) {
      for (var i = 0; i < modeInputs.length; i++) {
        if (!modeInputs[i].disabled) { modeInputs[i].checked = true; break; }
      }
    }
  }

  function render() {
    syncModes();
    var q = currentQuote();
    form.querySelector('[data-summary-label]').textContent = q.label;
    form.querySelector('[data-summary-tuition]').textContent = rupees(q.tuition);
    var admRow = form.querySelector('[data-summary-admission-row]');
    if (admRow) {
      admRow.hidden = !q.newStudent;
      form.querySelector('[data-summary-admission]').textContent = rupees(q.admission);
    }
    form.querySelector('[data-summary-total]').textContent = rupees(q.total);
    payBtn.textContent = q.total == null ? 'Call us for this option' : 'Pay ' + rupees(q.total);
    payBtn.disabled = q.total == null || busy;
  }

  function showError(msg, field) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
    form.querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
    if (field) {
      var el = form.querySelector('[name="' + field + '"]');
      if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); }
    }
  }
  function clearError() {
    errorBox.hidden = true;
    form.querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
  }

  function setBusy(on, label) {
    busy = on;
    payBtn.disabled = on;
    if (label) payBtn.textContent = label;
    if (!on) render();
  }

  function postJSON(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () { return { ok: false, error: 'Something went wrong. Please try again.' }; });
    });
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
    done.querySelector('[data-done-line]').textContent =
      (result.student || 'You') + ' is enrolled in ' + (result.plan || q.label) + '.';
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
    if (q.total == null) return showError('Online payment isn\'t available for this option yet. Please call us to enrol.');

    setBusy(true, 'Starting payment…');

    Promise.all([
      postJSON('api/create-order.php', {
        course: q.course, mode: q.mode, months: q.months, new_student: q.newStudent,
        name: name, phone: phone, email: email
      }),
      loadRazorpay().catch(function () { return 'load-failed'; })
    ]).then(function (results) {
      var order = results[0];
      if (results[1] === 'load-failed') {
        setBusy(false);
        return showError('The payment window couldn\'t load. Check your connection and try again.');
      }
      if (!order.ok) {
        setBusy(false);
        return showError(order.error || 'We couldn\'t start the payment.', order.field);
      }

      var rzp = new window.Razorpay({
        key: order.key_id,
        order_id: order.order_id,
        amount: order.amount,
        currency: order.currency,
        name: order.name,
        description: order.description,
        prefill: order.prefill,
        notes: { plan: order.description },
        theme: { color: '#E8B44A' },
        modal: {
          ondismiss: function () { setBusy(false); }
        },
        handler: function (response) {
          setBusy(true, 'Confirming payment…');
          postJSON('api/verify-payment.php', response).then(function (result) {
            if (result.ok) {
              showDone(result, q);
            } else {
              setBusy(false);
              showError(result.error || 'We couldn\'t confirm the payment. Please call us.');
            }
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
})();
