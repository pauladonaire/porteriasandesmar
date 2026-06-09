// auth.js — Autenticación, registro y logout

const Auth = {
  // ── Login ────────────────────────────────────────────────────
  async login(email, clave) {
    const res = await api('login', { email: email.trim().toLowerCase(), clave: clave.trim() });
    if (res.ok) {
      Sesion.guardar(res.usuario);
      aplicarRol(res.usuario.Rol);
    }
    return res;
  },

  // ── Registro de clave (primera vez) ──────────────────────────
  async registrarClave(email, clave) {
    return await api('registrarClave', { email: email.trim().toLowerCase(), clave: clave.trim() });
  },

  // ── Cambio de clave ───────────────────────────────────────────
  async cambiarClave(claveActual, claveNueva) {
    return await api('cambiarClave', { claveActual: claveActual.trim(), claveNueva: claveNueva.trim() });
  },

  // ── Logout ────────────────────────────────────────────────────
  logout() {
    Sesion.cerrar();
    document.body.removeAttribute('data-rol');
  },

  // ── Verificar sesión al cargar la app ─────────────────────────
  verificar() {
    const u = Sesion.obtener();
    if (u) {
      aplicarRol(u.Rol);
      return true;
    }
    return false;
  },
};

function aplicarRol(rol) {
  document.body.setAttribute('data-rol', rol || 'vigilador');
}

// ── Formulario de login ──────────────────────────────────────
function initLoginForms() {
  // Tabs
  document.querySelectorAll('.login-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.login-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    });
  });

  // Form login
  document.getElementById('form-login').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const email = document.getElementById('login-email').value;
    const clave = document.getElementById('login-clave').value;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    const res = await Auth.login(email, clave);
    btn.disabled = false;
    btn.textContent = 'Ingresar';

    if (res.ok) {
      const u = res.usuario;
      document.getElementById('topbar-user').textContent = u.Nombre_Apellido;
      const predio = u.Predio_Asignado === 'TODOS' ? 'Todos los predios' : u.Predio_Asignado;
      document.getElementById('topbar-predio').textContent = predio;
      document.getElementById('bottom-nav').classList.remove('hidden');
      App.mostrar('home');
      Catalogos.cargar().catch(() => App.toast('No se pudieron cargar los catálogos', 'warn'));
    } else {
      App.toast(res.error || 'Error al ingresar', 'err');
    }
  });

  // Form registro de clave
  document.getElementById('form-registro').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const email = document.getElementById('reg-email').value;
    const clave = document.getElementById('reg-clave').value;
    const clave2= document.getElementById('reg-clave2').value;

    if (clave !== clave2) { App.toast('Las claves no coinciden', 'err'); return; }
    if (clave.length < 6) { App.toast('Mínimo 6 caracteres', 'err'); return; }

    btn.disabled = true;
    const res = await Auth.registrarClave(email, clave);
    btn.disabled = false;

    if (res.ok) {
      App.toast(res.msg, 'ok');
      // Ir al tab de login
      document.querySelector('[data-tab="ingresar"]').click();
      document.getElementById('login-email').value = email;
    } else {
      App.toast(res.error, 'err');
    }
  });
}
