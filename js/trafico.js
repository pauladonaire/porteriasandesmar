// trafico.js — Formulario y lista de tráfico (planilla interbase)

// ─────────────────────────────────────────────────────────────
// HELPERS DE FOTO
// ─────────────────────────────────────────────────────────────

const PATENTE_RE = /^([A-Z]{3}\d{3}|[A-Z]{2}\d{3}[A-Z]{2})$/;

function validarPatente(str) {
  return PATENTE_RE.test(String(str).trim().toUpperCase());
}

function comprimirImagen(file, maxW = 900, quality = 0.72) {
  if (!file) return Promise.resolve('');
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onerror = () => resolve('');
    reader.onload = e => {
      const img = new Image();
      img.onerror = () => resolve('');
      img.onload = () => {
        const ratio = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function leerFoto(inputId) {
  const input = document.getElementById(inputId);
  if (!input || !input.files || !input.files[0]) return Promise.resolve('');
  return comprimirImagen(input.files[0]);
}

function initFotoInput(inputId, lblId, prevId) {
  const input = document.getElementById(inputId);
  const lbl   = document.getElementById(lblId);
  const prev  = document.getElementById(prevId);
  if (!input) return;

  input.addEventListener('change', async () => {
    if (!input.files[0]) return;
    const b64 = await comprimirImagen(input.files[0]);
    if (b64) {
      prev.src = b64;
      prev.classList.add('visible');
      lbl.classList.add('tiene-foto');
      lbl.textContent = '✓ Foto cargada';
    }
  });
}

// ─────────────────────────────────────────────────────────────
// OBJETO PRINCIPAL
// ─────────────────────────────────────────────────────────────

const Trafico = {

  async registrarEvento(form) {
    // ── Campos existentes ────────────────────────────────
    const tipoEvento   = form.querySelector('input[name="tipo-evento-traf"]:checked')?.value;
    const idPredio     = form.querySelector('#sel-predio-traf').value;
    const idServicio   = form.querySelector('#sel-servicio-traf').value;
    const servicioOtro = form.querySelector('#traf-serv-otro').value.trim();
    const tractor      = form.querySelector('#traf-tractor').value.trim().toUpperCase();
    const arrastre     = form.querySelector('#traf-arrastre').value.trim().toUpperCase();
    const chofer       = form.querySelector('#sel-chofer-traf').value;
    const precintos    = form.querySelector('#traf-precintos').value.trim();

    // ── Campos nuevos ────────────────────────────────────
    const operador       = form.querySelector('#traf-operador').value.trim();
    const estadoOp       = form.querySelector('input[name="estado-operativo"]:checked')?.value;
    const estadoSitrack  = form.querySelector('input[name="estado-sitrack"]:checked')?.value;
    const certTractor    = form.querySelector('#traf-cert-tractor').value.trim();
    const certArrastre   = form.querySelector('#traf-cert-arrastre').value.trim();
    const limpieza       = form.querySelector('input[name="limpieza"]:checked')?.value;

    const danosChecked = [...form.querySelectorAll('input[name="danos-fisicos"]:checked')]
      .map(el => el.value);
    const danos        = danosChecked.join(', ');
    const equipamiento = [...form.querySelectorAll('input[name="equipamiento"]:checked')]
      .map(el => el.value).join(', ');
    const observaciones = form.querySelector('#traf-obs').value.trim();

    // ── Validaciones ──────────────────────────────────────
    if (!tipoEvento)  { App.toast('Seleccioná Ingreso o Egreso', 'err'); return; }
    if (!idPredio)    { App.toast('Seleccioná el predio', 'err'); return; }
    if (!tractor)     { App.toast('Dominio tractor obligatorio', 'err'); return; }

    if (!validarPatente(tractor)) {
      App.toast('Dominio tractor inválido — formato: ABC123 o AB123CD', 'err');
      return;
    }
    if (arrastre && !validarPatente(arrastre)) {
      App.toast('Dominio arrastre inválido — formato: ABC123 o AB123CD', 'err');
      return;
    }

    if (!operador) { App.toast('Operador de portería obligatorio', 'err'); return; }
    if (!estadoOp) { App.toast('Indicá el estado operativo', 'err'); return; }
    if (!estadoSitrack) { App.toast('Indicá el estado SITRACK', 'err'); return; }
    if (!limpieza) { App.toast('Indicá el estado de limpieza', 'err'); return; }

    const esOtro = !idServicio || idServicio.toUpperCase() === 'OTRO';
    if (esOtro && !servicioOtro) {
      App.toast('Especificá el servicio en "Otro"', 'err');
      return;
    }

    // Validación: estado obs/no-operativo requiere daño o texto
    if (estadoOp === 'observacion' || estadoOp === 'no-operativo') {
      if (!danosChecked.length && !observaciones) {
        document.getElementById('warn-estado-op').classList.add('visible');
        App.toast('Estado ' + estadoOp + ': marcá un daño o completá Observaciones', 'err');
        document.getElementById('warn-estado-op').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
    }

    // ── Fotos (comprimir antes de enviar) ─────────────────
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Procesando...';

    const [fotoTractor, fotoArrastre, fotoExtra] = await Promise.all([
      leerFoto('traf-foto-tractor'),
      leerFoto('traf-foto-arrastre'),
      leerFoto('traf-foto-extra'),
    ]);

    const res = await api('traficoEvento', {
      tipoEvento, idPredio, idServicio, servicioOtro,
      chofer, tractor, arrastre, precintos,
      operador, estadoOperativo: estadoOp, estadoSitrack,
      certTractor, certArrastre, limpieza,
      equipamiento, danos, observaciones,
      fotoTractor, fotoArrastre, fotoExtra,
    });

    btn.disabled = false;
    btn.textContent = tipoEvento === 'ingreso' ? '↑ Registrar Ingreso' : '↓ Registrar Egreso';

    if (res.ok) {
      let msg = 'Evento registrado.';
      if (res.idViaje && tipoEvento === 'egreso')  msg += ' Viaje abierto.';
      if (res.idViaje && tipoEvento === 'ingreso') msg += ' Viaje cerrado (' + res.horasRuta + 'h).';
      App.toast(msg, 'ok');

      if (res.advertenciaSinIngreso) {
        App.toast('⚠️ No se encontró ingreso previo para este tractor', 'warn');
      }

      form.reset();
      // Limpiar previsualizaciones de fotos
      ['prev-foto-tractor', 'prev-foto-arrastre', 'prev-foto-extra'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('visible');
      });
      ['lbl-foto-tractor', 'lbl-foto-arrastre', 'lbl-foto-extra'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.remove('tiene-foto'); el.textContent = '📷 Tomar / Elegir'; }
      });
      document.getElementById('warn-estado-op')?.classList.remove('visible');
      document.getElementById('warn-sucio')?.classList.remove('visible');
      toggleServicioOtro();

      this.cargarViajes();
    } else {
      App.toast(res.error, 'err');
    }
  },

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
      container.innerHTML = `
        <div class="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
            <polyline points="17 6 23 6 23 12"/>
          </svg>
          <p>Sin viajes en ruta</p>
        </div>`;
      return;
    }

    container.innerHTML = viajes.map(v => {
      const orig  = Catalogos.nombrePredio(v.Predio_Origen);
      const dest  = Catalogos.nombrePredio(v.Predio_Destino);
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

// ─────────────────────────────────────────────────────────────
// HELPERS DE UI
// ─────────────────────────────────────────────────────────────

function toggleServicioOtro() {
  const sel = document.getElementById('sel-servicio-traf');
  const row = document.getElementById('row-serv-otro');
  if (!sel || !row) return;
  const esOtro = !sel.value || sel.value.toUpperCase() === 'OTRO'
    || (sel.options[sel.selectedIndex]?.text.toLowerCase().includes('otro'));
  row.style.display = esOtro ? 'block' : 'none';
}

function toggleFotoArrastre() {
  const arrastre = document.getElementById('traf-arrastre').value.trim();
  const field = document.getElementById('field-foto-arrastre');
  if (field) field.style.opacity = arrastre ? '1' : '0.5';
}

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────

function initTrafico() {
  const form = document.getElementById('form-traf');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    await Trafico.registrarEvento(form);
  });

  // Mostrar/ocultar "Otro servicio"
  document.getElementById('sel-servicio-traf').addEventListener('change', toggleServicioOtro);

  // Cambiar texto del botón según tipo_evento
  form.querySelectorAll('input[name="tipo-evento-traf"]').forEach(r => {
    r.addEventListener('change', () => {
      const btn = document.getElementById('btn-submit-traf');
      if (btn) btn.textContent = r.value === 'ingreso' ? '↑ Registrar Ingreso' : '↓ Registrar Egreso';
    });
  });

  // Advertencia sucio
  form.querySelectorAll('input[name="limpieza"]').forEach(r => {
    r.addEventListener('change', () => {
      const warn = document.getElementById('warn-sucio');
      if (warn) warn.classList.toggle('visible', r.value === 'sucio' && r.checked);
    });
  });

  // Ocultar warn-estado-op cuando se marca daño o se escribe observación
  form.querySelectorAll('input[name="danos-fisicos"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const estadoOp = form.querySelector('input[name="estado-operativo"]:checked')?.value;
      const anyDano  = form.querySelectorAll('input[name="danos-fisicos"]:checked').length > 0;
      if (anyDano || estadoOp === 'operativo') {
        document.getElementById('warn-estado-op')?.classList.remove('visible');
      }
    });
  });
  document.getElementById('traf-obs').addEventListener('input', function() {
    if (this.value.trim()) document.getElementById('warn-estado-op')?.classList.remove('visible');
  });

  // Opacidad foto arrastre según si se completó el campo
  document.getElementById('traf-arrastre').addEventListener('input', toggleFotoArrastre);

  // Inicializar inputs de foto con preview
  initFotoInput('traf-foto-tractor',  'lbl-foto-tractor',  'prev-foto-tractor');
  initFotoInput('traf-foto-arrastre', 'lbl-foto-arrastre', 'prev-foto-arrastre');
  initFotoInput('traf-foto-extra',    'lbl-foto-extra',    'prev-foto-extra');
}
