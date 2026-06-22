// Data.gs — Capa de acceso a datos (DAL) genérica para IngresoPorterias

/**
 * Obtiene (o crea) una hoja dentro de un Spreadsheet.
 * Si la hoja no existe la crea con los headers especificados.
 */
function getSheet_(ssId, sheetName, headers) {
  var ss = SpreadsheetApp.openById(ssId);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length)
           .setFontWeight('bold')
           .setBackground('#003481')
           .setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

/**
 * Lee todas las filas como array de objetos. Cada objeto incluye _row (número de fila 1-indexed).
 */
function readAll_(sheet) {
  var data = sheet.getDataRange().getValues();
  if (!data || data.length <= 1) return [];
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var obj = { _row: i + 1 };
    for (var j = 0; j < headers.length; j++) {
      var val = data[i][j];
      // Convertir fechas de Sheets a string ISO si corresponde
      if (val instanceof Date) {
        val = Utilities.formatDate(val, ZONA_HORARIA, "yyyy-MM-dd'T'HH:mm:ss");
      }
      obj[headers[j]] = val;
    }
    rows.push(obj);
  }
  return rows;
}

/**
 * Agrega una fila nueva al final de la hoja a partir de un objeto.
 */
function insertRow_(sheet, obj, headers) {
  var row = headers.map(function(h) {
    var v = obj[h];
    return (v !== undefined && v !== null) ? v : '';
  });
  sheet.appendRow(row);
}

/**
 * Actualiza una fila existente (rowNum = número de fila, 1-indexed).
 */
function updateRow_(sheet, rowNum, obj, headers) {
  var row = headers.map(function(h) {
    var v = obj[h];
    return (v !== undefined && v !== null) ? v : '';
  });
  sheet.getRange(rowNum, 1, 1, row.length).setValues([row]);
}

/**
 * Busca el primer registro cuyo campo 'field' coincida con 'value' (case-insensitive).
 */
function findRow_(rows, field, value) {
  var target = String(value).trim().toLowerCase();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][field]).trim().toLowerCase() === target) return rows[i];
  }
  return null;
}

/**
 * Devuelve todos los registros cuyo campo 'field' coincida con 'value' (case-insensitive).
 */
function findRows_(rows, field, value) {
  var target = String(value).trim().toLowerCase();
  return rows.filter(function(r) {
    return String(r[field]).trim().toLowerCase() === target;
  });
}

/**
 * Genera el próximo ID correlativo con formato PREFIX-00001.
 * Lee la primera columna de la hoja para encontrar el máximo actual.
 */
function nextId_(sheet, prefix, pad) {
  pad = pad || 5;
  var data = sheet.getDataRange().getValues();
  var max = 0;
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][0]);
    if (id.indexOf(prefix + '-') === 0) {
      var num = parseInt(id.substring(prefix.length + 1), 10);
      if (!isNaN(num) && num > max) max = num;
    }
  }
  var zeros = Array(pad + 1).join('0');
  return prefix + '-' + (zeros + (max + 1)).slice(-pad);
}

/**
 * Retorna el timestamp actual en la zona horaria de Argentina, formato ISO-like.
 */
function now_() {
  return Utilities.formatDate(new Date(), ZONA_HORARIA, "yyyy-MM-dd'T'HH:mm:ss");
}

/**
 * Calcula la diferencia en horas decimales entre dos strings "yyyy-MM-ddTHH:mm:ss".
 * Usa UTC internamente para que la comparación sea correcta independientemente del TZ del servidor.
 */
function horasEntre_(dt1Str, dt2Str) {
  if (!dt1Str || !dt2Str) return 0;
  try {
    var parse = function(s) {
      var m = String(s).match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
      if (!m) return NaN;
      return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    };
    var diff = (parse(dt2Str) - parse(dt1Str)) / 3600000;
    if (isNaN(diff)) return 0;
    return Math.round(diff * 100) / 100;
  } catch (e) {
    return 0;
  }
}

/**
 * Escribe un registro en LOG_AUDITORIA. Nunca rompe la operación principal (try/catch).
 */
function logAccion_(idUsuario, accion, hoja, idRegistro, detalle, origen) {
  try {
    var sheet = getSheet_(SHEET_IDS_EXTRA.LOG_AUDITORIA, 'LOG_AUDITORIA', HEADERS.LOG_AUDITORIA);
    sheet.appendRow([now_(), idUsuario || '', accion || '', hoja || '', idRegistro || '', detalle || '', origen || 'web']);
  } catch (e) {
    // El log nunca rompe la operación principal
  }
}

/**
 * Wrapper para respuesta JSON desde doGet/doPost.
 */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
