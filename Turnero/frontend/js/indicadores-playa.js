// indicadores-playa.js — Pantalla "Indicadores" (histórico de viajes completados)
// Reglas de la especificación original (CND Mendoza), confirmadas contra el backend:
//   - "Tiempo de carga" = ingreso→fin de carga · "Tiempo de control" = fin de carga→egreso
//   - Umbrales: cumplimiento verde≥80% ámbar≥50% rojo<50% · tarde rojo>20% ámbar>5% verde≤5%
//     · CD ámbar si prom>90min · control ámbar si prom>60min · carga siempre verde
//   - Ranking: barra "rápida" si <90% del promedio del propio ranking, "lenta" si >110%
//   - Filtro "Unidad de trabajo" del spec original no tiene fuente de datos real: se ignora.

let ultimoResultado = null;
const charts = {};

function initFiltrosFecha() {
  const hoy = new Date();
  const hace30 = new Date(hoy.getTime() - 29 * 86400000);
  document.getElementById('in-hasta').valueAsDate = hoy;
  document.getElementById('in-desde').valueAsDate = hace30;
}

function leerFiltros() {
  return {
    desde:     inputDateADDMMYYYY(document.getElementById('in-desde').value),
    hasta:     inputDateADDMMYYYY(document.getElementById('in-hasta').value),
    tipoUnidad: document.getElementById('sel-tipo').value,
    turno:     document.getElementById('sel-turno').value,
    fletero:   document.getElementById('sel-fletero').value,
    finCarga:  document.getElementById('sel-fincarga').value,
  };
}

async function cargarTodo() {
  const filtros = leerFiltros();
  const res = await apiTurnero('getIndicadores', filtros);
  if (!res || !res.ok) { toast((res && res.error) || 'Error al cargar indicadores', 'err'); return; }
  ultimoResultado = res.data;
  poblarSelectsDinamicos(ultimoResultado.detalle);
  renderKpis(ultimoResultado);
  renderRanking('ranking-cd', ultimoResultado.rankingCD);
  renderRanking('ranking-carga', ultimoResultado.rankingCarga);
  renderRanking('ranking-control', ultimoResultado.rankingControl);
  renderTopDemoras(ultimoResultado.rankingControl);
  renderDetalle(ultimoResultado.detalle);
  renderGraficosHistorico(ultimoResultado.detalle);
}

// Los <select> de Tipo de unidad y Fletero se pueblan con valores únicos del propio
// resultado cargado (igual que el spec original), preservando el valor elegido.
function poblarSelectsDinamicos(detalle) {
  const tipos = [...new Set(detalle.map(v => v.tipo).filter(Boolean))].sort();
  const fleteros = [...new Set(detalle.map(v => v.fletero).filter(Boolean))].sort();
  rellenarSelect('sel-tipo', tipos);
  rellenarSelect('sel-fletero', fleteros);
}
function rellenarSelect(id, valores) {
  const sel = document.getElementById(id);
  const actual = sel.value;
  sel.innerHTML = '<option value="Todos">Todos</option>' + valores.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  if (valores.includes(actual)) sel.value = actual;
}

function renderKpis(d) {
  const pctCumplimiento = d.conTurno ? Math.round((d.cumplieron / d.conTurno) * 100) : null;
  const pctTarde = d.conTurno ? Math.round((d.tarde / d.conTurno) * 100) : null;

  const kpis = [
    { label: 'Vehículos cargados', valor: d.total, clase: '' },
    { label: 'Con turno asignado', valor: d.conTurno, sub: d.total ? `${Math.round(d.conTurno / d.total * 100)}% del total · ${d.total - d.conTurno} sin turno` : '', clase: '' },
    { label: 'Cumplieron el turno', valor: pctCumplimiento === null ? '—' : pctCumplimiento + '%', clase: pctCumplimiento === null ? '' : (pctCumplimiento >= 80 ? 'ok' : pctCumplimiento >= 50 ? 'warn' : 'danger') },
    { label: 'Llegaron tarde', valor: pctTarde === null ? '—' : pctTarde + '%', clase: pctTarde === null ? '' : (pctTarde > 20 ? 'danger' : pctTarde > 5 ? 'warn' : 'ok') },
    { label: 'Promedio tiempo en CD', valor: formatDuracion(d.promCD), clase: (d.promCD !== null && d.promCD > 90) ? 'warn' : 'ok' },
    { label: 'Promedio tiempo de carga', valor: formatDuracion(d.promCarga), clase: 'ok' },
    { label: 'Promedio tiempo de control', valor: formatDuracion(d.promControl), clase: (d.promControl !== null && d.promControl > 60) ? 'warn' : 'ok' },
  ];

  document.getElementById('kpi-row').innerHTML = kpis.map(k => `
    <div class="t-kpi ${k.clase}">
      <div class="t-kpi-label">${escapeHtml(k.label)}</div>
      <div class="t-kpi-value">${k.valor}</div>
      ${k.sub ? `<div class="t-kpi-sub">${escapeHtml(k.sub)}</div>` : ''}
    </div>
  `).join('');

  const aviso = document.getElementById('t-aviso-sin-fincarga');
  if (d.sinFinCarga > 0) {
    aviso.textContent = `Hay ${d.sinFinCarga} viaje(s) cargado(s) sin fin de carga registrado — no entran en los promedios de carga/control.`;
    aviso.classList.remove('t-hidden');
  } else {
    aviso.classList.add('t-hidden');
  }
}

