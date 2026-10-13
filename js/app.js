/* =====================================================================
   O₂ loyalty — interaction layer
   Classic script (works from file:// too). GSAP is optional: when the CDN
   is unreachable every control still works, only the choreography is lost.
   The 3D hero (js/chef-scene.js) talks to this file through window events:
     o2:points        → new balance, the tank animates   (dispatched here)
     o2:intro-done    → the intro has become the hero    (dispatched by chef-scene.js)
   ===================================================================== */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const motionOK = () => !reduceMotion.matches;
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const hasGsap = Boolean(gsap && ScrollTrigger);
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
  };

  /* ------------------------------------------------------------------
     Data — mirrors the member snapshot baked into the export.
     ------------------------------------------------------------------ */
  const member = { points: 1703 };
  // two balances: what you can spend (drops on redemption) and what you've earned in total (sets your tier, never drops)
  let balance = member.points;
  let lifetime = member.points;
  const TIERS = [['Bronze', 0], ['Silver', 500], ['Gold', 1500], ['Platinum', 3000], ['VIP', 5000]];

  const REWARDS = {
    discount: { title: 'خصم 50 ريال', cost: 250 },
    dessert: { title: 'حلوى مجانية', cost: 350 },
    dinner: { title: 'عشاء لشخصين', cost: 1200 },
    vip: { title: 'بطاقة VIP', cost: 2000 },
  };

  const MENU = {
    salad: { label: 'السلطات', count: 8, imgs: ['1.jpeg', '2.jpeg', '3.jpeg', '4.jpeg', '5.jpeg', '6.jpeg', '20.jpeg', '89.jpeg'] },
    italian: { label: 'إيطالي', count: 10, imgs: ['1.jpg'] },
    Shawarma: { label: 'الشاورما', count: 12, imgs: ['13.jpg'] },
    western: { label: 'غربي', count: 8, imgs: ['40.jpg'] },
    drinks: { label: 'المشروبات', count: 19, imgs: ['1.jpg'] },
    Bar: { label: 'البار', count: 21, imgs: ['13.jpg'] },
    sweets: { label: 'الحلويات', count: 25, imgs: ['2.jpg'] },
    Cake: { label: 'الكيك', count: 22, imgs: ['4.jpg'] },
    Gelato: { label: 'الجيلاتو', count: 7, imgs: ['70.jpeg'] },
  };

  const ICON_STAR = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3.5c.9 4.4 2.6 6.1 7 7-4.4.9-6.1 2.6-7 7-.9-4.4-2.6-6.1-7-7 4.4-.9 6.1-2.6 7-7Z"></path></svg>';
  const ICON_LOCK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="5" y="10.5" width="14" height="9.5" rx="2.2"></rect><path d="M8.4 10.5V7.8a3.6 3.6 0 0 1 7.2 0v2.7"></path></svg>';

  /* ------------------------------------------------------------------
     Sound — synthesized, never autoplays, off until the user opts in.
     ------------------------------------------------------------------ */
  const sound = {
    on: store.get('o2-sound') === '1',
    ctx: null,
    play(kind = 'pop') {
      if (!this.on) return;
      try {
        this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
        const c = this.ctx;
        const notes = { pop: [[420, 980, 0.14, 0]], soft: [[360, 540, 0.1, 0]], chime: [[523, 1046, 0.22, 0], [784, 1568, 0.3, 0.09]] }[kind] || [];
        for (const [f0, f1, d, delay] of notes) {
          const t = c.currentTime + delay;
          const o = c.createOscillator();
          const g = c.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(f0, t);
          o.frequency.exponentialRampToValueAtTime(f1, t + d * 0.7);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.11, t + 0.015);
          g.gain.exponentialRampToValueAtTime(0.0001, t + d);
          o.connect(g).connect(c.destination);
          o.start(t);
          o.stop(t + d + 0.03);
        }
      } catch { /* audio unavailable */ }
    },
  };
  const soundBtn = $('[data-action="sound"]');
  const syncSoundBtn = () => {
    soundBtn.setAttribute('aria-pressed', String(sound.on));
    soundBtn.setAttribute('aria-label', sound.on ? 'المؤثرات الصوتية: تعمل' : 'المؤثرات الصوتية: متوقفة');
  };
  soundBtn.addEventListener('click', () => {
    sound.on = !sound.on;
    store.set('o2-sound', sound.on ? '1' : '0');
    syncSoundBtn();
    sound.play('soft');
  });
  syncSoundBtn();

  /* ------------------------------------------------------------------
     Toast
     ------------------------------------------------------------------ */
  const toastEl = $('#toast');
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 4200);
  }

  /* ------------------------------------------------------------------
     Number tween
     ------------------------------------------------------------------ */
  function tweenNumber(el, to, from = 0, dur = 1.4) {
    if (!motionOK()) { el.textContent = fmt(to); return; }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / (dur * 1000));
      const e = 1 - Math.pow(1 - t, 4);
      el.textContent = fmt(from + (to - from) * e);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ------------------------------------------------------------------
     Header: mobile nav, notifications, scroll-spy
     ------------------------------------------------------------------ */
  const menuBtn = $('._menuBtn_c9nak_176');
  const mobileNav = $('#mobile-nav');
  const navBackdrop = $('[data-nav-backdrop]');
  function setNav(open) {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'إغلاق قائمة التنقل' : 'فتح قائمة التنقل');
    mobileNav.hidden = !open;
    navBackdrop.hidden = !open;
    if (open) mobileNav.querySelector('a')?.focus();
  }
  menuBtn.addEventListener('click', () => setNav(mobileNav.hidden));
  navBackdrop.addEventListener('click', () => setNav(false));
  mobileNav.addEventListener('click', (e) => { if (e.target.closest('a')) setNav(false); });

  const bell = $('._bell_c9nak_107');
  const notifPanel = $('#notif-panel');
  const badge = $('._badge_c9nak_123');
  bell.setAttribute('aria-expanded', 'false');
  bell.setAttribute('aria-controls', 'notif-panel');
  function setNotif(open) {
    notifPanel.hidden = !open;
    bell.setAttribute('aria-expanded', String(open));
    if (open) {
      badge.setAttribute('data-zero', '');
      bell.setAttribute('aria-label', 'الإشعارات: لا توجد إشعارات جديدة');
      sound.play('soft');
    }
  }
  bell.addEventListener('click', (e) => { e.stopPropagation(); setNotif(notifPanel.hidden); });
  document.addEventListener('click', (e) => {
    if (!notifPanel.hidden && !notifPanel.contains(e.target)) setNotif(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!mobileNav.hidden) { setNav(false); menuBtn.focus(); }
    if (!notifPanel.hidden) { setNotif(false); bell.focus(); }
  });

  const navLinks = $$('._nav_c9nak_48 a, #mobile-nav a');
  function setActive(id) {
    for (const a of navLinks) {
      const on = a.hash === '#' + id;
      const cls = a.classList.contains('_mobileLink_c9nak_217') ? '_mobileLinkActive_c9nak_230' : '_linkActive_c9nak_79';
      a.classList.toggle(cls, on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    }
  }
  navLinks.forEach((a) => a.addEventListener('click', () => setActive(a.hash.slice(1))));
  const spyIds = ['home', 'orders', 'offers', 'rewards', 'menu', 'loyalty'];
  let spyQueued = false;
  function spy() {
    spyQueued = false;
    const line = innerHeight * 0.4;
    for (const id of spyIds) {
      const r = document.getElementById(id)?.getBoundingClientRect();
      if (r && r.top < line && r.bottom > line) { setActive(id); return; }
    }
  }
  addEventListener('scroll', () => { if (!spyQueued) { spyQueued = true; requestAnimationFrame(spy); } }, { passive: true });

  /* ------------------------------------------------------------------
     Horizontal rails (rewards + menu categories)
     ------------------------------------------------------------------ */
  for (const wrap of $$('._railWrap_1fgjc_5, ._railWrap_1ei5m_5')) {
    const rail = $('.rail', wrap);
    const [prev, next] = $$(':scope > ._arrow_yz4n3_1', wrap);
    const rtl = getComputedStyle(rail).direction === 'rtl';
    const step = () => Math.max(rail.clientWidth * 0.8, 160);
    const update = () => {
      const max = rail.scrollWidth - rail.clientWidth;
      const pos = Math.abs(rail.scrollLeft);
      prev.disabled = pos <= 2;
      next.disabled = pos >= max - 2;
    };
    const go = (dir) => rail.scrollBy({ left: (rtl ? -dir : dir) * step(), behavior: motionOK() ? 'smooth' : 'auto' });
    prev.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));
    rail.addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    update();
  }

  const allBtn = $('[data-action="rewards-all"]');
  const rewardsRail = $('#rewards-rail');
  allBtn.addEventListener('click', () => {
    const grid = rewardsRail.classList.toggle('is-grid');
    allBtn.setAttribute('aria-expanded', String(grid));
    $('[data-label]', allBtn).textContent = grid ? 'عرض أقل' : 'عرض الكل';
    if (grid && hasGsap && motionOK()) gsap.from(rewardsRail.children, { y: 24, opacity: 0, duration: 0.6, ease: 'expo.out', stagger: 0.06 });
  });

  /* ------------------------------------------------------------------
     Offers carousel (manual — no autoplay)
     ------------------------------------------------------------------ */
  const slides = $$('.offer-slide');
  const dots = $$('[data-offer-dot]');
  let slideIdx = 0;
  function goSlide(i) {
    i = (i + slides.length) % slides.length;
    if (i === slideIdx) return;
    const out = slides[slideIdx];
    out.hidden = true;
    out.classList.remove('is-active', 'is-entering');
    const s = slides[i];
    s.hidden = false;
    s.classList.add('is-active');
    if (motionOK()) { s.classList.remove('is-entering'); void s.offsetWidth; s.classList.add('is-entering'); }
    dots.forEach((d, k) => {
      d.classList.toggle('_dotOn_nw7os_70', k === i);
      if (k === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
    });
    slideIdx = i;
    sound.play('soft');
  }
  $('[data-offer="prev"]').addEventListener('click', () => goSlide(slideIdx - 1));
  $('[data-offer="next"]').addEventListener('click', () => goSlide(slideIdx + 1));
  dots.forEach((d) => d.addEventListener('click', () => goSlide(Number(d.dataset.offerDot))));
  const offersView = $('.offers-viewport');
  let swipeX = null;
  offersView.addEventListener('pointerdown', (e) => { swipeX = e.clientX; });
  offersView.addEventListener('pointerup', (e) => {
    if (swipeX === null) return;
    const dx = e.clientX - swipeX;
    swipeX = null;
    if (Math.abs(dx) > 48) goSlide(slideIdx + (dx > 0 ? 1 : -1)); // RTL: dragging right brings the next slide
  });

  /* ------------------------------------------------------------------
     Menu categories
     ------------------------------------------------------------------ */
  const menuGrid = $('#menu-grid');
  const menuMeta = $('#menu-meta');
  const chips = $$('[data-cat]');
  function renderMenu(key) {
    const cat = MENU[key];
    const single = cat.imgs.length === 1;
    menuGrid.classList.toggle('is-feature', single);
    menuGrid.innerHTML = cat.imgs.map((f, i) => single
      ? `<figure class="_item_1ei5m_102 is-feature"><img src="assets/menu/${key}/${f}" alt="${cat.label}" decoding="async"><figcaption>${cat.label}<small><span class="lat">${cat.count}</span> صنف في هذا القسم</small></figcaption></figure>`
      : `<figure class="_item_1ei5m_102"><img src="assets/menu/${key}/${f}" alt="${cat.label} ${i + 1}" loading="lazy" decoding="async"></figure>`).join('');
    menuMeta.innerHTML = `<b>${cat.label}</b> · <span class="lat">${cat.count}</span> صنف`;
  }
  function selectCat(chip) {
    if (chip.getAttribute('aria-pressed') === 'true') return;
    for (const c of chips) {
      const on = c === chip;
      c.setAttribute('aria-pressed', String(on));
      c.classList.toggle('_chipActive_1ei5m_43', on);
    }
    const key = chip.dataset.cat;
    sound.play();
    // swap synchronously (never gated on an animation callback), then let the plates rise in like bubbles
    renderMenu(key);
    if (hasGsap && motionOK()) {
      gsap.from(menuGrid.children, { opacity: 0, y: 34, scale: 0.94, duration: 0.7, ease: 'expo.out', stagger: 0.05, clearProps: 'all' });
    }
  }
  chips.forEach((c) => c.addEventListener('click', () => selectCat(c)));

  /* ------------------------------------------------------------------
     Sheets: order + reward redemption
     ------------------------------------------------------------------ */
  const sheet = $('#sheet');
  const sheetBody = $('#sheet-body');
  function openSheet(markup) {
    sheetBody.innerHTML = markup;
    if (typeof sheet.showModal === 'function') sheet.showModal(); else sheet.setAttribute('open', '');
    sound.play('soft');
  }
  const closeSheet = () => (typeof sheet.close === 'function' ? sheet.close() : sheet.removeAttribute('open'));
  sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });

  function orderSheet(focus) {
    openSheet(`
      <h2 class="sheet-title" id="sheet-title">طلبك التالي</h2>
      <p class="sheet-sub"><span class="lat">ORD-204918</span> · 18 مايو 2024 — 7:45 م</p>
      <ol class="sheet-steps" id="sheet-track" aria-label="مراحل تنفيذ الطلب">
        <li class="is-done">تم الاستلام</li>
        <li class="is-done">قيد التحضير</li>
        <li class="is-now" aria-current="step">جاهز — بانتظار استلامك</li>
        <li>في الطريق</li>
        <li>تم التوصيل</li>
      </ol>
      <ul class="sheet-items lat" id="sheet-items" dir="ltr" aria-label="أصناف الطلب">
        <li><span>Crispy Chicken Combo</span><span>x1</span></li>
        <li><span>Large Fries</span><span>x1</span></li>
        <li><span>Pepsi</span><span>x1</span></li>
      </ul>
      <dl class="sheet-rows"><div class="is-total"><dt>الإجمالي</dt><dd class="lat">$32.50</dd></div></dl>`);
    $(focus === 'items' ? '#sheet-items' : '#sheet-track', sheetBody)?.scrollIntoView({ block: 'nearest' });
  }

  function artFor(key) {
    const src = $(`[data-reward-tile="${key}"] ._frame_11qrh_1`);
    if (!src) return '';
    return src.innerHTML.replace(/(id=")([^"]+)"/g, '$1$2-sheet"').replace(/url\(#([^)]+)\)/g, 'url(#$1-sheet)');
  }

  function rewardSheet(key) {
    const r = REWARDS[key];
    if (!r) return;
    const can = balance >= r.cost;
    const diff = Math.abs(balance - r.cost);
    openSheet(`
      <div class="_frame_11qrh_1 sheet-art" aria-hidden="true">${artFor(key)}</div>
      <h2 class="sheet-title" id="sheet-title">${r.title}</h2>
      <p class="sheet-sub">${can ? 'متاح للاستبدال الآن' : 'تحتاج نقاطاً إضافية لهذه المكافأة'}</p>
      <dl class="sheet-rows">
        <div><dt>تكلفة المكافأة</dt><dd><span class="lat">${fmt(r.cost)}</span> نقطة</dd></div>
        <div><dt>رصيدك الحالي</dt><dd><span class="lat">${fmt(balance)}</span> نقطة</dd></div>
        <div class="is-total"><dt>${can ? 'رصيدك بعد الاستبدال' : 'النقاط المتبقية'}</dt><dd><span class="lat">${fmt(diff)}</span> نقطة</dd></div>
      </dl>
      <p class="sheet-note">الاستبدال يخصم من رصيد نقاطك فقط، ولا يؤثر على مستوى عضويتك <span class="lat">Gold</span>.</p>
      <div class="sheet-actions">
        ${can ? `<button type="button" class="_btn_geqhq_1 _solid_geqhq_26" data-confirm="${key}">تأكيد الاستبدال</button>` : ''}
        <button type="button" class="_btn_geqhq_1 _outline_geqhq_38" data-dismiss>${can ? 'لاحقاً' : 'حسناً'}</button>
      </div>`);
  }

  sheetBody.addEventListener('click', (e) => {
    const confirm = e.target.closest('[data-confirm]');
    if (confirm) { closeSheet(); redeemReward(confirm.dataset.confirm); return; }
    if (e.target.closest('[data-dismiss]')) closeSheet();
  });

  /* Integration point: this export has no backend, so redemption updates the
     on-page balance only. Swap the body for the loyalty API call when wiring it up. */
  function redeemReward(key) {
    const r = REWARDS[key];
    if (!r || balance < r.cost) return;
    const from = balance;
    balance -= r.cost;
    applyPoints(from);
    $(`[data-reward-tile="${key}"]`)?.classList.add('is-redeemed');
    toast(`تم استبدال «${r.title}» — رصيدك الآن ${fmt(balance)} نقطة`);
    sound.play('chime');
  }

  // tier meter position across Bronze → VIP (5 stops at 0/25/50/75/100%)
  function tierPct(l) {
    for (let i = 1; i < TIERS.length; i++) {
      if (l < TIERS[i][1]) return ((i - 1) + (l - TIERS[i - 1][1]) / (TIERS[i][1] - TIERS[i - 1][1])) * 25;
    }
    return 100;
  }
  function applyPoints(fromBalance) {
    $$('[data-stat="points"]').forEach((el) => tweenNumber(el, balance, fromBalance, 1.1));
    $$('[data-stat="lifetime"]').forEach((el) => { el.textContent = fmt(lifetime); });
    const next = TIERS.find(([, at]) => at > lifetime);
    $$('[data-stat="to-next"]').forEach((el) => { el.textContent = next ? fmt(next[1] - lifetime) : '0'; });
    const pct = `${tierPct(lifetime)}%`;
    $$('[data-meter]').forEach((el) => { el.style.width = pct; });
    $$('[data-meter-knob]').forEach((el) => { el.style.left = pct; });
    refreshLocks();
    window.dispatchEvent(new CustomEvent('o2:points', { detail: { value: balance, lifetime } }));
    $$('[data-tank-fallback]').forEach((el) => el.style.setProperty('--fill', `${Math.min(100, (balance / 3000) * 100)}%`));
  }

  /* Points API shared with js/extras.js (wheel, streak, donations).
     Front-end only in this export — replace with loyalty-API calls when wiring the backend. */
  window.O2 = {
    get balance() { return balance; },
    get lifetime() { return lifetime; },
    earn(n, why) {
      const from = balance;
      balance += n;
      lifetime += n;
      applyPoints(from);
      toast(`+${fmt(n)} ${n >= 3 && n <= 10 ? 'نقاط' : 'نقطة'} — ${why}`);
      sound.play('chime');
    },
    spend(n) {
      if (n <= 0 || balance < n) return false;
      const from = balance;
      balance -= n;
      applyPoints(from);
      return true;
    },
    toast: (m) => toast(m),
    sound,
    fmt,
    openSheet: (html) => openSheet(html),
    closeSheet: () => closeSheet(),
  };

  function refreshLocks() {
    for (const [key, r] of Object.entries(REWARDS)) {
      const tile = $(`[data-reward-tile="${key}"]`);
      if (!tile) continue;
      const locked = balance < r.cost;
      tile.classList.toggle('_locked_1fgjc_37', locked);
      const state = $('._state_1fgjc_66', tile);
      state.title = locked ? 'يحتاج نقاطاً إضافية' : 'متاح للاستبدال الآن';
      state.innerHTML = locked ? ICON_LOCK : ICON_STAR;
      $('.tile-hit', tile).setAttribute('aria-label', `${r.title}، ${fmt(r.cost)} نقطة، ${locked ? 'يحتاج نقاطاً إضافية' : 'متاح للاستبدال'}`);
      // progress toward a locked reward
      let meter = $('.rw-meter', tile);
      if (!meter) {
        meter = document.createElement('div');
        meter.className = 'rw-meter';
        meter.innerHTML = '<span class="rw-bar"><i></i></span><small></small>';
        tile.appendChild(meter);
      }
      meter.hidden = !locked;
      if (locked) {
        $('i', meter).style.width = `${Math.min(100, (balance / r.cost) * 100)}%`;
        $('small', meter).textContent = `ناقصك ${fmt(r.cost - balance)} نقطة`;
      }
    }
    // flag the cheapest locked reward as the next goal
    const lockedKeys = Object.entries(REWARDS).filter(([, r]) => balance < r.cost).sort((a, b) => a[1].cost - b[1].cost);
    $$('[data-reward-tile]').forEach((t) => t.classList.toggle('is-next-goal', lockedKeys.length > 0 && t.dataset.rewardTile === lockedKeys[0][0]));
  }
  refreshLocks();

  async function invite() {
    const data = {
      title: '02 Automshen — برنامج الولاء',
      text: 'انضم إلى برنامج الولاء في مطعم 02 Automshen واستمتع بمزايا حصرية.',
      url: location.href.split('#')[0],
    };
    try {
      if (navigator.share) { await navigator.share(data); return; }
      await navigator.clipboard.writeText(data.url);
      toast('تم نسخ رابط الدعوة — شاركه مع أصدقائك');
      sound.play('chime');
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      toast('تعذّرت مشاركة الرابط تلقائياً، انسخه من شريط العنوان');
    }
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    switch (t.dataset.action) {
      case 'order': orderSheet(t.dataset.focus); break;
      case 'redeem': rewardSheet(t.dataset.reward); break;
      case 'invite': invite(); break;
      default: break;
    }
  });

  /* ------------------------------------------------------------------
     Reels (real O2 Facebook videos) — play only on request, one at a time
     ------------------------------------------------------------------ */
  const reels = $$('.reel');
  for (const reel of reels) {
    const video = $('video', reel);
    const play = $('.reel-play', reel);
    play.addEventListener('click', () => {
      for (const other of reels) if (other !== reel) $('video', other).pause();
      video.controls = true;
      video.play().catch(() => { /* playback refused — native controls stay available */ });
      video.focus({ preventScroll: true });
    });
    video.addEventListener('play', () => {
      reel.classList.add('is-playing');
      for (const other of reels) if (other !== reel) $('video', other).pause();
    });
    video.addEventListener('ended', () => { reel.classList.remove('is-playing'); video.controls = false; });
  }

  /* ------------------------------------------------------------------
     Featured dishes jump straight into the matching menu category
     ------------------------------------------------------------------ */
  $$('[data-jump-cat]').forEach((a) => a.addEventListener('click', () => {
    const chip = $(`[data-cat="${a.dataset.jumpCat}"]`);
    if (chip) selectCat(chip);
  }));

  /* ------------------------------------------------------------------
     Choreography (GSAP) — only when motion is welcome
     ------------------------------------------------------------------ */
  function splitWords(el) {
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = '1';
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) continue;
      const frag = document.createDocumentFragment();
      for (const part of node.textContent.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); continue; }
        const s = document.createElement('span');
        s.className = 'split-word';
        s.textContent = part;
        frag.appendChild(s);
      }
      node.replaceWith(frag);
    }
  }

  const accountCounters = $$('#account [data-count]');
  const countAccount = () => accountCounters.forEach((el) => tweenNumber(el, el.dataset.stat === 'points' ? balance : Number(el.dataset.count), 0, 1.8));
  const lightSteps = () => $$('.steps li').forEach((li, i) => setTimeout(() => li.classList.add('is-lit'), motionOK() ? 500 + i * 450 : 0));

  if (hasGsap && motionOK()) {
    root.classList.add('motion-ok');
    $$('[data-split]').forEach(splitWords);

    // the hero copy arrives as the intro's camera makes room for it
    let heroShown = false;
    const revealHero = () => {
      if (heroShown) return;
      heroShown = true;
      gsap.timeline({ defaults: { ease: 'expo.out' } })
        .from('.hero2-hello', { y: 18, opacity: 0, filter: 'blur(8px)', duration: 0.9, clearProps: 'filter' }, 0.15)
        .from('.hero2-title .split-word', { yPercent: 60, opacity: 0, filter: 'blur(14px)', duration: 1.4, stagger: 0.1, ease: 'power4.out', clearProps: 'filter' }, 0.25)
        .from(['.hero2-lede', '.hero2-actions > *'], { y: 22, opacity: 0, filter: 'blur(6px)', duration: 1.1, stagger: 0.1, clearProps: 'filter' }, 0.75)
        .from('.hero2-script', { opacity: 0, scale: 0.6, rotation: -20, duration: 1, ease: 'back.out(2)' }, 0.8);
    };
    if (root.classList.contains('intro-on')) {
      window.addEventListener('o2:intro-done', revealHero, { once: true });
      // if the 3D never starts, the head-script gate drops intro-on; show the copy then too
      const mo = new MutationObserver(() => { if (!root.classList.contains('intro-on')) { mo.disconnect(); revealHero(); } });
      mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    } else {
      revealHero();
    }
    // replaying the intro re-runs the hero entrance at its end
    let introRuns = 0;
    window.addEventListener('o2:intro-done', () => {
      introRuns += 1;
      if (introRuns < 2) return; // first run is handled by revealHero
      gsap.fromTo('.hero2-title .split-word', { yPercent: 80, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1, stagger: 0.08, ease: 'expo.out', overwrite: true });
    });

    // section reveals
    const revealTargets = ['.featured-intro', '.feat-hero', '.feat-tiles li', '.reels-head', '.reel', '.howto-card', '.howto-steps', '#orders', '._card_xngek_1', '#offers', '#rewards', '#menu', '#loyalty', '.brand-copy', '.brand-photo'];
    gsap.set(revealTargets, { opacity: 0, y: 46 });
    ScrollTrigger.batch(revealTargets, {
      start: 'top 90%',
      once: true,
      onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.12, overwrite: true }),
    });
    // safety net: if animation frames are throttled (background tab, power saver), never leave content hidden
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') return;
      setTimeout(() => {
        for (const el of $$(revealTargets.join(','))) {
          if (el.getBoundingClientRect().top < innerHeight && Number(getComputedStyle(el).opacity) < 0.05) gsap.to(el, { opacity: 1, y: 0, duration: 0.6 });
        }
      }, 1500);
    });

    // membership card: meter fills and stats count as it arrives
    ScrollTrigger.create({
      trigger: '#account', start: 'top 80%', once: true,
      onEnter() {
        // the progress line is filled by the kid's stream (js/chef-scene.js → bootHowto)
        countAccount();
      },
    });
    ScrollTrigger.create({ trigger: '.steps', start: 'top 80%', once: true, onEnter: lightSteps });

    // loyalty journey: medals pop in sequence, current tier gets a pulse of light
    ScrollTrigger.create({
      trigger: '#loyalty', start: 'top 75%', once: true,
      onEnter() {
        gsap.from('#loyalty ._step_1srpj_22', { scale: 0.6, opacity: 0, duration: 0.9, ease: 'back.out(1.8)', stagger: 0.12, delay: 0.25 });
        gsap.fromTo('#loyalty ._stepNow_1srpj_60 ._crest_1srpj_53', { filter: 'brightness(1)' }, { filter: 'brightness(1.5)', duration: 0.6, yoyo: true, repeat: 3, delay: 1, ease: 'sine.inOut' });
      },
    });

    // magnetic CTAs + tilt (fine pointers only)
    if (finePointer.matches) {
      for (const el of $$('.magnetic')) {
        const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
        const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });
        el.addEventListener('pointermove', (e) => {
          const r = el.getBoundingClientRect();
          xTo((e.clientX - r.left - r.width / 2) * 0.22);
          yTo((e.clientY - r.top - r.height / 2) * 0.32);
        });
        el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
      }
      for (const el of $$('.tilt')) {
        const strength = el.id === 'account' ? 5 : 9;
        const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3' });
        const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3' });
        const ty = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
        gsap.set(el, { transformPerspective: 900 });
        el.addEventListener('pointermove', (e) => {
          const r = el.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width;
          const py = (e.clientY - r.top) / r.height;
          ry((px - 0.5) * strength);
          rx((0.5 - py) * strength);
          ty(-3);
          el.style.setProperty('--mx', `${px * 100}%`);
          el.style.setProperty('--my', `${py * 100}%`);
        });
        el.addEventListener('pointerleave', () => { rx(0); ry(0); ty(0); });
      }

      // bubble cursor
      const cursor = $('.cursor-bubble');
      const cx = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3' });
      const cy = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3' });
      addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        root.classList.add('cursor-on');
        cx(e.clientX);
        cy(e.clientY);
        cursor.classList.toggle('is-hot', Boolean(e.target.closest('a, button, [role="button"]')));
      }, { passive: true });
      document.addEventListener('pointerleave', () => root.classList.remove('cursor-on'));
    }

    window.addEventListener('load', () => ScrollTrigger.refresh());
  } else {
    // no GSAP or reduced motion: everything is simply present
    lightSteps();
    accountCounters.forEach((el) => { el.textContent = fmt(el.dataset.stat === 'points' ? balance : Number(el.dataset.count)); });
  }

  window.addEventListener('o2:intro-done', () => { if (hasGsap) ScrollTrigger.refresh(); });
})();
