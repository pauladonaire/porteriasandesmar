// turnero-common.js — utilidades compartidas por todas las páginas de turnero
// Cargar DESPUÉS de js/api.js y js/api-turnero.js, y ANTES del script propio de cada página.

function toast(msg, tipo = 'info', duracion = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = 'padding:10px 16px;border-radius:6px;font-size:.85rem;color:#fff;box-shadow:0 4px 12px rgba(0,0,0,.2);' +
    (tipo === 'err' ? 'background:#b91c1c' : tipo === 'ok' ? 'background:#15803d' : 'background:#1e40af');
  container.appendChild(el);
  setTimeout(() => el.remove(), duracion);
}

function guardSesionTurnero() {
  let u = null;
  try { u = Sesion.obtener(); } catch (e) { /* sessionStorage no disponible (ej: abriendo el .html directo desde la carpeta) */ }
  if (!u) { try { window.location.href = 'index.html'; } catch (e) { /* no crítico */ } return null; }
  return u;
}

function initSelectorDeposito(onCambio) {
  const cont = document.getElementById('t-deposito-selector');
  if (!cont) return;
  const actual = TurneroDeposito.obtener();
  cont.querySelectorAll('.t-dep-btn').forEach(btn => {
    btn.classList.toggle('activo', btn.dataset.dep === actual);
    btn.addEventListener('click', () => {
      if (btn.dataset.dep === TurneroDeposito.obtener()) return;
      TurneroDeposito.fijar(btn.dataset.dep);
      cont.querySelectorAll('.t-dep-btn').forEach(b => b.classList.toggle('activo', b === btn));
      if (typeof onCambio === 'function') onCambio(btn.dataset.dep);
    });
  });
}

// Páginas de turnero con acceso restringido por rol — el backend GAS vuelve a
// validar esto en cada acción de todos modos, esto acá es solo para no mostrar el
// botón/pantalla a quien no corresponde.
const PAGINAS_RESTRINGIDAS = {
  'admin-turnero': ['admin', 'admin_deposito'],
  // 'fincarga' es pública (link sin login para celular) — no se restringe acá.
};

function rolPermitidoEnPagina(pagina) {
  const permitidos = PAGINAS_RESTRINGIDAS[pagina];
  if (!permitidos) return true; // página sin restricción
  const u = Sesion.obtener();
  return !!u && permitidos.includes(u.Rol);
}

function initNavTurnero(paginaActual) {
  document.querySelectorAll('.t-nav-btn').forEach(btn => {
    if (!rolPermitidoEnPagina(btn.dataset.pagina)) { btn.remove(); return; }
    btn.addEventListener('click', () => {
      const destino = btn.dataset.pagina;
      if (destino === paginaActual) return;
      window.location.href = destino + '.html';
    });
  });
}

// Tema claro/oscuro — toggle manual, se recuerda en este navegador (localStorage).
// turnero.css ya define la paleta oscura bajo [data-tema="oscuro"]; esto solo prende/
// apaga el atributo. Llamar una vez por página, después de que el botón exista en el DOM.
function initTemaToggle() {
  const KEY = 'ip_turnero_tema';
  const raiz = document.documentElement;

  function aplicar(tema) {
    if (tema === 'oscuro') raiz.setAttribute('data-tema', 'oscuro');
    else raiz.removeAttribute('data-tema');
  }

  let guardado = 'claro';
  try { guardado = localStorage.getItem(KEY) || 'claro'; } catch (e) { /* seguimos en claro */ }
  aplicar(guardado);

  const btn = document.getElementById('btn-toggle-tema');
  if (!btn) return;
  btn.textContent = guardado === 'oscuro' ? '☀️' : '🌙';
  btn.addEventListener('click', () => {
    const actual = raiz.getAttribute('data-tema') === 'oscuro' ? 'oscuro' : 'claro';
    const nuevo = actual === 'oscuro' ? 'claro' : 'oscuro';
    aplicar(nuevo);
    btn.textContent = nuevo === 'oscuro' ? '☀️' : '🌙';
    try { localStorage.setItem(KEY, nuevo); } catch (e) { /* no crítico */ }
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// "HH:mm" -> minutos desde medianoche, o null si no se puede parsear
function minutosDesde(horaHHmm) {
  if (!horaHHmm) return null;
  const partes = String(horaHHmm).split(':');
  const h = Number(partes[0]), m = Number(partes[1]);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function formatDuracion(minTotales) {
  if (minTotales === null || minTotales === undefined || isNaN(minTotales)) return '--:--';
  const h = Math.floor(minTotales / 60);
  const m = Math.round(minTotales % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function fechaHoyDDMMYYYY() {
  const d = new Date();
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

// Convierte "yyyy-MM-dd" (valor de <input type=date>) a "dd/MM/yyyy"
function inputDateADDMMYYYY(valor) {
  if (!valor) return '';
  const [y, m, d] = valor.split('-');
  return d + '/' + m + '/' + y;
}

// Convierte "dd/MM/yyyy" a "yyyy-MM-dd" (para <input type=date>)
function ddmmyyyyAInputDate(valor) {
  if (!valor) return '';
  const [d, m, y] = valor.split('/');
  return y + '-' + m + '-' + d;
}