function renderRanking(contId, lista) {
  const cont = document.getElementById(contId);
  if (!lista || !lista.length) { cont.innerHTML = '<div class="t-empty">Sin datos.</div>'; return; }
  const maxProm = Math.max(...lista.map(r => r.promedio));
  const medallas = ['🥇', '🥈', '🥉'];

  function filaHtml(r, i, esUltimo) {
    const anchoBarra = maxProm ? Math.max(4, Math.round((r.promedio / maxProm) * 100)) : 0;
    return `<tr${esUltimo ? ' style="color:var(--t-danger)"' : ''}>
      <td class="t-pos-medalla">${medallas[i] || (i + 1)}</td>
      <td>${escapeHtml(r.nombre)}</td>
      <td>${escapeHtml(r.patente || '')}</td>
      <td><span class="t-ranking-barra" style="width:${anchoBarra}px"></span>${formatDuracion(r.promedio)}</td>
      <td>${r.cantidad}</td>
    </tr>`;
  }

  const top5 = lista.slice(0, 5);
  const resto = lista.slice(5);
  let html = `<table class="t-ranking-tabla"><thead><tr><th>#</th><th>Fletero</th><th>Patente</th><th>Promedio</th><th>Viajes</th></tr></thead><tbody>`;
  top5.forEach((r, i) => { html += filaHtml(r, i, i === lista.length - 1 && lista.length <= 5); });
  html += `</tbody></table>`;
  if (resto.length) {
    html += `<button type="button" class="t-btn ghost t-mt btn-ver-mas" data-cont="${contId}">Ver ${resto.length} más</button>`;
    html += `<table class="t-ranking-tabla t-hidden" id="${contId}-resto"><tbody>`;
    resto.forEach((r, i) => { html += filaHtml(r, i + 5, i === resto.length - 1); });
    html += `</tbody></table>`;
  }
  cont.innerHTML = html;

  const btn = cont.querySelector('.btn-ver-mas');
  if (btn) btn.addEventListener('click', () => {
    const restoTabla = document.getElementById(contId + '-resto');
    const oculto = restoTabla.classList.contains('t-hidden');
    restoTabla.classList.toggle('t-hidden');
    btn.textContent = oculto ? 'Ver menos' : `Ver ${resto.length} más`;
  });
}

function renderTopDemoras(rankingControl) {
  const cont = document.getElementById('top-demoras');
  const top5 = (rankingControl || []).slice(0, 5);
  if (!top5.length) { cont.innerHTML = '<div class="t-empty">Sin datos.</div>'; return; }
  cont.innerHTML = `<table class="t-ranking-tabla"><thead><tr><th>#</th><th>Fletero</th><th>Patente</th><th>Prom. control</th><th>Viajes</th></tr></thead><tbody>` +
    top5.map((r, i) => `<tr><td class="t-pos-medalla">${['🥇','🥈','🥉'][i] || (i + 1)}</td><td>${escapeHtml(r.nombre)}</td><td>${escapeHtml(r.patente || '')}</td><td>${formatDuracion(r.promedio)}</td><td>${r.cantidad}</td></tr>`).join('') +
    `</tbody></table>`;
}

const UMBRAL_CARGA_MIN = 15, UMBRAL_CONTROL_MIN = 30;

