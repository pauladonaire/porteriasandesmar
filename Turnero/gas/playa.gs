// =====================================================================
// PLAYA EN VIVO — cruza MOV_DISTRIBUCION (portería, ingresos abiertos)
// con Turnero (turno asignado) y Control_Carga (fin de carga) de TURNERO_BASE.
// =====================================================================

function getPlayaEnVivo_(deposito) {
  var mapaDeposito = getMapaPrediosDeposito_(); // { ID_Predio: 'MZA'|'BUE' }

  // 1. Ingresos actualmente abiertos en portería (= "en playa ahora")
  var movRows = leerFilasPorHeader_(getMovDistribucionSheet());
  var abiertos = movRows.filter(function(r) {
    var dep = mapaDeposito[String(r.ID_Predio || '').trim()];
    return dep === deposito && String(r.Estado || '').trim().toLowerCase() === 'abierto';
  });

  var hoy = hoyAR_();

  // 2. Turnos del depósito, agrupados por fecha+patente (una unidad puede tener
  // un solo turno por día aunque entre a cargar varias veces ese día)
  var turnosRows = leerFilasPorHeader_(getTurneroSheet(TAB_TURNERO));
  var mapaTurnos = {}; // "fecha|PATENTE" -> { turno, minutos, fletero, box }
  turnosRows.forEach(function(r) {
    if (String(r.Deposito || '').trim().toUpperCase() !== deposito) return;
    var fecha = normalizarFecha_(r.Fecha);
    var pat   = String(r.Patente || '').trim().toUpperCase();
    if (!fecha || !pat) return;
    var min = parseHoraTurnero_(r.Turno);
    mapaTurnos[fecha + '|' + pat] = {
      turno:   minutosAHora_(min),
      minutos: min,
      fletero: String(r.Fletero || '').trim(),
      box:     String(r.Box || '').trim(),
    };
  });

  // 3. Fin de carga cargado por el operario (Control_Carga). Si hay varias
  // entradas para la misma patente/fecha, se usa la última cargada.
  var cargaRows = leerFilasPorHeader_(getTurneroSheet(TAB_CONTROL_CARGA));
  var mapaFinCarga = {}; // "fecha|PATENTE" -> "HH:mm"
  cargaRows.forEach(function(r) {
    if (String(r.Deposito || '').trim().toUpperCase() !== deposito) return;
    var fecha = normalizarFecha_(r.Fecha);
    var pat   = String(r.Patente || '').trim().toUpperCase();
    if (!fecha || !pat) return;
    mapaFinCarga[fecha + '|' + pat] = String(r.Hora_FinCarga || '').trim();
  });

  // 4. Estados manuales (urgente / desestimado) del día, ya vive en TURNERO_BASE
  var estadosMap = leerEstadosPlaya_(deposito);

  var fleteros = abiertos.map(function(r) {
    var fh = parseFechaHoraMovDistribucion_(r.FechaHora_Ingreso);
    var patente = String(r.Dominio || '').trim().toUpperCase();
    var fecha = fh ? fh.fecha : hoy;
    var key = fecha + '|' + patente;
    var t = mapaTurnos[key];

    var nombre = (t && t.fletero) ? t.fletero : String(r.Chofer || '').trim();
    if (!nombre) nombre = patente || String(r.ID_Mov || '');

    var llegada = '';
    if (t && t.minutos !== null && fh) {
      llegada = (fh.minutos <= t.minutos + TOLERANCIA_LLEGADA_MIN) ? 'a tiempo' : 'tarde';
    }

    var estado = estadosMap[nombre] || { urgente: false, desestimado: false };

    return {
      idMov:       r.ID_Mov,
      nombre:      nombre,
      patente:     r.Dominio,
      interno:     r.Interno,
      horaIngreso: fh ? minutosAHora_(fh.minutos) : '',
      turno:       t ? t.turno : '',
      box:         t ? t.box   : '',
      llegada:     llegada, // "a tiempo" | "tarde" | ""
      finCarga:    mapaFinCarga[key] || '',
      urgente:     !!estado.urgente,
      desestimado: !!estado.desestimado,
      predio:      r.ID_Predio,
    };
  });

  return { fleteros: fleteros, hoy: hoy, totalLeidos: movRows.length };
}

/**
 * Todos los turnos asignados de una fecha (por defecto hoy), para el tablero
 * "Turnos del día" de Playa en Vivo. A diferencia de getTurnosPorFecha_ (turnos.gs,
 * que solo lee la tab "Turnero" activa y se usa para editar/liberar), esta función
 * también suma Historico_Turnos — así el tablero sigue mostrando los turnos ya
 * archivados (más de 30 min pasados) durante el resto del día.
 */
function getTurnosDelDiaCompleto_(deposito, fechaStr) {
  var fecha = normalizarFecha_(fechaStr) || hoyAR_();
  var turnos = [];
  function cargar(rows) {
    rows.forEach(function(r) {
      if (String(r.Deposito || '').trim().toUpperCase() !== deposito) return;
      if (normalizarFecha_(r.Fecha) !== fecha) return;
      var min = parseHoraTurnero_(r.Turno);
      turnos.push({
        turno:   minutosAHora_(min),
        minutos: min,
        fletero: String(r.Fletero || '').trim(),
        patente: String(r.Patente || '').trim(),
        box:     String(r.Box || '').trim(),
      });
    });
  }
  cargar(leerFilasPorHeader_(getTurneroSheet(TAB_TURNERO)));
  cargar(leerFilasPorHeader_(getTurneroSheet(TAB_HISTORICO)));
  turnos.sort(function(a, b) { return (a.minutos === null ? 9999 : a.minutos) - (b.minutos === null ? 9999 : b.minutos); });
  return { turnos: turnos, fecha: fecha };
}

