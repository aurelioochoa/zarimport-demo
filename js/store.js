/* Capa de datos compartida entre la app (index.html) y el panel (admin.html).
   En el prototipo todo vive en localStorage del navegador. Para producción esto
   se reemplaza por una API/backend (ver README.md). */
(function () {
  const KEY = 'zar_db_v1';

  const CATEGORIES = [
    { id: 'maquillaje', name: 'Maquillaje', icon: '💄' },
    { id: 'skincare', name: 'Skincare', icon: '🧴' },
    { id: 'unas', name: 'Uñas', icon: '💅' },
    { id: 'capilares', name: 'Capilares', icon: '🎀' },
    { id: 'accesorios', name: 'Accesorios', icon: '👜' },
  ];

  function seed() {
    const products = (window.SEED_PRODUCTS || []).map((p, i) => ({
      ...p,
      // Stock simulado para el prototipo (la dueña lo ajusta en el panel)
      stock: [3, 4, 5, 7, 9, 12, 18, 25, 40][(i * 7) % 9],
      sold: 40 + ((i * 37) % 260),
      rating: 4.5 + ((i * 3) % 5) / 10,
      active: true,
      flash: ['HR692', '5622', 'CZ060', 'ZARES1097', 'CZ144', 'MQ-01'].includes(p.id),
    }));
    return {
      version: 1,
      products,
      categories: CATEGORIES,
      settings: {
        storeName: 'Zarimport',
        whatsapp: '593900000000',
        freeShippingFrom: 35,
        flashDiscountPct: 15,
        // Tarifas referenciales: CONFIRMAR con Tramaco y Laar
        couriers: [
          { id: 'tramaco', name: 'Tramaco Express', gye: 3.5, resto: 5.75, days: '24 a 48 h' },
          { id: 'laar', name: 'Laar Courier', gye: 3.25, resto: 5.5, days: '24 a 72 h' },
        ],
        stores: [
          { id: 'matriz', name: 'Local Matriz', address: 'Chimborazo #814 y Aguirre, Guayaquil', hours: 'Lun a Sáb 9:00 a 18:30' },
          { id: 'local2', name: 'Local 2 (por confirmar)', address: 'Dirección por confirmar', hours: 'Lun a Sáb 9:00 a 18:00' },
        ],
        bank: { bank: 'Banco (por confirmar)', type: 'Corriente', number: '0000000000', holder: 'ZAR IMPORT ZARIMPORT S.A.', ruc: '0992534427001' },
        levels: [
          { id: 'rosa', name: 'Rosa', from: 0, perk: '1 punto por cada $1' },
          { id: 'lila', name: 'Lila', from: 300, perk: 'Envío gratis desde $25 + 1,25 pts por $1' },
          { id: 'vino', name: 'Vino VIP', from: 1000, perk: 'Envío gratis siempre + 1,5 pts por $1 + preventas' },
        ],
      },
      coupons: [
        { code: 'BIENVENIDA10', type: 'pct', value: 10, min: 10, active: true, note: 'Primera compra' },
        { code: 'ZARES5', type: 'fixed', value: 5, min: 40, active: true, note: '$5 en compras desde $40' },
        { code: 'QUINCENA', type: 'pct', value: 12, min: 20, active: true, note: 'Días 15 y 30' },
        { code: 'VUELVE5', type: 'pct', value: 5, min: 0, active: true, note: 'Recupera tu carrito', hidden: true },
        { code: 'RULETA10', type: 'pct', value: 10, min: 10, active: true, note: 'Premio ruleta', hidden: true },
        { code: 'RULETA12', type: 'pct', value: 12, min: 10, active: true, note: 'Premio ruleta', hidden: true },
        { code: 'RULETA15', type: 'pct', value: 15, min: 15, active: true, note: 'Premio ruleta', hidden: true },
        { code: 'RULETA20', type: 'pct', value: 20, min: 25, active: true, note: 'Premio ruleta', hidden: true },
        { code: 'SORPRESA8', type: 'pct', value: 8, min: 0, active: true, note: 'Regalo sorpresa', hidden: true },
      ],
      // Campañas push programadas (horario Ecuador, UTC-5)
      campaigns: [
        { id: 'c1', time: '07:15', days: 'L-V', title: '☀️ Buenos días, bella', body: 'Tu labial favorito tiene 15% OFF solo hasta el mediodía.', active: true },
        { id: 'c2', time: '12:45', days: 'L-V', title: '⚡ Oferta relámpago del almuerzo', body: 'Quedan pocas unidades. Mira lo que se está agotando.', active: true },
        { id: 'c3', time: '20:30', days: 'Todos', title: '💗 Tu carrito te extraña', body: 'Termina tu pedido y llévate puntos dobles hoy.', active: true },
        { id: 'c4', time: '10:00', days: 'Sáb', title: '🛍️ Sábado de belleza', body: 'Envío gratis desde $35. ¡Arma tu kit del finde!', active: true },
        { id: 'c5', time: '19:00', days: '15 y 30', title: '💸 ¡Llegó la quincena!', body: 'Usa el código QUINCENA y ahorra 12% en todo.', active: true },
      ],
      users: [],
      orders: demoOrders(products),
      sentPush: [],
      session: null,
    };
  }

  function demoOrders(products) {
    const names = ['María José P.', 'Andrea V.', 'Karla M.', 'Gabriela T.', 'Daniela R.', 'Paola C.'];
    const st = ['nuevo', 'preparando', 'enviado', 'entregado', 'listo', 'entregado'];
    const now = Date.now();
    return names.map((n, i) => {
      const items = [products[i * 3], products[i * 5 + 1]].filter(Boolean).map((p, j) => ({ id: p.id, name: p.name, img: p.img, tone: p.tones[0] || null, qty: j ? 3 : 1, unit: j ? p.price.min : p.price.pvp }));
      const subtotal = items.reduce((s, it) => s + it.qty * it.unit, 0);
      const ship = i % 2 ? 0 : 3.5;
      return {
        id: 'ZR-' + (10240 + i), user: n, phone: '09' + (90000000 + i * 12345), date: now - i * 3.7 * 3600e3,
        items, subtotal, discount: 0, shipping: ship, total: +(subtotal + ship).toFixed(2),
        delivery: i % 2 ? { type: 'pickup', store: 'Local Matriz' } : { type: 'courier', courier: i % 4 ? 'Laar Courier' : 'Tramaco Express', city: i % 3 ? 'Guayaquil' : 'Quito', address: 'Dirección de ejemplo' },
        payment: i % 3 ? 'tarjeta' : 'transferencia', status: st[i], demo: true,
      };
    });
  }

  // Horario de atención humana (hora de Ecuador). CONFIRMAR con la dueña.
  const SUPPORT = {
    online: true, // la dueña lo apaga desde el panel si no hay nadie disponible
    whatsapp: '593900000000',
    phone: '042000000',
    hours: [ // 0 = domingo ... 6 = sábado; null = cerrado
      null,
      ['09:00', '18:30'], ['09:00', '18:30'], ['09:00', '18:30'], ['09:00', '18:30'], ['09:00', '18:30'],
      ['09:00', '14:00'],
    ],
    returnsDays: 3,
  };
  function migrate(db) {
    if (!db.settings.support) db.settings.support = JSON.parse(JSON.stringify(SUPPORT));
    if (!db.tickets) db.tickets = [];
    // Video demostrativo de prueba para Jelly Blush (reemplazar por el video real)
    const jb = db.products.find(p => p.id === 'HR736');
    if (jb && !('video' in jb)) jb.video = { src: 'video/hr736-demo.mp4', poster: 'video/hr736-demo.jpg', note: 'Video de prueba', ai: true };
    return db;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const db = JSON.parse(raw);
        if (db && db.version === 1) return migrate(db);
      }
    } catch (e) { /* almacenamiento bloqueado */ }
    const db = migrate(seed());
    save(db);
    return db;
  }
  function save(db) {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* ignorar */ }
  }

  let db = load();

  const Store = {
    get db() { return db; },
    reload() { db = load(); return db; },
    commit() { save(db); window.dispatchEvent(new CustomEvent('zar:change')); },
    reset() { try { localStorage.removeItem(KEY); localStorage.removeItem('zar_ui_v1'); } catch (e) {} db = load(); },
    money(n) { return '$' + (Math.round(n * 100) / 100).toFixed(2); },
    product(id) { return db.products.find(p => p.id === id); },
    // Precio unitario según cantidad: 12+ mayorista, 3+ minorista, menos = P.V.P.
    unitPrice(p, qty, flash = true) {
      let u = qty >= 12 ? p.price.may : qty >= 3 ? p.price.min : p.price.pvp;
      if (flash && p.flash && qty < 3) u = u * (1 - db.settings.flashDiscountPct / 100);
      return Math.round(u * 100) / 100;
    },
    // ¿Hay atención humana ahora? Calculado en hora de Ecuador (America/Guayaquil).
    supportStatus(now = new Date()) {
      const sp = db.settings.support;
      const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Guayaquil', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now).map(p => [p.type, p.value]));
      const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
      const hm = (parts.hour === '24' ? '00' : parts.hour) + ':' + parts.minute;
      const today = sp.hours[wd];
      const inHours = !!today && hm >= today[0] && hm < today[1];
      let next = null; // próxima apertura
      for (let i = 0; i < 8; i++) {
        const d = (wd + i) % 7, h = sp.hours[d];
        if (!h) continue;
        if (i === 0 && hm >= h[0]) continue;
        next = { label: i === 0 ? 'hoy' : i === 1 ? 'mañana' : 'el ' + DAYS[d], time: h[0] };
        break;
      }
      const fmt = h => h ? `${h[0]} a ${h[1]}` : 'cerrado';
      const summary = [
        `Lunes a viernes: ${fmt(sp.hours[1])}`,
        `Sábado: ${fmt(sp.hours[6])}`,
        `Domingo: ${fmt(sp.hours[0])}`,
      ];
      return { inHours, available: inHours && sp.online, online: sp.online, today: today ? fmt(today) : 'cerrado', closesAt: today ? today[1] : null, next, summary, now: hm };
    },
    levelFor(points) {
      const lv = db.settings.levels;
      let cur = lv[0];
      lv.forEach(l => { if (points >= l.from) cur = l; });
      const next = lv[lv.indexOf(cur) + 1] || null;
      return { cur, next };
    },
  };

  // Sincroniza entre pestañas (app <-> panel)
  window.addEventListener('storage', e => {
    if (e.key === KEY) { db = load(); window.dispatchEvent(new CustomEvent('zar:change', { detail: { external: true } })); }
  });

  window.Store = Store;
})();
