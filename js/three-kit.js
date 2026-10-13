/* =====================================================================
   O2 3D kit — procedural, asset-free builders shared by every scene:
   the young chef, the loyalty tank, the hose, the golden points stream,
   real-photo food cards and the logo plane.
   ===================================================================== */
import * as THREE from 'three';

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t) => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
export const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));

const GOLD = new THREE.Color(0xffb21e);
const loader = new THREE.TextureLoader();

export function loadTexture(url) {
  const tex = loader.load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function glowTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,0.25)') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.35, mid);
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* Logo shader: keys out any white backdrop, supports a light-sweep reveal. */
export function logoMaterial(tex) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { map: { value: tex }, uSweep: { value: 1 }, uAlpha: { value: 1 }, uLift: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: /* glsl */`
      uniform sampler2D map; uniform float uSweep; uniform float uAlpha; uniform float uLift;
      varying vec2 vUv;
      void main() {
        vec4 t = texture2D(map, vUv);
        float white = min(t.r, min(t.g, t.b));
        float a = t.a * (1.0 - smoothstep(0.82, 0.96, white));
        float d = vUv.x * 0.8 + (1.0 - vUv.y) * 0.4;
        float band = exp(-pow((d - (uSweep * 1.6 - 0.3)) * 7.0, 2.0));
        float revealed = smoothstep(uSweep * 1.6 - 0.35, uSweep * 1.6 - 0.55, d);
        vec3 col = t.rgb * (0.12 + 0.9 * max(revealed, uLift)) + vec3(1.0, 0.78, 0.4) * band * 1.4 * a;
        gl_FragColor = vec4(col, a * uAlpha);
      }`,
  });
}

export function makeLogoPlane(tex, size = 1) {
  return new THREE.Mesh(new THREE.PlaneGeometry(size, size), logoMaterial(tex));
}

/* Real photo on a rounded card with a warm rim. */
export function makeFoodCard(tex, w = 2.4, h = 1.2, crop = null) {
  // crop = { repeatY, offsetY } shows only part of a tall image (e.g. the photo half of a social post)
  if (crop) { tex.repeat.set(1, crop.repeatY); tex.offset.set(0, crop.offsetY); }
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#fff';
  g.beginPath(); g.roundRect(3, 3, 250, 122, 14); g.fill();
  const alpha = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshBasicMaterial({ map: tex, alphaMap: alpha, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  const rim = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 1.04, h * 1.08),
    new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,180,60,0.9)', 'rgba(255,140,20,0.35)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.0 }),
  );
  rim.position.z = -0.02;
  rim.scale.set(1.25, 1.6, 1);
  card.add(rim);
  card.userData.rim = rim;
  return card;
}

/* =====================================================================
   Materials
   ===================================================================== */
function cloth(color, sheen = 0.6) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.78, sheen, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffffff) });
}
const skinMat = () => new THREE.MeshPhysicalMaterial({ color: 0xf1b88f, roughness: 0.52, sheen: 0.35, sheenColor: new THREE.Color(0xffd0b0), clearcoat: 0.08 });

/* =====================================================================
   The young chef
   ===================================================================== */
