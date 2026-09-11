// turnos.js — Pantalla "Turnos" (asignación de turnos de carga)
// Nota: Boxes y Horarios se editan a mano directamente en el Sheet (Box_De_Carga /
// Horarios_Turno), no hay pantalla de administración para esas 2 tablas. Fleteros ya
// no es una tabla manual — sale directo de UNIDADES de portería (ver getFleteros_).

let fechaActual = fechaHoyDDMMYYYY();
let fleteros = [];
let horarios = [];
let boxes = [];
let turnosDelDia = [];
let filaEnEdicion = null;

async function cargarCatalogos() {
  const [rFleteros, rHorarios, rBoxes] = await Promise.all([
    apiTurnero('getFleteros'),
    apiTurnero('getHorariosTurno'),
    apiTurnero('getEstadoBoxes'),
  ]);
  fleteros = (rFleteros && rFleteros.ok) ? rFleteros.data.fleteros : [];
  horarios = (rHorarios && rHorarios.ok) ? rHorarios.data.horarios : [];
  boxes    = (rBoxes && rBoxes.ok) ? rBoxes.data.boxes.filter(b => b.habilitado) : [];

  const dlFleteros = document.getElementById('dl-fleteros');
  dlFleteros.innerHTML = fleteros.map(f => `<option value="${escapeHtml(f.nombre)}">`).join('');
  const dlPatentes = document.getElementById('dl-patentes');
  dlPatentes.innerHTML = fleteros.filter(f => f.patente).map(f => `<option value="${escapeHtml(f.patente)}">`).join('');
}

async function cargarTurnosDelDia() {
  const res = await apiTurnero('getTurnosPorFecha', { fecha: fechaActual });
  turnosDelDia = (res && res.ok) ? res.data.turnos : [];
  renderTurnosAgrupados();
  renderHorariosDisponibles();
  renderResumen();
}

// ── Boxes ocupados por horario (minutos) → { minutos: Set(box) } ──
function boxesOcupadosPorHorario() {
  const mapa = {};
  turnosDelDia.forEach(t => {
    if (t.minutos === null || t.minutos === undefined) return;
    if (!mapa[t.minutos]) mapa[t.minutos] = new Set();
    mapa[t.minutos].add(t.box);
  });
  return mapa;
}

function boxesLibresEn(minutos) {
  const ocupados = boxesOcupadosPorHorario()[minutos] || new Set();
  return boxes.filter(b => !ocupados.has(b.box));
}

function renderHorariosDisponibles() {
  const sel = document.getElementById('sel-horario');
  const valorPrevio = sel.value;
  const disponibles = horarios.filter(h => boxesLibresEn(h.minutos).length > 0);
  sel.innerHTML = disponibles.length
    ? disponibles.map(h => `<option value="${h.texto}">${h.texto} (${boxesLibresEn(h.minutos).length} box libres)</option>`).join('')
    : '<option value="">Sin horarios disponibles</option>';
  if (disponibles.some(h => h.texto === valorPrevio)) sel.value = valorPrevio;
  renderBoxesDisponibles();
}

function renderBoxesDisponibles() {
  const sel = document.getElementById('sel-box');
  const horario = document.getElementById('sel-horario').value;
  const h = horarios.find(x => x.texto === horario);
  const libres = h ? boxesLibresEn(h.minutos) : [];
  sel.innerHTML = libres.length
    ? libres.map(b => `<option value="${escapeHtml(b.box)}">${escapeHtml(b.box)}</option>`).join('')
    : '<option value="">Sin boxes libres</option>';
}

function renderResumen() {
  const totalBoxes = boxes.length;
  const totalHorarios = horarios.length;
  const disponibles = horarios.filter(h => boxesLibresEn(h.minutos).length > 0).length;
  document.getElementById('t-resumen-disponibilidad').textContent =
    `${fechaActual} · ${turnosDelDia.length} turnos cargados · ${disponibles}/${totalHorarios} horarios con lugar · ${totalBoxes} boxes habilitados`;
}

