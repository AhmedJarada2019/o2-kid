/* =====================================================================
   O2 — the hero IS the intro.
   One canvas, one camera, one timeline:
     darkness → logo lit by a light sweep (real tagline) → dolly past real
     dishes → the restaurant fades up, the chef pops up and grabs the hose
     → golden points flow into the tank → the camera slides aside to make
     room for the headline, and that frame is the homepage hero.
   After the intro the same scene keeps living as the hero.
   ===================================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  clamp, lerp, smooth, easeInOut, easeOutBack, damp,
  loadTexture, glowTexture, makeLogoPlane,
  buildHose, buildStream, buildTank, buildCounter, buildEmbers,
} from './three-kit.js';
import { buildKid } from './kid-sprite.js';

const html = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;
const POINTS = 1703;           // sample balance baked into this export (labelled on the page)
const MAX = 3000;              // Platinum threshold

/* ---------- intro timeline (seconds) ---------- */
const T = { logoIn: 1.0, sweep: [1.0, 2.4], logoOut: [2.6, 3.2], dolly: [3.2, 5.8], veil: 9.25, chefUp: [9.35, 10.75], tankIn: [9.3, 10.1], hose: [10.25, 10.9], nozzle: [10.7, 11.3], flow: [11.1, 11.7], power: [11.2, 11.7], fill: [11.6, 13.3], pan: [9.0, 9.1], hop: 13.4, done: 9.25, end: 13.8, shortStart: 5.4 };
const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10); // quintic ease — no visible start/stop
const CAM_KEYS = [[0, 29.5], [3.2, 28], [9.0, 28], [9.15, 10.8], [13.3, 10.0]]; // gentle push-in as the hero begins
const CAPTIONS = [
  [1.1, 2.6, 'نَفَسٌ من الهدوء.. ولُقمةٌ من السعادة'],
  [-2, -1, ''], // shot 2 is the family montage (its own captions)
];

function camZAt(t) {
  for (let i = 1; i < CAM_KEYS.length; i++) {
    const [t0, z0] = CAM_KEYS[i - 1];
    const [t1, z1] = CAM_KEYS[i];
    if (t <= t1) return lerp(z0, z1, easeInOut(clamp((t - t0) / (t1 - t0))));
  }
  return CAM_KEYS[CAM_KEYS.length - 1][1];
}
const span = (t, [a, b]) => clamp((t - a) / (b - a));

function makeRenderer(container, dprCap) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  container.appendChild(renderer.domElement);
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  pm.dispose();
  return { renderer, env };
}

function addLights(scene) {
  scene.add(new THREE.HemisphereLight(0xfff1e0, 0x1a0c04, 0.55));
  const key = new THREE.SpotLight(0xffe6c4, 120, 40, 0.5, 0.55, 1.5);
  key.position.set(-4, 7, 7);
  const rim = new THREE.DirectionalLight(0xff8a1c, 2.4);
  rim.position.set(5, 3, -4);
  const fill = new THREE.DirectionalLight(0xffd7a8, 0.6);
  fill.position.set(3, 1, 6);
  scene.add(key, rim, fill);
  return { key };
}

/* =====================================================================
   Shot 2 — "عائلة O2 بكامل أفرعها": vertical split-screen panels with real
   O2 reels and dishes and bold branch captions (after the restaurant's Eid
   reel). Opens like doors onto the 3D restaurant set.
   ===================================================================== */
