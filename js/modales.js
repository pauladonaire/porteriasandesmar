// modales.js — Alta de unidades y choferes (compartido entre distribucion y trafico)

function initAltaUnidad() {
  const modal       = document.getElementById('modal-alta-unidad');
  const form        = document.getElementById('form-alta-unidad');
  const btnAbrir    = document.getElementById('btn-nueva-unidad');
  const btnCancelar = document.getElementById('btn-cancelar-unidad');

  if (!modal || !form) return;

  function abrir() { modal.style.display = 'flex'; form.reset(); }
  function cerrar() { modal.style.display = 'none'; }

  if (btnAbrir)    btnAbrir.addEventListener('click', abrir);
  if (btnCancelar) btnCancelar.addEventListener('click', cerrar);
  modal.addEventListener('click', e => { if (e.target === modal) cerrar(); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    const res = await api('altaUnidad', {
      tipo:          document.getElementById('nu-tipo').value,
      dominio:       document.getElementById('nu-dominio').value.trim().toUpperCase(),
      interno:       document.getElementById('nu-interno').value.trim(),
      flota:         document.getElementById('nu-flota').value,
      transportista: document.getElementById('nu-transportista').value.trim(),
      base:          document.getElementById('nu-base').value.trim(),
    });

    btn.disabled = false;
    btn.textContent = 'Dar de Alta';

    if (res.ok) {
      App.toast('Unidad ' + (res.dominio || '') + ' dada de alta', 'ok');
      await Catalogos.cargar();
      cerrar();
    } else {
      App.toast(res.error || 'Error al dar de alta', 'err');
    }
  });
}

function initAltaChofer() {
  const modal       = document.getElementById('modal-alta-chofer');
  const form        = document.getElementById('form-alta-chofer');
  const btnCancelar = document.getElementById('btn-cancelar-chofer');
  const botonesAbrir = document.querySelectorAll('.btn-nuevo-chofer');

  if (!modal || !form) return;

  function abrir() { modal.style.display = 'flex'; form.reset(); }
  function cerrar() { modal.style.display = 'none'; }

  botonesAbrir.forEach(b => b.addEventListener('click', abrir));
  if (btnCancelar) btnCancelar.addEventListener('click', cerrar);
  modal.addEventListener('click', e => { if (e.target === modal) cerrar(); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    const res = await api('altaChofer', {
      nombre:        document.getElementById('nc-nombre').value.trim(),
      dni:           document.getElementById('nc-dni').value.trim(),
      transportista: document.getElementById('nc-transportista').value.trim(),
    });

    btn.disabled = false;
    btn.textContent = 'Dar de Alta';

    if (res.ok) {
      App.toast((res.nombre || 'Chofer') + ' dado de alta', 'ok');
      await Catalogos.cargar();
      cerrar();
    } else {
      App.toast(res.error || 'Error al dar de alta', 'err');
    }
  });
}
