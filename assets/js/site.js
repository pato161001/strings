/* Site settings from the server (api/site.php).
   The .html pages already contain sensible defaults, so if this can't load
   (for example on a static host with no PHP) the page simply keeps them. */
(function () {
  'use strict';

  window.TST_SITE = (window.fetch ? fetch('api/site.php', { headers: { Accept: 'application/json' } })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) { return data && data.ok ? data : null; })
    .catch(function () { return null; }) : Promise.resolve(null));

  function get(obj, path) {
    return path.split('.').reduce(function (o, k) { return o && o[k] !== undefined ? o[k] : null; }, obj);
  }

  window.TST_SITE.then(function (cfg) {
    if (!cfg) return;

    // Text that comes from settings, e.g. <dd data-site="school.hours">
    document.querySelectorAll('[data-site]').forEach(function (el) {
      var key = el.getAttribute('data-site');
      var value;
      if (key === 'batchLine') {
        value = cfg.fees && cfg.fees.batch_timings ? 'Batches: ' + cfg.fees.batch_timings : null;
      } else {
        value = get(cfg, key);
      }
      if (value) el.textContent = value;
    });

    // Links that only show when a setting is filled in, e.g. the YouTube channel
    document.querySelectorAll('[data-site-href]').forEach(function (el) {
      var url = get(cfg, el.getAttribute('data-site-href'));
      if (url) {
        el.href = url + (el.getAttribute('data-suffix') || '');
        el.hidden = false;
      }
    });

    // Email button appears once the school's address is in config.php
    var email = cfg.school && cfg.school.email;
    if (email) {
      document.querySelectorAll('[data-site-email]').forEach(function (el) {
        el.href = 'mailto:' + email + '?subject=' + encodeURIComponent('Lesson enquiry');
        el.hidden = false;
      });
    }
  });
})();
