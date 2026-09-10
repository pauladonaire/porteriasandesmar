// =====================================================================
// INDICADORES y TIEMPO DE CARGA
// Fuente real: MOV_DISTRIBUCION (portería, ingreso/egreso) cruzado con
// Turnero + Historico_Turnos (turno asignado, incluye pasados) y
// Control_Carga (fin de carga cargado por OPERACIONES) de TURNERO_BASE.
// =====================================================================

/**
 * Mapa { "fecha|PATENTE": {turno, minutos, fletero, box} } combinando Turnero
 * (turnos de hoy/futuros, aún no archivados) + Historico_Turnos (ya archivados
 * por moverTurnosAHistorico). Necesario porque los turnos pasados desaparecen
 * de la tab Turnero pero Indicadores/Tiempo de Carga histórico igual los necesita.
 */
function getMapaTurnosCompleto_(deposito) {
  var mapa = {};
  function cargar(rows) {
    rows.forEach(function(r) {
      if (String(r.Deposito || '').trim().toUpperCase() !== deposito) return;
      var fecha = normalizarFecha_(r.Fecha);
      var pat   = String(r.Patente || '').trim().toUpperCase();
      if (!fecha || !pat) return;
      var min = parseHoraTurnero_(r.Turno);
      mapa[fecha + '|' + pat] = {
        turno:   minutosAHora_(min),
        minutos: min,
        fletero: String(r.Fletero || '').trim(),
        box:     String(r.Box || '').trim(),
      };
    });
  }
  cargar(leerFilasPorHeader_(getTurneroSheet(TAB_TURNERO)));
  cargar(leerFilasPorHeader_(getTurneroSheet(TAB_HISTORICO)));
  return mapa;
}

/** Mapa { "fecha|PATENTE": "HH:mm" } de fin de carga, todo el histórico de Control_Carga. */
function getMapaFinCargaCompleto_(deposito) {
  var mapa = {};
  leerFilasPorHeader_(getTurneroSheet(TAB_CONTROL_CARGA)).forEach(function(r) {
    if (String(r.Deposito || '').trim().toUpperCase() !== deposito) return;
    var fecha = normalizarFecha_(r.Fecha);
    var pat   = String(r.Patente || '').trim().toUpperCase();
    if (!fecha || !pat) return;
    // si hay varias cargas para la misma patente/fecha, se usa la última
    mapa[fecha + '|' + pat] = String(r.Hora_FinCarga || '').trim();
  });
  return mapa;
}

/**
 * Construye la lista base de "viajes" (una fila de MOV_DISTRIBUCION = un viaje)
 * para un depósito, ya cruzada con turno/fin de carga/tipo de unidad.
 * soloConEgreso=true → solo viajes ya finalizados (para Indicadores histórico).
 */
