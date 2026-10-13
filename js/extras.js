/* =====================================================================
   O2 extras — ideas adopted from the O2 Rewards prototype
   (fayeqabumaraq.github.io/o2), rebuilt for this site:
   daily wheel · visit streak · «شو آكل؟» picker · greeting card ·
   phone-tilt tank · «خزان الخير» donations · detailed menu with
   favourites, cart → WhatsApp order, open/closed status.
   Everything that changes points goes through window.O2 (js/app.js) and is
   front-end only until the loyalty backend is wired — labelled «تجريبي».
   ===================================================================== */
(() => {
  'use strict';
  const O2 = window.O2;
  const MENU = window.O2_MENU;
  if (!O2 || !MENU) return;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const fmt = O2.fmt;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const WHATSAPP = '972597111811';
  // Arabic count agreement: 3–10 → نقاط, otherwise نقطة
  const ptsWord = (n) => (n >= 3 && n <= 10 ? 'نقاط' : 'نقطة'); // the phone listed on the O2 Facebook page (+972 59-711-1811)

  /* ------------------------------------------------------------------
     Menu items (all sections flattened)
     ------------------------------------------------------------------ */
  const HOT = /حار|هالبينو|شطة/;
  const MEAT = /دجاج|سلامي|مرتديلا|تونة|لحم|شاورما/;
  const ITEMS = [];
  for (const [cat, sec] of Object.entries(MENU.sections)) {
    for (const [name, price, ing, img] of sec.items) {
      const tags = [];
      if (HOT.test(name + ' ' + ing)) tags.push(['hot', '🌶️ حار']);
      if (cat === 'italian' && !MEAT.test(name + ' ' + ing)) tags.push(['veg', '🌱 نباتي']);
      ITEMS.push({ id: `${cat}:${name}`, cat, name, price, ing, img, tags, pts: price * MENU.pointsPerShekel });
    }
  }
  const byId = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

  /* ------------------------------------------------------------------
     Favourites + cart state
     ------------------------------------------------------------------ */
  let favs = new Set(store.get('o2-favs', []));
  let cart = store.get('o2-cart', {});
  for (const id of Object.keys(cart)) if (!byId[id]) delete cart[id];
  const saveFavs = () => store.set('o2-favs', [...favs]);
  const saveCart = () => { store.set('o2-cart', cart); syncCartFab(); };
  const cartCount = () => Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = () => Object.entries(cart).reduce((a, [id, q]) => a + byId[id].price * q, 0);
  function addToCart(id, n = 1) {
    cart[id] = Math.max(0, (cart[id] || 0) + n);
    if (!cart[id]) delete cart[id];
    saveCart();
  }

  /* ------------------------------------------------------------------
     Menu panel: hours, favourites filter, item list per category
     ------------------------------------------------------------------ */
  const menuSec = $('#menu');
  const grid = $('#menu-grid');
  const tools = document.createElement('div');
  tools.className = 'menu-tools';
  tools.innerHTML = `
    <p class="hours" id="hours"><i></i><span></span></p>
    <button type="button" class="chip-btn" data-fav-filter aria-pressed="false">♥ المفضلة <span class="lat" data-fav-count>0</span></button>`;
  menuSec.querySelector('._head_11cye_1').appendChild(tools);
  const list = document.createElement('div');
  list.className = 'menu-items';
  list.id = 'menu-items';
  list.setAttribute('aria-live', 'polite');
  grid.after(list);
  let currentCat = $('[data-cat][aria-pressed="true"]')?.dataset.cat || 'salad';
  let favOnly = false;

  function itemCard(it) {
    const fav = favs.has(it.id);
    return `<article class="mi" data-id="${esc(it.id)}">
      ${it.img ? `<div class="mi-img"><img class="fb-dish" src="${it.img}" alt="${esc(it.name)}" loading="lazy" decoding="async"></div>` : ''}
      <div class="mi-body">
        <h4>${esc(it.name)}</h4>
        <p class="mi-ing">${esc(it.ing)}</p>
        ${it.tags.length ? `<p class="mi-tags">${it.tags.map(([k, t]) => `<span class="tag-${k}">${t}</span>`).join('')}</p>` : ''}
      </div>
      <div class="mi-side">
        <b class="mi-price"><span class="lat">${it.price}</span> ₪</b>
        <small>تكسب <span class="lat">${fmt(it.pts)}</span> نقطة</small>
        <div class="mi-actions">
          <button type="button" class="mi-fav" data-fav aria-pressed="${fav}" aria-label="${fav ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}: ${esc(it.name)}">${fav ? '♥' : '♡'}</button>
          <button type="button" class="mi-add" data-add aria-label="أضف ${esc(it.name)} إلى طلبك">+ أضف</button>
        </div>
      </div>
    </article>`;
  }
  function renderItems() {
    $('[data-fav-count]', tools).textContent = favs.size;
    let items;
    let head = '';
    if (favOnly) {
      items = ITEMS.filter((i) => favs.has(i.id));
      head = `<h3 class="mi-head">المفضلة</h3>`;
      if (!items.length) { list.innerHTML = head + '<p class="mi-empty">ما في أصناف بالمفضلة بعد — اضغط ♡ على أي صنف.</p>'; return; }
    } else {
      const sec = MENU.sections[currentCat];
      if (!sec) { list.innerHTML = ''; return; }
      items = ITEMS.filter((i) => i.cat === currentCat);
      head = `<h3 class="mi-head">${esc(sec.label)} <small class="lat">${items.length}</small></h3>${sec.note ? `<p class="mi-note">ملاحظة: ${esc(sec.note)}</p>` : ''}`;
    }
    list.innerHTML = head + `<div class="mi-list">${items.map(itemCard).join('')}</div>`;
  }
  list.addEventListener('click', (e) => {
    const card = e.target.closest('.mi');
    if (!card) return;
    const id = card.dataset.id;
    if (e.target.closest('[data-fav]')) {
      if (favs.has(id)) favs.delete(id); else favs.add(id);
      saveFavs();
      const b = e.target.closest('[data-fav]');
      const on = favs.has(id);
      b.setAttribute('aria-pressed', String(on));
      b.textContent = on ? '♥' : '♡';
      $('[data-fav-count]', tools).textContent = favs.size;
      O2.sound.play('soft');
      if (favOnly && !on) renderItems();
    } else if (e.target.closest('[data-add]')) {
      addToCart(id);
      O2.toast(`أضفنا «${byId[id].name}» لطلبك`);
      O2.sound.play('pop');
    }
  });
  $('[data-fav-filter]', tools).addEventListener('click', (e) => {
    favOnly = !favOnly;
    e.currentTarget.setAttribute('aria-pressed', String(favOnly));
    renderItems();
  });
  $$('[data-cat]').forEach((chip) => chip.addEventListener('click', () => {
    currentCat = chip.dataset.cat;
    favOnly = false;
    $('[data-fav-filter]', tools).setAttribute('aria-pressed', 'false');
    renderItems();
  }));
  renderItems();

  // opening hours
  const mins = (hm) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
  const ampm = (hm) => { const h = Number(hm.split(':')[0]); return `${hm} ${h < 12 ? 'ص' : 'م'}`; };
  function isOpen(now = new Date()) {
    const m = now.getHours() * 60 + now.getMinutes();
    const o = mins(MENU.hours.open);
    const c = mins(MENU.hours.close) || 1440;
    return o < c ? m >= o && m < c : m >= o || m < c;
  }
  function hoursUI() {
    const open = isOpen();
    const el = $('#hours');
    el.className = `hours ${open ? 'is-open' : 'is-closed'}`;
    $('span', el).textContent = open ? `مفتوح الآن · حتى ${ampm(MENU.hours.close)}` : `مغلق الآن · يفتح الساعة ${ampm(MENU.hours.open)}`;
  }
  hoursUI();
  setInterval(hoursUI, 60000);

  /* ------------------------------------------------------------------
     Cart → WhatsApp order
     ------------------------------------------------------------------ */
  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'cart-fab';
  fab.hidden = true;
  fab.innerHTML = '<span aria-hidden="true">🛒</span> طلبك <b class="lat" data-cart-count>0</b>';
  document.body.appendChild(fab);
  function syncCartFab() {
    const n = cartCount();
    fab.hidden = n === 0;
    $('[data-cart-count]', fab).textContent = n;
    fab.setAttribute('aria-label', `سلة الطلب: ${n} صنف`);
  }
  syncCartFab();

  function cartSheet() {
    const rows = Object.entries(cart);
    const total = cartTotal();
    const open = isOpen();
    O2.openSheet(`
      <h2 class="sheet-title" id="sheet-title">طلبك</h2>
      ${rows.length ? `
      <ul class="cart-list">${rows.map(([id, q]) => {
        const it = byId[id];
        return `<li data-id="${esc(id)}"><span class="cl-name">${esc(it.name)}<small class="lat">${it.price} ₪</small></span>
          <span class="qty"><button type="button" data-q="-1" aria-label="إنقاص ${esc(it.name)}">−</button><b class="lat">${q}</b><button type="button" data-q="1" aria-label="زيادة ${esc(it.name)}">+</button></span></li>`;
      }).join('')}</ul>
      <dl class="sheet-rows">
        <div class="is-total"><dt>الإجمالي</dt><dd><span class="lat">${total}</span> ₪</dd></div>
        <div><dt>نقاط ستكسبها</dt><dd><span class="lat">${fmt(total * MENU.pointsPerShekel)}</span> نقطة</dd></div>
      </dl>
      <form class="cart-form" id="cart-form">
        <label>الاسم<input name="name" autocomplete="name" placeholder="اسمك (اختياري)"></label>
        <label>نوع الطلب<select name="type"><option>استلام من الفرع</option><option>توصيل</option><option>داخل المطعم</option></select></label>
        <label>الفرع<select name="branch"><option>فرع غزة — شارع النصر</option><option>فرع النصيرات — غرب دوار أبو صرار</option></select></label>
        <label>العنوان / ملاحظات<textarea name="note" rows="2" placeholder="مثلاً: بدون بصل، أو عنوان التوصيل"></textarea></label>
        ${open ? '' : `<p class="cart-closed">المطعم مغلق الآن — يفتح الساعة ${ampm(MENU.hours.open)}. تقدر ترسل طلبك ويتم تجهيزه عند الافتتاح.</p>`}
        <div class="sheet-actions">
          <button type="submit" class="_btn_geqhq_1 _solid_geqhq_26">أرسل الطلب عبر واتساب</button>
          <button type="button" class="_btn_geqhq_1 _outline_geqhq_38" data-clear>إفراغ السلة</button>
        </div>
        <p class="sheet-note">الطلب يُرسَل كرسالة واتساب إلى رقم المطعم (<span class="lat" dir="ltr">+972 59-711-1811</span>) ليتم تأكيده منهم.</p>
      </form>` : '<p class="mi-empty">سلتك فاضية — أضف أصنافاً من المنيو.</p>'}`);
    const body = $('#sheet-body');
    body.onclick = (e) => {
      const q = e.target.closest('[data-q]');
      if (q) { addToCart(q.closest('li').dataset.id, Number(q.dataset.q)); cartSheet(); return; }
      if (e.target.closest('[data-clear]')) { cart = {}; saveCart(); O2.closeSheet(); }
    };
    const form = $('#cart-form');
    if (form) form.onsubmit = (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const lines = Object.entries(cart).map(([id, q]) => `• ${byId[id].name} × ${q} = ${byId[id].price * q} ₪`);
      const msg = ['طلب جديد من موقع O2', f.get('name') ? `الاسم: ${f.get('name')}` : '', `نوع الطلب: ${f.get('type')}`, `الفرع: ${f.get('branch')}`, f.get('note') ? `ملاحظات: ${f.get('note')}` : '', '------------', ...lines, '------------', `الإجمالي: ${cartTotal()} ₪`].filter(Boolean).join('\n');
      window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
    };
  }
  fab.addEventListener('click', cartSheet);

  /* ------------------------------------------------------------------
     Daily wheel (demo)
     ------------------------------------------------------------------ */
  const WHEEL = [10, 25, 50, 15, 100, 20, 30, 5];
  const wheelDone = () => store.get('o2-wheel') === dayKey();
  function wheelSVG() {
    const n = WHEEL.length;
    const step = 360 / n;
    const R = 96;
    const pt = (deg, r) => { const a = (deg * Math.PI) / 180; return [(100 + r * Math.sin(a)).toFixed(2), (100 - r * Math.cos(a)).toFixed(2)]; };
    let o = '';
    WHEEL.forEach((p, i) => {
      const [x0, y0] = pt(i * step, R);
      const [x1, y1] = pt((i + 1) * step, R);
      const mid = i * step + step / 2;
      o += `<path d="M100 100 L${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1} Z" fill="${i % 2 ? '#1c140b' : '#b0121a'}" stroke="#ffc44f" stroke-width="1"/>`;
      o += `<text x="100" y="36" transform="rotate(${mid} 100 100)" text-anchor="middle" font-size="17" font-weight="800" fill="${p >= 50 ? '#ffd56b' : '#fff'}" font-family="Manrope,sans-serif">${p}</text>`;
      o += `<text x="100" y="47" transform="rotate(${mid} 100 100)" text-anchor="middle" font-size="7" fill="#ffffffcc" font-family="Tajawal,sans-serif">نقطة</text>`;
    });
    o += '<circle cx="100" cy="100" r="97" fill="none" stroke="#ffc44f" stroke-width="3"/><circle cx="100" cy="100" r="16" fill="#0a0705" stroke="#ffc44f" stroke-width="2.5"/><text x="100" y="105" text-anchor="middle" font-size="12" font-weight="800" fill="#e3001b" font-family="Manrope,sans-serif">O2</text>';
    return `<svg viewBox="0 0 200 200" aria-hidden="true">${o}</svg>`;
  }
  let wheelRot = 0;
  function untilTomorrow() {
    const n = new Date();
    const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1) - n;
    const p = (v) => String(Math.floor(v)).padStart(2, '0');
    return `${p(d / 3600000)}:${p((d % 3600000) / 60000)}`;
  }
  function syncWheelCard() {
    const sub = $('[data-wheel-sub]');
    if (sub) sub.textContent = wheelDone() ? `استخدمت لفّتك اليوم · اللفّة الجاية بعد ${untilTomorrow()}` : 'لفّة مجانية كل يوم · اربح نقاط';
  }
  function wheelSheet() {
    const done = wheelDone();
    O2.openSheet(`
      <h2 class="sheet-title" id="sheet-title">عجلة الحظ اليومية 🎡</h2>
      <p class="sheet-sub">لفّة وحدة مجانية كل يوم · النقاط تنضاف لرصيدك <span class="demo-tag">تجريبي</span></p>
      <div class="wheel-stage"><span class="wheel-ptr" aria-hidden="true"></span><div class="wheel" id="wheel" style="transform:rotate(${wheelRot}deg)">${wheelSVG()}</div></div>
      <button type="button" class="_btn_geqhq_1 _solid_geqhq_26 _lg_geqhq_64 wheel-spin" id="wheel-spin" ${done ? 'disabled' : ''}>${done ? `اللفّة الجاية بعد ${untilTomorrow()}` : 'لفّ الآن!'}</button>
      <p class="wheel-res" id="wheel-res" role="status"></p>`);
    $('#wheel-spin').onclick = () => {
      if (wheelDone()) return;
      const btn = $('#wheel-spin');
      btn.disabled = true;
      const idx = Math.floor(Math.random() * WHEEL.length);
      const step = 360 / WHEEL.length;
      // land the chosen segment under the top pointer
      const target = 360 - (idx * step + step / 2);
      wheelRot += 360 * 5 + ((target - (wheelRot % 360)) + 360) % 360;
      const w = $('#wheel');
      w.style.transition = reduce ? 'none' : 'transform 4.2s cubic-bezier(0.17, 0.67, 0.12, 1)';
      w.style.transform = `rotate(${wheelRot}deg)`;
      O2.sound.play('soft');
      setTimeout(() => {
        store.set('o2-wheel', dayKey());
        $('#wheel-res').textContent = `مبروك! ربحت ${WHEEL[idx]} ${ptsWord(WHEEL[idx])} 🎉`;
        btn.textContent = `اللفّة الجاية بعد ${untilTomorrow()}`;
        O2.earn(WHEEL[idx], 'عجلة الحظ اليومية');
        syncWheelCard();
      }, reduce ? 50 : 4300);
    };
  }

  /* ------------------------------------------------------------------
     Visit streak (demo): consecutive days, bonus on day 7
     ------------------------------------------------------------------ */
  (function streak() {
    const today = dayKey();
    const y = new Date(); y.setDate(y.getDate() - 1);
    const st = store.get('o2-streak', { last: null, n: 0, paid: null });
    if (st.last !== today) {
      st.n = st.last === dayKey(y) ? st.n + 1 : 1;
      st.last = today;
      store.set('o2-streak', st);
    }
    const n = st.n;
    const cycle = ((n - 1) % 7) + 1;
    $$('[data-streak]').forEach((el) => { el.textContent = n; });
    const dots = $('[data-streak-dots]');
    if (dots) dots.innerHTML = Array.from({ length: 7 }, (_, i) => `<i class="${i < cycle ? 'on' : ''}"></i>`).join('');
    const sub = $('[data-streak-sub]');
    if (sub) sub.textContent = cycle === 7 ? 'أكملت 7 أيام! 🎁' : `باقي ${7 - cycle} أيام على مكافأة الأسبوع`;
    if (cycle === 7 && st.paid !== today) {
      st.paid = today;
      store.set('o2-streak', st);
      setTimeout(() => O2.earn(70, 'سلسلة 7 أيام متتالية'), 1500);
    }
  })();

  /* ------------------------------------------------------------------
     «شو آكل؟» — swipe picker
     ------------------------------------------------------------------ */
  function pickSheet() {
    const deck = [...ITEMS].sort(() => Math.random() - 0.5);
    let i = 0;
    O2.openSheet(`
      <h2 class="sheet-title" id="sheet-title">شو آكل؟ 🤔</h2>
      <p class="sheet-sub">اسحب لليمين إذا عجبك، ولليسار للتالي</p>
      <div class="pick-stage" id="pick-stage"></div>
      <div class="pick-actions">
        <button type="button" class="pick-btn" data-pick="no" aria-label="التالي">✕</button>
        <button type="button" class="pick-btn is-yes" data-pick="yes" aria-label="بدي هذا — أضفه لطلبي">😋</button>
      </div>`);
    const stage = $('#pick-stage');
    function show() {
      const it = deck[i % deck.length];
      const sec = MENU.sections[it.cat];
      stage.innerHTML = `<article class="pick-card" id="pick-card">
        ${it.img ? `<img class="fb-dish" src="${it.img}" alt="">` : `<span class="pick-emoji" aria-hidden="true">${{ western: '🍔', italian: '🍕', Shawarma: '🌯', Bar: '🍰', Cake: '🎂' }[it.cat] || '🍽️'}</span>`}
        <small>${esc(sec.label)}</small><h3>${esc(it.name)}</h3><p>${esc(it.ing)}</p>
        <b><span class="lat">${it.price}</span> ₪ · تكسب <span class="lat">${fmt(it.pts)}</span> نقطة</b></article>`;
      const card = $('#pick-card');
      let x0 = null;
      let dx = 0;
      card.addEventListener('pointerdown', (e) => { x0 = e.clientX; card.setPointerCapture(e.pointerId); card.style.transition = 'none'; });
      card.addEventListener('pointermove', (e) => { if (x0 === null) return; dx = e.clientX - x0; card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`; });
      card.addEventListener('pointerup', () => {
        card.style.transition = '';
        if (Math.abs(dx) > 90) decide(dx > 0 ? 'yes' : 'no'); else card.style.transform = '';
        x0 = null; dx = 0;
      });
    }
    function decide(v) {
      const it = deck[i % deck.length];
      const card = $('#pick-card');
      if (card) card.style.transform = `translateX(${v === 'yes' ? 420 : -420}px) rotate(${v === 'yes' ? 24 : -24}deg)`;
      if (v === 'yes') { addToCart(it.id); O2.toast(`حلو الاختيار! أضفنا «${it.name}» لطلبك`); O2.sound.play('chime'); }
      i += 1;
      setTimeout(show, reduce ? 0 : 260);
    }
    $('#sheet-body').onclick = (e) => { const b = e.target.closest('[data-pick]'); if (b) decide(b.dataset.pick); };
    show();
  }

  /* ------------------------------------------------------------------
     «ابعت بطاقة» — greeting card for a friend
     ------------------------------------------------------------------ */
  function cardSheet() {
    const presets = ['عزومة على حسابي بـ O2 😄', 'اشتقنالك! تعال نتغدى سوا بـ O2', 'مبروك النجاح 🎓 الحلو علينا', 'كل عام وأنت بخير ✨'];
    O2.openSheet(`
      <h2 class="sheet-title" id="sheet-title">ابعت بطاقة 💌</h2>
      <p class="sheet-sub">اختر كلمة حلوة وابعتها لصاحبك مع دعوة لمطعم <span class="lat">O2</span></p>
      <div class="card-presets">${presets.map((p) => `<button type="button" class="chip-btn" data-preset>${esc(p)}</button>`).join('')}</div>
      <label class="card-field">رسالتك<textarea id="card-msg" rows="2">${esc(presets[0])}</textarea></label>
      <label class="card-field">اسم صاحبك<input id="card-to" placeholder="مثلاً: محمد"></label>
      <div class="greet-card" aria-hidden="true"><img src="assets/logo.png" alt=""><p id="card-preview"></p><small>نَفَسٌ من الهدوء.. ولُقمةٌ من السعادة</small></div>
      <div class="sheet-actions">
        <button type="button" class="_btn_geqhq_1 _solid_geqhq_26" data-send="share">مشاركة</button>
        <a class="_btn_geqhq_1 _outline_geqhq_38" data-send="wa" target="_blank" rel="noopener">واتساب</a>
      </div>`);
    const msg = $('#card-msg');
    const to = $('#card-to');
    const text = () => `${to.value.trim() ? `${to.value.trim()}، ` : ''}${msg.value.trim()}\n— بطاقة من مطعم O2 🍔 ${location.href.split('#')[0]}`;
    const update = () => {
      $('#card-preview').textContent = `${to.value.trim() ? `${to.value.trim()}، ` : ''}${msg.value.trim()}`;
      $('[data-send="wa"]').href = `https://wa.me/?text=${encodeURIComponent(text())}`;
    };
    msg.oninput = update;
    to.oninput = update;
    $('#sheet-body').onclick = async (e) => {
      const p = e.target.closest('[data-preset]');
      if (p) { msg.value = p.textContent; update(); return; }
      if (e.target.closest('[data-send="share"]')) {
        try {
          if (navigator.share) await navigator.share({ text: text() });
          else { await navigator.clipboard.writeText(text()); O2.toast('نسخنا البطاقة — الصقها لصاحبك'); }
        } catch { /* cancelled */ }
      }
    };
    update();
  }

  /* ------------------------------------------------------------------
     Phone tilt → the 3D tank's liquid stays level as the phone tilts
     ------------------------------------------------------------------ */
  const tiltItem = $('[data-tilt-only]');
  const canTilt = typeof DeviceOrientationEvent !== 'undefined' && matchMedia('(pointer: coarse)').matches && !reduce;
  if (tiltItem && canTilt) tiltItem.hidden = false;
  let tiltOn = false;
  function onOrient(e) {
    const angle = (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : 0;
    let g = angle === 90 ? e.beta : angle === 270 ? -e.beta : e.gamma;
    if (g == null) return;
    g = Math.max(-45, Math.min(45, g));
    window.dispatchEvent(new CustomEvent('o2:tilt', { detail: { deg: g } }));
  }
  async function enableTilt() {
    if (tiltOn) return;
    try {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const r = await DeviceOrientationEvent.requestPermission();
        if (r !== 'granted') { O2.toast('ما تم السماح بمستشعر الحركة'); return; }
      }
      window.addEventListener('deviceorientation', onOrient);
      tiltOn = true;
      O2.toast('ميّل موبايلك وشوف خزان النقاط في الأعلى 📱');
      const sub = $('[data-tilt-sub]');
      if (sub) sub.textContent = 'مفعّل — ارجع للأعلى وميّل موبايلك';
    } catch { O2.toast('المستشعر غير متاح على هذا الجهاز'); }
  }

  /* ------------------------------------------------------------------
     «خزان الخير» — donate points toward meals (demo)
     ------------------------------------------------------------------ */
  let giveAmount = 100;
  let given = store.get('o2-given', 0);
  function syncGive() {
    const meals = Math.floor(given / 500);
    const rest = given % 500;
    $$('[data-give-total]').forEach((el) => { el.textContent = fmt(given); });
    $$('[data-give-meals]').forEach((el) => { el.textContent = fmt(meals); });
    const jar = $('[data-give-fill]');
    if (jar) jar.style.setProperty('--fill', `${(rest / 500) * 100}%`);
    $$('[data-give-rest]').forEach((el) => { el.textContent = fmt(500 - rest); });
    $$('[data-give-amount]').forEach((el) => { el.textContent = fmt(giveAmount); });
  }
  $$('[data-give]').forEach((b) => b.addEventListener('click', () => {
    giveAmount = Number(b.dataset.give);
    $$('[data-give]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    syncGive();
  }));
  function donate() {
    if (!O2.spend(giveAmount)) { O2.toast('رصيدك المتاح ما بكفي لهذا التبرّع'); return; }
    const before = Math.floor(given / 500);
    given += giveAmount;
    store.set('o2-given', given);
    syncGive();
    const after = Math.floor(given / 500);
    O2.toast(after > before ? `💛 اكتملت وجبة جديدة بفضل تبرّعك!` : `💛 شكراً! تبرّعت بـ ${fmt(giveAmount)} نقطة`);
    O2.sound.play('chime');
  }
  syncGive();

  /* ------------------------------------------------------------------
     Wire actions
     ------------------------------------------------------------------ */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    switch (t.dataset.action) {
      case 'wheel': wheelSheet(); break;
      case 'pick': pickSheet(); break;
      case 'card': cardSheet(); break;
      case 'tilt': enableTilt(); break;
      case 'donate': donate(); break;
      case 'open-cart': cartSheet(); break;
      default: break;
    }
  });
  syncWheelCard();
  setInterval(syncWheelCard, 60000);
})();
