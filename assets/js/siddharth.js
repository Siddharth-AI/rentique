/* =====================================================================
   SIDDHARTH SHAH — portfolio interactions
   GSAP + ScrollTrigger + SplitText + Lenis, raw WebGL hero
   ===================================================================== */
(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const G = window.gsap;
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const root = document.documentElement;

  if (G) { G.registerPlugin(ScrollTrigger, SplitText); G.defaults({ ease: 'expo.out', duration: 1.2 }); }

  /* ---------- Lenis ---------- */
  let lenis = null;
  if (G && !RM && window.Lenis) {
    lenis = new Lenis({ lerp: 0.085 });
    lenis.on('scroll', ScrollTrigger.update);
    G.ticker.add((t) => lenis.raf(t * 1000));
    G.ticker.lagSmoothing(0);
  }
  const go = (target) => {
    if (lenis) lenis.scrollTo(target, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else if (target === 0) window.scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' });
    else $(target).scrollIntoView({ behavior: RM ? 'auto' : 'smooth' });
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-go]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (!id || id[0] !== '#') return;
    e.preventDefault();
    go(id === '#top' ? 0 : id);
  });

  /* ---------- Nav ---------- */
  const nav = $('[data-ssnav]');
  let lastY = 0;
  const onScroll = (y) => { nav.classList.toggle('is-scrolled', y > 30); nav.classList.toggle('is-hidden', y > lastY && y > 500); lastY = y; };
  if (lenis) lenis.on('scroll', (l) => onScroll(l.scroll)); else window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true });

  /* ---------- Progress ---------- */
  if (G) {
    const bar = G.quickSetter('.progress span', 'scaleX');
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (s) => bar(s.progress) });
  }

  /* ---------- Cursor + magnetic ---------- */
  if (FINE && G && !RM) {
    root.classList.add('has-cursor');
    const cur = $('.cursor'), ring = $('.cursor__ring'), dot = $('.cursor__dot');
    const rx = G.quickTo(ring, 'x', { duration: 0.55, ease: 'power3' }), ry = G.quickTo(ring, 'y', { duration: 0.55, ease: 'power3' });
    const dx = G.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' }), dy = G.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });
    let shown = false;
    window.addEventListener('pointermove', (e) => {
      if (!shown) { shown = true; G.set([ring, dot], { x: e.clientX, y: e.clientY }); G.to(cur, { autoAlpha: 1, duration: 0.4 }); }
      rx(e.clientX); ry(e.clientY); dx(e.clientX); dy(e.clientY);
    }, { passive: true });
    document.addEventListener('pointerover', (e) => cur.classList.toggle('is-hover', !!e.target.closest('a, button, .chip')));
    $$('[data-magnetic]').forEach((el) => {
      const qx = G.quickTo(el, 'x', { duration: 0.6, ease: 'power3' }), qy = G.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
      el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); qx((e.clientX - (r.left + r.width / 2)) * 0.3); qy((e.clientY - (r.top + r.height / 2)) * 0.4); });
      el.addEventListener('pointerleave', () => G.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.4)' }));
    });
  }

  /* ---------- Glow cards ---------- */
  $$('[data-glow]').forEach((card) => card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
    card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
  }));

  /* ---------- WebGL: liquid gold ---------- */
  const canvas = $('.ss-hero__gl');
  const gl = (() => { try { return canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: true }); } catch (e) { return null; } })();
  let glApi = null;
  if (gl) {
    const vs = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
    const fs = `precision mediump float;uniform vec2 r;uniform float t;uniform vec2 m;
float h(vec2 p){float a=t*.09;p+=.55*vec2(sin(p.y*.9+a*1.4),cos(p.x*.8-a));
return sin(p.x*1.1+a)*.55+sin(p.y*1.6-a*.8+p.x*.6)*.32+sin((p.x+p.y)*2.4+a*.5)*.13;}
void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=(gl_FragCoord.xy-.5*r)/r.y*2.4;p+=(m-.5)*vec2(.45,.3);
float e=.006;float c=h(p);vec2 g=vec2(h(p+vec2(e,0.))-c,h(p+vec2(0.,e))-c)/e;vec3 n=normalize(vec3(-g*.6,1.));
vec3 L=normalize(vec3(-.3+(m.x-.5),.5+(m.y-.5)*.6,.85));float d=clamp(dot(n,L),0.,1.);float nh=clamp(dot(n,normalize(L+vec3(0,0,1))),0.,1.);
vec3 col=mix(vec3(.035,.027,.024),vec3(.13,.09,.06),smoothstep(.2,1.,d));
col+=pow(nh,10.)*vec3(.35,.22,.09);col+=pow(nh,60.)*vec3(1.,.8,.5)*.7;
col+=vec3(.12,.02,.03)*smoothstep(.9,.0,length(uv-vec2(.85,.8)));
col*=mix(.5,1.,smoothstep(1.3,.25,length((uv-.5)*vec2(1.3,1.))));
col+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5)*.025;gl_FragColor=vec4(col,1.);}`;
    const sh = (ty, src) => { const s = gl.createShader(ty); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
    if (v && f) {
      const pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr); gl.useProgram(pr);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const uR = gl.getUniformLocation(pr, 'r'), uT = gl.getUniformLocation(pr, 't'), uM = gl.getUniformLocation(pr, 'm');
      const mouse = { x: 0.5, y: 0.5 }, target = { x: 0.5, y: 0.5 };
      let active = true;
      const resize = () => { const s = window.innerWidth < 760 ? 0.5 : 0.6; canvas.width = Math.max(1, canvas.clientWidth * s | 0); canvas.height = Math.max(1, canvas.clientHeight * s | 0); gl.viewport(0, 0, canvas.width, canvas.height); };
      const draw = (time) => { mouse.x += (target.x - mouse.x) * 0.04; mouse.y += (target.y - mouse.y) * 0.04; gl.uniform2f(uR, canvas.width, canvas.height); gl.uniform1f(uT, time); gl.uniform2f(uM, mouse.x, mouse.y); gl.drawArrays(gl.TRIANGLES, 0, 3); };
      resize(); draw(6); canvas.classList.add('is-ready');
      window.addEventListener('resize', resize, { passive: true });
      window.addEventListener('pointermove', (e) => { target.x = e.clientX / window.innerWidth; target.y = 1 - e.clientY / window.innerHeight; }, { passive: true });
      if (!RM && G) {
        G.ticker.add((time) => { if (active) draw(time); });
        ScrollTrigger.create({ trigger: '.ss-hero', start: 'top top', end: 'bottom top', onToggle: (s) => { active = s.isActive; } });
      }
      glApi = { resize };
    }
  }

  /* ---------- Contact form → WhatsApp / email ---------- */
  const form = $('[data-ssform]');
  let need = [];
  $('[data-need]').addEventListener('click', (e) => {
    const c = e.target.closest('.chip'); if (!c) return;
    c.classList.toggle('is-on'); c.setAttribute('aria-pressed', c.classList.contains('is-on'));
    need = $$('[data-need] .chip.is-on').map((x) => x.textContent.trim());
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const via = (e.submitter && e.submitter.dataset.via) || 'wa';
    const name = $('#ss-name').value.trim(), msg = $('#ss-msg').value.trim(), err = $('[data-sserr]');
    if (!name) { err.textContent = 'Please add your name.'; return; }
    if (!msg) { err.textContent = 'Tell me a little about the project so I can reply properly.'; return; }
    err.textContent = '';
    const text = `Hi Siddharth, I'm ${name}.${need.length ? '\nI need: ' + need.join(', ') + '.' : ''}\n\n${msg}`;
    const url = via === 'mail'
      ? `mailto:${window.SS.email}?subject=${encodeURIComponent('Project enquiry from ' + name)}&body=${encodeURIComponent(text)}`
      : `https://wa.me/${window.SS.phone}?text=${encodeURIComponent(text)}`;
    const a = document.createElement('a'); a.href = url; if (via !== 'mail') { a.target = '_blank'; a.rel = 'noopener'; }
    document.body.appendChild(a); a.click(); a.remove();
  });

  if (!G || RM) return;

  /* =================== MOTION =================== */
  // Hero intro
  const hs = new SplitText('[data-hero-split] .l', { type: 'lines', mask: 'lines', linesClass: 'hl' });
  G.timeline({ delay: 0.15 })
    .from('.ss-avail, .ss-hero__who', { y: 20, autoAlpha: 0, stagger: 0.08, duration: 1 })
    .from(hs.lines, { yPercent: 110, duration: 1.5, stagger: 0.12 }, 0.2)
    .from('.ss-hero__sub, .ss-hero__cta', { y: 24, autoAlpha: 0, stagger: 0.1, duration: 1.1 }, 0.7)
    .from('.ss-float li', { scale: 0.6, autoAlpha: 0, stagger: 0.07, duration: 1, ease: 'back.out(1.8)' }, 0.9);
  // Floating chips: drift + mouse parallax + scroll fade
  $$('.ss-float li').forEach((li, i) => {
    G.to(li, { y: i % 2 ? 14 : -14, duration: 3 + i * 0.4, repeat: -1, yoyo: true, ease: 'sine.inOut' });
  });
  if (FINE) {
    const fl = $('.ss-float');
    const qx = G.quickTo(fl, 'x', { duration: 1.2, ease: 'power3' }), qy = G.quickTo(fl, 'y', { duration: 1.2, ease: 'power3' });
    window.addEventListener('pointermove', (e) => { qx((e.clientX / window.innerWidth - 0.5) * -30); qy((e.clientY / window.innerHeight - 0.5) * -20); }, { passive: true });
  }
  G.to('.ss-hero__in', { yPercent: -18, autoAlpha: 0.2, ease: 'none', scrollTrigger: { trigger: '.ss-hero', start: 'top top', end: 'bottom top', scrub: true } });

  // Marquees (velocity aware)
  const rows = $$('[data-mq]').map((row) => ({ dir: +row.dataset.mq, tw: G.fromTo(row, { xPercent: row.dataset.mq === '1' ? 0 : -50 }, { xPercent: row.dataset.mq === '1' ? -50 : 0, duration: 40, ease: 'none', repeat: -1 }) }));
  if (lenis) lenis.on('scroll', ({ velocity }) => rows.forEach((r) => { r.tw.timeScale(1 + Math.min(Math.abs(velocity) / 5, 4)); G.to(r.tw, { timeScale: 1, duration: 1, overwrite: true }); }));

  // About: words light up
  const ab = new SplitText('[data-words]', { type: 'words' });
  G.fromTo(ab.words, { opacity: 0.18 }, { opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: { trigger: '[data-words]', start: 'top 80%', end: 'bottom 55%', scrub: true } });

  // Headings
  $$('[data-split]').forEach((el) => SplitText.create(el, {
    type: 'lines', mask: 'lines', autoSplit: true, linesClass: 'sl',
    onSplit: (self) => G.from(self.lines, { yPercent: 105, duration: 1.3, stagger: 0.1, scrollTrigger: { trigger: el, start: 'top 86%', once: true } })
  }));

  // Cards
  ScrollTrigger.batch('.ss-svc, .ss-why__item, .ss-stack__group, .ss-cc, .ss-stat', {
    start: 'top 90%', once: true,
    onEnter: (els) => G.from(els, { y: 50, autoAlpha: 0, stagger: 0.07, duration: 1.1, clearProps: 'transform,opacity,visibility' })
  });
  G.from('.ss-form', { y: 60, autoAlpha: 0, duration: 1.3, scrollTrigger: { trigger: '.ss-form', start: 'top 88%', once: true } });

  // Counters
  $$('[data-count]').forEach((el) => {
    const end = +el.dataset.count, o = { v: 0 };
    G.to(o, { v: end, duration: 2, ease: 'power3.out', onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString('en-IN'); }, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });

  // Process lines
  $$('.ss-step').forEach((s, i) => ScrollTrigger.create({ trigger: '[data-steps]', start: 'top 78%', once: true, onEnter: () => setTimeout(() => s.classList.add('is-on'), i * 280) }));

  // Work: pinned device mockups with scrolling screenshots
  const mm = G.matchMedia();
  const scrollShot = (sel) => {
    const box = $(`[data-screen="${sel}"]`), img = box && box.querySelector('img');
    return () => (img && box ? -(img.offsetHeight - box.offsetHeight) : 0);
  };
  const dShot = scrollShot('desktop'), mShot = scrollShot('mobile');
  const ready = () => Promise.all($$('.ss-screen img').map((im) => im.complete ? 1 : new Promise((r) => { im.onload = im.onerror = r; })));
  ready().then(() => {
    mm.add('(min-width: 901px)', () => {
      const tl = G.timeline({ scrollTrigger: { trigger: '.ss-work', start: 'top top', end: '+=1600', pin: '.ss-work__pin', scrub: 1, invalidateOnRefresh: true } });
      tl.to('[data-screen="desktop"] img', { y: dShot, ease: 'none', duration: 1 }, 0)
        .to('[data-screen="mobile"] img', { y: mShot, ease: 'none', duration: 1 }, 0)
        .fromTo('.ss-phone', { y: 60 }, { y: -30, ease: 'none', duration: 1 }, 0);
      G.from('.ss-work__copy > *', { y: 30, autoAlpha: 0, stagger: 0.07, duration: 1, scrollTrigger: { trigger: '.ss-work', start: 'top 60%', once: true } });
      G.from('.ss-laptop', { y: 80, rotationX: 14, transformPerspective: 1400, autoAlpha: 0, duration: 1.4, scrollTrigger: { trigger: '.ss-work', start: 'top 65%', once: true } });
    });
    mm.add('(max-width: 900px)', () => {
      G.to('[data-screen="desktop"] img', { y: dShot, ease: 'none', scrollTrigger: { trigger: '.ss-devices', start: 'top 85%', end: 'bottom 15%', scrub: 1, invalidateOnRefresh: true } });
      G.to('[data-screen="mobile"] img', { y: mShot, ease: 'none', scrollTrigger: { trigger: '.ss-devices', start: 'top 85%', end: 'bottom 15%', scrub: 1, invalidateOnRefresh: true } });
    });
    ScrollTrigger.refresh();
  });

  // Footer word
  G.from('.ss-foot__word', { yPercent: 40, autoAlpha: 0, duration: 1.6, scrollTrigger: { trigger: '.ss-foot', start: 'top 92%', once: true } });

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => { if (glApi) glApi.resize(); ScrollTrigger.refresh(); });
})();
