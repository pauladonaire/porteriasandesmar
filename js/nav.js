// nav.js — Navegación compartida (distribucion, trafico, personal, indicadores)

// App: router de sub-vistas dentro de la misma página + toast
const App = {
  mostrar(id) {
    document.querySelectorAll('.view').forEach(v => {
      v.classList.remove('active');
      v.style.display = 'none';
    });
    const vista = document.getElementById('view-' + id);
    if (!vista) return;
    vista.classList.add('active');
    vista.style.display = 'block';

    if (id !== 'distribucion' && typeof Scanner      !== 'undefined') Scanner.detener();
    if (id === 'dentro-dist'  && typeof Distribucion !== 'undefined') Distribucion.cargarLista();
    if (id === 'dentro-traf'  && typeof Trafico      !== 'undefined') Trafico.cargarViajes();
    if (id === 'dentro-pers'  && typeof Personal     !== 'undefined') Personal.cargarLista();
    if (id === 'indicadores'  && typeof Indicadores  !== 'undefined') Indicadores.cargar('', '', '');

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
};

// NavPage: guard de sesión, topbar, bottom-nav, logout
const NavPage = {
  init(paginaActual) {
    const u = Sesion.obtener();
    if (!u) { window.location.href = 'index.html'; return; }

    aplicarRol(u.Rol);
    document.getElementById('topbar-user').textContent = u.Nombre_Apellido;
    const predio = u.Predio_Asignado === 'TODOS' ? 'Todos los predios' : u.Predio_Asignado;
    document.getElementById('topbar-predio').textContent = predio;

    // Bottom-nav: marcar activo y navegar entre páginas
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.pagina === paginaActual);
      item.addEventListener('click', () => {
        const destino = item.dataset.pagina;
        if (destino === paginaActual) return;
        window.location.href = destino === 'home' ? 'index.html' : destino + '.html';
      });
    });

    // Logout
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      Sesion.cerrar();
      document.body.removeAttribute('data-rol');
      window.location.href = 'index.html';
    });

    // data-goto: sub-vistas dentro de la misma página (o volver al home)
    document.querySelectorAll('[data-goto]').forEach(btn => {
      btn.addEventListener('click', () => {
        const goto = btn.dataset.goto;
        if (goto === 'home') { window.location.href = 'index.html'; return; }
        App.mostrar(goto);
      });
    });

    // Cerrar modales al hacer clic en el backdrop
    document.addEventListener('click', e => {
      if (e.target.classList.contains('modal-backdrop')) {
        e.target.style.display = 'none';
        if (typeof Scanner !== 'undefined') Scanner.detener();
      }
    });
  },
};
