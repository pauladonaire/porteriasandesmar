// =====================================================================
// HELPERS — funciones utilitarias compartidas
// =====================================================================

function getTurneroSheet(nombre) {
  return SpreadsheetApp.openById(TURNERO_BASE_ID).getSheetByName(nombre);
}

function getMovDistribucionSheet() {
  return SpreadsheetApp.openById(PORTERIA_MOV_DISTRIBUCION_ID).getSheetByName(TAB_MOV_DISTRIBUCION);
}

function getPrediosSheet() {
  return SpreadsheetApp.openById(PORTERIA_PREDIOS_ID).getSheetByName(TAB_PREDIOS);
}

function getUnidadesSheet() {
  return SpreadsheetApp.openById(PORTERIA_UNIDADES_ID).getSheetByName(TAB_UNIDADES);
}

function getUsuariosSheet() {
  return SpreadsheetApp.openById(PORTERIA_USUARIOS_ID).getSheetByName(TAB_USUARIOS);
}

/**
 * Valida que el email de la sesión pueda administrar boxes/horarios/fleteros del
 * depósito indicado. 'admin' puede con cualquier depósito; 'admin_deposito' solo
 * con el que tenga cargado en su columna Deposito_Turnero de USUARIOS (portería).
 * Devuelve { ok: true } o { ok: false, error }.
 */
function validarAdminDeposito_(email, deposito) {
  email = String(email || '').trim().toLowerCase();
  if (!email) return { ok: false, error: 'Sesión inválida, volvé a ingresar.' };

  var usuario = leerFilasPorHeader_(getUsuariosSheet()).filter(function(r) {
    return String(r.Email || '').trim().toLowerCase() === email;
  })[0];
  if (!usuario) return { ok: false, error: 'Usuario no encontrado.' };

  var rol = String(usuario.Rol || '').trim().toLowerCase();
  if (rol === ROL_ADMIN_TURNERO) return { ok: true };
  if (rol === ROL_ADMIN_DEPOSITO_TURNERO) {
    var depUsuario = String(usuario.Deposito_Turnero || '').trim().toUpperCase();
    if (!depUsuario || depUsuario !== String(deposito).trim().toUpperCase()) {
      return { ok: false, error: 'No administrás el depósito ' + deposito + '.' };
    }
    if (!depositoTieneTurneroActivo_(depUsuario)) {
      return { ok: false, error: 'Tu depósito (' + depUsuario + ') no tiene ningún predio con Turnero activo.' };
    }
    return { ok: true };
  }
  return { ok: false, error: 'No tenés permiso para administrar boxes, horarios ni fleteros.' };
}

/**
 * true si el depósito (MZA/BUE) tiene al menos un predio con Tiene_Turnero=TRUE.
 * Un admin_deposito asociado a un depósito sin ningún predio activo (ej. quedó
 * cargado en un predio como División Frío, que tiene Deposito_Turnero pero
 * Tiene_Turnero=FALSE) no tiene que poder administrar nada de ese "turnero fantasma".
 */
function depositoTieneTurneroActivo_(deposito) {
  var dep = String(deposito || '').trim().toUpperCase();
  var mapa = getMapaPrediosDeposito_();
  for (var id in mapa) {
    if (mapa[id] === dep) return true;
  }
  return false;
}

/**
 * Mapa { DOMINIO: Telefono_Drivin } del catálogo de UNIDADES de portería, para poder
 * mandarle el turno por WhatsApp al fletero (columnas Chofer_Drivin/Telefono_Drivin,
 * sincronizadas desde Drivin — ver apps-script/Drivin.gs). Solo entran dominios con
 * teléfono cargado.
 */
function getMapaUnidadTelefono_() {
  var rows = leerFilasPorHeader_(getUnidadesSheet());
  var mapa = {};
  rows.forEach(function(r) {
    var dominio = String(r.Dominio || '').trim().toUpperCase();
    var tel = String(r.Telefono_Drivin || '').trim();
    if (dominio && tel) mapa[dominio] = tel;
  });
  return mapa;
}

/** Mapa { ID_Unidad: Tipo } del catálogo de UNIDADES de portería (solo lectura). */
function getMapaUnidadTipo_() {
  var rows = leerFilasPorHeader_(getUnidadesSheet());
  var mapa = {};
  rows.forEach(function(r) {
    var id = String(r.ID_Unidad || '').trim();
    if (id) mapa[id] = String(r.Tipo || '').trim();
  });
  return mapa;
}

