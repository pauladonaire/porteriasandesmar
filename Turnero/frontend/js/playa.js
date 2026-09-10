// playa.js — Pantalla "Playa en Vivo" del Turnero
// Reglas de negocio tomadas de la especificación original (CND Mendoza):
//   - 3 secciones: Con turno / Sin turno / No ingresó a cargar (desestimados)
//   - Orden dentro de cada sección: urgentes primero, luego FIFO por hora de
//     ingreso, con los "ya cargados" (finCarga presente) al final salvo urgentes
//   - Refresco automático cada 60s, reloj cada 1s
//   - Umbrales/colores del semáforo ya están resueltos como clases CSS (t-card
//     urgente/tarde-card/ya-cargado/desestimado) según los campos que trae el backend

const REFRESH_MS = 60000;
let ultimaLista = [];
let ultimaActualizacion = null;

function initReloj() {
  const el = document.getElementById('t-clock');
  function tick() {
    el.textContent = new Date().toLocaleTimeString('es-AR', { hour12: false });
  }
  tick();
  setInterval(tick, 1000);
}

function minutosTranscurridos(horaIngreso) {
  const minIng = minutosDesde(horaIngreso);
  if (minIng === null) return null;
  const ahora = new Date();
  const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
  let diff = minAhora - minIng;
  if (diff < 0) diff += 1440; // cruzó medianoche
  return diff;
}

// ── Carga de datos ──────────────────────────────────────────────

async function cargarTodo() {
  setStatus('cargando', 'Actualizando…');
  const hoy = new Date();
  const fechaHoy = String(hoy.getDate()).padStart(2, '0') + '/' + String(hoy.getMonth() + 1).padStart(2, '0') + '/' + hoy.getFullYear();

  const [resPlaya, resTurnos] = await Promise.all([
    apiTurnero('getPlayaEnVivo'),
    apiTurnero('getTurnosDelDia', { fecha: fechaHoy }),
  ]);

  if (!resPlaya || !resPlaya.ok) {
    setStatus('error', 'Error de conexión: ' + (resPlaya && resPlaya.error || 'sin respuesta'));
    mostrarError(resPlaya && resPlaya.error);
    return;
  }
  ocultarError();
  ultimaLista = resPlaya.data.fleteros || [];
  ultimaActualizacion = new Date();
  renderPlaya();

  if (resTurnos && resTurnos.ok) renderTurnosDia(resTurnos.data.turnos || []);

  setStatus('ok', 'Conectado · ' + ultimaLista.length + ' registros');
}

function setStatus(estado, texto) {
  const dot = document.getElementById('t-status-dot');
  dot.classList.remove('verde', 'rojo');
  if (estado === 'ok') dot.classList.add('verde');
  if (estado === 'error') dot.classList.add('rojo');
  document.getElementById('t-status-text').textContent = texto;
}

function mostrarError(msg) {
  const el = document.getElementById('t-error');
  el.textContent = msg || 'No se pudo conectar con el Turnero.';
  el.classList.remove('t-hidden');
}
function ocultarError() {
  document.getElementById('t-error').classList.add('t-hidden');
}

// ── Bucketing + orden (según spec) ──────────────────────────────

function bucketsPlaya(lista) {
  const conTurno = [], sinTurno = [], noCarga = [];
  lista.forEach(f => {
    if (f.desestimado) noCarga.push(f);
    else if (f.turno) conTurno.push(f);
    else sinTurno.push(f);
  });
  const orden = (a, b) => {
    if (!!a.urgente !== !!b.urgente) return a.urgente ? -1 : 1;
    const aCargado = !!a.finCarga, bCargado = !!b.finCarga;
    if (!a.urgente && aCargado !== bCargado) return aCargado ? 1 : -1;
    const minA = minutosDesde(a.horaIngreso), minB = minutosDesde(b.horaIngreso);
    return (minA === null ? 9999 : minA) - (minB === null ? 9999 : minB);
  };
  conTurno.sort(orden); sinTurno.sort(orden); noCarga.sort(orden);
  return { conTurno, sinTurno, noCarga };
}

function renderPlaya() {
  const { conTurno, sinTurno, noCarga } = bucketsPlaya(ultimaLista);
  renderGrid('grid-con-turno', 'empty-con-turno', conTurno);
  renderGrid('grid-sin-turno', 'empty-sin-turno', sinTurno);
  renderGrid('grid-no-carga', 'empty-no-carga', noCarga);

  const yaCargadosCT = conTurno.filter(f => f.finCarga).length;
  document.getElementById('count-con-turno').textContent = conTurno.length ? `${conTurno.length} · ${yaCargadosCT} ya cargados` : '';
  document.getElementById('count-sin-turno').textContent = sinTurno.length ? String(sinTurno.length) : '';
  document.getElementById('count-no-carga').textContent = noCarga.length ? String(noCarga.length) : '';

  document.getElementById('stat-en-playa').textContent = ultimaLista.length;
  document.getElementById('stat-con-turno').textContent = conTurno.length;
  document.getElementById('stat-sin-turno').textContent = sinTurno.length;
  document.getElementById('stat-urgencia').textContent = ultimaLista.filter(f => f.urgente).length;
  document.getElementById('stat-actualizado').textContent = ultimaActualizacion
    ? ultimaActualizacion.toLocaleTimeString('es-AR', { hour12: false })
    : '--';
}

