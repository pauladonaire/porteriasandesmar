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

// Prefetch de "unidades adentro" — usa la MISMA clave que js/distribucion.js
// (no se declara como const compartida para no chocar con esa declaración cuando
// ambos scripts conviven en distribucion.html).
function _prefetchDistribucionAbiertos() {
  const CACHE_KEY = 'ip_dist_abiertos_cache';
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached && (Date.now() - cached.ts) < 20000) return; // ya está fresco, no hace falta
    }
  } catch (e) { /* seguimos e intentamos igual */ }

  if (typeof api !== 'function') return;
  api('distribucionAbiertos').then(res => {
    if (!res || !res.ok) return;
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), movimientos: res.movimientos || [] }));
    } catch (e) { /* no crítico */ }
  }).catch(() => {});
}

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
        // Prefetch best-effort: si vamos a Distribución, disparamos ya la llamada a
        // distribucionAbiertos (sin esperarla) para que, si el teléfono/PC alcanza a
        // responder antes de que la navegación tire la página vieja, distribucion.html
        // encuentre el dato fresco en sessionStorage y no tenga que volver a pedirlo.
        // Es "mejor esfuerzo": si la navegación gana la carrera, no pasa nada — la
        // página de destino igual hace su propio pedido (ver js/distribucion.js).
        if (destino === 'distribucion') _prefetchDistribucionAbiertos();
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