function construirViajes_(deposito, tipoUnidad, soloConEgreso) {
  var mapaDeposito  = getMapaPrediosDeposito_();
  var mapaTurnos    = getMapaTurnosCompleto_(deposito);
  var mapaFinCarga  = getMapaFinCargaCompleto_(deposito);
  var mapaTipo      = getMapaUnidadTipo_();
  var movRows       = leerFilasPorHeader_(getMovDistribucionSheet());

  var viajes = [];
  movRows.forEach(function(r) {
    var dep = mapaDeposito[String(r.ID_Predio || '').trim()];
    if (dep !== deposito) return;

    var tipo = mapaTipo[String(r.ID_Unidad || '').trim()] || '';
    if (tipoUnidad && tipoUnidad !== 'Todos' && tipo !== tipoUnidad) return;

    var ingresoStr = String(r.FechaHora_Ingreso || '').trim();
    var egresoStr  = String(r.FechaHora_Egreso  || '').trim();
    if (soloConEgreso && !egresoStr) return;

    var fh = parseFechaHoraMovDistribucion_(ingresoStr);
    if (!fh) return; // sin ingreso parseable, no sirve para indicadores

    var patente = String(r.Dominio || '').trim().toUpperCase();
    var key     = fh.fecha + '|' + patente;
    var t       = mapaTurnos[key];
    var finCarga = mapaFinCarga[key] || '';

    var llegada = '';
    if (t && t.minutos !== null) {
      llegada = (fh.minutos <= t.minutos + TOLERANCIA_LLEGADA_MIN) ? 'a tiempo' : 'tarde';
    }

    // Duración total puerta a puerta: usa timestamps completos (soporta cruce de medianoche)
    var minCD = null;
    if (egresoStr) {
      var dIng = new Date(ingresoStr);
      var dEg  = new Date(egresoStr);
      if (!isNaN(dIng.getTime()) && !isNaN(dEg.getTime())) {
        minCD = Math.round((dEg.getTime() - dIng.getTime()) / 60000);
      }
    }

    var minFin = finCarga ? parseHoraTurnero_(finCarga) : null;
    var minCarga   = (minFin !== null) ? (minFin - fh.minutos) : null;
    var minEgMin   = null;
    if (egresoStr) {
      var dEg2 = new Date(egresoStr);
      if (!isNaN(dEg2.getTime())) minEgMin = dEg2.getHours() * 60 + dEg2.getMinutes();
    }
    var minControl = (minFin !== null && minEgMin !== null) ? (minEgMin - minFin) : null;

    viajes.push({
      idMov: r.ID_Mov, fecha: fh.fecha, fletero: (t && t.fletero) ? t.fletero : String(r.Chofer || '').trim(),
      patente: r.Dominio, interno: r.Interno, tipo: tipo,
      turno: t ? t.turno : '', tieneTurno: !!t,
      horaIngreso: minutosAHora_(fh.minutos), finCarga: finCarga,
      horaEgreso: minEgMin !== null ? minutosAHora_(minEgMin) : '',
      llegoATiempo: llegada === 'a tiempo', llegoTarde: llegada === 'tarde',
      minCD: minCD, minCarga: minCarga, minControl: minControl,
      sinFinCarga: !finCarga, enPlaya: !egresoStr,
    });
  });
  return viajes;
}

// ----------- TIEMPO DE CARGA HOY -----------

function getTiempoCargaHoy_(deposito, tipoUnidad) {
  var hoy  = hoyAR_();
  var base = construirViajes_(deposito, tipoUnidad, false)
    .filter(function(v) { return v.fecha === hoy && v.finCarga; });

  var conT = base.filter(function(v) { return v.tieneTurno; });
  var sinT = base.filter(function(v) { return !v.tieneTurno; });

  return {
    conTurno: calcularResumenTC_(conT),
    sinTurno: calcularResumenTC_(sinT),
  };
}

function calcularResumenTC_(lista) {
  if (!lista.length) return { promCarga: null, promControl: null, promCD: null, cantidad: 0, filas: [] };
  var sumC = 0, sumCt = 0, sumCD = 0, cntCt = 0, cntCD = 0;
  lista.forEach(function(e) {
    if (e.minCarga !== null) sumC += e.minCarga;
    if (e.minControl !== null) { sumCt += e.minControl; cntCt++; }
    if (e.minCD !== null) { sumCD += e.minCD; cntCD++; }
  });
  return {
    cantidad:    lista.length,
    promCarga:   lista.length ? Math.round(sumC / lista.length) : null,
    promControl: cntCt ? Math.round(sumCt / cntCt) : null,
    promCD:      cntCD ? Math.round(sumCD / cntCD) : null,
    filas:       lista.slice().sort(function(a, b) { return (b.minCD || 0) - (a.minCD || 0); }),
  };
}

// ----------- TIEMPO DE CARGA HISTÓRICO (para gráficos) -----------

function getTiempoCargaHistorico_(deposito, desde, hasta, tipoUnidad) {
  var desdeMs = desde ? parseFechaAR_(desde).getTime() : 0;
  var hastaMs = hasta ? parseFechaAR_(hasta).getTime() + 86400000 : Date.now();

  var viajes = construirViajes_(deposito, tipoUnidad, false).filter(function(v) {
    if (!v.finCarga) return false;
    try {
      var d = parseFechaAR_(v.fecha).getTime();
      return d >= desdeMs && d <= hastaMs;
    } catch (e) { return false; }
  });

  var porDia = {};
  viajes.forEach(function(v) {
    if (!porDia[v.fecha]) porDia[v.fecha] = { conTurno: [], sinTurno: [] };
    (v.tieneTurno ? porDia[v.fecha].conTurno : porDia[v.fecha].sinTurno).push(v);
  });

  var dias = Object.keys(porDia).sort(function(a, b) {
    return parseFechaAR_(a).getTime() - parseFechaAR_(b).getTime();
  });

  var result = dias.map(function(f) {
    var rCT = calcularResumenTC_(porDia[f].conTurno);
    var rST = calcularResumenTC_(porDia[f].sinTurno);
    return {
      fecha: f,
      conTurnoCarga: rCT.promCarga, conTurnoControl: rCT.promControl,
      sinTurnoCarga: rST.promCarga, sinTurnoControl: rST.promControl,
    };
  });

  return { dias: result };
}

