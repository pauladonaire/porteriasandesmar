// indicadores.js — Tablero de KPIs para supervisor/admin

const Indicadores = {
  async cargar(idPredio, desde, hasta) {
    const container = document.getElementById('kpi-container');
    if (!container) return;
    container.innerHTML = '<div class="empty"><span class="spinner"></span></div>';

    const res = await api('getIndicadores', { idPredio, desde, hasta });
    if (!res.ok) {
      container.innerHTML = '<div class="empty">' + res.error + '</div>';
      return;
    }
    this.renderizar(res);
  },

  renderizar(d) {
    const container = document.getElementById('kpi-container');
    const { distribucion: dist, trafico: traf, viajes, personal: pers, movPorPredio } = d;

    container.innerHTML = `
      <!-- Distribución -->
      <h3 class="list-title">Distribución</h3>
      <div class="kpi-grid">
        <div class="kpi-card verde">
          <div class="kpi-value">${dist.unidadesDentro}</div>
          <div class="kpi-label">Unidades Adentro</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">${dist.totalMovimientos}</div>
          <div class="kpi-label">Total Movimientos</div>
        </div>
        <div class="kpi-card ambar">
          <div class="kpi-value">${dist.promHorasDentro}h</div>
          <div class="kpi-label">Prom. Horas Dentro</div>
        </div>
        <div class="kpi-card azul">
          <div class="kpi-value">${dist.promHorasFuera}h</div>
          <div class="kpi-label">Prom. Horas Fuera</div>
        </div>
      </div>

      <!-- Tráfico -->
      <h3 class="list-title">Tráfico</h3>
      <div class="kpi-grid">
        <div class="kpi-card verde">
          <div class="kpi-value">${traf.totalIngresos}</div>
          <div class="kpi-label">Ingresos Tráfico</div>
        </div>
        <div class="kpi-card rojo">
          <div class="kpi-value">${traf.totalEgresos}</div>
          <div class="kpi-label">Egresos Tráfico</div>
        </div>
        <div class="kpi-card azul">
          <div class="kpi-value">${viajes.enRuta}</div>
          <div class="kpi-label">Viajes en Ruta</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">${viajes.promHorasRuta}h</div>
          <div class="kpi-label">Prom. Horas Ruta</div>
        </div>
      </div>

      <!-- Personal -->
      <h3 class="list-title">Personal</h3>
      <div class="kpi-grid">
        <div class="kpi-card ambar">
          <div class="kpi-value">${pers.personasDentro}</div>
          <div class="kpi-label">Personas Adentro</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">${pers.totalMovimientos}</div>
          <div class="kpi-label">Total Ingresos</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">${pers.porTipo.visita}</div>
          <div class="kpi-label">Visitas</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">${pers.porTipo.proveedor}</div>
          <div class="kpi-label">Proveedores</div>
        </div>
      </div>

      <!-- Top rutas por servicio -->
      ${viajes.porServicio && viajes.porServicio.length ? `
      <h3 class="list-title">Tiempo de Ruta por Servicio</h3>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:.85rem">
          <thead>
            <tr style="color:var(--text-muted);text-transform:uppercase;font-size:.72rem;letter-spacing:.05em">
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--border)">Servicio</th>
              <th style="text-align:right;padding:6px 8px;border-bottom:1px solid var(--border)">Viajes</th>
              <th style="text-align:right;padding:6px 8px;border-bottom:1px solid var(--border)">Prom. Horas</th>
            </tr>
          </thead>
          <tbody>
            ${viajes.porServicio.map(s => `
              <tr style="border-bottom:1px solid var(--border)">
                <td style="padding:8px;color:var(--text)">${Catalogos.nombreServicio(s.servicio)}</td>
                <td style="padding:8px;text-align:right;color:var(--text-muted)">${s.cantidad}</td>
                <td style="padding:8px;text-align:right;color:var(--viaje)">${s.promHoras}h</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}

      <!-- Movimientos por predio -->
      ${movPorPredio && movPorPredio.length ? `
      <h3 class="list-title">Actividad por Predio</h3>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${movPorPredio.map(p => {
          const max = movPorPredio[0].cantidad;
          const pct = Math.round((p.cantidad / max) * 100);
          return `
          <div>
            <div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:4px">
              <span>${Catalogos.nombrePredio(p.predio)}</span>
              <span style="color:var(--brand)">${p.cantidad}</span>
            </div>
            <div style="background:var(--surface2);border-radius:4px;height:6px">
              <div style="background:var(--brand);height:6px;border-radius:4px;width:${pct}%;transition:width .4s"></div>
            </div>
          </div>`;
        }).join('')}
      </div>` : ''}

      <p style="font-size:.72rem;color:var(--text-muted);margin-top:16px">
        Generado: ${d.generadoEn}
      </p>`;
  },
};

function initIndicadores() {
  const form = document.getElementById('form-indicadores');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const idPredio = document.getElementById('ind-predio').value;
    const desde    = document.getElementById('ind-desde').value;
    const hasta    = document.getElementById('ind-hasta').value;
    await Indicadores.cargar(idPredio, desde, hasta);
  });
}
