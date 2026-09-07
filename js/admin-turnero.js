// admin-turnero.js — Administración de Boxes / Horarios / Fleteros
// Acceso: solo Rol 'admin' (cualquier depósito) o 'admin_deposito' (solo el suyo,
// leído de la columna Deposito_Turnero del usuario en USUARIOS de portería).
// El backend GAS vuelve a validar esto en cada acción — esto acá es solo UI.

function verificarAcceso() {
  const u = Sesion.obtener();
  const rol = u && u.Rol;
  const contenido = document.getElementById('t-admin-contenido');
  const denegado  = document.getElementById('t-acceso-denegado');

  if (rol !== 'admin' && rol !== 'admin_deposito') {
    contenido.style.display = 'none';
    denegado.textContent = 'No tenés permiso para entrar a esta sección.';
    denegado.classList.remove('t-hidden');
    return false;
  }

  if (rol === 'admin_deposito') {
    const dep = String(u.Deposito_Turnero || '').trim().toUpperCase();
    if (dep !== 'MZA' && dep !== 'BUE') {
      contenido.style.display = 'none';
      denegado.textContent = 'Tu usuario no tiene un depósito asignado (columna Deposito_Turnero en USUARIOS). Pedile al administrador que lo complete.';
      denegado.classList.remove('t-hidden');
      return false;
    }
    TurneroDeposito.fijar(dep);
    const cont = document.getElementById('t-deposito-selector');
    cont.querySelectorAll('.t-dep-btn').forEach(btn => {
      if (btn.dataset.dep !== dep) { btn.style.display = 'none'; }
      else { btn.classList.add('activo'); btn.disabled = true; btn.style.cursor = 'default'; btn.style.opacity = '1'; }
    });
  } else {
    initSelectorDeposito(() => cargarTodo());
  }
  return true;
}

// ── Boxes ──

async function cargarBoxes() {
  const res = await apiTurnero('getEstadoBoxes');
  const boxes = (res && res.ok) ? res.data.boxes : [];
  const cont = document.getElementById('lista-boxes');
  const empty = document.getElementById('empty-boxes');
  cont.innerHTML = '';
  empty.classList.toggle('t-hidden', boxes.length > 0);
  boxes.forEach(b => cont.appendChild(crearFilaBox(b)));
}

function crearFilaBox(b) {
  const div = document.createElement('div');
  div.className = 't-turno-row';
  div.style.justifyContent = 'space-between';
  div.innerHTML = `<span class="t-turno-name">${escapeHtml(b.box)}</span>` +
    `<span class="t-badge-estado ${b.habilitado ? 'badge-a-tiempo' : 'badge-no-a-cargar'}">${b.habilitado ? 'Habilitado' : 'Inhabilitado'}</span>`;

  const acciones = document.createElement('span');
  acciones.style.cssText = 'display:flex;gap:6px';

  const btnToggle = document.createElement('button');
  btnToggle.type = 'button';
  btnToggle.className = 't-btn ghost';
  btnToggle.textContent = b.habilitado ? 'Inhabilitar' : 'Habilitar';
  btnToggle.addEventListener('click', async () => {
    const res = await apiTurnero('setEstadoBox', { box: b.box, estado: b.habilitado ? 'inhabilitado' : 'habilitado' });
    if (res && res.ok) { toast('Box actualizado', 'ok'); cargarBoxes(); }
    else toast((res && res.error) || 'No se pudo actualizar', 'err');
  });

  const btnQuitar = document.createElement('button');
  btnQuitar.type = 'button';
  btnQuitar.className = 't-btn danger';
  btnQuitar.textContent = 'Quitar';
  btnQuitar.addEventListener('click', async () => {
    if (!confirm(`¿Quitar el box "${b.box}"?`)) return;
    const res = await apiTurnero('quitarBox', { box: b.box });
    if (res && res.ok) { toast('Box quitado', 'ok'); cargarBoxes(); }
    else toast((res && res.error) || 'No se pudo quitar', 'err');
  });

  acciones.appendChild(btnToggle);
  acciones.appendChild(btnQuitar);
  div.appendChild(acciones);
  return div;
}

async function onAgregarBox(e) {
  e.preventDefault();
  const input = document.getElementById('in-nuevo-box');
  const box = input.value.trim();
  if (!box) return;
  const res = await apiTurnero('agregarBox', { box });
  if (res && res.ok) { toast('Box agregado', 'ok'); input.value = ''; cargarBoxes(); }
  else toast((res && res.error) || 'No se pudo agregar', 'err');
}

// ── Horarios ──

