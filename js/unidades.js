// unidades.js — Vista admin: catálogo de unidades de Distribución + exportación de QR

const Unidades = {
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
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    grid.innerHTML = activas.map(u => `
      <div class="qr-card">
        <img src="${u.QR_URL}" alt="QR ${u.Dominio}" loading="lazy">
        <div class="qr-dominio">${u.Dominio || '—'}</div>
        <div class="qr-interno">${u.Interno || ''}</div>
        <div class="qr-flota">${u.Flota || ''}${u.Transportista ? ' · ' + u.Transportista : ''}</div>
      </div>
    `).join('');
  },
};

function initUnidades() {
  const buscar = document.getElementById('qr-buscar');
  if (buscar) buscar.addEventListener('input', () => Unidades.render(buscar.value));

  const btnImprimir = document.getElementById('btn-imprimir-qr');
  if (btnImprimir) btnImprimir.addEventListener('click', () => window.print());
}