export function buildChef({ logoTex } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group();          // everything that hops/sways
  root.add(body);

  // The little O2 chef (from the restaurant's own mascot artwork):
  // red O2 cap, round glasses, red shirt, navy O2 apron, red neckerchief, black gloves.
  const shirt = new THREE.MeshPhysicalMaterial({ color: 0xb0121a, roughness: 0.66, sheen: 0.35, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xff5a4a) });
  const apronMat = new THREE.MeshPhysicalMaterial({ color: 0x111a36, roughness: 0.78, sheen: 0.25, sheenColor: new THREE.Color(0x3a4f99), side: THREE.DoubleSide });
  const capMat = new THREE.MeshPhysicalMaterial({ color: 0xbf1219, roughness: 0.6, sheen: 0.3, sheenColor: new THREE.Color(0xff5a4a) });
  const glove = new THREE.MeshPhysicalMaterial({ color: 0x141414, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.25 });
  const skin = skinMat();
  const hairMat = new THREE.MeshPhysicalMaterial({ color: 0x3a2318, roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0x8a5a3a) });
  const dark = new THREE.MeshPhysicalMaterial({ color: 0x1b0e0a, roughness: 0.25, clearcoat: 1 });
  const jacket = shirt; // sleeves

  // torso (red shirt)
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.55, 14, 48), shirt);
  torso.position.y = 0.5;
  torso.scale.set(1.06, 1, 0.84);
  body.add(torso);
  // navy apron wrapping the front, with bib + straps
  const apron = new THREE.Mesh(new THREE.CylinderGeometry(0.545, 0.6, 1.05, 64, 1, true, -1.25, 2.5), apronMat);
  apron.position.y = 0.3;
  apron.scale.set(1.06, 1, 0.86);
  body.add(apron);
  for (const k of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.36, 0.03), apronMat);
    strap.position.set(0.25 * k, 0.98, 0.33);
    strap.rotation.set(-0.5, 0, 0.12 * k);
    body.add(strap);
  }
  const buckleMat = new THREE.MeshPhysicalMaterial({ color: 0xd9a441, metalness: 1, roughness: 0.25 });
  for (const k of [-1, 1]) {
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.025), buckleMat);
    buckle.position.set(0.24 * k, 0.86, 0.43);
    buckle.rotation.set(-0.35, 0, 0.1 * k);
    body.add(buckle);
  }
  const pocket = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.58, 0.22, 24, 1, true, -0.45, 0.9), apronMat);
  pocket.position.y = 0.05;
  pocket.scale.set(1.08, 1, 0.9);
  body.add(pocket);
  if (logoTex) {
    const badge = makeLogoPlane(logoTex, 0.3);
    badge.position.set(0, 0.6, 0.485);
    body.add(badge);
  }
  // red neckerchief
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 12, 32), shirt);
  scarf.position.y = 1.07;
  scarf.rotation.x = Math.PI / 2;
  body.add(scarf);
  const knot = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.2, 4), shirt);
  knot.position.set(0, 0.96, 0.25);
  knot.rotation.set(Math.PI + 0.35, Math.PI / 4, 0);
  body.add(knot);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.16, 16), skin);
  neck.position.y = 1.12;
  body.add(neck);

  // head
  const head = new THREE.Group();
  head.position.y = 1.6;
  body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.62, 72, 54), skin);
  skull.scale.set(1, 0.96, 0.94);
  head.add(skull);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.645, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.52), hairMat);
  hair.rotation.x = -0.42;
  hair.scale.set(1, 0.96, 0.95);
  head.add(hair);
  [[-0.3, 0.15, 0.5, 0.12], [-0.1, 0.17, 0.54, 0.13], [0.12, 0.17, 0.54, 0.13], [0.32, 0.14, 0.5, 0.11]].forEach(([x, y, z, r]) => {
    const f = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), hairMat);
    f.position.set(x, y, z);
    f.scale.set(1.1, 0.7, 0.8);
    head.add(f);
  });
  for (const k of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), skin);
    ear.position.set(0.6 * k, -0.02, 0);
    ear.scale.set(0.55, 1, 0.8);
    head.add(ear);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), new THREE.MeshPhysicalMaterial({ color: 0xd98c6a, roughness: 0.6 }));
    inner.position.set(0.63 * k, -0.02, 0.02);
    inner.scale.set(0.35, 0.9, 0.7);
    head.add(inner);
  }
  // eyes
  const eyeWhite = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.12, clearcoat: 1 });
  const iris = new THREE.MeshPhysicalMaterial({ color: 0x6b3a16, roughness: 0.2, clearcoat: 1 });
  const glint = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eyes = [-1, 1].map((k) => {
    const eye = new THREE.Group();
    eye.position.set(0.22 * k, 0.02, 0.49);
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.16, 40, 28), eyeWhite);
    w.scale.set(1, 1.2, 0.6);
    eye.add(w);
    const gaze = new THREE.Group();
    gaze.position.z = 0.06;
    const ir = new THREE.Mesh(new THREE.SphereGeometry(0.108, 36, 24), iris);
    ir.scale.set(1, 1.15, 0.5);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), dark);
    pu.position.z = 0.035;
    pu.scale.set(1, 1.15, 0.5);
    const g1 = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), glint);
    g1.position.set(0.04, 0.05, 0.06);
    const g2 = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), glint);
    g2.position.set(-0.035, -0.035, 0.06);
    gaze.add(ir, pu, g1, g2);
    eye.add(gaze);
    head.add(eye);
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.14, 4, 8), hairMat);
    brow.position.set(0.22 * k, 0.27, 0.56);
    brow.rotation.z = Math.PI / 2 + 0.18 * k;
    head.add(brow);
    return { eye, gaze, brow };
  });
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), new THREE.MeshPhysicalMaterial({ color: 0xe8a27a, roughness: 0.5 }));
  nose.position.set(0, -0.1, 0.59);
  head.add(nose);
  // open smile
  const mouthShape = new THREE.Shape();
  mouthShape.moveTo(-0.15, 0);
  mouthShape.quadraticCurveTo(0, -0.24, 0.15, 0);
  mouthShape.quadraticCurveTo(0, 0.03, -0.15, 0);
  const mouth = new THREE.Group();
  mouth.position.set(0, -0.25, 0.555);
  mouth.rotation.x = -0.25;
  const mouthMesh = new THREE.Mesh(new THREE.ShapeGeometry(mouthShape, 16), new THREE.MeshBasicMaterial({ color: 0x4a120c }));
  const tongue = new THREE.Mesh(new THREE.CircleGeometry(0.07, 20), new THREE.MeshBasicMaterial({ color: 0xe8616a }));
  tongue.position.set(0, -0.085, 0.002);
  tongue.scale.set(1.2, 0.6, 1);
  const teeth = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.028), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  teeth.position.set(0, -0.012, 0.003);
  mouth.add(mouthMesh, tongue, teeth);
  head.add(mouth);
  const blush = new THREE.MeshBasicMaterial({ color: 0xff8f86, transparent: true, opacity: 0.4, depthWrite: false });
  for (const k of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.CircleGeometry(0.085, 20), blush);
    c.position.set(0.36 * k, -0.13, 0.47);
    c.lookAt(c.position.clone().multiplyScalar(2));
    head.add(c);
  }
  // red O2 baseball cap
  const hat = new THREE.Group();
  hat.position.set(0, 0.08, -0.02);
  hat.rotation.x = -0.12;
  head.add(hat);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.665, 72, 32, 0, Math.PI * 2, 0, Math.PI * 0.5), capMat);
  dome.scale.set(1, 0.86, 1.03);
  hat.add(dome);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.04, 64, 1, false, -Math.PI / 2, Math.PI), capMat);
  brim.position.set(0, 0.05, 0.5);
  brim.rotation.x = 0.16;
  brim.scale.set(1, 1, 1.05);
  hat.add(brim);
  const seamMat = new THREE.MeshPhysicalMaterial({ color: 0x8e0c12, roughness: 0.7 });
  const seams = new THREE.Group();
  seams.scale.set(1, 0.86, 1.03);
  for (let i = 0; i < 3; i++) {
    const seam = new THREE.Mesh(new THREE.TorusGeometry(0.667, 0.006, 6, 96, Math.PI), seamMat);
    seam.rotation.y = (i / 3) * Math.PI;
    seams.add(seam);
  }
  hat.add(seams);
  const stitch = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.006, 6, 64, Math.PI), seamMat);
  stitch.rotation.set(Math.PI / 2 + 0.16, 0, Math.PI);
  stitch.position.set(0, 0.075, 0.5);
  stitch.scale.set(1, 1.05, 1);
  hat.add(stitch);
  const topBtn = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), capMat);
  topBtn.position.y = 0.57;
  hat.add(topBtn);
  const patch = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), apronMat);
  patch.position.set(0, 0.33, 0.56);
  patch.rotation.x = -0.45;
  hat.add(patch);
  if (logoTex) {
    const hb = makeLogoPlane(logoTex, 0.26);
    hb.position.set(0, 0.335, 0.575);
    hb.rotation.x = -0.45;
    hat.add(hb);
  }
  // messy hair tufts peeking out under the cap
  [[-0.52, -0.02, 0.22, 0.14], [0.52, -0.02, 0.22, 0.14], [-0.45, 0.08, -0.25, 0.16], [0.45, 0.08, -0.25, 0.16], [0, 0.0, -0.58, 0.2]].forEach(([x, y, z, r]) => {
    const t = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), hairMat);
    t.position.set(x, y, z);
    t.scale.set(0.9, 1.1, 0.9);
    head.add(t);
  });
  // round glasses (brown frames)
  const frame = new THREE.MeshPhysicalMaterial({ color: 0x5b3418, roughness: 0.3, clearcoat: 1 });
  const lensMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.05, clearcoat: 1, depthWrite: false });
  for (const k of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.195, 0.03, 16, 64), frame);
    rim.position.set(0.225 * k, 0.03, 0.62);
    rim.rotation.y = 0.12 * k;
    head.add(rim);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.19, 32), lensMat);
    lens.position.copy(rim.position).add(new THREE.Vector3(0, 0, 0.005));
    lens.rotation.y = rim.rotation.y;
    head.add(lens);
    const temple = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.035, 0.6), frame);
    temple.position.set(0.5 * k, 0.07, 0.3);
    temple.rotation.y = -0.28 * k;
    head.add(temple);
  }
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.08, 8), frame);
  bridge.rotation.z = Math.PI / 2;
  bridge.position.set(0, 0.07, 0.64);
  head.add(bridge);

  // arms (2-bone, solved by IK toward the hose grips)
  const L1 = 0.42;
  const L2 = 0.4;
  function arm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.5 * side, 0.9, 0);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.135, L1 - 0.1, 6, 16), jacket);
    upper.position.y = -L1 / 2;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -L1;
    shoulder.add(elbow);
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, L2 - 0.12, 6, 16), jacket);
    fore.position.y = -L2 / 2;
    elbow.add(fore);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.045, 10, 24), glove);
    cuff.position.y = -L2 + 0.04;
    cuff.rotation.x = Math.PI / 2;
    elbow.add(cuff);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.14, 32, 24), glove);
    hand.position.y = -L2 - 0.06;
    hand.scale.set(1, 1.1, 0.9);
    elbow.add(hand);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.08, 6, 12), glove);
    thumb.position.set(0.1 * side, -L2 - 0.02, 0.07);
    thumb.rotation.set(0.5, 0, -0.7 * side);
    elbow.add(thumb);
    body.add(shoulder);
    return { shoulder, elbow, hand };
  }
  const arms = { r: arm(1), l: arm(-1) };

  const _d = new THREE.Vector3();
  const _n = new THREE.Vector3();
  const _u = new THREE.Vector3();
  const _e = new THREE.Vector3();
  const _f = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const DOWN = new THREE.Vector3(0, -1, 0);
  /** target & pole in body space */
  function solve(a, target, pole) {
    const S = a.shoulder.position;
    _d.copy(target).sub(S);
    const len = _d.length();
    const dist = clamp(len, 0.05, L1 + L2 + 0.06 - 0.001);
    _d.normalize();
    const reach = L1 + L2 + 0.06;
    const ang = Math.acos(clamp((L1 * L1 + dist * dist - (reach - L1) * (reach - L1)) / (2 * L1 * dist), -1, 1));
    _n.copy(_d).cross(pole).normalize();
    _u.copy(_d).applyAxisAngle(_n, ang);
    a.shoulder.quaternion.setFromUnitVectors(DOWN, _u);
    _e.copy(S).addScaledVector(_u, L1);
    _f.copy(target).sub(_e).normalize();
    _q.copy(a.shoulder.quaternion).invert();
    _f.applyQuaternion(_q);
    a.elbow.quaternion.setFromUnitVectors(DOWN, _f);
  }

  // grips the hose passes through (body space)
  const gripFront = new THREE.Vector3(0.62, 0.62, 0.62);
  const gripBack = new THREE.Vector3(0.05, 0.42, 0.62);
  solve(arms.r, gripFront, new THREE.Vector3(0.4, -1, -0.4));
  solve(arms.l, gripBack, new THREE.Vector3(-0.6, -1, -0.3));

  // ---- state & animation ----
  const st = { blinkAt: 1.5, blinkT: -1, mood: 'idle', moodUntil: 0, yaw: 0, pitch: 0, hopT: -1 };
  function setMood(m, until) { st.mood = m; st.moodUntil = until; }
  function hop() { st.hopT = 0; }

  function update(t, dt, look = { x: 0, y: 0 }) {
    // breathing + gentle sway (hands stay on the hose: arms are re-solved)
    const breathe = Math.sin(t * 1.8) * 0.012;
    torso.scale.y = 1 + breathe;
    let jump = 0;
    if (st.hopT >= 0) {
      st.hopT += dt / 0.7;
      jump = Math.sin(clamp(st.hopT) * Math.PI) * 0.22;
      if (st.hopT >= 1) st.hopT = -1;
    }
    body.position.y = jump;
    st.yaw = damp(st.yaw, clamp(look.x, -1, 1) * 0.45, 5, dt);
    st.pitch = damp(st.pitch, clamp(look.y, -1, 1) * 0.22, 5, dt);
    head.rotation.set(st.pitch + Math.sin(t * 1.1) * 0.02, st.yaw, Math.sin(t * 0.9) * 0.04);
    // blink
    if (st.blinkT < 0 && t > st.blinkAt) st.blinkT = 0;
    let lid = 1;
    if (st.blinkT >= 0) {
      st.blinkT += dt / 0.15;
      lid = 1 - Math.sin(clamp(st.blinkT) * Math.PI) * 0.92;
      if (st.blinkT >= 1) { st.blinkT = -1; st.blinkAt = t + 2 + Math.random() * 3.5; }
    }
    const mood = t < st.moodUntil ? st.mood : 'idle';
    const eyeScale = mood === 'happy' ? 0.45 : mood === 'focus' ? 0.82 : 1;
    eyes.forEach(({ eye, gaze, brow }, i) => {
      eye.scale.y = damp(eye.scale.y, eyeScale * lid, 18, dt);
      gaze.position.x = damp(gaze.position.x, st.yaw * 0.05, 8, dt);
      gaze.position.y = damp(gaze.position.y, -st.pitch * 0.05, 8, dt);
      brow.position.y = damp(brow.position.y, mood === 'happy' ? 0.31 : mood === 'focus' ? 0.24 : 0.27, 10, dt);
      brow.rotation.z = Math.PI / 2 + (i ? 1 : -1) * (mood === 'focus' ? -0.1 : 0.18);
    });
    const ms = mood === 'happy' ? 1.25 : mood === 'focus' ? 0.75 : 1;
    mouth.scale.x = damp(mouth.scale.x, ms, 10, dt);
    mouth.scale.y = damp(mouth.scale.y, ms, 10, dt);
  }

  // world-space helpers for the hose
  function grip(name, out = new THREE.Vector3()) {
    return body.localToWorld(out.copy(name === 'front' ? gripFront : gripBack));
  }

  return { root, body, head, setMood, hop, update, grip, gripFront, gripBack };
}

