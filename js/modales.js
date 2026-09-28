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
      await Catalogos.cargar(true); // forzado: que el alta recién hecha se vea ya, no en 60s
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
      await Catalogos.cargar(true); // forzado: que el alta recién hecha se vea ya, no en 60s
      cerrar();
    } else {
      App.toast(res.error || 'Error al dar de alta', 'err');
    }
  });
}

// Alta de servicio nuevo desde Tráfico (vigilador/supervisor/admin — cualquiera que opere
// Tráfico). A diferencia de unidad/chofer, un servicio nuevo queda visible para TODOS los
// próximos ingresos/egresos de cualquier predio — por eso el aviso dentro del modal y la
// confirmación explícita antes de enviar, para que no se cargue "sin querer".
function initAltaServicio() {
  const modal       = document.getElementById('modal-alta-servicio');
  const form        = document.getElementById('form-alta-servicio');
  const btnAbrir    = document.getElementById('btn-nuevo-servicio');
  const btnCancelar = document.getElementById('btn-cancelar-servicio');

  if (!modal || !form) return;

  function abrir() { modal.style.display = 'flex'; form.reset(); }
  function cerrar() { modal.style.display = 'none'; }

  if (btnAbrir)    btnAbrir.addEventListener('click', abrir);
  if (btnCancelar) btnCancelar.addEventListener('click', cerrar);
  modal.addEventListener('click', e => { if (e.target === modal) cerrar(); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const descripcion = document.getElementById('ns-descripcion').value.trim();
    const codigo       = document.getElementById('ns-codigo').value.trim();
    if (!descripcion) { App.toast('El nombre del servicio es obligatorio', 'err'); return; }

    const confirmado = confirm(
      '¿Estás seguro? "' + descripcion + '" va a quedar habilitado para todos los próximos ingresos, en cualquier predio.'
    );
    if (!confirmado) return;

    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    const res = await api('altaServicio', { descripcion, codigo });

    btn.disabled = false;
    btn.textContent = 'Dar de Alta';

    if (res.ok) {
      App.toast('Servicio "' + (res.descripcion || descripcion) + '" dado de alta', 'ok');
      await Catalogos.cargar(true); // forzado: que el alta recién hecha se vea ya, no en 60s
      cerrar();
    } else {
      App.toast(res.error || 'Error al dar de alta', 'err');
    }
  });
}
