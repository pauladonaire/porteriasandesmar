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

// Prefetch de "personas adentro" — misma idea, misma clave que js/personal.js
// (PERS_ABIERTOS_CACHE_KEY).
function _prefetchPersonalAbiertos() {
  const CACHE_KEY = 'ip_pers_abiertos_cache';
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached && (Date.now() - cached.ts) < 20000) return; // ya está fresco, no hace falta
    }
  } catch (e) { /* seguimos e intentamos igual */ }

  if (typeof api !== 'function') return;
  api('personalAbiertos').then(res => {
    if (!res || !res.ok) return;
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), movimientos: res.movimientos || [] }));
    } catch (e) { /* no crítico */ }
  }).catch(() => {});
}

// Prefetch de "viajes en ruta" — misma idea, misma clave que js/trafico.js
// (TRAF_VIAJES_CACHE_KEY). No toca pendientes SITRACK (traficosPendientes):
// esa lista está atada a lógica de auto-apertura por URL/sessionStorage y conviene
// dejarla pedirse fresca solo cuando trafico.html realmente carga.
function _prefetchTraficoViajes() {
  const CACHE_KEY = 'ip_traf_viajes_cache';
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached && (Date.now() - cached.ts) < 20000) return;
    }
  } catch (e) { /* seguimos e intentamos igual */ }

  if (typeof api !== 'function') return;
  api('viajesEnRuta').then(res => {
    if (!res || !res.ok) return;
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), viajes: res.viajes || [] }));
    } catch (e) { /* no crítico */ }
  }).catch(() => {});
}

// Roles enfocados en el Turnero: no operan ingreso/egreso de Portería, solo ven
// Unidades QR (para imprimir). Si entran a estas páginas por URL directa, se los
// manda de vuelta al home (el backend igual les rechaza cualquier acción vía
// puedeOperarPredio_, pero así ni ven el formulario).
const ROLES_SIN_PORTERIA = ['admin_deposito', 'operaciones', 'distribucion'];
const PAGINAS_PORTERIA_RESTRINGIDA = ['distribucion', 'trafico', 'personal'];

// Si el usuario logueado es 'vigilador' con un único predio fijo asignado
// (Predio_Asignado != 'TODOS' y no vacío), devuelve ese ID de predio — para usarlo
// directo en Distribución/Tráfico/Personal sin hacerlo elegir ni esperar a que carguen
// los catálogos. Solo vigilador puede estar así de restringido: supervisor/admin
// siempre operan con Predio_Asignado = 'TODOS' (ver puedeOperarPredio_ en Auth.gs), así
// que para ellos esto no aplica y el selector de predio sigue como está hoy.
function predioFijoVigilador() {
  const u = Sesion.obtener();
  if (!u || u.Rol !== 'vigilador') return null;
  const p = String(u.Predio_Asignado || '').trim();
  if (!p || p.toUpperCase() === 'TODOS') return null;
  return p;
}

// Oculta el campo "Predio" (label + select) de la página actual si el vigilador tiene
// predio fijo — se llama ANTES de cargar catálogos (ver NavPage.init), así no hay que
// esperar ningún pedido al servidor para poder operar. Los formularios de
// Distribución/Tráfico/Personal siguen leyendo predioFijoVigilador() directamente al
// enviar (no dependen de que este select tenga valor)... PERO el <select> tiene el
// atributo HTML `required`, y un <select> requerido sin valor bloquea el envío del
// formulario a nivel del navegador ANTES de que corra nuestro JS — ni siquiera llega a
// dispararse el evento 'submit' (por eso el botón "no anda": no es un error, el browser
// nunca deja enviar el form). Como el campo queda oculto, en algunos navegadores ni
// siquiera se ve el aviso de "completá este campo". Por eso acá también le sacamos el
// `required`: el predio real se sigue mandando igual, por predioFijoVigilador().
function ocultarCampoPredioSiFijo() {
  if (!predioFijoVigilador()) return;
  ['sel-predio-dist', 'sel-predio-traf', 'sel-predio-pers'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.required = false;
    const campo = sel.closest('.field');
    if (campo) campo.style.display = 'none';
  });
}

// NavPage: guard de sesión, topbar, bottom-nav, logout
const NavPage = {
  init(paginaActual) {
    const u = Sesion.obtener();
    if (!u) { window.location.href = 'index.html'; return; }

    if (ROLES_SIN_PORTERIA.includes(rolEfectivo()) && PAGINAS_PORTERIA_RESTRINGIDA.includes(paginaActual)) {
      window.location.href = 'index.html';
      return;
    }

    ocultarCampoPredioSiFijo();
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
        if (destino === 'personal')     _prefetchPersonalAbiertos();
        if (destino === 'trafico')      _prefetchTraficoViajes();
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
