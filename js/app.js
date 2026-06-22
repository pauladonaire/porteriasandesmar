// app.js — Login + Home (exclusivo de index.html)

const App = {
  mostrar(id) {
    document.querySelectorAll('.view').forEach(v => {
      v.classList.remove('active');
      v.style.display = 'none';
    });
    const vista = document.getElementById('view-' + id);
    if (!vista) return;
    vista.classList.add('active');
    vista.style.display = vista.dataset.display || 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (id === 'home' && typeof Sesion !== 'undefined' && Sesion.activo()) {
      this.cargarDashboard();
    }
  },

  toast(msg, tipo = 'info', duracion = 3000) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = 'toast ' + tipo;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), duracion);
  },

  toggleSection(bodyId, chevId) {
    const body = document.getElementById(bodyId);
    const chev = document.getElementById(chevId);
    if (!body) return;
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : '';
    if (chev) chev.classList.toggle('open', !isOpen);
  },

  async cargarDashboard() {
    const loading = document.getElementById('dash-loading');
    const content = document.getElementById('dash-content');
    if (loading) loading.style.display = '';

    const res = await api('getDashboard');
    if (loading) loading.style.display = 'none';
    if (!res || !res.ok) return;

    // Actualizar badges de los módulos
    const badgeDist = document.getElementById('badge-dist');
    const badgeTraf = document.getElementById('badge-traf');
    const badgePers = document.getElementById('badge-pers');
    if (badgeDist) badgeDist.textContent = res.counts.distDentro + ' dentro';
    if (badgeTraf) badgeTraf.textContent = res.counts.trafEnRuta + ' en ruta';
    if (badgePers) badgePers.textContent = res.counts.persAdentro + ' adentro';

    // Pendientes SITRACK
    const secSitrack = document.getElementById('section-sitrack');
    const cntSitrack = document.getElementById('count-sitrack');
    if (cntSitrack) cntSitrack.textContent = res.pendientesSitrack.length;
    if (secSitrack) secSitrack.style.display = res.pendientesSitrack.length ? '' : 'none';
    _renderSitrack(res.pendientesSitrack);

    // Viajes en ruta
    const cntViajes = document.getElementById('count-viajes');
    if (cntViajes) cntViajes.textContent = res.viajesEnRuta.length;
    _renderViajes(res.viajesEnRuta);

    // Fecha del día
    const fechaEl = document.getElementById('dash-fecha');
    if (fechaEl && res.fecha) {
      const [y, m, d] = res.fecha.split('-');
      fechaEl.textContent = d + '/' + m + '/' + y;
    }

    // Registros del día — contadores y listas
    const cntDist = document.getElementById('count-dist-hoy');
    const cntTraf = document.getElementById('count-traf-hoy');
    const cntPers = document.getElementById('count-pers-hoy');
    if (cntDist) cntDist.textContent = res.hoy.dist.length;
    if (cntTraf) cntTraf.textContent = res.hoy.traf.length;
    if (cntPers) cntPers.textContent = res.hoy.pers.length;
    _renderDistHoy(res.hoy.dist);
    _renderTrafHoy(res.hoy.traf);
    _renderPersHoy(res.hoy.pers);

    if (content) content.style.display = '';
  },

  async init() {
    initLoginForms();

    // Bottom-nav: home queda en esta página, el resto navega a su .html
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (!Sesion.activo()) return;
        const destino = item.dataset.pagina;
        if (destino === 'home') { this.mostrar('home'); return; }
        window.location.href = destino + '.html';
      });
    });

    // Logout
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      Auth.logout();
      document.getElementById('bottom-nav').classList.add('hidden');
      this.mostrar('login');
    });

    // Verificar sesión existente al cargar
    if (Auth.verificar()) {
      const u = Sesion.obtener();
      document.getElementById('topbar-user').textContent = u.Nombre_Apellido;
      const predio = u.Predio_Asignado === 'TODOS' ? 'Todos los predios' : u.Predio_Asignado;
      document.getElementById('topbar-predio').textContent = predio;
      document.getElementById('bottom-nav').classList.remove('hidden');
      this.mostrar('home');
      Catalogos.cargar().catch(() => this.toast('No se pudieron cargar los catálogos', 'warn'));
    } else {
      this.mostrar('login');
    }
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());

// ── Helpers de formato ────────────────────────────────────────

function _horaCorta(ts) {
  const t = String(ts || '').split('T')[1] || '';
  return t.substring(0, 5) || '—';
}

function _fmtHoras(h) {
  if (h === null || h === undefined || h === '') return '—';
  const total = Math.round(Number(h) * 60);
  if (isNaN(total)) return '—';
  const hrs = Math.floor(total / 60);
  const min = total % 60;
  return hrs ? hrs + 'h ' + String(min).padStart(2, '0') + 'm' : min + 'm';
}

// ── Renders del dashboard ─────────────────────────────────────