/**
 * Lee una hoja completa como array de objetos, indexados por el nombre real
 * de columna (fila 1 = headers) — no por índice fijo. Así, si portería agrega
 * o reordena columnas en MOV_DISTRIBUCION/PREDIOS, esto no se rompe.
 */
function leerFilasPorHeader_(sheet) {
  if (!sheet) return [];
  var data = sheet.getDataRange().getDisplayValues();
  if (!data || data.length < 2) return [];
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) obj[headers[j]] = data[i][j];
    rows.push(obj);
  }
  return rows;
}

/**
 * Mapa { ID_Predio: 'MZA'|'BUE' } a partir de PREDIOS, SOLO para los predios marcados
 * Tiene_Turnero=TRUE (hoy: Tecnicagua y Avellaneda) — Deposito_Turnero es apenas la
 * etiqueta MZA/BUE de esos predios, no un segundo filtro. Un predio con Deposito_Turnero
 * cargado pero Tiene_Turnero=FALSE (ej. División Frío) NO entra al turnero: confirmado
 * con Paula, para no mezclar movimientos de otros predios en la misma playa.
 */
function getMapaPrediosDeposito_() {
  var rows = leerFilasPorHeader_(getPrediosSheet());
  var mapa = {};
  rows.forEach(function(r) {
    var tieneTurnero = String(r.Tiene_Turnero || '').trim().toUpperCase() === 'TRUE';
    if (!tieneTurnero) return;
    var id  = String(r.ID_Predio || '').trim();
    var dep = String(r[COL_PREDIO_DEPOSITO_HEADER] || '').trim().toUpperCase();
    if (id && (dep === 'MZA' || dep === 'BUE')) mapa[id] = dep;
  });
  return mapa;
}

// Parsea hora en formato "HH:mm", "H:mm", "HH:mm:ss", "H:mm a.m.", etc.
// Devuelve minutos desde medianoche o null si no puede
function parseHoraTurnero_(texto) {
  if (!texto) return null;
  var s = String(texto).toLowerCase().replace(/\s+/g, ' ').trim();
  // quitar "a.m." / "p.m." / "am" / "pm"
  var pm = s.indexOf('p') !== -1;
  s = s.replace(/[apm.]+/g, '').trim();
  var partes = s.split(':');
  if (partes.length < 2) return null;
  var h = parseInt(partes[0], 10);
  var m = parseInt(partes[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  if (pm && h !== 12) h += 12;
  if (!pm && h === 12) h = 0;
  return h * 60 + m;
}

function minutosAHora_(min) {
  if (min === null || isNaN(min)) return '';
  var h = Math.floor(min / 60) % 24;
  var m = min % 60;
  return ('0' + h).slice(-2) + ':' + ('0' + m).slice(-2);
}

// Fecha de hoy como "dd/MM/yyyy" en AR timezone
function hoyAR_() {
  return Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy');
}

/**
 * Parsea "FechaHora_Ingreso"/"FechaHora_Egreso" de MOV_DISTRIBUCION (formato
 * "yyyy-MM-ddTHH:mm:ss", ver now_() en apps-script/Data.gs de portería) y
 * devuelve { fecha: "dd/MM/yyyy", minutos: <minutos desde medianoche> } o null.
 */
function parseFechaHoraMovDistribucion_(texto) {
  if (!texto) return null;
  var m = String(texto).match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return {
    fecha:   m[3] + '/' + m[2] + '/' + m[1],
    minutos: parseInt(m[4], 10) * 60 + parseInt(m[5], 10),
  };
}

function generarId_() {
  return 'TRN-' + new Date().getTime() + '-' + Math.floor(Math.random() * 1000);
}

// Respuesta estándar
function ok_(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function err_(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Normaliza distintos formatos de fecha a "dd/MM/yyyy"
function normalizarFecha_(raw) {
  if (!raw) return '';
  raw = String(raw).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    var p = raw.substring(0, 10).split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  try {
    var d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return Utilities.formatDate(d, 'America/Argentina/Buenos_Aires', 'dd/MM/yyyy');
    }
  } catch (e) {}
  return raw;
}

function parseFechaAR_(str) {
  // str puede ser "dd/MM/yyyy" o "yyyy-MM-dd"
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    var p = str.split('/');
    return new Date(p[2], p[1] - 1, p[0]);
  }
  return new Date(str);
}
