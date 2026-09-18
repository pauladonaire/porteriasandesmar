// distribucion.js — Formularios y lista de distribución

// Caché de "unidades adentro" — 30s. Mismo key que usa el prefetch de js/nav.js
// al hacer click en "Distribuc.", para que si llegó a tiempo no se vuelva a pedir.
const DIST_ABIERTOS_CACHE_KEY = 'ip_dist_abiertos_cache';
const DIST_ABIERTOS_CACHE_TTL_MS = 30000;

function _distAbiertosLeerCache() {
  try {
    const raw = sessionStorage.getItem(DIST_ABIERTOS_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached || (Date.now() - cached.ts) >= DIST_ABIERTOS_CACHE_TTL_MS) return null;
    return cached;
  } catch (e) {
    return null;
  }
}
function _distAbiertosGuardarCache(movimientos) {
  try {
    sessionStorage.setItem(DIST_ABIERTOS_CACHE_KEY, JSON.stringify({ ts: Date.now(), movimientos }));
  } catch (e) { /* no crítico */ }
}
function _distAbiertosInvalidarCache() {
  try { sessionStorage.removeItem(DIST_ABIERTOS_CACHE_KEY); } catch (e) { /* no crítico */ }
}

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

  // ── Preseleccionar chofer desde el dato de Drivin (Chofer_Drivin de UNIDADES) ──
  // Igual idea que aplicarPredioFijo(): si ya sabemos el chofer habitual de esa unidad
  // (columna J de UNIDADES, sincronizada desde Drivin), se lo dejamos precargado para
  // que el vigilador no tenga que buscarlo — pero sin bloquear el campo, porque el
  // chofer real puede cambiar de un viaje a otro. Si no matchea ningún chofer del
  // catálogo, se agrega como opción temporal (mismo patrón que scanner.js con la unidad).
  preseleccionarChofer(unidad) {
    const nombre = String(unidad?.Chofer_Drivin || '').trim();
    if (!nombre) return;
    const sel = document.getElementById('sel-chofer-dist');
    if (!sel) return;

    let opt = Array.from(sel.options).find(o => o.value === nombre);
    if (!opt) {
      opt = document.createElement('option');
      opt.value = nombre;
      opt.textContent = nombre;
      sel.appendChild(opt);
    }
    sel.value = nombre;
    if (sel._comboInput) sel._comboInput.value = nombre;
  },

  // ── Registrar ingreso ─────────────────────────────────────────
  async registrarIngreso(form) {
    const idPredio     = predioFijoVigilador() || form.querySelector('#sel-predio-dist').value;
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
      _distAbiertosInvalidarCache(); // el ingreso recién creado tiene que verse ya, no en 30s
      App.mostrar('dentro-dist');
    } else {
      App.toast(res.error, 'err');
    }
  },

  // ── Registrar egreso RÁPIDO (toggle "Tipo de Evento: Egreso") ──────────────────
  // A diferencia de registrarEgreso (que necesita el idMov de una tarjeta ya listada
  // en "Unidades Adentro"), acá se identifica la unidad por QR o por el combobox — el
  // backend (distribucionEgresoPorUnidad, apps-script/Distribucion.gs) busca el
  // ingreso abierto de esa unidad en el predio y lo cierra directo. Pensado para que
  // el vigilador no tenga que entrar a la lista y buscar la tarjeta correspondiente.
  async registrarEgresoRapido(form) {
    const idPredio     = predioFijoVigilador() || form.querySelector('#sel-predio-dist').value;
    const idUnidad     = form.querySelector('#sel-unidad-dist').value;
    const estadoCarga  = form.querySelector('input[name="estado-carga-dist"]:checked')?.value;
    const detalleCarga = form.querySelector('#det-carga-dist').value;
    const observaciones= form.querySelector('#obs-dist').value;

    if (!idPredio)    { App.toast('Seleccioná el predio', 'err'); return; }
    if (!idUnidad)    { App.toast('Escaneá o seleccioná la unidad', 'err'); return; }
    if (!estadoCarga) { App.toast('Indicá el estado de carga', 'err'); return; }

    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Registrando...';

    const res = await api('distribucionEgresoPorUnidad', { idPredio, idUnidad, estadoCarga, detalleCarga, observaciones });
    btn.disabled = false;

    if (res.ok) {
      if (res.sinIngreso) {
        // Quedó registrado igual, pero como anomalía (sin ingreso previo) — avisar bien
        // claro para que el vigilador sepa que no es un egreso "normal".
        App.toast('⚠ Egreso registrado SIN ingreso previo — ' + res.dominio + ' (queda marcado para seguimiento)', 'warn', 6000);
      } else {
        App.toast('Egreso registrado — ' + res.dominio + ' · ' + res.horasDentro + 'h dentro', 'ok');
      }
      form.reset(); // vuelve a dejar tildado "Ingreso" (checked por defecto en el HTML)
      const su = document.getElementById('sel-unidad-dist');
      if (su && su._comboInput) su._comboInput.value = '';
      this.aplicarPredioFijo();
      this.actualizarModoFormulario(form); // recién ACÁ: ya con el radio de vuelta en "Ingreso"
      _distAbiertosInvalidarCache();
    } else {
      this.actualizarModoFormulario(form); // el radio sigue en "Egreso" — solo repone el texto/spinner del botón
      App.toast(res.error, 'err');
    }
  },

  // ── Mostrar/ocultar campos de ingreso según el toggle "Tipo de Evento" ─────────
  actualizarModoFormulario(form) {
    const tipoEvento = form.querySelector('input[name="tipo-evento-dist"]:checked')?.value || 'ingreso';
    const esEgreso = tipoEvento === 'egreso';

    const grupoIngreso = document.getElementById('grupo-dist-ingreso');
    if (grupoIngreso) grupoIngreso.style.display = esEgreso ? 'none' : '';

    const lblEstadoCarga = document.getElementById('lbl-estado-carga-dist');
    if (lblEstadoCarga) lblEstadoCarga.textContent = esEgreso ? 'Estado de Carga al Egreso' : 'Estado de Carga al Ingreso';

    const btn = document.getElementById('btn-submit-dist');
    if (btn) {
      btn.classList.toggle('btn-ingreso', !esEgreso);
      btn.classList.toggle('btn-egreso', esEgreso);
      btn.textContent = esEgreso ? '↓ Registrar Egreso' : '↑ Registrar Ingreso';
    }
  },

  // ── Registrar egreso ──────────────────────────────────────────
  async registrarEgreso(idMov, estadoCarga, detalleCarga, observaciones) {
    if (!estadoCarga) { App.toast('Indicá el estado de carga al egreso', 'err'); return; }

    // Optimista: ocultar la tarjeta ya mismo, sin esperar la respuesta del servidor
    // (los ~2-4s de ida y vuelta con Apps Script dejan de sentirse).
    const card = Array.from(document.querySelectorAll('.mov-card'))
      .find(c => c.dataset.idMov === idMov);
    if (card) card.style.display = 'none';

    const res = await api('distribucionEgreso', { idMov, estadoCarga, detalleCarga, observaciones });
    if (res.ok) {
      App.toast('Egreso registrado — ' + res.horasDentro + 'h dentro', 'ok');
      _distAbiertosInvalidarCache();
      this.cargarLista();
    } else {
      App.toast(res.error, 'err');
      if (card) card.style.display = ''; // no se pudo cerrar — la unidad sigue adentro
    }
    return res;
  },

  // ── Cargar lista de abiertos ───────────────────────────────────
  // catalogosListos (opcional): promesa de Catalogos.cargar() en curso — si se pasa,
  // el render espera a que resuelva (necesita Catalogos para el nombre de predio de
  // respaldo), pero la llamada a distribucionAbiertos sale en paralelo, no después.
  async cargarLista(catalogosListos) {
    let movs, actualizadoTs;
    const cache = _distAbiertosLeerCache();

    if (cache) {
      movs = cache.movimientos;
      actualizadoTs = cache.ts;
    } else {
      const [res] = await Promise.all([
        api('distribucionAbiertos'),
        catalogosListos || Promise.resolve(),
      ]);
      if (!res.ok) { App.toast('Error al cargar lista', 'err'); return; }
      movs = res.movimientos || [];
      actualizadoTs = Date.now();
      _distAbiertosGuardarCache(movs);
    }

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

    const actEl = document.getElementById('dist-actualizado');
    if (actEl) {
      const seg = Math.max(0, Math.round((Date.now() - actualizadoTs) / 1000));
      actEl.textContent = seg <= 1 ? 'Actualizado recién' : 'Actualizado hace ' + seg + 's';
    }
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
        <div class="mov-card ingreso-border" data-id-mov="${m.ID_Mov}">
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
  // Formulario de ingreso/egreso — el toggle "Tipo de Evento" decide qué registrar
  document.getElementById('form-dist-ingreso').addEventListener('submit', async e => {
    e.preventDefault();
    const tipoEvento = e.target.querySelector('input[name="tipo-evento-dist"]:checked')?.value || 'ingreso';
    if (tipoEvento === 'egreso') await Distribucion.registrarEgresoRapido(e.target);
    else await Distribucion.registrarIngreso(e.target);
  });

  document.querySelectorAll('input[name="tipo-evento-dist"]').forEach(r => {
    r.addEventListener('change', () => Distribucion.actualizarModoFormulario(document.getElementById('form-dist-ingreso')));
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

  // Elegir una unidad manualmente (no por QR) también preselecciona su chofer habitual
  document.getElementById('sel-unidad-dist').addEventListener('change', e => {
    const unidad = Catalogos.unidades.find(u => u.ID_Unidad === e.target.value);
    Distribucion.preseleccionarChofer(unidad);
  });
}
