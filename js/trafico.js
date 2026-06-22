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

function leerFotos(inputId) {
  const input = document.getElementById(inputId);
  if (!input || !input.files || !input.files.length) return Promise.resolve([]);
  return Promise.all(Array.from(input.files).map(f => comprimirImagen(f)));
}

function initFotoInput(inputId, lblId, prevContId) {
  const input = document.getElementById(inputId);
  const lbl   = document.getElementById(lblId);
  const cont  = document.getElementById(prevContId);
  if (!input) return;

  input.addEventListener('change', async () => {
    if (!input.files.length) return;
    const b64s   = await Promise.all(Array.from(input.files).map(f => comprimirImagen(f)));
    const validas = b64s.filter(Boolean);
    if (!validas.length) return;
    cont.innerHTML = '';
    validas.forEach(b64 => {
      const img = document.createElement('img');
      img.src = b64;
      img.className = 'foto-preview visible';
      img.alt = 'Foto';
      cont.appendChild(img);
    });
    lbl.classList.add('tiene-foto');
    lbl.textContent = '✓ ' + validas.length + (validas.length === 1 ? ' foto' : ' fotos');
  });
}

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

function actualizarBotonSubmit(form) {
  const tipoEvento = (form.querySelector('input[name="tipo-evento-traf"]:checked') || {}).value || 'ingreso';
  const sitrack    = (form.querySelector('input[name="estado-sitrack"]:checked') || {}).value || '';
  const esFalla    = sitrack === 'falla' || sitrack === 'sin-reporte';
  const btn = document.getElementById('btn-submit-traf');
  if (!btn) return;
  const base = tipoEvento === 'ingreso' ? '↑ Registrar Ingreso' : '↓ Registrar Egreso';
  btn.textContent = esFalla ? base + ' (Pendiente)' : base;
}

// ─────────────────────────────────────────────────────────────
// OBJETO PRINCIPAL
// ─────────────────────────────────────────────────────────────

