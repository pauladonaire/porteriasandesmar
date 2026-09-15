// api.js — Cliente HTTP para la Web App de Apps Script

const API_URL = 'https://script.google.com/macros/s/AKfycbxsphi4DmkP9fk_Hig6a5sW6Q3dG4xGIfGrJ_O6ppwIG7IRceDetz-iAqKBXL5EMz-LYA/exec';

// Detectar si es dispositivo móvil para enviar el origen correcto al log
const ORIGEN = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 'movil' : 'web';

// Gestión de sesión en sessionStorage
const Sesion = {
  guardar(usuario) {
    sessionStorage.setItem('ip_usuario', JSON.stringify(usuario));
  },
  obtener() {
    const raw = sessionStorage.getItem('ip_usuario');
    return raw ? JSON.parse(raw) : null;
  },
  cerrar() {
    sessionStorage.removeItem('ip_usuario');
    fijarRolSimulado(''); // no dejar una simulación pegada para el próximo que use este navegador/tab
  },
  activo() {
    return this.obtener() !== null;
  },
};

// ── "Ver como" (solo Admin) ─────────────────────────────────────────────────
// Un usuario 'admin' puede "mostrarse" como cualquier otro rol habilitado para
// validar navegación/visibilidad sin crear cuentas de prueba. Es 100% de
// FRONT-END: cada llamada a la API se autentica por email (ver `api()` abajo) y
// el backend siempre aplica el Rol REAL guardado en USUARIOS — esto nunca
// cambia lo que el servidor permite hacer, solo lo que se MUESTRA en pantalla
// (menús, botones, redirecciones de páginas restringidas). Compartido por
// Portería y Turnero porque ambos cargan este archivo.
const ROL_SIMULADO_KEY = 'ip_rol_simulado';
const ROLES_SIMULABLES = ['vigilador', 'supervisor', 'admin_deposito', 'operaciones', 'distribucion'];
const NOMBRES_ROLES = {
  vigilador: 'Vigilador', supervisor: 'Supervisor', admin: 'Admin',
  admin_deposito: 'Admin Depósito', operaciones: 'Operaciones', distribucion: 'Distribución',
};

function rolSimuladoActivo() {
  try { return sessionStorage.getItem(ROL_SIMULADO_KEY) || ''; } catch (e) { return ''; }
}

function fijarRolSimulado(rol) {
  try {
    if (!rol) sessionStorage.removeItem(ROL_SIMULADO_KEY);
    else sessionStorage.setItem(ROL_SIMULADO_KEY, rol);
  } catch (e) { /* no crítico */ }
}

// Rol a usar para TODO lo visual (CSS data-rol, qué páginas/menús se muestran).
// Si el usuario real no es admin, siempre devuelve su rol real sin tocar nada.
function rolEfectivo() {
  const u = Sesion.obtener();
  const real = (u && u.Rol) || 'vigilador';
  if (real !== 'admin') return real;
  const sim = rolSimuladoActivo();
  return ROLES_SIMULABLES.includes(sim) ? sim : real;
}

// Barra flotante para elegir el rol simulado — se auto-inicializa en cualquier
// página que cargue este archivo (Portería y Turnero), sin necesidad de
// tocar cada página. Solo se muestra si el usuario real logueado es 'admin'.
function _initBarraRolSimulado() {
  const u = Sesion.obtener();
  const existente = document.getElementById('ip-barra-rol-simulado');
  if (!u || u.Rol !== 'admin') { if (existente) existente.remove(); return; }

  const simulando = rolSimuladoActivo();
  let barra = existente;
  if (!barra) {
    barra = document.createElement('div');
    barra.id = 'ip-barra-rol-simulado';
    // bottom:70px para no taparse con el bottom-nav fijo (Portería y Turnero
    // usan barras de navegación pegadas abajo en mobile).
    barra.style.cssText = 'position:fixed;bottom:70px;right:12px;z-index:99999;display:flex;' +
      'align-items:center;gap:6px;padding:6px 10px;border-radius:8px;font-size:.78rem;' +
      'font-family:system-ui,sans-serif;color:#fff;box-shadow:0 2px 10px rgba(0,0,0,.35);';
    barra.innerHTML = '<span>👁 Ver como:</span>' +
      '<select id="ip-select-rol-simulado" style="font-size:.78rem;padding:2px 4px;border-radius:4px;border:none"></select>';
    document.body.appendChild(barra);
    const sel = barra.querySelector('#ip-select-rol-simulado');
    sel.innerHTML = ['<option value="">Admin (real)</option>']
      .concat(ROLES_SIMULABLES.map(r => `<option value="${r}">${NOMBRES_ROLES[r]}</option>`)).join('');
    sel.addEventListener('change', () => { fijarRolSimulado(sel.value); window.location.reload(); });
  }
  barra.style.background = simulando ? '#b45309' : '#1e293b'; // naranja = simulando, para no confundirlo con un bug real
  barra.querySelector('#ip-select-rol-simulado').value = simulando;
}

document.addEventListener('DOMContentLoaded', _initBarraRolSimulado);

/**
 * Realiza una llamada POST a la Web App de Apps Script.
 * Usa Content-Type: text/plain para evitar el preflight CORS de GAS.
 * redirect: 'follow' maneja la redirección que GAS emite en algunos deploys.
 *
 * @param {string} accion — nombre de la acción (ej: 'login', 'distribucionIngreso')
 * @param {object} payload — datos de la acción
 * @returns {Promise<object>} — respuesta JSON { ok, ... }
 */
async function api(accion, payload = {}) {
  const usuario = Sesion.obtener();
  const body = {
    accion,
    payload,
    auth:   usuario ? { email: usuario.Email } : {},
    origen: ORIGEN,
  };

  try {
    const resp = await fetch(API_URL, {
      method:   'POST',
      redirect: 'follow',
      headers:  { 'Content-Type': 'text/plain;charset=utf-8' },
      body:     JSON.stringify(body),
    });

    if (!resp.ok) {
      return { ok: false, error: `Error HTTP ${resp.status}` };
    }

    const data = await resp.json();
    return data;
  } catch (err) {
    return { ok: false, error: 'Sin conexión o error de red: ' + err.message };
  }
}

/**
 * "Despierta" la Web App de Apps Script apenas arranca la app, para que el primer
 * guardado real del usuario (ingreso/egreso, etc.) no pague el costo de arranque frío.
 * Silenciosa: nunca muestra error ni bloquea nada — es pura optimización, best-effort.
 */
function apiWarmup() {
  api('ping').catch(() => {});
}
