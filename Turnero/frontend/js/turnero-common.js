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

// Roles fijados a su propio depósito (columna Deposito_Turnero del usuario, MZA o
// BUE) fuera del panel de Administración: no pueden cambiar de depósito desde el
// selector en Playa/Turnos/Indicadores/Tiempo de Carga. El backend GAS de esas
// pantallas no valida depósito por rol (a diferencia de Administración, gateada por
// validarAdminDeposito_), así que este selector bloqueado es la única barrera real.
const ROLES_DEPOSITO_FIJO = ['admin_deposito', 'operaciones', 'distribucion'];

// Como initSelectorDeposito, pero si el rol está en ROLES_DEPOSITO_FIJO, oculta las
// otras opciones y fuerza el depósito del usuario en vez de dejarlo elegir.
function initSelectorDepositoRol(onCambio) {
  const u = Sesion.obtener();
  if (u && ROLES_DEPOSITO_FIJO.includes(u.Rol)) {
    const dep = String(u.Deposito_Turnero || '').trim().toUpperCase();
    const cont = document.getElementById('t-deposito-selector');
    if (dep !== 'MZA' && dep !== 'BUE') {
      toast('Tu usuario no tiene un depósito asignado (columna Deposito_Turnero en USUARIOS). Pedile al administrador que lo complete.', 'err', 6000);
      if (typeof onCambio === 'function') onCambio(TurneroDeposito.obtener());
      return;
    }
    TurneroDeposito.fijar(dep);
    if (cont) {
      cont.querySelectorAll('.t-dep-btn').forEach(btn => {
        if (btn.dataset.dep !== dep) { btn.style.display = 'none'; }
        else { btn.classList.add('activo'); btn.disabled = true; btn.style.cursor = 'default'; btn.style.opacity = '1'; }
      });
    }
    if (typeof onCambio === 'function') onCambio(dep);
    return;
  }
  initSelectorDeposito(onCambio);
}

// Páginas de turnero con acceso restringido por rol — el backend GAS vuelve a
// validar esto en cada acción de todos modos, esto acá es solo para no mostrar el
// botón/pantalla a quien no corresponde.
const PAGINAS_RESTRINGIDAS = {
  'admin-turnero': ['admin', 'admin_deposito'],
  // 'fincarga' es pública (link sin login para celular) — no se restringe acá.
};

// Roles con acceso limitado a un subconjunto FIJO de pantallas — todo lo que no
// esté en su lista (incluida Administración) queda oculto/bloqueado, sin importar
// lo que diga PAGINAS_RESTRINGIDAS para esa pantalla puntual.
const PAGINAS_PERMITIDAS_POR_ROL = {
  'operaciones':  ['playa', 'tiempodecarga'],
  'distribucion': ['playa', 'turnos'],
};

function rolPermitidoEnPagina(pagina) {
  const u = Sesion.obtener();
  const permitidasRol = u && PAGINAS_PERMITIDAS_POR_ROL[u.Rol];
  if (permitidasRol) return permitidasRol.includes(pagina);
  const permitidos = PAGINAS_RESTRINGIDAS[pagina];
  if (!permitidos) return true; // página sin restricción
  return !!u && permitidos.includes(u.Rol);
}

// Redirige a Playa en Vivo (la única pantalla que ven todos los roles) si el rol
// actual no tiene la página actual en su lista permitida. Llamar justo después de
// guardSesionTurnero(), antes de cargar datos de la página.
function exigirAccesoPagina(paginaActual) {
  if (rolPermitidoEnPagina(paginaActual)) return true;
  toast('No tenés permiso para ver esta pantalla.', 'err');
  window.location.href = 'playa.html';
  return false;
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
