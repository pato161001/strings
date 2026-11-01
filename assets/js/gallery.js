/* Circular reveal gallery (a plain-JS port of the "carousel circular image gallery"
   React component). Turns <div data-circle-gallery> with <img> children into an
   animated gallery: each photo opens out of its little round thumbnail and the
   old one folds back into its own.

   Needs GSAP + MotionPathPlugin, loaded from cdnjs on demand. If they can't load,
   or the visitor prefers reduced motion, the plain photos stay as they are.
   To add a photo, add another <img> inside the data-circle-gallery element. */
(function () {
  'use strict';

  var root = document.querySelector('[data-circle-gallery]');
  if (!root) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var imgs = Array.prototype.slice.call(root.querySelectorAll('img'));
  if (imgs.length < 2) return;
  var photos = imgs.map(function (img) { return { url: img.getAttribute('src'), alt: img.getAttribute('alt') || '' }; });

  var SVGNS = 'http://www.w3.org/2000/svg';
  var W = 400, H = 300;                 // 4:3 frame, in SVG units
  var R = 7, GAP = 10;                  // thumbnail radius and spacing
  var BIG = R * 700;                    // radius large enough to cover the frame
  var DURATION = 0.4, AUTOPLAY_MS = 4500;
  var total = photos.length;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  function ready() {
    if (window.gsap && window.MotionPathPlugin) return Promise.resolve();
    var base = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/';
    return (window.gsap ? Promise.resolve() : loadScript(base + 'gsap.min.js'))
      .then(function () { return loadScript(base + 'MotionPathPlugin.min.js'); });
  }

  // Start loading only when the gallery is near the screen
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { io.disconnect(); start(); }
    }, { rootMargin: '300px' });
    io.observe(root);
  } else {
    start();
  }

  function start() {
    ready().then(function () {
      window.gsap.registerPlugin(window.MotionPathPlugin);
      build();
    }).catch(function () { /* keep the plain photos */ });
  }

  function el(name, attrs) {
    var e = document.createElementNS(SVGNS, name);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }
  function tabX(i) { return W / 2 - (total * (R * 2 + GAP) - GAP) / 2 + i * (R * 2 + GAP); }
  var tabY = H - 26;

  function build() {
    var gsap = window.gsap;
    var uid = 'cg' + Math.random().toString(36).slice(2, 7);
    var opened = 0, inPlace = 0, disabled = false, firstLoad = true, timer = null, paused = false;

    var frame = document.createElement('div');
    frame.className = 'cgallery__frame';
    var layers = photos.map(function (p, i) {
      var layer = document.createElement('div');
      layer.className = 'cgallery__layer';
      var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true' });
      var defs = el('defs');
      var cc = el('clipPath', { id: uid + '_c' + i });
      var circle = el('circle', { cx: 0, cy: 0, r: R });
      cc.appendChild(circle);
      var sc = el('clipPath', { id: uid + '_s' + i });
      sc.appendChild(el('rect', { width: W, height: H }));
      defs.appendChild(cc); defs.appendChild(sc);
      var g = el('g');
      var image = el('image', { width: W, height: H, href: p.url, preserveAspectRatio: 'xMidYMid slice' });
      g.appendChild(image);
      svg.appendChild(defs); svg.appendChild(g);
      layer.appendChild(svg);
      frame.appendChild(layer);
      return { layer: layer, g: g, circle: circle, id: i };
    });

    // Round thumbnail buttons along the bottom (HTML buttons so they work with a keyboard)
    var tabs = document.createElement('div');
    tabs.className = 'cgallery__tabs';
    var tabButtons = photos.map(function (p, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cgallery__tab';
      b.style.left = (tabX(i) / W * 100) + '%';
      b.style.top = (tabY / H * 100) + '%';
      b.style.backgroundImage = 'url("' + p.url + '")';
      b.setAttribute('aria-label', 'Show photo ' + (i + 1) + ' of ' + total + ': ' + p.alt);
      b.addEventListener('click', function () { if (!disabled) go(i, true); });
      tabs.appendChild(b);
      return b;
    });
    frame.appendChild(tabs);

    var live = document.createElement('p');
    live.className = 'cgallery__caption';
    live.setAttribute('aria-live', 'polite');
    frame.appendChild(live);

    function arrow(dir) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cgallery__nav cgallery__nav--' + dir;
      b.setAttribute('aria-label', dir === 'prev' ? 'Previous photo' : 'Next photo');
      b.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (dir === 'prev' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6') + '"/></svg>';
      b.addEventListener('click', function () { if (!disabled) go((opened + (dir === 'prev' ? total - 1 : 1)) % total, true); });
      return b;
    }
    var prevBtn = arrow('prev'), nextBtn = arrow('next');
    frame.appendChild(prevBtn); frame.appendChild(nextBtn);

    root.textContent = '';
    root.classList.add('cgallery');
    root.setAttribute('role', 'region');
    root.setAttribute('aria-roledescription', 'carousel');
    root.appendChild(frame);

    var defaults = { transformOrigin: 'center center' };
    function small(i) { return { attr: { cx: tabX(i), cy: tabY, r: R } }; }
    function smallAbove(i) { return { cx: tabX(i), cy: H / 2, r: R * 2 }; }
    var center = { attr: { cx: W / 2, cy: H / 2, r: R * 7 } };
    var end = { attr: { cx: W / 2 - BIG, cy: H / 2, r: BIG } };
    var startPos = { attr: { cx: W / 2 + BIG, cy: H / 2, r: BIG } };

    function paint() {
      layers.forEach(function (l) {
        var isIn = inPlace === l.id;
        l.layer.style.zIndex = isIn ? l.id : total + 1;
        l.g.setAttribute('clip-path', 'url(#' + uid + (isIn ? '_s' : '_c') + l.id + ')');
      });
      tabButtons.forEach(function (b, i) { b.setAttribute('aria-current', i === opened ? 'true' : 'false'); });
      prevBtn.disabled = nextBtn.disabled = disabled;
    }
    function settle(id) {
      inPlace = id;
      disabled = false;
      live.textContent = photos[id].alt;
      paint();
    }

    // The curved bounce back to the thumbnail runs on a plain object and copies
    // its values onto the circle, so every step sets SVG attributes the same way.
    function bounceHome(c, id, duration) {
      var p = { cx: W / 2, cy: H / 2, r: R * 7 };
      return gsap.to(p, {
        motionPath: { path: [smallAbove(id), { cx: tabX(id), cy: tabY, r: R }], curviness: 1 },
        duration: duration, ease: 'bounce.out',
        onUpdate: function () { c.setAttribute('cx', p.cx); c.setAttribute('cy', p.cy); c.setAttribute('r', p.r); }
      });
    }

    function animate() {
      var flip = firstLoad ? 0 : DURATION;
      var up = firstLoad ? 0 : 0.2;
      var bounce = firstLoad ? 0.01 : 1;
      var delay = firstLoad ? 0 : flip + up;
      layers.forEach(function (l) {
        var c = l.circle;
        if (l.tl) l.tl.kill();
        if (l.id === opened) {
          l.tl = gsap.timeline()
            .set(c, Object.assign({}, defaults, small(l.id)))
            .to(c, Object.assign({}, defaults, center, { duration: up, ease: 'power3.inOut' }))
            .to(c, Object.assign({}, defaults, end, { duration: flip, ease: 'power4.in', onComplete: function () { settle(l.id); } }));
        } else {
          l.tl = gsap.timeline()
            .set(c, Object.assign({}, defaults, startPos))
            .to(c, Object.assign({}, defaults, center, { delay: delay, duration: flip, ease: 'power4.out' }))
            .add(bounceHome(c, l.id, bounce));
        }
      });
      firstLoad = false;
    }

    function go(i, fromUser) {
      if (i === opened && !firstLoad) return;
      opened = i;
      disabled = true;
      paint();
      animate();
      restart();
    }
    function restart() {
      if (timer) clearInterval(timer);
      if (!paused) timer = setInterval(function () { if (!disabled) go((opened + 1) % total); }, AUTOPLAY_MS);
    }
    function pause(on) { paused = on; if (on && timer) { clearInterval(timer); timer = null; } else if (!on) restart(); }

    // Pause while the visitor is pointing at it, using its buttons, or it is off screen
    frame.addEventListener('mouseenter', function () { pause(true); });
    frame.addEventListener('mouseleave', function () { pause(false); });
    frame.addEventListener('focusin', function () { pause(true); });
    frame.addEventListener('focusout', function () { pause(false); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { pause(!entries[0].isIntersecting); }).observe(root);
    }
    document.addEventListener('visibilitychange', function () { pause(document.hidden); });

    // First paint: photo 1 open, the rest tucked into their thumbnails
    paint();
    animate();
  }
})();
