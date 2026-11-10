/* Zari 💋 · asistente virtual de Zarimport.
   En el prototipo responde con reglas y con los datos reales de la app (pedidos,
   envíos, locales, cupones, puntos, productos). En producción, las preguntas que
   no entienda se envían a un modelo de IA (Claude) desde el servidor. Ver README. */
(function () {
  const A = window.App; if (!A) return;
  const $ = s => document.querySelector(s);
  const { esc, M } = A;
  const db = () => Store.db;
  const ui = A.ui;
  ui.chat = ui.chat || [];

  const LIPS = '<svg viewBox="0 0 64 40" fill="none"><path d="M3 20C10 20 15 7 24 7c5 0 7 4 8 4s3-4 8-4c9 0 14 13 21 13-7 4-14 16-29 16S10 24 3 20Z" fill="#fff"/><path d="M8 20c9 2 16 1 24-3 8 4 15 5 24 3" stroke="#931B4A" stroke-width="2.2" stroke-linecap="round"/></svg>';
  const avatar = (cls = '') => `<span class="zari-av ${cls}">${LIPS}</span>`;

  /* ---------- Utilidades ---------- */
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const has = (t, words) => words.some(w => t.includes(w));
  const firstName = () => (A.me() ? A.me().first : '');
  const btn = (label, act, cls = '') => `<button class="zchip ${cls}" data-z="${esc(act)}">${label}</button>`;
  const link = (label, href, cls = '') => `<a class="zchip ${cls}" href="${href}" ${href.startsWith('http') || href.startsWith('tel') ? 'target="_blank"' : ''}>${label}</a>`;
  const MAIN_CHIPS = () => [btn('📦 Mi pedido', 'pedido'), btn('🚚 Envíos', 'envio'), btn('💳 Pagos', 'pago'), btn('🏷️ Cupones', 'cupon'), btn('🔄 Cambios', 'devolucion'), btn('👩 Hablar con una persona', 'humano', 'strong')].join('');

  /* ---------- Conversación ---------- */
  let failCount = 0;
  function push(from, html, extra = {}) {
    ui.chat.push({ from, html, ts: Date.now(), ...extra });
    ui.chat = ui.chat.slice(-60);
    A.saveUI();
  }
  function botSay(html, chips = '') {
    return new Promise(res => {
      const list = $('#zmsgs');
      if (list) {
        const t = document.createElement('div');
        t.className = 'zrow bot'; t.innerHTML = avatar('sm') + '<div class="zbub typing"><i></i><i></i><i></i></div>';
        list.appendChild(t); scroll();
      }
      setTimeout(() => {
        push('bot', html + (chips ? `<div class="zchips">${chips}</div>` : ''));
        paint(); res();
      }, Math.min(1400, 450 + html.length * 4));
    });
  }
  function scroll() { const v = $('#zmsgs'); if (v) v.scrollTop = v.scrollHeight; }

  function greet(ctx) {
    const st = Store.supportStatus();
    const hi = firstName() ? `¡Hola, ${esc(firstName())}! 💗` : '¡Hola! 💗';
    const intro = `${hi} Soy <b>Zari</b>, la asistente virtual de Zarimport. Te ayudo con tus pedidos, envíos, pagos, cupones y productos.`;
    const human = st.available ? '🟢 Si lo necesitas, también hay <b>asesoras disponibles ahora</b>.' : `🌙 Las asesoras atienden ${esc(st.summary[0].toLowerCase())}${st.next ? `. Vuelven ${st.next.label} a las ${st.next.time}` : ''}. Yo estoy aquí las 24 horas.`;
    const byCtx = {
      pago: 'Vi que tuviste problemas al pagar. ¿Te ayudo a revisarlo?',
      direccion: 'Parece que faltan datos de tu dirección de entrega. ¿Te explico?',
      cupon: 'Vi que tu cupón no funcionó. ¿Lo revisamos juntas?',
      login: '¿No puedes entrar a tu cuenta? Te ayudo.',
      registro: '¿Tienes problemas para crear tu cuenta? Te ayudo.',
      busqueda: '¿No encuentras lo que buscas? Dime qué producto quieres y lo busco por ti.',
      pedido: '¿Tienes dudas con tu pedido? Te ayudo.',
    };
    push('bot', `${intro}<br><br>${human}`);
    if (ctx && byCtx[ctx]) push('bot', byCtx[ctx] + `<div class="zchips">${chipsFor(ctx)}</div>`);
    else push('bot', '¿En qué te ayudo hoy?' + `<div class="zchips">${MAIN_CHIPS()}</div>`);
  }
  function chipsFor(ctx) {
    const m = { pago: ['pago', 'tarjeta', 'transferencia'], direccion: ['envio', 'retiro'], cupon: ['cupon', 'puntos'], login: ['clave', 'registro'], registro: ['registro', 'clave'], busqueda: ['buscar'], pedido: ['pedido', 'devolucion'] }[ctx] || [];
    const L = { pago: '💳 Métodos de pago', tarjeta: '❌ Mi tarjeta no pasa', transferencia: '🏦 Cómo transferir', envio: '🚚 Envíos y costos', retiro: '🏬 Retirar en local', cupon: '🏷️ Mi cupón no funciona', puntos: '⭐ Mis puntos', clave: '🔑 Olvidé mi contraseña', registro: '📝 Problemas al registrarme', buscar: '🔎 Buscar un producto', pedido: '📦 Estado de mi pedido', devolucion: '🔄 Cambios y devoluciones' };
    return m.map(k => btn(L[k], k)).join('') + btn('👩 Hablar con una persona', 'humano', 'strong');
  }

  /* ---------- Respuestas ---------- */
  const R = {};
  R.saludo = () => botSay(`¡Hola${firstName() ? ', ' + esc(firstName()) : ''}! ✨ ¿En qué te ayudo?`, MAIN_CHIPS());
  R.gracias = () => botSay('¡Con gusto! 💗 Si necesitas algo más, aquí estoy.', btn('Tengo otra pregunta', 'menu') + link('Seguir comprando', '#/'));
  R.menu = () => botSay('Claro, elige un tema o escríbeme tu pregunta:', MAIN_CHIPS());

  R.pedido = () => {
    const u = A.me();
    if (!u) return botSay('Para ver tus pedidos necesito que ingreses a tu cuenta.', link('Ingresar', '#/login') + link('Crear cuenta', '#/registro'));
    const os = db().orders.filter(o => o.userId === u.id).slice(0, 3);
    if (!os.length) return botSay('Todavía no tienes pedidos en la app. ¿Te ayudo a encontrar algo?', btn('🔎 Buscar un producto', 'buscar') + link('Ver ofertas', '#/ofertas'));
    const LBL = { nuevo: 'Recibido ✅', 'por validar': 'Validando tu transferencia ⏳', preparando: 'Preparando tu pedido 👩‍🔧', enviado: 'En camino 🚚', listo: 'Listo para retirar 🏬', entregado: 'Entregado 💗', cancelado: 'Cancelado' };
    const rows = os.map(o => `<a class="zorder" href="#/pedido/${o.id}"><b>${o.id}</b> · ${M(o.total)}<br><span>${LBL[o.status] || o.status}</span></a>`).join('');
    const pend = os.find(o => o.status === 'por validar');
    return botSay(`Estos son tus últimos pedidos:${rows}${pend ? `<br>⏳ El pedido <b>${pend.id}</b> está esperando que validemos tu transferencia. Eso se hace en horario de atención y te llega una notificación apenas se apruebe.` : ''}`, btn('Mi pedido se demora', 'demora') + btn('🔄 Cambios', 'devolucion') + btn('👩 Hablar con una persona', 'humano', 'strong'));
  };
  R.demora = () => {
    const c = db().settings.couriers;
    return botSay(`Los tiempos normales son: ${c.map(x => `<b>${esc(x.name)}</b> ${esc(x.days)}`).join(' · ')}. Para retiro en local, te avisamos cuando esté listo (normalmente el mismo día).<br><br>Si ya pasó ese tiempo, lo mejor es que una asesora revise tu guía con el courier.`, btn('👩 Hablar con una persona', 'humano', 'strong') + btn('Ver mis pedidos', 'pedido'));
  };
  R.envio = () => {
    const s = db().settings, f = A.freeShipFrom();
    return botSay(`🚚 Enviamos a todo Ecuador con:<br>${s.couriers.map(c => `• <b>${esc(c.name)}</b>: Guayaquil ${M(c.gye)} · resto del país ${M(c.resto)} (${esc(c.days)})`).join('<br>')}<br><br>${f ? `🎉 <b>Envío GRATIS</b> en compras desde ${M(f)}.` : '🎉 Como Vino VIP tienes <b>envío gratis siempre</b>.'}<br>🏬 También puedes <b>retirar gratis</b> en nuestros locales.`, btn('🏬 Ver locales', 'retiro') + btn('Mi pedido se demora', 'demora'));
  };
  R.retiro = () => {
    const s = db().settings;
    return botSay(`🏬 Puedes retirar <b>gratis</b> en:<br>${s.stores.map(st => `• <b>${esc(st.name)}</b><br>&nbsp;&nbsp;${esc(st.address)}<br>&nbsp;&nbsp;🕘 ${esc(st.hours)}`).join('<br>')}<br><br>Al pagar elige <b>"Retiro en local"</b>. Te avisamos por notificación cuando esté listo. Lleva tu cédula y el número de pedido.`, btn('🚚 Envíos a domicilio', 'envio'));
  };
  R.pago = () => botSay('Aceptamos:<br>💳 <b>Tarjeta de crédito o débito</b> (Visa, Mastercard, Diners): se aprueba al instante.<br>🏦 <b>Transferencia bancaria</b>: subes la foto del comprobante y lo validamos en horario de atención.', btn('❌ Mi tarjeta no pasa', 'tarjeta') + btn('🏦 Cómo transferir', 'transferencia'));
  R.tarjeta = () => botSay('Revisemos lo más común cuando una tarjeta no pasa:<br>1️⃣ Que el número, la fecha (MM/AA) y el CVV estén bien escritos.<br>2️⃣ Que tu tarjeta tenga habilitadas las <b>compras por internet</b> (algunos bancos lo piden en su app).<br>3️⃣ Que tengas cupo o saldo suficiente.<br><br>Si sigue sin pasar, puedes pagar por <b>transferencia</b> o pedir ayuda a una asesora.', btn('🏦 Pagar por transferencia', 'transferencia') + btn('👩 Hablar con una persona', 'humano', 'strong'));
  R.transferencia = () => {
    const b = db().settings.bank;
    return botSay(`🏦 Datos para transferir:<br>• Banco: <b>${esc(b.bank)}</b><br>• Cuenta ${esc(b.type)}: <b>${esc(b.number)}</b><br>• Titular: <b>${esc(b.holder)}</b><br>• RUC: <b>${esc(b.ruc)}</b><br><br>Al finalizar la compra elige "Transferencia" y sube la foto del comprobante. Separamos tu pedido 24 horas mientras validamos.`, btn('Ya transferí y no lo validan', 'validacion'));
  };
  R.validacion = () => {
    const st = Store.supportStatus();
    return botSay(st.inHours ? 'Las transferencias se validan en horario de atención, normalmente en pocos minutos. Si ya pasó más de 1 hora, una asesora puede revisarlo contigo.' : `Ahora estamos <b>fuera de horario</b>, por eso tu transferencia aún no se valida. Se revisa ${st.next ? `<b>${st.next.label} desde las ${st.next.time}</b>` : 'en el siguiente horario de atención'} y te llegará una notificación. Tu pedido sigue separado. 💗`, btn('👩 Hablar con una persona', 'humano', 'strong'));
  };
  R.cupon = () => {
    const w = ui.wallet;
    return botSay(`Revisa estas 3 cosas:<br>1️⃣ Escríbelo igual, sin espacios (ej. <b>BIENVENIDA10</b>).<br>2️⃣ Cada cupón tiene una <b>compra mínima</b>: por ejemplo, BIENVENIDA10 aplica desde $10.<br>3️⃣ Solo se usa <b>un cupón por pedido</b>.${w.length ? `<br><br>Tus cupones guardados: ${w.map(c => `<b>${esc(c)}</b>`).join(', ')}` : ''}`, link('Ver cupones disponibles', '#/ofertas') + btn('⭐ Mis puntos', 'puntos'));
  };
  R.puntos = () => {
    const u = A.me();
    if (!u) return botSay('Al crear tu cuenta te regalamos 50 puntos y ganas 1 punto por cada $1. ¿Te registras?', link('Crear cuenta', '#/registro'));
    const { cur, next } = Store.levelFor(u.points);
    return botSay(`⭐ Tienes <b>${u.points} puntos</b> y eres nivel <b>${esc(cur.name)}</b>.${next ? ` Te faltan ${next.from - u.points} para llegar a ${esc(next.name)}.` : ''}<br>Ganas puntos con cada compra, con el check-in diario y al invitar amigas.`, link('Ir a mi cuenta', '#/perfil'));
  };
  R.mayorista = () => botSay('💼 Nuestros precios bajan según la cantidad que lleves de cada producto:<br>• 1 a 2 unidades: <b>P.V.P.</b><br>• 3 a 11 unidades: <b>precio minorista</b><br>• 12 o más: <b>precio mayorista</b><br><br>Se aplica solo en el carrito, no necesitas código.', link('Programa de revendedoras', '#/revendedoras'));
  R.devolucion = () => {
    const d = db().settings.support.returnsDays;
    return botSay(`🔄 Si tu producto llegó dañado o no es lo que pediste, tienes <b>${d} días</b> desde que lo recibes para reportarlo. Ten a la mano:<br>• Tu número de pedido<br>• Fotos del producto y del empaque<br><br>Los cambios los gestiona una asesora.`, btn('👩 Hablar con una persona', 'humano', 'strong') + btn('Ver mis pedidos', 'pedido'));
  };
  R.clave = () => botSay('🔑 Para recuperar tu contraseña, una asesora verifica tu identidad con tu cédula y celular, y te ayuda a crear una nueva.<br><br>Mientras tanto, revisa que tu celular tenga 10 dígitos y empiece con 0 (ej. 0991234567).', btn('👩 Hablar con una persona', 'humano', 'strong'));
  R.registro = () => botSay('Para crear tu cuenta revisa:<br>• Celular de <b>10 dígitos</b> que empiece con 0<br>• Un correo válido<br>• Contraseña de <b>mínimo 6 caracteres</b> (puedes tocar el 👁️ para verla)<br><br>Si ya existe una cuenta con tu celular o correo, ingresa con ella.', link('Crear cuenta', '#/registro') + link('Ingresar', '#/login'));
  R.horario = () => {
    const st = Store.supportStatus(), s = db().settings;
    return botSay(`🕘 <b>Atención con asesoras</b> (hora de Ecuador):<br>${st.summary.map(x => '• ' + esc(x)).join('<br>')}<br><br>🏬 <b>Locales</b>:<br>${s.stores.map(x => `• ${esc(x.name)}: ${esc(x.hours)}`).join('<br>')}<br><br>${statusLine(st)}`, btn('👩 Hablar con una persona', 'humano', 'strong'));
  };
  R.app = () => botSay('Lamento que la app te esté fallando 😔 Prueba esto:<br>1️⃣ Cierra la app y vuelve a abrirla.<br>2️⃣ Revisa tu conexión a internet.<br>3️⃣ Actualiza la app a la última versión.<br><br>Si sigue igual, cuéntale a una asesora qué pantalla falla.', btn('👩 Hablar con una persona', 'humano', 'strong'));
  R.buscar = () => botSay('¡Claro! Escríbeme qué buscas. Por ejemplo: <i>"labial rojo"</i>, <i>"brocha para rubor"</i> o <i>"cosmetiquera"</i>. 🔎');

  function searchProducts(t) {
    const stop = ['tienen', 'tiene', 'hay', 'busco', 'quiero', 'necesito', 'venden', 'algun', 'alguna', 'un', 'una', 'de', 'para', 'el', 'la', 'los', 'las', 'con', 'precio', 'cuanto', 'cuesta', 'vale', 'me', 'por', 'favor', 'que', 'y'];
    const words = norm(t).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stop.includes(w));
    if (!words.length) return [];
    return A.active().map(p => {
      const hay = norm(p.name + ' ' + p.brand + ' ' + p.cat + ' ' + p.tones.join(' '));
      const score = words.reduce((s, w) => s + (hay.includes(w) ? 2 : hay.includes(w.slice(0, -1)) ? 1 : 0), 0);
      return { p, score };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 4).map(x => x.p);
  }
  function showProducts(list, q) {
    return botSay(`Encontré esto para "<b>${esc(q)}</b>":<div class="zprods">${list.map(p => `<a href="#/p/${encodeURIComponent(p.id)}"><img src="${p.img}" alt=""><span>${esc(p.name)}</span><b>${M(Store.unitPrice(p, 1))}</b></a>`).join('')}</div>`, link('Ver más en el catálogo', '#/buscar/' + encodeURIComponent(q)));
  }

  /* ---------- Derivación a una persona ---------- */
  function statusLine(st) {
    if (st.available) return `🟢 <b>Ahora sí hay asesoras disponibles</b> (hoy atendemos de ${esc(st.today)}).`;
    if (st.inHours) return '🟡 <b>Estamos en horario, pero en este momento todas las asesoras están ocupadas.</b>';
    return `🔴 <b>Ahora estamos fuera de horario</b> (en Ecuador son las ${st.now}). <b>No hay asesoras disponibles en este momento.</b>`;
  }
  function waText() {
    const u = A.me();
    const last = ui.chat.filter(m => m.from === 'me').slice(-3).map(m => '• ' + m.text).join('\n');
    const o = u && db().orders.find(x => x.userId === u.id);
    return `Hola Zarimport, necesito ayuda.${u ? `\nSoy ${u.first} ${u.last} (${u.phone}).` : ''}${o ? `\nÚltimo pedido: ${o.id}` : ''}${last ? `\nMi consulta:\n${last}` : ''}`;
  }
  R.humano = () => {
    const st = Store.supportStatus(), sp = db().settings.support;
    const wa = `https://wa.me/${sp.whatsapp}?text=${encodeURIComponent(waText())}`;
    const sched = st.summary.map(x => '• ' + esc(x)).join('<br>');
    if (st.available) {
      return botSay(`${statusLine(st)}<br><br>Escríbele a una asesora por WhatsApp. Ya preparé el mensaje con tus datos y tu consulta para que no tengas que repetir nada. Atendemos hasta las <b>${esc(st.closesAt)}</b>.`,
        link('💬 Abrir WhatsApp', wa, 'strong') + link('📞 Llamar', 'tel:' + sp.phone) + btn('Prefiero dejar un mensaje', 'ticket'));
    }
    if (st.inHours) {
      return botSay(`${statusLine(st)}<br><br>Déjanos tu mensaje y una asesora te escribe <b>apenas se libere</b>, hoy mismo antes de las ${esc(st.closesAt)}. También puedes escribir por WhatsApp y te responden en orden de llegada.`,
        btn('✍️ Dejar mi mensaje', 'ticket', 'strong') + link('💬 WhatsApp', wa));
    }
    return botSay(`${statusLine(st)}<br><br>⏰ Volvemos a atender <b>${st.next ? `${st.next.label} a las ${st.next.time}` : 'en el siguiente horario'}</b>.<br><br><b>Horario de atención:</b><br>${sched}<br><br>Déjame tu mensaje y una asesora te escribe <b>apenas abramos</b>. Mientras tanto, yo sigo aquí para lo que pueda resolver. 💗`,
      btn('✍️ Dejar mi mensaje', 'ticket', 'strong') + link('💬 WhatsApp (responden al abrir)', wa));
  };
  R.ticket = () => {
    const u = A.me();
    const lastQ = ui.chat.filter(m => m.from === 'me').slice(-1)[0];
    push('bot', `Cuéntame tu caso y te contactamos 👇
      <form class="zform" id="zticket">
        <input name="name" placeholder="Tu nombre" value="${esc(u ? u.first + ' ' + u.last : '')}" required>
        <input name="phone" placeholder="Celular (09xxxxxxxx)" inputmode="tel" value="${esc(u ? u.phone : '')}" required>
        <textarea name="msg" placeholder="¿Qué pasó? Incluye tu número de pedido si tienes" required>${esc(lastQ ? lastQ.text : '')}</textarea>
        <button class="btn sm">Enviar a una asesora</button>
      </form>`, { form: true });
    paint();
  };
  function submitTicket(f) {
    const name = f.name.value.trim(), phone = f.phone.value.trim(), msg = f.msg.value.trim();
    if (!name || !/^0\d{9}$/.test(phone) || msg.length < 5) { A.snack('Completa tu nombre, un celular válido y tu mensaje'); return; }
    const st = Store.supportStatus();
    const t = { id: 'T-' + String(Date.now()).slice(-5), name, phone, msg, userId: A.me() ? A.me().id : null, ts: Date.now(), status: 'pendiente', inHours: st.inHours, transcript: ui.chat.filter(m => m.text).slice(-6).map(m => m.text) };
    db().tickets.unshift(t); Store.commit();
    ui.chat = ui.chat.map(m => m.form ? { ...m, form: false, html: '📝 Mensaje enviado a una asesora.' } : m);
    push('me', esc(msg), { text: msg });
    A.notify('💬', 'Tu mensaje llegó a Zarimport', `Caso ${t.id}. Te escribiremos al ${phone}.`, '#/ayuda');
    botSay(`✅ Listo, tu caso es el <b>${t.id}</b>.<br>${st.available || st.inHours ? `Una asesora te escribirá al <b>${esc(phone)}</b> hoy, antes de las ${esc(st.closesAt)}.` : `Una asesora te escribirá al <b>${esc(phone)}</b> ${st.next ? `<b>${st.next.label} desde las ${st.next.time}</b>` : 'en el siguiente horario de atención'}.`}<br>Te llegará también una notificación. 💗`, btn('Tengo otra pregunta', 'menu') + link('Seguir comprando', '#/'));
  }

  /* ---------- Entender lo que escribe ---------- */
  const INTENTS = [
    ['humano', ['persona', 'humano', 'asesor', 'asesora', 'operador', 'operadora', 'agente', 'hablar con', 'llamar', 'llamada', 'telefono', 'whatsapp', 'atencion al cliente', 'alguien']],
    ['horario', ['horario', 'hora atienden', 'a que hora', 'atienden', 'abren', 'cierran', 'abierto']],
    ['validacion', ['no validan', 'no han validado', 'valid', 'aprobaron mi transferencia', 'ya transferi', 'ya pague']],
    ['tarjeta', ['tarjeta no', 'rechaz', 'no pasa', 'declin', 'no me deja pagar', 'error al pagar', 'no puedo pagar']],
    ['transferencia', ['transfer', 'deposito', 'cuenta bancaria', 'numero de cuenta', 'comprobante']],
    ['pago', ['pago', 'pagar', 'tarjeta', 'credito', 'debito', 'efectivo', 'metodos']],
    ['devolucion', ['devol', 'cambio', 'cambiar', 'danad', 'roto', 'equivocad', 'reclamo', 'defect', 'no es lo que', 'garantia', 'mal estado']],
    ['demora', ['demora', 'no llega', 'no ha llegado', 'tarda', 'retras', 'cuando llega', 'guia']],
    ['pedido', ['pedido', 'orden', 'compra', 'seguimiento', 'rastre', 'estado']],
    ['retiro', ['retir', 'recoger', 'local', 'tienda', 'direccion', 'ubicacion', 'donde quedan', 'donde estan']],
    ['envio', ['envio', 'enviar', 'delivery', 'domicilio', 'tramaco', 'laar', 'courier', 'costo de envio', 'provincia', 'quito', 'cuenca']],
    ['cupon', ['cupon', 'codigo', 'descuento', 'promo']],
    ['puntos', ['punto', 'nivel', 'vip', 'check']],
    ['mayorista', ['mayor', 'docena', 'revend', 'por cantidad', 'al por mayor', 'emprend']],
    ['clave', ['contrasena', 'clave', 'olvide', 'recuperar']],
    ['registro', ['registr', 'crear cuenta', 'no puedo entrar', 'iniciar sesion', 'ingresar', 'cuenta']],
    ['app', ['no carga', 'se cierra', 'falla', 'error', 'bug', 'lento', 'no funciona', 'pantalla']],
    ['gracias', ['gracias', 'listo', 'perfecto', 'genial', 'ok', 'chevere', 'bacan']],
    ['saludo', ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'hey']],
  ];
  function understand(text) {
    const t = norm(text);
    for (const [intent, words] of INTENTS) if (has(t, words)) return intent;
    return null;
  }
  async function handle(text) {
    push('me', esc(text), { text });
    paint();
    const intent = understand(text);
    if (intent && intent !== 'saludo' && intent !== 'gracias') { failCount = 0; return R[intent](); }
    const found = searchProducts(text);
    if (found.length) { failCount = 0; return showProducts(found, text); }
    if (intent) return R[intent]();
    failCount++;
    if (failCount >= 2) { failCount = 0; return botSay('Perdón, no logro entenderte bien 😔 Mejor te paso con una persona para que te ayude.', btn('👩 Hablar con una persona', 'humano', 'strong') + btn('Ver temas de ayuda', 'menu')); }
    return botSay('Mmm, no estoy segura de haber entendido 🤔 ¿Es sobre alguno de estos temas?', MAIN_CHIPS());
  }

  /* ---------- Vista ---------- */
  function view() {
    const st = Store.supportStatus();
    return `<div class="zari">
      <div class="zhead">
        <a class="icon-btn" href="javascript:history.back()" aria-label="Volver"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg></a>
        ${avatar()}
        <div class="zname"><b>Zari</b><small>Asistente virtual · responde al instante</small></div>
        <button class="zstatus ${st.available ? 'on' : st.inHours ? 'busy' : 'off'}" data-z="horario" title="Ver horarios">${st.available ? 'Asesoras en línea' : st.inHours ? 'Asesoras ocupadas' : 'Fuera de horario'}</button>
      </div>
      <div class="zmsgs" id="zmsgs"></div>
      <form class="zinput" id="zform"><input id="ztext" placeholder="Escribe tu pregunta…" autocomplete="off" maxlength="300"><button aria-label="Enviar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12 20 4l-6 16-3-7z"/></svg></button></form>
    </div>`;
  }
  function paint() {
    const list = $('#zmsgs'); if (!list) return;
    let lastDay = '';
    list.innerHTML = ui.chat.map((m, i) => {
      const isLastBot = m.from === 'bot' && !ui.chat.slice(i + 1).some(x => x.from === 'bot');
      const html = m.from === 'bot' && !isLastBot ? m.html.replace(/<div class="zchips">[\s\S]*?<\/div>$/, '') : m.html;
      const day = new Date(m.ts).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' });
      const sep = day !== lastDay ? `<div class="zday">${day}</div>` : ''; lastDay = day;
      return `${sep}<div class="zrow ${m.from}">${m.from === 'bot' ? avatar('sm') : ''}<div class="zbub">${html}<time>${new Date(m.ts).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}</time></div></div>`;
    }).join('');
    scroll();
  }
  function afterRender(h) {
    const isChat = h.startsWith('#/ayuda');
    $('#view').classList.toggle('chat-mode', isChat);
    if (!isChat) return;
    const ctx = (h.split('?ctx=')[1] || '').trim();
    if (!ui.chat.length || ctx || Date.now() - ui.chat[ui.chat.length - 1].ts > 6 * 3600e3) greet(ctx);
    paint();
    if (ctx) history.replaceState(null, '', '#/ayuda');
    $('#zform').onsubmit = e => { e.preventDefault(); const i = $('#ztext'); const v = i.value.trim(); if (!v) return; i.value = ''; handle(v); };
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-z]'); if (!b) return;
    e.preventDefault();
    const act = b.dataset.z;
    if (!R[act]) return;
    if (!location.hash.startsWith('#/ayuda')) { location.hash = '#/ayuda'; setTimeout(() => R[act](), 300); return; }
    push('me', esc(b.textContent.trim()), { text: b.textContent.trim() });
    paint(); R[act]();
  });
  document.addEventListener('submit', e => { if (e.target.id === 'zticket') { e.preventDefault(); submitTicket(e.target); } });

  /* ---------- Detectar que alguien tiene problemas ---------- */
  const trouble = {};
  const NUDGE = {
    pago: '¿Problemas para pagar? Te ayudo a resolverlo 💳',
    direccion: '¿Dudas con la dirección de entrega? Te explico 🚚',
    cupon: '¿Tu cupón no funciona? Lo revisamos juntas 🏷️',
    login: '¿No puedes entrar a tu cuenta? Te ayudo 🔑',
    registro: '¿Problemas para registrarte? Te ayudo 📝',
    busqueda: '¿No encuentras lo que buscas? Yo lo busco por ti 🔎',
  };
  function onTrouble(ctx) {
    const now = Date.now();
    const t = trouble[ctx] = (trouble[ctx] || []).filter(x => now - x < 120e3);
    t.push(now);
    const need = ctx === 'busqueda' ? 1 : 2; // a la 2da falla en 2 minutos (búsqueda: a la 1ra)
    if (t.length >= need && !t.nudged) { t.nudged = true; trouble[ctx] = []; nudge(ctx); }
  }
  function nudge(ctx) {
    const layer = $('#layer'); if (!layer || layer.querySelector('.zari-nudge')) return;
    const n = document.createElement('a');
    n.className = 'zari-nudge'; n.href = '#/ayuda?ctx=' + ctx;
    n.innerHTML = `${avatar()}<div><b>Zari</b><span>${NUDGE[ctx] || '¿Necesitas ayuda? Estoy aquí 💗'}</span></div><button aria-label="Cerrar">×</button>`;
    layer.appendChild(n);
    requestAnimationFrame(() => requestAnimationFrame(() => n.classList.add('show')));
    const kill = () => { n.classList.remove('show'); setTimeout(() => n.remove(), 400); };
    n.querySelector('button').onclick = e => { e.preventDefault(); e.stopPropagation(); kill(); };
    n.addEventListener('click', () => setTimeout(kill, 100));
    setTimeout(kill, 12000);
  }

  window.Zari = { view, afterRender, onTrouble, open: ctx => { location.hash = '#/ayuda' + (ctx ? '?ctx=' + ctx : ''); } };
  if (location.hash.startsWith('#/ayuda')) A.render();
})();
