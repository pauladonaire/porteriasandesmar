// =====================================================================
// TURNOS — gestión de turnos de carga (Turnero tab en TURNERO_BASE)
// =====================================================================

function getEstadoBoxes_(deposito) {
  var sh   = getTurneroSheet(TAB_BOXES);
  var data = sh.getDataRange().getDisplayValues(); // texto tal como se ve en la celda — evita que una celda con formato Hora se lea como objeto Date y rompa el parseo por ":"
  var boxes = [];
  for (var i = 1; i < data.length; i++) {
    var dep = String(data[i][0] || '').trim().toUpperCase();
    if (dep !== deposito) continue;
    var box    = String(data[i][1] || '').trim();
    var estado = String(data[i][2] || '').trim().toLowerCase();
    if (!box) continue;
    boxes.push({ box: box, habilitado: estado === 'habilitado' });
  }
  // Ordenar por número de box
  boxes.sort(function(a, b) {
    return (parseInt(a.box.replace(/\D/g,'')) || 0) - (parseInt(b.box.replace(/\D/g,'')) || 0);
  });
  return { boxes: boxes };
}

function getHorariosTurno_(deposito) {
  var sh   = getTurneroSheet(TAB_HORARIOS);
  var data = sh.getDataRange().getDisplayValues(); // texto tal como se ve en la celda — evita que una celda con formato Hora se lea como objeto Date y rompa el parseo por ":"
  var horas = [];
  for (var i = 1; i < data.length; i++) {
    var dep = String(data[i][0] || '').trim().toUpperCase();
    if (dep !== deposito) continue;
    var h = String(data[i][1] || '').trim();
    if (!h) continue;
    var min = parseHoraTurnero_(h);
    if (min !== null) horas.push({ texto: minutosAHora_(min), minutos: min });
  }
  horas.sort(function(a, b) { return a.minutos - b.minutos; });
  return { horarios: horas };
}

/**
 * Fleteros = catálogo UNIDADES de portería (ya no Maestro_Fleteros — se sacó de en
 * medio, ver decisión de Paula: "tomemos directamente de unidades porteria"). Por
 * ahora se listan TODAS las unidades activas, sin filtrar por depósito (UNIDADES no
 * tiene ese dato hoy — si en algún momento se agrega un campo de depósito ahí, filtrar acá).
 * Nombre = Chofer_Drivin si está cargado; si no, cae a Transportista y por último a
 * Dominio, para que ninguna unidad quede con el nombre en blanco en el desplegable.
 */
function getFleteros_(deposito) {
  var rows = leerFilasPorHeader_(getUnidadesSheet());
  var lista = [];
  var vistos = {};
  rows.forEach(function(r) {
    var activo = String(r.Activo || '').trim().toUpperCase() !== 'FALSE';
    if (!activo) return;
    var dominio = String(r.Dominio || '').trim().toUpperCase();
    var nombre = String(r.Chofer_Drivin || '').trim() || String(r.Transportista || '').trim() || dominio;
    if (!nombre) return;
    var key = nombre + '|' + dominio;
    if (vistos[key]) return;
    vistos[key] = true;
    lista.push({ nombre: nombre, patente: dominio });
  });
  lista.sort(function(a, b) { return a.nombre.localeCompare(b.nombre); });
  return { fleteros: lista };
}

function getTurnosPorFecha_(deposito, fechaStr) {
  var sh   = getTurneroSheet(TAB_TURNERO);
  var data = sh.getDataRange().getDisplayValues(); // texto tal como se ve en la celda — evita que una celda con formato Hora se lea como objeto Date y rompa el parseo por ":"
  var turnos = [];
  var fechaNorm = normalizarFecha_(fechaStr);
  var mapaTel = getMapaUnidadTelefono_(); // { DOMINIO: Telefono_Drivin } — para el botón de WhatsApp
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var dep  = String(row[0] || '').trim().toUpperCase();
    var fec  = normalizarFecha_(String(row[1] || ''));
    if (dep !== deposito || fec !== fechaNorm) continue;
    var minT = parseHoraTurnero_(String(row[2] || ''));
    var patente = String(row[4] || '').trim();
    turnos.push({
      fila:     i + 1,  // fila real en la hoja (base 1, con encabezado en fila 1)
      turno:    minutosAHora_(minT),
      minutos:  minT,
      fletero:  String(row[3] || '').trim(),
      patente:  patente,
      box:      String(row[6] || '').trim(),
      telefono: mapaTel[patente.toUpperCase()] || '',
    });
  }
  return { turnos: turnos };
}

function asignarTurno_(deposito, payload) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return err_('Sistema ocupado, intentá de nuevo');
  try {
    var fechaStr = payload.fecha;
    var horaStr  = payload.turno;
    var fletero  = String(payload.fletero || '').trim();
    var patente  = String(payload.patente || '').trim();
    var box      = String(payload.box     || '').trim();

    if (!fechaStr || !horaStr || !fletero || !box) return err_('Faltan campos obligatorios');

    // Revalidar box habilitado
    var boxes = getEstadoBoxes_(deposito).boxes;
    var boxOk = boxes.some(function(b) { return b.box === box && b.habilitado; });
    if (!boxOk) return err_('El box ' + box + ' no existe o está inhabilitado');

    // Revalidar choque
    var minNuevo = parseHoraTurnero_(horaStr);
    var existentes = getTurnosPorFecha_(deposito, fechaStr).turnos;
    for (var i = 0; i < existentes.length; i++) {
      var t = existentes[i];
      if (t.minutos === minNuevo && t.box === box) {
        return err_('Ese horario y box ya están ocupados por ' + t.fletero);
      }
    }

    var sh = getTurneroSheet(TAB_TURNERO);
    var horaFmt = minutosAHora_(minNuevo);
    sh.appendRow([deposito, normalizarFecha_(fechaStr), horaFmt, fletero, patente, '', box]);
    return ok_({ asignado: true });
  } finally {
    lock.releaseLock();
  }
}