const M = { in: 2.6, swap: 4.15, out: 5.35, off: 6.2 };
const LOCS = [[2.95, M.swap, 'غزة · شارع النصر'], [M.swap, M.out, 'النصيرات · دوار أبو صرار']];
function buildMontage() {
  const el = document.getElementById('montage');
  if (!el) return null;
  const loc = el.querySelector('.mt-loc');
  const locText = loc.querySelector('b');
  let state = '';
  let primed = false;
  function prime() {
    if (primed) return;
    primed = true;
    for (const v of el.querySelectorAll('video')) {
      if (small || navigator.connection?.saveData) {
        // phones: real dish photos instead of streaming three videos
        const div = document.createElement('div');
        div.className = 'mt-layer mt-photo';
        div.dataset.layer = v.parentElement.dataset.layer;
        div.style.backgroundImage = `url(${v.dataset.fallback})`;
        v.parentElement.replaceWith(div);
      } else {
        v.preload = 'auto';
        v.src = v.dataset.src;
      }
    }
  }
  function set(t, active) {
    const s = !active ? 'off' : t < M.in ? 'wait' : t < M.swap ? 'a' : t < M.out ? 'b' : t < M.off ? 'out' : 'off';
    if (s !== state) {
      state = s;
      el.dataset.state = s;
      for (const v of el.querySelectorAll('video')) {
        const layer = v.parentElement.dataset.layer;
        const want = (s === 'a' && layer === 'a') || ((s === 'b' || s === 'out') && layer === 'b');
        if (want && v.src) v.play().catch(() => {}); else v.pause();
      }
    }
    const l = active ? LOCS.find(([a, b]) => t >= a && t < b) : null;
    const txt = l ? l[2] : '';
    if (locText.textContent !== txt) {
      locText.textContent = txt;
      loc.classList.remove('is-on');
      if (txt) { void loc.offsetWidth; loc.classList.add('is-on'); }
    }
  }
  return { prime, set };
}

/* =====================================================================
   Outro — the intro ends the way it began: the scene settles into darkness,
   the O2 logo is lit by a light sweep with the tagline, then the logo glides
   into the header while the darkness dissolves onto the finished hero.
   ===================================================================== */
const OUT = { dusk: 5.6, brand: 6.4, lift: 8.0, off: 9.25 };
function buildOutro() {
  const el = document.getElementById('outro');
  if (!el) return null;
  const mark = el.querySelector('.outro-mark');
  let state = '';
  function aim() {
    // where the header logo will rest once the header slides back in
    const img = document.querySelector('._brand_c9nak_19 img');
    const bar = document.querySelector('._bar_c9nak_1');
    if (!img || !mark) return;
    const r = img.getBoundingClientRect();
    const m = mark.getBoundingClientRect();
    const dy = bar ? -bar.getBoundingClientRect().top : 0;
    el.style.setProperty('--tx', `${(r.left + r.width / 2) - (m.left + m.width / 2)}px`);
    el.style.setProperty('--ty', `${(r.top + dy + r.height / 2) - (m.top + m.height / 2)}px`);
    el.style.setProperty('--ts', (r.width / Math.max(1, m.width)).toFixed(3));
  }
  function set(t, active) {
    const s = !active ? 'off' : t < OUT.dusk ? 'off' : t < OUT.brand ? 'dusk' : t < OUT.lift ? 'brand' : t < OUT.off ? 'lift' : 'off';
    if (s === state) return;
    if (s === 'brand') { el.dataset.state = 'brand'; aim(); }
    state = s;
    el.dataset.state = s;
  }
  return { set };
}

/* =====================================================================
   HERO / INTRO
   ===================================================================== */
