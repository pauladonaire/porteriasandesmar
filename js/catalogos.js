// catalogos.js — Carga y caché de catálogos; poblado de selects; alta inline

const Catalogos = {
  predios:   [],
  unidades:  [],
  servicios: [],
  choferes:  [],

  // ── Carga desde la API (una vez por sesión) ──────────────────
  async cargar() {
    const res = await api('getCatalogos');
    if (!res.ok) { App.toast('Error al cargar catálogos: ' + res.error, 'err'); return; }
    this.predios   = res.predios   || [];
    this.unidades  = res.unidades  || [];
    this.servicios = res.servicios || [];
    this.choferes  = res.choferes  || [];
    this.poblarSelects();
  },

  // ── Poblar todos los selects de la app ───────────────────────
  poblarSelects() {
    // Predios
    this.poblarSelect('sel-predio-dist', this.predios, 'ID_Predio', p => p.Nombre + ' (' + p.Provincia + ')');
    this.poblarSelect('sel-predio-traf', this.predios, 'ID_Predio', p => p.Nombre + ' (' + p.Provincia + ')');
    this.poblarSelect('sel-predio-pers', this.predios, 'ID_Predio', p => p.Nombre + ' (' + p.Provincia + ')');
    this.poblarSelect('fil-predio-dist', this.predios, 'ID_Predio', p => p.Nombre, true);
    this.poblarSelect('fil-predio-pers', this.predios, 'ID_Predio', p => p.Nombre, true);
    this.poblarSelect('ind-predio',      this.predios, 'ID_Predio', p => p.Nombre, true);

    // Unidades
    this.poblarSelect('sel-unidad-dist', this.unidades, 'ID_Unidad',
      u => u.Dominio + (u.Interno ? ' [' + u.Interno + ']' : '') + ' — ' + u.Tipo);

    // Servicios (tráfico)
    this.poblarSelect('sel-servicio-traf', this.servicios, 'ID_Servicio',
      s => (s.Codigo ? s.Codigo + ' — ' : '') + s.Descripcion);

    // Choferes
    ['sel-chofer-dist', 'sel-chofer-traf'].forEach(id => {
      this.poblarSelect(id, this.choferes, 'Nombre_Apellido', c => c.Nombre_Apellido);
    });

    // Precarga select de predio en formulario de indicadores
    const u = Sesion.obtener();
    if (u && (u.Rol === 'supervisor' || u.Rol === 'admin')) {
      // ya poblado arriba
    }
  },

  poblarSelect(id, items, valueKey, labelFn, withEmpty = false) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '';
    if (withEmpty) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Todos';
      sel.appendChild(opt);
    } else {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '— Seleccionar —';
      sel.appendChild(opt);
    }
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item[valueKey];
      opt.textContent = labelFn(item);
      sel.appendChild(opt);
    });
  },

  // ── Obtener unidad por ID (desde caché o API) ────────────────
  async getUnidadPorId(id) {
    const local = this.unidades.find(u => u.ID_Unidad === id);
    if (local) return { ok: true, unidad: local };
    return await api('getUnidadPorId', { id });
  },

  // ── Alta inline de unidad ────────────────────────────────────
  async altaUnidad(tipo, dominio, interno, flota, transportista, base) {
    const res = await api('altaUnidad', { tipo, dominio, interno, flota, transportista, baseHabitual: base });
    if (res.ok) {
      await this.cargar(); // refrescar catálogos
      App.toast('Unidad dada de alta: ' + dominio, 'ok');
    }
    return res;
  },

  // ── Alta inline de chofer ─────────────────────────────────────
  async altaChofer(nombre, dni, transportista) {
    const res = await api('altaChofer', { nombre, dni, transportista });
    if (res.ok) {
      await this.cargar();
      App.toast('Chofer dado de alta: ' + nombre, 'ok');
    }
    return res;
  },

  nombrePredio(id) {
    const p = this.predios.find(x => x.ID_Predio === id);
    return p ? p.Nombre : id;
  },
  nombreServicio(id) {
    const s = this.servicios.find(x => x.ID_Servicio === id);
    return s ? (s.Codigo ? s.Codigo + ' — ' : '') + s.Descripcion : id;
  },
};

// ── Modal de alta de unidad ──────────────────────────────────
function initAltaUnidad() {
  const modal = document.getElementById('modal-alta-unidad');
  document.getElementById('btn-nueva-unidad').addEventListener('click', () => {
    modal.style.display = 'flex';
  });
  document.getElementById('btn-cancelar-unidad').addEventListener('click', () => {
    modal.style.display = 'none';
  });
  document.getElementById('form-alta-unidad').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true;
    const res = await Catalogos.altaUnidad(
      document.getElementById('nu-tipo').value,
      document.getElementById('nu-dominio').value,
      document.getElementById('nu-interno').value,
      document.getElementById('nu-flota').value,
      document.getElementById('nu-transportista').value,
      document.getElementById('nu-base').value,
    );
    btn.disabled = false;
    if (res.ok) {
      modal.style.display = 'none';
      e.target.reset();
    } else {
      App.toast(res.error, 'err');
    }
  });
}

// ── Modal de alta de chofer ──────────────────────────────────
function initAltaChofer() {
  const modal = document.getElementById('modal-alta-chofer');
  document.querySelectorAll('.btn-nuevo-chofer').forEach(btn => {
    btn.addEventListener('click', () => { modal.style.display = 'flex'; });
  });
  document.getElementById('btn-cancelar-chofer').addEventListener('click', () => {
    modal.style.display = 'none';
  });
  document.getElementById('form-alta-chofer').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true;
    const res = await Catalogos.altaChofer(
      document.getElementById('nc-nombre').value,
      document.getElementById('nc-dni').value,
      document.getElementById('nc-transportista').value,
    );
    btn.disabled = false;
    if (res.ok) {
      modal.style.display = 'none';
      e.target.reset();
    } else {
      App.toast(res.error, 'err');
    }
  });
}