function editarTurno_(deposito, payload) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return err_('Sistema ocupado, intentá de nuevo');
  try {
    var fila    = parseInt(payload.fila, 10);
    var fletero = String(payload.fletero || '').trim();
    var patente = String(payload.patente || '').trim();
    if (!fila || !fletero) return err_('Datos incompletos para editar');

    var sh = getTurneroSheet(TAB_TURNERO);
    // Solo actualiza Fletero (col D = índice 4) y Patente (col E = índice 5)
    sh.getRange(fila, 4).setValue(fletero);
    sh.getRange(fila, 5).setValue(patente);
    return ok_({ editado: true });
  } finally {
    lock.releaseLock();
  }
}

function liberarTurno_(deposito, fila) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return err_('Sistema ocupado, intentá de nuevo');
  try {
    fila = parseInt(fila, 10);
    if (!fila) return err_('Fila inválida');
    var sh = getTurneroSheet(TAB_TURNERO);
    sh.deleteRow(fila);
    return ok_({ liberado: true });
  } finally {
    lock.releaseLock();
  }
}

// ---- Admin: boxes, horarios y fleteros ----
// Todo lo de acá abajo solo lo debe poder llamar 'admin' (cualquier depósito) o
// 'admin_deposito' (solo el suyo) — el router valida con validarAdminDeposito_
// antes de despachar a estas funciones.

function agregarBox_(deposito, box) {
  box = String(box || '').trim();
  if (!box) return err_('El box es obligatorio');
  var sh   = getTurneroSheet(TAB_BOXES);
  var data = sh.getDataRange().getDisplayValues(); // texto tal como se ve en la celda — evita que una celda con formato Hora se lea como objeto Date y rompa el parseo por ":"
  for (var i = 1; i < data.length; i++) {
    var dep = String(data[i][0] || '').trim().toUpperCase();
    var b   = String(data[i][1] || '').trim();
    if (dep === deposito && b.toLowerCase() === box.toLowerCase()) return err_('Ese box ya existe: ' + box);
  }
  sh.appendRow([deposito, box, 'habilitado']);
  return ok_({ agregado: true, box: box });
}

function quitarBox_(deposito, box) {
  box = String(box || '').trim();
  var sh   = getTurneroSheet(TAB_BOXES);
  var data = sh.getDataRange().getDisplayValues(); // texto tal como se ve en la celda — evita que una celda con formato Hora se lea como objeto Date y rompa el parseo por ":"
  for (var i = data.length - 1; i >= 1; i--) {
    var dep = String(data[i][0] || '').trim().toUpperCase();
    var b   = String(data[i][1] || '').trim();
    if (dep === deposito && b.toLowerCase() === box.toLowerCase()) {
      sh.deleteRow(i + 1);
      return ok_({ quitado: true });
    }
  }
  return err_('Box no encontrado: ' + box);
}

function setEstadoBox_(deposito, box, estado) {
  if (!box || !estado) return err_('Parámetros incompletos');
  var sh   = getTurneroSheet(TAB_BOXES);
  var data = sh.getDataRange().getDisplayValues(); // texto tal como se ve en la celda — evita que una celda con formato Hora se lea como objeto Date y rompa el parseo por ":"
  for (var i = 1; i < data.length; i++) {
    var dep = String(data[i][0] || '').trim().toUpperCase();
    var b   = String(data[i][1] || '').trim();
    if (dep === deposito && b === box) {
      sh.getRange(i + 1, 3).setValue(estado);
      return ok_({ actualizado: true });
    }
  }
  return err_('Box no encontrado: ' + box);
}

function setHorario_(deposito, horario, operacion) {
  if (!horario) return err_('Horario requerido');
  var sh   = getTurneroSheet(TAB_HORARIOS);
  var data = sh.getDataRange().getDisplayValues(); // texto tal como se ve en la celda — evita que una celda con formato Hora se lea como objeto Date y rompa el parseo por ":"
  var min  = parseHoraTurnero_(horario);
  if (min === null) return err_('Formato de horario inválido');
  var fmt  = minutosAHora_(min);

  if (operacion === 'quitar') {
    for (var i = data.length - 1; i >= 1; i--) {
      var dep = String(data[i][0] || '').trim().toUpperCase();
      var h   = String(data[i][1] || '').trim();
      if (dep === deposito && parseHoraTurnero_(h) === min) {
        sh.deleteRow(i + 1);
        return ok_({ quitado: true });
      }
    }
    return err_('Horario no encontrado: ' + fmt);
  }

  // operacion === 'agregar' — verificar que no exista
  for (var j = 1; j < data.length; j++) {
    var dep2 = String(data[j][0] || '').trim().toUpperCase();
    var h2   = String(data[j][1] || '').trim();
    if (dep2 === deposito && parseHoraTurnero_(h2) === min) {
      return err_('Ese horario ya existe: ' + fmt);
    }
  }
  sh.appendRow([deposito, fmt]);
  return ok_({ agregado: true, horario: fmt });
}
