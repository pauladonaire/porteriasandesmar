// =====================================================================
// OPERARIOS — lista de operarios de "fin de carga" (tab Operarios_Turnero)
// Estructura: Deposito | Nombre | Estado (Activo/Inactivo)
// getOperariosTurnero_ es de lectura PÚBLICA (la usa la pantalla sin login de
// fin de carga, para el desplegable "Quién sos"). El resto (alta/edición/baja)
// solo lo puede llamar 'admin' o 'admin_deposito' — gateado en router.gs.
// =====================================================================

/** Lista de operarios activos del depósito, para el desplegable de fin de carga. */
function getOperariosTurnero_(deposito) {
  var sh = getTurneroSheet(TAB_OPERARIOS);
  if (!sh) return { operarios: [] };
  var data = sh.getDataRange().getValues();
  var lista = [];
  for (var i = 1; i < data.length; i++) {
    var dep = String(data[i][0] || '').trim().toUpperCase();
    if (dep !== deposito) continue;
    var nombre = String(data[i][1] || '').trim();
    var estado = String(data[i][2] || '').trim().toLowerCase();
    if (!nombre) continue;
    if (estado && estado !== 'activo') continue;
    lista.push({ nombre: nombre });
  }
  lista.sort(function(a, b) { return a.nombre.localeCompare(b.nombre); });
  return { operarios: lista };
}

/** Lista completa (activos e inactivos) para el panel admin. */
function getMaestroOperarios_(deposito) {
  var sh = getTurneroSheet(TAB_OPERARIOS);
  if (!sh) return { operarios: [] };
  var data = sh.getDataRange().getValues();
  var lista = [];
  for (var i = 1; i < data.length; i++) {
    var dep = String(data[i][0] || '').trim().toUpperCase();
    if (dep !== deposito) continue;
    var nombre = String(data[i][1] || '').trim();
    if (!nombre) continue;
    lista.push({ fila: i + 1, nombre: nombre, estado: String(data[i][2] || '').trim() || 'Activo' });
  }
  lista.sort(function(a, b) { return a.nombre.localeCompare(b.nombre); });
  return { operarios: lista };
}

function agregarOperario_(deposito, payload) {
  var nombre = String(payload.nombre || '').trim();
  if (!nombre) return err_('El nombre del operario es obligatorio');
  var sh = getTurneroSheet(TAB_OPERARIOS);
  if (!sh) return err_('Hoja Operarios_Turnero no encontrada');
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var dep = String(data[i][0] || '').trim().toUpperCase();
    var nom = String(data[i][1] || '').trim();
    if (dep === deposito && nom.toLowerCase() === nombre.toLowerCase()) return err_('Ya existe un operario con ese nombre');
  }
  sh.appendRow([deposito, nombre, 'Activo']);
  return ok_({ agregado: true });
}

function editarOperario_(deposito, payload) {
  var fila   = parseInt(payload.fila, 10);
  var nombre = String(payload.nombre || '').trim();
  if (!fila || !nombre) return err_('Datos incompletos');
  var sh = getTurneroSheet(TAB_OPERARIOS);
  sh.getRange(fila, 2).setValue(nombre);
  return ok_({ editado: true });
}

function setEstadoOperario_(deposito, fila, estado) {
  fila = parseInt(fila, 10);
  if (!fila || !estado) return err_('Datos incompletos');
  var sh = getTurneroSheet(TAB_OPERARIOS);
  sh.getRange(fila, 3).setValue(estado);
  return ok_({ actualizado: true });
}