async function cargarHorarios() {
  const res = await apiTurnero('getHorariosTurno');
  const horarios = (res && res.ok) ? res.data.horarios : [];
  const cont = document.getElementById('lista-horarios');
  const empty = document.getElementById('empty-horarios');
  cont.innerHTML = '';
  empty.classList.toggle('t-hidden', horarios.length > 0);
  horarios.forEach(h => cont.appendChild(crearFilaHorario(h)));
}

function crearFilaHorario(h) {
  const div = document.createElement('div');
  div.className = 't-turno-row';
  div.style.justifyContent = 'space-between';
  div.innerHTML = `<span class="t-turno-name">${escapeHtml(h.texto)}</span>`;

  const btnQuitar = document.createElement('button');
  btnQuitar.type = 'button';
  btnQuitar.className = 't-btn danger';
  btnQuitar.textContent = 'Quitar';
  btnQuitar.addEventListener('click', async () => {
    if (!confirm(`¿Quitar el horario ${h.texto}?`)) return;
    const res = await apiTurnero('setHorario', { horario: h.texto, operacion: 'quitar' });
    if (res && res.ok) { toast('Horario quitado', 'ok'); cargarHorarios(); }
    else toast((res && res.error) || 'No se pudo quitar', 'err');
  });
  div.appendChild(btnQuitar);
  return div;
}

async function onAgregarHorario(e) {
  e.preventDefault();
  const input = document.getElementById('in-nuevo-horario');
  const horario = input.value; // "HH:mm" nativo del <input type=time>
  if (!horario) return;
  const res = await apiTurnero('setHorario', { horario, operacion: 'agregar' });
  if (res && res.ok) { toast('Horario agregado', 'ok'); input.value = ''; cargarHorarios(); }
  else toast((res && res.error) || 'No se pudo agregar', 'err');
}

// ── Fleteros ──

async function cargarFleteros() {
  const res = await apiTurnero('getMaestroFleteros');
  const fleteros = (res && res.ok) ? res.data.fleteros : [];
  const cont = document.getElementById('lista-fleteros');
  const empty = document.getElementById('empty-fleteros');
  cont.innerHTML = '';
  empty.classList.toggle('t-hidden', fleteros.length > 0);
  fleteros.forEach(f => cont.appendChild(crearFilaFletero(f)));
  if (!res || !res.ok) toast((res && res.error) || 'No se pudo cargar el maestro de fleteros', 'err');
}

function crearFilaFletero(f) {
  const activo = String(f.estado).toLowerCase() === 'activo';
  const div = document.createElement('div');
  div.className = 't-turno-row';
  div.style.justifyContent = 'space-between';
  div.innerHTML = `<span class="t-turno-name">${escapeHtml(f.nombre)}</span>` +
    `<span class="t-turno-pat">${escapeHtml(f.patente || '')}</span>` +
    `<span class="t-badge-estado ${activo ? 'badge-a-tiempo' : 'badge-no-a-cargar'}">${activo ? 'Activo' : 'Inactivo'}</span>`;

  const acciones = document.createElement('span');
  acciones.style.cssText = 'display:flex;gap:6px';

  const btnEditar = document.createElement('button');
  btnEditar.type = 'button';
  btnEditar.className = 't-btn ghost';
  btnEditar.textContent = 'Editar';
  btnEditar.addEventListener('click', async () => {
    const nuevoNombre = prompt('Nombre del fletero:', f.nombre);
    if (nuevoNombre === null) return;
    const nuevaPatente = prompt('Patente (opcional):', f.patente || '');
    if (nuevaPatente === null) return;
    if (!nuevoNombre.trim()) { toast('El nombre no puede quedar vacío', 'err'); return; }
    const res = await apiTurnero('editarFletero', { fila: f.fila, nombre: nuevoNombre.trim(), patente: nuevaPatente.trim() });
    if (res && res.ok) { toast('Fletero actualizado', 'ok'); cargarFleteros(); }
    else toast((res && res.error) || 'No se pudo actualizar', 'err');
  });

  const btnToggle = document.createElement('button');
  btnToggle.type = 'button';
  btnToggle.className = 't-btn ghost';
  btnToggle.textContent = activo ? 'Desactivar' : 'Activar';
  btnToggle.addEventListener('click', async () => {
    const res = await apiTurnero('setEstadoFletero', { fila: f.fila, estado: activo ? 'Inactivo' : 'Activo' });
    if (res && res.ok) { toast('Fletero actualizado', 'ok'); cargarFleteros(); }
    else toast((res && res.error) || 'No se pudo actualizar', 'err');
  });

  acciones.appendChild(btnEditar);
  acciones.appendChild(btnToggle);
  div.appendChild(acciones);
  return div;
}