/**
 * Registra "fin de carga" para una patente que está actualmente en playa (ingreso
 * abierto en MOV_DISTRIBUCION) en este depósito. Se carga desde una pantalla PÚBLICA
 * (sin login de portería, pensada para celular) — payload.operario es el nombre
 * elegido del desplegable de Operarios_Turnero, no un usuario de sesión. No escribe
 * nada en portería, solo en TURNERO_BASE (Control_Carga).
 */
function registrarFinCarga_(deposito, payload) {
  var patente    = String(payload.patente || '').trim().toUpperCase();
  var operario   = String(payload.operario || payload.usuario || '').trim();
  var comentario = String(payload.comentario || '').trim();
  if (!patente) return err_('Patente requerida');
  if (!operario) return err_('Elegí quién sos en la lista de operarios');

  var mapaDeposito = getMapaPrediosDeposito_();
  var movRows = leerFilasPorHeader_(getMovDistribucionSheet());
  var enPlaya = movRows.some(function(r) {
    return mapaDeposito[String(r.ID_Predio || '').trim()] === deposito
        && String(r.Estado || '').trim().toLowerCase() === 'abierto'
        && String(r.Dominio || '').trim().toUpperCase() === patente;
  });
  if (!enPlaya) return err_('Esa patente no tiene un ingreso abierto en este depósito. Verificá la patente.');

  var sh = getTurneroSheet(TAB_CONTROL_CARGA);
  if (!sh) return err_('Hoja Control_Carga no encontrada');
  var ahora = new Date();
  var horaFmt = Utilities.formatDate(ahora, 'America/Argentina/Buenos_Aires', 'HH:mm');
  var usuario = operario; // se guarda en la columna Usuario, igual que antes
  sh.appendRow([deposito, hoyAR_(), patente, horaFmt, usuario, comentario]);
  return ok_({ registrado: true, patente: patente, hora: horaFmt });
}

function leerEstadosPlaya_(deposito) {
  var sh = getTurneroSheet(TAB_ESTADOS);
  if (!sh) return {};
  var data = sh.getDataRange().getValues();
  var hoy = hoyAR_();
  var map = {};
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var dep = String(row[0] || '').trim().toUpperCase();
    var fec = normalizarFecha_(String(row[1] || ''));
    if (dep !== deposito || fec !== hoy) continue;
    var nom = String(row[2] || '').trim();
    if (!nom) continue;
    map[nom] = {
      urgente:     row[3] === true || String(row[3]).toLowerCase() === 'true',
      desestimado: row[4] === true || String(row[4]).toLowerCase() === 'true',
    };
  }
  return map;
}

function guardarEstadoPlaya_(deposito, nombre, urgente, desestimado) {
  if (!nombre) return err_('Nombre requerido');
  var sh = getTurneroSheet(TAB_ESTADOS);
  if (!sh) return err_('Hoja Estados_Playa no encontrada');
  var data = sh.getDataRange().getValues();
  var hoy = hoyAR_();

  for (var i = 1; i < data.length; i++) {
    var dep = String(data[i][0] || '').trim().toUpperCase();
    var fec = normalizarFecha_(String(data[i][1] || ''));
    var nom = String(data[i][2] || '').trim();
    if (dep === deposito && fec === hoy && nom === nombre) {
      sh.getRange(i + 1, 4).setValue(urgente);
      sh.getRange(i + 1, 5).setValue(desestimado);
      return ok_({ guardado: true });
    }
  }
  sh.appendRow([deposito, hoy, nombre, urgente, desestimado]);
  return ok_({ guardado: true, nuevo: true });
}

// Trigger diario (00:05): limpia Estados_Playa de días anteriores
function resetEstadosPlayaDiario() {
  var sh = getTurneroSheet(TAB_ESTADOS);
  if (!sh) return;
  var data = sh.getDataRange().getValues();
  var hoy = hoyAR_();
  for (var i = data.length - 1; i >= 1; i--) {
    var fec = normalizarFecha_(String(data[i][1] || ''));
    if (fec !== hoy) sh.deleteRow(i + 1);
  }
}

// Trigger horario: mueve turnos pasados de Turnero → Historico_Turnos
function moverTurnosAHistorico() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    var shT = getTurneroSheet(TAB_TURNERO);
    var shH = getTurneroSheet(TAB_HISTORICO);
    if (!shT || !shH) return;
    var data = shT.getDataRange().getDisplayValues(); // texto tal como se ve — si Sheets le puso formato Hora a la columna Turno, getValues() traería un Date y rompería parseHoraTurnero_
    var hoy = hoyAR_();
    var ahora = new Date();
    var minActual = ahora.getHours() * 60 + ahora.getMinutes();

    var filasABorrar = [];
    for (var i = data.length - 1; i >= 1; i--) {
      var row = data[i];
      var dep = String(row[0] || '');
      var fecha = normalizarFecha_(String(row[1] || ''));
      var turno = String(row[2] || '');
      var minT = parseHoraTurnero_(turno);

      var esAnterior = fecha !== '' && fecha !== hoy;
      var esHoyPasado = (fecha === hoy) && (minT !== null) && (minActual - minT > 30);

      if (esAnterior || esHoyPasado) {
        shH.appendRow([dep, row[1], row[2], row[3], row[4], row[6],
                       Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy HH:mm')]);
        filasABorrar.push(i + 1);
      }
    }
    for (var j = 0; j < filasABorrar.length; j++) {
      shT.deleteRow(filasABorrar[j] - j);
    }
  } finally {
    lock.releaseLock();
  }
}