function renderTurnosAgrupados() {
  const cont = document.getElementById('turnos-agrupados');
  const empty = document.getElementById('empty-turnos');
  cont.innerHTML = '';
  empty.classList.toggle('t-hidden', turnosDelDia.length > 0);

  const porHorario = {};
  turnosDelDia.forEach(t => {
    const key = t.turno || '--:--';
    if (!porHorario[key]) porHorario[key] = [];
    porHorario[key].push(t);
  });
  const horariosOrdenados = Object.keys(porHorario).sort((a, b) => {
    const ta = turnosDelDia.find(t => t.turno === a), tb = turnosDelDia.find(t => t.turno === b);
    return (ta && ta.minutos !== null ? ta.minutos : 9999) - (tb && tb.minutos !== null ? tb.minutos : 9999);
  });

  horariosOrdenados.forEach(horario => {
    const grupo = porHorario[horario];
    const header = document.createElement('div');
    header.className = 't-grupo-horario';
    header.innerHTML = `${escapeHtml(horario)} <span class="t-grupo-count">${grupo.length}</span>`;
    cont.appendChild(header);
    grupo.forEach(t => {
      const row = document.createElement('div');
      row.className = 't-turno-row';
      row.innerHTML = `<span class="t-turno-box">${escapeHtml(t.box || '')}</span><span class="t-turno-name">${escapeHtml(t.fletero || '')}</span><span class="t-turno-pat">${escapeHtml(t.patente || '')}</span>`;
      row.addEventListener('click', () => abrirModalTurno(t));

      if (t.telefono) {
        const btnWsp = document.createElement('button');
        btnWsp.type = 'button';
        btnWsp.className = 't-btn ghost';
        btnWsp.style.cssText = 'padding:4px 8px;font-size:.85rem;flex-shrink:0';
        btnWsp.textContent = '📲';
        btnWsp.title = 'Avisar por WhatsApp a ' + t.fletero;
        btnWsp.addEventListener('click', e => { e.stopPropagation(); enviarWhatsappIndividual(t); });
        row.appendChild(btnWsp);
      }
      cont.appendChild(row);
    });
  });
}

// ── Autocompletado bidireccional fletero <-> patente ──
function initAutocompletado() {
  document.getElementById('in-fletero').addEventListener('change', e => {
    const f = fleteros.find(x => x.nombre === e.target.value);
    const inPatente = document.getElementById('in-patente');
    if (f && f.patente && !inPatente.value) inPatente.value = f.patente;
  });
  document.getElementById('in-patente').addEventListener('change', e => {
    const f = fleteros.find(x => x.patente && x.patente.toUpperCase() === e.target.value.trim().toUpperCase());
    const inFletero = document.getElementById('in-fletero');
    if (f && !inFletero.value) inFletero.value = f.nombre;
  });
}

// ── Cargar turno ──
async function onSubmitCargarTurno(e) {
  e.preventDefault();
  const errEl = document.getElementById('err-cargar-turno');
  errEl.classList.add('t-hidden');

  const fletero = document.getElementById('in-fletero').value.trim();
  const patente = document.getElementById('in-patente').value.trim().toUpperCase();
  const turno   = document.getElementById('sel-horario').value;
  const box     = document.getElementById('sel-box').value;

  if (!fletero || !turno || !box) {
    errEl.textContent = 'Completá fletero, horario y box.';
    errEl.classList.remove('t-hidden');
    return;
  }

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  const res = await apiTurnero('asignarTurno', { fecha: fechaActual, turno, fletero, patente, box });
  btn.disabled = false;

  if (res && res.ok) {
    toast('Turno asignado', 'ok');
    document.getElementById('form-cargar-turno').reset();
    await cargarTurnosDelDia();
  } else {
    errEl.textContent = (res && res.error) || 'No se pudo asignar el turno.';
    errEl.classList.remove('t-hidden');
  }
}

// ── Modal editar/liberar ──
function abrirModalTurno(t) {
  filaEnEdicion = t;
  document.getElementById('modal-turno-meta').textContent = `${t.turno || '--:--'} · Box ${t.box || '-'}`;
  document.getElementById('modal-in-fletero').value = t.fletero || '';
  document.getElementById('modal-in-patente').value = t.patente || '';
  document.getElementById('modal-error').classList.add('t-hidden');
  document.getElementById('modal-turno').classList.remove('t-hidden');
}
function cerrarModalTurno() {
  document.getElementById('modal-turno').classList.add('t-hidden');
  filaEnEdicion = null;
}

