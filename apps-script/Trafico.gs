// Trafico.gs — Eventos de tráfico (planilla interbase) y gestión de viajes
// Hoja única: MOV_TRAFICO (36 columnas).
// V3: fotos precintos/daños, nombres denormalizados, gestión SITRACK con trazabilidad.

// ─────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────

function crearSubcarpetaMov_(idMov) {
  if (!DRIVE_FOLDER_FOTOS_ID) return null;
  try {
    var parent = DriveApp.getFolderById(DRIVE_FOLDER_FOTOS_ID);
    var iter   = parent.getFoldersByName(idMov);
    return iter.hasNext() ? iter.next() : parent.createFolder(idMov);
  } catch (e) {
    Logger.log('crearSubcarpetaMov_ error [' + idMov + ']: ' + e.message);
    return null;
  }
}

function subirFotos_(base64Array, prefijo, carpeta) {
  if (!carpeta || !base64Array || !base64Array.length) return '';
  var urls = [];
  for (var i = 0; i < base64Array.length; i++) {
    var b64 = base64Array[i];
    if (!b64) continue;
    try {
      var partes = String(b64).split(',');
      var rawB64 = partes.length > 1 ? partes[1] : partes[0];
      var nombre = prefijo + '_' + (i + 1) + '.jpg';
      var blob   = Utilities.newBlob(Utilities.base64Decode(rawB64), 'image/jpeg', nombre);
      var file   = carpeta.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      urls.push(file.getUrl());
    } catch (e) {
      Logger.log('subirFotos_ error [' + prefijo + '_' + (i + 1) + ']: ' + e.message);
    }
  }
  return urls.join(', ');
}

function abrirViaje_(idServicio, tractor, arrastre, chofer, idPredioOrigen, tsEgreso, idUsuario, idMovTrafico) {
  var sheet = getSheet_(SHEET_IDS.VIAJES, 'VIAJES', HEADERS.VIAJES);
  var id    = nextId_(sheet, ID_PREFIJOS.VIAJES);

  var serviciosSheet = getSheet_(SHEET_IDS.SERVICIOS, 'SERVICIOS', HEADERS.SERVICIOS);
  var servicio       = findRow_(readAll_(serviciosSheet), 'ID_Servicio', idServicio);
  var predioDestino  = servicio ? String(servicio.Predio_Destino || '') : '';

  var viaje = {
    ID_Viaje:          id,
    ID_Servicio:       idServicio,
    Tractor:           tractor,
    Arrastre:          arrastre,
    Chofer:            chofer,
    Predio_Origen:     idPredioOrigen,
    FechaHora_Salida:  tsEgreso,
    Usuario_Salida:    idUsuario,
    Predio_Destino:    predioDestino,
    FechaHora_Llegada: '',
    Usuario_Llegada:   '',
    Horas_Ruta:        '',
    Estado:            'en_ruta',
    Observaciones:     'Originado en: ' + idMovTrafico,
  };
  insertRow_(sheet, viaje, HEADERS.VIAJES);
  return id;
}

