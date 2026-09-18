// personal.js — Formularios y lista de personal (visitas/clientes/proveedores)

// Caché de "personas adentro" — mismo patrón que distribucion.js (DIST_ABIERTOS_*).
// Antes cada entrada a "Ver personas adentro" o al atajo de Egreso esperaba el
// viaje completo a Apps Script (2-4s) aunque sean solo ~20 personas — el cuello de
// botella era la latencia del backend, no el tamaño de la lista.
const PERS_ABIERTOS_CACHE_KEY = 'ip_pers_abiertos_cache';
const PERS_ABIERTOS_CACHE_TTL_MS = 30000;

function _persAbiertosLeerCache() {
  try {
    const raw = sessionStorage.getItem(PERS_ABIERTOS_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached || (Date.now() - cached.ts) >= PERS_ABIERTOS_CACHE_TTL_MS) return null;
    return cached;
  } catch (e) {
    return null;
  }
}
function _persAbiertosGuardarCache(movimientos) {
  try {
    sessionStorage.setItem(PERS_ABIERTOS_CACHE_KEY, JSON.stringify({ ts: Date.now(), movimientos }));
  } catch (e) { /* no crítico */ }
}
function _persAbiertosInvalidarCache() {
  try { sessionStorage.removeItem(PERS_ABIERTOS_CACHE_KEY); } catch (e) { /* no crítico */ }
}

const Personal = {
  _movs: [], // última lista completa recibida del server, para filtrar sin volver a pedirla

  // ── Registrar ingreso ─────────────────────────────────────────
  async registrarIngreso(form) {
    const idPredio     = predioFijoVigilador() || form.querySelector('#sel-predio-pers').value;
    const tipoRegistro = form.querySelector('#sel-tipo-pers').value;
    const nombre       = form.querySelector('#pers-nombre').value.trim();
    const dni          = form.querySelector('#pers-dni').value.trim();
    const formaIngreso = form.querySelector('input[name="forma-ingreso"]:checked')?.value;
    const matricula    = form.querySelector('#pers-matricula').value.trim();
    const observaciones= form.querySelector('#pers-obs').value.trim();

    if (!idPredio)     { App.toast('Seleccioná el predio', 'err'); return; }
    if (!tipoRegistro) { App.toast('Seleccioná el tipo', 'err'); return; }
    if (!nombre)       { App.toast('Nombre es obligatorio', 'err'); return; }
    if (!formaIngreso) { App.toast('Indicá la forma de ingreso', 'err'); return; }
    if (formaIngreso === 'con_vehiculo' && !matricula) {
      App.toast('La matrícula es obligatoria con vehículo', 'err'); return;
    }

    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    const res = await api('personalIngreso', {
      idPredio, tipoRegistro, nombre, dni, formaIngreso, matricula, observaciones,
    });

    btn.disabled = false;
    btn.textContent = 'Registrar Ingreso';

    if (res.ok) {
      App.toast('Ingreso registrado: ' + nombre, 'ok');
      form.reset();
      toggleMatricula();
      const sp = document.getElementById('sel-predio-pers');
      if (sp && sp._comboInput) sp._comboInput.value = '';
      _persAbiertosInvalidarCache(); // el ingreso recién creado tiene que verse ya, no en 30s
      App.mostrar('dentro-pers');
    } else {
      App.toast(res.error, 'err');
    }
  },

  // ── Registrar egreso ──────────────────────────────────────────
  async registrarEgreso(idMov, observaciones) {
    // Optimista: ocultar la tarjeta ya mismo, sin esperar la respuesta del servidor
    // (los ~2-4s de ida y vuelta con Apps Script dejan de sentirse) — mismo patrón
    // que distribucion.js.
    const card = document.querySelector('.mov-card[data-id-mov="' + idMov + '"]');
    if (card) card.style.display = 'none';

    const res = await api('personalEgreso', { idMov, observaciones });
    if (res.ok) {
      App.toast('Egreso registrado — ' + res.horasDentro + 'h dentro', 'ok');
      // Sacamos la persona de la lista en memoria y de la caché sin volver a pedirle
      // todo al server: ya sabemos que salió, no hace falta esperar otro viaje a GAS.
      this._movs = this._movs.filter(m => m.ID_Mov !== idMov);
      _persAbiertosGuardarCache(this._movs);
      const badge = document.getElementById('badge-pers');
      if (badge) badge.textContent = this._movs.length + ' adentro';
    } else {
      App.toast(res.error, 'err');
      if (card) card.style.display = ''; // no se pudo cerrar — la persona sigue adentro
    }
    return res;
  },

  // Egreso de un toque, sin pasar por el modal — para el caso común (sin novedad
  // que cargar). El botón "+ Observación" de la tarjeta sigue abriendo el modal.
  async egresoDirecto(idMov, btnEl) {
    if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '<span class="spinner"></span>'; }
    await this.registrarEgreso(idMov, '');
  },

  // ── Cargar lista de abiertos ───────────────────────────────────
  async cargarLista() {
    const cache = _persAbiertosLeerCache();
    if (cache) {
      this._movs = cache.movimientos;
    } else {
      const res = await api('personalAbiertos');
      if (!res.ok) { App.toast('Error al cargar lista de personal', 'err'); return; }
      this._movs = res.movimientos || [];
      _persAbiertosGuardarCache(this._movs);
    }
    const buscar = document.getElementById('buscar-pers');
    if (buscar) this.filtrar(buscar.value);
    else this.renderizarLista(this._movs);
    const badge = document.getElementById('badge-pers');
    if (badge) badge.textContent = this._movs.length + ' adentro';
  },

  // Filtra la última lista recibida (sin volver a pedirla al server) por nombre o DNI
  filtrar(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) { this.renderizarLista(this._movs, false); return; }
    const filtrados = this._movs.filter(m =>
      String(m.Nombre_Apellido || '').toLowerCase().includes(q) ||
      String(m.DNI || '').toLowerCase().includes(q)
    );
    this.renderizarLista(filtrados, true);
  },

  renderizarLista(movs, filtroActivo = false) {
    const container = document.getElementById('lista-pers');
    if (!container) return;

    if (!movs.length) {
      container.innerHTML = filtroActivo
        ? '<div class="empty"><p>Nadie coincide con la búsqueda</p></div>'
        : '<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><p>Sin personas adentro</p></div>';
      return;
    }

    container.innerHTML = movs.map(m => {
      const horas  = typeof m._horasDentroActual === 'number' ? m._horasDentroActual.toFixed(1) + 'h' : '—';
      const predio = Catalogos.nombrePredio(m.ID_Predio);
      const mat    = m.Matricula === 'a pie' ? '🚶 a pie' : '🚗 ' + m.Matricula;
      const tipoBadge = { visita: '👤 Visita', cliente: '🛒 Cliente', proveedor: '🔧 Proveedor' };
      const nombreEsc = m.Nombre_Apellido.replace(/'/g, "\\'");
      return `
        <div class="mov-card pers-border" data-id-mov="${m.ID_Mov}">
          <div class="mov-card-header">
            <span class="mov-card-id">${m.Nombre_Apellido}</span>
            <span class="tag tag-abierto">↑ ${horas}</span>
          </div>
          <div class="mov-card-detail">
            <strong>${tipoBadge[m.Tipo_Registro] || m.Tipo_Registro}</strong> &nbsp;
            DNI: <strong>${m.DNI || '—'}</strong> &nbsp; ${mat}
          </div>
          <div class="mov-card-detail"><strong>Predio:</strong> ${predio} &nbsp; ${m.FechaHora_Ingreso}</div>
          <div class="btn-row" style="margin-top:8px;gap:8px">
            <button class="btn btn-egreso btn-sm" onclick="Personal.egresoDirecto('${m.ID_Mov}', this)">
              ↓ Registrar Egreso
            </button>
            <button type="button" class="btn btn-outline btn-sm" style="width:auto" onclick="abrirEgresioPersModal('${m.ID_Mov}','${nombreEsc}')">
              + Observación
            </button>
          </div>
        </div>`;
    }).join('');
  },
};

