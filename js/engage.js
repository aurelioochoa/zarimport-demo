/* Motor de pop-ups y notificaciones persuasivas (estilo Temu, pero con buen gusto).

   Reglas para que insista sin volverse insoportable:
   - Nunca hay dos ventanas a la vez y nunca salen durante el pago ni el registro.
   - Entre una ventana grande y la siguiente pasan al menos 75 segundos (MODAL_GAP).
   - Máximo 7 ventanas grandes por sesión.
   - Los avisos pequeños de "alguien acaba de comprar" salen cada 30 a 50 segundos.
   - Las push reales se mandan en horarios de adulto activo en Ecuador (ver admin).
*/
(function () {
  const A = window.App; if (!A) return;
  const $ = s => document.querySelector(s);
  const layer = $('#layer');
  const db = () => Store.db;
  const { esc, M } = A;

  const MODAL_GAP = 75e3, MAX_MODALS = 7;
  const S = { modalOpen: false, lastModal: 0, count: 0, route: '#/', lastAct: Date.now(), shown: new Set(), toastBusy: false };
  try { const s = JSON.parse(sessionStorage.getItem('zar_eng') || '{}'); S.count = s.count || 0; (s.shown || []).forEach(x => S.shown.add(x)); } catch (e) {}
  const persist = () => { try { sessionStorage.setItem('zar_eng', JSON.stringify({ count: S.count, shown: [...S.shown] })); } catch (e) {} };

  const quiet = () => /^#\/(checkout|registro|login|ayuda)/.test(S.route);
  const canModal = (force) => !S.modalOpen && (force || (!quiet() && Date.now() - S.lastModal > MODAL_GAP && S.count < MAX_MODALS));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  /* ---------- Primitivas ---------- */
  function modal(html, { sheet = false, onClose, key, force } = {}) {
    if (!canModal(force)) return null;
    S.modalOpen = true; S.lastModal = Date.now(); S.count++; if (key) S.shown.add(key); persist();
    const sc = document.createElement('div');
    sc.className = 'scrim' + (sheet ? ' sheet' : '');
    sc.innerHTML = `<div class="modal" role="dialog"><button class="close" aria-label="Cerrar">×</button>${html}</div>`;
    layer.appendChild(sc);
    requestAnimationFrame(() => sc.classList.add('show'));
    const close = () => { sc.classList.remove('show'); setTimeout(() => sc.remove(), 300); S.modalOpen = false; S.lastModal = Date.now(); onClose && onClose(); };
    sc.addEventListener('click', e => { if (e.target === sc || e.target.closest('.close,[data-close]')) close(); });
    sc.close = close;
    S.current = sc;
    return sc;
  }

  function toast(img, html, link) {
    if (S.toastBusy || S.modalOpen) return;
    S.toastBusy = true;
    const t = document.createElement('a');
    t.className = 'toast'; if (link) t.href = link;
    t.innerHTML = `${img ? `<img src="${img}" alt="">` : ''}<div class="tx">${html}</div><button class="x" aria-label="Cerrar">×</button>`;
    layer.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
    const kill = () => { t.classList.remove('show'); setTimeout(() => { t.remove(); S.toastBusy = false; }, 450); };
    t.querySelector('.x').onclick = e => { e.preventDefault(); kill(); };
    t.addEventListener('click', () => setTimeout(kill, 50));
    setTimeout(kill, 4800);
  }

  // Simula una push del sistema dentro del teléfono + push real si hay permiso
  function push(title, body, link) {
    A.notify('🔔', title, body, link);
    try {
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification(title, { body, icon: 'assets/brand/icon.svg' });
    } catch (e) {}
    const p = document.createElement('a');
    p.className = 'push'; if (link) p.href = link;
    p.innerHTML = `<span class="ap">Z</span><div class="tx"><div class="hd"><span>ZARIMPORT</span><span>ahora</span></div><b>${esc(title)}</b><div>${esc(body)}</div></div>`;
    layer.appendChild(p);
    requestAnimationFrame(() => requestAnimationFrame(() => p.classList.add('show')));
    const kill = () => { p.classList.remove('show'); setTimeout(() => p.remove(), 500); };
    p.addEventListener('click', kill);
    setTimeout(kill, 5200);
  }

  function confetti() {
    const c = document.createElement('div'); c.className = 'confetti';
    const cols = ['#931B4A', '#F3DDEC', '#C25A85', '#8F9396', '#EBCDE2', '#fff'];
    for (let i = 0; i < 70; i++) {
      const s = document.createElement('i');
      s.style.left = Math.random() * 100 + '%'; s.style.background = pick(cols);
      s.style.animationDelay = Math.random() * .5 + 's'; s.style.animationDuration = rand(1.4, 2.4) + 's';
      c.appendChild(s);
    }
    $('#phone').appendChild(c); setTimeout(() => c.remove(), 3000);
  }

  function giveCoupon(code) {
    if (!A.ui.wallet.includes(code)) A.ui.wallet.push(code);
    A.ui.coupon = code; A.saveUI();
  }

  /* ---------- Pop-ups concretos ---------- */
  const products = () => A.active();

  function welcomeGift() {
    if (A.me() || S.shown.has('welcome')) return;
    const ps = products().filter(p => p.tags.includes('top')).slice(0, 3);
    modal(`<div class="emoji">🎁</div><h3>¡Tienes un regalo esperándote!</h3>
      <p>Crea tu cuenta en 30 segundos y gira la <b>ruleta de bienvenida</b>. Ganas hasta <b>20% OFF</b> en tu primera compra.</p>
      <div class="mini-grid">${ps.map(p => `<img src="${p.img}" alt="">`).join('')}</div>
      <a class="btn block" href="#/registro" data-close>Quiero mi regalo</a>
      <button class="later" data-close>Ahora no, prefiero pagar precio completo</button>`, { key: 'welcome' });
  }

  // Todos los premios son reales; el peso (w) define qué tan seguido sale cada uno.
  const PRIZES = [
    { label: '10%', code: 'RULETA10', w: 16, color: '#F3DDEC' },
    { label: '15%', code: 'RULETA15', w: 18, color: '#931B4A' },
    { label: '12%', code: 'RULETA12', w: 10, color: '#F3DDEC' },
    { label: '20%', code: 'RULETA20', w: 6, color: '#931B4A' },
    { label: '10%', code: 'RULETA10', w: 16, color: '#F3DDEC' },
    { label: '15%', code: 'RULETA15', w: 18, color: '#931B4A' },
    { label: '12%', code: 'RULETA12', w: 10, color: '#F3DDEC' },
    { label: '20%', code: 'RULETA20', w: 6, color: '#931B4A' },
  ];
  function wheel() {
    if (A.ui.wheelDone) return;
    const n = PRIZES.length, seg = 360 / n;
    const pt = (deg, r) => { const a = deg * Math.PI / 180; return [(Math.sin(a) * r).toFixed(2), (-Math.cos(a) * r).toFixed(2)]; };
    const wedges = PRIZES.map((p, i) => {
      const [x0, y0] = pt(i * seg, 100), [x1, y1] = pt((i + 1) * seg, 100), mid = i * seg + seg / 2, [tx, ty] = pt(mid, 68);
      const fg = p.color === '#931B4A' ? '#fff' : '#931B4A';
      return `<path d="M0 0L${x0} ${y0}A100 100 0 0 1 ${x1} ${y1}Z" fill="${p.color}"/><text x="${tx}" y="${ty}" fill="${fg}" font-size="17" font-weight="700" font-family="Poppins,sans-serif" text-anchor="middle" dominant-baseline="central" transform="rotate(${mid} ${tx} ${ty})">${p.label}</text>`;
    }).join('');
    const m = modal(`<h3>Ruleta de bienvenida</h3><p>Un solo giro. ¡Mucha suerte!</p>
      <div class="wheel-wrap"><div class="wheel-pin"></div><svg class="wheel" id="wh" viewBox="-100 -100 200 200">${wedges}</svg><div class="wheel-hub">Z</div></div>
      <button class="btn block" id="spin">¡Girar ahora!</button>`, { force: true, key: 'wheel' });
    if (!m) return;
    m.querySelector('#spin').onclick = function () {
      this.disabled = true;
      const total = PRIZES.reduce((s, p) => s + p.w, 0);
      let r = Math.random() * total, idx = 0;
      for (let i = 0; i < n; i++) { r -= PRIZES[i].w; if (r <= 0) { idx = i; break; } }
      const target = 360 * 6 + (360 - (idx * seg + seg / 2)) + rand(-seg / 3, seg / 3);
      m.querySelector('#wh').style.transform = `rotate(${target}deg)`;
      setTimeout(() => {
        const pr = PRIZES[idx];
        A.ui.wheelDone = true; giveCoupon(pr.code);
        confetti();
        const c = db().coupons.find(x => x.code === pr.code);
        m.querySelector('.modal').innerHTML = `<button class="close" aria-label="Cerrar">×</button><div class="emoji">🎉</div><h3>¡Ganaste ${pr.label} OFF!</h3>
          <p>Ya está aplicado en tu carrito. Válido en compras desde ${M(c.min)}. <b>Expira en 24 horas.</b></p>
          <div class="coupon"><b>${pr.code}</b><span class="tiny">Guardado ✓</span></div>
          <a class="btn block" href="#/ofertas" data-close>Usar mi descuento</a>`;
        A.notify('🎡', '¡Ganaste ' + pr.label + ' OFF en la ruleta!', 'Tu cupón ' + pr.code + ' expira en 24 horas.', '#/carrito');
      }, 4400);
    };
  }

  function flashModal() {
    if (S.shown.has('flash')) return;
    const ps = products().filter(p => p.flash).slice(0, 3);
    modal(`<div class="emoji">⚡</div><h3>Oferta relámpago -${db().settings.flashDiscountPct}%</h3>
      <p>Los productos más vendidos con descuento. Cuando el reloj llegue a cero, vuelven a su precio normal.</p>
      <div style="display:flex;justify-content:center;margin-bottom:14px"><div class="timer" data-timer style="color:var(--vino)"><span style="background:var(--lila)">00</span>:<span style="background:var(--lila)">00</span>:<span style="background:var(--lila)">00</span></div></div>
      <div class="mini-grid">${ps.map(p => `<a href="#/p/${encodeURIComponent(p.id)}" data-close><img src="${p.img}" alt=""></a>`).join('')}</div>
      <a class="btn block" href="#/ofertas" data-close>Ver ofertas</a>`, { key: 'flash' });
  }

  function cartRescue() {
    const lines = A.Cart.lines();
    if (!lines.length || S.shown.has('rescue') || /^#\/(carrito|checkout)/.test(S.route)) return;
    if (Date.now() - (A.ui.cartTouched || 0) < 45e3) return;
    const low = lines.find(l => l.p.stock <= 9) || lines[0];
    modal(`<div class="emoji">🛍️</div><h3>¡Tus productos te esperan!</h3>
      <p><b>${esc(low.p.name)}</b> se está agotando: quedan solo <b>${Math.max(2, low.p.stock)}</b>. Termina tu compra ahora y te damos <b>5% extra</b>.</p>
      <div class="coupon"><b>VUELVE5</b><span class="tiny">Válido por 15 min</span></div>
      <a class="btn block" href="#/carrito" data-close id="rescue-go">Terminar mi compra</a>`, { key: 'rescue', sheet: true });
    const go = document.getElementById('rescue-go'); if (go) go.addEventListener('click', () => giveCoupon('VUELVE5'));
  }

  function checkinReminder() {
    const u = A.me(); if (!u || S.shown.has('checkin')) return;
    if (A.ui.checkin.last === new Date().toISOString().slice(0, 10)) return;
    modal(`<div class="emoji">⭐</div><h3>¡Tus puntos de hoy te esperan!</h3><p>Entra cada día para mantener tu racha. El día 7 ganas <b>50 puntos</b> de golpe.</p>
      <a class="btn block" href="#/perfil" data-close>Reclamar puntos</a>`, { key: 'checkin', sheet: true });
  }

  function idleNudge() {
    if (S.shown.has('idle')) return;
    const ps = [...products()].sort(() => Math.random() - .5).slice(0, 3);
    modal(`<div class="emoji">👀</div><h3>¿Sigues ahí?</h3><p>Esto es lo que otras clientas están comprando ahora mismo:</p>
      <div class="mini-grid">${ps.map(p => `<a href="#/p/${encodeURIComponent(p.id)}" data-close><img src="${p.img}" alt=""><div class="tiny" style="color:var(--vino);font-weight:600;margin-top:3px">${M(Store.unitPrice(p, 1))}</div></a>`).join('')}</div>
      <button class="btn soft block" data-close>Seguir viendo</button>`, { key: 'idle' });
  }

  function mysteryGift() {
    const today = new Date().toISOString().slice(0, 10);
    if (A.ui.mystery === today) return;
    if (layer.querySelector('.fab-gift')) return;
    const f = document.createElement('button');
    f.className = 'fab-gift'; f.innerHTML = '🎁<small>1</small>'; f.setAttribute('aria-label', 'Regalo sorpresa');
    layer.appendChild(f);
    f.onclick = () => {
      const m = modal(`<div class="emoji">🎁</div><h3>Regalo sorpresa del día</h3><p>Toca la caja para abrirla. Hay uno nuevo cada día.</p>
        <button class="btn block" id="open-gift">Abrir mi regalo</button>`, { force: true });
      if (!m) return;
      m.querySelector('#open-gift').onclick = () => {
        A.ui.mystery = today; f.remove();
        const u = A.me();
        if (u && Math.random() < .5) { u.points += 25; Store.commit(); A.saveUI(); m.querySelector('.modal').innerHTML = `<button class="close">×</button><div class="emoji">⭐</div><h3>¡+25 puntos!</h3><p>Ya están en tu cuenta. Vuelve mañana por otro regalo.</p><button class="btn block" data-close>¡Genial!</button>`; }
        else { giveCoupon('SORPRESA8'); m.querySelector('.modal').innerHTML = `<button class="close">×</button><div class="emoji">💝</div><h3>¡8% OFF sorpresa!</h3><p>Sin compra mínima. Ya está aplicado en tu carrito.</p><div class="coupon"><b>SORPRESA8</b><span class="tiny">Hoy nada más</span></div><a class="btn block" href="#/carrito" data-close>Ir al carrito</a>`; }
        confetti();
      };
    };
  }

  function askPushPermission() {
    const m = modal(`<div class="emoji">📲</div><h3>¿Te avisamos de las ofertas?</h3>
      <p>Te mandamos máximo <b>2 o 3 avisos al día</b>: ofertas relámpago, cupones de quincena y el estado de tu pedido. Nada de spam.</p>
      <button class="btn block" id="push-yes">Sí, avísame</button><button class="later" data-close>Ahora no</button>`, { force: true, key: 'pushask' });
    if (!m) return;
    m.querySelector('#push-yes').onclick = async () => {
      m.close();
      try { if ('Notification' in window) await Notification.requestPermission(); } catch (e) {}
      A.ui.pushOk = true; A.saveUI();
      setTimeout(() => push('¡Listo, bella! 💗', 'Ya recibirás nuestras ofertas exclusivas.'), 600);
    };
  }

  /* ---------- Prueba social ---------- */
  const NAMES = ['María José', 'Andrea', 'Karla', 'Gaby', 'Dani', 'Paola', 'Valeria', 'Nicole', 'Fernanda', 'Melany', 'Doménica', 'Kerly', 'Jessenia', 'Allison', 'Lady', 'Mishell'];
  const CITIES = ['Guayaquil', 'Quito', 'Cuenca', 'Machala', 'Manta', 'Durán', 'Samborondón', 'Portoviejo', 'Babahoyo', 'Milagro', 'Ambato', 'Loja', 'Santo Domingo'];
  function socialProof() {
    if (quiet() || S.modalOpen) return;
    const p = pick(products());
    const kind = Math.random();
    if (kind < .6) toast(p.img, `<b>${pick(NAMES)}</b> de ${pick(CITIES)} compró<br>${esc(p.name)} <small>· hace ${Math.ceil(rand(1, 9))} min</small>`, '#/p/' + encodeURIComponent(p.id));
    else if (kind < .8) toast(p.img, `🔥 <b>${Math.ceil(rand(12, 48))} personas</b> agregaron<br>${esc(p.name)} a su carrito hoy`, '#/p/' + encodeURIComponent(p.id));
    else if (kind < .9) toast(p.img, `⏳ <b>¡Se agota!</b> ${esc(p.name)}<br><small>Quedan pocas unidades</small>`, '#/p/' + encodeURIComponent(p.id));
    else toast(null, `💼 <b>${pick(NAMES)}</b> acaba de unirse como <b>revendedora</b> en ${pick(CITIES)}`, '#/revendedoras');
  }

  /* ---------- Campañas push (horario programado en el panel) ---------- */
  function dayMatches(days, d) {
    const wd = d.getDay(); const dom = d.getDate();
    if (days === 'Todos') return true;
    if (days === 'L-V') return wd >= 1 && wd <= 5;
    if (days === 'Sáb') return wd === 6;
    if (days === 'Dom') return wd === 0;
    if (days === '15 y 30') return dom === 15 || dom === 30 || (dom === 28 && d.getMonth() === 1);
    return false;
  }
  function runCampaigns() {
    const d = new Date(); const hhmm = d.toTimeString().slice(0, 5);
    const key = 'zar_sent_' + d.toISOString().slice(0, 10);
    let sent = []; try { sent = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) {}
    db().campaigns.filter(c => c.active && c.time === hhmm && dayMatches(c.days, d) && !sent.includes(c.id)).forEach(c => {
      push(c.title, c.body, '#/ofertas'); sent.push(c.id);
    });
    // Envíos inmediatos hechos desde el panel
    (db().sentPush || []).forEach(sp => { if (!sent.includes(sp.id) && Date.now() - sp.at < 10 * 60e3) { push(sp.title, sp.body, sp.link || '#/ofertas'); sent.push(sp.id); } });
    try { localStorage.setItem(key, JSON.stringify(sent)); } catch (e) {}
  }

  /* ---------- Cambios de estado de pedido desde el panel -> push ---------- */
  const LBL = { preparando: '👩‍🔧 Estamos preparando tu pedido', enviado: '🚚 ¡Tu pedido va en camino!', listo: '🏬 ¡Tu pedido está listo para retirar!', entregado: '💗 Pedido entregado. ¡Gracias!', cancelado: 'Tu pedido fue cancelado', nuevo: '✅ Pago validado, pedido confirmado' };
  let known = {};
  const snapOrders = () => { const u = A.me(); known = {}; if (u) db().orders.filter(o => o.userId === u.id).forEach(o => known[o.id] = o.status); };
  snapOrders();
  window.addEventListener('zar:change', () => {
    const u = A.me(); if (!u) return;
    db().orders.filter(o => o.userId === u.id).forEach(o => {
      if (known[o.id] && known[o.id] !== o.status && LBL[o.status]) push(LBL[o.status], 'Pedido ' + o.id + ' · toca para ver el detalle', '#/pedido/' + o.id);
      known[o.id] = o.status;
    });
    runCampaigns();
  });

  /* ---------- Orquestación ---------- */
  ['click', 'touchstart', 'keydown', 'scroll'].forEach(ev => document.addEventListener(ev, () => S.lastAct = Date.now(), { passive: true, capture: true }));

  setTimeout(function loop() { socialProof(); setTimeout(loop, rand(30e3, 50e3)); }, 12e3);

  setInterval(() => {
    if (S.modalOpen || quiet()) return;
    const idle = Date.now() - S.lastAct;
    const age = Date.now() - boot;
    if (!A.me() && age > 6e3) return welcomeGift();
    if (A.me() && !A.ui.wheelDone) return wheel();
    if (age > 50e3) cartRescue();
    if (idle > 40e3) idleNudge();
    if (age > 100e3 && S.route === '#/' ) flashModal();
    if (age > 160e3) checkinReminder();
    if (age > 220e3 && !A.ui.pushOk && A.me()) askPushPermission();
  }, 3000);

  setTimeout(mysteryGift, 20e3);
  setInterval(runCampaigns, 20e3);
  const boot = Date.now();

  window.Engage = {
    confetti, push, toast, askPushPermission,
    onView(h) {
      if (S.route !== (h || '#/') && S.modalOpen && S.current) S.current.close();
      S.route = h || '#/';
    },
    onRegistered() { snapOrders(); setTimeout(wheel, 700); },
    onAddToCart(p, cart) {
      setTimeout(() => {
        const from = A.freeShipFrom(); const sub = cart.subtotal();
        if (from && sub < from) toast(p.img, `🛍️ ¡Agregado! Te faltan <b>${M(from - sub)}</b><br>para tu <b>envío GRATIS</b>`, '#/carrito');
        else if (p.stock <= 5) toast(p.img, `⏳ ¡Buena elección! Solo quedan <b>${p.stock}</b>.<br>Asegúralo antes de que se acabe.`, '#/carrito');
      }, 2400);
    },
    onOrderPlaced(o, pts) {
      confetti(); snapOrders();
      setTimeout(() => push('🧾 Pedido ' + o.id + ' recibido', `Ganaste ${pts} puntos. Te avisaremos cada paso.`, '#/pedido/' + o.id), 1500);
      if (!A.ui.pushOk) setTimeout(askPushPermission, 6000);
    },
  };
})();