function bootHero() {
  const hero = document.getElementById('home');
  const stageEl = document.getElementById('hero-stage');
  const setEl = document.getElementById('hero-set');
  const captionEl = document.getElementById('intro-caption');
  const skipBtn = document.getElementById('intro-skip');
  const replayBtn = document.querySelector('[data-action="replay-intro"]');
  if (!hero || !stageEl || !setEl) return null;

  const { renderer, env } = makeRenderer(stageEl, small ? 1.5 : 1.75);
  const scene = new THREE.Scene();
  scene.environment = env;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 120);
  const { key } = addLights(scene);
  const glow = glowTexture();
  const logoTex = loadTexture('assets/logo.png');

  /* ---- the set ---- */
  const set = new THREE.Group();
  set.rotation.x = 0.1;
  scene.add(set);
  set.add(buildCounter(7.5));
  // the O2 kid (official render) stands on the floor to the right and sprays toward the tank
  const chef = buildKid({ height: 3.15, renderer, glowTex: glow });
  const CHEF_Y = 0;
  const KID_X = 1.55;
  chef.root.position.set(KID_X, CHEF_Y, 0.3);
  set.add(chef.root);
  const floorShadow = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.ShadowMaterial({ opacity: 0.32 }));
  floorShadow.rotation.x = -Math.PI / 2;
  floorShadow.receiveShadow = true;
  set.add(floorShadow);
  const tank = buildTank({ logoTex, glowTex: glow, max: MAX, inletSide: 1 });
  tank.group.position.set(-1.95, 0, 0);
  tank.group.scale.setScalar(0.92);
  tank.group.rotation.y = 0.16;
  set.add(tank.group);
  const hose = buildHose(); // the kid's own hose is part of the artwork
  hose.group.visible = false;
  set.add(hose.group);
  const stream = buildStream({ glowTex: glow, droplets: small ? 90 : 170 });
  set.add(stream.group);
  key.target = set;
  if (!small) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 5;
    key.shadow.camera.near = 2;
    key.shadow.camera.far = 30;
    const caster = (o) => { if (o.isMesh && !o.material.transparent && !o.isInstancedMesh) o.castShadow = true; };
    tank.group.traverse(caster);
    hose.group.traverse(caster);
  }

  const BOX = { cx: -0.45, cy: 1.8, w: 5.1, h: 3.9 };

  /* ---- intro-only props (ride along with the camera's framing offset) ---- */
  const rig = new THREE.Group();
  scene.add(rig);
  const logo = makeLogoPlane(logoTex, 1.7);
  logo.position.set(0, 0.15, 23.9);
  rig.add(logo);
  const sweepLight = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffa64a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
  sweepLight.scale.set(5, 2.4, 1);
  sweepLight.position.set(-4, 0.2, 23.5);
  rig.add(sweepLight);
  const cards = [];
  const montage = buildMontage();
  const outro = buildOutro();
  const embers = buildEmbers(glow, small ? 60 : 130, [14, 8, 10]);
  scene.add(embers.points);

  /* ---- state ---- */
  const S = {
    t: T.end, playing: false, doneFired: false,
    value: POINTS, shown: 0, valueFrom: 0, valueTo: POINTS, valueT: 1,
    look: { x: 0, y: 0 }, lookT: { x: 0, y: 0 }, visible: true, lastHop: -1,
    W: 1, H: 1, rect: null, pan: 1, cap: -1,
  };
  const _a = new THREE.Vector3();
  const _b = new THREE.Vector3();
  const _dir = new THREE.Vector3();

  function layout() {
    const hr = hero.getBoundingClientRect();
    S.W = Math.max(1, hr.width);
    S.H = Math.max(1, hr.height);
    renderer.setSize(S.W, S.H, false);
    camera.aspect = S.W / S.H;
    camera.updateProjectionMatrix();
    const r = setEl.getBoundingClientRect();
    S.rect = { cx: r.left - hr.left + r.width / 2, cy: r.top - hr.top + r.height / 2, w: r.width, h: r.height };
    fitSet();
    rebuildHose();
  }
  function fitSet() {
    const d = 10;
    const wpp = (2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / S.H;
    const s = Math.min((S.rect.h * wpp) / BOX.h, (S.rect.w * wpp) / BOX.w) * 0.97;
    set.scale.setScalar(s);
    set.position.set((S.rect.cx - S.W / 2) * wpp - BOX.cx * s, -(S.rect.cy - S.H / 2) * wpp - BOX.cy * s, 0);
    S.setCenter = new THREE.Vector3((S.rect.cx - S.W / 2) * wpp, -(S.rect.cy - S.H / 2) * wpp, 0);
  }
  const toSet = (v) => set.worldToLocal(v);
  function rebuildHose() {
    // stream from the exact nozzle-tip pixel of the artwork to the tank inlet (standing pose)
    const x = chef.root.position.x;
    const y = chef.root.position.y;
    chef.root.position.set(KID_X, CHEF_Y, chef.root.position.z);
    const ts = tank.group.scale.x;
    tank.group.scale.setScalar(0.92);
    set.updateMatrixWorld(true);
    const tip = toSet(chef.nozzleWorld(_a).clone());
    const inlet = toSet(tank.inletWorld(_b).clone());
    _dir.set(-1, 0.12, 0).normalize();
    stream.setPath(tip, _dir.clone(), inlet);
    chef.root.position.x = x;
    chef.root.position.y = y;
    tank.group.scale.setScalar(ts);
    set.updateMatrixWorld(true);
  }

  function caption(t, short) {
    let idx = -1;
    CAPTIONS.forEach(([a, b], i) => { if (t >= a && t <= b && !short) idx = i; });
    if (idx === S.cap) return;
    S.cap = idx;
    if (!captionEl) return;
    if (idx < 0) { captionEl.classList.remove('is-on'); return; }
    captionEl.textContent = CAPTIONS[idx][2];
    captionEl.classList.remove('is-on');
    void captionEl.offsetWidth;
    captionEl.classList.add('is-on');
  }

  /* apply the whole world state for timeline time t */
  function apply(t, dt) {
    const intro = t < T.end;
    set.visible = !S.playing || t >= T.done - 0.02;
    // camera: dolly in, then slide aside to make room for the headline
    const z = camZAt(t);
    const pan = smoother(span(t, T.pan));
    S.pan = pan;
    const off = S.setCenter || new THREE.Vector3();
    const px = S.look.x * 0.25 * pan;
    const py = -S.look.y * 0.12 * pan;
    camera.position.set(off.x * (1 - pan) + px, off.y * (1 - pan) + py, z);
    camera.lookAt(camera.position.x - px * 0.4, camera.position.y - py * 0.4, z - 10);
    rig.position.set(off.x, off.y, 0);

    // shot 1–2: darkness, light sweep, logo
    const sw = span(t, T.sweep);
    const out = span(t, T.logoOut);
    logo.visible = t > 0.4 && out < 1;
    logo.material.uniforms.uSweep.value = sw;
    logo.material.uniforms.uLift.value = smooth(0.7, 1, sw);
    logo.material.uniforms.uAlpha.value = smooth(0.4, 1.2, t) * (1 - out);
    logo.position.y = 0.15 + easeInOut(out) * 1.6;
    logo.scale.setScalar(1 + out * 0.4);
    sweepLight.position.x = lerp(-4.5, 4.5, sw);
    sweepLight.material.opacity = Math.sin(sw * Math.PI) * 0.55 + smooth(0, 1.2, t) * 0.08 * (1 - out);

    // shot 3: real dishes drift past the camera
    cards.forEach((c, i) => {
      const dz = z - c.position.z;
      const last = i === cards.length - 1;
      c.visible = intro && dz > 0.15 && dz < 11 && t > T.dolly[0] - 0.3;
      if (!c.visible) return;
      const near = smooth(11, 6, dz) * smooth(0.15, last ? 1.4 : 0.9, dz);
      c.material.opacity = near;
      c.userData.rim.material.opacity = smooth(5, 2, dz) * 0.8 * near;
      c.position.y += Math.sin(t * 1.3 + i) * 0.0015;
      c.rotation.z = Math.sin(t * 0.7 + i) * 0.03;
    });

    // shot 4: the restaurant wakes up, the chef pops up, tank appears, hose picked up
    if (t >= T.veil) html.classList.add('veil-open'); else html.classList.remove('veil-open');
    // the kid walks in from the right with a little bounce in his step
    const walk = span(t, T.chefUp);
    const we = 1 - Math.pow(1 - walk, 3);
    chef.root.position.x = lerp(KID_X + 3.6, KID_X, we);
    chef.root.position.y = CHEF_Y + Math.abs(Math.sin(walk * Math.PI * 5)) * 0.09 * (1 - we);
    chef.root.visible = t > T.chefUp[0] - 0.05;
    const tk = easeOutBack(span(t, T.tankIn));
    tank.group.scale.setScalar(Math.max(0.001, tk) * 0.92);
    tank.group.visible = t > T.tankIn[0];
    set.children[0].visible = false; // no counter in this version — everyone stands on the floor
    hose.setReveal(span(t, T.hose));
    if (intro && t > T.chefUp[0] && t < T.nozzle[0]) chef.setMood('happy', S.clock + 0.1);

    // shot 5: the loyalty spectacle
    const nozzle = smooth(T.nozzle[0], T.nozzle[1], t);
    const reveal = easeInOut(span(t, T.flow));
    const power = span(t, T.power);
    if (intro && t > T.nozzle[0] && t < T.fill[1]) chef.setMood('focus', S.clock + 0.1);
    let fillPower = null;
    let fillReveal = 1;
    if (intro) {
      const f = easeInOut(span(t, T.fill));
      S.shown = S.valueTo * f;
      S.valueFrom = S.valueTo;
    } else if (S.fill) {
      // "fill on open": the stream powers up, then pours the balance into an empty tank
      const k = clamp((S.clock - S.fill.t0) / S.fill.dur);
      fillReveal = smooth(0, 0.16, k);
      const pour = smoother(clamp((k - 0.14) / 0.86));
      S.shown = S.valueTo * pour;
      fillPower = 0.55 + smooth(0, 0.2, k) * 0.75 + Math.sin(S.clock * 9) * 0.05;
      chef.setMood('focus', S.clock + 0.1);
      if (k >= 1) {
        S.fill = null;
        S.valueFrom = S.valueTo;
        S.valueT = 1;
        chef.hop();
        chef.setMood('happy', S.clock + 1.6);
        pulse('ding');
        window.dispatchEvent(new Event('o2:tank-filled'));
      }
    } else {
      // live updates (e.g. after a redemption)
      if (S.valueT < 1) { S.valueT = Math.min(1, S.valueT + dt / 1.3); }
      S.shown = lerp(S.valueFrom, S.valueTo, easeInOut(S.valueT));
    }
    tank.setValue(S.shown);
    const idlePower = 0.9 + Math.sin(S.clock * 1.4) * 0.1;
    tank.setPower(intro ? power : fillPower !== null ? Math.min(1.25, fillPower) : idlePower);
    stream.update(S.clock, dt, {
      nozzle: intro ? nozzle : 1,
      reveal: intro ? reveal : fillReveal,
      power: intro ? power : fillPower !== null ? fillPower : 0.85 + Math.sin(S.clock * 2.1) * 0.12,
    });

    // shot 6: celebrate as the camera makes room for the headline
    if (t >= T.hop && S.lastHop < T.hop && intro) { chef.hop(); chef.setMood('happy', S.clock + 1.4); }
    S.lastHop = t;

    embers.points.position.set(camera.position.x, camera.position.y, z - 6);
    embers.points.material.opacity = 0.35 + 0.35 * (1 - pan);
    caption(t, html.classList.contains('intro-short'));
    montage?.set(t, intro && S.playing && !html.classList.contains('intro-short'));
    outro?.set(t, S.outro);
  }

  /* golden wave of light bursting from the tank — closes the intro and marks a full tank */
  const waveEl = document.getElementById('hero-wave');
  const _p = new THREE.Vector3();
  function pulse(kind) {
    if (!waveEl || reduce) return;
    tank.group.getWorldPosition(_p);
    _p.y += 1.3 * set.scale.x;
    _p.project(camera);
    waveEl.style.setProperty('--wx', `${((_p.x + 1) / 2) * S.W}px`);
    waveEl.style.setProperty('--wy', `${((1 - _p.y) / 2) * S.H}px`);
    waveEl.className = 'hero-wave';
    void waveEl.offsetWidth;
    waveEl.className = `hero-wave is-${kind}`;
  }
  function startFill(dur = 2.8) {
    if (reduce) return;
    S.fill = { t0: S.clock, dur };
    S.shown = 0;
    tank.setValue(0);
  }

  function finishIntro() {
    if (S.doneFired) return;
    S.doneFired = true;
    html.classList.remove('intro-on');
    html.classList.add('intro-done');
    try { localStorage.setItem('o2-intro-seen', '1'); } catch { /* ignore */ }
    if (replayBtn) replayBtn.hidden = false;
    window.dispatchEvent(new Event('o2:intro-done'));
  }

  function skip() {
    S.t = T.end;
    S.playing = false;
    cards.forEach((c) => { c.visible = false; });
    montage?.set(0, false);
    S.outro = false;
    outro?.set(0, false);
    finishIntro();
    html.classList.add('veil-open');
    caption(-1);
    startFill(2.4);
  }
  skipBtn?.addEventListener('click', skip);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && html.classList.contains('intro-on')) skip(); });

  function startIntro(short) {
    scrollTo({ top: 0, behavior: 'instant' });
    S.doneFired = false;
    S.cap = -1;
    S.playing = true;
    S.outro = true;
    S.t = short ? T.shortStart : 0;
    S.lastHop = S.t;
    S.value = S.valueTo;
    html.classList.add('intro-on');
    if (short) html.classList.add('intro-short'); else html.classList.remove('intro-short');
    html.classList.remove('veil-open');
    if (!short) montage?.prime();
    if (replayBtn) replayBtn.hidden = true;
    setTimeout(() => skipBtn?.focus({ preventScroll: true }), 50);
  }
  replayBtn?.addEventListener('click', () => startIntro(false));

  // phone tilt (enabled from the «ميّل خزان النقاط» card in js/extras.js)
  S.tilt = 0; S.tiltT = 0;
  window.addEventListener('o2:tilt', (e) => { S.tiltT = THREE.MathUtils.degToRad(Number(e.detail?.deg) || 0); });

  // live loyalty value
  window.addEventListener('o2:points', (e) => {
    const v = Number(e.detail?.value);
    if (!Number.isFinite(v)) return;
    S.valueFrom = S.shown;
    S.valueTo = v;
    S.value = v;
    S.valueT = 0;
    if (v < S.valueFrom) chef.setMood('focus', S.clock + 1.2); else { chef.hop(); chef.setMood('happy', S.clock + 1.5); }
  });

  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    S.lookT.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    S.lookT.y = ((e.clientY - r.top) / r.height) * 2 - 1;
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { S.lookT.x = 0; S.lookT.y = 0; });

  new IntersectionObserver(([en]) => { S.visible = en.isIntersecting; }, { threshold: 0.01 }).observe(hero);
  new ResizeObserver(() => { layout(); if (reduce) render(); }).observe(hero);
  addEventListener('resize', layout);
  document.fonts?.ready.then(layout);

  /* ---- loop ---- */
  S.clock = 0;
  let last = performance.now();
  let frames = 0;
  let acc = 0;
  let dpr = renderer.getPixelRatio();
  function render() { renderer.render(scene, camera); }
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (S.frozen || (!S.visible && !S.playing)) return;
    S.clock += dt;
    if (S.playing) {
      S.t += dt;
      if (S.t >= T.done) finishIntro();
      if (S.t >= T.end) { S.t = T.end; S.playing = false; }
    }
    S.look.x = damp(S.look.x, S.lookT.x, 3, dt);
    S.look.y = damp(S.look.y, S.lookT.y, 3, dt);
    // chef looks at the cursor once the hero is live; during the intro he watches the stream / camera
    const lookTarget = S.playing && S.t < T.pan[0] ? (S.t > T.nozzle[0] ? { x: 0.9, y: 0.1 } : { x: 0, y: 0 }) : { x: S.look.x - (-0.45), y: S.look.y - 0.1 };
    chef.update(S.clock, dt, lookTarget);
    if (chef.body.position.y > 0.001 || chef.body.userData.wasUp) { rebuildHose(); chef.body.userData.wasUp = chef.body.position.y > 0.001; }
    if (S.playing && S.t < T.chefUp[1] + 0.05) rebuildHose(); // keep the stream attached while he walks in
    S.tilt = damp(S.tilt, S.tiltT, 4, dt) + Math.sin(S.clock * 5) * (S.tiltT - S.tilt) * 0.15; // a little slosh
    tank.setTilt(S.tilt);
    tank.update(S.clock);
    embers.update(dt, S.playing ? 1 : 0.6);
    apply(S.t, dt);
    render();
    // adaptive resolution
    acc += dt; frames++;
    if (frames === 120) {
      if (acc / frames > 1 / 40 && dpr > 0.8) { dpr = Math.max(0.75, dpr - 0.25); renderer.setPixelRatio(dpr); layout(); }
      frames = 0; acc = 0;
    }
  }

  layout();
  html.classList.add('scene-ready');
  if (html.classList.contains('intro-on')) startIntro(html.classList.contains('intro-short'));
  else { S.t = T.end; html.classList.add('veil-open'); finishIntro(); setTimeout(() => startFill(2.8), 350); }
  // returning from the back/forward cache counts as opening the page too
  addEventListener('pageshow', (e) => { if (e.persisted && !S.playing) startFill(2.4); });

  if (reduce) {
    // one calm, complete frame — no loop
    S.clock = 1;
    chef.update(1, 0.016, { x: 0.3, y: 0 });
    tank.update(1);
    apply(T.end, 0.016);
    render();
    addEventListener('resize', () => { layout(); apply(T.end, 0.016); render(); });
    window.addEventListener('o2:points', () => { S.valueT = 1; S.shown = S.valueTo; apply(T.end, 0.016); render(); });
  } else {
    requestAnimationFrame(frame);
  }

  // QA hook (opt-in): render any moment of the timeline deterministically
  if (new URLSearchParams(location.search).has('debug3d')) {
    window.__o2hero = {
      S, T, scene, camera, set, logo, cards, chef, tank,
      at(t) {
        S.frozen = true;
        if (t >= T.veil) html.classList.add("veil-open"); else html.classList.remove("veil-open");
        S.clock = t;
        chef.update(t, 0.016, { x: 0.6, y: 0 });
        for (let i = 0; i < 6; i++) apply(t, 0.05);
        tank.update(t);
        apply(t, 0.016);
        render();
      },
    };
  }

  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    html.classList.remove('scene-ready', 'intro-on');
    stageEl.replaceChildren();
  });
  return { chef };
}

