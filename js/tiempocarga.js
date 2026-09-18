// tiempocarga.js — Pantalla "Tiempo de Carga" (control diario + histórico)
// Tiempo de carga = ingreso→fin de carga · Tiempo de control = fin de carga→egreso.
// Umbrales de fila: carga rojo si >15min, control rojo si >30min. Objetivo de CD: 40min.

const UMBRAL_CARGA_MIN = 15, UMBRAL_CONTROL_MIN = 30, OBJETIVO_CD_MIN = 40;
let tipoSelectPoblado = false;
const estadoTablas = {
  'con-turno': { campo: 'minCD', dir: 'desc', expandido: false, filas: [] },
  'sin-turno': { campo: 'minCD', dir: 'desc', expandido: false, filas: [] },
};
const chartsHist = {};

function setFechaHoy() {
  const hoy = new Date();
  document.getElementById('t-fecha-hoy').textContent = hoy.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

async function cargarHoy() {
  const tipo = document.getElementById('sel-tipo-hoy').value;
  const res = await apiTurnero('getTiempoCargaHoy', { tipoUnidad: tipo });
  if (!res || !res.ok) { toast((res && res.error) || 'Error al cargar', 'err'); return; }

  if (!tipoSelectPoblado) {
    const todasFilas = [...res.data.conTurno.filas, ...res.data.sinTurno.filas];
    const tipos = [...new Set(todasFilas.map(f => f.tipo).filter(Boolean))].sort();
    const sel = document.getElementById('sel-tipo-hoy');
    sel.innerHTML = '<option value="Todos">Todas</option>' + tipos.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    tipoSelectPoblado = true;
  }

  renderGrupoHoy('con-turno', res.data.conTurno);
  renderGrupoHoy('sin-turno', res.data.sinTurno);
}

function renderGrupoHoy(grupo, data) {
  document.getElementById('kpi-hoy-' + grupo).innerHTML = `
    <div class="t-kpi ${data.promCD !== null && data.promCD > OBJETIVO_CD_MIN ? 'warn' : 'ok'}">
      <div class="t-kpi-label">Promedio en CD</div>
      <div class="t-kpi-value">${formatDuracion(data.promCD)}</div>
      <div class="t-kpi-sub">${data.cantidad} fletero(s) cargado(s) hoy</div>
    </div>
    <div class="t-kpi">
      <div class="t-kpi-label">Prom. carga / control</div>
      <div class="t-kpi-value" style="font-size:1.1rem">${formatDuracion(data.promCarga)} / ${formatDuracion(data.promControl)}</div>
    </div>
  `;
  estadoTablas[grupo].filas = data.filas || [];
  renderTablaOrdenable(grupo);
}

function renderTablaOrdenable(grupo) {
  const est = estadoTablas[grupo];
  const tabla = document.getElementById('tabla-hoy-' + grupo);
  const btnVerTodos = document.getElementById('btn-vertodos-' + grupo);

  const columnas = [
    { campo: 'fletero', label: 'Fletero' },
    { campo: 'patente', label: 'Patente' },
    { campo: 'minCarga', label: 'Tiempo carga' },
    { campo: 'minControl', label: 'Tiempo control' },
    { campo: 'minCD', label: 'Tiempo en CD' },
  ];

  tabla.querySelector('thead').innerHTML = '<tr>' + columnas.map(c =>
    `<th data-campo="${c.campo}" data-grupo="${grupo}">${c.label}${est.campo === c.campo ? (est.dir === 'desc' ? ' ▼' : ' ▲') : ''}</th>`
  ).join('') + '</tr>';

  const ordenadas = est.filas.slice().sort((a, b) => {
    const va = a[est.campo], vb = b[est.campo];
    const na = (typeof va === 'string') ? va.toLowerCase() : (va === null ? -Infinity : va);
    const nb = (typeof vb === 'string') ? vb.toLowerCase() : (vb === null ? -Infinity : vb);
    if (na < nb) return est.dir === 'asc' ? -1 : 1;
    if (na > nb) return est.dir === 'asc' ? 1 : -1;
    return 0;
  });

  const visibles = est.expandido ? ordenadas : ordenadas.slice(0, 5);
  tabla.querySelector('tbody').innerHTML = visibles.map(f => {
    const claseCarga = f.minCarga !== null && f.minCarga > UMBRAL_CARGA_MIN ? 'color:var(--t-danger);font-weight:700' : '';
    const claseControl = f.minControl !== null && f.minControl > UMBRAL_CONTROL_MIN ? 'color:var(--t-danger);font-weight:700' : '';
    return `<tr>
      <td>${escapeHtml(f.fletero || '')}</td>
      <td>${escapeHtml(f.patente || '')}</td>
      <td style="${claseCarga}">${f.minCarga !== null ? formatDuracion(f.minCarga) : '—'}</td>
      <td style="${claseControl}">${f.minControl !== null ? formatDuracion(f.minControl) : '—'}</td>
      <td>${f.minCD !== null ? formatDuracion(f.minCD) : '—'}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--t-text-muted)">Sin datos</td></tr>';

  if (ordenadas.length > 5) {
    btnVerTodos.classList.remove('t-hidden');
    btnVerTodos.textContent = est.expandido ? 'Ver menos' : `Ver todos (${ordenadas.length})`;
  } else {
    btnVerTodos.classList.add('t-hidden');
  }

  tabla.querySelectorAll('th[data-campo]').forEach(th => {
    th.addEventListener('click', () => {
      if (est.campo === th.dataset.campo) est.dir = est.dir === 'desc' ? 'asc' : 'desc';
      else { est.campo = th.dataset.campo; est.dir = 'desc'; }
      est.expandido = false; // clic en encabezado colapsa de nuevo a top 5
      renderTablaOrdenable(grupo);
    });
  });

  btnVerTodos.onclick = () => { est.expandido = !est.expandido; renderTablaOrdenable(grupo); };
}

// ── Histórico ──

function initFiltrosHist() {
  const hoy = new Date();
  const hace30 = new Date(hoy.getTime() - 29 * 86400000);
  document.getElementById('in-hasta-hist').valueAsDate = hoy;
  document.getElementById('in-desde-hist').valueAsDate = hace30;
}

async function cargarHistorico() {
  const desde = inputDateADDMMYYYY(document.getElementById('in-desde-hist').value);
  const hasta = inputDateADDMMYYYY(document.getElementById('in-hasta-hist').value);
  const tipo  = document.getElementById('sel-tipo-hoy').value;
  const res = await apiTurnero('getTiempoCargaHistorico', { desde, hasta, tipoUnidad: tipo });
  if (!res || !res.ok) { toast((res && res.error) || 'Error al cargar histórico', 'err'); return; }

  const dias = res.data.dias || [];
  const labels = dias.map(d => d.fecha);
  dibujarStacked('chart-hist-con-turno', labels, dias.map(d => d.conTurnoCarga), dias.map(d => d.conTurnoControl));
  dibujarStacked('chart-hist-sin-turno', labels, dias.map(d => d.sinTurnoCarga), dias.map(d => d.sinTurnoControl));
}

function dibujarStacked(canvasId, labels, carga, control) {
  const ctx = document.getElementById(canvasId);
  if (!ctx || typeof Chart === 'undefined') return;
  if (chartsHist[canvasId]) chartsHist[canvasId].destroy();
  chartsHist[canvasId] = new Chart(ctx, {
    data: {
      labels,
      datasets: [
        { type: 'bar', label: 'Carga', data: carga, backgroundColor: '#15803d', stack: 'x' },
        { type: 'bar', label: 'Control', data: control, backgroundColor: '#b45309', stack: 'x' },
        { type: 'line', label: 'Objetivo (40 min)', data: labels.map(() => OBJETIVO_CD_MIN), borderColor: '#b91c1c', borderDash: [6, 4], pointRadius: 0, fill: false },
      ],
    },
    options: {
      responsive: true,
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
      plugins: { legend: { position: 'bottom' } },
    },
  });
}

// ── Init ──

document.addEventListener('DOMContentLoaded', () => {
  initTemaToggle(); // primero: el modo oscuro no depende de tener sesión activa
  if (!guardSesionTurnero()) return;
  if (!exigirAccesoPagina('tiempodecarga')) return;
  initSelectorDepositoRol(() => { cargarHoy(); cargarHistorico(); });
  initNavTurnero('tiempodecarga');
  setFechaHoy();
  initFiltrosHist();

  document.getElementById('sel-tipo-hoy').addEventListener('change', () => { cargarHoy(); cargarHistorico(); });
  document.getElementById('btn-aplicar-hist').addEventListener('click', cargarHistorico);
  document.getElementById('btn-ultimos-30-hist').addEventListener('click', () => { initFiltrosHist(); cargarHistorico(); });

  cargarHoy();
  cargarHistorico();
});
