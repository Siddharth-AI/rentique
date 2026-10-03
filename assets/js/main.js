/* =====================================================================
   RENTIQUE — interactions & motion
   GSAP 3 (ScrollTrigger, SplitText, Flip, DrawSVG, CustomEase) + Lenis
   ===================================================================== */
(() => {
  'use strict';

  /* ------------------------------------------------------------------
     CONFIG — edit these for production
     ------------------------------------------------------------------ */
  const CONFIG = {
    whatsappNumber: '',        // e.g. '919876543210' → shows "Continue on WhatsApp" after booking
    storageKey: 'rentique.v1'
  };

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const root = document.documentElement;
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const G = window.gsap;

  const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  if (!G) { root.classList.remove('is-loading'); console.warn('GSAP missing — running without motion.'); }
  if (G) {
    G.registerPlugin(ScrollTrigger, SplitText, Flip, DrawSVGPlugin, CustomEase);
    CustomEase.create('silk', 'M0,0 C0.12,0.6 0.2,1 1,1');
    G.defaults({ ease: 'expo.out', duration: 1.2 });
    ScrollTrigger.config({ ignoreMobileResize: true });
  }

  /* ------------------------------------------------------------------
     Lenis smooth scroll (synced to GSAP's ticker)
     ------------------------------------------------------------------ */
  let lenis = null;
  if (G && !RM && window.Lenis) {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true, syncTouch: false, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    G.ticker.add((t) => lenis.raf(t * 1000));
    G.ticker.lagSmoothing(0);
  }
  let locks = 0;
  const lockScroll = () => { locks++; lenis ? lenis.stop() : (document.body.style.overflow = 'hidden'); };
  const unlockScroll = () => { locks = Math.max(0, locks - 1); if (!locks) { lenis ? lenis.start() : (document.body.style.overflow = ''); } };
  const scrollTo = (target, opts = {}) => {
    if (lenis) lenis.scrollTo(target, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4), ...opts });
    else {
      const y = typeof target === 'number' ? target : (typeof target === 'string' ? $(target) : target).getBoundingClientRect().top + window.scrollY + (opts.offset || 0);
      window.scrollTo({ top: y, behavior: RM ? 'auto' : 'smooth' });
      if (opts.onComplete) setTimeout(opts.onComplete, RM ? 0 : 900);
    }
  };

  /* ------------------------------------------------------------------
     Persistent state (wishlist + bag) — per-browser convenience only
     ------------------------------------------------------------------ */
  const state = { wish: new Set(), bag: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG.storageKey) || 'null');
    if (saved) { state.wish = new Set(saved.wish || []); state.bag = saved.bag || []; }
  } catch (e) { /* storage unavailable */ }
  const save = () => { try { localStorage.setItem(CONFIG.storageKey, JSON.stringify({ wish: [...state.wish], bag: state.bag })); } catch (e) {} };

  /* ------------------------------------------------------------------
     Toast
     ------------------------------------------------------------------ */
  const toastEl = $('[data-toast]');
  let toastT;
  const toast = (msg) => {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2600);
  };

  /* ------------------------------------------------------------------
     Videos — play only while visible (saves battery & data)
     ------------------------------------------------------------------ */
  const videos = $$('video[data-autoplay]');
  if (RM) {
    videos.forEach((v) => { v.removeAttribute('autoplay'); v.pause(); });
  } else if ('IntersectionObserver' in window) {
    const vio = new IntersectionObserver((entries) => {
      entries.forEach(({ target: v, isIntersecting }) => {
        if (isIntersecting) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
        else v.pause();
      });
    }, { threshold: 0.15, rootMargin: '120px 0px' });
    videos.forEach((v) => vio.observe(v));
  }

  /* ==================================================================
     HERO — WebGL silk + Jharokha window
     ================================================================== */
  const hero = $('.hero');
  const heroCanvas = $('.hero__silk');
  const silk = initSilk(heroCanvas);
  const portraitMQ = window.matchMedia('(max-aspect-ratio: 1/1), (max-width: 900px)');
  let geom = null;
  let introDone = false;
  const archState = { p: 0 };

  function computeGeom() {
    const vw = window.innerWidth;
    const vh = hero.offsetHeight;
    const portrait = portraitMQ.matches;
    const h = portrait ? Math.min(vh * 0.46, vw * 0.92) : Math.min(vh * 0.74, vw * 0.42);
    const w = h / 1.4;
    const cy = vh * (portrait ? 0.53 : 0.535);
    const W = Math.max(vw * 1.1, (vh * 1.95) / 1.4);
    const H = W * 1.4;
    geom = { w, h, top: cy - h / 2, W, H, top1: vh - H + vh * 0.02, vw, vh };
    return geom;
  }
  function setArch(w, h, top) {
    hero.style.setProperty('--mw', w.toFixed(2) + 'px');
    hero.style.setProperty('--mh', h.toFixed(2) + 'px');
    hero.style.setProperty('--mt', top.toFixed(2) + 'px');
  }
  function applyArch() {
    if (!introDone || !geom) return;
    const p = archState.p;
    const w = lerp(geom.w, geom.W, p);
    setArch(w, w * 1.4, lerp(geom.top, geom.top1, p));
    if (silk) silk.active = p < 0.98 && heroVisible;
  }
  computeGeom();

  let heroVisible = true;
  let mouse = { x: 0.5, y: 0.5 }, mouseT = { x: 0.5, y: 0.5 };
  if (silk) {
    window.addEventListener('pointermove', (e) => { mouseT.x = e.clientX / window.innerWidth; mouseT.y = 1 - e.clientY / window.innerHeight; }, { passive: true });
    const loop = (time) => {
      if (!silk.active) return;
      mouse.x += (mouseT.x - mouse.x) * 0.04; mouse.y += (mouseT.y - mouse.y) * 0.04;
      silk.render(RM ? 8 : time, mouse);
    };
    if (G) G.ticker.add(loop); else { const raf = (t) => { loop(t / 1000); requestAnimationFrame(raf); }; requestAnimationFrame(raf); }
    window.addEventListener('resize', () => silk.resize(), { passive: true });
    silk.resize();
    silk.render(8, mouse);
    heroCanvas.classList.add('is-ready');
    if (RM) silk.active = false;
  }

  function heroIntro() {
    const tl = G.timeline();
    const iv = { v: 0 };
    const g = geom;
    const titleSplit = new SplitText('[data-hero-title] .ht-l1, [data-hero-title] .ht-l2', { type: 'chars,lines', mask: 'lines', charsClass: 'hc', linesClass: 'hl' });
    tl.fromTo(iv, { v: 0 }, {
      v: 1, duration: 2, ease: 'expo.inOut',
      onUpdate: () => { const h = g.h * iv.v; setArch(g.w, Math.max(h, 0.01), g.top + g.h - h); }
    }, 0)
      .add(() => { introDone = true; applyArch(); unlockScroll(); }, 2.0)
      .from('.hero__video', { scale: 1.5, duration: 2.6, ease: 'expo.out' }, 0.3)
      .from('.hero__archline path', { drawSVG: '50% 50%', duration: 2.2, ease: 'expo.inOut', stagger: 0.12 }, 0.2)
      .from(titleSplit.chars, { yPercent: 118, duration: 1.5, stagger: 0.028, ease: 'expo.out' }, 0.75)
      .from('.hero__title--outline > span', { autoAlpha: 0, duration: 1.2, ease: 'power2.out' }, 1.6)
      .from('[data-hero-ui] > *', { y: 26, autoAlpha: 0, duration: 1.2, stagger: 0.08 }, 1.25);
    return tl;
  }

  function heroScroll() {
    G.set('[data-hero-media]', { scale: 1.22 });
    const capLines = $$('[data-hero-caption] p');
    const tl = G.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        id: 'hero', trigger: hero, start: 'top top', end: () => '+=' + Math.round(hero.offsetHeight * 1.35),
        pin: true, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true, refreshPriority: 10,
        onToggle: (self) => { heroVisible = self.isActive || self.progress < 1; if (silk) silk.active = heroVisible && archState.p < 0.98; }
      }
    });
    tl.to(archState, { p: 1, duration: 1, ease: 'power2.inOut', onUpdate: applyArch }, 0)
      .to('[data-hero-media]', { scale: 1, duration: 1 }, 0)
      .to('.hero__title', { scale: 1.55, yPercent: -10, autoAlpha: 0, duration: 0.55, ease: 'power2.in' }, 0)
      .to('[data-hero-ui]', { autoAlpha: 0, y: -40, duration: 0.3 }, 0)
      .to('.hero__archline', { autoAlpha: 0, duration: 0.35 }, 0.1)
      .to(hero, { '--shade': 0.9, duration: 0.4 }, 0.55)
      .set('[data-hero-caption]', { autoAlpha: 1 }, 0.62)
      .fromTo(capLines, { yPercent: 70, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.3, stagger: 0.08, ease: 'power3.out' }, 0.64)
      .to({}, { duration: 0.2 });
  }

  /* ------------------------------------------------------------------
     WebGL silk shader (raw WebGL — no Three.js needed, ~2 KB)
     ------------------------------------------------------------------ */
  function initSilk(canvas) {
    if (!canvas) return null;
    let gl;
    try { gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' }); } catch (e) { gl = null; }
    if (!gl) return null;
    const vs = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
    const fs = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 r;uniform float t;uniform vec2 m;
float h(vec2 p){
  float a=t*.11;
  p+=.5*vec2(sin(p.y*1.05+a*1.3),cos(p.x*.85-a));
  return sin(p.x*1.2+a*1.1)*.55+sin(p.y*1.8-a*.9+p.x*.65)*.32+sin((p.x-p.y)*2.6+a*.6)*.13;
}
void main(){
  vec2 uv=gl_FragCoord.xy/r;
  vec2 p=(gl_FragCoord.xy-.5*r)/r.y*2.3;
  p+=(m-.5)*vec2(.4,.28);
  float e=.006;float c=h(p);
  vec2 g=vec2(h(p+vec2(e,0.))-c,h(p+vec2(0.,e))-c)/e;
  vec3 n=normalize(vec3(-g*.55,1.));
  vec3 L=normalize(vec3(-.35+(m.x-.5)*.9,.55+(m.y-.5)*.6,.8));
  float d=clamp(dot(n,L),0.,1.);
  vec3 H=normalize(L+vec3(0.,0.,1.));
  float nh=clamp(dot(n,H),0.,1.);
  vec3 deep=vec3(.07,.012,.02);vec3 wine=vec3(.37,.05,.09);
  vec3 col=mix(deep,wine,smoothstep(.1,1.,d));
  col+=pow(nh,6.)*vec3(.22,.06,.05);
  col+=pow(nh,42.)*vec3(.95,.70,.40)*.8;
  float vg=smoothstep(1.3,.2,length((uv-.5)*vec2(1.3,1.)));
  col*=mix(.42,1.,vg);
  col+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5)*.03;
  gl_FragColor=vec4(col,1.);
}`;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; };
    const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    const prog = gl.createProgram(); gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uR = gl.getUniformLocation(prog, 'r'), uT = gl.getUniformLocation(prog, 't'), uM = gl.getUniformLocation(prog, 'm');
    const api = {
      active: true,
      resize() {
        const scale = window.innerWidth < 760 ? 0.5 : 0.7;
        const w = Math.max(1, Math.round(canvas.clientWidth * scale)), h = Math.max(1, Math.round(canvas.clientHeight * scale));
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
      },
      render(time, mm) { gl.uniform2f(uR, canvas.width, canvas.height); gl.uniform1f(uT, time); gl.uniform2f(uM, mm.x, mm.y); gl.drawArrays(gl.TRIANGLES, 0, 3); }
    };
    return api;
  }

  /* ==================================================================
     PRELOADER
     ================================================================== */
  function runPreloader() {
    return new Promise((resolve) => {
      if (!G || RM || !root.classList.contains('is-loading')) { root.classList.remove('is-loading'); resolve(false); return; }
      lockScroll();
      window.scrollTo(0, 0);
      const pl = $('.preloader');
      const countEl = $('[data-count]', pl);
      const c = { v: 0 };
      const fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
      const timeout = new Promise((r) => setTimeout(r, 3500));
      const ready = Promise.race([Promise.all([fontsReady, new Promise((r) => setTimeout(r, 1600))]), timeout]);
      // hero starts closed under the preloader
      setArch(geom.w, 0.01, geom.top + geom.h);
      const tl = G.timeline();
      tl.from('.preloader__mark .mark__outer, .preloader__mark .mark__inner, .preloader__mark .mark__base', { drawSVG: 0, duration: 1.6, ease: 'power2.inOut', stagger: 0.1 }, 0)
        .from('.preloader__mark .mark__r', { autoAlpha: 0, yPercent: 20, duration: 1 }, 0.7)
        .from('.preloader__mark .mark__diamond', { scale: 0, transformOrigin: '50% 50%', duration: 0.8, ease: 'back.out(3)' }, 1.1)
        .from('.preloader__hello, .preloader__count, .preloader__note', { y: 16, autoAlpha: 0, stagger: 0.08, duration: 0.9 }, 0.2)
        .to(c, { v: 82, duration: 1.6, ease: 'power2.inOut', onUpdate: () => { countEl.textContent = String(Math.round(c.v)).padStart(3, '0'); } }, 0.2);
      ready.then(() => {
        G.timeline({ onComplete: () => { root.classList.remove('is-loading'); } })
          .to(c, { v: 100, duration: 0.5, ease: 'power2.out', onUpdate: () => { countEl.textContent = String(Math.round(c.v)).padStart(3, '0'); } })
          .to('.preloader__inner', { autoAlpha: 0, y: -30, duration: 0.6, ease: 'power3.in' }, '+=0.1')
          .to('.preloader__panel--top', { yPercent: -101, duration: 1.3, ease: 'expo.inOut' }, '-=0.15')
          .to('.preloader__panel--bottom', { yPercent: 101, duration: 1.3, ease: 'expo.inOut' }, '<')
          .add(() => resolve(true), '<0.25');
      });
    });
  }

  /* ==================================================================
     NAV, MENU, PROGRESS
     ================================================================== */
  const nav = $('[data-nav]');
  const burger = $('[data-burger]');
  const menu = $('[data-menu]');
  let menuOpen = false;
  let updateNavTheme = () => {};

  function initNav() {
    let lastY = 0;
    const onScroll = (y) => {
      nav.classList.toggle('is-scrolled', y > 40);
      if (!menuOpen) nav.classList.toggle('is-hidden', y > lastY && y > 400 && !locks);
      lastY = y;
    };
    if (lenis) lenis.on('scroll', (l) => onScroll(l.scroll)); else window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true });

    burger.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
  }
  function openMenu() {
    menuOpen = true; burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Close menu');
    menu.classList.add('is-open'); menu.setAttribute('aria-hidden', 'false'); nav.classList.add('is-dark'); nav.classList.remove('is-hidden');
    lockScroll();
    if (G) {
      G.killTweensOf('.menu__bg, .menu__links a, .menu__foot');
      G.timeline()
        .fromTo('.menu__bg', { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'expo.inOut' })
        .fromTo('.menu__links a', { yPercent: 100, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, stagger: 0.06, duration: 1 }, 0.35)
        .fromTo('.menu__foot', { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 0.6);
    }
  }
  function closeMenu(cb) {
    if (!menuOpen) { if (cb) cb(); return; }
    menuOpen = false; burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Open menu');
    menu.setAttribute('aria-hidden', 'true');
    const done = () => { menu.classList.remove('is-open'); unlockScroll(); if (cb) cb(); };
    if (G) {
      G.timeline({ onComplete: done })
        .to('.menu__links a, .menu__foot', { autoAlpha: 0, y: -20, duration: 0.35, stagger: 0.02, ease: 'power2.in' })
        .to('.menu__bg', { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.7, ease: 'expo.inOut' }, 0.15);
    } else done();
    updateNavTheme();
  }

  /* Anchor links */
  function initAnchors() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('[data-scroll-to]');
      if (!a) return;
      const id = a.getAttribute('href');
      if (!id || id.charAt(0) !== '#') return;
      e.preventDefault();
      const go = () => scrollTo(id === '#top' ? 0 : id, { offset: 0 });
      menuOpen ? closeMenu(go) : go();
    });
  }

  /* ==================================================================
     CURSOR + MAGNETIC
     ================================================================== */
  function initCursor() {
    if (!FINE || !G || RM) return;
    root.classList.add('has-cursor');
    const cur = $('.cursor'), ring = $('.cursor__ring'), dot = $('.cursor__dot'), label = $('.cursor__label');
    const rx = G.quickTo(ring, 'x', { duration: 0.55, ease: 'power3' }), ry = G.quickTo(ring, 'y', { duration: 0.55, ease: 'power3' });
    const dx = G.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' }), dy = G.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });
    let shown = false;
    window.addEventListener('pointermove', (e) => {
      if (!shown) { shown = true; G.set([ring, dot], { x: e.clientX, y: e.clientY }); G.to(cur, { autoAlpha: 1, duration: 0.4 }); }
      rx(e.clientX); ry(e.clientY); dx(e.clientX); dy(e.clientY);
    }, { passive: true });
    document.addEventListener('pointerover', (e) => {
      const lab = e.target.closest('[data-cursor]');
      const hov = e.target.closest('a, button, summary, label.opt, input[type=range], .chip');
      cur.classList.toggle('is-label', !!lab);
      label.textContent = lab ? lab.getAttribute('data-cursor') : '';
      cur.classList.toggle('is-hover', !lab && !!hov);
    });
    root.addEventListener('mouseleave', () => G.to(cur, { autoAlpha: 0, duration: 0.3 }));
    root.addEventListener('mouseenter', () => G.to(cur, { autoAlpha: 1, duration: 0.3 }));

    $$('[data-magnetic]').forEach((el) => {
      const qx = G.quickTo(el, 'x', { duration: 0.6, ease: 'power3' }), qy = G.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        qx((e.clientX - (r.left + r.width / 2)) * 0.3); qy((e.clientY - (r.top + r.height / 2)) * 0.4);
      });
      el.addEventListener('pointerleave', () => { G.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.4)' }); });
    });
  }

  /* ==================================================================
     MARQUEE (velocity-reactive)
     ================================================================== */
  function initMarquee() {
    const track = $('.marquee__track');
    if (!track) return;
    track.innerHTML += track.innerHTML; // seamless loop
    if (!G || RM) return;
    const loop = G.to(track, { xPercent: -50, duration: 38, ease: 'none', repeat: -1 });
    if (lenis) {
      let dir = 1;
      lenis.on('scroll', ({ velocity, direction }) => {
        if (direction) dir = direction;
        const speed = 1 + Math.min(Math.abs(velocity) / 6, 5);
        loop.timeScale(dir * speed);
        G.to(loop, { timeScale: dir, duration: 1.2, ease: 'power2.out', overwrite: true });
        G.to(track, { skewX: clamp(-velocity * 0.25, -10, 10), duration: 0.6, ease: 'power3', overwrite: 'auto' });
      });
    }
  }

  /* ==================================================================
     GENERIC REVEALS
     ================================================================== */
  function initReveals() {
    // Headline line reveals
    $$('[data-split]').forEach((el) => {
      SplitText.create(el, {
        type: 'lines', mask: 'lines', autoSplit: true, linesClass: 'sl',
        onSplit: (self) => G.from(self.lines, { yPercent: 105, duration: 1.3, stagger: 0.1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 86%', once: true } })
      });
    });

    // Manifesto — words light up as you read
    const man = $('[data-words]');
    if (man) {
      const split = new SplitText(man, { type: 'words', wordsClass: 'mw' });
      G.fromTo(split.words, { opacity: 0.14 }, { opacity: 1, stagger: 0.12, ease: 'none', scrollTrigger: { trigger: man, start: 'top 78%', end: 'bottom 50%', scrub: true } });
      $$('.pill', man).forEach((p) => {
        G.from(p, { width: 0, marginInline: 0, duration: 1.4, ease: 'expo.inOut', scrollTrigger: { trigger: p, start: 'top 82%', once: true } });
      });
    }

    // Cards & blocks
    ScrollTrigger.batch('.pcard, .stream, .stat, .road__phase, .qa, .reel figcaption, .closet', {
      start: 'top 88%', once: true,
      onEnter: (els) => G.from(els, { y: 50, autoAlpha: 0, stagger: 0.1, duration: 1.2, overwrite: true, clearProps: 'transform,opacity,visibility' })
    });

    // Product media curtain reveal
    ScrollTrigger.batch('.product', {
      start: 'top 92%', once: true,
      onEnter: (els) => {
        const media = els.map((e) => e.querySelector('.product__media'));
        const imgs = els.map((e) => e.querySelector('.product__media img'));
        const bodies = els.map((e) => e.querySelector('.product__body'));
        G.fromTo(media, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, stagger: 0.1, ease: 'expo.out', clearProps: 'clipPath' });
        G.from(imgs, { scale: 1.35, duration: 1.8, stagger: 0.1, ease: 'expo.out', clearProps: 'transform' });
        G.from(bodies, { y: 24, autoAlpha: 0, duration: 1, stagger: 0.1, delay: 0.25, clearProps: 'transform,opacity,visibility' });
      }
    });

    // Counters
    $$('[data-counter]').forEach((el) => {
      const end = parseFloat(el.dataset.counter);
      const dec = parseInt(el.dataset.decimals || '0', 10);
      const fmt = el.dataset.format === 'inr';
      const o = { v: 0 };
      const render = () => { el.textContent = fmt ? Math.round(o.v).toLocaleString('en-IN') : o.v.toFixed(dec); };
      render();
      G.to(o, { v: end, duration: 2, ease: 'power3.out', onUpdate: render, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
    });

    // Footer wordmark
    G.from('[data-footword] span', { yPercent: 100, duration: 1.4, stagger: 0.06, ease: 'expo.out', scrollTrigger: { trigger: '[data-footword]', start: 'top 95%', once: true } });

    // CTA parallax
    G.fromTo('.cta__video', { yPercent: -12, scale: 1.15 }, { yPercent: 12, scale: 1.15, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true } });
  }

  /* ==================================================================
     PROBLEM — the closet of ten
     ================================================================== */
  function initCloset() {
    const closet = $('[data-closet]');
    if (!closet) return;
    const hangers = $$('.hanger', closet);
    const worn = $('.hanger.is-worn', closet);
    const others = hangers.filter((h) => h !== worn);
    const tl = G.timeline({ scrollTrigger: { trigger: closet, start: 'top 75%', once: true } });
    G.set(hangers, { transformOrigin: '50% 2%' });
    tl.from(hangers, { y: -40, autoAlpha: 0, rotation: () => G.utils.random(-14, 14), duration: 1.6, stagger: 0.06, ease: 'elastic.out(1, 0.35)' })
      .to(others, { opacity: 0.28, duration: 0.8, stagger: 0.03, ease: 'power2.out' }, '-=0.6')
      .fromTo(worn, { rotation: 0 }, { rotation: 6, duration: 0.5, yoyo: true, repeat: 3, ease: 'sine.inOut' }, '<')
      .from('.closet__label', { y: 16, autoAlpha: 0, duration: 0.9 }, '<0.2');

    if (FINE && !RM) {
      $$('[data-tilt]').forEach((card) => {
        const rx = G.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3' }), ry = G.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3' });
        G.set(card, { transformPerspective: 900 });
        card.addEventListener('pointermove', (e) => { const r = card.getBoundingClientRect(); ry(((e.clientX - r.left) / r.width - 0.5) * 10); rx(-((e.clientY - r.top) / r.height - 0.5) * 10); });
        card.addEventListener('pointerleave', () => { rx(0); ry(0); });
      });
    }
  }

  /* ==================================================================
     COLLECTION — filters (Flip), wishlist, quick view, bag
     ================================================================== */
  const products = $$('.product');
  const byId = (id) => products.find((p) => p.dataset.id === id);
  const unsplash = (id, w) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=72`;

  function applyFilter(f, animate = true) {
    const btns = $$('.filter');
    btns.forEach((b) => { const on = b.dataset.filter === f; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    const flipState = G && animate && !RM ? Flip.getState(products) : null;
    products.forEach((p) => p.classList.toggle('is-hidden', !(f === 'all' || p.dataset.cat === f)));
    if (flipState) {
      Flip.from(flipState, {
        duration: 0.8, ease: 'power3.inOut', absolute: true, scale: true, nested: true,
        onEnter: (els) => G.fromTo(els, { autoAlpha: 0, scale: 0.85 }, { autoAlpha: 1, scale: 1, duration: 0.7, delay: 0.15 }),
        onLeave: (els) => G.to(els, { autoAlpha: 0, scale: 0.85, duration: 0.4 }),
        onComplete: () => ScrollTrigger.refresh()
      });
    } else if (G) ScrollTrigger.refresh();
  }

  function initCollection() {
    $$('.filter').forEach((b) => b.addEventListener('click', () => applyFilter(b.dataset.filter)));
    $$('[data-goto-filter]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      const f = a.dataset.gotoFilter;
      scrollTo('#collection', { onComplete: () => applyFilter(f) });
    }));

    // wishlist
    $$('[data-wish]').forEach((btn) => {
      const id = btn.closest('.product').dataset.id;
      btn.setAttribute('aria-pressed', state.wish.has(id) ? 'true' : 'false');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const on = !state.wish.has(id);
        on ? state.wish.add(id) : state.wish.delete(id);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (G && on) G.fromTo(btn, { scale: 0.7 }, { scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.35)' });
        save(); updateCounts(); renderDrawer();
        toast(on ? `Saved ${byId(id).dataset.name} to your wishlist` : 'Removed from wishlist');
      });
    });

    // quick view triggers
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-quickview]');
      if (!t || e.target.closest('[data-wish]')) return;
      const p = t.closest('.product');
      if (p) openQuickView(p.dataset.id, t);
    });
    updateCounts();
  }

  function updateCounts() {
    $$('[data-wish-count]').forEach((el) => { el.textContent = state.wish.size; el.classList.toggle('has', state.wish.size > 0); });
    $$('[data-bag-count]').forEach((el) => { el.textContent = state.bag.length; el.classList.toggle('has', state.bag.length > 0); });
  }

  /* --- Generic modal helper (open/close with focus management) --- */
  function makeModal(el, boxSel, scrimSel, { from = { y: 40, autoAlpha: 0, scale: 0.98 } } = {}) {
    let opener = null, isOpen = false;
    const box = $(boxSel, el), scrim = $(scrimSel, el);
    const focusables = () => $$('a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])', el).filter((n) => n.offsetParent !== null && !n.hidden);
    const onKey = (e) => {
      if (e.key === 'Escape') api.close();
      if (e.key === 'Tab') {
        const f = focusables(); if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    const api = {
      get isOpen() { return isOpen; },
      open(trigger) {
        if (isOpen) return; isOpen = true; opener = trigger || document.activeElement;
        el.classList.add('is-open'); el.setAttribute('aria-hidden', 'false'); lockScroll();
        document.addEventListener('keydown', onKey);
        if (G) { G.killTweensOf([box, scrim]); G.to(scrim, { autoAlpha: 1, duration: 0.5, ease: 'power2.out' }); G.fromTo(box, from, { y: 0, x: 0, xPercent: 0, autoAlpha: 1, scale: 1, duration: 0.9, ease: 'expo.out' }); }
        else { scrim.style.opacity = 1; }
        setTimeout(() => { const f = focusables(); (f.find((n) => !n.classList.contains('xbtn')) || f[0] || box).focus({ preventScroll: true }); }, 60);
      },
      close() {
        if (!isOpen) return; isOpen = false;
        document.removeEventListener('keydown', onKey);
        const done = () => { el.classList.remove('is-open'); el.setAttribute('aria-hidden', 'true'); unlockScroll(); if (opener && opener.focus) opener.focus({ preventScroll: true }); };
        if (G) { G.to(scrim, { autoAlpha: 0, duration: 0.4 }); G.to(box, { ...from, duration: 0.45, ease: 'power3.in', onComplete: done }); }
        else done();
      }
    };
    return api;
  }

  /* --- Quick view --- */
  const qvEl = $('[data-qv]');
  const qv = makeModal(qvEl, '.qv__box', '.qv__scrim');
  let qvProduct = null;
  const qvState = { size: 'M', days: 3, mult: 1 };
  const dayPrice = (base, mult) => mult === 1 ? base : Math.round((base * mult) / 50) * 50 - 1;

  function minDate(offset = 2) { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); }

  function openQuickView(id, trigger) {
    const p = byId(id); if (!p) return;
    qvProduct = p;
    const img = $('[data-qv-img]', qvEl);
    img.classList.remove('is-broken');
    img.onerror = () => img.classList.add('is-broken');
    img.src = unsplash(p.dataset.img, 1100);
    img.alt = p.querySelector('img').alt;
    $('[data-qv-tag]', qvEl).textContent = p.dataset.tag;
    $('[data-qv-name]', qvEl).textContent = p.dataset.name;
    $('[data-qv-desc]', qvEl).textContent = p.dataset.desc;
    const date = $('[data-qv-date]', qvEl); date.min = minDate(2); if (!date.value || date.value < date.min) date.value = minDate(10);
    updateQvPrice();
    qv.open(trigger);
  }
  function updateQvPrice() {
    if (!qvProduct) return;
    const base = +qvProduct.dataset.price;
    $('[data-qv-price]', qvEl).textContent = inr(dayPrice(base, qvState.mult));
    $('[data-qv-per]', qvEl).textContent = `for ${qvState.days} days · cleaning included`;
  }
  function chipGroup(container, onPick) {
    container.addEventListener('click', (e) => {
      const c = e.target.closest('.chip'); if (!c) return;
      $$('.chip', container).forEach((x) => { x.classList.toggle('is-on', x === c); x.setAttribute('aria-pressed', x === c ? 'true' : 'false'); });
      onPick(c);
    });
  }
  function initQuickView() {
    $$('[data-close]', qvEl).forEach((b) => b.addEventListener('click', () => qv.close()));
    chipGroup($('[data-qv-sizes]', qvEl), (c) => { qvState.size = c.textContent.trim(); });
    chipGroup($('[data-qv-days]', qvEl), (c) => { qvState.days = +c.dataset.days; qvState.mult = +c.dataset.mult; updateQvPrice(); if (G) G.fromTo('[data-qv-price]', { y: 8, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5 }); });
    $('[data-size-guide]', qvEl).addEventListener('click', () => { const g = $('[data-guide]', qvEl); g.hidden = !g.hidden; });
    $('[data-qv-add]', qvEl).addEventListener('click', () => {
      const p = qvProduct; if (!p) return;
      const item = { id: p.dataset.id, size: qvState.size, days: qvState.days, date: $('[data-qv-date]', qvEl).value, price: dayPrice(+p.dataset.price, qvState.mult) };
      state.bag.push(item); save(); updateCounts(); renderDrawer();
      qv.close();
      toast(`Added ${p.dataset.name} · ${item.size} · ${item.days} days`);
      const bagBtn = $('[aria-label="Open bag"]');
      if (G && bagBtn) G.fromTo(bagBtn, { scale: 1.35 }, { scale: 1, duration: 1, ease: 'elastic.out(1, 0.3)' });
    });
  }

  /* --- Bag / wishlist drawer --- */
  const drEl = $('[data-drawer]');
  const drawer = makeModal(drEl, '.drawer__panel', '.drawer__scrim', { from: { xPercent: 100, autoAlpha: 1 } });
  let drTab = 'bag';
  function renderDrawer() {
    const list = $('[data-dlist]', drEl);
    const items = drTab === 'bag' ? state.bag : [...state.wish].map((id) => ({ id }));
    if (!items.length) {
      list.innerHTML = `<div class="dempty">${drTab === 'bag' ? '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 10a4 4 0 0 1-8 0"/><path d="M3.103 6.034h17.794"/><path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z"/></svg><p>Your bag is empty.</p><p>Open any outfit and choose a size and rental period.</p>' : '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/></svg><p>No saved looks yet.</p><p>Tap the heart on any outfit to keep it here.</p>'}</div>`;
    } else {
      list.innerHTML = items.map((it, i) => {
        const p = byId(it.id); if (!p) return '';
        const meta = drTab === 'bag' ? `${it.size} · ${it.days} days${it.date ? ' · ' + new Date(it.date + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}` : p.dataset.tag;
        const right = drTab === 'bag' ? `<div style="display:grid;gap:6px;justify-items:end"><b>${inr(it.price)}</b><button type="button" data-remove="${i}">Remove</button></div>`
                                       : `<div style="display:grid;gap:6px;justify-items:end"><button type="button" data-dqv="${it.id}">View</button><button type="button" data-unwish="${it.id}">Remove</button></div>`;
        return `<div class="ditem"><img src="${unsplash(p.dataset.img, 200)}" alt="" onerror="this.classList.add('is-broken')"><div><h4>${p.dataset.name}</h4><p>${meta}</p></div>${right}</div>`;
      }).join('');
    }
    const total = state.bag.reduce((s, it) => s + it.price, 0);
    $('[data-bag-total]', drEl).textContent = inr(total);
    $('.drawer__foot', drEl).style.display = drTab === 'bag' && state.bag.length ? '' : 'none';
  }
  function initDrawer() {
    $$('[data-open-bag]').forEach((b) => b.addEventListener('click', () => {
      drTab = b.getAttribute('aria-label').includes('Wishlist') ? 'wish' : 'bag';
      $$('.dtab', drEl).forEach((t) => t.classList.toggle('is-on', t.dataset.dtab === drTab));
      renderDrawer(); drawer.open(b);
    }));
    $$('[data-close-drawer]', drEl).forEach((b) => b.addEventListener('click', () => drawer.close()));
    $$('.dtab', drEl).forEach((t) => t.addEventListener('click', () => { drTab = t.dataset.dtab; $$('.dtab', drEl).forEach((x) => x.classList.toggle('is-on', x === t)); renderDrawer(); }));
    $('[data-dlist]', drEl).addEventListener('click', (e) => {
      const r = e.target.closest('[data-remove]'), u = e.target.closest('[data-unwish]'), v = e.target.closest('[data-dqv]');
      if (r) { state.bag.splice(+r.dataset.remove, 1); save(); updateCounts(); renderDrawer(); }
      if (u) { state.wish.delete(u.dataset.unwish); const btn = $(`.product[data-id="${u.dataset.unwish}"] [data-wish]`); if (btn) btn.setAttribute('aria-pressed', 'false'); save(); updateCounts(); renderDrawer(); }
      if (v) { drawer.close(); setTimeout(() => openQuickView(v.dataset.dqv), 450); }
    });
    $('[data-bag-book]', drEl).addEventListener('click', () => {
      const names = state.bag.map((it) => `${byId(it.id).dataset.name} (${it.size}, ${it.days} days)`).join(', ');
      drawer.close();
      setTimeout(() => { $('#bk-notes').value = names; openBooking(); }, 450);
    });
    renderDrawer();
  }

  /* ==================================================================
     OCCASIONS — pinned horizontal journey
     ================================================================== */
  function initOccasions() {
    const sec = $('.occasions'), track = $('[data-htrack]'), bar = $('[data-hbar]');
    if (!sec || !track) return;
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
    const tween = G.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: sec, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1,
        onUpdate: (s) => G.set(bar, { scaleX: s.progress })
      }
    });
    $$('.occ__media img, .occ__media video', sec).forEach((m) => {
      G.fromTo(m, { xPercent: 6 }, { xPercent: -6, ease: 'none', scrollTrigger: { trigger: m.parentElement, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
    });
    $$('.occ:not(.occ--intro)', sec).forEach((o) => {
      G.from(o.querySelectorAll('.occ__text > *'), { y: 40, autoAlpha: 0, stagger: 0.07, duration: 1, scrollTrigger: { trigger: o, containerAnimation: tween, start: 'left 85%', once: true } });
      G.from(o.querySelector('.occ__media'), { yPercent: 14, autoAlpha: 0, duration: 1.4, scrollTrigger: { trigger: o, containerAnimation: tween, start: 'left 98%', once: true } });
    });
  }

  /* ==================================================================
     REELS — 3D fan-in
     ================================================================== */
  function initReels(mm) {
    mm.add('(min-width: 761px)', () => {
      const reels = $$('.reel');
      G.fromTo(reels[0], { rotationY: 28, x: 120, y: 80, autoAlpha: 0.3 }, { rotationY: 0, x: 0, y: 0, autoAlpha: 1, ease: 'none', scrollTrigger: { trigger: '[data-reels]', start: 'top bottom', end: 'center 55%', scrub: 1 } });
      G.fromTo(reels[2], { rotationY: -28, x: -120, y: 80, autoAlpha: 0.3 }, { rotationY: 0, x: 0, y: 0, autoAlpha: 1, ease: 'none', scrollTrigger: { trigger: '[data-reels]', start: 'top bottom', end: 'center 55%', scrub: 1 } });
      G.fromTo(reels[1], { scale: 0.86, y: 60 }, { scale: 1, y: -20, ease: 'none', scrollTrigger: { trigger: '[data-reels]', start: 'top bottom', end: 'center 55%', scrub: 1 } });
    });
  }

  /* ==================================================================
     PROMISE — sticky arch stack
     ================================================================== */
  function initPromise(mm) {
    mm.add('(min-width: 981px)', () => {
      const imgs = $$('[data-pstack] .pimg');
      let current = 0;
      const show = (i) => {
        if (i === current) return;
        imgs.forEach((im, j) => {
          const on = j <= i;
          G.to(im, { clipPath: on ? 'inset(0% 0% 0% 0%)' : 'inset(100% 0% 0% 0%)', duration: 1.3, ease: 'expo.inOut', overwrite: true });
          if (on && j === i) G.fromTo(im.querySelector('img'), { scale: 1.25 }, { scale: 1, duration: 1.6, ease: 'expo.out' });
        });
        current = i;
      };
      $$('[data-pitem]').forEach((it) => {
        ScrollTrigger.create({ trigger: it, start: 'top 55%', end: 'bottom 55%', onToggle: (s) => { if (s.isActive) show(+it.dataset.pitem); } });
      });
      G.from('[data-seal]', { y: 60, autoAlpha: 0, duration: 1.2, scrollTrigger: { trigger: '.promise', start: 'top 60%', once: true } });
      G.from('[data-seal] li', { x: -16, autoAlpha: 0, stagger: 0.15, duration: 0.8, scrollTrigger: { trigger: '.promise', start: 'top 55%', once: true } });
      return () => { imgs.forEach((im, j) => { im.style.clipPath = ''; im.classList.toggle('is-on', j === 0); }); };
    });
    ScrollTrigger.batch('.pitem', { start: 'top 85%', once: true, onEnter: (els) => G.from(els, { y: 50, autoAlpha: 0, stagger: 0.1, duration: 1.2, clearProps: 'transform,opacity,visibility' }) });
  }

  /* ==================================================================
     HOW IT WORKS — the stitching thread
     ================================================================== */
  function initSteps(mm) {
    const wrap = $('[data-steps]');
    if (!wrap) return;
    const steps = $$('.step', wrap);
    mm.add('(min-width: 761px)', () => {
      const path = $('[data-thread]', wrap);
      const svg = $('.steps__thread', wrap);
      const L = path.getTotalLength();
      let needle = $('.needle-el', wrap);
      if (!needle) {
        needle = document.createElement('div');
        needle.className = 'needle-el';
        needle.innerHTML = '<svg viewBox="0 0 46 12" width="46" height="12" aria-hidden="true"><path d="M2 6 L40 4.6 Q46 6 40 7.4 Z" fill="currentColor"/><ellipse cx="9" cy="6" rx="4" ry="1.3" fill="#FBF8F3"/></svg>';
        wrap.appendChild(needle);
      }
      const place = (prog) => {
        const sx = svg.clientWidth / 1200, sy = svg.clientHeight / 160;
        const pt = path.getPointAtLength(prog * L), pt2 = path.getPointAtLength(Math.min(L, prog * L + 2));
        const ang = Math.atan2((pt2.y - pt.y) * sy, (pt2.x - pt.x) * sx) * 180 / Math.PI;
        G.set(needle, { x: pt.x * sx, y: pt.y * sy, rotation: ang });
        const nx = pt.x / 1200;
        steps.forEach((s, i) => s.classList.toggle('is-on', nx >= (i * 0.25 + 0.11)));
      };
      const tw = G.fromTo(path, { drawSVG: '0%' }, {
        drawSVG: '100%', ease: 'none',
        scrollTrigger: { trigger: wrap, start: 'top 72%', end: 'bottom 55%', scrub: 1, onUpdate: (s) => place(s.progress), onRefresh: (s) => place(s.progress) }
      });
      place(0);
      G.from(steps, { y: 40, autoAlpha: 0, stagger: 0.12, duration: 1.2, scrollTrigger: { trigger: wrap, start: 'top 80%', once: true } });
      return () => { needle.remove(); steps.forEach((s) => s.classList.remove('is-on')); };
    });
    mm.add('(max-width: 760px)', () => {
      G.fromTo('[data-vthread]', { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: wrap, start: 'top 70%', end: 'bottom 60%', scrub: 1 } });
      steps.forEach((s) => ScrollTrigger.create({ trigger: s, start: 'top 68%', onEnter: () => s.classList.add('is-on'), onLeaveBack: () => s.classList.remove('is-on') }));
      G.from(steps, { x: 30, autoAlpha: 0, stagger: 0.1, duration: 1, scrollTrigger: { trigger: wrap, start: 'top 85%', once: true } });
    });
  }

  /* ==================================================================
     CALCULATOR
     ================================================================== */
  function initCalc() {
    const price = $('[data-calc="price"]'), events = $('[data-calc="events"]');
    if (!price) return;
    const out = { price: $('[data-out="price"]'), events: $('[data-out="events"]') };
    const res = { buy: $('[data-res="buy"]'), rent: $('[data-res="rent"]'), save: $('[data-res="save"]'), pct: $('[data-res="pct"]') };
    const bars = { buy: $('[data-bar="buy"]'), rent: $('[data-bar="rent"]') };
    const shown = { buy: 0, rent: 0, save: 0, pct: 0 };
    const fill = (inp) => inp.style.setProperty('--p', ((inp.value - inp.min) / (inp.max - inp.min) * 100) + '%');
    const calc = (animate) => {
      const pr = +price.value, ev = +events.value;
      const rentEach = clamp(Math.round((pr * 0.17) / 50) * 50, 500, 3000);
      const buy = pr * ev, rent = rentEach * ev, sv = buy - rent, pct = Math.round((sv / buy) * 100);
      out.price.textContent = inr(pr); out.events.textContent = ev;
      fill(price); fill(events);
      bars.buy.style.transform = 'scaleX(1)';
      bars.rent.style.transform = `scaleX(${Math.max(0.02, rent / buy)})`;
      const target = { buy, rent, save: sv, pct };
      const paint = () => { res.buy.textContent = inr(shown.buy); res.rent.textContent = inr(shown.rent); res.save.textContent = inr(shown.save); res.pct.textContent = Math.round(shown.pct) + '%'; };
      if (G && animate) G.to(shown, { ...target, duration: 0.8, ease: 'power3.out', onUpdate: paint, overwrite: true });
      else { Object.assign(shown, target); paint(); }
    };
    [price, events].forEach((i) => i.addEventListener('input', () => calc(true)));
    calc(false);
    if (G) {
      G.from('.bar__fill', { scaleX: 0, duration: 1.6, stagger: 0.2, ease: 'expo.out', scrollTrigger: { trigger: '.calc__result', start: 'top 80%', once: true }, onComplete: () => calc(false) });
      G.from('.calc__result', { y: 60, autoAlpha: 0, duration: 1.3, scrollTrigger: { trigger: '.calc__result', start: 'top 88%', once: true } });
    }
  }

  /* ==================================================================
     MODEL — lifecycle bar + roadmap
     ================================================================== */
  function initModel(mm) {
    const segs = $$('[data-seg]');
    if (segs.length) {
      const mark = () => segs.forEach((s) => s.classList.toggle('is-full', parseFloat(G.getProperty(s, '--f')) > 0.45));
      G.fromTo(segs, { '--f': 0 }, { '--f': 1, stagger: 0.12, ease: 'power1.inOut', duration: 0.6, onUpdate: mark, scrollTrigger: { trigger: '[data-life]', start: 'top 72%', end: 'bottom 50%', scrub: 1 } });
      G.from('.life__marks span', { y: 14, autoAlpha: 0, stagger: 0.2, duration: 1, scrollTrigger: { trigger: '[data-life]', start: 'top 60%', once: true } });
    }
    mm.add('(min-width: 761px)', () => { G.from('[data-road-fill]', { scaleX: 0, duration: 2, ease: 'expo.inOut', scrollTrigger: { trigger: '[data-road]', start: 'top 80%', once: true } }); });
    mm.add('(max-width: 760px)', () => { G.from('[data-road-fill]', { scaleY: 0, duration: 2, ease: 'expo.inOut', scrollTrigger: { trigger: '[data-road]', start: 'top 80%', once: true } }); });
  }

  /* ==================================================================
     FAQ — smooth accordion
     ================================================================== */
  function initFaq() {
    const items = $$('.qa');
    items.forEach((d) => {
      const sum = $('summary', d), body = $('.qa__a', d);
      sum.addEventListener('click', (e) => {
        if (!G || RM) return;
        e.preventDefault();
        if (d.open) {
          G.to(body, { height: 0, duration: 0.6, ease: 'expo.inOut', onComplete: () => { d.open = false; body.style.height = ''; ScrollTrigger.refresh(); } });
        } else {
          items.forEach((o) => { if (o !== d && o.open) { const ob = $('.qa__a', o); G.to(ob, { height: 0, duration: 0.6, ease: 'expo.inOut', onComplete: () => { o.open = false; ob.style.height = ''; } }); } });
          d.open = true;
          G.fromTo(body, { height: 0 }, { height: 'auto', duration: 0.8, ease: 'expo.out', onComplete: () => ScrollTrigger.refresh() });
          G.from($('p', body), { y: 14, autoAlpha: 0, duration: 0.8, delay: 0.1 });
        }
      });
    });
  }

  /* ==================================================================
     BOOKING — 3-step form with petals
     ================================================================== */
  const bookEl = $('[data-book]');
  const book = makeModal(bookEl, '.book__box', '.book__scrim');
  let bstep = 0;
  const bookData = { occasion: '' };
  function openBooking(trigger) {
    const form = $('[data-book-form]', bookEl), done = $('[data-book-done]', bookEl);
    if (!done.hidden) { form.hidden = false; done.hidden = true; form.reset(); bookData.occasion = ''; $$('[data-occasion] .chip', bookEl).forEach((c) => c.classList.remove('is-on')); setStep(0); }
    $('#bk-date').min = minDate(1);
    book.open(trigger);
  }
  function setStep(n) {
    bstep = n;
    $$('[data-bstep]', bookEl).forEach((f) => f.classList.toggle('is-on', +f.dataset.bstep === n));
    $$('.book__steps span', bookEl).forEach((s, i) => s.classList.toggle('is-on', i <= n));
    $('[data-bprev]', bookEl).hidden = n === 0;
    const next = $('[data-bnext]', bookEl);
    next.firstChild.textContent = n === 2 ? 'Request booking ' : 'Continue ';
    if (G) G.from($(`[data-bstep="${n}"]`, bookEl).children, { x: 24, autoAlpha: 0, stagger: 0.05, duration: 0.7 });
  }
  function validate(n) {
    const err = $(`[data-err="${n}"]`, bookEl);
    let msg = '';
    if (n === 0) {
      const name = $('#bk-name').value.trim();
      const digits = $('#bk-phone').value.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
      if (!name) msg = 'Please enter your name.';
      else if (!/^[6-9]\d{9}$/.test(digits)) msg = 'Enter a 10-digit mobile number, e.g. 98765 43210.';
    }
    if (n === 1) {
      const date = $('#bk-date').value;
      if (!bookData.occasion) msg = 'Choose the occasion you are dressing for.';
      else if (!date) msg = 'Pick your event date.';
      else if (date < minDate(0)) msg = 'The event date needs to be today or later.';
    }
    if (err) { err.textContent = msg; if (msg && G) G.fromTo(err, { x: -6 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' }); }
    return !msg;
  }
  function initBooking() {
    $$('[data-open-booking]').forEach((b) => b.addEventListener('click', () => { const go = () => openBooking(b); menuOpen ? closeMenu(go) : go(); }));
    $$('[data-close-book]', bookEl).forEach((b) => b.addEventListener('click', () => book.close()));
    chipGroup($('[data-occasion]', bookEl), (c) => { bookData.occasion = c.textContent.trim(); });
    $('[data-bprev]', bookEl).addEventListener('click', () => setStep(Math.max(0, bstep - 1)));
    $('[data-book-form]', bookEl).addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validate(bstep)) return;
      if (bstep < 2) { setStep(bstep + 1); return; }
      const data = {
        name: $('#bk-name').value.trim(), phone: $('#bk-phone').value.trim(), occasion: bookData.occasion,
        date: $('#bk-date').value, mode: ($('input[name="mode"]:checked', bookEl) || {}).value, notes: $('#bk-notes').value.trim()
      };
      // TODO(production): send `data` to your backend / Google Form / CRM here.
      console.info('Rentique booking request', data);
      const form = $('[data-book-form]', bookEl), done = $('[data-book-done]', bookEl);
      form.hidden = true; done.hidden = false;
      const nice = new Date(data.date + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
      $('[data-done-text]', bookEl).textContent = `Thank you, ${data.name.split(' ')[0]}. We'll call ${data.phone} to set up your ${data.mode.toLowerCase()} for the ${data.occasion.toLowerCase()} on ${nice}.`;
      const wa = $('[data-wa-link]', bookEl);
      if (CONFIG.whatsappNumber) {
        wa.hidden = false;
        wa.href = `https://wa.me/${CONFIG.whatsappNumber}?text=` + encodeURIComponent(`Hi Rentique! I'd like to book a trial.\nName: ${data.name}\nOccasion: ${data.occasion} on ${nice}\nPreference: ${data.mode}${data.notes ? '\nLooks: ' + data.notes : ''}`);
      }
      if (G) G.from(done.children, { y: 24, autoAlpha: 0, stagger: 0.08, duration: 0.9 });
      petals();
    });
    setStep(0);
  }

  /* Petal shower — marigold, rose and gold (canvas 2D) */
  function petals() {
    if (RM) return;
    const cv = $('[data-petals]'); const ctx = cv.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = window.innerWidth * dpr; cv.height = window.innerHeight * dpr; ctx.scale(dpr, dpr);
    const cols = ['#E8962A', '#F2B441', '#C2304A', '#9E1B32', '#D9B375', '#F4D9A0'];
    const N = window.innerWidth < 760 ? 70 : 130;
    const ps = Array.from({ length: N }, () => ({
      x: Math.random() * window.innerWidth, y: -20 - Math.random() * window.innerHeight * 0.6,
      r: 5 + Math.random() * 8, vy: 1.4 + Math.random() * 2.4, vx: -0.6 + Math.random() * 1.2,
      a: Math.random() * Math.PI * 2, va: -0.06 + Math.random() * 0.12, s: Math.random() * 6, c: cols[(Math.random() * cols.length) | 0]
    }));
    const start = performance.now();
    const frame = (now) => {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ps.forEach((p) => {
        p.y += p.vy; p.x += p.vx + Math.sin(t * 2 + p.s) * 0.8; p.a += p.va;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.scale(1, Math.abs(Math.cos(t * 3 + p.s)) * 0.6 + 0.4);
        ctx.globalAlpha = t > 4 ? Math.max(0, 1 - (t - 4)) : 1;
        ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
      if (t < 5) requestAnimationFrame(frame); else ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };
    requestAnimationFrame(frame);
  }

  /* ==================================================================
     NEWSLETTER + BACK TO TOP
     ================================================================== */
  function initFooter() {
    const f = $('[data-news]');
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = $('#news-email').value.trim();
      const msg = $('[data-news-msg]');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg.textContent = 'Enter a valid email address, like you@email.com.'; return; }
      msg.textContent = "You're on the list. First looks arrive before every wedding season.";
      f.reset();
    });
    $('[data-totop]').addEventListener('click', () => scrollTo(0, { duration: 2.2 }));
  }

  /* ==================================================================
     BOOT
     ================================================================== */
  initNav();
  initAnchors();
  initCollection();
  initQuickView();
  initDrawer();
  initBooking();
  initCalc();
  initFooter();
  initMarquee();

  if (!G || RM) {
    // Static, fully visible page; hero window shows at its resting size.
    introDone = true;
    if (geom) setArch(geom.w, geom.h, geom.top);
    if (G) initNavLate();
    return;
  }

  // Build all scroll scenes in page order (pins first so later triggers measure correctly)
  heroScroll();
  const mm = G.matchMedia();
  initCloset();
  initOccasions();
  initReels(mm);
  initPromise(mm);
  initSteps(mm);
  initModel(mm);
  initFaq();
  initReveals();
  initCursor();
  initNavLate();

  ScrollTrigger.addEventListener('refreshInit', () => { computeGeom(); });
  ScrollTrigger.addEventListener('refresh', () => { if (introDone) applyArch(); if (silk) silk.resize(); });

  runPreloader().then((played) => {
    if (!played) lockScroll(); // heroIntro unlocks once the window has opened
    heroIntro();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  });

  function initNavLate() {
    // Runs after pins exist so pinned dark sections are measured through their pin-spacers
    const dark = new Set();
    updateNavTheme = () => nav.classList.toggle('is-dark', dark.size > 0 || menuOpen);
    $$('[data-theme="dark"]').forEach((sec) => {
      const trig = sec.parentElement && sec.parentElement.classList.contains('pin-spacer') ? sec.parentElement : sec;
      ScrollTrigger.create({ trigger: trig, start: 'top top+=40', end: 'bottom top+=40', onToggle: (s) => { s.isActive ? dark.add(sec) : dark.delete(sec); updateNavTheme(); } });
    });
    const bar = $('.progress span');
    const ring = $('[data-totop-ring]');
    const setBar = G.quickSetter(bar, 'scaleX');
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (s) => { setBar(s.progress); if (ring) ring.style.strokeDashoffset = (125.7 * (1 - s.progress)).toFixed(1); } });
    updateNavTheme();
  }
})();