function cerrarViajePorLlegada_(tractor, idPredioLlegada, tsLlegada, idUsuario) {
  var sheet     = getSheet_(SHEET_IDS.VIAJES, 'VIAJES', HEADERS.VIAJES);
  var rows      = readAll_(sheet);
  var tractorUp = String(tractor).trim().toUpperCase();
  var predioUp  = String(idPredioLlegada).trim().toUpperCase();

  var candidatos = rows.filter(function(r) {
    return String(r.Estado).toLowerCase() === 'en_ruta'
        && String(r.Tractor).trim().toUpperCase() === tractorUp
        && String(r.Predio_Destino).trim().toUpperCase() === predioUp;
  });
  if (!candidatos.length) return null;

  candidatos.sort(function(a, b) {
    return String(a.FechaHora_Salida).localeCompare(String(b.FechaHora_Salida));
  });
  var viaje = candidatos[0];

  var horasRuta = horasEntre_(String(viaje.FechaHora_Salida), tsLlegada);
  viaje.FechaHora_Llegada = tsLlegada;
  viaje.Usuario_Llegada   = idUsuario;
  viaje.Horas_Ruta        = horasRuta;
  viaje.Estado            = 'finalizado';

  updateRow_(sheet, viaje._row, viaje, HEADERS.VIAJES);
  return { id: viaje.ID_Viaje, horasRuta: horasRuta };
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL — registrar evento de tráfico
// ─────────────────────────────────────────────────────────────

function traficoEvento(payload, usuario, origen) {
  // ── Campos base ───────────────────────────────────────────
  var idPredio        = String(payload.idPredio        || '').trim();
  var idServicio      = String(payload.idServicio      || '').trim();
  var servicioOtro    = String(payload.servicioOtro    || '').trim();
  var chofer          = String(payload.chofer          || '').trim();
  var tractor         = String(payload.tractor         || '').trim().toUpperCase();
  var arrastre        = String(payload.arrastre        || '').trim().toUpperCase();
  var precintos       = String(payload.precintos       || '').trim();
  var tipoEvento      = String(payload.tipoEvento      || 'ingreso').trim().toLowerCase();

  // ── Campos inspección ─────────────────────────────────────
  var operador        = String(payload.operador        || '').trim();
  var estadoOperativo = String(payload.estadoOperativo || 'operativo').trim();
  var estadoSitrack   = String(payload.estadoSitrack   || '').trim();
  var certTractor     = String(payload.certTractor     || '').trim();
  var certArrastre    = String(payload.certArrastre    || '').trim();
  var limpieza        = String(payload.limpieza        || '').trim();
  var equipamiento    = String(payload.equipamiento    || '').trim();
  var danos           = String(payload.danos           || '').trim();
  var observaciones   = String(payload.observaciones   || '').trim();

  var fotosTractor   = Array.isArray(payload.fotosTractor)   ? payload.fotosTractor   : (payload.fotosTractor   ? [String(payload.fotosTractor)]   : []);
  var fotosArrastre  = Array.isArray(payload.fotosArrastre)  ? payload.fotosArrastre  : (payload.fotosArrastre  ? [String(payload.fotosArrastre)]  : []);
  var fotosExtra     = Array.isArray(payload.fotosExtra)     ? payload.fotosExtra     : (payload.fotosExtra     ? [String(payload.fotosExtra)]     : []);
  var fotosPrecintos = Array.isArray(payload.fotosPrecintos) ? payload.fotosPrecintos : (payload.fotosPrecintos ? [String(payload.fotosPrecintos)] : []);
  var fotosDanos     = Array.isArray(payload.fotosDanos)     ? payload.fotosDanos     : (payload.fotosDanos     ? [String(payload.fotosDanos)]     : []);

  // ── Validaciones ──────────────────────────────────────────
  if (!idPredio)  return { ok: false, error: 'Predio obligatorio.' };
  if (!tractor)   return { ok: false, error: 'Tractor obligatorio.' };
  if (!operador)  return { ok: false, error: 'Operador de portería obligatorio.' };
  if (tipoEvento !== 'ingreso' && tipoEvento !== 'egreso') {
    return { ok: false, error: 'Tipo de evento debe ser ingreso o egreso.' };
  }
  if (!puedeOperarPredio_(usuario, idPredio)) {
    return { ok: false, error: 'Sin permiso para operar en este predio.' };
  }

  var usaOtro = (!idServicio || idServicio.toUpperCase() === 'SRV-OTRO' || idServicio.toUpperCase() === 'OTRO');
  if (usaOtro && !servicioOtro) {
    return { ok: false, error: 'Especifique el servicio en el campo "Otro servicio".' };
  }

  // ── Resolución de nombres (denormalización) ───────────────
  var prediosSheet  = getSheet_(SHEET_IDS.PREDIOS, 'PREDIOS', HEADERS.PREDIOS);
  var predioObj     = findRow_(readAll_(prediosSheet), 'ID_Predio', idPredio);
  var nombrePredio  = predioObj ? String(predioObj.Nombre || '') : idPredio;

  var serviciosSheet = getSheet_(SHEET_IDS.SERVICIOS, 'SERVICIOS', HEADERS.SERVICIOS);
  var servicioObj    = (!usaOtro && idServicio) ? findRow_(readAll_(serviciosSheet), 'ID_Servicio', idServicio) : null;
  var nombreServicio = servicioObj
    ? (String(servicioObj.Descripcion || '').trim() || String(servicioObj.Codigo || '').trim())
    : (servicioOtro || '');
  var predioDestino  = servicioObj ? String(servicioObj.Predio_Destino || '').trim() : '';

  var sheet = getSheet_(SHEET_IDS.MOV_TRAFICO, 'MOV_TRAFICO', HEADERS.MOV_TRAFICO);
  var ts    = now_();
  var id    = nextId_(sheet, ID_PREFIJOS.MOV_TRAFICO, 8);

  // ── Lógica de viajes ──────────────────────────────────────
  var idViaje   = '';
  var viajeInfo = null;

  if (tipoEvento === 'egreso' && predioDestino) {
    idViaje = abrirViaje_(idServicio, tractor, arrastre, chofer, idPredio, ts, usuario.ID_Usuario, id);
    logAccion_(usuario.ID_Usuario, 'VIAJE_ABIERTO', 'VIAJES', idViaje,
      'Tractor: ' + tractor + ' → Destino: ' + predioDestino, origen);
  }

  if (tipoEvento === 'ingreso') {
    viajeInfo = cerrarViajePorLlegada_(tractor, idPredio, ts, usuario.ID_Usuario);
    if (viajeInfo) {
      idViaje = viajeInfo.id;
      logAccion_(usuario.ID_Usuario, 'VIAJE_CERRADO', 'VIAJES', idViaje,
        'Tractor: ' + tractor + ' | Horas ruta: ' + viajeInfo.horasRuta, origen);
    }
  }

  // ── Horas dentro (egreso) ─────────────────────────────────
  var horasDentro = '';
  var advertenciaSinIngreso = false;
  if (tipoEvento === 'egreso') {
    var rows = readAll_(sheet);
    var ingresos = rows.filter(function(r) {
      return String(r.Tipo_Evento).toLowerCase() === 'ingreso'
          && String(r.Tractor).trim().toUpperCase() === tractor
          && String(r.ID_Predio).trim().toUpperCase() === idPredio.toUpperCase();
    });
    if (ingresos.length) {
      ingresos.sort(function(a, b) {
        return String(b.FechaHora_Ingreso).localeCompare(String(a.FechaHora_Ingreso));
      });
      horasDentro = horasEntre_(String(ingresos[0].FechaHora_Ingreso), ts);
    } else {
      advertenciaSinIngreso = true;
    }
  }

  // ── Subir fotos a Drive ───────────────────────────────────
  var carpetaMov       = crearSubcarpetaMov_(id);
  var driveOk          = (carpetaMov !== null);
  var urlFotoTractor   = subirFotos_(fotosTractor,   'tractor',   carpetaMov);
  var urlFotoArrastre  = subirFotos_(fotosArrastre,  'arrastre',  carpetaMov);
  var urlFotoExtra     = subirFotos_(fotosExtra,     'extra',     carpetaMov);
  var urlFotoPrecintos = subirFotos_(fotosPrecintos, 'precintos', carpetaMov);
  var urlFotoDanos     = subirFotos_(fotosDanos,     'danos',     carpetaMov);

  // ── Estado del movimiento ─────────────────────────────────
  var sitrackFalla = (estadoSitrack === 'falla' || estadoSitrack === 'sin-reporte');
  var estadoMov    = sitrackFalla          ? 'pendiente_sitrack'
                  : advertenciaSinIngreso  ? 'sin_ingreso_previo'
                  : 'registrado';

  var servicioCol = usaOtro ? servicioOtro : idServicio;

  var mov = {
    // ── Columnas originales 1-20 ──────────────────────────
    ID_Mov:               id,
    ID_Predio:            idPredio,
    ID_Servicio:          idServicio,
    Servicio_Otro:        servicioOtro,
    Chofer:               chofer,
    Tractor:              tractor,
    Arrastre:             arrastre,
    Precintos:            precintos,
    Foto_Precintos_URL:   urlFotoPrecintos,
    Danios_Observaciones: observaciones,
    Foto_Danios_URL:      urlFotoDanos,
    Certificado_Cobertura: certTractor,
    Tipo_Evento:          tipoEvento,
    FechaHora_Ingreso:    tipoEvento === 'ingreso' ? ts : '',
    FechaHora_Egreso:     tipoEvento === 'egreso'  ? ts : '',
    Usuario_Ingreso:      tipoEvento === 'ingreso' ? usuario.ID_Usuario : '',
    Usuario_Egreso:       tipoEvento === 'egreso'  ? usuario.ID_Usuario : '',
    Horas_Dentro:         horasDentro,
    ID_Viaje:             idViaje,
    Estado:               estadoMov,
    // ── Inspección V2 (21-31) ─────────────────────────────
    Operador:             operador,
    Estado_Operativo:     estadoOperativo,
    SITRACK:              estadoSitrack,
    Cert_Tractor:         certTractor,
    Cert_Arrastre:        certArrastre,
    Limpieza:             limpieza,
    Equipamiento:         equipamiento,
    Danos:                danos,
    Foto_Tractor:         urlFotoTractor,
    Foto_Arrastre:        urlFotoArrastre,
    Foto_Extra:           urlFotoExtra,
    // ── Denormalizados + Gestión SITRACK V3 (32-36) ───────
    Nombre_Predio:           nombrePredio,
    Nombre_Servicio:         nombreServicio,
    Gestion_Sitrack:         '',
    FechaHora_Finalizacion:  '',
    Obs_Finalizacion:        '',
  };
  insertRow_(sheet, mov, HEADERS.MOV_TRAFICO);
  logAccion_(usuario.ID_Usuario, 'TRAFICO_' + tipoEvento.toUpperCase(), 'MOV_TRAFICO', id,
    'Tractor: ' + tractor + ' | Servicio: ' + servicioCol, origen);

  var resp = {
    ok:                    true,
    id:                    id,
    tipoEvento:            tipoEvento,
    horasDentro:           horasDentro,
    idViaje:               idViaje || null,
    horasRuta:             viajeInfo ? viajeInfo.horasRuta : null,
    advertenciaSinIngreso: advertenciaSinIngreso,
    pendienteSitrack:      sitrackFalla,
    nombrePredio:          nombrePredio,
    driveOk:               driveOk,
    msg: 'Evento de tráfico registrado.'
       + (idViaje ? (tipoEvento === 'egreso' ? ' Viaje abierto.' : ' Viaje cerrado.') : '')
       + (advertenciaSinIngreso ? ' (Sin ingreso previo registrado.)' : '')
       + (sitrackFalla ? ' Guardado como pendiente SITRACK.' : ''),
  };
  if (sitrackFalla) {
    resp.telefonos = { sitrack: TELEFONO_SITRACK, trafico: TELEFONO_TRAFICO_FALLAS };
  }
  return resp;
}

// ─────────────────────────────────────────────────────────────
// GESTIÓN SITRACK — registrar acción/comentario
// ─────────────────────────────────────────────────────────────

function traficoGestion(payload, usuario) {
  var idMov  = String(payload.idMov  || '').trim();
  var accion = String(payload.accion || '').trim(); // whatsapp_sitrack | whatsapp_trafico | comentario
  var nota   = String(payload.nota   || '').trim();

  if (!idMov || !accion) return { ok: false, error: 'idMov y accion son obligatorios.' };

  var sheet = getSheet_(SHEET_IDS.MOV_TRAFICO, 'MOV_TRAFICO', HEADERS.MOV_TRAFICO);
  var rows  = readAll_(sheet);
  var mov   = findRow_(rows, 'ID_Mov', idMov);
  if (!mov) return { ok: false, error: 'Movimiento no encontrado: ' + idMov };

  var gestion = [];
  try { gestion = JSON.parse(String(mov.Gestion_Sitrack || '[]')); } catch (e) { gestion = []; }
  if (!Array.isArray(gestion)) gestion = [];

  gestion.push({ ts: now_(), accion: accion, usuario: usuario.ID_Usuario, nota: nota });
  mov.Gestion_Sitrack = JSON.stringify(gestion);

  updateRow_(sheet, mov._row, mov, HEADERS.MOV_TRAFICO);
  logAccion_(usuario.ID_Usuario, 'SITRACK_GESTION', 'MOV_TRAFICO', idMov,
    accion + (nota ? ': ' + nota : ''), 'web');
  return { ok: true, gestion: gestion };
}

// ─────────────────────────────────────────────────────────────
// GESTIÓN SITRACK — finalizar registro pendiente
// ─────────────────────────────────────────────────────────────

function traficoFinalizar(payload, usuario) {
  var idMov = String(payload.idMov || '').trim();
  var obs   = String(payload.obs   || '').trim();

  if (!idMov) return { ok: false, error: 'idMov es obligatorio.' };

  var sheet = getSheet_(SHEET_IDS.MOV_TRAFICO, 'MOV_TRAFICO', HEADERS.MOV_TRAFICO);
  var rows  = readAll_(sheet);
  var mov   = findRow_(rows, 'ID_Mov', idMov);
  if (!mov) return { ok: false, error: 'Movimiento no encontrado: ' + idMov };
  if (String(mov.Estado).toLowerCase() !== 'pendiente_sitrack') {
    return { ok: false, error: 'El movimiento no está en estado pendiente_sitrack.' };
  }

  var gestion = [];
  try { gestion = JSON.parse(String(mov.Gestion_Sitrack || '[]')); } catch (e) { gestion = []; }
  if (!Array.isArray(gestion)) gestion = [];
  gestion.push({ ts: now_(), accion: 'finalizacion', usuario: usuario.ID_Usuario, nota: obs });

  mov.Estado                 = 'completo';
  mov.FechaHora_Finalizacion = now_();
  mov.Obs_Finalizacion       = obs;
  mov.Gestion_Sitrack        = JSON.stringify(gestion);

  updateRow_(sheet, mov._row, mov, HEADERS.MOV_TRAFICO);
  logAccion_(usuario.ID_Usuario, 'TRAFICO_FINALIZADO', 'MOV_TRAFICO', idMov,
    'Obs: ' + obs, 'web');
  return { ok: true, id: idMov };
}

// ─────────────────────────────────────────────────────────────
// GESTIÓN SITRACK — listar pendientes accesibles al usuario
// ─────────────────────────────────────────────────────────────

function traficosPendientes(payload, usuario) {
  var sheet = getSheet_(SHEET_IDS.MOV_TRAFICO, 'MOV_TRAFICO', HEADERS.MOV_TRAFICO);
  var rows  = readAll_(sheet);

  var pendientes = rows.filter(function(r) {
    return String(r.Estado).toLowerCase() === 'pendiente_sitrack'
        && puedeOperarPredio_(usuario, r.ID_Predio);
  });

  pendientes.sort(function(a, b) {
    var da = String(a.FechaHora_Ingreso || a.FechaHora_Egreso || '');
    var db = String(b.FechaHora_Ingreso || b.FechaHora_Egreso || '');
    return db.localeCompare(da);
  });

  var clean = pendientes.map(function(r) {
    var o = {};
    for (var k in r) { if (k !== '_row') o[k] = r[k]; }
    return o;
  });

  return {
    ok:        true,
    pendientes: clean,
    telefonos: { sitrack: TELEFONO_SITRACK, trafico: TELEFONO_TRAFICO_FALLAS },
  };
}

// ─────────────────────────────────────────────────────────────
// VIAJES EN RUTA
// ─────────────────────────────────────────────────────────────

function viajesEnRuta(payload, usuario) {
  var sheet = getSheet_(SHEET_IDS.VIAJES, 'VIAJES', HEADERS.VIAJES);
  var rows  = readAll_(sheet);

  var enRuta = rows.filter(function(r) {
    if (String(r.Estado).toLowerCase() !== 'en_ruta') return false;
    return puedeOperarPredio_(usuario, r.Predio_Origen)
        || puedeOperarPredio_(usuario, r.Predio_Destino);
  });

  enRuta.sort(function(a, b) {
    return String(b.FechaHora_Salida).localeCompare(String(a.FechaHora_Salida));
  });

  var clean = enRuta.map(function(r) {
    var o = {};
    for (var k in r) { if (k !== '_row') o[k] = r[k]; }
    o._horasEnRuta = horasEntre_(String(r.FechaHora_Salida), now_());
    return o;
  });

  return { ok: true, viajes: clean };
}

// ─────────────────────────────────────────────────────────────
// HISTORIAL
// ─────────────────────────────────────────────────────────────

function traficoHistorial(payload, usuario) {
  var idPredio = String(payload.idPredio || '').trim();
  var desde    = String(payload.desde    || '').trim();
  var hasta    = String(payload.hasta    || '').trim();

  var sheet = getSheet_(SHEET_IDS.MOV_TRAFICO, 'MOV_TRAFICO', HEADERS.MOV_TRAFICO);
  var rows  = readAll_(sheet);

  rows = rows.filter(function(r) {
    if (!puedeOperarPredio_(usuario, r.ID_Predio)) return false;
    if (idPredio && String(r.ID_Predio).toUpperCase() !== idPredio.toUpperCase()) return false;
    var ts = String(r.FechaHora_Ingreso || r.FechaHora_Egreso || '');
    if (desde && ts < desde) return false;
    if (hasta && ts > hasta + 'T23:59:59') return false;
    return true;
  });

  rows.sort(function(a, b) {
    var da = String(a.FechaHora_Ingreso || a.FechaHora_Egreso || '');
    var db = String(b.FechaHora_Ingreso || b.FechaHora_Egreso || '');
    return db.localeCompare(da);
  });

  var clean = rows.map(function(r) {
    var o = {};
    for (var k in r) { if (k !== '_row') o[k] = r[k]; }
    return o;
  });

  return { ok: true, movimientos: clean };
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD — resumen del estado actual y registros del día
// ─────────────────────────────────────────────────────────────

function getDashboard(payload, usuario) {
  var hoy = Utilities.formatDate(new Date(), ZONA_HORARIA, 'yyyy-MM-dd');

  function limpiar(rows) {
    return rows.map(function(r) {
      var o = {};
      for (var k in r) { if (k !== '_row') o[k] = r[k]; }
      return o;
    });
  }

  // ── Predios (para resolver nombres en viajes) ─────────────
  var prediosSheet = getSheet_(SHEET_IDS.PREDIOS, 'PREDIOS', HEADERS.PREDIOS);
  var prediosRows  = readAll_(prediosSheet);
  function nombrePredio(id) {
    var p = prediosRows.find(function(r) { return String(r.ID_Predio).trim() === String(id).trim(); });
    return p ? String(p.Nombre || '') : String(id || '');
  }

  // ── MOV_TRAFICO ────────────────────────────────────────────
  var trafSheet = getSheet_(SHEET_IDS.MOV_TRAFICO, 'MOV_TRAFICO', HEADERS.MOV_TRAFICO);
  var trafRows  = readAll_(trafSheet);

  var pendientesSitrack = trafRows.filter(function(r) {
    return String(r.Estado).toLowerCase() === 'pendiente_sitrack'
        && puedeOperarPredio_(usuario, r.ID_Predio);
  });
  pendientesSitrack.sort(function(a, b) {
    return String(b.FechaHora_Ingreso || b.FechaHora_Egreso || '').localeCompare(
           String(a.FechaHora_Ingreso || a.FechaHora_Egreso || ''));
  });

  var trafHoy = trafRows.filter(function(r) {
    var ts = String(r.FechaHora_Ingreso || r.FechaHora_Egreso || '');
    return ts.indexOf(hoy) === 0 && puedeOperarPredio_(usuario, r.ID_Predio);
  });
  trafHoy.sort(function(a, b) {
    var ta = String(a.FechaHora_Ingreso || a.FechaHora_Egreso || '');
    var tb = String(b.FechaHora_Ingreso || b.FechaHora_Egreso || '');
    return tb.localeCompare(ta);
  });

  // ── VIAJES EN RUTA ─────────────────────────────────────────
  var viajesSheet = getSheet_(SHEET_IDS.VIAJES, 'VIAJES', HEADERS.VIAJES);
  var viajesRows  = readAll_(viajesSheet);
  var enRuta = viajesRows.filter(function(r) {
    if (String(r.Estado).toLowerCase() !== 'en_ruta') return false;
    return puedeOperarPredio_(usuario, r.Predio_Origen)
        || puedeOperarPredio_(usuario, r.Predio_Destino);
  }).map(function(r) {
    var o = {};
    for (var k in r) { if (k !== '_row') o[k] = r[k]; }
    o._horasEnRuta   = horasEntre_(String(r.FechaHora_Salida), now_());
    o._nombreOrigen  = nombrePredio(r.Predio_Origen);
    o._nombreDestino = nombrePredio(r.Predio_Destino);
    return o;
  });
  enRuta.sort(function(a, b) {
    return String(b.FechaHora_Salida || '').localeCompare(String(a.FechaHora_Salida || ''));
  });

  // ── MOV_DISTRIBUCION ───────────────────────────────────────
  var distSheet = getSheet_(SHEET_IDS.MOV_DISTRIBUCION, 'MOV_DISTRIBUCION', HEADERS.MOV_DISTRIBUCION);
  var distRows  = readAll_(distSheet);

  var distDentro = distRows.filter(function(r) {
    return String(r.Estado).toLowerCase() === 'abierto'
        && puedeOperarPredio_(usuario, r.ID_Predio);
  }).length;

  var distHoy = distRows.filter(function(r) {
    var ts = String(r.FechaHora_Ingreso || '');
    return ts.indexOf(hoy) === 0 && puedeOperarPredio_(usuario, r.ID_Predio);
  });
  distHoy.sort(function(a, b) {
    return String(b.FechaHora_Ingreso || '').localeCompare(String(a.FechaHora_Ingreso || ''));
  });

  // ── MOV_PERSONAL ───────────────────────────────────────────
  var persSheet = getSheet_(SHEET_IDS.MOV_PERSONAL, 'MOV_PERSONAL', HEADERS.MOV_PERSONAL);
  var persRows  = readAll_(persSheet);

  var persAdentro = persRows.filter(function(r) {
    return String(r.Estado).toLowerCase() === 'abierto'
        && puedeOperarPredio_(usuario, r.ID_Predio);
  }).length;

  var persHoy = persRows.filter(function(r) {
    var ts = String(r.FechaHora_Ingreso || '');
    return ts.indexOf(hoy) === 0 && puedeOperarPredio_(usuario, r.ID_Predio);
  });
  persHoy.sort(function(a, b) {
    return String(b.FechaHora_Ingreso || '').localeCompare(String(a.FechaHora_Ingreso || ''));
  });

  return {
    ok:    true,
    fecha: hoy,
    counts: {
      distDentro:  distDentro,
      trafEnRuta:  enRuta.length,
      persAdentro: persAdentro,
    },
    pendientesSitrack: limpiar(pendientesSitrack),
    viajesEnRuta:      enRuta,
    hoy: {
      dist: limpiar(distHoy),
      traf: limpiar(trafHoy),
      pers: limpiar(persHoy),
    },
    telefonos: { sitrack: TELEFONO_SITRACK, trafico: TELEFONO_TRAFICO_FALLAS },
  };
}

// ─────────────────────────────────────────────────────────────
// SETUP — ejecutar UNA SOLA VEZ desde el editor de GAS
// ─────────────────────────────────────────────────────────────

/**
 * Agrega columnas faltantes al final de MOV_TRAFICO. Idempotente.
 * Ejecutar ANTES de usar traficoGestion/traficoFinalizar para que
 * updateRow_ escriba en las columnas correctas.
 * Ejecutar: Ejecutar → setupColumnasMOVTrafico
 */
function setupColumnasMOVTrafico() {
  var ss    = SpreadsheetApp.openById(SHEET_IDS.MOV_TRAFICO);
  var sheet = ss.getSheetByName('MOV_TRAFICO');
  if (!sheet) { Logger.log('⚠️  Hoja MOV_TRAFICO no encontrada.'); return; }

  var lastCol        = sheet.getLastColumn();
  var currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  var expected       = HEADERS.MOV_TRAFICO;

  var faltantes = expected.filter(function(h) { return currentHeaders.indexOf(h) === -1; });
  if (!faltantes.length) {
    Logger.log('✅ MOV_TRAFICO: todas las columnas ya existen (' + expected.length + ').');
    return;
  }

  faltantes.forEach(function(h) {
    var col = sheet.getLastColumn() + 1;
    sheet.getRange(1, col).setValue(h);
  });

  Logger.log('✅ setupColumnasMOVTrafico: columnas agregadas: ' + faltantes.join(', '));
}
