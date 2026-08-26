// unidades.js — Vista admin: catálogo de unidades de Distribución + exportación de QR

const Unidades = {
  seleccionadas: new Set(), // dominios elegidos para exportar/imprimir

  render(filtro = '') {
    const grid  = document.getElementById('qr-grid');
    const empty = document.getElementById('qr-empty');
    if (!grid) return;

    const q = filtro.trim().toLowerCase();
    const activas = (Catalogos.unidades || []).filter(u => {
      const activo = String(u.Activo == null ? '' : u.Activo).trim().toUpperCase() !== 'FALSE';
      if (!activo) return false;
      if (!q) return true;
      return [u.Dominio, u.Interno, u.Flota, u.Transportista, u.Tipo]
        .some(v => String(v || '').toLowerCase().includes(q));
    }).sort((a, b) => String(a.Dominio || '').localeCompare(String(b.Dominio || '')));

    if (!activas.length) {
      grid.innerHTML = '';
      grid.classList.remove('has-selection');
      empty.style.display = 'block';
      this.actualizarContador();
      return;
    }
    empty.style.display = 'none';

    grid.innerHTML = activas.map(u => {
      const dom = String(u.Dominio || '');
      const domEsc = dom.replace(/"/g, '&quot;');
      const marcada = this.seleccionadas.has(dom);
      return `
      <div class="qr-card${marcada ? ' selected' : ''}" data-dominio="${domEsc}">
        <label class="qr-select"><input type="checkbox" class="qr-check" ${marcada ? 'checked' : ''}></label>
        <img class="qr-img" src="${u.QR_URL}" alt="QR ${domEsc}" loading="lazy">
        <div class="qr-dominio">${dom || '—'}</div>
        <div class="qr-interno">${u.Interno || ''}</div>
        <div class="qr-flota">${u.Flota || ''}${u.Transportista ? ' · ' + u.Transportista : ''}</div>
      </div>`;
    }).join('');

    grid.classList.toggle('has-selection', this.seleccionadas.size > 0);

    grid.querySelectorAll('.qr-card').forEach(card => {
      const dom = card.dataset.dominio;
      card.querySelector('.qr-check').addEventListener('change', e => {
        if (e.target.checked) this.seleccionadas.add(dom);
        else this.seleccionadas.delete(dom);
        card.classList.toggle('selected', e.target.checked);
        grid.classList.toggle('has-selection', this.seleccionadas.size > 0);
        this.actualizarContador();
      });
      card.querySelector('.qr-img').addEventListener('click', () => {
        this.abrirModal(dom, card.querySelector('.qr-img').src);
      });
    });

    this.actualizarContador();
  },

  actualizarContador() {
    const el = document.getElementById('qr-contador');
    if (el) el.textContent = this.seleccionadas.size ? this.seleccionadas.size + ' seleccionada(s)' : '';
  },

  seleccionarTodo(valor) {
    document.querySelectorAll('#qr-grid .qr-card').forEach(card => {
      const dom = card.dataset.dominio;
      const chk = card.querySelector('.qr-check');
      if (valor) this.seleccionadas.add(dom); else this.seleccionadas.delete(dom);
      chk.checked = valor;
      card.classList.toggle('selected', valor);
    });
    document.getElementById('qr-grid').classList.toggle('has-selection', this.seleccionadas.size > 0);
    this.actualizarContador();
  },

  abrirModal(dominio, src) {
    document.getElementById('qr-modal-img').src = src;
    document.getElementById('qr-modal-dominio').textContent = dominio;
    document.getElementById('modal-qr-individual').style.display = 'flex';
  },

  cerrarModal() {
    document.getElementById('modal-qr-individual').style.display = 'none';
  },

  imprimirModal() {
    document.body.classList.add('qr-print-single');
    window.print();
  },
};

function initUnidades() {
  const buscar = document.getElementById('qr-buscar');
  if (buscar) buscar.addEventListener('input', () => Unidades.render(buscar.value));

  document.getElementById('btn-imprimir-qr')?.addEventListener('click', () => window.print());
  document.getElementById('btn-sel-todo')?.addEventListener('click', () => Unidades.seleccionarTodo(true));
  document.getElementById('btn-sel-ninguno')?.addEventListener('click', () => Unidades.seleccionarTodo(false));

  document.getElementById('btn-cerrar-qr-modal')?.addEventListener('click', () => Unidades.cerrarModal());
  document.getElementById('btn-imprimir-qr-modal')?.addEventListener('click', () => Unidades.imprimirModal());

  window.addEventListener('afterprint', () => {
    document.body.classList.remove('qr-print-single');
  });
}
