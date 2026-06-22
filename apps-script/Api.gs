// Api.gs — Entry-points de la Web App (doGet / doPost) y setup inicial

/**
 * doGet — ping de salud.
 */
function doGet(e) {
  return jsonResponse({ ok: true, app: 'IngresoPorterias', version: '1.0', ts: now_() });
}

/**
 * doPost — router principal.
 * El front envía: { accion, payload, auth: { email }, origen }
 * Content-Type: text/plain (evita preflight CORS de Apps Script).
 */
function doPost(e) {
  var response;
  try {
    var body    = JSON.parse(e.postData.contents);
    var accion  = String(body.accion  || '').trim();
    var payload = body.payload  || {};
    var auth    = body.auth     || {};
    var origen  = String(body.origen || 'web');

    // Acciones que no requieren sesión activa
    var accionesPublicas = ['ping', 'login', 'registrarClave', 'cambiarClave'];

    var usuario = null;
    if (accionesPublicas.indexOf(accion) === -1) {
      usuario = validarSesion_(auth.email);
      if (!usuario) {
        return jsonResponse({ ok: false, error: 'Sesión inválida o usuario inactivo. Vuelva a iniciar sesión.' });
      }
    }

    switch (accion) {
      // ── Público ────────────────────────────────────────────
      case 'ping':
        response = { ok: true, msg: 'IngresoPorterias OK', ts: now_() };
        break;
      case 'login':
        response = login(payload);
        break;
      case 'registrarClave':
        response = registrarClave(payload);
        break;
      case 'cambiarClave':
        // cambiarClave requiere sesión para saber quién es
        var uCambio = validarSesion_(auth.email);
        if (!uCambio) { response = { ok: false, error: 'Sesión inválida.' }; break; }
        response = cambiarClave(payload, uCambio);
        break;

      // ── Usuarios ───────────────────────────────────────────
      case 'altaUsuario':
        response = altaUsuario(payload, usuario);
        break;
      case 'listarUsuarios':
        response = listarUsuarios(usuario);
        break;

      // ── Catálogos ──────────────────────────────────────────
      case 'getCatalogos':
        response = getCatalogos(usuario);
        break;
      case 'getUnidadPorId':
        response = getUnidadPorId(payload.id);
        break;
      case 'altaUnidad':
        response = altaUnidad(payload, usuario);
        break;
      case 'altaChofer':
        response = altaChofer(payload, usuario);
        break;
      case 'altaPredio':
        response = altaPredio(payload, usuario);
        break;

      // ── Distribución ───────────────────────────────────────
      case 'distribucionIngreso':
        response = distribucionIngreso(payload, usuario, origen);
        break;
      case 'distribucionEgreso':
        response = distribucionEgreso(payload, usuario, origen);
        break;
      case 'distribucionAbiertos':
        response = distribucionAbiertos(payload, usuario);
        break;
      case 'distribucionHistorial':
        response = distribucionHistorial(payload, usuario);
        break;

      // ── Tráfico ────────────────────────────────────────────
      case 'traficoEvento':
        response = traficoEvento(payload, usuario, origen);
        break;
      case 'traficoGestion':
        response = traficoGestion(payload, usuario);
        break;
      case 'traficoFinalizar':
        response = traficoFinalizar(payload, usuario);
        break;
      case 'traficosPendientes':
        response = traficosPendientes(payload, usuario);
        break;
      case 'viajesEnRuta':
        response = viajesEnRuta(payload, usuario);
        break;
      case 'traficoHistorial':
        response = traficoHistorial(payload, usuario);
        break;
      case 'getDashboard':
        response = getDashboard(payload, usuario);
        break;

      // ── Personal ───────────────────────────────────────────
      case 'personalIngreso':
        response = personalIngreso(payload, usuario, origen);
        break;
      case 'personalEgreso':
        response = personalEgreso(payload, usuario, origen);
        break;
      case 'personalAbiertos':
        response = personalAbiertos(payload, usuario);
        break;
      case 'personalHistorial':
        response = personalHistorial(payload, usuario);
        break;

      // ── Indicadores ────────────────────────────────────────
      case 'getIndicadores':
        response = getIndicadores(payload, usuario);
        break;

      default:
        response = { ok: false, error: 'Acción desconocida: ' + accion };
    }
  } catch (err) {
    response = { ok: false, error: 'Error interno: ' + err.message };
  }

  return jsonResponse(response);
}

// ═══════════════════════════════════════════════════════════════
// DIAGNÓSTICO — ejecutar desde el editor de GAS
// ═══════════════════════════════════════════════════════════════

/**
 * Verifica que DriveApp tenga acceso a la carpeta de fotos.
 * Si aparece un diálogo de permisos → aceptar → DriveApp queda autorizado.
 * Ejecutar: Ejecutar → autorizarDrive
 */
