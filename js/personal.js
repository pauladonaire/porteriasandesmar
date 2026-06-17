// personal.js — Formularios y lista de personal (visitas/clientes/proveedores)

const Personal = {
  // ── Registrar ingreso ─────────────────────────────────────────
  async registrarIngreso(form) {
    const idPredio     = form.querySelector('#sel-predio-pers').value;
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
      App.mostrar('dentro-pers');
    } else {
      App.toast(res.error, 'err');
    }
  },

  // ── Registrar egreso ──────────────────────────────────────────
  async registrarEgreso(idMov, observaciones) {
    const res = await api('personalEgreso', { idMov, observaciones });
    if (res.ok) {
      App.toast('Egreso registrado — ' + res.horasDentro + 'h dentro', 'ok');
      this.cargarLista();
    } else {
      App.toast(res.error, 'err');
    }
    return res;
  },

  // ── Cargar lista de abiertos ───────────────────────────────────
  async cargarLista() {
    const res = await api('personalAbiertos');
    if (!res.ok) { App.toast('Error al cargar lista de personal', 'err'); return; }
    this.renderizarLista(res.movimientos || []);
    const badge = document.getElementById('badge-pers');
    if (badge) badge.textContent = (res.movimientos || []).length + ' adentro';
  },

  renderizarLista(movs) {
    const container = document.getElementById('lista-pers');
    if (!container) return;

    if (!movs.length) {
      container.innerHTML = '<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><p>Sin personas adentro</p></div>';
      return;
    }

    container.innerHTML = movs.map(m => {
      const horas  = typeof m._horasDentroActual === 'number' ? m._horasDentroActual.toFixed(1) + 'h' : '—';
      const predio = Catalogos.nombrePredio(m.ID_Predio);
      const mat    = m.Matricula === 'a pie' ? '🚶 a pie' : '🚗 ' + m.Matricula;
      const tipoBadge = { visita: '👤 Visita', cliente: '🛒 Cliente', proveedor: '🔧 Proveedor' };
      return `
        <div class="mov-card pers-border">
          <div class="mov-card-header">
            <span class="mov-card-id">${m.Nombre_Apellido}</span>
            <span class="tag tag-abierto">↑ ${horas}</span>
          </div>
          <div class="mov-card-detail">
            <strong>${tipoBadge[m.Tipo_Registro] || m.Tipo_Registro}</strong> &nbsp;
            DNI: <strong>${m.DNI || '—'}</strong> &nbsp; ${mat}
          </div>
          <div class="mov-card-detail"><strong>Predio:</strong> ${predio} &nbsp; ${m.FechaHora_Ingreso}</div>
          <div class="btn-row" style="margin-top:8px">
            <button class="btn btn-egreso btn-sm" onclick="abrirEgresioPersModal('${m.ID_Mov}','${m.Nombre_Apellido.replace(/'/g,"\'")}')">
              ↓ Registrar Egreso
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
}
