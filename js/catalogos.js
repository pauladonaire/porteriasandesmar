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
    // Si hay combobox asociado, limpiar el texto del input
    if (sel._comboInput) sel._comboInput.value = '';
  },

  // ── Combobox con búsqueda predictiva ──────────────────────────
  // Transforma un <select> en un input con filtro en tiempo real.
  // El <select> queda oculto pero sigue siendo la fuente de verdad.
  initCombobox(selectId, placeholder) {
    const sel = document.getElementById(selectId);
    if (!sel || sel._comboboxInited) return;
    sel._comboboxInited = true;

    // Envolver el select
    const wrap = document.createElement('div');
    wrap.className = 'combobox-wrap';
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    // Transferir flex inline si lo tenía (ej: sel-chofer-traf tiene flex:1)
    if (sel.style.flex) { wrap.style.flex = sel.style.flex; sel.style.removeProperty('flex'); }
    sel.style.display = 'none';

    // Input visible
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'combobox-input';
    input.placeholder = placeholder || '— Seleccionar —';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('spellcheck', 'false');
    wrap.insertBefore(input, sel);
    sel._comboInput = input;

    // Flecha indicadora
    const arrow = document.createElement('span');
    arrow.className = 'combobox-arrow';
    arrow.innerHTML = '&#9660;';
    wrap.appendChild(arrow);

    // Dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'combobox-dropdown';
    wrap.appendChild(dropdown);

    const getOptions = () => Array.from(sel.options).filter(o => o.value !== '');

    const highlight = (text, q) => {
      if (!q) return text;
      const idx = text.toLowerCase().indexOf(q.toLowerCase());
      if (idx === -1) return text;
      return text.substring(0, idx)
        + '<mark>' + text.substring(idx, idx + q.length) + '</mark>'
        + text.substring(idx + q.length);
    };

    const renderDropdown = (q) => {
      const lower = (q || '').trim().toLowerCase();
      const all   = getOptions();
      const opts  = lower ? all.filter(o => o.textContent.toLowerCase().includes(lower)) : all;
      const show  = opts.slice(0, 60);
      if (!show.length) {
        dropdown.innerHTML = '<div class="combobox-empty">Sin resultados</div>';
      } else {
        dropdown.innerHTML = show.map(o => {
          const lbl = o.textContent;
          const val = o.value.replace(/"/g, '&quot;');
          const lblEsc = lbl.replace(/"/g, '&quot;');
          return `<div class="combobox-option" data-value="${val}" data-label="${lblEsc}">${highlight(lbl, lower)}</div>`;
        }).join('');
        dropdown.querySelectorAll('.combobox-option').forEach(opt => {
          const choose = (e) => {
            e.preventDefault();
            sel.value    = opt.dataset.value;
            input.value  = opt.dataset.label;
            dropdown.style.display = 'none';
            sel.dispatchEvent(new Event('change', { bubbles: true }));
          };
          opt.addEventListener('mousedown', choose);
          opt.addEventListener('touchstart', choose, { passive: false });
        });
      }
      dropdown.style.display = '';
    };

    const closeDropdown = () => {
      dropdown.style.display = 'none';
      // Si el input no coincide con ninguna opción y no hay valor seleccionado, limpiar
      if (!sel.value) { input.value = ''; return; }
      // Restaurar texto si el usuario escribió algo que no terminó en selección
      const selOpt = Array.from(sel.options).find(o => o.value === sel.value);
      if (selOpt) input.value = selOpt.textContent;
    };

    input.addEventListener('focus', () => renderDropdown(input.value));
    input.addEventListener('input', () => renderDropdown(input.value));
    input.addEventListener('blur',  () => setTimeout(closeDropdown, 200));

    arrow.addEventListener('mousedown', e => {
      e.preventDefault();
      if (!dropdown.style.display || dropdown.style.display === 'none') {
        renderDropdown('');
        input.focus();
      } else {
        dropdown.style.display = 'none';
      }
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