function autorizarDrive() {
  try {
    var folder = DriveApp.getFolderById(DRIVE_FOLDER_FOTOS_ID);
    Logger.log('✅ Drive autorizado. Carpeta: "' + folder.getName() + '" — ID: ' + DRIVE_FOLDER_FOTOS_ID);
  } catch (e) {
    Logger.log('❌ Error accediendo a Drive: ' + e.message);
    Logger.log('   Verificar que la carpeta exista y que el ID sea correcto.');
    Logger.log('   ID configurado: ' + DRIVE_FOLDER_FOTOS_ID);
  }
}

// ═══════════════════════════════════════════════════════════════
// SETUP INICIAL — ejecutar una sola vez desde el editor de GAS
// ═══════════════════════════════════════════════════════════════

/**
 * Crea los headers en todas las hojas y carga los 6 predios + usuario admin inicial.
 * Ejecutar manualmente desde el editor de Apps Script: Ejecutar → setupInicial
 */
function setupInicial() {
  // Crear/verificar todas las hojas
  getSheet_(SHEET_IDS.USUARIOS,         'USUARIOS',         HEADERS.USUARIOS);
  getSheet_(SHEET_IDS.PREDIOS,          'PREDIOS',          HEADERS.PREDIOS);
  getSheet_(SHEET_IDS.UNIDADES,         'UNIDADES',         HEADERS.UNIDADES);
  getSheet_(SHEET_IDS.SERVICIOS,        'SERVICIOS',        HEADERS.SERVICIOS);
  getSheet_(SHEET_IDS_EXTRA.CHOFERES,   'CHOFERES',         HEADERS.CHOFERES);
  getSheet_(SHEET_IDS.MOV_DISTRIBUCION, 'MOV_DISTRIBUCION', HEADERS.MOV_DISTRIBUCION);
  getSheet_(SHEET_IDS.MOV_TRAFICO,      'MOV_TRAFICO',      HEADERS.MOV_TRAFICO);
  getSheet_(SHEET_IDS.VIAJES,           'VIAJES',           HEADERS.VIAJES);
  getSheet_(SHEET_IDS.MOV_PERSONAL,     'MOV_PERSONAL',     HEADERS.MOV_PERSONAL);
  getSheet_(SHEET_IDS_EXTRA.LOG_AUDITORIA, 'LOG_AUDITORIA', HEADERS.LOG_AUDITORIA);

  Logger.log('✅ Hojas verificadas/creadas.');

  // Cargar los 6 predios si no existen
  var prediosSheet = getSheet_(SHEET_IDS.PREDIOS, 'PREDIOS', HEADERS.PREDIOS);
  var prediosRows  = readAll_(prediosSheet);

  var prediosIniciales = [
    { ID_Predio: 'PRD-001', Nombre: 'Tecnicagua',           Provincia: 'Mendoza',       Permite_Clientes: 'TRUE',  Activo: 'TRUE' },
    { ID_Predio: 'PRD-002', Nombre: 'División Frío',         Provincia: 'Mendoza',       Permite_Clientes: 'TRUE',  Activo: 'TRUE' },
    { ID_Predio: 'PRD-003', Nombre: 'Independencia',         Provincia: 'Mendoza',       Permite_Clientes: 'TRUE',  Activo: 'TRUE' },
    { ID_Predio: 'PRD-004', Nombre: 'Zapla',                 Provincia: 'Mendoza',       Permite_Clientes: 'FALSE', Activo: 'TRUE' },
    { ID_Predio: 'PRD-005', Nombre: 'Avellaneda (Gorriti 650)', Provincia: 'Buenos Aires', Permite_Clientes: 'TRUE', Activo: 'TRUE' },
    { ID_Predio: 'PRD-006', Nombre: 'Riveros 640',           Provincia: 'Buenos Aires',  Permite_Clientes: 'FALSE', Activo: 'TRUE' },
  ];

  prediosIniciales.forEach(function(p) {
    if (!findRow_(prediosRows, 'ID_Predio', p.ID_Predio)) {
      insertRow_(prediosSheet, p, HEADERS.PREDIOS);
      Logger.log('  Predio creado: ' + p.Nombre);
    } else {
      Logger.log('  Predio ya existe: ' + p.Nombre);
    }
  });

  // Crear usuario admin inicial si no existe ningún usuario
  var usuariosSheet = getSheet_(SHEET_IDS.USUARIOS, 'USUARIOS', HEADERS.USUARIOS);
  var usuariosRows  = readAll_(usuariosSheet);
  if (!usuariosRows.length) {
    var adminEmail = 'admin@andesmar.com.ar'; // ← CAMBIAR al email real del admin
    var adminInicial = {
      ID_Usuario:      'USR-00001',
      Nombre_Apellido: 'Administrador',
      Email:           adminEmail,
      Clave_Hash:      '',
      Rol:             ROLES.ADMIN,
      Predio_Asignado: 'TODOS',
      Activo:          'TRUE',
      Fecha_Alta:      now_(),
    };
    insertRow_(usuariosSheet, adminInicial, HEADERS.USUARIOS);
    Logger.log('✅ Admin creado: ' + adminEmail + ' (sin clave — debe registrarla al primer login).');
  } else {
    Logger.log('  Ya existen usuarios. No se creó admin.');
  }

  Logger.log('✅ setupInicial completado.');
}

