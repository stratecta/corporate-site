/* STRATECTA corporate site — 改修案 v1 */
(function(){
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = window.matchMedia('(hover: none)').matches;


  // ---- Google Analytics 4 (only when <meta name="ga-id"> has an ID) ----
  (function(){
    var m = document.querySelector('meta[name="ga-id"]');
    var id = m && m.content.trim();
    if (!id || !/^G-[A-Z0-9]+$/.test(id)) return;          // empty or invalid: send nothing
    // 当社の端末を計測から外す：?ga=off を一度開くとその端末では送らない（?ga=on で戻す）
    try {
      var q = location.search;
      if (/[?&]ga=off(&|$)/.test(q)) localStorage.setItem('stratecta_ga_optout', '1');
      if (/[?&]ga=on(&|$)/.test(q)) localStorage.removeItem('stratecta_ga_optout');
      if (localStorage.getItem('stratecta_ga_optout') === '1') return;
    } catch (e) {}
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){ dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', id);
    // which contact button was pressed (the email itself cannot be tracked)
    document.addEventListener('click', function(e){
      var a = e.target.closest && e.target.closest('a'); if (!a) return;
      var h = a.getAttribute('href') || '';
      var where = (a.closest('section') || {}).id || 'other';
      if (h.indexOf('mailto:') === 0) {
        var subj = ''; try { subj = decodeURIComponent((h.split('subject=')[1] || '').split('&')[0]); } catch(_) {}
        gtag('event', 'contact_email', { topic: subj || 'general', section: where, page: location.pathname });
      } else if (h.indexOf('tel:') === 0) {
        gtag('event', 'contact_tel', { section: where, page: location.pathname });
      } else if (/^https?:/.test(h) && a.host !== location.host) {
        gtag('event', 'outbound_click', { link_url: h, section: where });
      }
    }, true);
  })();



  // header shadow + mobile menu
  var hd = document.querySelector('.hd');
  window.addEventListener('scroll', function(){ if(hd) hd.classList.toggle('scrolled', window.scrollY > 8); }, {passive:true});
  var burger = document.querySelector('.burger');
  if (burger) {
    burger.addEventListener('click', function(){
      var open = document.body.classList.toggle('menu-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.querySelectorAll('.nav a').forEach(function(a){
      a.addEventListener('click', function(){ document.body.classList.remove('menu-open'); burger.setAttribute('aria-expanded','false'); });
    });
  }

  // CEO message: release the clamp when "read more" opens (mobile)
  var ceoD = document.querySelector('.ceo details');
  if (ceoD) ceoD.addEventListener('toggle', function(){ document.querySelector('.ceo').classList.toggle('open', ceoD.open); });
  // services: fold bullets on mobile
  if (window.matchMedia('(max-width:600px)').matches) document.querySelectorAll('.sp-more').forEach(function(d){ d.open = false; });

  // hero headline: one character at a time (kept from the current site)
  var h1 = document.querySelector('.hero h1[data-split]');
  if (h1 && !reduce) {
    var t = h1.textContent; h1.textContent = '';
    h1.setAttribute('aria-label', t);
    Array.from(t).forEach(function(c, i){
      var s = document.createElement('span'); s.className = 'ch'; s.textContent = c;
      s.setAttribute('aria-hidden','true');
      s.style.animationDelay = (0.25 + i * 0.07) + 's'; h1.appendChild(s);
    });
  }

  // steps: play the sequence when they come into view
  var steps = document.querySelectorAll('.steps');
  if ('IntersectionObserver' in window && !reduce) {
    var sio = new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('play'); sio.unobserve(e.target); } }); }, {threshold:.4});
    steps.forEach(function(el){ sio.observe(el); });
  } else { steps.forEach(function(el){ el.classList.add('play'); }); }



  // ---- flow stage (video.html): rolling number + one clip per step ----
  document.querySelectorAll('.flow-sec').forEach(function(sec){
    var fl = sec.querySelector('[data-flow]'), stage = sec.querySelector('.flow-stage'); if (!fl || !stage) return;
    var digits = stage.querySelector('.st-digits'), clips = stage.querySelectorAll('.st-v'), name = stage.querySelector('.st-name'), bar = stage.querySelector('.st-bar i');
    var names = Array.prototype.map.call(fl.querySelectorAll('.fs b'), function(b){ return b.textContent; });
    var screen = stage.querySelector('.st-screen');
    function show(i){
      var h = digits.firstElementChild ? digits.firstElementChild.getBoundingClientRect().height : 0;
      digits.style.transform = 'translateY(' + (-i * h) + 'px)';
      clips.forEach(function(v, k){
        if (k === i) {
          if (!v.src && v.dataset.src) { v.src = v.dataset.src; }
          v.classList.add('on'); try { v.currentTime = 0; } catch(_) {}
          if (!reduce) { var p = v.play(); if (p && p.catch) p.catch(function(){}); }
          if (screen && v.poster) screen.style.backgroundImage = 'url("' + v.poster + '")';
        } else { v.classList.remove('on'); v.pause(); }
      });
      if (name) { name.classList.add('swap'); setTimeout(function(){ name.textContent = names[i] || ''; name.classList.remove('swap'); }, 220); }
      if (bar && !reduce) { bar.classList.remove('run'); void bar.offsetWidth; bar.classList.add('run'); }
    }
    fl.addEventListener('flowstep', function(e){ show(e.detail.i); });
    window.addEventListener('resize', function(){ var on = fl.querySelector('.fs.on'); if (on) show(parseInt(on.getAttribute('data-i'), 10) || 0); });
  });

  // ---- flow (制作の流れ): auto-advance, click to jump ----
  document.querySelectorAll('[data-flow]').forEach(function(fl){
    var items = fl.querySelectorAll('.fs'), descs = fl.querySelectorAll('.flow-desc p'), fill = fl.querySelector('.flow-fill');
    var n = items.length, cur = -1, timer = null, hold = 0;
    function set(i){
      cur = i;
      items.forEach(function(li, k){ li.classList.toggle('done', k <= i); li.classList.toggle('on', k === i); });
      descs.forEach(function(p, k){ p.classList.toggle('on', k === i); });
      if (fill) fill.style.width = (n > 1 ? (i / (n - 1)) * 100 : 100) + '%';
      fl.dispatchEvent(new CustomEvent('flowstep', {detail:{i:i}}));
    }
    function tick(){ if (hold > 0) { hold--; return; } set((cur + 1) % n); }
    items.forEach(function(li, k){ li.querySelector('button').addEventListener('click', function(){ set(k); hold = 2; }); });
    if (reduce) { set(n - 1); return; }
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){
        if (e.isIntersecting) { if (!timer) { if (cur < 0) set(0); timer = setInterval(tick, fl.closest('.flow-sec') ? 5600 : 2200); } }
        else if (timer) { clearInterval(timer); timer = null; }
      });
    }, {threshold:.35});
    io.observe(fl);
  });

  // ---- strengths: count up numbers when shown ----
  document.querySelectorAll('.count[data-to]').forEach(function(el){
    var to = parseInt(el.getAttribute('data-to'), 10) || 0;
    if (reduce || !('IntersectionObserver' in window)) { el.textContent = to; return; }
    el.textContent = '0';
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){
        if (!e.isIntersecting) return; io.disconnect();
        var t0 = null, dur = 1200;
        function step(t){ if (!t0) t0 = t; var r = Math.min(1, (t - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - r, 3))); if (r < 1) requestAnimationFrame(step); }
        requestAnimationFrame(step);
      });
    }, {threshold:.6});
    io.observe(el);
  });

  // ---- headings that type in when they come into view (CEO message) ----
  document.querySelectorAll('[data-split-view]').forEach(function(h){
    var t = h.textContent; h.setAttribute('aria-label', t); h.textContent = '';
    Array.from(t).forEach(function(c, i){ var s = document.createElement('span'); s.className = 'ch'; s.textContent = c; s.setAttribute('aria-hidden','true'); s.style.transitionDelay = (i * 0.055) + 's'; h.appendChild(s); });
    h.style.setProperty('--sweep', (Array.from(t).length * 0.055 + 0.2) + 's');
    if (reduce || !('IntersectionObserver' in window)) { h.classList.add('play'); return; }
    var io = new IntersectionObserver(function(es){ es.forEach(function(e){ if (e.isIntersecting) { h.classList.add('play'); io.disconnect(); } }); }, {threshold:.6});
    io.observe(h);
  });

  // reveal on scroll
  var rv = document.querySelectorAll('.rv');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    }, {threshold:.12});
    rv.forEach(function(el){ io.observe(el); });
  } else { rv.forEach(function(el){ el.classList.add('in'); }); }

  // videos: load only when near the viewport, play while visible, pause when not
  var vids = document.querySelectorAll('video[data-src]');
  // keep the poster visible behind each video so nothing flashes while it loads (Safari)
  vids.forEach(function(v){ var po = v.getAttribute('poster'), box = v.parentElement; if (po && box && !box.classList.contains('scr')) box.style.backgroundImage = 'url("' + po + '")'; });
  function load(v){ if(!v.src){ v.src = v.dataset.src; v.load(); } }
  if (reduce) { return; } // keep posters only
  if ('IntersectionObserver' in window) {
    var vio = new IntersectionObserver(function(es){
      es.forEach(function(e){
        var v = e.target;
        if (e.isIntersecting) {
          load(v);
          // service cards on PC play on hover; everywhere else play when visible
          if (!(v.dataset.hover !== undefined && !touch)) { var p = v.play(); if (p && p.catch) p.catch(function(){}); }
        } else { v.pause(); }
      });
    }, {rootMargin:'200px 0px', threshold:.2});
    vids.forEach(function(v){ vio.observe(v); });
  }
  if (!touch) {
    document.querySelectorAll('video[data-hover]').forEach(function(v){
      var card = v.closest('.card') || v;
      card.addEventListener('mouseenter', function(){ load(v); var p=v.play(); if(p&&p.catch)p.catch(function(){}); });
      card.addEventListener('mouseleave', function(){ v.pause(); });
    });
  }

  // TOC highlight (M&A page)
  var toc = document.querySelectorAll('.toc a[href^="#"]');
  if (toc.length && 'IntersectionObserver' in window) {
    var map = {}; toc.forEach(function(a){ map[a.getAttribute('href').slice(1)] = a; });
    var tio = new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ toc.forEach(function(a){a.classList.remove('on');}); var a = map[e.target.id]; if(a) a.classList.add('on'); } });
    }, {rootMargin:'-20% 0px -70% 0px'});
    Object.keys(map).forEach(function(id){ var el = document.getElementById(id); if(el) tio.observe(el); });
  }
})();