/* =====================================================================
   Hose (rubber tube through both hands) + brass nozzle
   ===================================================================== */
export function buildHose() {
  const group = new THREE.Group();
  const rubber = new THREE.MeshPhysicalMaterial({ color: 0x1d5d78, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xd99a2b, metalness: 1, roughness: 0.28 });
  let tube = new THREE.Mesh(new THREE.BufferGeometry(), rubber);
  group.add(tube);
  const nozzle = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.34, 20), brass);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.x = 0.17;
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.075, 0.16, 20), brass);
  tip.rotation.z = Math.PI / 2;
  tip.position.x = 0.42;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 10, 24), brass);
  ring.rotation.y = Math.PI / 2;
  ring.position.x = 0.04;
  nozzle.add(barrel, tip, ring);
  const tipPoint = new THREE.Object3D();
  tipPoint.position.x = 0.52;
  nozzle.add(tipPoint);
  group.add(nozzle);
  let reveal = 1;
  let built = null;

  /** points in world space: [floor start, ..., back grip, front grip]; dir = nozzle direction */
  function build(points, dir) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    tube.geometry.dispose();
    tube.geometry = new THREE.TubeGeometry(curve, 140, 0.065, 12, false);
    built = tube.geometry;
    setReveal(reveal);
    const end = points[points.length - 1];
    nozzle.position.copy(end);
    nozzle.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.clone().normalize());
  }
  /** grow the hose from the floor toward the hands */
  function setReveal(v) {
    reveal = v;
    if (!built) return;
    const total = built.index ? built.index.count : 0;
    built.setDrawRange(0, Math.floor(total * clamp(v)));
    nozzle.visible = v > 0.98;
  }
  function tipWorld(out = new THREE.Vector3()) { return tipPoint.getWorldPosition(out); }
  return { group, build, setReveal, tipWorld, nozzle };
}