async function onAgregarFletero(e) {
  e.preventDefault();
  const inNombre  = document.getElementById('in-nuevo-fletero-nombre');
  const inPatente = document.getElementById('in-nuevo-fletero-patente');
  const nombre  = inNombre.value.trim();
  const patente = inPatente.value.trim();
  if (!nombre) return;
  const res = await apiTurnero('agregarFletero', { nombre, patente });
  if (res && res.ok) { toast('Fletero agregado', 'ok'); inNombre.value = ''; inPatente.value = ''; cargarFleteros(); }
  else toast((res && res.error) || 'No se pudo agregar', 'err');
}

// ── Operarios (fin de carga) ──

async function cargarOperarios() {
  const res = await apiTurnero('getMaestroOperarios');
  const operarios = (res && res.ok) ? res.data.operarios : [];
  const cont = document.getElementById('lista-operarios');
  const empty = document.getElementById('empty-operarios');
  cont.innerHTML = '';
  empty.classList.toggle('t-hidden', operarios.length > 0);
  operarios.forEach(o => cont.appendChild(crearFilaOperario(o)));
  if (!res || !res.ok) toast((res && res.error) || 'No se pudo cargar la lista de operarios', 'err');
}

function crearFilaOperario(o) {
  const activo = String(o.estado).toLowerCase() === 'activo';
  const div = document.createElement('div');
  div.className = 't-turno-row';
  div.style.justifyContent = 'space-between';
  div.innerHTML = `<span class="t-turno-name">${escapeHtml(o.nombre)}</span>` +
    `<span class="t-badge-estado ${activo ? 'badge-a-tiempo' : 'badge-no-a-cargar'}">${activo ? 'Activo' : 'Inactivo'}</span>`;

  const acciones = document.createElement('span');
  acciones.style.cssText = 'display:flex;gap:6px';

  const btnEditar = document.createElement('button');
  btnEditar.type = 'button';
  btnEditar.className = 't-btn ghost';
  btnEditar.textContent = 'Editar';
  btnEditar.addEventListener('click', async () => {
    const nuevoNombre = prompt('Nombre del operario:', o.nombre);
    if (nuevoNombre === null || !nuevoNombre.trim()) return;
    const res = await apiTurnero('editarOperario', { fila: o.fila, nombre: nuevoNombre.trim() });
    if (res && res.ok) { toast('Operario actualizado', 'ok'); cargarOperarios(); }
    else toast((res && res.error) || 'No se pudo actualizar', 'err');
  });

  const btnToggle = document.createElement('button');
  btnToggle.type = 'button';
  btnToggle.className = 't-btn ghost';
  btnToggle.textContent = activo ? 'Desactivar' : 'Activar';
  btnToggle.addEventListener('click', async () => {
    const res = await apiTurnero('setEstadoOperario', { fila: o.fila, estado: activo ? 'Inactivo' : 'Activo' });
    if (res && res.ok) { toast('Operario actualizado', 'ok'); cargarOperarios(); }
    else toast((res && res.error) || 'No se pudo actualizar', 'err');
  });

  acciones.appendChild(btnEditar);
  acciones.appendChild(btnToggle);
  div.appendChild(acciones);
  return div;
}

async function onAgregarOperario(e) {
  e.preventDefault();
  const input = document.getElementById('in-nuevo-operario-nombre');
  const nombre = input.value.trim();
  if (!nombre) return;
  const res = await apiTurnero('agregarOperario', { nombre });
  if (res && res.ok) { toast('Operario agregado', 'ok'); input.value = ''; cargarOperarios(); }
  else toast((res && res.error) || 'No se pudo agregar', 'err');
}

// ── Init ──

function cargarTodo() {
  cargarBoxes();
  cargarHorarios();
  cargarFleteros();
  cargarOperarios();
}

document.addEventListener('DOMContentLoaded', () => {
  initTemaToggle(); // primero: el modo oscuro no depende de tener sesión activa
  if (!guardSesionTurnero()) return;
  initNavTurnero('admin-turnero');
  if (!verificarAcceso()) return;

  document.getElementById('form-agregar-box').addEventListener('submit', onAgregarBox);
  document.getElementById('form-agregar-horario').addEventListener('submit', onAgregarHorario);
  document.getElementById('form-agregar-fletero').addEventListener('submit', onAgregarFletero);
  document.getElementById('form-agregar-operario').addEventListener('submit', onAgregarOperario);

  cargarTodo();
});