/* =====================================================================
   "How to collect" — the same chef, hosing points toward the steps
   ===================================================================== */
function bootHowto() {
  const el = document.getElementById('howto-stage');
  if (!el) return;
  let started = false;
  const io = new IntersectionObserver(([en]) => {
    if (en.isIntersecting && !started) { started = true; build(); }
  }, { rootMargin: '200px' });
  io.observe(el);

  function build() {
    const { renderer, env } = makeRenderer(el, small ? 1.5 : 1.75);
    const scene = new THREE.Scene();
    scene.environment = env;
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
    camera.position.set(0.4, 1.5, 8.2);
    camera.lookAt(0.4, 1.25, 0);
    addLights(scene);
    const glow = glowTexture();
    const logoTex = loadTexture('assets/logo.png');
    // the kid faces right (mirrored artwork, logos kept readable) and pours points into the membership progress line
    const chef = buildKid({ height: 3.0, renderer, glowTex: glow, flip: true });
    const KX = 0;
    chef.root.position.set(KX, 0, 0);
    scene.add(chef.root);
    const stream = buildStream({ glowTex: glow, droplets: small ? 60 : 110 });
    scene.add(stream.group);
    const _a = new THREE.Vector3();
    let visible = true;
    let size = { w: 1, h: 1 };
    let camX = 0;
    const meterFill = document.querySelector('#account [data-meter]');
    const meterKnob = document.querySelector('#account [data-meter-knob]');
    const card = document.querySelector('.howto-card');
    const targetPct = meterKnob ? parseFloat(meterKnob.style.left) || 0 : 0;
    const setMeter = (pct) => {
      if (meterFill) meterFill.style.width = `${pct}%`;
      if (meterKnob) meterKnob.style.left = `${pct}%`;
    };
    if (!reduce) setMeter(0);
    let pourT = -1;
    let hopped = false;

    function extendOverCard() {
      // stretch the (click-through) canvas over the membership card so the stream can reach its progress line
      el.style.left = '0';
      el.style.right = '0';
      const wr = el.parentElement.getBoundingClientRect();
      const cb = card?.getBoundingClientRect();
      if (cb && cb.width && cb.left >= wr.right - 4 && cb.top < wr.bottom && cb.bottom > wr.top) el.style.right = `${-(cb.right - wr.right)}px`;
    }
    function aimPoint() {
      const wpp = (2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / size.h;
      const cr = el.getBoundingClientRect();
      let px = size.w;
      let py = size.h * 0.3;
      if (meterKnob) {
        const k = meterKnob.getBoundingClientRect();
        px = k.left + k.width / 2 - cr.left;
        py = k.top + k.height / 2 - cr.top - 3; // land on top of the bar
      }
      px = clamp(px, 0, size.w);
      py = clamp(py, 0, size.h);
      return new THREE.Vector3(camX + (px - size.w / 2) * wpp, 1.45 - (py - size.h / 2) * wpp, 0);
    }
    function rebuild() {
      scene.updateMatrixWorld(true);
      stream.setPath(chef.nozzleWorld(_a).clone(), new THREE.Vector3(1, 0.4, 0).normalize(), aimPoint());
    }
    function resize() {
      extendOverCard();
      size = { w: Math.max(1, el.clientWidth), h: Math.max(1, el.clientHeight) };
      renderer.setSize(size.w, size.h, false);
      camera.aspect = size.w / size.h;
      // frame the kid inside his own column (the canvas extends over the card on the right)
      const wrapW = Math.max(1, el.parentElement.clientWidth);
      const colAspect = wrapW / size.h;
      camera.position.z = colAspect < 0.8 ? 8.2 / Math.max(0.55, colAspect / 0.8) : 8.2;
      camera.updateProjectionMatrix();
      const wpp = (2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / size.h;
      const shiftPx = size.w / 2 - wrapW / 2; // the kid's column is the left end of the canvas
      camX = KX + shiftPx * wpp;
      camera.position.set(camX, 1.55, camera.position.z);
      camera.lookAt(camX, 1.45, 0);
      rebuild();
      chef.update(clock || 1, 0.016, { x: 0.6, y: 0.05 });
      stream.update(clock || 1, 0.016, { nozzle: 1, reveal: reduce ? 1 : Math.max(reveal, 0), power: 1 });
      renderer.render(scene, camera);
    }
    let clock = 0;
    let last = performance.now();
    let reveal = 0;
    new ResizeObserver(resize).observe(el);
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(el);
    resize();
    reveal = 0;
    function frame(now) {
      requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible) return;
      tick(dt);
    }
    function tick(dt) {
      clock += dt;
      if (pourT < 0) pourT = 0;
      pourT += dt;
      // 1) the stream travels from the nozzle to the bar  2) the bar fills while he pours  3) hold + hop
      reveal = clamp(pourT / 0.9);
      const pk = clamp((pourT - 0.8) / 2.4);
      // drive the line directly while pouring (its CSS transition would lag behind the stream)
      if (pourT < 3.6) {
        if (meterFill) meterFill.style.transition = 'none';
        if (meterKnob) meterKnob.style.transition = 'none';
        setMeter(targetPct * smoother(pk));
      } else if (meterFill && meterFill.style.transition === 'none') {
        meterFill.style.transition = '';
        if (meterKnob) meterKnob.style.transition = '';
      }
      if (pourT < 3.6 || chef.body.position.y > 0.001) rebuild();
      if (pk >= 1 && !hopped) { hopped = true; chef.hop(); }
      chef.setMood(pk < 1 ? 'focus' : 'happy', clock + 0.1);
      chef.update(clock, dt, { x: 0.6, y: 0.05 });
      stream.update(clock, dt, { nozzle: 1, reveal: easeInOut(reveal), power: pk < 1 ? 1.15 : 0.9 + Math.sin(clock * 2) * 0.1 });
      renderer.render(scene, camera);
    }
    if (new URLSearchParams(location.search).has('debug3d')) {
      window.__o2howto = {
        at(t) { pourT = t - 0.02; for (let i = 0; i < 4; i++) tick(0.005); },
        texture: chef.texture,
        check() {
          const end = aimPoint().project(camera);
          const cr = el.getBoundingClientRect();
          const k = meterKnob.getBoundingClientRect();
          return { streamEnd: [Math.round(cr.left + (end.x + 1) / 2 * size.w), Math.round(cr.top + (1 - end.y) / 2 * size.h)], knob: [Math.round(k.left + k.width / 2), Math.round(k.top + k.height / 2)] };
        },
      };
    }
    if (reduce) {
      chef.update(1, 0.016, { x: 0.8, y: 0 });
      stream.update(1, 0.016, { nozzle: 1, reveal: 1, power: 1 });
      renderer.render(scene, camera);
      new ResizeObserver(() => { resize(); renderer.render(scene, camera); }).observe(el);
    } else {
      requestAnimationFrame(frame);
    }
    window.dispatchEvent(new Event('o2:howto-ready'));
  }
}

/* ---------- boot ---------- */
function canWebGL() {
  try { const c = document.createElement('canvas'); return Boolean(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
try {
  if (canWebGL() && !navigator.connection?.saveData) {
    bootHero();
    bootHowto();
  } else {
    html.classList.remove('intro-on');
  }
} catch (err) {
  console.warn('[O2] 3D unavailable — keeping the static hero.', err);
  html.classList.remove('intro-on', 'scene-ready');
  window.dispatchEvent(new Event('o2:intro-done'));
}