function renderGrid(gridId, emptyId, lista) {
  const grid = document.getElementById(gridId);
  const empty = document.getElementById(emptyId);
  grid.innerHTML = '';
  empty.classList.toggle('t-hidden', lista.length > 0);
  lista.forEach(f => grid.appendChild(crearCard(f)));
}

function crearCard(f) {
  const div = document.createElement('div');
  const clases = ['t-card'];
  if (f.urgente) clases.push('urgente');
  else if (f.llegada === 'tarde') clases.push('tarde-card');
  if (f.finCarga) clases.push('ya-cargado');
  if (f.desestimado) clases.push('desestimado');
  div.className = clases.join(' ');

  let badge = '';
  if (f.finCarga) badge = `<span class="t-badge-estado badge-cargado">Ya cargado · ${f.finCarga}</span>`;
  else if (f.desestimado) badge = `<span class="t-badge-estado badge-no-a-cargar">No a cargar</span>`;
  else if (f.turno) badge = `<span class="t-badge-estado ${f.llegada === 'tarde' ? 'badge-tarde' : 'badge-a-tiempo'}">Turno ${f.turno}${f.llegada ? ' · ' + f.llegada : ''}</span>`;

  const min = minutosTranscurridos(f.horaIngreso);
  div.innerHTML = `
    ${f.urgente ? '<span class="t-badge-urgente">Urgente</span>' : ''}
    ${badge}
    <div class="t-card-nombre">${escapeHtml(f.nombre || f.patente || '—')}</div>
    <div class="t-card-meta">
      <span>${escapeHtml(f.patente || '')}</span>
      <span>Ingreso ${f.horaIngreso || '--:--'}</span>
      ${f.box ? `<span>Box ${escapeHtml(f.box)}</span>` : ''}
    </div>
    <div class="t-card-tiempo">${formatDuracion(min)}</div>
    <div class="t-card-help">Tocá para opciones</div>
  `;
  div.addEventListener('click', e => abrirMenuCtx(e, f));
  return div;
}

function renderTurnosDia(turnos) {
  const tbody = document.getElementById('tabla-turnos-dia-body');
  const empty = document.getElementById('empty-turnos-dia');
  tbody.innerHTML = '';
  document.getElementById('count-turnos-dia').textContent = turnos.length ? String(turnos.length) : '';
  empty.classList.toggle('t-hidden', turnos.length > 0);
  turnos.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(t.turno || '--:--')}</td><td>${escapeHtml(t.fletero || '')}</td><td>${escapeHtml(t.patente || '')}</td><td>${escapeHtml(t.box || '')}</td>`;
    tbody.appendChild(tr);
  });
}

// ── Menú contextual (marcar urgente / no ingresó a cargar / cancelar) ──

function abrirMenuCtx(evento, f) {
  const menu = document.getElementById('t-menu-ctx');
  const opciones = [];
  opciones.push({ label: f.urgente ? 'Quitar urgente' : 'Marcar urgente', accion: () => setEstado(f, !f.urgente, f.desestimado) });
  opciones.push({ label: f.desestimado ? 'Volver a la fila' : 'No ingresó a cargar', accion: () => setEstado(f, f.urgente, !f.desestimado), peligro: !f.desestimado });
  opciones.push({ label: 'Cancelar', accion: cerrarMenuCtx, cancelar: true });

  menu.innerHTML = opciones.map((o, i) =>
    `<button type="button" class="t-menu-ctx-item${o.peligro ? ' peligro' : ''}${o.cancelar ? ' cancelar' : ''}" data-idx="${i}">${o.label}</button>`
  ).join('');
  menu.classList.remove('t-hidden');

  const rect = menu.getBoundingClientRect();
  let x = evento.clientX, y = evento.clientY;
  if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 8;
  if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 8;
  menu.style.left = Math.max(8, x) + 'px';
  menu.style.top  = Math.max(8, y) + 'px';

  menu.querySelectorAll('.t-menu-ctx-item').forEach(btn => {
    btn.addEventListener('click', () => {
      opciones[Number(btn.dataset.idx)].accion();
      cerrarMenuCtx();
    });
  });

  setTimeout(() => document.addEventListener('click', cerrarMenuCtxFuera, { once: true }), 0);
}

function cerrarMenuCtx() {
  document.getElementById('t-menu-ctx').classList.add('t-hidden');
}
function cerrarMenuCtxFuera(e) {
  const menu = document.getElementById('t-menu-ctx');
  if (!menu.contains(e.target)) cerrarMenuCtx();
}

async function setEstado(f, urgente, desestimado) {
  // Update optimista: reflejamos el cambio ya mismo en la lista en memoria
  const item = ultimaLista.find(x => x.idMov === f.idMov);
  if (item) { item.urgente = urgente; item.desestimado = desestimado; }
  renderPlaya();

  const nombre = f.nombre || f.patente || f.idMov;
  const res = await apiTurnero('guardarEstadoPlaya', { nombre, urgente, desestimado });
  if (!res || !res.ok) {
    toast('No se pudo guardar el estado, reintentá: ' + (res && res.error || ''), 'err');
    cargarTodo(); // recuperamos el estado real del servidor
  }
}

// ── Init ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initTemaToggle(); // primero: el modo oscuro no depende de tener sesión activa
  if (!guardSesionTurnero()) return;
  initReloj();
  initSelectorDepositoRol(() => cargarTodo());
  initNavTurnero('playa');
  cargarTodo();
  setInterval(cargarTodo, REFRESH_MS);
});