function renderDetalle(detalle) {
  const tbody = document.getElementById('tabla-detalle-body');
  const empty = document.getElementById('empty-detalle');
  document.getElementById('count-detalle').textContent = detalle.length ? String(detalle.length) : '';
  empty.classList.toggle('t-hidden', detalle.length > 0);

  const ordenado = detalle.slice().sort((a, b) => (parseFechaAROrd(b.fecha) - parseFechaAROrd(a.fecha)));
  tbody.innerHTML = ordenado.map(v => {
    const puntualidad = v.tieneTurno ? (v.llegoATiempo ? '<span class="t-badge-estado badge-a-tiempo">A tiempo</span>' : v.llegoTarde ? '<span class="t-badge-estado badge-tarde">Tarde</span>' : '') : '<span class="t-badge-estado badge-no-a-cargar">Sin turno</span>';
    const claseCarga = v.minCarga !== null && v.minCarga > UMBRAL_CARGA_MIN ? 'color:var(--t-danger);font-weight:700' : '';
    const claseControl = v.minControl !== null && v.minControl > UMBRAL_CONTROL_MIN ? 'color:var(--t-danger);font-weight:700' : '';
    return `<tr>
      <td>${escapeHtml(v.fecha)}</td>
      <td>${escapeHtml(v.fletero || '')}</td>
      <td>${escapeHtml(v.patente || '')}</td>
      <td>${escapeHtml(v.turno || '—')}</td>
      <td>${escapeHtml(v.horaIngreso || '')}</td>
      <td>${escapeHtml(v.finCarga || '—')}</td>
      <td>${escapeHtml(v.horaEgreso || (v.enPlaya ? 'en playa' : '—'))}</td>
      <td style="${claseCarga}">${v.minCarga !== null ? formatDuracion(v.minCarga) : '—'}</td>
      <td style="${claseControl}">${v.minControl !== null ? formatDuracion(v.minControl) : '—'}</td>
      <td>${v.minCD !== null ? formatDuracion(v.minCD) : '—'}</td>
      <td>${puntualidad}</td>
    </tr>`;
  }).join('');
}

function parseFechaAROrd(ddmmyyyy) {
  const [d, m, y] = String(ddmmyyyy).split('/').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getTime();
}

// ── Gráficos históricos (agrupado por día a partir del detalle ya filtrado) ──

function agruparPorDia(detalle) {
  const porDia = {};
  detalle.forEach(v => {
    if (!porDia[v.fecha]) porDia[v.fecha] = { conTurno: 0, cumplieron: 0, cd: [], carga: [], control: [] };
    const d = porDia[v.fecha];
    if (v.tieneTurno) { d.conTurno++; if (v.llegoATiempo) d.cumplieron++; }
    if (v.minCD !== null) d.cd.push(v.minCD);
    if (v.minCarga !== null) d.carga.push(v.minCarga);
    if (v.minControl !== null) d.control.push(v.minControl);
  });
  const dias = Object.keys(porDia).sort((a, b) => parseFechaAROrd(a) - parseFechaAROrd(b));
  const prom = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  return dias.map(f => {
    const d = porDia[f];
    return {
      fecha: f,
      cumplimiento: d.conTurno ? Math.round((d.cumplieron / d.conTurno) * 100) : null,
      cd: prom(d.cd), carga: prom(d.carga), control: prom(d.control),
    };
  });
}

function tendencia(valores) {
  const validos = valores.map((v, i) => ({ v, i })).filter(x => x.v !== null);
  if (validos.length < 2) return '';
  const mitad = Math.ceil(validos.length / 2);
  const primera = validos.slice(0, mitad).map(x => x.v);
  const segunda = validos.slice(mitad).map(x => x.v);
  if (!segunda.length) return '';
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  const a1 = avg(primera), a2 = avg(segunda);
  if (a1 === 0) return '';
  const pct = Math.round(((a2 - a1) / a1) * 100);
  const sube = pct > 0;
  return `${sube ? '▲' : '▼'} ${Math.abs(pct)}%`;
}

function renderGraficosHistorico(detalle) {
  const dias = agruparPorDia(detalle);
  const labels = dias.map(d => d.fecha);

  dibujarChart('chart-cumplimiento', labels, dias.map(d => d.cumplimiento), '#22c55e', '%');
  dibujarChart('chart-cd', labels, dias.map(d => d.cd), '#1e40af', 'min');
  dibujarChart('chart-carga', labels, dias.map(d => d.carga), '#15803d', 'min');
  dibujarChart('chart-control', labels, dias.map(d => d.control), '#b45309', 'min');

  document.getElementById('trend-cumplimiento').textContent = tendencia(dias.map(d => d.cumplimiento));
  document.getElementById('trend-cd').textContent = tendencia(dias.map(d => d.cd));
  document.getElementById('trend-carga').textContent = tendencia(dias.map(d => d.carga));
  document.getElementById('trend-control').textContent = tendencia(dias.map(d => d.control));
}

function dibujarChart(canvasId, labels, data, color, unidad) {
  const ctx = document.getElementById(canvasId);
  if (!ctx || typeof Chart === 'undefined') return;
  if (charts[canvasId]) charts[canvasId].destroy();
  charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: color }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.y + ' ' + unidad } } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

// ── Init ──

document.addEventListener('DOMContentLoaded', () => {
  initTemaToggle(); // primero: el modo oscuro no depende de tener sesión activa
  if (!guardSesionTurnero()) return;
  if (!exigirAccesoPagina('indicadores-playa')) return;
  initSelectorDepositoRol(() => cargarTodo());
  initNavTurnero('indicadores-playa');
  initFiltrosFecha();

  document.getElementById('btn-aplicar-filtros').addEventListener('click', cargarTodo);
  document.getElementById('btn-ultimos-30').addEventListener('click', () => { initFiltrosFecha(); cargarTodo(); });

  cargarTodo();
});