function abrirEgresioPersModal(idMov, nombre) {
  document.getElementById('egr-pers-id-mov').value = idMov;
  document.getElementById('egr-pers-titulo').textContent = 'Egreso — ' + nombre;
  document.getElementById('modal-egreso-pers').style.display = 'flex';
}

function toggleMatricula() {
  const radio = document.querySelector('input[name="forma-ingreso"]:checked');
  const row   = document.getElementById('row-matricula');
  if (!row) return;
  row.style.display = (radio && radio.value === 'con_vehiculo') ? 'block' : 'none';
}

function initPersonal() {
  document.getElementById('form-pers-ingreso').addEventListener('submit', async e => {
    e.preventDefault();
    await Personal.registrarIngreso(e.target);
  });

  // "Tipo de Evento: Egreso" es un atajo de navegación (no un estado del formulario de
  // ingreso): lleva directo a "Personas Adentro" — ya tiene buscador por nombre/DNI y
  // egreso de un toque — en vez de obligar a bajar hasta "Ver personas adentro →". Se
  // vuelve a marcar "Ingreso" enseguida para que la próxima vez que entre al formulario
  // no quede pisado.
  document.querySelectorAll('input[name="tipo-evento-pers"]').forEach(r => {
    r.addEventListener('change', () => {
      if (r.value !== 'egreso' || !r.checked) return;
      App.mostrar('dentro-pers');
      document.getElementById('pers-ev-ing').checked = true;
    });
  });

  // Mostrar/ocultar campo matrícula
  document.querySelectorAll('input[name="forma-ingreso"]').forEach(r => {
    r.addEventListener('change', toggleMatricula);
  });

  // Modal egreso
  document.getElementById('btn-cerrar-egr-pers').addEventListener('click', () => {
    document.getElementById('modal-egreso-pers').style.display = 'none';
  });

  document.getElementById('form-egreso-pers').addEventListener('submit', async e => {
    e.preventDefault();
    const idMov = document.getElementById('egr-pers-id-mov').value;
    const obs   = document.getElementById('egr-pers-obs').value;
    const btn   = e.target.querySelector('[type="submit"]');
    btn.disabled = true;
    const res = await Personal.registrarEgreso(idMov, obs);
    btn.disabled = false;
    if (res && res.ok) {
      document.getElementById('modal-egreso-pers').style.display = 'none';
      e.target.reset();
    }
  });

  // Select con búsqueda predictiva
  Catalogos.initCombobox('sel-predio-pers', 'Buscar predio…');

  // Buscador de "Personas Adentro" (filtra en memoria, sin volver a pedir al server)
  document.getElementById('buscar-pers')?.addEventListener('input', e => {
    Personal.filtrar(e.target.value);
  });
}