/**
 * Carga el catálogo completo de servicios.
 * Ejecutar manualmente: Ejecutar → cargarServicios
 */
function cargarServicios() {
  var sheet = getSheet_(SHEET_IDS.SERVICIOS, 'SERVICIOS', HEADERS.SERVICIOS);
  var rows  = readAll_(sheet);

  var servicios = [
    // Origen BS_AS
    { Codigo: '120',   Descripcion: 'CAMION AVELL-ROS-CBA-SL-MZ',    Origen_Zona: 'BS_AS', Predio_Origen: 'PRD-005', Predio_Destino: 'PRD-001' },
    { Codigo: '103',   Descripcion: 'CAMION AVELL - MZA 18:00',       Origen_Zona: 'BS_AS', Predio_Origen: 'PRD-005', Predio_Destino: 'PRD-001' },
    { Codigo: '121',   Descripcion: 'CAMION AVELL - BBCA - PLOT',      Origen_Zona: 'BS_AS', Predio_Origen: 'PRD-005', Predio_Destino: '' },
    { Codigo: '104-1', Descripcion: 'CAMION AVELL/SL/SM/MZA',          Origen_Zona: 'BS_AS', Predio_Origen: 'PRD-005', Predio_Destino: 'PRD-001' },
    { Codigo: '124',   Descripcion: 'CAMION AVELL - TUC',              Origen_Zona: 'BS_AS', Predio_Origen: 'PRD-005', Predio_Destino: '' },
    { Codigo: '147',   Descripcion: 'CAMION ADI AVELL - MZA',          Origen_Zona: 'BS_AS', Predio_Origen: 'PRD-005', Predio_Destino: 'PRD-001' },
    { Codigo: '168',   Descripcion: 'EG CAMION CD AVE/CDTW/CDCR',      Origen_Zona: 'BS_AS', Predio_Origen: 'PRD-005', Predio_Destino: '' },
    { Codigo: '172',   Descripcion: 'CAMION CD TUC - CD AVELL',        Origen_Zona: 'BS_AS', Predio_Origen: 'PRD-005', Predio_Destino: '' },
    { Codigo: '122',   Descripcion: 'CAMION PLOT - BBCA - AVELL',      Origen_Zona: 'BS_AS', Predio_Origen: 'PRD-005', Predio_Destino: '' },
    { Codigo: '153',   Descripcion: 'CAMION AVELL/BBCA/CALETA',        Origen_Zona: 'BS_AS', Predio_Origen: 'PRD-005', Predio_Destino: '' },
    { Codigo: '165',   Descripcion: 'CAMION TARTA/CDSLA/CDTUC',        Origen_Zona: 'BS_AS', Predio_Origen: 'PRD-005', Predio_Destino: '' },
    { Codigo: '167',   Descripcion: 'CAMION EG CD AVEL - CD BCA',      Origen_Zona: 'BS_AS', Predio_Origen: 'PRD-005', Predio_Destino: '' },
    { Codigo: '142',   Descripcion: 'CAMION CD TUC/AVELL',             Origen_Zona: 'BS_AS', Predio_Origen: 'PRD-005', Predio_Destino: '' },
    { Codigo: '336',   Descripcion: 'PQT CALETA - BBCA - MZA SR',      Origen_Zona: 'BS_AS', Predio_Origen: 'PRD-005', Predio_Destino: 'PRD-001' },
    { Codigo: '171',   Descripcion: 'CAMION CD AVELL - CD RIO G',      Origen_Zona: 'BS_AS', Predio_Origen: 'PRD-005', Predio_Destino: '' },
    { Codigo: '334',   Descripcion: 'PQT CALETA - BBCA - MZA',         Origen_Zona: 'BS_AS', Predio_Origen: 'PRD-005', Predio_Destino: 'PRD-001' },
    // Origen MZA
    { Codigo: '101',   Descripcion: 'CAMION MZA - AVELL 17:30',        Origen_Zona: 'MZA',   Predio_Origen: 'PRD-001', Predio_Destino: 'PRD-005' },
    { Codigo: '115',   Descripcion: 'CAMION MZA - TUC',                Origen_Zona: 'MZA',   Predio_Origen: 'PRD-001', Predio_Destino: '' },
    { Codigo: '119',   Descripcion: 'CAMION MZA - CBA - ROS - A',      Origen_Zona: 'MZA',   Predio_Origen: 'PRD-001', Predio_Destino: '' },
    { Codigo: '138',   Descripcion: 'CAMION ADI MZA - AVELL',          Origen_Zona: 'MZA',   Predio_Origen: 'PRD-001', Predio_Destino: 'PRD-005' },
    { Codigo: '153',   Descripcion: 'CAMION MZA/SM/AVELL',             Origen_Zona: 'MZA',   Predio_Origen: 'PRD-001', Predio_Destino: 'PRD-005' },
    { Codigo: '105',   Descripcion: 'CAMION MZA - SAN JUAN',           Origen_Zona: 'MZA',   Predio_Origen: 'PRD-001', Predio_Destino: '' },
    { Codigo: '117',   Descripcion: 'CAMION MZA - PLOTTIER',           Origen_Zona: 'MZA',   Predio_Origen: 'PRD-001', Predio_Destino: '' },
    { Codigo: '',      Descripcion: 'CAMION MENDOZA CORDOBA',          Origen_Zona: 'MZA',   Predio_Origen: 'PRD-001', Predio_Destino: '' },
    { Codigo: '131',   Descripcion: 'CAMION CD MZA/ROS/AVELL',         Origen_Zona: 'MZA',   Predio_Origen: 'PRD-001', Predio_Destino: 'PRD-005' },
    { Codigo: '318.1', Descripcion: 'PQT MZA - CALETA',                Origen_Zona: 'MZA',   Predio_Origen: 'PRD-001', Predio_Destino: '' },
    { Codigo: '113',   Descripcion: 'CAMION MZA - JUJUY',              Origen_Zona: 'MZA',   Predio_Origen: 'PRD-001', Predio_Destino: '' },
    { Codigo: '107',   Descripcion: 'CAMION MZA - SAN LUIS',           Origen_Zona: 'MZA',   Predio_Origen: 'PRD-001', Predio_Destino: '' },
    { Codigo: '106',   Descripcion: 'CAMION SAN JUAN - MZA',           Origen_Zona: 'MZA',   Predio_Origen: '',        Predio_Destino: 'PRD-001' },
    { Codigo: '3',     Descripcion: 'CAMION CD MZA - SAN MARTIN',      Origen_Zona: 'MZA',   Predio_Origen: 'PRD-001', Predio_Destino: '' },
    { Codigo: '108',   Descripcion: 'CAMION SAN LUIS - MZA',           Origen_Zona: 'MZA',   Predio_Origen: '',        Predio_Destino: 'PRD-001' },
    { Codigo: '',      Descripcion: 'MENDOZA - RDLSAUCES',             Origen_Zona: 'MZA',   Predio_Origen: 'PRD-001', Predio_Destino: '' },
    { Codigo: '',      Descripcion: 'MENDOZA - ESQUEL',                Origen_Zona: 'MZA',   Predio_Origen: 'PRD-001', Predio_Destino: '' },
    { Codigo: '118',   Descripcion: 'CAMION PLOTTIER - MZA',           Origen_Zona: 'MZA',   Predio_Origen: '',        Predio_Destino: 'PRD-001' },
    // Comodín
    { Codigo: 'OTRO',  Descripcion: 'Otro servicio (especificar)',      Origen_Zona: 'OTRO',  Predio_Origen: '',        Predio_Destino: '' },
  ];

  var creados = 0;
  servicios.forEach(function(s) {
    // Evitar duplicados por código+descripción
    var yaExiste = rows.find(function(r) {
      return String(r.Codigo).trim() === String(s.Codigo).trim()
          && String(r.Descripcion).trim() === String(s.Descripcion).trim();
    });
    if (!yaExiste) {
      var id = nextId_(sheet, ID_PREFIJOS.SERVICIOS);
      var nuevo = {
        ID_Servicio:   id,
        Codigo:        s.Codigo,
        Descripcion:   s.Descripcion,
        Origen_Zona:   s.Origen_Zona,
        Predio_Origen: s.Predio_Origen,
        Predio_Destino: s.Predio_Destino,
        Activo:        'TRUE',
      };
      insertRow_(sheet, nuevo, HEADERS.SERVICIOS);
      creados++;
      // Recargar rows para que nextId_ funcione correctamente
      rows = readAll_(sheet);
    }
  });

  Logger.log('✅ cargarServicios completado. Servicios creados: ' + creados);
}
