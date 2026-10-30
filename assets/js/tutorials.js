/* Tutorials page: instrument filters and in-page player. */
(function () {
  'use strict';

  var frame = document.querySelector('#player .player__frame');
  var titleEl = document.querySelector('[data-player-title]');
  var labelEl = document.querySelector('[data-player-label]');
  var cards = Array.prototype.slice.call(document.querySelectorAll('.video-card'));
  var countEl = document.querySelector('[data-count]');

  // Filters
  var filters = document.querySelectorAll('[data-filter]');
  filters.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var cat = btn.getAttribute('data-filter');
      filters.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
      var shown = 0;
      cards.forEach(function (card) {
        var match = cat === 'all' || card.getAttribute('data-category') === cat;
        card.hidden = !match;
        if (match) shown++;
      });
      if (countEl) countEl.textContent = shown + (shown === 1 ? ' video' : ' videos');
    });
  });

  // Player: load the YouTube embed only when someone presses play.
  function play(id, title, fromCard) {
    if (!frame) return;
    var iframe = document.createElement('iframe');
    iframe.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0';
    iframe.title = title;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    frame.innerHTML = '';
    frame.appendChild(iframe);
    if (titleEl) titleEl.textContent = title;
    if (labelEl) labelEl.textContent = 'Now playing';
    cards.forEach(function (c) {
      c.classList.toggle('is-playing', c.querySelector('[data-play]').getAttribute('data-play') === id);
    });
    if (fromCard) {
      document.getElementById('player').scrollIntoView({ block: 'center' });
    }
  }

  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-play]');
    if (!btn) return;
    play(btn.getAttribute('data-play'), btn.getAttribute('data-title'), !!btn.closest('.video-card'));
  });
})();
