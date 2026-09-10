// =====================================================================
// ROUTER — doPost principal
// Método: POST, Content-Type: text/plain;charset=utf-8
// Body: JSON { accion, payload, deposito, auth: { email } }
// =====================================================================

function doPost(e) {
  try {
    var body    = JSON.parse(e.postData.contents);
    var accion  = body.accion  || '';
    var payload = body.payload || {};
    var dep     = String(body.deposito || 'MZA').toUpperCase();

    switch (accion) {

      // --- ping (warmup) ---
      case 'ping':
        return ok_({ pong: true, ts: new Date().toISOString() });

      // --- Playa en vivo ---
      case 'getPlayaEnVivo':
        return ok_(getPlayaEnVivo_(dep));
      case 'guardarEstadoPlaya':
        return guardarEstadoPlaya_(dep, payload.nombre, payload.urgente, payload.desestimado);
      case 'registrarFinCarga':
        return registrarFinCarga_(dep, payload);
      case 'getTurnosDelDia':
        return ok_(getTurnosDelDiaCompleto_(dep, payload.fecha));
      case 'getOperariosTurnero': // pública — la usa la pantalla de fin de carga sin login
        return ok_(getOperariosTurnero_(dep));

      // --- Indicadores ---
      case 'getIndicadores':
        return ok_(getIndicadores_(dep, payload.desde, payload.hasta, payload.tipoUnidad, payload.turno, payload.fletero, payload.finCarga));

      // --- Tiempo de carga ---
      case 'getTiempoCargaHoy':
        return ok_(getTiempoCargaHoy_(dep, payload.tipoUnidad));
      case 'getTiempoCargaHistorico':
        return ok_(getTiempoCargaHistorico_(dep, payload.desde, payload.hasta, payload.tipoUnidad));

      // --- Turnos ---
      case 'getEstadoBoxes':
        return ok_(getEstadoBoxes_(dep));
      case 'getHorariosTurno':
        return ok_(getHorariosTurno_(dep));
      case 'getFleteros':
        return ok_(getFleteros_(dep));
      case 'getTurnosPorFecha':
        return ok_(getTurnosPorFecha_(dep, payload.fecha));
      case 'asignarTurno':
        return asignarTurno_(dep, payload);
      case 'editarTurno':
        return editarTurno_(dep, payload);
      case 'liberarTurno':
        return liberarTurno_(dep, payload.fila);

      // --- Admin: boxes, horarios y operarios (solo admin / admin_deposito) ---
      // Fleteros ya NO se administra acá — sale directo de UNIDADES de portería (ver
      // getFleteros_ en turnos.gs), no hace falta alta/edición manual.
      case 'setEstadoBox':
      case 'agregarBox':
      case 'quitarBox':
      case 'setHorario':
      case 'getMaestroOperarios':
      case 'agregarOperario':
      case 'editarOperario':
      case 'setEstadoOperario': {
        var email = body.auth && body.auth.email;
        var chk   = validarAdminDeposito_(email, dep);
        if (!chk.ok) return err_(chk.error);

        switch (accion) {
          case 'setEstadoBox':        return setEstadoBox_(dep, payload.box, payload.estado);
          case 'agregarBox':          return agregarBox_(dep, payload.box);
          case 'quitarBox':           return quitarBox_(dep, payload.box);
          case 'setHorario':          return setHorario_(dep, payload.horario, payload.operacion); // operacion: 'agregar'|'quitar'
          case 'getMaestroOperarios': return ok_(getMaestroOperarios_(dep));
          case 'agregarOperario':     return agregarOperario_(dep, payload);
          case 'editarOperario':      return editarOperario_(dep, payload);
          case 'setEstadoOperario':   return setEstadoOperario_(dep, payload.fila, payload.estado);
        }
      }

      default:
        return err_('Acción no reconocida: ' + accion);
    }
  } catch (ex) {
    return err_('Error interno: ' + ex.message);
  }
}

// GET simple para warmup desde browser (no produce CORS)
function doGet(e) {
  return ContentService.createTextOutput('Turnero GAS OK').setMimeType(ContentService.MimeType.TEXT);
}
