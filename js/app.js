// app.js — Login + Home (exclusivo de index.html)

const App = {
  mostrar(id) {
    document.querySelectorAll('.view').forEach(v => {
      v.classList.remove('active');
      v.style.display = 'none';
    });
    const vista = document.getElementById('view-' + id);
    if (!vista) return;
    vista.classList.add('active');
    vista.style.display = vista.dataset.display || 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  toast(msg, tipo = 'info', duracion = 3000) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = 'toast ' + tipo;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), duracion);
  },

  async init() {
    initLoginForms();

    // Bottom-nav: home queda en esta página, el resto navega a su .html
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (!Sesion.activo()) return;
        const destino = item.dataset.pagina;
        if (destino === 'home') { this.mostrar('home'); return; }
        window.location.href = destino + '.html';
      });
    });

    // Logout
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      Auth.logout();
      document.getElementById('bottom-nav').classList.add('hidden');
      this.mostrar('login');
    });

    // Verificar sesión existente al cargar
    if (Auth.verificar()) {
      const u = Sesion.obtener();
      document.getElementById('topbar-user').textContent = u.Nombre_Apellido;
      const predio = u.Predio_Asignado === 'TODOS' ? 'Todos los predios' : u.Predio_Asignado;
      document.getElementById('topbar-predio').textContent = predio;
      document.getElementById('bottom-nav').classList.remove('hidden');
      this.mostrar('home');
      Catalogos.cargar().catch(() => this.toast('No se pudieron cargar los catálogos', 'warn'));
    } else {
      this.mostrar('login');
    }
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
