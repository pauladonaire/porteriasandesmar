// =====================================================================
// CONFIGURACIÓN GLOBAL — Turnero GAS
// GAS URL: https://script.google.com/macros/s/AKfycbx2WhuYjHDi3xIRmvZ3nUelAxmZccF7OMnrdlt-mgDNwes25wrz8MJTQfbT9rTpwpII/exec
//
// v2 — corregido: el turnero NO lee un "Registro QR" (no existe). El único dato real
// de ingreso/egreso de portería vive en MOV_DISTRIBUCION. Turno, fin de carga y
// "llegó a tiempo" no existen ahí — se resuelven cruzando con TURNERO_BASE:
//   - Turno asignado       → tab Turnero (Deposito+Fecha+Patente)
//   - Fin de carga         → tab Control_Carga (nueva, la carga un OPERACIONES a mano)
//   - Llegó a tiempo       → lo calcula este GAS comparando hora de ingreso vs. turno
// =====================================================================

// TURNERO_BASE — base propia del turnero
var TURNERO_BASE_ID = '1HpcviiTKbAEqyFy9ybITENsRj-02Bf8yubIWAkZ4saI';

// Portería — sheets de solo lectura (NUNCA se escribe acá)
var PORTERIA_MOV_DISTRIBUCION_ID = '1DRY6_JfpDadIJfWIiO5wcXsse-veoGrMOEPiGJEYkSw';
var PORTERIA_PREDIOS_ID          = '1Onvv1yFnH4BohEXNqP9_ROpVktx2Rz_OP4Tb7MErHaQ';
// Catálogo de unidades — para saber el "Tipo" de unidad (Utilitaria/Chasis/etc.) en
// Indicadores y Tiempo de Carga. NO es un log de movimientos (eso es MOV_DISTRIBUCION).
var PORTERIA_UNIDADES_ID         = '1lbgRCH6u0r-tHbEvelS6ldlyBXgUtfgZPmgegt40Y2w';
// USUARIOS — solo para validar rol/depósito de quien administra boxes/horarios/fleteros
// (admin ve y edita todo; admin_deposito solo su propio depósito). Nunca se escribe acá.
var PORTERIA_USUARIOS_ID         = '1mThpfj2Uqu15UlSE60ee_17GrtViK0mOgVo4obMT97c';

// -------------------------------------------------------
// Nombres de tabs en TURNERO_BASE
// -------------------------------------------------------
var TAB_TURNERO        = 'Turnero';
var TAB_HISTORICO      = 'Historico_Turnos';
var TAB_BOXES          = 'Box_De_Carga'; // ojo: nombre real de la tab tiene "De" con mayúscula
var TAB_HORARIOS       = 'Horarios_Turno';
var TAB_FLETEROS       = 'Maestro_Fleteros'; // YA NO SE USA — los fleteros salen de UNIDADES (portería), ver getFleteros_ en turnos.gs
var TAB_ESTADOS        = 'Estados_Playa';
var TAB_CONFIG         = 'Config_Depositos'; // Declarada pero sin uso: ningún código lee esta hoja hoy — el selector de depósito (MZA/BUE) está fijo en el HTML de cada página, no sale de acá
var TAB_CONTROL_CARGA  = 'Control_Carga'; // NUEVA — fin de carga cargado por OPERACIONES
var TAB_OPERARIOS      = 'Operarios_Turnero'; // NUEVA — Deposito | Nombre | Estado

// -------------------------------------------------------
// Nombres de tabs/sheets en portería (solo lectura)
// -------------------------------------------------------
var TAB_MOV_DISTRIBUCION = 'MOV_DISTRIBUCION'; // confirmado contra apps-script/Config.gs de portería
var TAB_PREDIOS          = 'PREDIOS';          // confirmado contra apps-script/Config.gs de portería
var TAB_UNIDADES         = 'UNIDADES';         // confirmado contra apps-script/Config.gs de portería
var TAB_USUARIOS         = 'USUARIOS';         // confirmado contra apps-script/Config.gs de portería

// Roles de portería con permiso para administrar boxes/horarios/fleteros del Turnero.
// 'admin' administra cualquier depósito; 'admin_deposito' solo el suyo (columna
// Deposito_Turnero de USUARIOS, la misma idea que Deposito_Turnero en PREDIOS).
var ROL_ADMIN_TURNERO           = 'admin';
var ROL_ADMIN_DEPOSITO_TURNERO  = 'admin_deposito';

// -------------------------------------------------------
// ESTRUCTURA — TURNERO_BASE (leídas/escritas por header, no por índice fijo)
// -------------------------------------------------------
// Turnero:            Deposito | Fecha | Turno | Fletero | Patente | Estado | Box
// Historico_Turnos:   Deposito | Fecha | Turno | Fletero | Patente | Box | Fecha_Archivado
// Box_De_Carga:       Deposito | Box | Estado (habilitado/Inhabilitado)
// Horarios_Turno:     Deposito | Horario ("HH:mm")
// Maestro_Fleteros:   Deposito | Nombre | Patente | Estado (Activo/Inactivo)
// Estados_Playa:      Deposito | Fecha | Nombre | urgente | desestimado
// Config_Depositos:   Deposito | Nombre_Display | Activo
// Control_Carga:      Deposito | Fecha | Patente | Hora_FinCarga | Usuario | Comentario ← NUEVA (Comentario opcional)
// Operarios_Turnero:  Deposito | Nombre | Estado (Activo/Inactivo)                      ← NUEVA

// -------------------------------------------------------
// ESTRUCTURA — MOV_DISTRIBUCION (portería, solo lectura, leída por nombre de columna)
// Columnas reales (no tocar ni depender del orden, solo del nombre):
//   ID_Mov, ID_Predio, Nombre_Predio, ID_Unidad, Dominio, Interno, Chofer,
//   Sentido_Inicial, Tipo_Ingreso, FechaHora_Ingreso, Estado_Carga_Ingreso,
//   Detalle_Carga_Ingreso, Usuario_Ingreso, FechaHora_Egreso, Estado_Carga_Egreso,
//   Detalle_Carga_Egreso, Usuario_Egreso, Horas_Dentro, Horas_Fuera, Observaciones, Estado
// -------------------------------------------------------

// -------------------------------------------------------
// ESTRUCTURA — Predios (portería, solo lectura)
//   ID_Predio | Nombre | Provincia | Permite_Clientes | Activo | Tiene_Turnero | Deposito_Turnero
//   Tiene_Turnero (TRUE/FALSE) es el filtro real: solo los predios en TRUE entran al
//   turnero (hoy: Tecnicagua y Avellaneda). Deposito_Turnero es solo la etiqueta MZA/BUE
//   de esos predios — un predio con Deposito_Turnero cargado pero Tiene_Turnero=FALSE
//   (ej. División Frío) NO suma movimientos a ninguna playa. Ver getMapaPrediosDeposito_
//   en helpers.gs. Así el mapeo no depende de memorizar IDs de predio (P001/P006).
// -------------------------------------------------------
var COL_PREDIO_DEPOSITO_HEADER = 'Deposito_Turnero';

// Tolerancia para considerar "llegó a tiempo" (minutos después del horario de turno)
var TOLERANCIA_LLEGADA_MIN = 15;
