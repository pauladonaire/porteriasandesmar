// trafico.js — Formulario y lista de tráfico (planilla interbase)

const Trafico = {
  // ── Registrar evento (ingreso o egreso) ───────────────────────
  async registrarEvento(form) {
    const tipoEvento  = form.querySelector('input[name="tipo-evento-traf"]:checked')?.value;
    const idPredio    = form.querySelector('#sel-predio-traf').value;
    const idServicio  = form.querySelector('#sel-servicio-traf').value;
    const servicioOtro= form.querySelector('#traf-serv-otro').value;
    const chofer      = form.querySelector('#sel-chofer-traf').value;
    const tractor     = form.querySelector('#traf-tractor').value.trim().toUpperCase();
    const arrastre    = form.querySelector('#traf-arrastre').value.trim().toUpperCase();
    const precintos   = form.querySelector('#traf-precintos').value.trim();
    const danios      = form.querySelector('#traf-danios').value.trim();
    const certCob     = form.querySelector('#traf-cert').value.trim();

    if (!tipoEvento) { App.toast('Seleccioná Ingreso o Egreso', 'err'); return; }
    if (!idPredio)   { App.toast('Seleccioná el predio', 'err'); return; }
    if (!tractor)    { App.toast('Dominio tractor obligatorio', 'err'); return; }

    const esOtro = !idServicio || idServicio.toUpperCase() === 'OTRO';
    if (esOtro && !servicioOtro) { App.toast('Especificá el servicio en "Otro"', 'err'); return; }

    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    const res = await api('traficoEvento', {
      tipoEvento, idPredio, idServicio, servicioOtro,
      chofer, tractor, arrastre, precintos, danios,
      certCobertura: certCob,
    });

    btn.disabled = false;
    btn.textContent = tipoEvento === 'ingreso' ? '↑ Registrar Ingreso' : '↓ Registrar Egreso';

    if (res.ok) {
      let msg = 'Evento registrado.';
      if (res.idViaje && tipoEvento === 'egreso')  msg += ' Viaje abierto.';
      if (res.idViaje && tipoEvento === 'ingreso') msg += ' Viaje cerrado (' + res.horasRuta + 'h).';
      App.toast(msg, 'ok');
      form.reset();
      toggleServicioOtro();
      await this.cargarViajes();
    } else {
      App.toast(res.error, 'err');
    }
  },

  // ── Cargar viajes en ruta ─────────────────────────────────────
  async cargarViajes() {
    const res = await api('viajesEnRuta');
    if (!res.ok) return;
    this.renderizarViajes(res.viajes || []);
    const badge = document.getElementById('badge-traf');
    if (badge) badge.textContent = (res.viajes || []).length + ' en ruta';
  },

  renderizarViajes(viajes) {
    const container = document.getElementById('lista-traf');
    if (!container) return;

    if (!viajes.length) {
      container.innerHTML = '<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg><p>Sin viajes en ruta</p></div>';
      return;
    }

    container.innerHTML = viajes.map(v => {
      const orig = Catalogos.nombrePredio(v.Predio_Origen);
      const dest = Catalogos.nombrePredio(v.Predio_Destino);
      const horas = typeof v._horasEnRuta === 'number' ? v._horasEnRuta.toFixed(1) + 'h' : '—';
      const svc   = Catalogos.nombreServicio(v.ID_Servicio);
      return `
        <div class="mov-card viaje-border">
          <div class="mov-card-header">
            <span class="mov-card-id">${v.Tractor}</span>
            <span class="tag tag-enruta">🚛 ${horas}</span>
          </div>
          <div class="mov-card-detail">
            <strong>${orig}</strong> → <strong>${dest}</strong>
          </div>
          <div class="mov-card-detail">
            <strong>Servicio:</strong> ${svc} &nbsp;
            <strong>Chofer:</strong> ${v.Chofer || '—'}
          </div>
          <div class="mov-card-detail text-muted">${v.FechaHora_Salida}</div>
        </div>`;
    }).join('');
  },
};

function toggleServicioOtro() {
  const sel = document.getElementById('sel-servicio-traf');
  const row = document.getElementById('row-serv-otro');
  if (!sel || !row) return;
  const esOtro = !sel.value || sel.value.toUpperCase() === 'OTRO' ||
    (sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].text.toLowerCase().includes('otro'));
  row.style.display = esOtro ? 'block' : 'none';
}

function initTrafico() {
  const form = document.getElementById('form-traf');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    await Trafico.registrarEvento(form);
  });

  // Mostrar/ocultar campo "Otro servicio" según selección
  document.getElementById('sel-servicio-traf').addEventListener('change', toggleServicioOtro);

  // Cambiar texto del botón según tipo_evento
  document.querySelectorAll('input[name="tipo-evento-traf"]').forEach(r => {
    r.addEventListener('change', () => {
      const btn = document.getElementById('btn-submit-traf');
      if (btn) btn.textContent = r.value === 'ingreso' ? '↑ Registrar Ingreso' : '↓ Registrar Egreso';
    });
  });
}
