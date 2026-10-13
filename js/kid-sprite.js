/* =====================================================================
   The O2 kid (official mascot render, 560×957 with alpha) placed in the
   3D scene as a high-fidelity cut-out: exact artwork, unlit (no tone
   mapping) so colours match the original, plus life: breathing, a gentle
   weight shift, lean toward the cursor, squash-and-stretch hops, a walk-in,
   a contact shadow and a warm rim glow. The golden stream leaves from the
   exact nozzle-tip pixel.
   ===================================================================== */
import * as THREE from 'three';
import { clamp, damp } from './three-kit.js';

export const KID_IMG = { url: 'assets/mascot/o2-kid-hose.webp', w: 560, h: 957, top: 86, feetY: 937, feetX: 360, nozzle: [15, 447] };
// O2 logo regions in the source image — restored after mirroring so the logos never read backwards
// [x, y, w, h, feather] measured on a pixel grid: cap letters only (the patch is slanted), apron, backpack letters (inside the pack outline)
const LOGOS = [[239, 96, 43, 38, 4], [214, 464, 70, 72, 7], [429, 416, 57, 70, 6]];

/* mirror the artwork horizontally, then paste the logo regions back un-mirrored (feathered edges) */
function mirroredCanvas(img) {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.translate(W, 0);
  g.scale(-1, 1);
  g.drawImage(img, 0, 0);
  g.setTransform(1, 0, 0, 1, 0, 0);
  for (const [x, y, w, h, f] of LOGOS) {
    const t = document.createElement('canvas');
    t.width = w; t.height = h;
    const tg = t.getContext('2d');
    tg.drawImage(img, x, y, w, h, 0, 0, w, h);
    // feather the patch edges so no seam shows
    tg.globalCompositeOperation = 'destination-in';
    const gx = tg.createLinearGradient(0, 0, w, 0);
    gx.addColorStop(0, 'rgba(0,0,0,0)'); gx.addColorStop(f / w, '#000'); gx.addColorStop(1 - f / w, '#000'); gx.addColorStop(1, 'rgba(0,0,0,0)');
    tg.fillStyle = gx; tg.fillRect(0, 0, w, h);
    const gy = tg.createLinearGradient(0, 0, 0, h);
    gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(f / h, '#000'); gy.addColorStop(1 - f / h, '#000'); gy.addColorStop(1, 'rgba(0,0,0,0)');
    tg.fillStyle = gy; tg.fillRect(0, 0, w, h);
    g.drawImage(t, W - x - w, y);
  }
  return c;
}

export function buildKid({ height = 3.1, renderer, glowTex, flip = false } = {}) {
  const I = flip ? { ...KID_IMG, feetX: KID_IMG.w - KID_IMG.feetX, nozzle: [KID_IMG.w - KID_IMG.nozzle[0], KID_IMG.nozzle[1]] } : KID_IMG;
  const s = height / (I.feetY - I.top);         // world units per source pixel
  const root = new THREE.Group();                // sits on the floor, at the feet
  const body = new THREE.Group();                // hops / leans (pivot at the feet)
  root.add(body);

  let tex;
  if (flip) {
    tex = new THREE.Texture();
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { tex.image = mirroredCanvas(img); tex.needsUpdate = true; };
    img.src = I.url;
  } else {
    tex = new THREE.TextureLoader().load(I.url);
  }
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;

  const W = I.w * s;
  const H = I.h * s;
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.04, toneMapped: false, depthWrite: true }),
  );
  // place the image so the feet are at the origin
  plane.position.set((I.w / 2 - I.feetX) * s, (I.feetY - I.h / 2) * s, 0);
  body.add(plane);

  // warm rim glow behind the figure so it sits in the scene's light
  if (glowTex) {
    const rim = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffa040, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
    rim.scale.set(W * 1.6, H * 1.05, 1);
    rim.position.set(plane.position.x + (flip ? -0.15 : 0.15), H * 0.48, -0.25);
    body.add(rim);
  }
  // soft contact shadow on the floor
  const shadowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(0,0,0,0.75)');
    grd.addColorStop(0.55, 'rgba(0,0,0,0.3)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.5), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.8 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(flip ? 0.1 : -0.1, 0.005, 0.05);
  root.add(shadow);

  // nozzle tip in body space
  const nozzle = new THREE.Object3D();
  nozzle.position.set((I.nozzle[0] - I.feetX) * s, (I.feetY - I.nozzle[1]) * s, 0.02);
  body.add(nozzle);

  const st = { hopT: -1, lean: 0, mood: 'idle', moodUntil: 0 };
  function hop() { st.hopT = 0; }
  function setMood(m, until) { st.mood = m; st.moodUntil = until; }

  function update(t, dt, look = { x: 0, y: 0 }) {
    // hop with anticipation, stretch in the air and a soft landing
    let jump = 0;
    let sy = 1;
    if (st.hopT >= 0) {
      st.hopT += dt / 0.85;
      const k = clamp(st.hopT);
      if (k < 0.18) sy = 1 - Math.sin((k / 0.18) * Math.PI) * 0.05;          // crouch
      else if (k < 0.82) { const a = (k - 0.18) / 0.64; jump = Math.sin(a * Math.PI) * 0.28; sy = 1 + Math.sin(a * Math.PI) * 0.04; }
      else sy = 1 - Math.sin(((k - 0.82) / 0.18) * Math.PI) * 0.035;           // land
      if (st.hopT >= 1) st.hopT = -1;
    }
    const breathe = 1 + Math.sin(t * 1.9) * 0.006;
    body.scale.set(1 / Math.sqrt(sy), sy * breathe, 1);
    body.position.y = jump;
    // lean toward the cursor + a slow weight shift; focused = steady
    const focus = t < st.moodUntil && st.mood === 'focus';
    const target = clamp(look.x, -1, 1) * 0.022 + (focus ? 0 : Math.sin(t * 0.7) * 0.008);
    st.lean = damp(st.lean, target, 3, dt);
    body.rotation.z = flip ? st.lean : -st.lean;
    shadow.scale.set(1 - jump * 0.8, 1 - jump * 0.8, 1);
    shadow.material.opacity = 0.8 - jump * 1.2;
  }

  const _v = new THREE.Vector3();
  function nozzleWorld(out = _v) { return nozzle.getWorldPosition(out); }

  return { root, body, plane, hop, setMood, update, nozzleWorld, texture: tex, size: { w: W, h: H } };
}
