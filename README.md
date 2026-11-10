# Zarimport · App de compras (prototipo)

Prototipo funcional de la app de **Zarimport / Zares Beauty**: catálogo, carrito, delivery o retiro, pagos, puntos y pop-ups persuasivos, más un panel para la dueña.

## Demo en línea

- App cliente: https://aurelioochoa.github.io/zarimport-demo/
- Panel de la dueña: https://aurelioochoa.github.io/zarimport-demo/admin.html (PIN de demostración: `1234`)

## Diseño adaptable

La app cliente se adapta al tamaño de la pantalla (`css/app.css`, sección "Diseño adaptable"):
- **Celular** (menos de 600 px): app con barra de pestañas inferior.
- **Tablet** (600 a 899 px): la misma app a todo el ancho, con más columnas de productos.
- **Escritorio** (900 px o más): tienda web con menú y buscador en la cabecera, producto y carrito en dos columnas, pop-ups centrados y pie de página.

## Modo oscuro

La app cliente y el panel tienen tema claro y oscuro (`js/theme.js`):
- Al abrir siguen el tema del dispositivo. Si la persona lo cambia con el botón, esa elección se guarda en el navegador y vale para la app y el panel.
- El botón está en la cabecera de la app (ícono de luna o sol), en "Mi cuenta" y en el menú del panel.
- Los colores salen de variables en `css/app.css` y `css/admin.css`: el bloque `:root[data-theme="dark"]` solo cambia sus valores. `--vino` es el acento para textos y bordes, y `--marca` el relleno de botones y franjas.
- Para que abra siempre en claro, en `js/theme.js` cambia `current()` para que devuelva `saved() || 'light'`.

## Cómo abrirlo

```bash
python tools/serve.py
```

Luego abre:
- App cliente: http://localhost:5173/index.html
- Panel de la dueña: http://localhost:5173/admin.html (PIN de demostración: `1234`)
- Pruebas de logo: http://localhost:5173/logo-tests.html

Los datos se guardan en el navegador (localStorage). Los pedidos hechos en la app aparecen en el panel al instante, y los cambios de estado que se hacen en el panel le llegan a la clienta como notificación.

## Qué incluye

**App cliente** (`index.html`, `js/app.js`, `js/engage.js`)
- 64 productos tomados de los catálogos PDF, con foto, marca, tonos y precios por cantidad: 1 a 2 unidades a P.V.P., 3 a 11 a precio minorista y 12 o más a precio mayorista.
- Categorías: Maquillaje, Skincare, Uñas (todavía vacía), Capilares y Accesorios. También tiene buscador, filtros por marca y orden.
- Registro obligatorio para comprar, con opción de cuenta personal o de revendedora y código de referido.
- Entrega por Tramaco o Laar, o retiro gratis en cualquier local. Barra de envío gratis.
- Pago con tarjeta (simulado) o transferencia con comprobante.
- Puntos y niveles (Rosa, Lila y Vino VIP), check-in diario y programa "invita y gana".
- Pop-ups: regalo de bienvenida, ruleta de 10% a 20% OFF, avisos de "alguien acaba de comprar", oferta relámpago con contador, rescate de carrito abandonado, "¿sigues ahí?", regalo sorpresa diario, aviso de "quedan pocas unidades" y notificaciones push.

**Video demostrativo en el producto**
- Si un producto tiene video, al deslizar la foto hacia la derecha aparece el video, que se reproduce solo, en silencio y en bucle. Tiene un botón para el sonido y la etiqueta "Video ilustrativo generado con IA".
- Jelly Blush (HR736) tiene por ahora un **video de prueba** (`video/hr736-demo.mp4`). Para cambiarlo, pon el video real en la carpeta `video/` y escribe su ruta en Panel → Productos → Editar. Formato recomendado: cuadrado 1:1, de 6 a 8 segundos y menos de 5 MB.

**Zari 💋, asistente de ayuda** (`js/zari.js`)
- Chat dentro de la app. Se abre con el ícono de audífonos, desde "Mi cuenta", desde el detalle de un pedido o desde "¿Olvidaste tu contraseña?".
- Responde sobre pedidos, envíos, retiro, pagos, transferencias, cupones, puntos, precios por cantidad, cambios, contraseña y fallas de la app. También busca productos.
- Aparece sola cuando detecta problemas: dos errores seguidos al pagar, con un cupón, al ingresar o al registrarse, o una búsqueda sin resultados.
- Para pasar con una persona dice con claridad si **hay asesoras disponibles ahora**, si **están ocupadas** o si es **fuera de horario**, y en este último caso cuándo vuelven. Ofrece WhatsApp con el mensaje ya escrito, llamada o dejar un mensaje que llega al panel.
- En el prototipo responde con reglas y datos reales de la app. En producción, lo que no entienda se envía a un modelo de IA (Claude) desde el servidor, con la información de la tienda como contexto.

**Panel** (`admin.html`, `js/admin.js`)
- Resumen de ventas, pedidos por atender, lo más vendido y stock bajo.
- Pedidos: validar transferencias y cambiar el estado (la clienta recibe una push en cada cambio).
- Productos: editar precios, stock, oferta relámpago y activar o desactivar. Crear productos con foto.
- Promociones: cupones, porcentaje de la oferta relámpago y monto para envío gratis.
- Notificaciones: campañas programadas en los horarios recomendados y envío inmediato.
- Soporte · Zari: mensajes de clientas, interruptor de "hay alguien atendiendo", horario de atención por día, WhatsApp y teléfono de soporte.
- Clientes y ajustes: locales, tarifas de courier, cuenta bancaria y WhatsApp.

## Datos que hay que confirmar
- **27 productos sin P.V.P.** en el catálogo: puse un precio estimado de más o menos el doble del mayorista. Aparecen como "estimado" en el panel.
- Tarifas reales de **Tramaco** y **Laar**.
- Dirección del **Local 2** y de otros locales.
- **Datos bancarios** para las transferencias y número de **WhatsApp**.
- **Horario de atención** de las asesoras (puse lunes a viernes de 9:00 a 18:30 y sábado de 9:00 a 14:00), teléfono de soporte y días para reportar cambios (puse 3).
- Productos de **uñas** (no venían en los catálogos).
- Las fotos son las páginas del catálogo y traen precios impresos. Para publicar conviene usar fotos limpias de cada producto.

## Para publicar en Play Store y App Store
1. **Backend**: Firebase o Supabase para usuarias, pedidos, productos e inventario. Reemplaza a `js/store.js`.
2. **App nativa**: empaquetar esta interfaz con **Capacitor** (es lo más rápido) o pasarla a React Native o Flutter.
3. **Pagos**: integrar **Payphone**, **Datafast** o **Kushki**. Los datos de tarjeta nunca pasan por la app.
4. **Push reales**: Firebase Cloud Messaging con los horarios del panel (hora de Ecuador, UTC-5).
5. **Cuentas de desarrollador**: Google Play (pago único de USD 25) y Apple Developer (USD 99 al año).
6. Política de privacidad y términos, que las tiendas exigen.

## Regenerar el catálogo
```bash
python tools/build_catalog.py "ruta/ZARESBEAUTY.pdf" "ruta/ZARESBEAUTY-1.pdf"
```
Necesita `pip install pymupdf`. La lista de productos y sus precios está en `tools/build_catalog.py`.