/* =====================================================================
   Golden points stream: shader tube + droplets + nozzle glow + splash
   ===================================================================== */
export function buildStream({ glowTex, droplets = 160 }) {
  const group = new THREE.Group();
  const uniforms = { uTime: { value: 0 }, uReveal: { value: 0 }, uPower: { value: 0 } };
  const vert = 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }';
  const frag = (core) => /* glsl */`
    uniform float uTime; uniform float uReveal; uniform float uPower;
    varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main() {
      float s = vUv.x;
      if (s > uReveal) discard;
      float head = smoothstep(uReveal, uReveal - 0.06, s);
      float flow = 0.55 + 0.45 * sin(s * 46.0 - uTime * 16.0) * sin(s * 13.0 - uTime * 7.0 + 1.3);
      float ndv = abs(dot(normalize(vN), normalize(vV)));
      float body = ${core ? 'pow(ndv, 1.2)' : 'pow(ndv, 0.6) * 0.75 + pow(1.0 - ndv, 3.0) * 0.6'};
      vec3 hot = vec3(1.0, 0.93, 0.62);
      vec3 warm = vec3(1.0, 0.62, 0.08);
      vec3 col = mix(warm, hot, ${core ? '0.75' : 'flow * 0.6'}) * body * (0.6 + flow * 0.7);
      gl_FragColor = vec4(col * uPower * head * ${core ? '2.0' : '1.5'}, 1.0);
    }`;
  const outer = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag(false), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const inner = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag(true), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const tubeA = new THREE.Mesh(new THREE.BufferGeometry(), outer);
  const tubeB = new THREE.Mesh(new THREE.BufferGeometry(), inner);
  tubeA.frustumCulled = tubeB.frustumCulled = false;
  group.add(tubeA, tubeB);

  const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffb53a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  const nozzleGlow = new THREE.Sprite(glowMat);
  const splash = new THREE.Sprite(glowMat.clone());
  group.add(nozzleGlow, splash);

  const N = droplets;
  const pos = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTex, color: 0xffd36b, size: 0.14, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  pts.frustumCulled = false;
  group.add(pts);
  const drops = Array.from({ length: N }, (_, i) => ({ u: i / N, sp: 0.55 + Math.random() * 0.5, off: new THREE.Vector3((Math.random() - 0.5) * 0.16, (Math.random() - 0.5) * 0.16, (Math.random() - 0.5) * 0.16), splash: i < N * 0.2 }));
  const SPL = Math.floor(N * 0.2);

  let curve = null;
  const _p = new THREE.Vector3();
  const _a = new THREE.Vector3();
  const _b = new THREE.Vector3();
  let last = '';
  function setPath(from, dir, to) {
    const key = `${from.x.toFixed(3)},${from.y.toFixed(3)},${from.z.toFixed(3)}|${to.x.toFixed(3)},${to.y.toFixed(3)}`;
    if (key === last) return;
    last = key;
    const span = from.distanceTo(to);
    _a.copy(from).addScaledVector(dir.clone().normalize(), span * 0.42).add(new THREE.Vector3(0, span * 0.32, 0));
    _b.copy(to).add(new THREE.Vector3(-Math.sign(to.x - from.x || 1) * span * 0.18, span * 0.28, 0));
    curve = new THREE.CubicBezierCurve3(from.clone(), _a.clone(), _b.clone(), to.clone());
    tubeA.geometry.dispose(); tubeB.geometry.dispose();
    tubeA.geometry = new THREE.TubeGeometry(curve, 90, 0.13, 14, false);
    tubeB.geometry = new THREE.TubeGeometry(curve, 90, 0.05, 10, false);
    nozzleGlow.position.copy(from);
    splash.position.copy(to);
  }

  /** nozzle: glow build-up 0..1; reveal: stream head 0..1; power: brightness 0..1 */
  function update(t, dt, { nozzle = 1, reveal = 1, power = 1 } = {}) {
    uniforms.uTime.value = t;
    uniforms.uReveal.value = reveal;
    uniforms.uPower.value = power;
    const s = 0.35 + nozzle * 0.55 + Math.sin(t * 9) * 0.04 * nozzle;
    nozzleGlow.scale.setScalar(s);
    nozzleGlow.material.opacity = nozzle * 0.9;
    const hit = reveal > 0.98 ? power : 0;
    splash.scale.setScalar(0.5 + hit * (0.35 + Math.sin(t * 13) * 0.08));
    splash.material.opacity = hit * 0.85;
    pts.material.opacity = power * 0.95;
    if (!curve) return;
    for (let i = 0; i < N; i++) {
      const d = drops[i];
      if (i < SPL) {
        // splash droplets bursting around the inlet
        d.u += dt * (1.6 + d.sp);
        if (d.u > 1) { d.u = 0; d.off.set((Math.random() - 0.5) * 0.4, Math.random() * 0.35, (Math.random() - 0.3) * 0.4); }
        const k = d.u;
        curve.getPoint(1, _p).addScaledVector(d.off, k * 1.4);
        _p.y -= k * k * 0.5;
        if (hit === 0) _p.set(0, -999, 0);
      } else {
        d.u += dt * d.sp * 0.9;
        if (d.u > 1) d.u -= 1;
        if (d.u > reveal) { _p.set(0, -999, 0); } else {
          curve.getPoint(d.u, _p);
          const wob = Math.sin(t * 6 + i) * 0.4 + 0.6;
          _p.addScaledVector(d.off, wob);
        }
      }
      pos[i * 3] = _p.x; pos[i * 3 + 1] = _p.y; pos[i * 3 + 2] = _p.z;
    }
    geo.attributes.position.needsUpdate = true;
  }
  return { group, setPath, update };
}

