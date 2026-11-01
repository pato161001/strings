/* Tutorials page: loads Deepak's videos from api/videos.php, then builds the
   latest-upload player, instrument filters and the video grid.
   Without the server it keeps the "coming soon" message. */
(function () {
  'use strict';

  var root = document.getElementById('tutorials');
  var player = document.getElementById('player');
  if (!root || !player || !window.fetch) return;

  var frame = player.querySelector('.player__frame');
  var caption = player.querySelector('figcaption');
  var titleEl = player.querySelector('[data-player-title]');
  var labelEl = player.querySelector('[data-player-label]');
  var ORDER = ['Guitar', 'Ukulele', 'Theory', 'More'];
  var PLAY_ICON = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="8 5 19 12 8 19 8 5"/></svg>';

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function playButton(v, thumb) {
    var b = el('button', { 'class': 'video-card__play', type: 'button', 'data-play': v.id, 'aria-label': 'Play: ' + v.title });
    b.setAttribute('data-title', v.title);
    var img = el('img', { src: 'https://i.ytimg.com/vi/' + encodeURIComponent(v.id) + '/' + thumb + '.jpg', alt: '', loading: 'lazy' });
    b.appendChild(img);
    var icon = el('span', { 'class': 'video-card__icon' });
    icon.innerHTML = PLAY_ICON;
    b.appendChild(icon);
    return b;
  }

  fetch('api/videos.php', { headers: { Accept: 'application/json' } })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) {
      if (!data || !data.ok || !data.videos || !data.videos.length) return;
      build(data.videos);
    })
    .catch(function () { /* keep the coming-soon message */ });

  function build(videos) {
    // Latest upload in the big player
    var latest = videos[0];
    frame.textContent = '';
    var big = playButton(latest, 'hqdefault');
    big.style.cssText = 'position:absolute;inset:0;aspect-ratio:auto';
    var bigIcon = big.querySelector('.video-card__icon');
    bigIcon.style.cssText = 'width:80px;height:80px;margin:-40px 0 0 -40px';
    frame.appendChild(big);
    titleEl.textContent = latest.title;
    caption.hidden = false;

    // Filters
    var present = {};
    videos.forEach(function (v) { present[v.category] = true; });
    var cats = ORDER.filter(function (c) { return present[c]; });

    root.textContent = '';
    var bar = el('div', { 'class': 'filters-bar' });
    var group = el('div', { 'class': 'filters', role: 'group', 'aria-label': 'Show tutorials for' });
    ['all'].concat(cats).forEach(function (c, i) {
      var b = el('button', { 'class': 'filter', type: 'button', 'data-filter': c, 'aria-pressed': i === 0 ? 'true' : 'false' }, c === 'all' ? 'All' : c);
      group.appendChild(b);
    });
    var count = el('span', { 'class': 'muted', 'aria-live': 'polite', 'data-count': '' });
    bar.appendChild(group);
    bar.appendChild(count);
    root.appendChild(bar);

    // Grid
    var grid = el('div', { 'class': 'video-grid' });
    var cards = videos.map(function (v) {
      var card = el('article', { 'class': 'video-card', 'data-category': v.category });
      var btn = playButton(v, 'mqdefault');
      if (v.duration) btn.appendChild(el('span', { 'class': 'video-card__time' }, v.duration));
      card.appendChild(btn);
      card.appendChild(el('span', { 'class': 'video-card__meta' }, (v.category === 'More' ? 'Video' : v.category) + (v.level ? ', ' + v.level : '')));
      card.appendChild(el('h3', {}, v.title));
      grid.appendChild(card);
      return card;
    });
    root.appendChild(grid);

    function setCount(n) { count.textContent = n + (n === 1 ? ' video' : ' videos'); }
    setCount(cards.length);

    group.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-filter]');
      if (!btn) return;
      var cat = btn.getAttribute('data-filter');
      group.querySelectorAll('[data-filter]').forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
      var shown = 0;
      cards.forEach(function (card) {
        var match = cat === 'all' || card.getAttribute('data-category') === cat;
        card.hidden = !match;
        if (match) shown++;
      });
      setCount(shown);
    });

    // Player: load the YouTube embed only when someone presses play
    document.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-play]');
      if (!btn) return;
      var id = btn.getAttribute('data-play');
      var title = btn.getAttribute('data-title');
      var iframe = document.createElement('iframe');
      iframe.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0';
      iframe.title = title;
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      frame.textContent = '';
      frame.appendChild(iframe);
      titleEl.textContent = title;
      labelEl.textContent = 'Now playing';
      cards.forEach(function (c) { c.classList.toggle('is-playing', c.querySelector('[data-play]').getAttribute('data-play') === id); });
      if (btn.closest('.video-card')) player.scrollIntoView({ block: 'center' });
    });
  }
})();
