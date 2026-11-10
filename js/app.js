/* App cliente Zarimport: router, catálogo, carrito, checkout, cuenta. */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const M = n => Store.money(n);
  const view = $('#view');

  /* ---------------- Estado de UI (por navegador) ---------------- */
  const UIKEY = 'zar_ui_v1';
  function loadUI() {
    try { return JSON.parse(localStorage.getItem(UIKEY)) || {}; } catch (e) { return {}; }
  }
  const ui = Object.assign({ cart: [], notifs: [], wallet: [], coupon: null, viewed: [], favs: [], checkin: { last: null, streak: 0 }, wheelDone: false, firstSeen: Date.now() }, loadUI());
  function saveUI() { try { localStorage.setItem(UIKEY, JSON.stringify(ui)); } catch (e) {} updateBadges(); }

  const db = () => Store.db;
  const me = () => db().users.find(u => u.id === db().session) || null;
  const todayStr = () => new Date().toISOString().slice(0, 10);

  /* ---------------- Carrito ---------------- */
  const Cart = {
    lines() {
      return ui.cart.map(l => {
        const p = Store.product(l.id);
        if (!p) return null;
        const unit = Store.unitPrice(p, l.qty);
        return { ...l, p, unit, total: unit * l.qty, pvpTotal: p.price.pvp * l.qty };
      }).filter(Boolean);
    },
    count() { return ui.cart.reduce((s, l) => s + l.qty, 0); },
    subtotal() { return this.lines().reduce((s, l) => s + l.total, 0); },
    savings() { return this.lines().reduce((s, l) => s + (l.pvpTotal - l.total), 0); },
    add(id, qty = 1, tone = null) {
      const p = Store.product(id);
      if (!p) return;
      tone = tone || p.tones[0] || null;
      const l = ui.cart.find(x => x.id === id && x.tone === tone);
      if (l) l.qty += qty; else ui.cart.push({ id, tone, qty, at: Date.now() });
      ui.cartTouched = Date.now();
      saveUI();
      window.Engage && Engage.onAddToCart(p, this);
    },
    set(i, qty) { if (qty <= 0) ui.cart.splice(i, 1); else ui.cart[i].qty = qty; ui.cartTouched = Date.now(); saveUI(); },
    clear() { ui.cart = []; ui.coupon = null; saveUI(); },
    discount(sub) {
      const c = ui.coupon && db().coupons.find(x => x.code === ui.coupon && x.active);
      if (!c || sub < (c.min || 0)) return 0;
      return c.type === 'pct' ? sub * c.value / 100 : Math.min(c.value, sub);
    },
  };

  function freeShipFrom() {
    const u = me();
    const pts = u ? u.points : 0;
    const lv = Store.levelFor(pts).cur.id;
    if (lv === 'vino') return 0;
    if (lv === 'lila') return 25;
    return db().settings.freeShippingFrom;
  }

  /* ---------------- Notificaciones in-app ---------------- */
  function notify(icon, title, body, link) {
    ui.notifs.unshift({ id: Date.now() + Math.random(), icon, title, body, link: link || null, ts: Date.now(), read: false });
    ui.notifs = ui.notifs.slice(0, 40);
    saveUI();
  }

  function updateBadges() {
    const n = Cart.count();
    $$('.b-cart').forEach(bc => { bc.textContent = n || ''; bc.dataset.n = n; });
    const un = ui.notifs.filter(x => !x.read).length;
    const bn = $('#b-notif'); bn.textContent = un || ''; bn.dataset.n = un;
  }

  function fail(ctx, msg) { snack(msg); window.Zari && Zari.onTrouble(ctx); }
  function snack(msg) {
    let s = $('.snack');
    if (!s) { s = document.createElement('div'); s.className = 'snack'; $('#phone').appendChild(s); }
    s.textContent = msg; s.classList.add('show');
    clearTimeout(s._t); s._t = setTimeout(() => s.classList.remove('show'), 2200);
  }

  /* ---------------- Componentes ---------------- */
  function priceBlock(p) {
    const flashU = Store.unitPrice(p, 1);
    const isFlash = p.flash && flashU < p.price.pvp;
    return `<div class="price"><b>${M(flashU)}</b>${isFlash ? `<s>${M(p.price.pvp)}</s>` : ''}</div>
            <span class="tier">x12: ${M(p.price.may)} c/u</span>`;
  }
  function card(p, opts = {}) {
    const tags = [];
    if (p.flash) tags.push(`<span class="hot">-${db().settings.flashDiscountPct}%</span>`);
    if (p.tags.includes('nuevo')) tags.push('<span>Nuevo</span>');
    if (p.tags.includes('top')) tags.push('<span>🔥 Top</span>');
    if (p.video) tags.unshift('<span>▶ Video</span>');
    return `<a class="pcard" href="#/p/${encodeURIComponent(p.id)}">
      <div class="ph"><img loading="lazy" src="${p.img}" alt="${esc(p.name)}"></div>
      <div class="ptag">${tags.slice(0, 2).join('')}</div>
      <div class="info">
        <span class="br">${esc(p.brand)}</span>
        <span class="nm">${esc(p.name)}</span>
        ${priceBlock(p)}
        ${p.stock <= 5 ? `<span class="low">¡Solo quedan ${p.stock}!</span>` : `<span class="sold">${p.sold}+ vendidos</span>`}
      </div>
      ${opts.noAdd ? '' : `<button class="add-mini" data-add="${esc(p.id)}" aria-label="Agregar">+</button>`}
    </a>`;
  }
  function shipBar() {
    const from = freeShipFrom();
    const sub = Cart.subtotal();
    if (!from) return `<div class="ship-bar">🚚 Como <b>Vino VIP</b> tienes <b>envío gratis siempre</b></div>`;
    const left = Math.max(0, from - sub);
    const pct = Math.min(100, sub / from * 100);
    return `<div class="ship-bar">${left > 0 ? `🚚 Te faltan <b>${M(left)}</b> para tu <b>envío GRATIS</b>` : '🎉 ¡Ya tienes <b>envío GRATIS</b> en este pedido!'}
      <div class="prog"><i style="width:${pct}%"></i></div></div>`;
  }
  function backHeader(title, back = 'javascript:history.back()') {
    return `<div class="page-h"><a class="icon-btn" href="${back}" aria-label="Volver"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg></a><h2>${title}</h2></div>`;
  }
  function flashEnds() {
    // La oferta relámpago se renueva cada 3 horas (siempre hay urgencia)
    const blk = 3 * 3600e3;
    return Math.ceil(Date.now() / blk) * blk;
  }
  function timerHTML() { return `<div class="timer" data-timer><span>00</span>:<span>00</span>:<span>00</span></div>`; }
  function tickTimers() {
    const left = Math.max(0, flashEnds() - Date.now());
    const h = String(Math.floor(left / 3600e3)).padStart(2, '0');
    const m = String(Math.floor(left % 3600e3 / 60e3)).padStart(2, '0');
    const s = String(Math.floor(left % 60e3 / 1e3)).padStart(2, '0');
    $$('[data-timer]').forEach(t => { const sp = t.children; sp[0].textContent = h; sp[1].textContent = m; sp[2].textContent = s; });
  }
  setInterval(tickTimers, 1000);

  const active = () => db().products.filter(p => p.active);

  /* ---------------- Vistas ---------------- */
  const V = {};

  V.home = () => {
    const ps = active();
    const flash = ps.filter(p => p.flash);
    const top = [...ps].sort((a, b) => b.sold - a.sold).slice(0, 10);
    const nuevos = ps.filter(p => p.tags.includes('nuevo'));
    const viewed = ui.viewed.map(id => Store.product(id)).filter(Boolean).slice(0, 8);
    const u = me();
    const hi = u ? `Hola, ${esc(u.first)} 💗` : 'La belleza a tu alcance';
    return `
      <form class="search" onsubmit="location.hash='#/buscar/'+encodeURIComponent(this.q.value);return false">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input name="q" placeholder="Busca labiales, brochas, cosmetiqueras…" autocomplete="off">
      </form>
      ${shipBar()}
      <div class="hero">
        <span class="script">${hi}</span>
        <h2>Brillo que enamora</h2>
        <p>Labiales y gloss Novo y Herorange desde ${M(0.90)} c/u por docena.</p>
        <a class="btn sm" href="#/cat/maquillaje">Ver colección</a>
        <img src="img/products/hr692.jpg" alt="">
      </div>
      <div class="section"><div class="cats">
        ${db().categories.map(c => `<a class="cat" href="#/cat/${c.id}"><i>${c.icon}</i>${c.name}</a>`).join('')}
      </div></div>
      <div class="flash">
        <div class="flash-h"><b>⚡ Oferta relámpago</b>${timerHTML()}</div>
        <div class="hscroll">${flash.map(p => card(p)).join('')}</div>
      </div>
      <div class="section"><div class="sec-h"><h3>Lo más vendido</h3><a href="#/categorias">Ver todo</a></div>
        <div class="hscroll">${top.map(p => card(p)).join('')}</div></div>
      <div class="section"><a class="hero" style="display:block;margin:0;background:var(--gris-100);min-height:0" href="#/revendedoras">
        <span class="script">¿Vendes belleza?</span>
        <h2 style="font-size:20px;max-width:100%">Precios de revendedora</h2>
        <p style="max-width:100%;margin:0">Lleva 3 o 6 y paga precio minorista. Lleva 12 y paga precio mayorista. Ahorras hasta 60%.</p>
      </a></div>
      <div class="section"><div class="sec-h"><h3>Recién llegados</h3><a href="#/categorias">Ver todo</a></div>
        <div class="hscroll">${nuevos.map(p => card(p)).join('')}</div></div>
      ${viewed.length ? `<div class="section"><div class="sec-h"><h3>Lo viste hace poco</h3></div><div class="hscroll">${viewed.map(p => card(p)).join('')}</div></div>` : ''}
      <div class="section"><div class="sec-h"><h3>Recomendados para ti</h3></div>
        <div class="grid">${[...ps].sort((a, b) => (a.id > b.id ? 1 : -1)).slice(0, 12).map(p => card(p)).join('')}</div>
        <a class="btn ghost block" style="margin-top:14px" href="#/categorias">Ver los ${ps.length} productos</a>
      </div>`;
  };

  let catState = { cat: 'all', sort: 'pop', brand: 'all' };
  V.cats = (catId) => {
    if (catId) catState.cat = catId;
    const ps = active();
    let list = ps.filter(p => (catState.cat === 'all' || p.cat === catState.cat) && (catState.brand === 'all' || p.brand === catState.brand));
    if (catState.sort === 'pop') list.sort((a, b) => b.sold - a.sold);
    if (catState.sort === 'low') list.sort((a, b) => a.price.pvp - b.price.pvp);
    if (catState.sort === 'high') list.sort((a, b) => b.price.pvp - a.price.pvp);
    if (catState.sort === 'new') list.sort((a, b) => b.tags.includes('nuevo') - a.tags.includes('nuevo'));
    const brands = [...new Set(ps.filter(p => catState.cat === 'all' || p.cat === catState.cat).map(p => p.brand))];
    const c = db().categories.find(x => x.id === catState.cat);
    return `
      <div class="page-h"><h2>${c ? c.icon + ' ' + c.name : 'Catálogo'}</h2></div>
      <div class="pad"><div class="hscroll" style="gap:8px">
        <button class="chip ${catState.cat === 'all' ? 'on' : ''}" data-cat="all">Todo</button>
        ${db().categories.map(x => `<button class="chip ${catState.cat === x.id ? 'on' : ''}" data-cat="${x.id}">${x.icon} ${x.name}</button>`).join('')}
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <select class="chip" style="border:0;flex:1" data-sort>
          ${[['pop', 'Más vendidos'], ['new', 'Novedades'], ['low', 'Menor precio'], ['high', 'Mayor precio']].map(([v, t]) => `<option value="${v}" ${catState.sort === v ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
        <select class="chip" style="border:0;flex:1" data-brand>
          <option value="all">Todas las marcas</option>
          ${brands.map(b => `<option ${catState.brand === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}
        </select>
      </div></div>
      <div class="section" style="margin-top:14px">
        ${list.length ? `<p class="tiny muted" style="margin:0 0 10px">${list.length} productos</p><div class="grid">${list.map(p => card(p)).join('')}</div>`
        : `<div class="empty"><div class="big">💅</div><p><b>¡Muy pronto!</b><br>Estamos preparando esta categoría. Activa las notificaciones y te avisamos apenas llegue.</p><a class="btn soft" href="#/categorias" data-cat="all">Ver todo el catálogo</a></div>`}
      </div>`;
  };

  V.search = (q) => {
    q = decodeURIComponent(q || '').trim();
    const n = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const list = active().filter(p => n(p.name + ' ' + p.brand + ' ' + p.cat + ' ' + p.id).includes(n(q)));
    return `${backHeader(q ? 'Resultados de “' + esc(q) + '”' : 'Resultados')}
      <form class="search" onsubmit="location.hash='#/buscar/'+encodeURIComponent(this.q.value);return false"><input name="q" value="${esc(q)}" autocomplete="off"></form>
      <div class="section" style="margin-top:14px">${list.length ? `<div class="grid">${list.map(p => card(p)).join('')}</div>` : (setTimeout(() => window.Zari && Zari.onTrouble('busqueda'), 1500), `<div class="empty"><div class="big">🔎</div><p>No encontramos "${esc(q)}". Prueba con "labial", "brocha" o "cosmetiquera".</p><a class="btn soft" href="#/ayuda?ctx=busqueda">Pedirle a Zari que lo busque</a></div>`)}</div>`;
  };

  V.deals = () => {
    const ps = active();
    const promos = ps.filter(p => p.promo);
    return `<div class="page-h"><h2>Ofertas</h2></div>
      <div class="flash" style="margin-top:4px"><div class="flash-h"><b>⚡ Relámpago -${db().settings.flashDiscountPct}%</b>${timerHTML()}</div>
        <div class="grid">${ps.filter(p => p.flash).map(p => card(p)).join('')}</div></div>
      <div class="section"><div class="sec-h"><h3>Lleva más, paga menos</h3></div>
        <div class="grid">${promos.map(p => card(p)).join('')}</div></div>
      <div class="section"><div class="sec-h"><h3>Cupones disponibles</h3></div>
        ${db().coupons.filter(c => c.active && (!c.hidden || ui.wallet.includes(c.code))).map(c => `<div class="coupon"><div style="text-align:left"><b>${esc(c.code)}</b><div class="tiny muted">${esc(c.note || '')} · mínimo ${M(c.min || 0)}</div></div><button class="btn sm" data-copy="${esc(c.code)}">Usar</button></div>`).join('')}
      </div>`;
  };

  V.resellers = () => `${backHeader('Revendedoras')}
    <div class="pad">
      <div class="hero" style="margin:0"><span class="script">Emprende con nosotras</span><h2 style="max-width:100%">Gana vendiendo belleza</h2><p style="max-width:100%">Tus precios bajan solos según la cantidad que lleves de cada producto.</p></div>
      <div class="tiers" style="margin-top:16px"><div><small>1 a 2 uds</small><b>P.V.P.</b><small>precio normal</small></div><div class="on"><small>3 a 11 uds</small><b>Minorista</b><small>cuarto o media docena</small></div><div class="on"><small>12+ uds</small><b>Mayorista</b><small>por docena</small></div></div>
      <div class="nudge">Ejemplo: <b>Pestañas Velvet 3D</b> a ${M(3)} c/u. Si llevas 12, pagas <b>${M(0.75)} c/u</b>. Revendiéndolas a ${M(3)}, <b>ganas ${M(27)}</b> por docena.</div>
      <a class="btn block" style="margin-top:16px" href="#/categorias">Empezar a comprar</a>
      ${!me() ? `<a class="btn ghost block" style="margin-top:10px" href="#/registro">Crear cuenta de revendedora</a>` : ''}
    </div>`;

  V.product = (id) => {
    const p = Store.product(decodeURIComponent(id));
    if (!p) return `<div class="empty">Producto no encontrado</div>`;
    ui.viewed = [p.id, ...ui.viewed.filter(x => x !== p.id)].slice(0, 12); saveUI();
    const watching = 6 + (p.sold % 17);
    const related = active().filter(x => x.cat === p.cat && x.id !== p.id).slice(0, 8);
    return `
      <div class="pd-img">
        <div class="pd-track" id="gal">
          <div class="pd-slide"><img src="${p.img}" alt="${esc(p.name)}">${p.video ? '<button class="pd-hint" data-slide="1">▶ Desliza para ver el video</button>' : ''}</div>
          ${p.video ? `<div class="pd-slide pd-vid"><video src="${esc(p.video.src)}" ${p.video.poster ? `poster="${esc(p.video.poster)}"` : ''} muted loop playsinline preload="metadata"></video>
            <span class="pd-ai">${p.video.ai ? '✨ Video ilustrativo generado con IA' : 'Video demostrativo'}${p.video.note ? ' · ' + esc(p.video.note) : ''}</span>
            <button class="pd-sound" aria-label="Activar sonido">🔇</button></div>` : ''}
        </div>
        ${p.video ? '<div class="pd-dots"><button class="on" data-slide="0" aria-label="Foto"></button><button data-slide="1" aria-label="Video">▶</button></div>' : ''}
        <a class="icon-btn pd-back" href="javascript:history.back()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg></a>
      </div>
      <div class="pd-body" data-pd="${esc(p.id)}">
        <span class="live"><i></i>${watching} personas lo están viendo ahora</span>
        <h1>${esc(p.name)}</h1>
        <div class="muted tiny">${esc(p.brand)} · Código ${esc(p.id)} · ⭐ ${p.rating.toFixed(1)} · ${p.sold}+ vendidos</div>
        ${p.flash ? `<div class="flash" style="margin:12px 0 0;padding:10px 12px;display:flex;justify-content:space-between;align-items:center"><b>⚡ -${db().settings.flashDiscountPct}% termina en</b>${timerHTML()}</div>` : ''}
        <div class="tiers" id="tiers">
          <div data-t="1"><small>1 a 2 uds</small><b>${M(Store.unitPrice(p, 1))}</b><small>c/u</small></div>
          <div data-t="3"><small>3 a 11 uds</small><b>${M(p.price.min)}</b><small>c/u</small></div>
          <div data-t="12"><small>12+ uds</small><b>${M(p.price.may)}</b><small>c/u</small></div>
        </div>
        ${p.promo ? `<div class="promo-line">🎁 ${esc(p.promo)}</div>` : ''}
        ${p.tones.length ? `<div style="margin-top:12px"><b class="tiny">Tono / color:</b><div class="tones">${p.tones.map((t, i) => `<button class="${i ? '' : 'on'}" data-tone="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>` : ''}
        <div style="display:flex;align-items:center;gap:12px;margin-top:14px">
          <div class="qty"><button data-q="-1">−</button><span id="pq">1</span><button data-q="1">+</button></div>
          <div><div class="tiny muted">Total</div><b id="ptotal" style="color:var(--vino);font-size:19px">${M(Store.unitPrice(p, 1))}</b></div>
        </div>
        <div class="nudge" id="pnudge"></div>
        ${p.stock <= 5 ? `<p class="low" style="margin:10px 0 0">⏳ ¡Date prisa! Solo quedan ${p.stock} unidades</p>` : ''}
        <div class="nudge" style="background:var(--gris-100)">🚚 Envío con <b>Tramaco</b> o <b>Laar</b> a todo Ecuador · 🏬 o <b>retíralo gratis</b> en cualquier local</div>
      </div>
      ${related.length ? `<div class="section"><div class="sec-h"><h3>Combínalo con</h3></div><div class="hscroll">${related.map(x => card(x)).join('')}</div></div>` : ''}
      <div class="buybar"><a class="icon-btn" href="#/carrito" style="flex:none"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 7h12l-1 13H7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg></a><button class="btn block" id="padd">Agregar al carrito</button></div>`;
  };
  function bindProduct() {
    const box = $('[data-pd]'); if (!box) return;
    const p = Store.product(box.dataset.pd);
    let qty = 1, tone = p.tones[0] || null;
    const upd = () => {
      $('#pq').textContent = qty;
      const u = Store.unitPrice(p, qty);
      $('#ptotal').textContent = M(u * qty);
      $$('#tiers div').forEach(d => d.classList.toggle('on', (qty >= 12 && d.dataset.t === '12') || (qty >= 3 && qty < 12 && d.dataset.t === '3') || (qty < 3 && d.dataset.t === '1')));
      const nx = qty < 3 ? 3 : qty < 12 ? 12 : null;
      const nu = nx && Store.unitPrice(p, nx);
      $('#pnudge').innerHTML = nx ? `💡 Agrega <b>${nx - qty} más</b> y paga <b>${M(nu)} c/u</b>. Ahorras ${M((Store.unitPrice(p, qty) - nu) * nx)}.` : `🎉 ¡Tienes el <b>precio mayorista</b>! Estás ahorrando ${M((p.price.pvp - p.price.may) * qty)}.`;
    };
    box.addEventListener('click', e => {
      const q = e.target.closest('[data-q]');
      if (q) { qty = Math.max(1, qty + +q.dataset.q); upd(); }
      const t = e.target.closest('[data-tone]');
      if (t) { tone = t.dataset.tone; $$('[data-tone]').forEach(b => b.classList.toggle('on', b === t)); }
      const tr = e.target.closest('#tiers [data-t]');
      if (tr) { qty = +tr.dataset.t; upd(); }
    });
    $('#padd').onclick = () => { Cart.add(p.id, qty, tone); snack('Agregado al carrito 💗'); };
    upd();
    bindGallery();
  }
  // Galería deslizable: foto a la izquierda, video demostrativo a la derecha
  function bindGallery() {
    const track = $('#gal'); if (!track) return;
    const vid = $('video', track);
    const dots = $$('.pd-dots button');
    const go = i => track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
    $$('[data-slide]').forEach(b => b.onclick = e => { e.preventDefault(); go(+b.dataset.slide); });
    if (!vid) return;
    const snd = $('.pd-sound');
    snd.onclick = () => { vid.muted = !vid.muted; snd.textContent = vid.muted ? '🔇' : '🔊'; };
    vid.onclick = () => (vid.paused ? vid.play() : vid.pause());
    let t;
    track.addEventListener('scroll', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const i = Math.round(track.scrollLeft / track.clientWidth);
        dots.forEach((d, k) => d.classList.toggle('on', k === i));
        if (i === 1) vid.play().catch(() => {}); else vid.pause();
      }, 80);
    }, { passive: true });
  }

  V.cart = () => {
    const lines = Cart.lines();
    if (!lines.length) return `<div class="page-h"><h2>Mi carrito</h2></div><div class="empty"><div class="big">🛍️</div><p>Tu carrito está vacío.<br>¡Hay ofertas relámpago esperándote!</p><a class="btn" href="#/ofertas">Ver ofertas</a></div>
      <div class="section"><div class="sec-h"><h3>Te puede gustar</h3></div><div class="hscroll">${active().filter(p => p.flash).map(p => card(p)).join('')}</div></div>`;
    const sub = Cart.subtotal();
    const disc = Cart.discount(sub);
    return `<div class="page-h"><h2>Mi carrito</h2><span class="muted tiny" style="margin-left:auto">${Cart.count()} artículos</span></div>
      ${shipBar()}
      <div class="pad cart-cols"><div class="cart-lines">
        ${lines.map((l, i) => {
          const nx = l.qty < 3 ? 3 : l.qty < 12 ? 12 : null;
          return `<div class="line"><img src="${l.p.img}" alt="">
            <div class="l-info"><div class="l-nm">${esc(l.p.name)}</div>
              <div class="tiny muted">${l.tone ? 'Tono ' + esc(l.tone) + ' · ' : ''}${M(l.unit)} c/u</div>
              ${nx ? `<div class="tiny" style="color:var(--vino)">+${nx - l.qty} y pagas ${M(Store.unitPrice(l.p, nx))} c/u</div>` : `<div class="tiny" style="color:var(--ok)">✓ Precio mayorista</div>`}
              <div style="display:flex;align-items:center;justify-content:space-between">
                <div class="qty"><button data-ci="${i}" data-d="-1">−</button><span>${l.qty}</span><button data-ci="${i}" data-d="1">+</button></div>
                <b style="color:var(--vino)">${M(l.total)}</b></div></div></div>`;
        }).join('')}
        </div><div class="cart-side">
        <form class="search" style="margin:16px 0 0" id="cform"><span>🏷️</span><input name="c" placeholder="Código de cupón" value="${esc(ui.coupon || '')}"><button class="btn sm">Aplicar</button></form>
        ${ui.wallet.length ? `<div class="tiny muted" style="margin-top:8px">Tus cupones: ${ui.wallet.map(c => `<button class="chip" data-copy="${esc(c)}" style="height:26px">${esc(c)}</button>`).join(' ')}</div>` : ''}
        <div class="summary">
          <div class="row"><span>Subtotal</span><span>${M(sub)}</span></div>
          ${Cart.savings() > 0.009 ? `<div class="row" style="color:var(--ok)"><span>Ahorro por cantidad y ofertas</span><span>−${M(Cart.savings())}</span></div>` : ''}
          ${disc ? `<div class="row" style="color:var(--ok)"><span>Cupón ${esc(ui.coupon)}</span><span>−${M(disc)}</span></div>` : ''}
          <div class="row"><span>Envío</span><span class="muted">Se calcula al elegir entrega</span></div>
          <div class="row total"><span>Total</span><span>${M(sub - disc)}</span></div>
          <div class="tiny muted">Ganarás ⭐ <b>${Math.floor(sub - disc)}</b> puntos con esta compra</div>
        </div>
        <a class="btn block" style="margin-top:14px" href="#/checkout">Continuar · ${M(sub - disc)}</a>
      </div></div>`;
  };

  /* ---------------- Checkout ---------------- */
  let co = { step: 1, type: 'courier', courier: 'tramaco', zone: 'gye', store: null, pay: 'tarjeta', address: {} };
  V.checkout = () => {
    if (!Cart.count()) { location.hash = '#/carrito'; return ''; }
    if (!me()) { sessionStorage.setItem('zar_after_login', '#/checkout'); location.hash = '#/registro'; return ''; }
    const s = db().settings;
    const sub = Cart.subtotal(), disc = Cart.discount(sub);
    const ship = shippingCost(sub - disc);
    const u = me();
    co.store = co.store || s.stores[0].id;
    const steps = `<div class="steps"><i class="on"></i><i class="${co.step >= 2 ? 'on' : ''}"></i><i class="${co.step >= 3 ? 'on' : ''}"></i></div>`;
    let body = '';
    if (co.step === 1) {
      body = `<h3 style="margin:0 0 10px">¿Cómo quieres recibirlo?</h3>
        <div class="seg"><button class="${co.type === 'courier' ? 'on' : ''}" data-type="courier">🚚 Delivery</button><button class="${co.type === 'pickup' ? 'on' : ''}" data-type="pickup">🏬 Retiro en local</button></div>
        ${co.type === 'courier' ? `
          <div class="field"><label>Ciudad de entrega</label><select data-zone><option value="gye" ${co.zone === 'gye' ? 'selected' : ''}>Guayaquil</option><option value="resto" ${co.zone === 'resto' ? 'selected' : ''}>Otra ciudad del Ecuador</option></select></div>
          ${s.couriers.map(c => { const cost = sub - disc >= freeShipFrom() && freeShipFrom() !== null ? 0 : c[co.zone]; return `<label class="opt ${co.courier === c.id ? 'on' : ''}" data-courier="${c.id}"><span class="ic">📦</span><span class="t"><b>${esc(c.name)}</b><small>Entrega en ${esc(c.days)}</small></span><span class="rt">${cost ? M(cost) : 'GRATIS'}</span></label>`; }).join('')}
          <div class="field"><label>Dirección</label><input id="ad-street" placeholder="Calle principal, número y secundaria" value="${esc(co.address.street || u.address || '')}"></div>
          <div class="row2"><div class="field"><label>Ciudad</label><input id="ad-city" value="${esc(co.address.city || u.city || '')}"></div><div class="field"><label>Referencia</label><input id="ad-ref" placeholder="Casa esquinera…" value="${esc(co.address.ref || '')}"></div></div>
        ` : s.stores.map(st => `<label class="opt ${co.store === st.id ? 'on' : ''}" data-store="${st.id}"><span class="ic">🏬</span><span class="t"><b>${esc(st.name)}</b><small>${esc(st.address)}<br>${esc(st.hours)}</small></span><span class="rt">GRATIS</span></label>`).join('') + `<p class="tiny muted">Te avisamos por notificación y WhatsApp cuando tu pedido esté listo para retirar.</p>`}
        <button class="btn block" data-next="2">Continuar al pago</button>`;
    } else if (co.step === 2) {
      body = `<h3 style="margin:0 0 10px">Método de pago</h3>
        <label class="opt ${co.pay === 'tarjeta' ? 'on' : ''}" data-pay="tarjeta"><span class="ic">💳</span><span class="t"><b>Tarjeta de crédito o débito</b><small>Visa, Mastercard, Diners · pago seguro</small></span></label>
        <label class="opt ${co.pay === 'transferencia' ? 'on' : ''}" data-pay="transferencia"><span class="ic">🏦</span><span class="t"><b>Transferencia bancaria</b><small>Sube tu comprobante y lo validamos</small></span></label>
        ${co.pay === 'tarjeta' ? `
          <div class="nudge" style="margin:4px 0 12px">🔒 <b>Modo prototipo:</b> no se hace ningún cobro y no se guardan los datos. En la app final el pago lo procesa una pasarela certificada (Payphone, Datafast o Kushki).</div>
          <div class="field"><label>Número de tarjeta</label><input id="cc-num" inputmode="numeric" placeholder="•••• •••• •••• ••••" maxlength="19" autocomplete="off"></div>
          <div class="row2"><div class="field"><label>Vence</label><input id="cc-exp" placeholder="MM/AA" maxlength="5" autocomplete="off"></div><div class="field"><label>CVV</label><input id="cc-cvv" placeholder="•••" maxlength="4" inputmode="numeric" autocomplete="off"></div></div>
          <div class="field"><label>Nombre en la tarjeta</label><input id="cc-name" autocomplete="off"></div>` : `
          <div class="summary" style="margin:4px 0 12px;font-size:13px">
            <div class="row"><span>Banco</span><b>${esc(s.bank.bank)}</b></div>
            <div class="row"><span>Cuenta ${esc(s.bank.type)}</span><b>${esc(s.bank.number)}</b></div>
            <div class="row"><span>Titular</span><b style="text-align:right">${esc(s.bank.holder)}</b></div>
            <div class="row"><span>RUC</span><b>${esc(s.bank.ruc)}</b></div>
          </div>
          <div class="field"><label>Comprobante de transferencia (foto o PDF)</label><input type="file" id="tr-file" accept="image/*,.pdf" style="padding-top:11px"></div>
          <p class="tiny muted">Tu pedido se separa por 24 horas mientras validamos el pago.</p>`}
        <div style="display:flex;gap:10px"><button class="btn ghost" data-next="1">Atrás</button><button class="btn block" data-next="3">Revisar pedido</button></div>`;
    } else {
      const st = s.stores.find(x => x.id === co.store);
      const cr = s.couriers.find(x => x.id === co.courier);
      body = `<h3 style="margin:0 0 10px">Confirma tu pedido</h3>
        ${Cart.lines().map(l => `<div class="line" style="padding:8px 0"><img src="${l.p.img}" style="width:52px;height:52px" alt=""><div class="l-info"><div class="l-nm">${esc(l.p.name)}</div><div class="tiny muted">${l.qty} × ${M(l.unit)}${l.tone ? ' · ' + esc(l.tone) : ''}</div></div><b>${M(l.total)}</b></div>`).join('')}
        <div class="summary">
          <div class="row"><span>Entrega</span><b>${co.type === 'pickup' ? 'Retiro · ' + esc(st.name) : esc(cr.name)}</b></div>
          <div class="row"><span>Pago</span><b>${co.pay === 'tarjeta' ? 'Tarjeta' : 'Transferencia'}</b></div>
          <div class="row"><span>Subtotal</span><span>${M(sub)}</span></div>
          ${disc ? `<div class="row" style="color:var(--ok)"><span>Cupón</span><span>−${M(disc)}</span></div>` : ''}
          <div class="row"><span>Envío</span><span>${ship ? M(ship) : 'GRATIS'}</span></div>
          <div class="row total"><span>Total</span><span>${M(sub - disc + ship)}</span></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:14px"><button class="btn ghost" data-next="2">Atrás</button><button class="btn block" id="place">${co.pay === 'tarjeta' ? 'Pagar' : 'Confirmar'} ${M(sub - disc + ship)}</button></div>`;
    }
    return `${backHeader('Finalizar compra', '#/carrito')}<div class="pad">${steps}${body}</div>`;
  };
  function shippingCost(base) {
    if (co.type === 'pickup') return 0;
    const f = freeShipFrom();
    if (f === 0 || base >= f) return 0;
    const c = db().settings.couriers.find(x => x.id === co.courier);
    return c ? c[co.zone] : 0;
  }
  function bindCheckout() {
    const root = view;
    root.onclick = e => {
      const t = e.target.closest('[data-type],[data-courier],[data-store],[data-pay],[data-next],#place');
      if (!t) return;
      saveAddr();
      if (t.dataset.type) co.type = t.dataset.type;
      if (t.dataset.courier) co.courier = t.dataset.courier;
      if (t.dataset.store) co.store = t.dataset.store;
      if (t.dataset.pay) co.pay = t.dataset.pay;
      if (t.dataset.next) {
        const n = +t.dataset.next;
        if (n === 2 && co.type === 'courier' && (!co.address.street || !co.address.city)) { fail('direccion', 'Completa tu dirección y ciudad'); return; }
        if (n === 3 && co.pay === 'tarjeta') {
          const num = ($('#cc-num').value || '').replace(/\D/g, '');
          if (num.length < 13 || !/^\d\d\/\d\d$/.test($('#cc-exp').value) || $('#cc-cvv').value.length < 3 || !$('#cc-name').value.trim()) { fail('pago', 'Revisa los datos de la tarjeta'); return; }
          $('#cc-num').value = ''; $('#cc-cvv').value = ''; // nunca se guardan
        }
        if (n === 3 && co.pay === 'transferencia') {
          if (!$('#tr-file').files.length) { fail('pago', 'Adjunta tu comprobante'); return; }
          co.proof = $('#tr-file').files[0].name; // en producción se sube al servidor
        }
        co.step = n;
      }
      if (t.id === 'place') return placeOrder();
      render();
    };
    const z = $('[data-zone]');
    if (z) z.onchange = () => { saveAddr(); co.zone = z.value; render(); };
  }
  function saveAddr() {
    if ($('#ad-street')) co.address = { street: $('#ad-street').value.trim(), city: $('#ad-city').value.trim(), ref: $('#ad-ref').value.trim() };
  }
  function placeOrder() {
    const s = db().settings, u = me();
    const lines = Cart.lines();
    const sub = Cart.subtotal(), disc = Cart.discount(sub), ship = shippingCost(sub - disc);
    const total = +(sub - disc + ship).toFixed(2);
    const id = 'ZR-' + (10240 + db().orders.length + Math.floor(Math.random() * 90));
    const st = s.stores.find(x => x.id === co.store), cr = s.couriers.find(x => x.id === co.courier);
    const order = {
      id, userId: u.id, user: u.first + ' ' + u.last, phone: u.phone, date: Date.now(),
      items: lines.map(l => ({ id: l.p.id, name: l.p.name, img: l.p.img, tone: l.tone, qty: l.qty, unit: l.unit })),
      subtotal: +sub.toFixed(2), discount: +disc.toFixed(2), coupon: disc ? ui.coupon : null, shipping: ship, total,
      delivery: co.type === 'pickup' ? { type: 'pickup', store: st.name } : { type: 'courier', courier: cr.name, city: co.address.city, address: co.address.street + (co.address.ref ? ' (' + co.address.ref + ')' : '') },
      payment: co.pay, proof: co.pay === 'transferencia' ? co.proof : null, status: co.pay === 'transferencia' ? 'por validar' : 'nuevo',
    };
    db().orders.unshift(order);
    lines.forEach(l => { l.p.stock = Math.max(0, l.p.stock - l.qty); l.p.sold += l.qty; });
    const mult = { rosa: 1, lila: 1.25, vino: 1.5 }[Store.levelFor(u.points).cur.id];
    const earned = Math.floor((sub - disc) * mult);
    u.points += earned;
    if (co.type === 'courier') { u.address = co.address.street; u.city = co.address.city; }
    if (disc && ui.coupon) ui.wallet = ui.wallet.filter(c => c !== ui.coupon);
    Store.commit();
    Cart.clear();
    co.step = 1;
    notify('🧾', '¡Pedido ' + id + ' recibido!', `Total ${M(total)}. Ganaste ${earned} puntos ⭐`, '#/pedido/' + id);
    location.hash = '#/pedido/' + id + '?nuevo=1';
    window.Engage && Engage.onOrderPlaced(order, earned);
  }

  /* ---------------- Pedidos ---------------- */
  const FLOW = { courier: ['nuevo', 'preparando', 'enviado', 'entregado'], pickup: ['nuevo', 'preparando', 'listo', 'entregado'] };
  const LBL = { nuevo: 'Recibido', 'por validar': 'Por validar', preparando: 'Preparando', enviado: 'En camino', listo: 'Listo para retirar', entregado: 'Entregado', cancelado: 'Cancelado' };
  function track(o) {
    const f = FLOW[o.delivery.type];
    const idx = Math.max(0, f.indexOf(o.status === 'por validar' ? 'nuevo' : o.status));
    return `<div class="track">${f.map((s, i) => `<div class="${i <= idx ? 'on' : ''}"><i></i>${LBL[s]}</div>`).join('')}</div>`;
  }
  V.orders = () => {
    const u = me();
    if (!u) { location.hash = '#/login'; return ''; }
    const os = db().orders.filter(o => o.userId === u.id);
    return `${backHeader('Mis pedidos', '#/perfil')}<div class="pad">${os.length ? os.map(o => `<a class="order" style="display:block" href="#/pedido/${o.id}">
      <div class="oh"><b>${o.id}</b><span class="status">${LBL[o.status] || o.status}</span></div>
      <div class="tiny muted">${new Date(o.date).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })} · ${o.items.reduce((s, i) => s + i.qty, 0)} artículos · <b style="color:var(--vino)">${M(o.total)}</b></div>${track(o)}</a>`).join('')
      : `<div class="empty"><div class="big">📦</div><p>Aún no tienes pedidos.</p><a class="btn" href="#/">Ir a comprar</a></div>`}</div>`;
  };
  V.order = (id) => {
    const [oid, qs] = decodeURIComponent(id).split('?');
    const o = db().orders.find(x => x.id === oid);
    if (!o) return '<div class="empty">Pedido no encontrado</div>';
    const fresh = qs && qs.includes('nuevo');
    return `${backHeader('Pedido ' + o.id, '#/pedidos')}<div class="pad">
      ${fresh ? `<div class="hero" style="margin:0 0 14px;text-align:center"><div style="font-size:44px">🎉</div><h2 style="max-width:100%">¡Gracias por tu compra!</h2><p style="max-width:100%;margin:0">${o.payment === 'transferencia' ? 'Validaremos tu transferencia y te avisaremos en minutos.' : 'Tu pago fue aprobado. Ya estamos preparando tu pedido.'}</p></div>` : ''}
      <div class="order"><div class="oh"><span>Estado</span><span class="status">${LBL[o.status] || o.status}</span></div>${track(o)}</div>
      <div class="summary" style="margin-top:0">
        <div class="row"><span>Entrega</span><b style="text-align:right">${o.delivery.type === 'pickup' ? 'Retiro en ' + esc(o.delivery.store) : esc(o.delivery.courier) + '<br><span class="tiny muted">' + esc(o.delivery.address) + ', ' + esc(o.delivery.city) + '</span>'}</b></div>
        <div class="row"><span>Pago</span><b>${o.payment === 'tarjeta' ? 'Tarjeta' : 'Transferencia'}</b></div>
      </div>
      ${o.items.map(i => `<div class="line"><img src="${i.img}" style="width:56px;height:56px" alt=""><div class="l-info"><div class="l-nm">${esc(i.name)}</div><div class="tiny muted">${i.qty} × ${M(i.unit)}${i.tone ? ' · ' + esc(i.tone) : ''}</div></div><b>${M(i.qty * i.unit)}</b></div>`).join('')}
      <div class="summary"><div class="row"><span>Subtotal</span><span>${M(o.subtotal)}</span></div>${o.discount ? `<div class="row"><span>Descuento</span><span>−${M(o.discount)}</span></div>` : ''}<div class="row"><span>Envío</span><span>${o.shipping ? M(o.shipping) : 'GRATIS'}</span></div><div class="row total"><span>Total</span><span>${M(o.total)}</span></div></div>
      <a class="btn soft block" style="margin-top:14px" href="#/ayuda?ctx=pedido">💋 ¿Problemas con tu pedido? Pregúntale a Zari</a>
    </div>`;
  };

  /* ---------------- Cuenta ---------------- */
  const hash = s => { let h = 5381; for (const c of s) h = (h * 33 + c.charCodeAt(0)) >>> 0; return 'h' + h.toString(36); }; // solo prototipo
  const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.9 3.9M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.9 0 3.6-.6 5-1.5"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m3 3 18 18"/></svg>';
  function pwInput(id, ac, ph) {
    return `<div class="pw"><input id="${id}" type="password" autocomplete="${ac}" placeholder="${ph}"><button type="button" class="pw-eye" data-pw="${id}" aria-label="Mostrar contraseña" aria-pressed="false">${EYE}</button></div>`;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-pw]'); if (!b) return;
    const inp = document.getElementById(b.dataset.pw);
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    b.innerHTML = show ? EYE_OFF : EYE;
    b.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
    b.setAttribute('aria-pressed', String(show));
    inp.focus();
  });
  V.login = () => `<div class="auth">
      <div class="logo-big"><div class="w">ZARIMPORT</div><div class="t">LA BELLEZA <em>a tu alcance</em></div></div>
      <div class="field"><label>Celular o correo</label><input id="li-user" autocomplete="username"></div>
      <div class="field"><label for="li-pass">Contraseña</label>${pwInput('li-pass', 'current-password', '')}</div>
      <button class="btn block" id="li-go">Ingresar</button>
      <p class="tiny" style="text-align:center;margin-top:12px"><a href="#/ayuda?ctx=login" style="color:var(--vino)">¿Olvidaste tu contraseña o no puedes entrar?</a></p>
      <p class="tiny muted" style="text-align:center;margin-top:16px">¿No tienes cuenta? <a href="#/registro" style="color:var(--vino);font-weight:600">Regístrate y gana hasta 20% OFF</a></p>
    </div>`;
  let regType = 'personal';
  V.register = () => `<div class="auth" style="padding-top:12px">
      <div class="logo-big" style="margin-bottom:14px"><div class="w" style="font-size:30px">ZARIMPORT</div><div class="t">LA BELLEZA <em>a tu alcance</em></div></div>
      <div class="gift-note">🎁 Al registrarte giras la <b>ruleta de bienvenida</b> y ganas hasta <b>20% OFF</b></div>
      <div class="seg"><button class="${regType === 'personal' ? 'on' : ''}" data-rt="personal">💗 Uso personal</button><button class="${regType === 'revendedora' ? 'on' : ''}" data-rt="revendedora">💼 Revendedora</button></div>
      <div class="row2"><div class="field"><label>Nombre</label><input id="r-first" autocomplete="given-name"></div><div class="field"><label>Apellido</label><input id="r-last" autocomplete="family-name"></div></div>
      <div class="field"><label>Celular</label><input id="r-phone" inputmode="tel" placeholder="09xxxxxxxx" autocomplete="tel"></div>
      <div class="field"><label>Correo</label><input id="r-email" type="email" autocomplete="email"></div>
      <div class="row2"><div class="field"><label>${regType === 'revendedora' ? 'Cédula o RUC' : 'Cédula'}</label><input id="r-id" inputmode="numeric"></div><div class="field"><label>Ciudad</label><input id="r-city" value="Guayaquil"></div></div>
      <div class="field"><label>Fecha de cumpleaños (te regalamos un cupón)</label><input id="r-bday" type="date"></div>
      <div class="field"><label for="r-pass">Contraseña</label>${pwInput('r-pass', 'new-password', 'Mínimo 6 caracteres')}</div>
      <div class="field"><label>¿Te invitó una amiga? (opcional)</label><input id="r-ref" placeholder="Código de referido"></div>
      <label style="display:flex;gap:8px;font-size:12px;color:var(--texto-2);margin:4px 0 14px"><input type="checkbox" id="r-push" checked> Quiero recibir ofertas exclusivas y notificaciones</label>
      <button class="btn block" id="r-go">Crear cuenta y girar la ruleta 🎡</button>
      <p class="tiny muted" style="text-align:center;margin-top:14px">¿Ya tienes cuenta? <a href="#/login" style="color:var(--vino);font-weight:600">Ingresa</a></p>
    </div>`;
  function bindAuth() {
    $$('[data-rt]').forEach(b => b.onclick = () => { regType = b.dataset.rt; render(); });
    const go = $('#r-go');
    if (go) go.onclick = () => {
      const g = id => $('#' + id).value.trim();
      const f = { first: g('r-first'), last: g('r-last'), phone: g('r-phone'), email: g('r-email'), idn: g('r-id'), city: g('r-city'), bday: g('r-bday'), pass: $('#r-pass').value, ref: g('r-ref').toUpperCase() };
      if (!f.first || !f.last) return fail('registro', 'Escribe tu nombre y apellido');
      if (!/^0\d{9}$/.test(f.phone)) return fail('registro', 'Celular inválido (10 dígitos, empieza con 0)');
      if (!/^\S+@\S+\.\S+$/.test(f.email)) return fail('registro', 'Correo inválido');
      if (f.pass.length < 6) return fail('registro', 'La contraseña debe tener mínimo 6 caracteres');
      if (db().users.some(u => u.phone === f.phone || u.email === f.email)) return fail('registro', 'Ya existe una cuenta con ese celular o correo');
      const u = { id: 'u' + Date.now(), first: f.first, last: f.last, phone: f.phone, email: f.email, idn: f.idn, city: f.city, bday: f.bday, type: regType, pass: hash(f.pass), points: 50, refCode: (f.first.slice(0, 4) + Math.floor(Math.random() * 900 + 100)).toUpperCase().replace(/[^A-Z0-9]/g, 'Z'), referredBy: f.ref || null, push: $('#r-push').checked, created: Date.now() };
      const inviter = f.ref && db().users.find(x => x.refCode === f.ref);
      if (inviter) { inviter.points += 300; u.points += 150; }
      db().users.push(u); db().session = u.id; Store.commit();
      notify('💗', '¡Bienvenida a Zarimport, ' + u.first + '!', 'Te regalamos 50 puntos' + (inviter ? ' + 150 por invitación de una amiga' : '') + '.');
      const after = sessionStorage.getItem('zar_after_login'); sessionStorage.removeItem('zar_after_login');
      location.hash = after || '#/';
      window.Engage && Engage.onRegistered(u);
    };
    const li = $('#li-go');
    if (li) li.onclick = () => {
      const v = $('#li-user').value.trim();
      const u = db().users.find(x => (x.phone === v || x.email === v) && x.pass === hash($('#li-pass').value));
      if (!u) return fail('login', 'Celular, correo o contraseña incorrectos');
      db().session = u.id; Store.commit();
      const after = sessionStorage.getItem('zar_after_login'); sessionStorage.removeItem('zar_after_login');
      location.hash = after || '#/perfil';
    };
  }

  V.profile = () => {
    const u = me();
    if (!u) return `<div class="auth"><div class="logo-big"><div class="w">ZARIMPORT</div><div class="t">LA BELLEZA <em>a tu alcance</em></div></div>
      <div class="gift-note">🎁 Crea tu cuenta y gira la ruleta: hasta <b>20% OFF</b> en tu primera compra</div>
      <a class="btn block" href="#/registro">Crear cuenta</a><a class="btn ghost block" style="margin-top:10px" href="#/login">Ya tengo cuenta</a></div>`;
    const { cur, next } = Store.levelFor(u.points);
    const pct = next ? (u.points - cur.from) / (next.from - cur.from) * 100 : 100;
    const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    const doneToday = ui.checkin.last === todayStr();
    const yest = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    const alive = doneToday || ui.checkin.last === yest;
    const filled = !alive ? 0 : doneToday ? ((ui.checkin.streak - 1) % 7) + 1 : ui.checkin.streak % 7;
    const todayIdx = doneToday ? filled - 1 : filled;
    return `<div class="pcard-user">
        <div style="display:flex;justify-content:space-between"><div><h3>${esc(u.first)} ${esc(u.last)}</h3><span class="lvl">Nivel ${cur.name}${u.type === 'revendedora' ? ' · Revendedora' : ''}</span></div><span style="font-size:30px">${cur.id === 'vino' ? '👑' : cur.id === 'lila' ? '💜' : '🌸'}</span></div>
        <div class="pts"><div><div class="tiny" style="opacity:.8">Mis puntos</div><b>${u.points}</b></div><div class="tiny" style="text-align:right;opacity:.9">${next ? `Te faltan ${next.from - u.points} pts<br>para nivel ${next.name}` : '¡Nivel máximo!'}</div></div>
        <div class="prog"><i style="width:${pct}%"></i></div>
        <div class="tiny" style="margin-top:8px;opacity:.85">${esc(cur.perk)}</div>
      </div>
      <div class="section"><div class="sec-h"><h3>Check-in diario</h3><span class="tiny muted">Racha: ${ui.checkin.streak} días</span></div>
        <div class="checkin">${days.map((d, i) => `<div class="${i < filled ? 'done' : ''} ${i === todayIdx ? 'today' : ''}"><b>+${i === 6 ? 50 : 5 + i * 2}</b>${d}</div>`).join('')}</div>
        <button class="btn block ${doneToday ? 'soft' : ''}" style="margin-top:10px" id="checkin" ${doneToday ? 'disabled' : ''}>${doneToday ? '✓ Ya reclamaste hoy, vuelve mañana' : 'Reclamar mis puntos de hoy'}</button>
      </div>
      <div class="section"><div class="sec-h"><h3>Invita y gana</h3></div>
        <div class="coupon"><div style="text-align:left"><b>${esc(u.refCode)}</b><div class="tiny muted">Tu amiga gana 150 pts y tú 300 pts</div></div><button class="btn sm" id="share">Compartir</button></div>
      </div>
      <div class="section menu">
        <a href="#/pedidos"><span class="ic">📦</span>Mis pedidos<span class="ar">›</span></a>
        <a href="#/ayuda"><span class="ic">💋</span>Ayuda con Zari<span class="ar">›</span></a>
        <a href="#/notificaciones"><span class="ic">🔔</span>Notificaciones<span class="ar">›</span></a>
        <a href="#/ofertas"><span class="ic">🏷️</span>Mis cupones (${ui.wallet.length})<span class="ar">›</span></a>
        <a href="#/revendedoras"><span class="ic">💼</span>Programa de revendedoras<span class="ar">›</span></a>
        <button id="pushperm"><span class="ic">📲</span>Activar notificaciones del celular<span class="ar">›</span></button>
        <a target="_blank" href="https://wa.me/${db().settings.whatsapp}"><span class="ic">💬</span>Atención por WhatsApp<span class="ar">›</span></a>
        <button id="logout"><span class="ic">🚪</span>Cerrar sesión</button>
      </div>`;
  };
  function bindProfile() {
    const c = $('#checkin');
    if (c) c.onclick = () => {
      const u = me(); const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      ui.checkin.streak = ui.checkin.last === y ? ui.checkin.streak + 1 : 1;
      ui.checkin.last = todayStr();
      const i = (ui.checkin.streak - 1) % 7; const pts = i === 6 ? 50 : 5 + i * 2;
      u.points += pts; Store.commit(); saveUI();
      window.Engage && Engage.confetti();
      snack(`+${pts} puntos ⭐ ¡Vuelve mañana!`); render();
    };
    const s = $('#share');
    if (s) s.onclick = () => {
      const t = `¡Únete a Zarimport con mi código ${me().refCode} y gana 150 puntos! 💄`;
      if (navigator.share) navigator.share({ text: t }).catch(() => {}); else { navigator.clipboard && navigator.clipboard.writeText(t); snack('Mensaje copiado, ¡pégalo en WhatsApp!'); }
    };
    const lo = $('#logout'); if (lo) lo.onclick = () => { db().session = null; Store.commit(); location.hash = '#/'; };
    const pp = $('#pushperm'); if (pp) pp.onclick = () => window.Engage && Engage.askPushPermission();
  }

  V.notifs = () => {
    const html = `${backHeader('Notificaciones')}<div class="pad">${ui.notifs.length ? ui.notifs.map(n => `<a class="notif ${n.read ? '' : 'unread'}" href="${n.link || 'javascript:void 0'}"><span class="ic">${n.icon}</span><span class="t"><b style="font-size:13.5px">${esc(n.title)}</b><div class="tiny muted">${esc(n.body)}</div><div class="tiny" style="color:var(--gris);margin-top:2px">${ago(n.ts)}</div></span></a>`).join('') : '<div class="empty"><div class="big">🔔</div><p>Aquí verás tus ofertas, cupones y el estado de tus pedidos.</p></div>'}</div>`;
    setTimeout(() => { ui.notifs.forEach(n => n.read = true); saveUI(); }, 800);
    return html;
  };
  function ago(ts) { const m = Math.round((Date.now() - ts) / 60e3); return m < 1 ? 'Ahora' : m < 60 ? `Hace ${m} min` : m < 1440 ? `Hace ${Math.round(m / 60)} h` : new Date(ts).toLocaleDateString('es-EC'); }

  /* ---------------- Router ---------------- */
  // [patrón, vista, pestaña activa, ancho en escritorio]
  const routes = [
    [/^#?\/?$/, () => V.home(), 'home', ''],
    [/^#\/categorias$/, () => V.cats(), 'cats', ''],
    [/^#\/cat\/(.+)$/, m => V.cats(m[1]), 'cats', ''],
    [/^#\/buscar\/(.*)$/, m => V.search(m[1]), 'cats', ''],
    [/^#\/ofertas$/, () => V.deals(), 'deals', ''],
    [/^#\/revendedoras$/, () => V.resellers(), 'home', 'narrow'],
    [/^#\/p\/(.+)$/, m => V.product(m[1]), 'cats', 'product'],
    [/^#\/carrito$/, () => V.cart(), 'cart', 'cart'],
    [/^#\/checkout$/, () => V.checkout(), 'cart', 'narrow'],
    [/^#\/pedidos$/, () => V.orders(), 'me', 'narrow'],
    [/^#\/pedido\/(.+)$/, m => V.order(m[1]), 'me', 'narrow'],
    [/^#\/perfil$/, () => V.profile(), 'me', 'narrow'],
    [/^#\/login$/, () => V.login(), 'me', 'narrow'],
    [/^#\/registro$/, () => V.register(), 'me', 'narrow'],
    [/^#\/notificaciones$/, () => V.notifs(), '', 'narrow'],
    [/^#\/ayuda/, () => (window.Zari ? Zari.view() : ''), '', 'narrow'],
  ];
  // Pie de página: solo se muestra en escritorio
  const FOOT = `<footer class="site-foot">
      <div><div class="f-brand">ZARIMPORT</div><p>La belleza a tu alcance. Maquillaje, skincare y accesorios al por mayor y menor, con envíos a todo Ecuador.</p></div>
      <nav><b>Tienda</b><a href="#/categorias">Catálogo</a><a href="#/ofertas">Ofertas</a><a href="#/revendedoras">Revendedoras</a></nav>
      <nav><b>Mi cuenta</b><a href="#/perfil">Perfil y puntos</a><a href="#/pedidos">Mis pedidos</a><a href="#/carrito">Carrito</a></nav>
      <nav><b>Ayuda</b><a href="#/ayuda">Habla con Zari</a><a href="#/notificaciones">Notificaciones</a></nav>
      <small>© ${new Date().getFullYear()} Zarimport · Zares Beauty · Prototipo de demostración</small>
    </footer>`;
  let lastHash = null;
  function render() {
    const h = location.hash || '#/';
    let tab = '';
    for (const [re, fn, t, w] of routes) {
      const m = h.match(re);
      if (m) {
        const html = fn(m);
        if (location.hash && location.hash !== h) return; // la vista redirigió
        view.innerHTML = '<div class="page">' + html + '</div>' + FOOT; view.dataset.w = w; tab = t; break;
      }
    }
    $$('[data-tab]').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
    if (h !== lastHash) { view.scrollTop = 0; lastHash = h; }
    const dq = $('.desk-search input');
    if (dq && !h.startsWith('#/buscar/') && document.activeElement !== dq) dq.value = '';
    tickTimers(); updateBadges();
    bindProduct(); bindAuth(); bindProfile();
    if (h.startsWith('#/checkout')) bindCheckout(); else view.onclick = null;
    window.Engage && Engage.onView(h);
    window.Zari && Zari.afterRender(h);
  }

  /* Delegación global */
  document.addEventListener('click', e => {
    const add = e.target.closest('[data-add]');
    if (add) { e.preventDefault(); Cart.add(add.dataset.add, 1); snack('Agregado al carrito 💗'); if (location.hash.startsWith('#/carrito')) render(); return; }
    const cat = e.target.closest('[data-cat]');
    if (cat) { e.preventDefault(); catState.cat = cat.dataset.cat; catState.brand = 'all'; if (location.hash === '#/categorias') render(); else location.hash = '#/categorias'; return; }
    const ci = e.target.closest('[data-ci]');
    if (ci) { const i = +ci.dataset.ci; Cart.set(i, ui.cart[i].qty + +ci.dataset.d); render(); return; }
    const cp = e.target.closest('[data-copy]');
    if (cp) { ui.coupon = cp.dataset.copy; saveUI(); snack('Cupón ' + cp.dataset.copy + ' aplicado'); if (location.hash === '#/carrito') render(); else location.hash = '#/carrito'; }
  });
  document.addEventListener('change', e => {
    if (e.target.matches('[data-sort]')) { catState.sort = e.target.value; render(); }
    if (e.target.matches('[data-brand]')) { catState.brand = e.target.value; render(); }
  });
  document.addEventListener('submit', e => {
    if (e.target.id === 'cform') {
      e.preventDefault();
      const code = e.target.c.value.trim().toUpperCase();
      const c = db().coupons.find(x => x.code === code && x.active);
      if (!code) { ui.coupon = null; saveUI(); render(); return; }
      if (!c) return fail('cupon', 'Cupón no válido');
      if (Cart.subtotal() < (c.min || 0)) return fail('cupon', `Este cupón aplica desde ${M(c.min)}`);
      ui.coupon = code; saveUI(); snack('¡Cupón aplicado! 🎉'); render();
    }
  });
  window.addEventListener('hashchange', render);
  window.addEventListener('zar:change', e => { if (e.detail && e.detail.external) render(); });

  /* API para engage.js */
  window.App = { ui, saveUI, Cart, notify, snack, me, render, M, esc, active, freeShipFrom };
  render();
})();
