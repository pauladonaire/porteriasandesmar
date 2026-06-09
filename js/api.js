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
  },
  activo() {
    return this.obtener() !== null;
  },
};

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