/* =====================================================================
   Loyalty tank
   ===================================================================== */
function drawCounter(canvas, value, max) {
  const g = canvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);
  const k = canvas.width / 512; // drawn in 512×256 units, rendered at higher resolution
  g.setTransform(k, 0, 0, k, 0, 0);
  const W = 512;
  const H = 256;
  g.fillStyle = 'rgba(10,6,2,0.78)';
  g.beginPath(); g.roundRect(8, 8, W - 16, H - 16, 36); g.fill();
  g.strokeStyle = 'rgba(255,190,80,0.55)'; g.lineWidth = 4; g.stroke();
  g.direction = 'rtl';
  g.textAlign = 'center';
  g.fillStyle = '#f4e6cf';
  g.font = '700 46px Tajawal, sans-serif';
  g.fillText('نقاط الولاء', W / 2, 74);
  const grad = g.createLinearGradient(0, 90, 0, 200);
  grad.addColorStop(0, '#ffe590'); grad.addColorStop(1, '#ff9a12');
  g.fillStyle = grad;
  g.direction = 'ltr';
  g.font = '800 104px Manrope, sans-serif';
  g.fillText(`★ ${Math.round(value).toLocaleString('en-US')}`, W / 2, 180);
  g.fillStyle = 'rgba(244,230,207,0.7)';
  g.font = '600 30px Manrope, sans-serif';
  g.fillText(`/ ${max.toLocaleString('en-US')}  PLATINUM`, W / 2, 228);
}
function drawScale(canvas, max) {
  const g = canvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);
  const k = canvas.width / 160;
  g.setTransform(k, 0, 0, k, 0, 0);
  const W = 160;
  const H = 640;
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const y = H - 8 - (i / steps) * (H - 16);
    const major = i % 4 === 0;
    g.fillStyle = major ? 'rgba(255,240,210,0.95)' : 'rgba(255,240,210,0.55)';
    g.fillRect(6, y - 2, major ? 46 : 26, major ? 5 : 3);
    if (major) {
      g.font = '700 30px Manrope, sans-serif';
      g.textAlign = 'left';
      g.fillText(String((max * i) / steps), 60, y + 10);
    }
  }
}