const Trafico = {

  _sitrackMov:         null,
  _sitrackTelefonos:   null,
  _pendientes:         [],
  _pendientesTelefonos: null,

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

    // ── Campos inspección ────────────────────────────────
    const operador      = form.querySelector('#traf-operador').value.trim();
    const estadoOp      = form.querySelector('input[name="estado-operativo"]:checked')?.value;
    const estadoSitrack = form.querySelector('input[name="estado-sitrack"]:checked')?.value;
    const certTractor   = form.querySelector('#traf-cert-tractor').value.trim();
    const certArrastre  = form.querySelector('#traf-cert-arrastre').value.trim();
    const limpieza      = form.querySelector('input[name="limpieza"]:checked')?.value;

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

    if (!operador)      { App.toast('Operador de portería obligatorio', 'err'); return; }
    if (!estadoOp)      { App.toast('Indicá el estado operativo', 'err'); return; }
    if (!estadoSitrack) { App.toast('Indicá el estado SITRACK', 'err'); return; }
    if (!limpieza)      { App.toast('Indicá el estado de limpieza', 'err'); return; }

    const esOtro = !idServicio || idServicio.toUpperCase() === 'OTRO';
    if (esOtro && !servicioOtro) {
      App.toast('Especificá el servicio en "Otro"', 'err');
      return;
    }

    if (estadoOp === 'observacion' || estadoOp === 'no-operativo') {
      if (!danosChecked.length && !observaciones) {
        document.getElementById('warn-estado-op').classList.add('visible');
        App.toast('Estado ' + estadoOp + ': marcá un daño o completá Observaciones', 'err');
        document.getElementById('warn-estado-op').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
    }

    // ── Fotos ─────────────────────────────────────────────
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Procesando...';

    const [fotosTractor, fotosArrastre, fotosExtra, fotosPrecintos, fotosDanos] = await Promise.all([
      leerFotos('traf-foto-tractor'),
      leerFotos('traf-foto-arrastre'),
      leerFotos('traf-foto-extra'),
      leerFotos('traf-foto-precintos'),
      leerFotos('traf-foto-danos'),
    ]);

    // Filtrar strings vacíos por fallo de canvas en mobile
    const tractorValidas   = fotosTractor.filter(Boolean);
    const arrastreValidas  = fotosArrastre.filter(Boolean);
    const precintosValidos = fotosPrecintos.filter(Boolean);
    const danosValidas     = fotosDanos.filter(Boolean);

    if (!tractorValidas.length) {
      App.toast('Foto del tractor obligatoria', 'err');
      btn.disabled = false; actualizarBotonSubmit(form); return;
    }
    if (!arrastreValidas.length) {
      App.toast('Foto del furgón/arrastre obligatoria', 'err');
      btn.disabled = false; actualizarBotonSubmit(form); return;
    }
    if (!precintosValidos.length) {
      App.toast('Foto de precintos obligatoria', 'err');
      btn.disabled = false; actualizarBotonSubmit(form); return;
    }
    if (danosChecked.length && !danosValidas.length) {
      App.toast('Marcaste daños físicos: foto de daños obligatoria', 'err');
      btn.disabled = false; actualizarBotonSubmit(form); return;
    }

    const res = await api('traficoEvento', {
      tipoEvento, idPredio, idServicio, servicioOtro,
      chofer, tractor, arrastre, precintos,
      operador, estadoOperativo: estadoOp, estadoSitrack,
      certTractor, certArrastre, limpieza,
      equipamiento, danos, observaciones,
      fotosTractor:   tractorValidas,
      fotosArrastre:  arrastreValidas,
      fotosExtra:     fotosExtra.filter(Boolean),
      fotosPrecintos: precintosValidos,
      fotosDanos:     danosValidas,
    });

    btn.disabled = false;
    actualizarBotonSubmit(form);

    if (res.ok) {
      const pendiente = res.pendienteSitrack;

      // Resetear form y UI
      form.reset();
      // Los comboboxes no se resetean con form.reset() — limpiar manualmente
      ['sel-predio-traf', 'sel-servicio-traf', 'sel-chofer-traf'].forEach(id => {
        const s = document.getElementById(id);
        if (s && s._comboInput) s._comboInput.value = '';
      });
      ['prev-cont-tractor','prev-cont-arrastre','prev-cont-extra','prev-cont-precintos','prev-cont-danos'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
      });
      ['lbl-foto-tractor','lbl-foto-arrastre','lbl-foto-extra','lbl-foto-precintos','lbl-foto-danos'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.remove('tiene-foto'); el.textContent = '📷 Tomar / Elegir'; }
      });
      const fieldFotoDanos = document.getElementById('field-foto-danos');
      if (fieldFotoDanos) fieldFotoDanos.style.display = 'none';
      const warnSitrack = document.getElementById('warn-sitrack');
      if (warnSitrack) warnSitrack.style.display = 'none';
      document.getElementById('warn-estado-op')?.classList.remove('visible');
      document.getElementById('warn-sucio')?.classList.remove('visible');
      toggleServicioOtro();

      if (pendiente) {
        App.toast('Pendiente SITRACK guardado (' + res.id + '). Gestión desde "Viajes en Ruta".', 'warn');
      } else {
        let msg = 'Evento registrado.';
        if (res.idViaje && tipoEvento === 'egreso')  msg += ' Viaje abierto.';
        if (res.idViaje && tipoEvento === 'ingreso') msg += ' Viaje cerrado (' + res.horasRuta + 'h).';
        App.toast(msg, 'ok');
        if (res.advertenciaSinIngreso) {
          App.toast('Sin ingreso previo registrado para este tractor.', 'warn');
        }
      }

      // Diagnóstico de fotos: si Drive falló y se enviaron fotos, avisar
      const hubFotos = tractorValidas.length || arrastreValidas.length || fotosExtra.filter(Boolean).length
                    || precintosValidos.length || danosValidas.length;
      if (res.driveOk === false && hubFotos) {
        App.toast('Drive sin autorización — las fotos no se guardaron. Ver instrucciones de deploy.', 'warn');
      }

      this.cargarViajes();
    } else {
      App.toast(res.error, 'err');
    }
  },

  // ── Viajes en ruta ──────────────────────────────────────

  async cargarViajes() {
    const [resViajes] = await Promise.all([
      api('viajesEnRuta'),
      this.cargarPendientes(),
    ]);
    if (!resViajes.ok) return;
    this.renderizarViajes(resViajes.viajes || []);
    const badge = document.getElementById('badge-traf');
    if (badge) badge.textContent = (resViajes.viajes || []).length + ' en ruta';
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

  // ── Pendientes SITRACK ──────────────────────────────────

  async cargarPendientes() {
    const storedRaw = sessionStorage.getItem('pendSitrack');

    const res = await api('traficosPendientes', {});
    if (res.ok) {
      this._pendientes          = res.pendientes || [];
      this._pendientesTelefonos = res.telefonos  || {};
      this.renderizarPendientes(this._pendientes);
    }

    const urlId = new URLSearchParams(window.location.search).get('sitrack');
    let storedMov = null;
    try { if (storedRaw) storedMov = JSON.parse(storedRaw); } catch(e) {}
    const autoId = urlId || (storedMov ? storedMov.ID_Mov : null);

    if (!autoId) return;
    if (urlId) history.replaceState(null, '', window.location.pathname);
    sessionStorage.removeItem('pendSitrack');

    const fromApi = this._pendientes.find(p => p.ID_Mov === autoId);
    if (fromApi) {
      this.abrirGestion(fromApi, this._pendientesTelefonos);
    } else if (storedMov) {
      this.abrirGestion(storedMov, this._pendientesTelefonos);
    }
  },

  _pendienteCardHtml(p) {
    const predio     = p.Nombre_Predio || Catalogos.nombrePredio(p.ID_Predio) || p.ID_Predio;
    const tipoLabel  = p.Tipo_Evento === 'ingreso' ? '↑ Ingreso' : '↓ Egreso';
    const sitrackLbl = p.SITRACK === 'sin-reporte' ? 'Sin reporte' : 'Falla de servicio';
    const ts         = String(p.FechaHora_Ingreso || p.FechaHora_Egreso || '').replace('T', ' ').substring(0, 16);
    return `
      <div class="mov-card pendiente-card">
        <div class="mov-card-header">
          <span class="mov-card-id">${p.ID_Mov}</span>
          <span class="tag tag-pendiente">⚠️ SITRACK</span>
        </div>
        <div class="mov-card-detail">
          <strong>${p.Tractor}</strong>${p.Arrastre ? ' / ' + p.Arrastre : ''} — ${tipoLabel}
        </div>
        <div class="mov-card-detail">
          <strong>Predio:</strong> ${predio} &nbsp;
          <strong>Estado:</strong> ${sitrackLbl}
        </div>
        <div class="mov-card-detail text-muted">${ts}</div>
        <div class="btn-row" style="margin-top:8px">
          <button class="btn btn-outline btn-sm" onclick="Trafico._abrirGestionById('${p.ID_Mov}')">Gestión</button>
          <button class="btn btn-primary btn-sm" onclick="Trafico._abrirFinalizarById('${p.ID_Mov}')">Finalizar</button>
        </div>
      </div>`;
  },

  renderizarPendientes(pendientes) {
    const header    = document.getElementById('header-pendientes-sitrack');
    const container = document.getElementById('lista-pendientes-sitrack');
    const panel     = document.getElementById('panel-pendientes-traf');
    const panelBody = document.getElementById('panel-pend-lista');
    const panelCnt  = document.getElementById('panel-pend-count');

    if (!pendientes.length) {
      if (container) container.innerHTML = '';
      if (header)    header.style.display = 'none';
      if (panel)     panel.style.display  = 'none';
      return;
    }

    const html = pendientes.map(p => this._pendienteCardHtml(p)).join('');
    const n    = pendientes.length;

    if (header)    header.style.display = '';
    if (container) container.innerHTML  = html;

    if (panel)    panel.style.display  = '';
    if (panelBody) panelBody.innerHTML = html;
    if (panelCnt)  panelCnt.textContent = n + ' pendiente' + (n !== 1 ? 's' : '');
  },

  _abrirGestionById(idMov) {
    const mov = this._pendientes.find(p => p.ID_Mov === idMov);
    if (mov) this.abrirGestion(mov, this._pendientesTelefonos);
  },

  _abrirFinalizarById(idMov) {
    const mov = this._pendientes.find(p => p.ID_Mov === idMov);
    if (!mov) return;
    this.abrirGestion(mov, this._pendientesTelefonos);
    setTimeout(() => {
      const obs = document.getElementById('spit-obs-final');
      if (obs) { obs.focus(); obs.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    }, 200);
  },

  // ── Modal de gestión SITRACK ────────────────────────────

  abrirGestion(mov, telefonos) {
    this._sitrackMov       = mov;
    this._sitrackTelefonos = telefonos || {};

    const predio     = mov.Nombre_Predio || Catalogos.nombrePredio(mov.ID_Predio) || mov.ID_Predio || '—';
    const arrastre   = mov.Arrastre || '—';
    const sitrackLbl = mov.SITRACK === 'sin-reporte' ? 'Sin reporte' : 'Falla de servicio';
    const tipoLabel  = mov.Tipo_Evento === 'ingreso' ? '↑ Ingreso' : '↓ Egreso';

    document.getElementById('spit-info').innerHTML =
      `<strong>${mov.ID_Mov}</strong> — ${tipoLabel}<br>` +
      `<strong>Tractor:</strong> ${mov.Tractor} &nbsp; <strong>Furgón:</strong> ${arrastre}<br>` +
      `<strong>Predio:</strong> ${predio} &nbsp; <strong>SITRACK:</strong> ⚠️ ${sitrackLbl}`;

    const numSitrack = (telefonos && telefonos.sitrack) ? telefonos.sitrack : '';
    const numTrafico = (telefonos && telefonos.trafico) ? telefonos.trafico : '5492616686556';

    const msgSitrack = encodeURIComponent(
      'Buen día, somos Andesmar Cargas. Necesitamos asistencia técnica por falla de reporte satelital:\n' +
      '• Tractor: ' + mov.Tractor + '\n' +
      '• Furgón: ' + arrastre + '\n' +
      '• Base: ' + predio + '\n' +
      '• Estado: ' + sitrackLbl + '\n' +
      'Por favor confirmar disponibilidad. Muchas gracias.'
    );
    const msgTrafico = encodeURIComponent(
      'Buenos días, te hablamos del predio ' + predio + ' sobre la unidad ' +
      mov.Tractor + '/' + arrastre + ' que falló SITRACK y ya nos comunicamos.'
    );

    const btnWaSitrack = document.getElementById('btn-wa-sitrack');
    if (numSitrack) {
      btnWaSitrack.href         = 'https://wa.me/' + numSitrack + '?text=' + msgSitrack;
      btnWaSitrack.style.opacity = '';
      btnWaSitrack.title         = '';
    } else {
      btnWaSitrack.href         = '#';
      btnWaSitrack.style.opacity = '0.5';
      btnWaSitrack.title         = 'Número SITRACK no configurado';
    }
    document.getElementById('btn-wa-trafico').href = 'https://wa.me/' + numTrafico + '?text=' + msgTrafico;

    this._renderHistorial(mov.Gestion_Sitrack || '[]');

    document.getElementById('spit-comentario').value  = '';
    document.getElementById('spit-obs-final').value   = '';
    const btnCS = document.getElementById('btn-confirm-sitrack');
    const btnCT = document.getElementById('btn-confirm-trafico');
    btnCS.textContent = '✓ Envié'; btnCS.disabled = false; btnCS.classList.remove('accion-confirmada');
    btnCT.textContent = '✓ Envié'; btnCT.disabled = false; btnCT.classList.remove('accion-confirmada');
    const btnFin = document.getElementById('btn-finalizar-pendiente');
    btnFin.disabled = false; btnFin.textContent = '✅ Finalizar registro';

    document.getElementById('modal-sitrack').style.display = 'flex';
  },

  _renderHistorial(gestionJson) {
    let entries = [];
    try { entries = JSON.parse(gestionJson || '[]'); } catch(e) {}
    if (!Array.isArray(entries)) entries = [];
    const el = document.getElementById('spit-historial');
    if (!entries.length) { el.innerHTML = ''; return; }
    const labels = {
      whatsapp_sitrack: '📱 SITRACK',
      whatsapp_trafico: '📱 Tráfico',
      comentario:       '💬',
      finalizacion:     '✅ Finalizado',
    };
    el.innerHTML = '<div class="historial-label">Historial:</div>' +
      entries.map(e => {
        const lbl = labels[e.accion] || e.accion;
        const ts  = String(e.ts || '').replace('T', ' ').substring(0, 16);
        return '<div class="historial-entry">' + ts + ' — ' + lbl + (e.nota ? ': ' + e.nota : '') + '</div>';
      }).join('');
  },

  async _confirmarAccion(accion, nota) {
    if (!this._sitrackMov) return;
    const res = await api('traficoGestion', { idMov: this._sitrackMov.ID_Mov, accion, nota });
    if (res.ok) {
      this._sitrackMov.Gestion_Sitrack = JSON.stringify(res.gestion);
      this._renderHistorial(this._sitrackMov.Gestion_Sitrack);
    } else {
      App.toast(res.error || 'Error al registrar acción', 'err');
    }
  },
};

// ─────────────────────────────────────────────────────────────
// INIT MODAL SITRACK
// ─────────────────────────────────────────────────────────────

function initSitrackModal() {
  document.getElementById('btn-cerrar-sitrack').addEventListener('click', () => {
    document.getElementById('modal-sitrack').style.display = 'none';
    Trafico._sitrackMov = null;
  });

  document.getElementById('btn-confirm-sitrack').addEventListener('click', async function() {
    this.disabled = true;
    await Trafico._confirmarAccion('whatsapp_sitrack', '');
    this.textContent = '✅ Enviado';
    this.classList.add('accion-confirmada');
  });

  document.getElementById('btn-confirm-trafico').addEventListener('click', async function() {
    this.disabled = true;
    await Trafico._confirmarAccion('whatsapp_trafico', '');
    this.textContent = '✅ Enviado';
    this.classList.add('accion-confirmada');
  });

  document.getElementById('btn-add-comentario').addEventListener('click', async function() {
    const textarea = document.getElementById('spit-comentario');
    const nota     = textarea.value.trim();
    if (!nota) { App.toast('Escribí un comentario antes de agregar', 'warn'); return; }
    this.disabled = true;
    await Trafico._confirmarAccion('comentario', nota);
    textarea.value = '';
    this.disabled = false;
    App.toast('Comentario registrado', 'ok');
  });

  document.getElementById('btn-finalizar-pendiente').addEventListener('click', async function() {
    const obs = document.getElementById('spit-obs-final').value.trim();
    if (!obs) { App.toast('Escribí la observación final antes de cerrar', 'err'); return; }
    this.disabled    = true;
    this.textContent = 'Finalizando...';
    const res = await api('traficoFinalizar', { idMov: Trafico._sitrackMov.ID_Mov, obs });
    this.disabled    = false;
    this.textContent = '✅ Finalizar registro';
    if (res.ok) {
      App.toast('Registro ' + Trafico._sitrackMov.ID_Mov + ' finalizado.', 'ok');
      document.getElementById('modal-sitrack').style.display = 'none';
      Trafico._sitrackMov = null;
      Trafico.cargarViajes();
    } else {
      App.toast(res.error, 'err');
    }
  });
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

  // Tipo de evento → actualizar texto del botón
  form.querySelectorAll('input[name="tipo-evento-traf"]').forEach(r => {
    r.addEventListener('change', () => actualizarBotonSubmit(form));
  });

  // Estado SITRACK → mostrar aviso, actualizar botón
  form.querySelectorAll('input[name="estado-sitrack"]').forEach(r => {
    r.addEventListener('change', () => {
      if (!r.checked) return;
      const esFalla = r.value === 'falla' || r.value === 'sin-reporte';
      const warn = document.getElementById('warn-sitrack');
      if (warn) warn.style.display = esFalla ? 'block' : 'none';
      actualizarBotonSubmit(form);
    });
  });

  // Mostrar/ocultar "Otro servicio"
  document.getElementById('sel-servicio-traf').addEventListener('change', toggleServicioOtro);

  // Advertencia sucio
  form.querySelectorAll('input[name="limpieza"]').forEach(r => {
    r.addEventListener('change', () => {
      const warn = document.getElementById('warn-sucio');
      if (warn) warn.classList.toggle('visible', r.value === 'sucio' && r.checked);
    });
  });

  // Daños: ocultar warn-estado-op + mostrar/ocultar foto daños
  form.querySelectorAll('input[name="danos-fisicos"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const estadoOp  = form.querySelector('input[name="estado-operativo"]:checked')?.value;
      const anyDano   = form.querySelectorAll('input[name="danos-fisicos"]:checked').length > 0;
      if (anyDano || estadoOp === 'operativo') {
        document.getElementById('warn-estado-op')?.classList.remove('visible');
      }
      const fieldFotoDanos = document.getElementById('field-foto-danos');
      if (fieldFotoDanos) fieldFotoDanos.style.display = anyDano ? '' : 'none';
    });
  });

  document.getElementById('traf-obs').addEventListener('input', function() {
    if (this.value.trim()) document.getElementById('warn-estado-op')?.classList.remove('visible');
  });

  // Opacidad foto arrastre
  document.getElementById('traf-arrastre').addEventListener('input', toggleFotoArrastre);

  // Inputs de foto
  initFotoInput('traf-foto-tractor',   'lbl-foto-tractor',   'prev-cont-tractor');
  initFotoInput('traf-foto-arrastre',  'lbl-foto-arrastre',  'prev-cont-arrastre');
  initFotoInput('traf-foto-extra',     'lbl-foto-extra',     'prev-cont-extra');
  initFotoInput('traf-foto-precintos', 'lbl-foto-precintos', 'prev-cont-precintos');
  initFotoInput('traf-foto-danos',     'lbl-foto-danos',     'prev-cont-danos');

  // Modal SITRACK
  initSitrackModal();

  // Selects con búsqueda predictiva
  Catalogos.initCombobox('sel-predio-traf',   'Buscar predio…');
  Catalogos.initCombobox('sel-servicio-traf', 'Buscar servicio…');
  Catalogos.initCombobox('sel-chofer-traf',   'Buscar chofer por nombre…');
}
