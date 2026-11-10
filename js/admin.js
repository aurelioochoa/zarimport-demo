/* Panel de administración de Zarimport (prototipo). */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const M = n => Store.money(n);
  const db = () => Store.db;
  const main = $('#main');
  const commit = (msg) => { Store.commit(); if (msg) snack(msg); };
  function snack(t) { const s = $('#snack'); s.textContent = t; s.classList.add('show'); clearTimeout(s._t); s._t = setTimeout(() => s.classList.remove('show'), 2000); }

  let section = 'resumen';

  /* ---------- Acceso (demo) ---------- */
  const gate = $('#gate');
  function enter() { gate.hidden = true; $('#admin').hidden = false; render(); }
  $('#pin-go').onclick = () => { if ($('#pin').value === '1234') { sessionStorage.setItem('zar_admin', '1'); enter(); } else snack('PIN incorrecto'); };
  $('#pin').addEventListener('keydown', e => { if (e.key === 'Enter') $('#pin-go').click(); });

  $('#nav').onclick = e => { const a = e.target.closest('[data-s]'); if (!a) return; section = a.dataset.s; render(); };

  const LBL = { nuevo: 'Nuevo', 'por validar': 'Por validar', preparando: 'Preparando', enviado: 'Enviado', listo: 'Listo para retirar', entregado: 'Entregado', cancelado: 'Cancelado' };
  const stClass = s => s === 'por validar' ? 'por' : s;
  const FLOW = { courier: ['nuevo', 'preparando', 'enviado', 'entregado'], pickup: ['nuevo', 'preparando', 'listo', 'entregado'] };
  const fdate = ts => new Date(ts).toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  /* ---------- Secciones ---------- */
  const S = {};

  S.resumen = () => {
    const os = db().orders.filter(o => o.status !== 'cancelado');
    const day = 864e5, start = new Date(); start.setHours(0, 0, 0, 0);
    const today = os.filter(o => o.date >= start.getTime());
    const pend = db().orders.filter(o => ['nuevo', 'por validar', 'preparando'].includes(o.status));
    const avg = os.length ? os.reduce((s, o) => s + o.total, 0) / os.length : 0;
    const days = [...Array(7)].map((_, i) => { const d0 = start.getTime() - (6 - i) * day; const v = os.filter(o => o.date >= d0 && o.date < d0 + day).reduce((s, o) => s + o.total, 0); return { d: new Date(d0).toLocaleDateString('es-EC', { weekday: 'short' }), v }; });
    const max = Math.max(1, ...days.map(d => d.v));
    const sold = {}; os.forEach(o => o.items.forEach(i => sold[i.id] = (sold[i.id] || 0) + i.qty));
    const top = Object.entries(sold).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, q]) => ({ p: Store.product(id), q })).filter(x => x.p);
    const low = db().products.filter(p => p.active && p.stock <= 5).sort((a, b) => a.stock - b.stock);
    const est = db().products.filter(p => p.pvpEst).length;
    return `<div class="head"><div><h1>Hola 💗</h1><p>Así va tu tienda hoy, ${new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div><a class="btn" href="index.html" target="_blank">Ver la app</a></div>
      ${est ? `<div class="alert">⚠️ Hay <b>${est} productos</b> sin P.V.P. (precio por unidad) en el catálogo. Puse un precio estimado de más o menos el doble del mayorista. Revísalos en <a href="#" data-go="productos" style="text-decoration:underline">Productos</a>.</div>` : ''}
      <div class="kpis">
        <div class="kpi"><small>Ventas de hoy</small><b>${M(today.reduce((s, o) => s + o.total, 0))}</b><span>${today.length} pedidos</span></div>
        <div class="kpi"><small>Pedidos por atender</small><b>${pend.length}</b><span style="color:var(--warn)">${db().orders.filter(o => o.status === 'por validar').length} transferencias por validar</span></div>
        <div class="kpi"><small>Ticket promedio</small><b>${M(avg)}</b><span>últimos pedidos</span></div>
        <div class="kpi"><small>Clientas registradas</small><b>${db().users.length}</b><span>${db().users.filter(u => u.type === 'revendedora').length} revendedoras</span></div>
      </div>
      <div class="cols">
        <div class="card"><h3>Ventas de los últimos 7 días <small>USD</small></h3>
          <div class="bars">${days.map(d => `<div><em>${d.v ? Math.round(d.v) : ''}</em><i style="height:${d.v / max * 100}%"></i>${d.d}</div>`).join('')}</div></div>
        <div class="card"><h3>Lo más vendido</h3>${top.length ? top.map(t => `<div class="list-row"><img src="${t.p.img}" alt=""><div class="grow"><div>${esc(t.p.name)}</div><div class="tiny muted">${esc(t.p.brand)}</div></div><b>${t.q} uds</b></div>`).join('') : '<p class="muted">Aún no hay ventas.</p>'}</div>
      </div>
      <div class="cols">
        <div class="card"><h3>Últimos pedidos <a class="btn sm soft" data-go="pedidos">Ver todos</a></h3>${db().orders.slice(0, 5).map(o => `<div class="list-row" data-order="${o.id}" style="cursor:pointer"><div class="grow"><div><b>${o.id}</b> · ${esc(o.user)}</div><div class="tiny muted">${fdate(o.date)} · ${o.delivery.type === 'pickup' ? '🏬 Retiro' : '🚚 ' + esc(o.delivery.courier)}</div></div><span class="status ${stClass(o.status)}">${LBL[o.status]}</span><b>${M(o.total)}</b></div>`).join('')}</div>
        <div class="card"><h3>Stock bajo <small>5 unidades o menos</small></h3>${low.length ? low.slice(0, 6).map(p => `<div class="list-row"><img src="${p.img}" alt=""><div class="grow"><div>${esc(p.name)}</div><div class="tiny muted">${esc(p.id)}</div></div><b style="color:var(--bad)">${p.stock}</b></div>`).join('') : '<p class="muted">Todo en orden ✓</p>'}</div>
      </div>`;
  };

  let oFilter = 'activos';
  S.pedidos = () => {
    const f = { activos: o => !['entregado', 'cancelado'].includes(o.status), 'por validar': o => o.status === 'por validar', todos: () => true, entregado: o => o.status === 'entregado' };
    const list = db().orders.filter(f[oFilter]);
    return `<div class="head"><div><h1>Pedidos</h1><p>Toca un pedido para ver el detalle y cambiar su estado. La clienta recibe una notificación en cada paso.</p></div></div>
      <div class="filters">${Object.keys(f).map(k => `<button class="chip ${oFilter === k ? 'on' : ''}" data-of="${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>
      <div class="ocards">${list.map(o => `<div class="ocard" data-order="${o.id}">
        <div class="top"><b>${o.id}</b><span class="status ${stClass(o.status)}">${LBL[o.status]}</span></div>
        <div class="tiny muted">${fdate(o.date)} · ${esc(o.user)}</div>
        <div class="imgs">${o.items.slice(0, 5).map(i => `<img src="${i.img}" alt="">`).join('')}</div>
        <div style="display:flex;justify-content:space-between"><span class="tiny">${o.delivery.type === 'pickup' ? '🏬 Retiro · ' + esc(o.delivery.store) : '🚚 ' + esc(o.delivery.courier) + ' · ' + esc(o.delivery.city)}</span><b style="color:var(--vino)">${M(o.total)}</b></div>
      </div>`).join('') || '<p class="muted">No hay pedidos en este filtro.</p>'}</div>`;
  };
  function openOrder(id) {
    const o = db().orders.find(x => x.id === id); if (!o) return;
    const flow = FLOW[o.delivery.type];
    $('#drawer-in').innerHTML = `<button class="btn sm ghost" data-close style="float:right">Cerrar</button>
      <h2>${o.id}</h2><div class="muted">${fdate(o.date)} · <span class="status ${stClass(o.status)}">${LBL[o.status]}</span></div>
      <div class="sum"><div><span>Clienta</span><b>${esc(o.user)}</b></div><div><span>Celular</span><a style="color:var(--vino)" target="_blank" href="https://wa.me/593${esc(String(o.phone || '').replace(/^0/, ''))}">${esc(o.phone || '')} 💬</a></div>
        <div><span>Entrega</span><b style="text-align:right">${o.delivery.type === 'pickup' ? 'Retiro en ' + esc(o.delivery.store) : esc(o.delivery.courier) + '<br><span class="tiny muted">' + esc(o.delivery.address) + ', ' + esc(o.delivery.city) + '</span>'}</b></div>
        <div><span>Pago</span><b>${o.payment === 'tarjeta' ? '💳 Tarjeta' : '🏦 Transferencia'}${o.proof ? `<br><span class="tiny muted">Comprobante: ${esc(o.proof)}</span>` : ''}</b></div></div>
      ${o.status === 'por validar' ? `<div class="alert">Revisa en tu banco que llegó la transferencia de <b>${M(o.total)}</b> antes de aprobar.</div><div class="flow"><button class="btn" data-st="nuevo">✓ Aprobar pago</button><button class="btn danger" data-st="cancelado">Rechazar</button></div>` : ''}
      ${!['por validar', 'cancelado'].includes(o.status) ? `<b class="tiny">Cambiar estado:</b><div class="flow">${flow.map(s => `<button class="btn sm ${s === o.status ? '' : 'ghost'}" data-st="${s}">${LBL[s]}</button>`).join('')}</div>` : ''}
      ${o.items.map(i => `<div class="list-row"><img src="${i.img}" alt=""><div class="grow"><div>${esc(i.name)}</div><div class="tiny muted">${i.qty} × ${M(i.unit)}${i.tone ? ' · Tono ' + esc(i.tone) : ''} · ${esc(i.id)}</div></div><b>${M(i.qty * i.unit)}</b></div>`).join('')}
      <div class="sum"><div><span>Subtotal</span><span>${M(o.subtotal)}</span></div>${o.discount ? `<div><span>Descuento ${o.coupon ? '(' + esc(o.coupon) + ')' : ''}</span><span>−${M(o.discount)}</span></div>` : ''}<div><span>Envío</span><span>${o.shipping ? M(o.shipping) : 'Gratis'}</span></div><div class="t"><span>Total</span><span>${M(o.total)}</span></div></div>
      ${o.status !== 'cancelado' && o.status !== 'por validar' ? `<button class="btn danger sm" data-st="cancelado">Cancelar pedido</button>` : ''}`;
    $('#drawer').classList.add('show');
    $('#drawer-in').onclick = e => {
      const b = e.target.closest('[data-st]');
      if (b) { o.status = b.dataset.st; commit('Estado actualizado · se notificó a la clienta'); openOrder(o.id); render(); }
      if (e.target.closest('[data-close]')) $('#drawer').classList.remove('show');
    };
  }
  $('#drawer').addEventListener('click', e => { if (e.target.id === 'drawer') e.currentTarget.classList.remove('show'); });

  let pq = '', pcat = 'all';
  S.productos = () => {
    const n = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const list = db().products.filter(p => (pcat === 'all' || p.cat === pcat) && n(p.name + p.id + p.brand).includes(n(pq)));
    return `<div class="head"><div><h1>Productos</h1><p>${db().products.length} productos · Los cambios se ven en la app al instante.</p></div><button class="btn" id="new-p">+ Nuevo producto</button></div>
      <div class="filters"><input class="search" id="pq" placeholder="Buscar por nombre, código o marca" value="${esc(pq)}">
        <button class="chip ${pcat === 'all' ? 'on' : ''}" data-pc="all">Todos</button>${db().categories.map(c => `<button class="chip ${pcat === c.id ? 'on' : ''}" data-pc="${c.id}">${c.icon} ${c.name}</button>`).join('')}</div>
      <div class="tbl-wrap"><table><thead><tr><th></th><th>Producto</th><th>P.V.P.</th><th>Minorista<br><span class="tiny">3 a 11</span></th><th>Mayorista<br><span class="tiny">12+</span></th><th>Stock</th><th>Relámpago</th><th>Activo</th><th></th></tr></thead><tbody>
      ${list.map(p => `<tr data-pid="${esc(p.id)}"><td><img src="${p.img}" alt=""></td><td><b>${esc(p.name)}</b><div class="tiny muted">${esc(p.brand)} · ${esc(p.id)}</div></td>
        <td><input class="num" data-f="pvp" type="number" step="0.05" value="${p.price.pvp}">${p.pvpEst ? '<span class="est">estimado</span>' : ''}</td>
        <td><input class="num" data-f="min" type="number" step="0.05" value="${p.price.min}"></td>
        <td><input class="num" data-f="may" type="number" step="0.05" value="${p.price.may}"></td>
        <td><input class="num" data-f="stock" type="number" step="1" value="${p.stock}" style="${p.stock <= 5 ? 'color:var(--bad);font-weight:600' : ''}"></td>
        <td><button class="toggle ${p.flash ? 'on' : ''}" data-t="flash" aria-label="Oferta relámpago"></button></td>
        <td><button class="toggle ${p.active ? 'on' : ''}" data-t="active" aria-label="Activo"></button></td>
        <td><button class="btn sm ghost" data-edit>Editar</button></td></tr>`).join('')}
      </tbody></table></div>`;
  };
  function editProduct(id) {
    const p = id ? Store.product(id) : { id: '', name: '', brand: 'Zares', cat: 'maquillaje', img: '', price: { pvp: 0, min: 0, may: 0 }, tones: [], tags: [], stock: 0, sold: 0, rating: 4.8, active: true, flash: false, promo: null };
    $('#drawer-in').innerHTML = `<button class="btn sm ghost" data-close style="float:right">Cerrar</button><h2>${id ? 'Editar producto' : 'Nuevo producto'}</h2>
      <div class="field" style="margin-top:14px"><label>Foto</label><div style="display:flex;gap:12px;align-items:center"><img id="e-prev" src="${p.img || 'assets/brand/icon.svg'}" style="width:84px;height:84px;border-radius:14px;object-fit:cover;background:var(--lila-50)"><input type="file" id="e-img" accept="image/*"></div></div>
      <div class="grid2"><div class="field"><label>Código</label><input id="e-id" value="${esc(p.id)}" ${id ? 'disabled' : ''}></div><div class="field"><label>Marca</label><input id="e-brand" value="${esc(p.brand)}"></div></div>
      <div class="field"><label>Nombre</label><input id="e-name" value="${esc(p.name)}"></div>
      <div class="field"><label>Categoría</label><select id="e-cat">${db().categories.map(c => `<option value="${c.id}" ${p.cat === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div>
      <div class="grid3"><div class="field"><label>P.V.P. (1 a 2)</label><input id="e-pvp" type="number" step="0.05" value="${p.price.pvp}"></div><div class="field"><label>Minorista (3 a 11)</label><input id="e-min" type="number" step="0.05" value="${p.price.min}"></div><div class="field"><label>Mayorista (12+)</label><input id="e-may" type="number" step="0.05" value="${p.price.may}"></div></div>
      <div class="grid2"><div class="field"><label>Stock</label><input id="e-stock" type="number" value="${p.stock}"></div><div class="field"><label>Etiqueta</label><select id="e-tag"><option value="">Ninguna</option><option value="nuevo" ${p.tags.includes('nuevo') ? 'selected' : ''}>Nuevo</option><option value="top" ${p.tags.includes('top') ? 'selected' : ''}>Top ventas</option></select></div></div>
      <div class="field"><label>Tonos o colores (separados por coma)</label><input id="e-tones" value="${esc(p.tones.join(', '))}"></div>
      <div class="field"><label>Video demostrativo (ruta o enlace .mp4, opcional)</label><input id="e-video" placeholder="video/mi-producto.mp4" value="${esc(p.video ? p.video.src : '')}">
        <label class="tiny" style="display:flex;gap:6px;align-items:center;margin-top:4px"><input type="checkbox" id="e-ai" ${!p.video || p.video.ai ? 'checked' : ''}> Mostrar etiqueta "Video ilustrativo generado con IA"</label>
        <span class="tiny muted">Se ve al deslizar la foto del producto hacia la derecha. Recomendado: cuadrado 1:1, de 6 a 8 segundos, menos de 5 MB.</span></div>
      <div class="field"><label>Promoción especial (opcional)</label><input id="e-promo" placeholder="Ej: Por 12 unidades te llevas 3 gratis" value="${esc(p.promo || '')}"></div>
      <div style="display:flex;gap:10px"><button class="btn block" id="e-save">Guardar</button>${id ? '<button class="btn danger" id="e-del" style="height:48px">Eliminar</button>' : ''}</div>`;
    $('#drawer').classList.add('show');
    let img = p.img;
    $('#e-img').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); const s = 600 / Math.max(im.width, im.height); c.width = im.width * Math.min(1, s); c.height = im.height * Math.min(1, s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); img = c.toDataURL('image/jpeg', .8); $('#e-prev').src = img; }; im.src = r.result; };
      r.readAsDataURL(f);
    };
    $('#drawer-in').onclick = e => { if (e.target.closest('[data-close]')) $('#drawer').classList.remove('show'); };
    $('#e-save').onclick = () => {
      const v = k => $('#e-' + k).value.trim();
      const code = id || v('id').toUpperCase();
      if (!code || !v('name')) return snack('Código y nombre son obligatorios');
      if (!id && Store.product(code)) return snack('Ya existe un producto con ese código');
      const tag = v('tag');
      const data = { name: v('name'), brand: v('brand'), cat: v('cat'), img: img || 'assets/brand/icon.svg', price: { pvp: +v('pvp'), min: +v('min'), may: +v('may') }, pvpEst: false, stock: +v('stock'), tones: v('tones') ? v('tones').split(',').map(s => s.trim()).filter(Boolean) : [], tags: tag ? [tag] : [], promo: v('promo') || null,
        video: v('video') ? { src: v('video'), poster: p.video && p.video.src === v('video') ? p.video.poster : null, note: p.video && p.video.src === v('video') ? p.video.note : null, ai: $('#e-ai').checked } : null };
      if (id) Object.assign(p, data); else db().products.unshift({ ...p, ...data, id: code, sold: 0 });
      commit('Producto guardado'); $('#drawer').classList.remove('show'); render();
    };
    const del = $('#e-del');
    if (del) del.onclick = () => { if (!confirm('¿Eliminar "' + p.name + '"? Esta acción no se puede deshacer.')) return; db().products = db().products.filter(x => x.id !== id); commit('Producto eliminado'); $('#drawer').classList.remove('show'); render(); };
  }

  S.promos = () => `<div class="head"><div><h1>Promociones</h1><p>Cupones, oferta relámpago y premios de la ruleta.</p></div></div>
    <div class="cols">
      <div class="card"><h3>Cupones</h3>
        <div class="tbl-wrap" style="box-shadow:none"><table style="min-width:520px"><thead><tr><th>Código</th><th>Descuento</th><th>Mínimo</th><th>Nota</th><th>Activo</th></tr></thead><tbody>
        ${db().coupons.map((c, i) => `<tr><td><b>${esc(c.code)}</b></td><td>${c.type === 'pct' ? c.value + '%' : M(c.value)}</td><td>${M(c.min || 0)}</td><td class="tiny muted">${esc(c.note || '')}${c.hidden ? ' · automático' : ''}</td><td><button class="toggle ${c.active ? 'on' : ''}" data-cp="${i}"></button></td></tr>`).join('')}
        </tbody></table></div>
        <h3 style="margin-top:18px">Crear cupón</h3>
        <div class="grid2"><div class="field"><label>Código</label><input id="c-code" placeholder="NAVIDAD15"></div><div class="field"><label>Tipo</label><select id="c-type"><option value="pct">Porcentaje (%)</option><option value="fixed">Valor fijo ($)</option></select></div></div>
        <div class="grid3"><div class="field"><label>Valor</label><input id="c-val" type="number" value="10"></div><div class="field"><label>Compra mínima</label><input id="c-min" type="number" value="15"></div><div class="field"><label>Nota</label><input id="c-note" placeholder="Campaña"></div></div>
        <button class="btn" id="c-add">Crear cupón</button>
      </div>
      <div>
        <div class="card"><h3>Oferta relámpago</h3>
          <p class="muted" style="margin-top:0">Se renueva cada 3 horas con contador en la app. Los productos se eligen en <a href="#" data-go="productos" style="color:var(--vino)">Productos</a> con el interruptor "Relámpago".</p>
          <div class="field"><label>Descuento relámpago (%)</label><input id="flash-pct" type="number" value="${db().settings.flashDiscountPct}"></div>
          <p class="tiny muted">${db().products.filter(p => p.flash).length} productos en oferta ahora.</p></div>
        <div class="card"><h3>Envío gratis</h3>
          <div class="field"><label>Envío gratis desde ($)</label><input id="free-from" type="number" value="${db().settings.freeShippingFrom}"></div>
          <p class="tiny muted">Nivel Lila: desde $25 · Nivel Vino VIP: siempre gratis.</p></div>
      </div>
    </div>`;

  S.notifs = () => {
    const s = db();
    return `<div class="head"><div><h1>Notificaciones</h1><p>Avisos push programados y envíos al momento.</p></div></div>
    <div class="card"><h3>Horarios recomendados <small>Ecuador · público adulto</small></h3>
      <p class="muted" style="margin-top:0">Estas son las horas en que una persona adulta que trabaja suele revisar el celular y tiene tiempo para comprar. Es un punto de partida: después se ajustan con los datos reales de la app.</p>
      <div class="sched">
        <div><b>07:00 a 07:30</b>Al despertar y en el bus o el carro al trabajo. Mensajes cortos y de "buenos días".</div>
        <div><b>12:30 a 13:30</b>Hora del almuerzo. Es la mejor hora para ofertas relámpago.</div>
        <div><b>19:30 a 21:30</b>⭐ Hora pico, la más fuerte del día: ya en casa, en el sofá. Ideal para carritos abandonados y lanzamientos.</div>
        <div><b>Sáb 10:00 a 12:00</b>Mañana libre del fin de semana. Buena para promociones grandes.</div>
        <div><b>Días 15 y 30</b>Quincena y fin de mes, cuando llega el sueldo. Es cuando más se convierte.</div>
      </div>
      <p class="tiny muted" style="margin-bottom:0">Recomendación: <b>máximo 2 o 3 push al día</b> y nunca entre las 22:00 y las 07:00. Las ventanas dentro de la app pueden salir más seguido (ver reglas abajo).</p>
    </div>
    <div class="cols">
      <div class="card"><h3>Campañas programadas <button class="btn sm soft" id="camp-add">+ Agregar</button></h3>
        ${s.campaigns.map((c, i) => `<div class="camp" data-ci="${i}"><input type="time" data-cf="time" value="${c.time}"><select data-cf="days">${['L-V', 'Todos', 'Sáb', 'Dom', '15 y 30'].map(d => `<option ${c.days === d ? 'selected' : ''}>${d}</option>`).join('')}</select>
          <div class="txt"><input data-cf="title" value="${esc(c.title)}"><input data-cf="body" value="${esc(c.body)}"></div>
          <button class="toggle ${c.active ? 'on' : ''}" data-ct="${i}"></button><button class="btn sm ghost" data-cdel="${i}">✕</button></div>`).join('')}
      </div>
      <div>
        <div class="card"><h3>Enviar ahora a todas</h3>
          <div class="field"><label>Título</label><input id="np-title" value="💗 ¡Nuevos labiales Novo!" maxlength="60"></div>
          <div class="field"><label>Mensaje</label><textarea id="np-body" maxlength="140">Llegaron 6 tonos nuevos. Las primeras 20 compras se llevan 2X puntos.</textarea></div>
          <div class="phone-prev"><div class="p"><span class="mark">Z</span><div><div class="tiny muted">ZARIMPORT · ahora</div><b id="pv-t"></b><div class="tiny" id="pv-b"></div></div></div></div>
          <button class="btn block" style="margin-top:12px" id="np-send">Enviar notificación</button>
          <p class="tiny muted">En el prototipo llega a la app abierta en este navegador. En la versión final llega a todos los celulares con Firebase Cloud Messaging.</p>
        </div>
        <div class="card"><h3>Reglas de los pop-ups de la app</h3>
          <div class="tiny" style="line-height:1.7">
          🎁 <b>Regalo de bienvenida</b>: a los 6 segundos de abrir la app, si no tiene cuenta<br>
          🎡 <b>Ruleta</b>: justo al registrarse (de 10% a 20% OFF)<br>
          🛍️ <b>Avisos de compra</b> ("Andrea de Quito compró…"): cada 30 a 50 segundos<br>
          🛒 <b>Carrito abandonado</b>: 45 segundos sin tocar el carrito, con cupón de 5%<br>
          ⚡ <b>Relámpago</b>: al minuto y medio de navegar en el inicio<br>
          👀 <b>¿Sigues ahí?</b>: después de 40 segundos sin actividad<br>
          ⭐ <b>Check-in diario</b>: recordatorio de puntos una vez al día<br>
          🎁 <b>Regalo sorpresa</b>: burbuja flotante una vez al día<br>
          🚦 <b>Límite</b>: 1 ventana a la vez, 75 segundos mínimo entre ventanas, máximo 7 por visita y nunca durante el pago
          </div></div>
      </div>
    </div>`;
  };

  S.soporte = () => {
    const sp = db().settings.support, st = Store.supportStatus();
    const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const order = [1, 2, 3, 4, 5, 6, 0];
    const tk = db().tickets;
    const msg = st.available ? '🟢 Zari les dice a las clientas que <b>sí hay asesoras disponibles</b> y les ofrece WhatsApp y llamada.'
      : st.inHours ? '🟡 Estás en horario, pero marcaste que <b>no hay nadie disponible</b>. Zari pide a las clientas que dejen su mensaje.'
      : `🔴 <b>Fuera de horario</b>. Zari avisa que no hay asesoras y que vuelven ${st.next ? `${st.next.label} a las ${st.next.time}` : 'en el siguiente horario'}. Las clientas dejan su mensaje aquí.`;
    return `<div class="head"><div><h1>Soporte · Zari</h1><p>Zari responde sola las 24 horas. Cuando una clienta pide hablar con una persona, usa estos horarios.</p></div></div>
      <div class="cols">
        <div>
          <div class="card"><h3>Mensajes de clientas <small>${tk.filter(t => t.status === 'pendiente').length} pendientes</small></h3>
            ${tk.length ? tk.map((t, i) => `<div class="list-row" style="align-items:flex-start">
              <div class="grow"><div><b>${esc(t.id)}</b> · ${esc(t.name)} · <span class="tiny muted">${fdate(t.ts)}${t.inHours ? '' : ' · fuera de horario'}</span></div>
                <div style="white-space:normal;margin:4px 0">${esc(t.msg)}</div>
                ${t.transcript && t.transcript.length ? `<details class="tiny muted"><summary>Ver conversación con Zari</summary>${t.transcript.map(x => '• ' + esc(x)).join('<br>')}</details>` : ''}
                <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap"><a class="btn sm" target="_blank" href="https://wa.me/593${esc(t.phone.replace(/^0/, ''))}?text=${encodeURIComponent('Hola ' + t.name.split(' ')[0] + ', te escribimos de Zarimport por tu caso ' + t.id + ' 💗')}">💬 Responder ${esc(t.phone)}</a>
                <button class="btn sm ${t.status === 'pendiente' ? 'ghost' : 'soft'}" data-tk="${i}">${t.status === 'pendiente' ? 'Marcar atendido' : '✓ Atendido'}</button></div></div>
              </div>`).join('') : '<p class="muted" style="margin:0">Todavía no hay mensajes. Cuando una clienta deje su caso con Zari, aparecerá aquí.</p>'}
          </div>
        </div>
        <div>
          <div class="card"><h3>¿Hay alguien atendiendo ahora?</h3>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px"><button class="toggle ${sp.online ? 'on' : ''}" id="sp-online" aria-label="Asesoras disponibles"></button><b>${sp.online ? 'Sí, hay asesoras disponibles' : 'No hay nadie disponible'}</b></div>
            <div class="alert" style="background:var(--lila-50);color:var(--texto);margin:0">${msg}</div>
            <p class="tiny muted">Apágalo cuando salgas a almorzar o estés ocupada, aunque sea horario de atención. Hora actual en Ecuador: ${st.now}.</p></div>
          <div class="card"><h3>Horario de atención <button class="btn sm" id="sp-save">Guardar</button></h3>
            ${order.map(d => { const h = sp.hours[d]; return `<div style="display:grid;grid-template-columns:96px 1fr 1fr auto;gap:8px;align-items:center;margin-bottom:8px" data-day="${d}"><span>${DAYS[d]}</span><input class="search" style="min-width:0;height:36px" type="time" data-h="0" value="${h ? h[0] : '09:00'}" ${h ? '' : 'disabled'}><input class="search" style="min-width:0;height:36px" type="time" data-h="1" value="${h ? h[1] : '18:00'}" ${h ? '' : 'disabled'}><label class="tiny"><input type="checkbox" data-closed ${h ? '' : 'checked'}> Cerrado</label></div>`; }).join('')}
            <div class="grid2" style="margin-top:10px"><div class="field"><label>WhatsApp de soporte (con 593)</label><input id="sp-wa" value="${esc(sp.whatsapp)}"></div><div class="field"><label>Teléfono para llamadas</label><input id="sp-ph" value="${esc(sp.phone)}"></div></div>
            <div class="field"><label>Días para reportar cambios o devoluciones</label><input id="sp-ret" type="number" min="1" value="${sp.returnsDays}"></div>
          </div>
        </div>
      </div>`;
  };

  S.clientes = () => {
    const us = db().users;
    return `<div class="head"><div><h1>Clientes</h1><p>${us.length} registradas</p></div></div>
      ${us.length ? `<div class="tbl-wrap"><table><thead><tr><th>Nombre</th><th>Tipo</th><th>Celular</th><th>Ciudad</th><th>Puntos</th><th>Pedidos</th><th>Total comprado</th><th>Código referido</th></tr></thead><tbody>
      ${us.map(u => { const os = db().orders.filter(o => o.userId === u.id && o.status !== 'cancelado'); return `<tr><td><b>${esc(u.first)} ${esc(u.last)}</b><div class="tiny muted">${esc(u.email)}</div></td><td>${u.type === 'revendedora' ? '💼 Revendedora' : '💗 Personal'}</td><td><a style="color:var(--vino)" target="_blank" href="https://wa.me/593${esc(u.phone.replace(/^0/, ''))}">${esc(u.phone)}</a></td><td>${esc(u.city)}</td><td>${u.points} · ${Store.levelFor(u.points).cur.name}</td><td>${os.length}</td><td>${M(os.reduce((s, o) => s + o.total, 0))}</td><td>${esc(u.refCode)}</td></tr>`; }).join('')}
      </tbody></table></div>` : '<div class="card"><p class="muted" style="margin:0">Todavía no hay clientas registradas. Cuando alguien se registre en la app, aparecerá aquí.</p></div>'}`;
  };

  S.ajustes = () => {
    const s = db().settings;
    return `<div class="head"><div><h1>Ajustes</h1><p>Datos de la tienda, locales, envíos y pagos.</p></div><button class="btn" id="set-save">Guardar cambios</button></div>
      <div class="alert">Las tarifas de Tramaco y Laar, la dirección del Local 2 y los datos bancarios son de ejemplo. Por favor confírmalos.</div>
      <div class="cols">
        <div>
          <div class="card"><h3>Locales para retiro <button class="btn sm soft" id="st-add">+ Agregar local</button></h3>
            ${s.stores.map((st, i) => `<div class="grid3" data-st="${i}"><div class="field"><label>Nombre</label><input data-k="name" value="${esc(st.name)}"></div><div class="field"><label>Dirección</label><input data-k="address" value="${esc(st.address)}"></div><div class="field"><label>Horario</label><input data-k="hours" value="${esc(st.hours)}"></div></div>`).join('')}</div>
          <div class="card"><h3>Couriers</h3>
            ${s.couriers.map((c, i) => `<div class="grid3" data-cr="${i}" style="grid-template-columns:repeat(4,minmax(0,1fr))"><div class="field"><label>Courier</label><input data-k="name" value="${esc(c.name)}"></div><div class="field"><label>Guayaquil $</label><input data-k="gye" type="number" step="0.25" value="${c.gye}"></div><div class="field"><label>Resto del país $</label><input data-k="resto" type="number" step="0.25" value="${c.resto}"></div><div class="field"><label>Tiempo</label><input data-k="days" value="${esc(c.days)}"></div></div>`).join('')}</div>
        </div>
        <div>
          <div class="card"><h3>Cuenta para transferencias</h3>
            <div class="grid2">${[['bank', 'Banco'], ['type', 'Tipo de cuenta'], ['number', 'Número'], ['holder', 'Titular'], ['ruc', 'RUC']].map(([k, l]) => `<div class="field"><label>${l}</label><input data-bank="${k}" value="${esc(s.bank[k])}"></div>`).join('')}</div></div>
          <div class="card"><h3>Contacto</h3><div class="field"><label>WhatsApp (con 593, sin +)</label><input id="set-wa" value="${esc(s.whatsapp)}"></div></div>
          <div class="card"><h3>Datos de demostración</h3><p class="tiny muted" style="margin-top:0">Borra pedidos, clientas y cambios y vuelve al catálogo original.</p><button class="btn danger sm" id="reset">Reiniciar demo</button></div>
        </div>
      </div>`;
  };

  /* ---------- Render y eventos ---------- */
  function render() {
    $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.s === section));
    const n = db().orders.filter(o => ['nuevo', 'por validar'].includes(o.status)).length;
    $('#n-ped').textContent = n || '';
    const nt = (db().tickets || []).filter(t => t.status === 'pendiente').length;
    $('#n-sop').textContent = nt || '';
    main.innerHTML = S[section]();
    bind();
  }
  function bind() {
    const pvt = $('#pv-t');
    if (pvt) { const up = () => { pvt.textContent = $('#np-title').value; $('#pv-b').textContent = $('#np-body').value; }; up(); $('#np-title').oninput = up; $('#np-body').oninput = up; }
    const pqi = $('#pq');
    if (pqi) pqi.oninput = () => { pq = pqi.value; const pos = pqi.selectionStart; render(); const el = $('#pq'); el.focus(); el.setSelectionRange(pos, pos); };
  }

  main.addEventListener('click', e => {
    const t = e.target;
    const go = t.closest('[data-go]'); if (go) { e.preventDefault(); section = go.dataset.go; render(); return; }
    const or = t.closest('[data-order]'); if (or) return openOrder(or.dataset.order);
    const of = t.closest('[data-of]'); if (of) { oFilter = of.dataset.of; render(); return; }
    const pc = t.closest('[data-pc]'); if (pc) { pcat = pc.dataset.pc; render(); return; }
    const tg = t.closest('[data-t]');
    if (tg) { const p = Store.product(tg.closest('tr').dataset.pid); p[tg.dataset.t] = !p[tg.dataset.t]; commit(); render(); return; }
    if (t.closest('[data-edit]')) return editProduct(t.closest('tr').dataset.pid);
    if (t.id === 'new-p') return editProduct(null);
    const cp = t.closest('[data-cp]'); if (cp) { const c = db().coupons[+cp.dataset.cp]; c.active = !c.active; commit(); render(); return; }
    if (t.id === 'c-add') {
      const code = $('#c-code').value.trim().toUpperCase().replace(/\s/g, '');
      if (!code) return snack('Escribe un código');
      if (db().coupons.some(c => c.code === code)) return snack('Ese código ya existe');
      db().coupons.unshift({ code, type: $('#c-type').value, value: +$('#c-val').value, min: +$('#c-min').value, note: $('#c-note').value, active: true });
      commit('Cupón creado'); render(); return;
    }
    const ct = t.closest('[data-ct]'); if (ct) { const c = db().campaigns[+ct.dataset.ct]; c.active = !c.active; commit(); render(); return; }
    const cd = t.closest('[data-cdel]'); if (cd) { db().campaigns.splice(+cd.dataset.cdel, 1); commit('Campaña eliminada'); render(); return; }
    if (t.id === 'camp-add') { db().campaigns.push({ id: 'c' + Date.now(), time: '20:00', days: 'Todos', title: 'Nuevo aviso', body: 'Mensaje', active: false }); commit(); render(); return; }
    if (t.id === 'np-send') {
      const title = $('#np-title').value.trim(), body = $('#np-body').value.trim();
      if (!title) return snack('Escribe un título');
      db().sentPush = [{ id: 'sp' + Date.now(), title, body, at: Date.now() }, ...(db().sentPush || [])].slice(0, 20);
      commit('Notificación enviada 🔔'); return;
    }
    const tk = t.closest('[data-tk]'); if (tk) { const x = db().tickets[+tk.dataset.tk]; x.status = x.status === 'pendiente' ? 'atendido' : 'pendiente'; commit(); render(); return; }
    if (t.id === 'sp-online') { const sp = db().settings.support; sp.online = !sp.online; commit(sp.online ? 'Zari dirá que hay asesoras disponibles' : 'Zari dirá que no hay nadie disponible'); render(); return; }
    if (t.id === 'sp-save') {
      const sp = db().settings.support;
      $$('[data-day]').forEach(r => { const d = +r.dataset.day; sp.hours[d] = $('[data-closed]', r).checked ? null : [$('[data-h="0"]', r).value, $('[data-h="1"]', r).value]; });
      sp.whatsapp = $('#sp-wa').value.replace(/\D/g, ''); sp.phone = $('#sp-ph').value.replace(/[^\d+]/g, ''); sp.returnsDays = Math.max(1, +$('#sp-ret').value || 3);
      commit('Horario guardado'); render(); return;
    }
    if (t.id === 'st-add') { db().settings.stores.push({ id: 's' + Date.now(), name: 'Nuevo local', address: '', hours: 'Lun a Sáb 9:00 a 18:00' }); commit(); render(); return; }
    if (t.id === 'set-save') {
      const s = db().settings;
      $$('[data-st]').forEach(r => { const st = s.stores[+r.dataset.st]; $$('[data-k]', r).forEach(i => st[i.dataset.k] = i.value.trim()); });
      $$('[data-cr]').forEach(r => { const c = s.couriers[+r.dataset.cr]; $$('[data-k]', r).forEach(i => c[i.dataset.k] = i.type === 'number' ? +i.value : i.value.trim()); });
      $$('[data-bank]').forEach(i => s.bank[i.dataset.bank] = i.value.trim());
      s.whatsapp = $('#set-wa').value.replace(/\D/g, '');
      commit('Ajustes guardados'); return;
    }
    if (t.id === 'reset') { if (confirm('¿Reiniciar la demo? Se borran pedidos, clientas y cambios.')) { Store.reset(); render(); snack('Demo reiniciada'); } }
  });
  main.addEventListener('change', e => {
    const t = e.target;
    if (t.matches('td input.num')) {
      const p = Store.product(t.closest('tr').dataset.pid); const f = t.dataset.f; const v = +t.value;
      if (isNaN(v) || v < 0) return snack('Valor inválido');
      if (f === 'stock') p.stock = Math.round(v); else { p.price[f] = v; if (f === 'pvp') p.pvpEst = false; }
      commit('Guardado ✓'); return;
    }
    if (t.matches('[data-cf]')) { const c = db().campaigns[+t.closest('[data-ci]').dataset.ci]; c[t.dataset.cf] = t.value; commit('Campaña actualizada'); return; }
    if (t.id === 'flash-pct') { db().settings.flashDiscountPct = Math.max(0, Math.min(70, +t.value)); commit('Descuento relámpago actualizado'); }
    if (t.matches('[data-closed]')) { $$('input[type=time]', t.closest('[data-day]')).forEach(i => i.disabled = t.checked); return; }
    if (t.id === 'free-from') { db().settings.freeShippingFrom = Math.max(0, +t.value); commit('Envío gratis actualizado'); }
  });
  window.addEventListener('zar:change', e => { if (e.detail && e.detail.external && !$('#admin').hidden) { const a = document.activeElement; if (!a || !main.contains(a) || a.tagName === 'BUTTON') render(); } });
  // Al final, cuando todo está definido: entra directo si ya ingresó en esta sesión
  if (sessionStorage.getItem('zar_admin') === '1') enter();
})();
