// distribucion.js — Formularios y lista de distribución

const Distribucion = {
  // ── Registrar ingreso ─────────────────────────────────────────
  async registrarIngreso(form) {
    const idPredio     = form.querySelector('#sel-predio-dist').value;
    const idUnidad     = form.querySelector('#sel-unidad-dist').value;
    const chofer       = form.querySelector('#sel-chofer-dist').value;
    const estadoCarga  = form.querySelector('input[name="estado-carga-dist"]:checked')?.value;
    const detalleCarga = form.querySelector('#det-carga-dist').value;
    const observaciones= form.querySelector('#obs-dist').value;

    if (!idPredio)    { App.toast('Seleccioná el predio', 'err'); return; }
    if (!idUnidad)    { App.toast('Seleccioná o escaneá la unidad', 'err'); return; }
    if (!estadoCarga) { App.toast('Indicá el estado de carga', 'err'); return; }

    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Registrando...';

    const res = await api('distribucionIngreso', {
      idPredio, idUnidad, chofer, estadoCarga, detalleCarga, observaciones,
    });

    btn.disabled = false;
    btn.textContent = 'Registrar Ingreso';

    if (res.ok) {
      App.toast('Ingreso registrado — ' + res.dominio, 'ok');
      form.reset();
      await this.cargarLista();
      App.mostrar('dentro-dist');
    } else {
      App.toast(res.error, 'err');
    }
  },

  // ── Registrar egreso ──────────────────────────────────────────
  async registrarEgreso(idMov, estadoCarga, detalleCarga, observaciones) {
    if (!estadoCarga) { App.toast('Indicá el estado de carga al egreso', 'err'); return; }

    const res = await api('distribucionEgreso', { idMov, estadoCarga, detalleCarga, observaciones });
    if (res.ok) {
      App.toast('Egreso registrado — ' + res.horasDentro + 'h dentro', 'ok');
      await this.cargarLista();
    } else {
      App.toast(res.error, 'err');
    }
    return res;
  },

  // ── Cargar lista de abiertos ───────────────────────────────────
  async cargarLista() {
    const res = await api('distribucionAbiertos');
    if (!res.ok) { App.toast('Error al cargar lista', 'err'); return; }
    this.renderizarLista(res.movimientos || []);
    // Actualizar badge
    const badge = document.getElementById('badge-dist');
    if (badge) badge.textContent = (res.movimientos || []).length + ' dentro';
  },

  renderizarLista(movs) {
    const container = document.getElementById('lista-dist');
    if (!container) return;

    if (!movs.length) {
      container.innerHTML = '<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M1 3h15l3 9H4L1 3z"/><path d="M1 3l3 9v6h16v-6l-3-9"/></svg><p>Sin unidades adentro</p></div>';
      return;
    }

    container.innerHTML = movs.map(m => {
      const horas = typeof m._horasDentroActual === 'number'
        ? m._horasDentroActual.toFixed(1) + 'h'
        : '—';
      const predio = Catalogos.nombrePredio(m.ID_Predio);
      return `
        <div class="mov-card ingreso-border">
          <div class="mov-card-header">
            <span class="mov-card-id">${m.Dominio || m.ID_Unidad}</span>
            <span class="tag tag-abierto">↑ ${horas}</span>
          </div>
          <div class="mov-card-detail">
            <strong>Predio:</strong> ${predio} &nbsp;
            <strong>Carga:</strong> ${m.Estado_Carga_Ingreso || '—'} &nbsp;
            <strong>Chofer:</strong> ${m.Chofer || '—'}
          </div>
          <div class="mov-card-detail text-muted">${m.FechaHora_Ingreso}</div>
          <div class="btn-row" style="margin-top:8px">
            <button class="btn btn-egreso btn-sm" onclick="abrirEgresoDistModal('${m.ID_Mov}','${m.Dominio}')">
              ↓ Registrar Egreso
            </button>
          </div>
        </div>`;
    }).join('');
  },
};

// ── Modal de egreso ──────────────────────────────────────────
function abrirEgresoDistModal(idMov, dominio) {
  document.getElementById('egr-dist-id-mov').value = idMov;
  document.getElementById('egr-dist-titulo').textContent = 'Egreso — ' + dominio;
  document.getElementById('modal-egreso-dist').style.display = 'flex';
}

function initDistribucion() {
  // Formulario de ingreso
  document.getElementById('form-dist-ingreso').addEventListener('submit', async e => {
    e.preventDefault();
    await Distribucion.registrarIngreso(e.target);
  });

  // Modal egreso
  document.getElementById('btn-cerrar-egr-dist').addEventListener('click', () => {
    document.getElementById('modal-egreso-dist').style.display = 'none';
  });

  document.getElementById('form-egreso-dist').addEventListener('submit', async e => {
    e.preventDefault();
    const idMov       = document.getElementById('egr-dist-id-mov').value;
    const estadoCarga = document.querySelector('input[name="estado-carga-egr-dist"]:checked')?.value;
    const detalle     = document.getElementById('egr-dist-detalle').value;
    const obs         = document.getElementById('egr-dist-obs').value;
    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true;
    const res = await Distribucion.registrarEgreso(idMov, estadoCarga, detalle, obs);
    btn.disabled = false;
    if (res && res.ok) {
      document.getElementById('modal-egreso-dist').style.display = 'none';
      e.target.reset();
    }
  });
}
