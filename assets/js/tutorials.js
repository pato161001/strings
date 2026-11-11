/* Tutorials page: Deepak's YouTube channel, one section per playlist.
   The list comes from the Google Apps Script (?action=youtube, URL in booking-config.js),
   so new playlists and uploads appear on their own. Without it, the player still
   plays the channel's latest uploads straight from YouTube. */
(function () {
  'use strict';

  var player = document.getElementById('player');
  var root = document.getElementById('tutorials');
  if (!player || !root) return;

  var frame = player.querySelector('.player__frame');
  var labelEl = player.querySelector('[data-player-label]');
  var titleEl = player.querySelector('[data-player-title]');
  var fromEl = player.querySelector('[data-player-from]');
  var EMBED = 'https://www.youtube-nocookie.com/embed/';
  var PLAY = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="8 5 19 12 8 19 8 5"/></svg>';
  var ARROW = function (d) { return '<svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="' + (d < 0 ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6') + '"/></svg>'; };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function thumbOf(v) { return v.thumb || 'https://i.ytimg.com/vi/' + encodeURIComponent(v.id) + '/hqdefault.jpg'; }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function compact(n) { return n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : String(n); }

  /* ---------- player ---------- */

  function embed(src, title, label, from) {
    var iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.title = title;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    frame.textContent = '';
    frame.appendChild(iframe);
    labelEl.textContent = label;
    titleEl.textContent = title;
    fromEl.textContent = from || '';
  }
  function playVideo(v, list, index, listTitle) {
    embed(EMBED + encodeURIComponent(v.id) + '?autoplay=1&rel=0' + (list ? '&list=' + encodeURIComponent(list) + '&index=' + (index + 1) : ''),
      v.title, 'Now playing', listTitle ? 'From ' + listTitle : '');
    document.querySelectorAll('.tcard.is-playing').forEach(function (c) { c.classList.remove('is-playing'); });
    document.querySelectorAll('.tcard[data-vid="' + v.id + '"][data-list="' + list + '"]').forEach(function (c) { c.classList.add('is-playing'); });
  }
  function playList(list, title) {
    embed(EMBED + 'videoseries?list=' + encodeURIComponent(list) + '&autoplay=1&rel=0', title, 'Now playing', 'Whole playlist');
  }
  function toPlayer() {
    var top = player.getBoundingClientRect().top + window.pageYOffset - 24;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  // Works before (and without) the playlist data: play the channel's uploads
  frame.addEventListener('click', function (ev) {
    var start = ev.target.closest('[data-play-list]');
    if (!start) return;
    ev.preventDefault();
    playList(start.getAttribute('data-play-list'), 'Latest uploads');
  });

  /* ---------- playlists ---------- */

  var endpoint = (window.TST_BOOKING_URL || '').trim();
  if (!endpoint || !window.fetch) return;

  // Loading screen: placeholder playlists while the list arrives (the first load can take a few seconds)
  var fallback = Array.prototype.slice.call(root.childNodes);
  var loader = el('div', 'tut-loading');
  loader.setAttribute('role', 'status');
  loader.setAttribute('aria-live', 'polite');
  loader.innerHTML =
    '<div class="tut-loading__bar"><div class="container"><span class="tut-loading__eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>' +
    '<span class="tut-loading__text">Tuning up… loading the lessons</span></div></div>' +
    '<div class="container">' + [0, 1].map(function () {
      return '<div class="sk-pl"><div class="sk sk--title"></div><div class="sk sk--meta"></div><div class="sk-row">' +
        [0, 1, 2, 3].map(function () { return '<div class="sk-card"><div class="sk sk--thumb"></div><div class="sk sk--line"></div><div class="sk sk--line sk--short"></div></div>'; }).join('') +
        '</div></div>';
    }).join('') + '</div>';
  root.textContent = '';
  root.appendChild(loader);
  player.classList.add('is-loading');
  var settled = false;
  function giveUp() {
    if (settled) return;
    settled = true;
    player.classList.remove('is-loading');
    root.textContent = '';
    fallback.forEach(function (n) { root.appendChild(n); });
  }
  var slow = setTimeout(giveUp, 25000); // don't leave the loader up for ever

  fetch(endpoint + (endpoint.indexOf('?') === -1 ? '?' : '&') + 'action=youtube', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (settled) return;
      if (!data || !data.ok) return giveUp();
      settled = true;
      clearTimeout(slow);
      player.classList.remove('is-loading');
      build(data);
    })
    .catch(giveUp);

  function build(data) {
    var ch = data.channel || {};
    var avatar = document.querySelector('[data-yt-avatar]');
    if (avatar && ch.thumb) avatar.src = ch.thumb;
    var stats = document.querySelector('[data-yt-stats]');
    if (stats) stats.textContent = [ch.handle || '@stringstheory', ch.videos ? plural(ch.videos, 'video') : '', ch.subscribers ? compact(ch.subscribers) + ' subscribers' : ''].filter(Boolean).join(' · ');

    var sections = [];
    if (data.uploads && data.uploads.videos && data.uploads.videos.length) {
      sections.push({ key: 'latest', id: data.uploads.id, title: 'Latest uploads', description: 'The newest lessons on the channel.',
        count: data.uploads.videos.length, videos: data.uploads.videos, url: (ch.url || 'https://www.youtube.com/@stringstheory') + '/videos' });
    }
    (data.playlists || []).forEach(function (pl) {
      var shown = pl.videos.length;
      sections.push({ key: pl.id, id: pl.id, title: pl.title, description: pl.description, count: pl.count > shown && shown >= 50 ? pl.count : shown, videos: pl.videos,
        url: 'https://www.youtube.com/playlist?list=' + encodeURIComponent(pl.id) });
    });
    if (!sections.length) return;

    // Latest upload ready in the big player
    var first = sections[0].videos[0];
    frame.textContent = '';
    var big = el('button', 'player__poster');
    big.type = 'button';
    big.setAttribute('aria-label', 'Play: ' + first.title);
    var img = el('img'); img.src = thumbOf(first); img.alt = '';
    big.appendChild(img);
    var icon = el('span', 'player__start-icon'); icon.innerHTML = PLAY.replace('20', '30').replace('20', '30');
    big.appendChild(icon);
    big.addEventListener('click', function () { playVideo(first, sections[0].id, 0, sections[0].title); });
    frame.appendChild(big);
    labelEl.textContent = 'Latest upload';
    titleEl.textContent = first.title;
    fromEl.textContent = '';

    root.textContent = '';

    // Jump menu
    var nav = el('nav', 'pl-nav');
    nav.setAttribute('aria-label', 'Playlists');
    var navInner = el('div', 'container pl-nav__inner');
    navInner.appendChild(el('span', 'pl-nav__label', 'Playlists'));
    var navList = el('div', 'pl-nav__list');
    sections.forEach(function (s) {
      var a = el('a', 'pl-nav__link');
      a.href = '#pl-' + s.key;
      a.appendChild(document.createTextNode(s.title));
      a.appendChild(el('b', '', String(s.count)));
      navList.appendChild(a);
    });
    navInner.appendChild(navList);
    nav.appendChild(navInner);
    root.appendChild(nav);

    var wrap = el('div', 'container pl-wrap');
    sections.forEach(function (s, i) { wrap.appendChild(section(s, i)); });
    root.appendChild(wrap);

    // Highlight the playlist in view in the jump menu
    if ('IntersectionObserver' in window) {
      var links = navList.querySelectorAll('a');
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          links.forEach(function (l) {
            var on = l.getAttribute('href') === '#' + en.target.id;
            l.classList.toggle('is-active', on);
            if (on && navList.scrollWidth > navList.clientWidth) navList.scrollTo({ left: l.offsetLeft - 16, behavior: 'smooth' });
          });
        });
      }, { rootMargin: '-40% 0px -55% 0px' });
      wrap.querySelectorAll('.pl').forEach(function (sec) { io.observe(sec); });
    }
  }

  function section(s, i) {
    var sec = el('section', 'pl');
    sec.id = 'pl-' + s.key;
    sec.setAttribute('aria-labelledby', 'pl-h-' + i);

    var head = el('header', 'pl__head');
    head.appendChild(el('span', 'pl__num', String(i + 1).padStart(2, '0')));
    var text = el('div', 'pl__text');
    var h = el('h2', 'pl__title', s.title); h.id = 'pl-h-' + i;
    text.appendChild(h);
    text.appendChild(el('p', 'pl__meta', plural(s.count, 'video')));
    if (s.description) text.appendChild(el('p', 'pl__desc', s.description));
    head.appendChild(text);
    var actions = el('div', 'pl__actions');
    var all = el('button', 'btn btn--gold pl__playall');
    all.type = 'button';
    all.innerHTML = PLAY + '<span>Play all</span>';
    all.addEventListener('click', function () { playList(s.id, s.title); toPlayer(); });
    actions.appendChild(all);
    var yt = el('a', 'btn btn--outline', 'On YouTube');
    yt.href = s.url; yt.target = '_blank'; yt.rel = 'noopener';
    actions.appendChild(yt);
    head.appendChild(actions);
    sec.appendChild(head);

    var rail = el('div', 'rail');
    var prev = el('button', 'rail__nav rail__nav--prev'); prev.type = 'button'; prev.setAttribute('aria-label', 'Scroll ' + s.title + ' left'); prev.innerHTML = ARROW(-1);
    var next = el('button', 'rail__nav rail__nav--next'); next.type = 'button'; next.setAttribute('aria-label', 'Scroll ' + s.title + ' right'); next.innerHTML = ARROW(1);
    var track = el('div', 'rail__track');
    track.setAttribute('role', 'list');
    s.videos.forEach(function (v, n) { track.appendChild(card(v, n, s)); });
    rail.appendChild(prev);
    rail.appendChild(track);
    rail.appendChild(next);
    sec.appendChild(rail);

    function step(dir) { track.scrollBy({ left: dir * track.clientWidth * 0.9, behavior: 'smooth' }); }
    prev.addEventListener('click', function () { step(-1); });
    next.addEventListener('click', function () { step(1); });
    function arrows() {
      prev.disabled = track.scrollLeft < 8;
      next.disabled = track.scrollLeft + track.clientWidth > track.scrollWidth - 8;
      rail.classList.toggle('rail--fits', prev.disabled && next.disabled);
    }
    track.addEventListener('scroll', function () { window.requestAnimationFrame(arrows); }, { passive: true });
    window.addEventListener('resize', arrows);
    setTimeout(arrows, 0);
    return sec;
  }

  function card(v, n, s) {
    var c = el('article', 'tcard');
    c.setAttribute('role', 'listitem');
    c.setAttribute('data-vid', v.id);
    c.setAttribute('data-list', s.id);
    var b = el('button', 'tcard__play');
    b.type = 'button';
    b.setAttribute('aria-label', 'Play: ' + v.title);
    var img = el('img'); img.src = thumbOf(v); img.alt = ''; img.loading = 'lazy';
    b.appendChild(img);
    var icon = el('span', 'tcard__icon'); icon.innerHTML = PLAY;
    b.appendChild(icon);
    if (v.duration) b.appendChild(el('span', 'tcard__time', v.duration));
    b.addEventListener('click', function () { playVideo(v, s.id, n, s.title); toPlayer(); });
    c.appendChild(b);
    c.appendChild(el('span', 'tcard__num', '#' + String(n + 1).padStart(2, '0')));
    c.appendChild(el('h3', 'tcard__title', v.title));
    return c;
  }
})();