export function buildTank({ logoTex, glowTex, max = 3000, inletSide = -1 }) {
  const group = new THREE.Group();
  const metal = new THREE.MeshPhysicalMaterial({ color: 0x17130f, metalness: 0.8, roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.15 });
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xd99a2b, metalness: 1, roughness: 0.24 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0x331a00, emissive: new THREE.Color(0xffa21c), emissiveIntensity: 0 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 1.04, 0.34, 96), metal);
  base.position.y = 0.17;
  group.add(base);
  for (const x of [-0.62, 0.62]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.05, 16, 40), new THREE.MeshPhysicalMaterial({ color: 0x0b0b0b, roughness: 0.55, clearcoat: 0.3 }));
    wheel.position.set(x, 0.02, 0.72);
    group.add(wheel);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16), brass);
    hub.rotation.x = Math.PI / 2;
    hub.position.set(x, 0.02, 0.76);
    group.add(hub);
  }
  const lowRing = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.03, 12, 128), lamp);
  lowRing.rotation.x = Math.PI / 2;
  lowRing.position.y = 0.36;
  group.add(lowRing);

  // liquid
  const H = 1.72;
  const liqUniforms = { uTime: { value: 0 }, uScaleY: { value: 0.01 }, uGlow: { value: 1 }, uTilt: { value: 0 } };
  const liqGeo = new THREE.CylinderGeometry(0.76, 0.76, 1, 96, 1);
  liqGeo.translate(0, 0.5, 0);
  const liquid = new THREE.Mesh(liqGeo, new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    uniforms: liqUniforms,
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uScaleY; uniform float uTilt;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        vec3 p = position;
        // gentle waves + stay level with the real world when the phone tilts (uTilt = tan of the angle)
        if (p.y > 0.99) p.y += (sin(p.x * 5.0 + uTime * 2.6) * 0.03 + cos(p.z * 6.0 - uTime * 2.1) * 0.025 + p.x * uTilt) / max(uScaleY, 0.05);
        vUv = uv; vP = p;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform float uScaleY; uniform float uGlow;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        float h = clamp(vP.y, 0.0, 1.0);
        vec3 deep = vec3(0.86, 0.32, 0.0);
        vec3 bright = vec3(1.0, 0.8, 0.22);
        vec3 col = mix(deep, bright, smoothstep(0.0, 1.0, h));
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
        col += f * vec3(1.0, 0.75, 0.3) * 0.7;
        vec2 g = vec2(vUv.x * 40.0, vP.y * uScaleY * 16.0 - uTime * 2.4);
        vec2 id = floor(g); vec2 fr = fract(g) - 0.5;
        float r = hash(id);
        float b = step(0.8, r) * smoothstep(0.2, 0.0, length(fr + vec2(sin(uTime + r * 6.0) * 0.15, 0.0)));
        col += b * vec3(1.0, 0.96, 0.75) * 0.9;
        if (vP.y > 0.99) col = mix(col, vec3(1.0, 0.92, 0.6), 0.45);
        gl_FragColor = vec4(col * uGlow, 0.93);
      }`,
  }));
  liquid.position.y = 0.36;
  group.add(liquid);

  // glass shell (lathe)
  const prof = [[0.0, 0.33], [0.72, 0.33], [0.82, 0.44], [0.82, 2.08], [0.74, 2.24], [0.56, 2.32], [0.0, 2.33]].map(([x, y]) => new THREE.Vector2(x, y));
  const glass = new THREE.Mesh(new THREE.LatheGeometry(prof, 128), new THREE.MeshPhysicalMaterial({ color: 0xfff4e6, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.16, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.2, depthWrite: false, side: THREE.DoubleSide }));
  group.add(glass);
  // bright edge highlights on the glass
  const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.83, 0.83, 1.5, 72, 1, true, -1.15, 0.12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
  hl.position.y = 1.25;
  group.add(hl);

  // top cap + inlet
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.84, 0.32, 96), metal);
  cap.position.y = 2.42;
  group.add(cap);
  const capRing = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.03, 12, 128), lamp);
  capRing.rotation.x = Math.PI / 2;
  capRing.position.y = 2.6;
  group.add(capRing);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.42, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2), metal);
  dome.position.y = 2.58;
  dome.scale.y = 0.45;
  group.add(dome);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.42, 32), brass);
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(0.98 * inletSide, 1.98, 0.05);
  group.add(pipe);
  const mouthRing = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.04, 16, 40), brass);
  mouthRing.rotation.y = Math.PI / 2;
  mouthRing.position.set(1.2 * inletSide, 1.98, 0.05);
  group.add(mouthRing);
  const inlet = new THREE.Object3D();
  inlet.position.set(1.22 * inletSide, 1.98, 0.05);
  group.add(inlet);

  // frame bars + side lamps
  for (const a of [Math.PI * 0.72, -Math.PI * 0.72]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.9, 0.1), metal);
    bar.position.set(Math.sin(a) * 0.86, 1.32, Math.cos(a) * 0.86);
    group.add(bar);
  }
  const lamps = [];
  for (const [x, y] of [[0.9, 2.1], [0.9, 0.62]]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.2), lamp);
    l.position.set(x, y, -0.15);
    group.add(l);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffa21c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    s.position.set(x + 0.08, y, -0.05);
    s.scale.setScalar(0.9);
    group.add(s);
    lamps.push(s);
  }
  const inner = new THREE.PointLight(0xffa21c, 0, 4, 2);
  inner.position.set(0, 1.2, 0.3);
  group.add(inner);

  // counter display + graduated scale (canvas, redrawn on change)
  const cCanvas = document.createElement('canvas');
  cCanvas.width = 1024; cCanvas.height = 512;
  const cTex = new THREE.CanvasTexture(cCanvas);
  cTex.colorSpace = THREE.SRGBColorSpace;
  cTex.anisotropy = 8;
  const display = new THREE.Mesh(new THREE.CylinderGeometry(0.835, 0.835, 0.58, 64, 1, true, -0.62, 1.24), new THREE.MeshBasicMaterial({ map: cTex, transparent: true, depthWrite: false, toneMapped: false }));
  display.position.y = 1.76;
  group.add(display);
  const sCanvas = document.createElement('canvas');
  sCanvas.width = 320; sCanvas.height = 1280;
  const sTex = new THREE.CanvasTexture(sCanvas);
  sTex.colorSpace = THREE.SRGBColorSpace;
  const scale = new THREE.Mesh(new THREE.CylinderGeometry(0.832, 0.832, H, 16, 1, true, 0.72, 0.42), new THREE.MeshBasicMaterial({ map: sTex, transparent: true, depthWrite: false, toneMapped: false }));
  scale.position.y = 0.36 + H / 2;
  group.add(scale);

  // flag with the real logo
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 10), metal);
  pole.position.set(0.12, 3.08, 0);
  group.add(pole);
  const fCanvas = document.createElement('canvas');
  fCanvas.width = 256; fCanvas.height = 160;
  const fTex = new THREE.CanvasTexture(fCanvas);
  fTex.colorSpace = THREE.SRGBColorSpace;
  const flagGeo = new THREE.PlaneGeometry(0.62, 0.38, 14, 6);
  flagGeo.translate(0.31, 0, 0);
  const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ map: fTex, side: THREE.DoubleSide, roughness: 0.7 }));
  flag.position.set(0.14, 3.38, 0);
  group.add(flag);
  const flagBase = flagGeo.attributes.position.array.slice();
  function paintFlag(img) {
    const g = fCanvas.getContext('2d');
    g.fillStyle = '#141010'; g.fillRect(0, 0, 256, 160);
    g.fillStyle = '#ffa21c'; g.fillRect(0, 150, 256, 10);
    if (img) g.drawImage(img, 78, 20, 110, 110);
    fTex.needsUpdate = true;
  }
  paintFlag(null);
  if (logoTex?.image) {
    const img = logoTex.image;
    if (img.complete !== false && img.width) paintFlag(img); else logoTex.onUpdate = () => paintFlag(logoTex.image);
  }
  if (logoTex) {
    const emblem = makeLogoPlane(logoTex, 0.36);
    emblem.position.set(0, 0.18, 1.045);
    group.add(emblem);
  }

  // ---- details: bolts, fresnel glass edge, level LEDs, meniscus, bubbles, glow pool ----
  const boltGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.03, 10);
  for (const [r, y, n] of [[0.93, 0.345, 24], [0.79, 2.265, 20]]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const b = new THREE.Mesh(boltGeo, brass);
      b.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
      group.add(b);
    }
  }
  const rim = new THREE.Mesh(new THREE.LatheGeometry(prof, 128), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    uniforms: { uPower: { value: 0 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform float uPower; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0); gl_FragColor = vec4(vec3(1.0, 0.9, 0.75) * f * (0.55 + uPower * 0.35), 1.0); }',
  }));
  rim.scale.setScalar(1.004);
  group.add(rim);
  const hl2 = new THREE.Mesh(new THREE.CylinderGeometry(0.83, 0.83, 1.2, 64, 1, true, -0.95, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
  hl2.position.y = 1.3;
  group.add(hl2);
  // level LEDs on a slim front-right strip — they light up with the fill
  const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.66, 0.05), metal);
  const ledA = 1.05;
  ledStrip.position.set(Math.sin(ledA) * 0.9, 1.22, Math.cos(ledA) * 0.9);
  ledStrip.rotation.y = ledA;
  group.add(ledStrip);
  const leds = [];
  for (let i = 0; i < 10; i++) {
    const m = new THREE.MeshStandardMaterial({ color: 0x2a1600, emissive: new THREE.Color(0xffb21e), emissiveIntensity: 0 });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), m);
    led.position.set(Math.sin(ledA) * 0.93, 0.47 + i * 0.165, Math.cos(ledA) * 0.93);
    group.add(led);
    leds.push(m);
  }
  const meniscus = new THREE.Mesh(new THREE.TorusGeometry(0.755, 0.016, 10, 128), new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  meniscus.rotation.x = Math.PI / 2;
  group.add(meniscus);
  const BUB = 26;
  const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff1c8, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }), BUB);
  bubbles.frustumCulled = false;
  group.add(bubbles);
  const bub = Array.from({ length: BUB }, () => ({ a: Math.random() * Math.PI * 2, r: Math.random() * 0.62, y: Math.random(), s: 0.012 + Math.random() * 0.03, v: 0.18 + Math.random() * 0.35 }));
  const bubDummy = new THREE.Object3D();
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1.7, 64), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xff9a1c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.006;
  group.add(pool);

  // ---- state ----
  const st = { level: 0, target: 0, value: 0, shownValue: -1, power: 0, max, lastT: 0 };
  const redraw = () => { drawCounter(cCanvas, st.value, max); cTex.needsUpdate = true; };
  drawScale(sCanvas, max); sTex.needsUpdate = true;
  redraw();
  document.fonts?.ready.then(() => { drawScale(sCanvas, max); sTex.needsUpdate = true; redraw(); if (logoTex?.image?.width) paintFlag(logoTex.image); });

  function setValue(v) { st.value = v; st.level = clamp(v / max); }
  function setPower(p) { st.power = p; }
  function setTilt(rad) { liqUniforms.uTilt.value = Math.tan(clamp(rad, -0.6, 0.6)); }
  const _w = new THREE.Vector3();
  function inletWorld(out = _w) { return inlet.getWorldPosition(out); }

  function update(t) {
    liqUniforms.uTime.value = t;
    const lvl = Math.max(0.012, st.level);
    liquid.scale.y = lvl * H;
    liquid.visible = st.level > 0.002;
    liqUniforms.uScaleY.value = lvl * H;
    liqUniforms.uGlow.value = 0.75 + st.power * 0.35;
    lamp.emissiveIntensity = st.power * (2.2 + Math.sin(t * 3) * 0.3);
    lamps.forEach((s, i) => { s.material.opacity = st.power * (0.7 + Math.sin(t * 4 + i) * 0.15); });
    inner.intensity = st.power * 3.5 * (0.6 + st.level);
    if (Math.round(st.value) !== st.shownValue) { st.shownValue = Math.round(st.value); redraw(); }
    const dt = Math.min(0.05, Math.max(0, t - st.lastT));
    st.lastT = t;
    const topY = 0.36 + lvl * H;
    meniscus.position.y = topY + 0.005;
    meniscus.visible = st.level > 0.01;
    meniscus.material.opacity = 0.5 + st.power * 0.45;
    rim.material.uniforms.uPower.value = st.power;
    leds.forEach((m, i) => { m.emissiveIntensity = st.level >= (i + 0.5) / 10 ? 1.6 + st.power * 1.2 : 0.05; });
    pool.material.opacity = st.power * (0.25 + st.level * 0.45);
    for (let i = 0; i < BUB; i++) {
      const b = bub[i];
      b.y += dt * b.v * (0.6 + st.power);
      if (b.y > 1) { b.y = 0; b.a = Math.random() * Math.PI * 2; b.r = Math.random() * 0.62; }
      const y = 0.4 + b.y * Math.max(0, topY - 0.45);
      bubDummy.position.set(Math.sin(b.a + t * 0.3) * b.r, y, Math.cos(b.a + t * 0.3) * b.r);
      bubDummy.scale.setScalar(st.level > 0.03 ? b.s : 0.0001);
      bubDummy.updateMatrix();
      bubbles.setMatrixAt(i, bubDummy.matrix);
    }
    bubbles.instanceMatrix.needsUpdate = true;
    // waving flag
    const arr = flagGeo.attributes.position.array;
    for (let i = 0; i < arr.length; i += 3) {
      const x = flagBase[i];
      arr[i + 2] = Math.sin(x * 9 - t * 4.5) * 0.05 * (x / 0.62);
      arr[i + 1] = flagBase[i + 1] + Math.sin(x * 6 - t * 3) * 0.015 * (x / 0.62);
    }
    flagGeo.attributes.position.needsUpdate = true;
  }

  return { group, setValue, setPower, setTilt, update, inletWorld, state: st };
}

/* =====================================================================
   Counter (wooden prep surface) + embers
   ===================================================================== */
export function buildCounter(width = 7) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, '#6b3f1f'); grd.addColorStop(1, '#3b2010');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 70; i++) {
    g.strokeStyle = `rgba(${20 + Math.random() * 30},${10 + Math.random() * 15},5,${0.15 + Math.random() * 0.25})`;
    g.lineWidth = 1 + Math.random() * 2;
    g.beginPath();
    const y = Math.random() * 128;
    g.moveTo(0, y);
    g.bezierCurveTo(170, y + (Math.random() - 0.5) * 18, 340, y + (Math.random() - 0.5) * 18, 512, y + (Math.random() - 0.5) * 10);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.35 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(width, 0.16, 1.9), mat);
  top.position.y = -0.08;
  const front = new THREE.Mesh(new THREE.BoxGeometry(width, 1.2, 0.1), new THREE.MeshPhysicalMaterial({ color: 0x120c08, roughness: 0.6 }));
  front.position.set(0, -0.76, 0.9);
  const g2 = new THREE.Group();
  g2.add(top, front);
  return g2;
}

export function buildEmbers(glowTex, count = 120, spread = [12, 7, 6]) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * spread[0];
    pos[i * 3 + 1] = (Math.random() - 0.5) * spread[1];
    pos[i * 3 + 2] = (Math.random() - 0.5) * spread[2];
    seeds[i] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTex, color: 0xff9a2a, size: 0.07, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 }));
  pts.frustumCulled = false;
  function update(dt, k = 1) {
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += dt * (0.15 + seeds[i] * 0.35) * k;
      pos[i * 3] += Math.sin(pos[i * 3 + 1] * 2 + seeds[i] * 9) * dt * 0.08;
      if (pos[i * 3 + 1] > spread[1] / 2) pos[i * 3 + 1] = -spread[1] / 2;
    }
    geo.attributes.position.needsUpdate = true;
  }
  return { points: pts, update };
}

export { GOLD };
