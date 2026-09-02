// distribucion.js — Formularios y lista de distribución

const Distribucion = {
  // ── Predio fijo cuando el vigilador solo tiene uno asignado ───
  // Si el select de predio quedó con una sola opción disponible (el back ya filtra por
  // Predio_Asignado en getCatalogos), no tiene sentido hacerlo elegir: se autoselecciona
  // y se bloquea el campo. Si tiene más de un predio (supervisor/admin, o Predio_Asignado
  // = TODOS), el selector queda editable como siempre.
  aplicarPredioFijo() {
    const sel = document.getElementById('sel-predio-dist');
    if (!sel) return;
    const opciones = Array.from(sel.options).filter(o => o.value !== '');
    if (opciones.length !== 1) return;

    const opt = opciones[0];
    sel.value = opt.value;

    const input = sel._comboInput;
    if (!input) return;
    input.value = opt.textContent;
    input.disabled = true; // bloqueado del todo: no hay nada para elegir
    const arrow = sel.closest('.combobox-wrap')?.querySelector('.combobox-arrow');
    if (arrow) arrow.style.display = 'none';
  },

  // ── Registrar ingreso ─────────────────────────────────────────
  async registrarIngreso(form) {
    const idPredio     = form.querySelector('#sel-predio-dist').value;
    const idUnidad     = form.querySelector('#sel-unidad-dist').value;
    const chofer       = form.querySelector('#sel-chofer-dist').value;
    const estadoCarga  = form.querySelector('input[name="estado-carga-dist"]:checked')?.value;
    const detalleCarga = form.querySelector('#det-carga-dist').value;
    const observaciones= form.querySelector('#obs-dist').value;
    const tipoIngreso  = form.querySelector('#chk-nocturno-dist')?.checked ? 'nocturno' : 'normal';

    if (!idPredio)    { App.toast('Seleccioná el predio', 'err'); return; }
    if (!idUnidad)    { App.toast('Seleccioná o escaneá la unidad', 'err'); return; }
    if (!estadoCarga) { App.toast('Indicá el estado de carga', 'err'); return; }

    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Registrando...';

    const res = await api('distribucionIngreso', {
      idPredio, idUnidad, chofer, estadoCarga, detalleCarga, observaciones, tipoIngreso,
    });

    btn.disabled = false;
    btn.textContent = 'Registrar Ingreso';

    if (res.ok) {
      App.toast('Ingreso registrado — ' + res.dominio, 'ok');
      form.reset();
      ['sel-predio-dist', 'sel-unidad-dist', 'sel-chofer-dist'].forEach(id => {
        const s = document.getElementById(id);
        if (s && s._comboInput) s._comboInput.value = '';
      });
      this.aplicarPredioFijo(); // form.reset() también pisa el predio bloqueado — re-fijarlo
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
      this.cargarLista();
    } else {
      App.toast(res.error, 'err');
    }
    return res;
  },

  // ── Cargar lista de abiertos ───────────────────────────────────
  async cargarLista() {
    const res = await api('distribucionAbiertos');
    if (!res.ok) { App.toast('Error al cargar lista', 'err'); return; }
    const movs      = res.movimientos || [];
    const nocturnos = movs.filter(m => String(m.Tipo_Ingreso || '').toLowerCase() === 'nocturno');
    const normales  = movs.filter(m => String(m.Tipo_Ingreso || '').toLowerCase() !== 'nocturno');

    this.renderizarLista(normales, 'lista-dist');
    this.renderizarLista(nocturnos, 'lista-dist-nocturno');

    const cNormales  = document.getElementById('count-ingreso-real');
    if (cNormales) cNormales.textContent = normales.length;
    const cNocturnos = document.getElementById('count-nocturno');
    if (cNocturnos) cNocturnos.textContent = nocturnos.length;

    // Actualizar badge (total, incluye ambos)
    const badge = document.getElementById('badge-dist');
    if (badge) badge.textContent = movs.length + ' dentro';
  },

  renderizarLista(movs, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!movs.length) {
      container.innerHTML = '<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M1 3h15l3 9H4L1 3z"/><path d="M1 3l3 9v6h16v-6l-3-9"/></svg><p>Sin unidades</p></div>';
      return;
    }

    container.innerHTML = movs.map(m => {
      const horas = typeof m._horasDentroActual === 'number'
        ? m._horasDentroActual.toFixed(1) + 'h'
        : '—';
      const predio = m.Nombre_Predio || Catalogos.nombrePredio(m.ID_Predio);
      const dominioLbl = (m.Dominio || m.ID_Unidad) + (m.Interno ? ' [' + m.Interno + ']' : '');
      return `
        <div class="mov-card ingreso-border">
          <div class="mov-card-header">
            <span class="mov-card-id">${dominioLbl}</span>
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

  // Selects con búsqueda predictiva
  Catalogos.initCombobox('sel-predio-dist',  'Buscar predio…');
  Catalogos.initCombobox('sel-unidad-dist',  'Buscar unidad o dominio…');
  Catalogos.initCombobox('sel-chofer-dist',  'Buscar chofer por nombre…');
}
