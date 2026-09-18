// =====================================================================
// api-turnero.js — cliente HTTP para el nuevo GAS Turnero
// Depende de: api.js (usa Sesion, ORIGEN)
// =====================================================================

const API_URL_TURNERO = 'https://script.google.com/macros/s/AKfycbx2WhuYjHDi3xIRmvZ3nUelAxmZccF7OMnrdlt-mgDNwes25wrz8MJTQfbT9rTpwpII/exec';

// Depósito activo (código de Config_Depositos, ej. MZA/BUE/MZA-IND) para las páginas
// de turnero. Prioridad: elección manual guardada en este navegador (localStorage) >
// columna Deposito_Turnero del usuario en USUARIOS (los admin tienen "TODOS" ahí, no
// cuenta como default) > MZA. Ya no valida contra una lista fija ('MZA'/'BUE') — la
// lista real de depósitos activos sale de Config_Depositos (ver pintarBotonesDeposito_
// en turnero-common.js), así que cualquier código que el propio selector haya guardado
// es válido por definición.
const TurneroDeposito = {
  KEY: 'ip_turnero_deposito',
  obtener() {
    try {
      const guardado = localStorage.getItem(this.KEY);
      if (guardado) return guardado;
    } catch (e) { /* localStorage no disponible, seguimos con el default */ }
    const u = Sesion.obtener();
    const dep = u && String(u.Deposito_Turnero || '').trim().toUpperCase();
    return dep || 'MZA';
  },
  fijar(dep) {
    try { localStorage.setItem(this.KEY, dep); } catch (e) { /* no crítico */ }
  },
};

async function apiTurnero(accion, payload = {}) {
  const usuario  = Sesion.obtener();
  const deposito = TurneroDeposito.obtener();
  const body = {
    accion,
    payload,
    deposito,
    auth:   usuario ? { email: usuario.Email } : {},
    origen: typeof ORIGEN !== 'undefined' ? ORIGEN : 'web'
  };
  try {
    const resp = await fetch(API_URL_TURNERO, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
    if (!resp.ok) return { ok: false, error: `Error HTTP ${resp.status}` };
    return await resp.json();
  } catch (err) {
    return { ok: false, error: 'Sin conexión: ' + err.message };
  }
}

// Warmup silencioso — llamar al cargar la app para precalentar el GAS
function apiTurneroWarmup() {
  try {
    fetch(API_URL_TURNERO, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ accion: 'ping', payload: {}, deposito: TurneroDeposito.obtener() })
    });
  } catch (_) {}
}
