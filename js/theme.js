/* Tema claro / oscuro, compartido por la app y el panel.
   Se carga en <head> antes de los estilos para que la página no parpadee al abrir.
   Sin elección guardada sigue el tema del dispositivo; el botón guarda la preferencia. */
(function () {
  var KEY = 'zar_theme';
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function saved() {
    try { var t = localStorage.getItem(KEY); return t === 'dark' || t === 'light' ? t : null; } catch (e) { return null; }
  }
  function current() { return saved() || (mq && mq.matches ? 'dark' : 'light'); }
  function apply() {
    var t = current();
    root.setAttribute('data-theme', t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'dark' ? '#151013' : '#931B4A');
    var bs = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < bs.length; i++) bs[i].setAttribute('aria-pressed', String(t === 'dark'));
  }
  function set(t) { try { localStorage.setItem(KEY, t); } catch (e) {} apply(); }
  function toggle() { set(current() === 'dark' ? 'light' : 'dark'); }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-theme-toggle]');
    if (b) { e.preventDefault(); toggle(); }
  });
  // Si no hay preferencia guardada, acompaña los cambios del dispositivo
  if (mq) { if (mq.addEventListener) mq.addEventListener('change', apply); else if (mq.addListener) mq.addListener(apply); }
  // Mantiene sincronizadas la app y el panel cuando están abiertos en pestañas distintas
  window.addEventListener('storage', function (e) { if (e.key === KEY) apply(); });
  document.addEventListener('DOMContentLoaded', apply);

  window.Theme = { get: current, set: set, toggle: toggle };
  apply();
})();