// ----------- INDICADORES (histórico con filtros) -----------

function getIndicadores_(deposito, desde, hasta, tipoUnidad, filtroTurno, filtroFletero, filtroFinCarga) {
  var desdeMs = desde ? parseFechaAR_(desde).getTime() : 0;
  var hastaMs = hasta ? parseFechaAR_(hasta).getTime() + 86400000 : Date.now();

  var viajes = construirViajes_(deposito, tipoUnidad, true).filter(function(v) {
    try {
      var d = parseFechaAR_(v.fecha).getTime();
      if (d < desdeMs || d > hastaMs) return false;
    } catch (e) { return false; }
    if (filtroFletero && filtroFletero !== 'Todos' && v.fletero !== filtroFletero) return false;
    if (filtroTurno === 'Con turno' && !v.tieneTurno) return false;
    if (filtroTurno === 'Sin turno' && v.tieneTurno) return false;
    // filtroFinCarga: 'Con fin de carga' | 'Sin fin de carga' | 'Todos'/vacío
    if (filtroFinCarga === 'Con fin de carga' && v.sinFinCarga) return false;
    if (filtroFinCarga === 'Sin fin de carga' && !v.sinFinCarga) return false;
    return true;
  });

  var total       = viajes.length;
  var conTurnoArr = viajes.filter(function(v) { return v.tieneTurno; });
  var cumplieron  = conTurnoArr.filter(function(v) { return v.llegoATiempo; });
  var tardeArr    = conTurnoArr.filter(function(v) { return v.llegoTarde; });

  var promCD      = promMinutos_(viajes.map(function(v) { return v.minCD; }));
  var promCarga   = promMinutos_(viajes.filter(function(v) { return v.minCarga   !== null; }).map(function(v) { return v.minCarga; }));
  var promControl = promMinutos_(viajes.filter(function(v) { return v.minControl !== null; }).map(function(v) { return v.minControl; }));

  var porFletero = {};
  viajes.forEach(function(v) {
    if (!porFletero[v.fletero]) porFletero[v.fletero] = { nombre: v.fletero, patente: v.patente, viajes: [], minCD: [], minCarga: [], minControl: [] };
    var f = porFletero[v.fletero];
    f.viajes.push(v);
    if (v.minCD      !== null) f.minCD.push(v.minCD);
    if (v.minCarga   !== null) f.minCarga.push(v.minCarga);
    if (v.minControl !== null) f.minControl.push(v.minControl);
  });
  var rankingCD      = buildRanking_(porFletero, 'minCD');
  var rankingCarga   = buildRanking_(porFletero, 'minCarga');
  var rankingControl = buildRanking_(porFletero, 'minControl');

  return {
    total: total,
    conTurno: conTurnoArr.length,
    cumplieron: cumplieron.length,
    tarde: tardeArr.length,
    sinFinCarga: viajes.filter(function(v) { return v.sinFinCarga; }).length,
    promCD: promCD, promCarga: promCarga, promControl: promControl,
    rankingCD: rankingCD, rankingCarga: rankingCarga, rankingControl: rankingControl,
    detalle: viajes,
  };
}

function promMinutos_(arr) {
  arr = arr.filter(function(v) { return v !== null && v !== undefined && !isNaN(v); });
  if (!arr.length) return null;
  return Math.round(arr.reduce(function(a, b) { return a + b; }, 0) / arr.length);
}

function buildRanking_(porFletero, campo) {
  return Object.keys(porFletero).map(function(k) { return porFletero[k]; })
    .map(function(f) {
      return { nombre: f.nombre, patente: f.patente, cantidad: f.viajes.length, promedio: promMinutos_(f[campo]) };
    })
    .filter(function(r) { return r.promedio !== null; })
    .sort(function(a, b) { return b.promedio - a.promedio; });
}
