// fincarga.js — Pantalla PÚBLICA "Fin de Carga" (sin login, pensada para celular)
// El operario elige su nombre de un desplegable (administrado en Administración →
// Operarios), escribe/toca la patente y opcionalmente deja un comentario. El backend
// (registrarFinCarga_ en Turnero/gas/playa.gs) valida que esa patente tenga un ingreso
// abierto en el depósito antes de guardar.

async function cargarOperarios() {
  const res = await apiTurnero('getOperariosTurnero');
  const sel = document.getElementById('sel-operario');
  const operarios = (res && res.ok) ? res.data.operarios : [];
  sel.innerHTML = '<option value="">Elegí tu nombre…</option>' +
    operarios.map(o => `<option value="${escapeHtml(o.nombre)}">${escapeHtml(o.nombre)}</option>`).join('');
  if (!operarios.length) toast('No hay operarios cargados para este depósito — pedile al administrador que los agregue en Administración.', 'warn', 6000);
}

async function cargarPendientes() {
  const res = await apiTurnero('getPlayaEnVivo');
  const cont = document.getElementById('lista-pendientes');
  const empty = document.getElementById('empty-pendientes');
  if (!res || !res.ok) { cont.innerHTML = ''; empty.classList.remove('t-hidden'); empty.textContent = 'No se pudo cargar la lista.'; return; }

  const pendientes = (res.data.fleteros || []).filter(f => !f.finCarga && !f.desestimado);
  cont.innerHTML = '';
  empty.classList.toggle('t-hidden', pendientes.length > 0);
  pendientes.forEach(f => {
    const row = document.createElement('div');
    row.className = 't-turno-row';
    row.innerHTML = `<span class="t-turno-name">${escapeHtml(f.nombre || '')}</span><span class="t-turno-pat">${escapeHtml(f.patente || '')}</span><span class="t-turno-box">Ingreso ${escapeHtml(f.horaIngreso || '')}</span>`;
    row.addEventListener('click', () => {
      document.getElementById('in-patente-fincarga').value = f.patente || '';
    });
    cont.appendChild(row);
  });
}

async function onSubmitFinCarga(e) {
  e.preventDefault();
  const errEl = document.getElementById('err-fincarga');
  errEl.classList.add('t-hidden');

  const operario = document.getElementById('sel-operario').value;
  const patente = document.getElementById('in-patente-fincarga').value.trim().toUpperCase();
  const comentario = document.getElementById('in-comentario-fincarga').value.trim();

  if (!operario) { errEl.textContent = 'Elegí tu nombre en la lista de operarios.'; errEl.classList.remove('t-hidden'); return; }
  if (!patente) return;

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  const res = await apiTurnero('registrarFinCarga', { patente, operario, comentario });
  btn.disabled = false;

  if (res && res.ok) {
    toast(`Fin de carga registrado — ${patente} · ${res.data.hora}`, 'ok');
    document.getElementById('in-patente-fincarga').value = '';
    document.getElementById('in-comentario-fincarga').value = '';
    cargarPendientes();
  } else {
    errEl.textContent = (res && res.error) || 'No se pudo registrar el fin de carga.';
    errEl.classList.remove('t-hidden');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initTemaToggle();
  apiTurneroWarmup(); // "despierta" el GAS del Turnero apenas abre la página, antes de que el operario termine de elegir su nombre/patente

  document.getElementById('form-fincarga').addEventListener('submit', onSubmitFinCarga);
  // Antes esto se llamaba acá Y de nuevo dentro del callback del selector de depósito
  // (más abajo) — el doble de pedidos al servidor en cada carga de página, sin
  // necesidad: TurneroDeposito.obtener() ya devuelve el depósito correcto de forma
  // sincrónica (localStorage o el usuario), no depende de que el selector termine de
  // pintarse. Se dejan solo estas dos llamadas.
  cargarOperarios();
  cargarPendientes();
  setInterval(cargarPendientes, 60000);

  initSelectorDeposito(() => { cargarOperarios(); cargarPendientes(); }); // solo re-carga si el operario CAMBIA de depósito a mano
});
