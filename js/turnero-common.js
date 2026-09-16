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

// Roles que NO tienen acceso al módulo Turnero en absoluto (a diferencia de
// ROLES_DEPOSITO_FIJO, que sí entran pero acotados a su depósito/páginas): el rol en
// sí no lo permite, sin importar qué tenga cargado en Deposito_Turnero. Se resuelve acá
// (guardSesionTurnero corre primero en TODAS las páginas del Turnero) para no
// depender de agregar el chequeo en cada página — y se redirige a index.html
// (Portería), no a playa.html, porque para estos roles ni Playa en Vivo es válida.
const ROLES_SIN_TURNERO = ['vigilador', 'supervisor'];

function guardSesionTurnero() {
  let u = null;
  try { u = Sesion.obtener(); } catch (e) { /* sessionStorage no disponible (ej: abriendo el .html directo desde la carpeta) */ }
  if (!u) { try { window.location.href = 'index.html'; } catch (e) { /* no crítico */ } return null; }
  if (ROLES_SIN_TURNERO.includes(rolEfectivo())) {
    try { window.location.href = 'index.html'; } catch (e) { /* no crítico */ }
    return null;
  }
  return u;
}

// Depósitos activos (Config_Depositos), cacheados en memoria para esta carga de
// página — varias funciones (selector, admin-turnero) los necesitan. Si falla la
// lectura, se cae a MZA/BUE (los dos de siempre) para no dejar el selector vacío.
let _depositosActivosCache = null;
async function obtenerDepositosActivos() {
  if (_depositosActivosCache) return _depositosActivosCache;
  try {
    const res = await apiTurnero('getDepositos');
    if (res && res.ok && res.data.depositos && res.data.depositos.length) {
      _depositosActivosCache = res.data.depositos;
      return _depositosActivosCache;
    }
  } catch (e) { /* seguimos con el respaldo */ }
  _depositosActivosCache = [{ codigo: 'MZA', nombre: 'MZA' }, { codigo: 'BUE', nombre: 'BUE' }];
  return _depositosActivosCache;
}

function depositoActivoValido(dep) {
  return !!(_depositosActivosCache || []).find(d => d.codigo === dep);
}

// La columna Deposito_Turnero de USUARIOS puede tener UN depósito ("MZA") o VARIOS
// separados por coma ("MZA, MZA-IND") — para quien administra/opera más de un
// depósito. Devuelve los códigos en mayúsculas, sin vacíos, y solo los que además
// existen como depósito activo (Config_Depositos) — un código viejo/mal tipeado no
// debe dejar pasar por accidente.
function depositosDeUsuario(raw) {
  return String(raw || '').split(',')
    .map(s => s.trim().toUpperCase())
    .filter(s => s && depositoActivoValido(s));
}

// Dibuja los botones del selector de depósito según Config_Depositos — antes estaban
// fijos (MZA/BUE) en el HTML de cada página, así que sumar un depósito nuevo (ej.
// MZA-IND) no aparecía en ningún lado aunque se cargara la fila en la hoja.
async function pintarBotonesDeposito_() {
  const cont = document.getElementById('t-deposito-selector');
  if (!cont) return;
  const deps = await obtenerDepositosActivos();
  cont.innerHTML = deps.map(d =>
    `<button type="button" class="t-dep-btn" data-dep="${escapeHtml(d.codigo)}">${escapeHtml(d.codigo)}</button>`
  ).join('');
}

async function initSelectorDeposito(onCambio) {
  await pintarBotonesDeposito_();
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

// Roles fijados a su propio depósito (columna Deposito_Turnero del usuario) fuera del
// panel de Administración: no pueden cambiar de depósito desde el selector en
// Playa/Turnos/Indicadores/Tiempo de Carga. El backend GAS de esas pantallas no valida
// depósito por rol (a diferencia de Administración, gateada por validarAdminDeposito_),
// así que este selector bloqueado es la única barrera real.
const ROLES_DEPOSITO_FIJO = ['admin_deposito', 'operaciones', 'distribucion'];

// Como initSelectorDeposito, pero si el rol está en ROLES_DEPOSITO_FIJO, restringe
// las opciones a SOLO los depósitos de Deposito_Turnero del usuario (uno o varios,
// separados por coma) en vez de dejarlo elegir cualquiera. Si tiene más de uno puede
// navegar entre esos, igual que un rol sin restricción navega entre todos.
async function initSelectorDepositoRol(onCambio) {
  await pintarBotonesDeposito_();
  const u = Sesion.obtener();
  const rolActivo = rolEfectivo();
  const simulando = u && rolActivo !== u.Rol; // admin "viendo como" otro rol
  if (ROLES_DEPOSITO_FIJO.includes(rolActivo)) {
    // Al simular, el admin real no tiene por qué tener Deposito_Turnero cargado
    // (ni tiene por qué coincidir con el que se quiere probar) — se usa el
    // depósito ya elegido en el selector en vez de exigirle ese campo.
    const permitidos = simulando ? [TurneroDeposito.obtener()] : depositosDeUsuario(u && u.Deposito_Turnero);
    const cont = document.getElementById('t-deposito-selector');
    if (!permitidos.length) {
      toast('Tu usuario no tiene un depósito asignado (columna Deposito_Turnero en USUARIOS). Pedile al administrador que lo complete.', 'err', 6000);
      if (typeof onCambio === 'function') onCambio(TurneroDeposito.obtener());
      return;
    }
    let dep = TurneroDeposito.obtener();
    if (!permitidos.includes(dep)) { dep = permitidos[0]; TurneroDeposito.fijar(dep); }
    if (cont) {
      cont.querySelectorAll('.t-dep-btn').forEach(btn => {
        if (!permitidos.includes(btn.dataset.dep)) { btn.style.display = 'none'; return; }
        btn.classList.toggle('activo', btn.dataset.dep === dep);
        if (permitidos.length > 1) {
          btn.addEventListener('click', () => {
            if (btn.dataset.dep === TurneroDeposito.obtener()) return;
            TurneroDeposito.fijar(btn.dataset.dep);
            cont.querySelectorAll('.t-dep-btn').forEach(b => b.classList.toggle('activo', b === btn));
            if (typeof onCambio === 'function') onCambio(btn.dataset.dep);
          });
        } else {
          btn.disabled = true; btn.style.cursor = 'default'; btn.style.opacity = '1';
        }
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
  'operaciones':  ['playa', 'indicadores-playa', 'tiempodecarga', 'fincarga'], // playa en vivo, indicadores, tiempos de carga, fin de carga
  'distribucion': ['playa', 'turnos', 'tiempodecarga'],                       // playa en vivo, turnos, tiempos de carga
};

function rolPermitidoEnPagina(pagina) {
  const u = Sesion.obtener();
  if (!u) return false;
  const rol = rolEfectivo();
  const permitidasRol = PAGINAS_PERMITIDAS_POR_ROL[rol];
  if (permitidasRol) return permitidasRol.includes(pagina);
  const permitidos = PAGINAS_RESTRINGIDAS[pagina];
  if (!permitidos) return true; // página sin restricción
  return permitidos.includes(rol);
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