function _renderSitrack(items) {
  const el = document.getElementById('sitrack-body');
  if (!el) return;
  if (!items.length) {
    el.innerHTML = '<div class="dash-empty">Sin pendientes SITRACK</div>';
    return;
  }
  el.innerHTML = items.map(p => {
    const hora     = _horaCorta(p.FechaHora_Ingreso || p.FechaHora_Egreso);
    const servicio = p.Nombre_Servicio || p.ID_Servicio || '—';
    const arrastre = p.Arrastre ? ' + ' + p.Arrastre : '';
    const tipoCls  = p.Tipo_Evento === 'ingreso' ? 'tipo-ingreso' : 'tipo-egreso';
    const tipoLbl  = p.Tipo_Evento === 'ingreso' ? '↑ ING' : '↓ EGR';
    return `<div class="dash-row" onclick="window.location.href='trafico.html'" style="cursor:pointer">
      <div class="dash-row-left">
        <span class="dash-tipo-badge ${tipoCls}">${tipoLbl}</span>
        <div style="min-width:0">
          <div class="dash-main-text">${p.Tractor || '—'}${arrastre}</div>
          <div class="dash-sub-text">${servicio}</div>
        </div>
      </div>
      <div class="dash-row-right">
        <span class="dash-hora">${hora}</span>
        <span class="dash-sub-text">${p.ID_Mov || ''}</span>
      </div>
    </div>`;
  }).join('');
}

function _renderViajes(items) {
  const el = document.getElementById('viajes-body');
  if (!el) return;
  if (!items.length) {
    el.innerHTML = '<div class="dash-empty">No hay viajes en ruta</div>';
    return;
  }
  el.innerHTML = items.map(v => {
    const hora     = _horaCorta(v.FechaHora_Salida);
    const arrastre = v.Arrastre ? ' + ' + v.Arrastre : '';
    const horas    = _fmtHoras(v._horasEnRuta);
    const origen   = v._nombreOrigen  || v.Predio_Origen  || '—';
    const destino  = v._nombreDestino || v.Predio_Destino || '—';
    return `<div class="dash-row">
      <div class="dash-row-left">
        <div style="min-width:0">
          <div class="dash-main-text">${v.Tractor || '—'}${arrastre}</div>
          <div class="dash-sub-text">${origen} → ${destino}</div>
        </div>
      </div>
      <div class="dash-row-right">
        <span class="dash-hora dash-hora--em">${horas}</span>
        <span class="dash-sub-text">Salida ${hora}</span>
      </div>
    </div>`;
  }).join('');
}

function _renderDistHoy(items) {
  const el = document.getElementById('dist-hoy-body');
  if (!el) return;
  if (!items.length) {
    el.innerHTML = '<div class="dash-empty">Sin registros hoy</div>';
    return;
  }
  el.innerHTML = items.map(r => {
    const hora    = _horaCorta(r.FechaHora_Ingreso);
    const abierto = String(r.Estado).toLowerCase() === 'abierto';
    const estadoColor = abierto ? 'var(--ingreso)' : 'var(--text-muted)';
    const estadoTxt   = abierto ? 'Dentro' : 'Salió';
    return `<div class="dash-row">
      <div class="dash-row-left">
        <span class="dash-tipo-badge tipo-ingreso">↑ ING</span>
        <div style="min-width:0">
          <div class="dash-main-text">${r.Dominio || r.ID_Unidad || '—'}</div>
          <div class="dash-sub-text">${r.Chofer || '—'}</div>
        </div>
      </div>
      <div class="dash-row-right">
        <span class="dash-hora">${hora}</span>
        <span class="dash-sub-text" style="color:${estadoColor}">${estadoTxt}</span>
      </div>
    </div>`;
  }).join('');
}

function _renderTrafHoy(items) {
  const el = document.getElementById('traf-hoy-body');
  if (!el) return;
  if (!items.length) {
    el.innerHTML = '<div class="dash-empty">Sin registros hoy</div>';
    return;
  }
  el.innerHTML = items.map(r => {
    const hora     = _horaCorta(r.FechaHora_Ingreso || r.FechaHora_Egreso);
    const arrastre = r.Arrastre ? ' + ' + r.Arrastre : '';
    const servicio = r.Nombre_Servicio || r.ID_Servicio || '—';
    const tipoCls  = r.Tipo_Evento === 'ingreso' ? 'tipo-ingreso' : 'tipo-egreso';
    const tipoLbl  = r.Tipo_Evento === 'ingreso' ? '↑ ING' : '↓ EGR';
    return `<div class="dash-row">
      <div class="dash-row-left">
        <span class="dash-tipo-badge ${tipoCls}">${tipoLbl}</span>
        <div style="min-width:0">
          <div class="dash-main-text">${r.Tractor || '—'}${arrastre}</div>
          <div class="dash-sub-text">${servicio}</div>
        </div>
      </div>
      <div class="dash-row-right">
        <span class="dash-hora">${hora}</span>
      </div>
    </div>`;
  }).join('');
}

function _renderPersHoy(items) {
  const el = document.getElementById('pers-hoy-body');
  if (!el) return;
  if (!items.length) {
    el.innerHTML = '<div class="dash-empty">Sin registros hoy</div>';
    return;
  }
  el.innerHTML = items.map(r => {
    const hora    = _horaCorta(r.FechaHora_Ingreso);
    const abierto = String(r.Estado).toLowerCase() === 'abierto';
    const estadoColor = abierto ? 'var(--ingreso)' : 'var(--text-muted)';
    const estadoTxt   = abierto ? 'Adentro' : 'Salió';
    return `<div class="dash-row">
      <div class="dash-row-left">
        <span class="dash-tipo-badge tipo-ingreso">↑ ING</span>
        <div style="min-width:0">
          <div class="dash-main-text">${r.Nombre_Apellido || '—'}</div>
          <div class="dash-sub-text">${r.Tipo_Registro || '—'}</div>
        </div>
      </div>
      <div class="dash-row-right">
        <span class="dash-hora">${hora}</span>
        <span class="dash-sub-text" style="color:${estadoColor}">${estadoTxt}</span>
      </div>
    </div>`;
  }).join('');
}
