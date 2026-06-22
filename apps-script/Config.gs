// Config.gs — Constantes globales del proyecto IngresoPorterias
// Zona horaria Argentina (Mendoza, sin DST)
const ZONA_HORARIA = 'America/Argentina/Mendoza';

// IDs de los Google Spreadsheets
const SHEET_IDS = {
  USUARIOS:         '1mThpfj2Uqu15UlSE60ee_17GrtViK0mOgVo4obMT97c',
  PREDIOS:          '1Onvv1yFnH4BohEXNqP9_ROpVktx2Rz_OP4Tb7MErHaQ',
  UNIDADES:         '1lbgRCH6u0r-tHbEvelS6ldlyBXgUtfgZPmgegt40Y2w',
  SERVICIOS:        '1JwBxyg_7apHNyccrKP24qBtjQ-mBL09cw7XGsGKrXxk',
  MOV_DISTRIBUCION: '1DRY6_JfpDadIJfWIiO5wcXsse-veoGrMOEPiGJEYkSw',
  MOV_TRAFICO:      '1aZg1RirUeT38ftbDEnXSZ7fq8JbSfqN-aClleRvlrP8',
  VIAJES:           '1OaXyjrZNj2lw6NkM2xeUNZvKH2RCXAkSA7ebYmVJjlQ',
  MOV_PERSONAL:     '1UulYGCtNgD8IyBxIiRs17qHmf-2vVidmPPYqR7_61mk',
};

// CHOFERES tiene su propio SS con 3 hojas; LOG_AUDITORIA tiene su propio SS
const SHEET_IDS_EXTRA = {
  CHOFERES:      '14b998J_sCKRWKUT2LaRLRtX3oIEqomugo73IsCCWiCg',
  LOG_AUDITORIA: '1hKKkqxvH8I6bebJQu3hVKyyyPQXIdI3b0E5kWLcqntE',
};

// Las 3 hojas dentro del SS de CHOFERES
const CHOFERES_SHEET_NAMES = [
  'Choferes Drivin Distribucion',
  'Choferes Drivin Trafico',
  'Choferes Otros',
];

// Columnas exactas de cada hoja (orden definitivo)
const HEADERS = {
  USUARIOS:         ['ID_Usuario','Nombre_Apellido','Email','Clave_Hash','Rol','Predio_Asignado','Activo','Fecha_Alta'],
  PREDIOS:          ['ID_Predio','Nombre','Provincia','Permite_Clientes','Activo'],
  UNIDADES:         ['ID_Unidad','Tipo','Dominio','Interno','Flota','Transportista','Base_Habitual','QR_URL','Activo'],
  SERVICIOS:        ['ID_Servicio','Codigo','Descripcion','Origen_Zona','Predio_Origen','Predio_Destino','Activo'],
  CHOFERES:         ['ID_CHOFER','Nombre_Apellido','DNI','Empleador','Activo'],
  MOV_DISTRIBUCION: ['ID_Mov','ID_Predio','ID_Unidad','Dominio','Chofer','Sentido_Inicial',
                     'FechaHora_Ingreso','Estado_Carga_Ingreso','Detalle_Carga_Ingreso','Usuario_Ingreso',
                     'FechaHora_Egreso','Estado_Carga_Egreso','Detalle_Carga_Egreso','Usuario_Egreso',
                     'Horas_Dentro','Horas_Fuera','Observaciones','Estado'],
  MOV_TRAFICO:      [
    // ── Originales 1-20 (no reordenar — física ya creada) ──────
    'ID_Mov','ID_Predio','ID_Servicio','Servicio_Otro','Chofer','Tractor','Arrastre',
    'Precintos','Foto_Precintos_URL','Danios_Observaciones','Foto_Danios_URL',
    'Certificado_Cobertura','Tipo_Evento','FechaHora_Ingreso','FechaHora_Egreso',
    'Usuario_Ingreso','Usuario_Egreso','Horas_Dentro','ID_Viaje','Estado',
    // ── Inspección V2 (21-31) ──────────────────────────────────
    'Operador','Estado_Operativo','SITRACK',
    'Cert_Tractor','Cert_Arrastre','Limpieza',
    'Equipamiento','Danos',
    'Foto_Tractor','Foto_Arrastre','Foto_Extra',
    // ── Denormalizados + Gestión SITRACK V3 (32-36) ───────────
    'Nombre_Predio','Nombre_Servicio',
    'Gestion_Sitrack','FechaHora_Finalizacion','Obs_Finalizacion',
  ],
  VIAJES:           ['ID_Viaje','ID_Servicio','Tractor','Arrastre','Chofer','Predio_Origen',
                     'FechaHora_Salida','Usuario_Salida','Predio_Destino','FechaHora_Llegada',
                     'Usuario_Llegada','Horas_Ruta','Estado','Observaciones'],
  MOV_PERSONAL:     ['ID_Mov','ID_Predio','Tipo_Registro','Nombre_Apellido','DNI','Forma_Ingreso',
                     'Matricula','Observaciones','Vigilador','FechaHora_Ingreso','FechaHora_Egreso',
                     'Usuario_Egreso','Horas_Dentro','Estado'],
  LOG_AUDITORIA:    ['Timestamp','ID_Usuario','Accion','Hoja','ID_Registro','Detalle','Origen'],

};

// Prefijos para IDs correlativos
const ID_PREFIJOS = {
  USUARIOS:         'USR',
  PREDIOS:          'PRD',
  UNIDADES:         'UND',
  SERVICIOS:        'SRV',
  CHOFERES:         'CHO',
  MOV_DISTRIBUCION: 'DIS',
  MOV_TRAFICO:      'TRAF',
  VIAJES:           'VJE',
  MOV_PERSONAL:     'PER',
};

// Google Drive — carpeta para fotos de tráfico
// Ejecutar una vez setupInicial() para que GAS tenga acceso
const DRIVE_FOLDER_FOTOS_ID = '1rJBVsEyR2JjjH9v_Nu-Y4yZgOBR41l3z';

// Teléfonos para gestión de fallas SITRACK (formato wa.me: sin + ni espacios)
const TELEFONO_SITRACK        = '5492616139722'; // +54 9 2616 13-9722
const TELEFONO_TRAFICO_FALLAS = '5492616686556'; // +54 9 2616 68-6556

const ROLES = { VIGILADOR: 'vigilador', SUPERVISOR: 'supervisor', ADMIN: 'admin' };
const QR_API_BASE = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=';

// Salt fijo para el hash de claves (no cambiar en producción)
const HASH_SALT = 'IngresoPorterias_AR_2024_s@lt#9x';
