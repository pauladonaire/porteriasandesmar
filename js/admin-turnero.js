// admin-turnero.js — Administración de Boxes / Horarios / Fleteros
// Acceso: solo Rol 'admin' (cualquier depósito) o 'admin_deposito' (solo el suyo,
// leído de la columna Deposito_Turnero del usuario en USUARIOS de portería).
// El backend GAS vuelve a validar esto en cada acción — esto acá es solo UI.

async function verificarAcceso() {
  const u = Sesion.obtener();
  const rol = rolEfectivo();
  const simulando = u && rol !== u.Rol; // admin "viendo como" otro rol
  const contenido = document.getElementById('t-admin-contenido');
  const denegado  = document.getElementById('t-acceso-denegado');

  if (rol !== 'admin' && rol !== 'admin_deposito') {
    contenido.style.display = 'none';
    denegado.textContent = 'No tenés permiso para entrar a esta sección.';
    denegado.classList.remove('t-hidden');
    return false;
  }

  if (rol === 'admin_deposito') {
    await pintarBotonesDeposito_();
    // Al simular, el admin real no tiene por qué tener Deposito_Turnero cargado
    // — se usa el depósito ya elegido en el selector en vez de exigirle ese campo.
    // Deposito_Turnero puede tener uno o varios depósitos separados por coma.
    const permitidos = simulando ? [TurneroDeposito.obtener()] : depositosDeUsuario(u && u.Deposito_Turnero);
    if (!permitidos.length) {
      contenido.style.display = 'none';
      denegado.textContent = 'Tu usuario no tiene un depósito asignado (columna Deposito_Turnero en USUARIOS). Pedile al administrador que lo complete.';
      denegado.classList.remove('t-hidden');
      return false;
    }
    let dep = TurneroDeposito.obtener();
    if (!permitidos.includes(dep)) { dep = permitidos[0]; TurneroDeposito.fijar(dep); }
    const cont = document.getElementById('t-deposito-selector');
    cont.querySelectorAll('.t-dep-btn').forEach(btn => {
      if (!permitidos.includes(btn.dataset.dep)) { btn.style.display = 'none'; return; }
      btn.classList.toggle('activo', btn.dataset.dep === dep);
      if (permitidos.length > 1) {
        btn.addEventListener('click', () => {
          if (btn.dataset.dep === TurneroDeposito.obtener()) return;
          TurneroDeposito.fijar(btn.dataset.dep);
          cont.querySelectorAll('.t-dep-btn').forEach(b => b.classList.toggle('activo', b === btn));
          cargarTodo();
        });
      } else {
        btn.disabled = true; btn.style.cursor = 'default'; btn.style.opacity = '1';
      }
    });
  } else {
    await initSelectorDeposito(() => cargarTodo());
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
  cargarOperarios();
}

document.addEventListener('DOMContentLoaded', async () => {
  initTemaToggle(); // primero: el modo oscuro no depende de tener sesión activa
  if (!guardSesionTurnero()) return;
  initNavTurnero('admin-turnero');
  if (!(await verificarAcceso())) return;

  document.getElementById('form-agregar-box').addEventListener('submit', onAgregarBox);
  document.getElementById('form-agregar-horario').addEventListener('submit', onAgregarHorario);
  document.getElementById('form-agregar-operario').addEventListener('submit', onAgregarOperario);

  cargarTodo();
});