async function onGuardarModalTurno() {
  if (!filaEnEdicion) return;
  const fletero = document.getElementById('modal-in-fletero').value.trim();
  const patente = document.getElementById('modal-in-patente').value.trim().toUpperCase();
  const errEl = document.getElementById('modal-error');
  if (!fletero) { errEl.textContent = 'El fletero es obligatorio.'; errEl.classList.remove('t-hidden'); return; }

  const res = await apiTurnero('editarTurno', { fila: filaEnEdicion.fila, fletero, patente });
  if (res && res.ok) {
    toast('Turno actualizado', 'ok');
    cerrarModalTurno();
    await cargarTurnosDelDia();
  } else {
    errEl.textContent = (res && res.error) || 'No se pudo actualizar.';
    errEl.classList.remove('t-hidden');
  }
}

async function onLiberarModalTurno() {
  if (!filaEnEdicion) return;
  if (!confirm(`¿Liberar el turno de ${filaEnEdicion.fletero || filaEnEdicion.patente}?`)) return;
  const res = await apiTurnero('liberarTurno', { fila: filaEnEdicion.fila });
  if (res && res.ok) {
    toast('Turno liberado', 'ok');
    cerrarModalTurno();
    await cargarTurnosDelDia();
  } else {
    toast((res && res.error) || 'No se pudo liberar el turno.', 'err');
  }
}

// ── WhatsApp ──

// Aviso individual al fletero — usa el teléfono sincronizado desde Drivin
// (columna Telefono_Drivin de UNIDADES, ver apps-script/Drivin.gs) para abrirle el
// chat directo, sin tener que elegir el contacto a mano.
function enviarWhatsappIndividual(t) {
  const telefono = String(t.telefono || '').replace(/\D/g, '');
  if (!telefono) { toast('Esa unidad no tiene teléfono cargado (Telefono_Drivin en UNIDADES).', 'warn'); return; }
  const texto = `Hola ${t.fletero || ''}, tenés turno asignado hoy ${fechaActual} a las ${t.turno || '--:--'} — Box ${t.box || '-'}.`;
  window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`, '_blank');
}

function onEnviarWhatsapp() {
  if (!turnosDelDia.length) { toast('No hay turnos cargados para enviar.', 'warn'); return; }
  const porHorario = {};
  turnosDelDia.forEach(t => {
    const key = t.turno || '--:--';
    (porHorario[key] = porHorario[key] || []).push(t);
  });
  const horariosOrdenados = Object.keys(porHorario).sort();
  let texto = `*Turnos ${fechaActual} — ${TurneroDeposito.obtener()}*\n\n`;
  horariosOrdenados.forEach(h => {
    texto += `*${h}*\n`;
    porHorario[h].forEach(t => { texto += `  Box ${t.box} — ${t.fletero}${t.patente ? ' (' + t.patente + ')' : ''}\n`; });
  });
  window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
}

// ── Fecha ──
function onCambioFecha() {
  const valor = document.getElementById('in-fecha-turnos').value;
  fechaActual = inputDateADDMMYYYY(valor) || fechaHoyDDMMYYYY();
  cargarTurnosDelDia();
}

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  initTemaToggle(); // primero: el modo oscuro no depende de tener sesión activa
  if (!guardSesionTurnero()) return;
  if (!exigirAccesoPagina('turnos')) return;
  initSelectorDepositoRol(() => { cargarCatalogos().then(cargarTurnosDelDia); });
  initNavTurnero('turnos');
  initAutocompletado();

  document.getElementById('in-fecha-turnos').value = ddmmyyyyAInputDate(fechaActual);
  document.getElementById('in-fecha-turnos').addEventListener('change', onCambioFecha);
  document.getElementById('btn-hoy').addEventListener('click', () => {
    fechaActual = fechaHoyDDMMYYYY();
    document.getElementById('in-fecha-turnos').value = ddmmyyyyAInputDate(fechaActual);
    cargarTurnosDelDia();
  });
  document.getElementById('btn-whatsapp').addEventListener('click', onEnviarWhatsapp);
  document.getElementById('sel-horario').addEventListener('change', renderBoxesDisponibles);
  document.getElementById('form-cargar-turno').addEventListener('submit', onSubmitCargarTurno);
  document.getElementById('btn-cancelar-modal').addEventListener('click', cerrarModalTurno);
  document.getElementById('btn-guardar-turno').addEventListener('click', onGuardarModalTurno);
  document.getElementById('btn-liberar-turno').addEventListener('click', onLiberarModalTurno);
  document.getElementById('modal-turno').addEventListener('click', e => {
    if (e.target.id === 'modal-turno') cerrarModalTurno();
  });

  await cargarCatalogos();
  await cargarTurnosDelDia();
});
