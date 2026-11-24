const http = require('http');

const BASE_HOST = '127.0.0.1';
const BASE_PORT = 4000;

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const req = http.request(
      {
        host: BASE_HOST,
        port: BASE_PORT,
        ...options,
        headers: defaultHeaders,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(body);
          } catch (e) {
            json = body;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: json,
            raw: body,
          });
        });
      }
    );

    req.on('error', (err) => reject(err));
    if (data) {
      if (typeof data === 'string' || Buffer.isBuffer(data)) {
        req.write(data);
      } else {
        req.write(JSON.stringify(data));
      }
    }
    req.end();
  });
}

const results = [];

function recordTest(suite, testName, category, status, expected, actual, details, severity = 'INFO') {
  results.push({
    suite,
    testName,
    category,
    status, // 'PASS', 'FAIL', 'WARN', 'BUG'
    expected,
    actual,
    details,
    severity, // 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'
  });
  const symbol = status === 'PASS' ? '✅' : status === 'WARN' ? '⚠️' : '❌';
  console.log(`${symbol} [${suite}] ${testName} -> ${status} (${severity})`);
}

async function runQAAudit() {
  console.log('====================================================');
  console.log('   CENEIN - SENIOR QA COMPREHENSIVE AUDIT SUITE     ');
  console.log('====================================================\n');

  let adminToken = '';
  let testPatientId = '';
  let testAdmissionId = '';

  // ----------------------------------------------------
  // 1. AUTHENTICATION & LOGIN FORM VALIDATIONS
  // ----------------------------------------------------
  console.log('\n--- 1. MODULO AUTENTICACION & LOGIN ---');
  
  // 1.1 Login con credenciales válidas admin
  try {
    const res = await request({ method: 'POST', path: '/api/auth/login' }, { username: 'admin', password: 'admin1234' });
    if (res.status === 200 && res.data.token) {
      adminToken = res.data.token;
      recordTest('Auth', 'Login Admin válido', 'Autenticación', 'PASS', 200, res.status, 'Token JWT obtenido con rol admin');
    } else {
      recordTest('Auth', 'Login Admin válido', 'Autenticación', 'FAIL', 200, res.status, JSON.stringify(res.data), 'CRITICAL');
    }
  } catch (err) {
    recordTest('Auth', 'Login Admin válido', 'Autenticación', 'FAIL', 200, 'ERROR', err.message, 'CRITICAL');
  }

  // 1.2 Login con password incorrecto
  try {
    const res = await request({ method: 'POST', path: '/api/auth/login' }, { username: 'admin', password: 'wrongpassword' });
    if (res.status === 401) {
      recordTest('Auth', 'Login con contraseña errónea', 'Seguridad', 'PASS', 401, res.status, 'Rechazado con 401 Unauthorized');
    } else {
      recordTest('Auth', 'Login con contraseña errónea', 'Seguridad', 'FAIL', 401, res.status, JSON.stringify(res.data), 'HIGH');
    }
  } catch (err) {
    recordTest('Auth', 'Login con contraseña errónea', 'Seguridad', 'FAIL', 401, 'ERROR', err.message, 'HIGH');
  }

  // 1.3 Intento de SQL Injection en Login
  try {
    const res = await request({ method: 'POST', path: '/api/auth/login' }, { username: "' OR '1'='1", password: "' OR '1'='1" });
    if (res.status === 400 || res.status === 401) {
      recordTest('Auth', 'SQL Injection en credenciales', 'Seguridad', 'PASS', '400/401', res.status, 'Inyección bloqueada con éxito');
    } else {
      recordTest('Auth', 'SQL Injection en credenciales', 'Seguridad', 'FAIL', '400/401', res.status, JSON.stringify(res.data), 'CRITICAL');
    }
  } catch (err) {
    recordTest('Auth', 'SQL Injection en credenciales', 'Seguridad', 'FAIL', '400/401', 'ERROR', err.message, 'CRITICAL');
  }

  // 1.4 Acceso a rutas protegidas sin Token
  try {
    const res = await request({ method: 'GET', path: '/api/users' });
    if (res.status === 401 || res.status === 403) {
      recordTest('Auth', 'Ruta protegida sin Token (/api/users)', 'Seguridad / RBAC', 'PASS', '401/403', res.status, 'Acceso denegado sin header Authorization');
    } else {
      recordTest('Auth', 'Ruta protegida sin Token (/api/users)', 'Seguridad / RBAC', 'FAIL', '401/403', res.status, JSON.stringify(res.data), 'CRITICAL');
    }
  } catch (err) {
    recordTest('Auth', 'Ruta protegida sin Token (/api/users)', 'Seguridad / RBAC', 'FAIL', '401/403', 'ERROR', err.message, 'CRITICAL');
  }

  // ----------------------------------------------------
  // 2. GESTION DE USUARIOS (CRUD & ROLES)
  // ----------------------------------------------------
  console.log('\n--- 2. MODULO USUARIOS & SEGURIDAD ---');
  const getAuthHeaders = () => ({
    Authorization: `Bearer ${adminToken}`,
    Cookie: `cenein_auth=${adminToken}`,
  });

  // 2.1 Crear usuario con contraseña débil (< 8 chars)
  try {
    const res = await request(
      { method: 'POST', path: '/api/users', headers: getAuthHeaders() },
      { username: 'qa_user_test', password: '123', isAdmin: false }
    );
    if (res.status === 400) {
      recordTest('Usuarios', 'Validación de password débil (<8 chars)', 'Validación', 'PASS', 400, res.status, 'Rechazado: password requiere mínimo 8 caracteres');
    } else {
      recordTest('Usuarios', 'Validación de password débil (<8 chars)', 'Validación', 'FAIL', 400, res.status, JSON.stringify(res.data), 'HIGH');
    }
  } catch (err) {
    recordTest('Usuarios', 'Validación de password débil (<8 chars)', 'Validación', 'FAIL', 400, 'ERROR', err.message, 'HIGH');
  }

  // 2.2 Crear usuario válido
  let testUserId = null;
  const uniqueUsername = `qa_tester_${Date.now().toString().slice(-4)}`;
  try {
    const res = await request(
      { method: 'POST', path: '/api/users', headers: getAuthHeaders() },
      { username: uniqueUsername, password: 'StrongPassword123!', isAdmin: false }
    );
    if (res.status === 201 && res.data.id) {
      testUserId = res.data.id;
      recordTest('Usuarios', 'Crear usuario estándar válido', 'Funcional', 'PASS', 201, res.status, `Usuario creado con ID ${testUserId}`);
    } else {
      recordTest('Usuarios', 'Crear usuario estándar válido', 'Funcional', 'FAIL', 201, res.status, JSON.stringify(res.data), 'HIGH');
    }
  } catch (err) {
    recordTest('Usuarios', 'Crear usuario estándar válido', 'Funcional', 'FAIL', 201, 'ERROR', err.message, 'HIGH');
  }

  // 2.3 Registro de actividad / Logs de auditoría
  try {
    const res = await request({ method: 'GET', path: '/api/users/activity', headers: getAuthHeaders() });
    if (res.status === 200 && Array.isArray(res.data)) {
      recordTest('Usuarios', 'Listar Historial de Actividad', 'Auditoría', 'PASS', 200, res.status, `${res.data.length} eventos de auditoría registrados`);
    } else {
      recordTest('Usuarios', 'Listar Historial de Actividad', 'Auditoría', 'FAIL', 200, res.status, JSON.stringify(res.data), 'MEDIUM');
    }
  } catch (err) {
    recordTest('Usuarios', 'Listar Historial de Actividad', 'Auditoría', 'FAIL', 200, 'ERROR', err.message, 'MEDIUM');
  }

  // ----------------------------------------------------
  // 3. MODULO ALTA DE PACIENTES & FORMULARIOS
  // ----------------------------------------------------
  console.log('\n--- 3. MODULO PACIENTES: ALTA & VALIDACIONES ---');

  // 3.1 Nombre y Apellido vacíos
  try {
    const res = await request(
      { method: 'POST', path: '/api/patients', headers: getAuthHeaders() },
      { nombre: '', apellido: '', fechaNacimiento: '2015-05-10', dni: '40111222' }
    );
    if (res.status === 400) {
      recordTest('Pacientes', 'Validación campos requeridos (Nombre vacío)', 'Validación', 'PASS', 400, res.status, 'Bloqueado con 400 Nombre requerido');
    } else {
      recordTest('Pacientes', 'Validación campos requeridos (Nombre vacío)', 'Validación', 'FAIL', 400, res.status, JSON.stringify(res.data), 'HIGH');
    }
  } catch (err) {
    recordTest('Pacientes', 'Validación campos requeridos (Nombre vacío)', 'Validación', 'FAIL', 400, 'ERROR', err.message, 'HIGH');
  }

  // 3.2 Fecha de nacimiento inválida o futura
  try {
    const res = await request(
      { method: 'POST', path: '/api/patients', headers: getAuthHeaders() },
      { nombre: 'Test', apellido: 'QA', fechaNacimiento: 'fecha-invalida', dni: '40111222' }
    );
    if (res.status === 400) {
      recordTest('Pacientes', 'Validación Fecha Nacimiento errónea', 'Validación', 'PASS', 400, res.status, 'Bloqueado con 400 Formato fecha');
    } else {
      recordTest('Pacientes', 'Validación Fecha Nacimiento errónea', 'Validación', 'FAIL', 400, res.status, JSON.stringify(res.data), 'HIGH');
    }
  } catch (err) {
    recordTest('Pacientes', 'Validación Fecha Nacimiento errónea', 'Validación', 'FAIL', 400, 'ERROR', err.message, 'HIGH');
  }

  // 3.3 DNI inválido (letras o longitud excesiva)
  try {
    const res = await request(
      { method: 'POST', path: '/api/patients', headers: getAuthHeaders() },
      { nombre: 'Test', apellido: 'QA', fechaNacimiento: '2015-05-10', dni: 'ABCD123456789' }
    );
    if (res.status === 400) {
      recordTest('Pacientes', 'Validación DNI no numérico / excesivo', 'Validación', 'PASS', 400, res.status, 'Bloqueado con 400 DNI inválido');
    } else {
      recordTest('Pacientes', 'Validación DNI no numérico / excesivo', 'Validación', 'FAIL', 400, res.status, JSON.stringify(res.data), 'HIGH');
    }
  } catch (err) {
    recordTest('Pacientes', 'Validación DNI no numérico / excesivo', 'Validación', 'FAIL', 400, 'ERROR', err.message, 'HIGH');
  }

  // 3.4 Alta de Paciente Válido Completo (Filiación, Módulos, Controles)
  const testDni = `88${Math.floor(100000 + Math.random() * 900000)}`;
  testPatientId = `p-qa-${Date.now()}`;
  try {
    const res = await request(
      { method: 'POST', path: '/api/patients', headers: getAuthHeaders() },
      {
        id: testPatientId,
        nombre: 'Mateo',
        apellido: 'TestQA',
        fechaNacimiento: '2016-04-15',
        dni: testDni,
        cuit: '20-40123456-9',
        obraSocial: 'GALENO',
        diagnostico: 'Trastorno Específico del Lenguaje (TEL)',
        modulo: ['MII', 'MIS'],
        padreTutor: 'Roberto TestQA',
        telefonoPadreTutor: '+54 9 11 4455-6677',
        madreTutora: 'Lucia Gomez',
        telefonoMadreTutora: '1122334455',
        calle: 'Av. Corrientes',
        numeracion: '1234',
        barrio: 'Almagro',
        piso: '4B',
        sector: 'A',
        escuela: 'Escuela Normal N° 1',
        anioGrado: '4to Grado',
        turnoEscolar: 'manana',
        carAnios: ['2026', '2027'],
        ppiAnios: ['2026'],
        actaAcuerdoAnios: ['2026'],
        ultimoControlFisiatrico: '2026-01-10',
        fechaAltaControlFisiatrico: '2026-01-15',
        fechaVencimientoControlFisiatrico: '2026-07-15',
        ultimoControlTrabajoSocial: '2026-02-01',
        fechaAltaControlTrabajoSocial: '2026-02-05',
        fechaVencimientoControlTrabajoSocial: '2026-08-05',
        autorizadoDesde: '2026-01-01',
        autorizadoHasta: '2026-12-31',
        tratamientos: ['Fonoaudiologia', 'Psicologia'],
      }
    );
    if (res.status === 200 || res.status === 201) {
      recordTest('Pacientes', 'Alta completa de paciente con todos los campos clínicos', 'Funcional', 'PASS', '200/201', res.status, `Paciente ${testPatientId} creado correctamente`);
    } else {
      recordTest('Pacientes', 'Alta completa de paciente con todos los campos clínicos', 'Funcional', 'FAIL', '200/201', res.status, JSON.stringify(res.data), 'CRITICAL');
    }
  } catch (err) {
    recordTest('Pacientes', 'Alta completa de paciente con todos los campos clínicos', 'Funcional', 'FAIL', '200/201', 'ERROR', err.message, 'CRITICAL');
  }

  // 3.5 DNI Duplicado (Integridad Referencial)
  try {
    const res = await request(
      { method: 'POST', path: '/api/patients', headers: getAuthHeaders() },
      {
        nombre: 'Duplicado',
        apellido: 'Test',
        fechaNacimiento: '2016-01-01',
        dni: testDni, // Mismo DNI
      }
    );
    if (res.status === 409) {
      recordTest('Pacientes', 'Control de DNI Duplicado', 'Integridad', 'PASS', 409, res.status, 'Conflicto 409: Ya existe paciente con ese DNI');
    } else {
      recordTest('Pacientes', 'Control de DNI Duplicado', 'Integridad', 'FAIL', 409, res.status, JSON.stringify(res.data), 'HIGH');
    }
  } catch (err) {
    recordTest('Pacientes', 'Control de DNI Duplicado', 'Integridad', 'FAIL', 409, 'ERROR', err.message, 'HIGH');
  }

  // ----------------------------------------------------
  // 4. DETALLE DE PACIENTE, EDICIÓN & SOLICITUDES
  // ----------------------------------------------------
  console.log('\n--- 4. MODULO DETALLE DE PACIENTE & SOLICITUDES ---');

  // 4.1 Obtener detalle de paciente existente
  try {
    const res = await request({ method: 'GET', path: `/api/patients/${testPatientId}`, headers: getAuthHeaders() });
    if (res.status === 200 && res.data.id === testPatientId) {
      recordTest('Ficha Paciente', 'Lectura de ficha completa', 'Funcional', 'PASS', 200, res.status, `Datos cargados: ${res.data.nombre} ${res.data.apellido}`);
    } else {
      recordTest('Ficha Paciente', 'Lectura de ficha completa', 'Funcional', 'FAIL', 200, res.status, JSON.stringify(res.data), 'CRITICAL');
    }
  } catch (err) {
    recordTest('Ficha Paciente', 'Lectura de ficha completa', 'Funcional', 'FAIL', 200, 'ERROR', err.message, 'CRITICAL');
  }

  // 4.2 Guardar Solicitud de Cobertura
  try {
    const res = await request(
      { method: 'POST', path: `/api/patients/${testPatientId}/requests`, headers: getAuthHeaders() },
      {
        fechaInicio: '2026-03-01',
        fechaFin: '2026-08-31',
        tratamientos: ['Fonoaudiologia', 'Psicologia'],
        aplicarTratamientos: true,
      }
    );
    if (res.status === 200 || res.status === 201) {
      recordTest('Ficha Paciente', 'Carga de Solicitud de Cobertura', 'Funcional', 'PASS', '200/201', res.status, 'Solicitud de período guardada correctamente');
    } else {
      recordTest('Ficha Paciente', 'Carga de Solicitud de Cobertura', 'Funcional', 'FAIL', '200/201', res.status, JSON.stringify(res.data), 'HIGH');
    }
  } catch (err) {
    recordTest('Ficha Paciente', 'Carga de Solicitud de Cobertura', 'Funcional', 'FAIL', '200/201', 'ERROR', err.message, 'HIGH');
  }

  // 4.3 Validación de Solicitud con Fecha Fin < Fecha Inicio
  try {
    const res = await request(
      { method: 'POST', path: `/api/patients/${testPatientId}/requests`, headers: getAuthHeaders() },
      {
        fechaInicio: '2026-08-01',
        fechaFin: '2026-03-01', // Anterior
        tratamientos: ['Fonoaudiologia'],
      }
    );
    if (res.status === 400) {
      recordTest('Ficha Paciente', 'Validación fechas de Solicitud (Fin < Inicio)', 'Validación', 'PASS', 400, res.status, 'Rechazado correctamente: fecha fin no puede ser anterior');
    } else {
      recordTest('Ficha Paciente', 'Validación fechas de Solicitud (Fin < Inicio)', 'Validación', 'WARN', 400, res.status, 'Backend debería rechazar cuando fin < inicio', 'MEDIUM');
    }
  } catch (err) {
    recordTest('Ficha Paciente', 'Validación fechas de Solicitud (Fin < Inicio)', 'Validación', 'FAIL', 400, 'ERROR', err.message, 'MEDIUM');
  }

  // 4.4 Cambio de Estado Operativo (Máquina de Estados)
  try {
    const res = await request(
      { method: 'POST', path: `/api/patients/${testPatientId}/state`, headers: getAuthHeaders() },
      { newStateName: 'En_admision' }
    );
    if (res.status === 200) {
      recordTest('Ficha Paciente', 'Transición de Estado Operativo (Nuevo -> En_admision)', 'Máquina de Estados', 'PASS', 200, res.status, 'Estado cambiado a En_admision');
    } else {
      recordTest('Ficha Paciente', 'Transición de Estado Operativo (Nuevo -> En_admision)', 'Máquina de Estados', 'FAIL', 200, res.status, JSON.stringify(res.data), 'HIGH');
    }
  } catch (err) {
    recordTest('Ficha Paciente', 'Transición de Estado Operativo (Nuevo -> En_admision)', 'Máquina de Estados', 'FAIL', 200, 'ERROR', err.message, 'HIGH');
  }

  // 4.5 Desestimar Paciente con Motivo
  try {
    const res = await request(
      { method: 'POST', path: `/api/patients/${testPatientId}/state`, headers: getAuthHeaders() },
      { newStateName: 'Desestimado', reason: 'Falta CUD vigente' }
    );
    if (res.status === 200) {
      recordTest('Ficha Paciente', 'Desestimar paciente con motivo', 'Máquina de Estados', 'PASS', 200, res.status, 'Estado cambiado a Desestimado con log');
    } else {
      recordTest('Ficha Paciente', 'Desestimar paciente con motivo', 'Máquina de Estados', 'FAIL', 200, res.status, JSON.stringify(res.data), 'MEDIUM');
    }
  } catch (err) {
    recordTest('Ficha Paciente', 'Desestimar paciente con motivo', 'Máquina de Estados', 'FAIL', 200, 'ERROR', err.message, 'MEDIUM');
  }

  // ----------------------------------------------------
  // 5. MODULO DE ADMISION (ETAPAS 1, 2 Y 3)
  // ----------------------------------------------------
  console.log('\n--- 5. MODULO ADMISION (3 ETAPAS) ---');

  // 5.1 Admisión Etapa 1: Menor de 3 años (Regla de negocio)
  try {
    const res = await request(
      { method: 'POST', path: '/api/admisiones', headers: getAuthHeaders() },
      {
        nombre: 'Bebe',
        apellido: 'Test',
        fechaNacimiento: '2025-01-01', // 1 año
        dni: '55111222',
        tieneObraSocial: false,
      }
    );
    if (res.status === 400 && String(res.data?.error || '').includes('3 años')) {
      recordTest('Admisión', 'Regla de negocio: Edad mínima 3 años', 'Validación Clínica', 'PASS', 400, res.status, 'Rechazado: menor de 3 años');
    } else {
      recordTest('Admisión', 'Regla de negocio: Edad mínima 3 años', 'Validación Clínica', 'FAIL', 400, res.status, JSON.stringify(res.data), 'HIGH');
    }
  } catch (err) {
    recordTest('Admisión', 'Regla de negocio: Edad mínima 3 años', 'Validación Clínica', 'FAIL', 400, 'ERROR', err.message, 'HIGH');
  }

  // 5.2 Admisión Etapa 1: Mayor de 18 años (Regla de negocio)
  try {
    const res = await request(
      { method: 'POST', path: '/api/admisiones', headers: getAuthHeaders() },
      {
        nombre: 'Adulto',
        apellido: 'Test',
        fechaNacimiento: '2000-01-01', // 26 años
        dni: '35111222',
        tieneObraSocial: false,
      }
    );
    if (res.status === 400 && String(res.data?.error || '').includes('18 años')) {
      recordTest('Admisión', 'Regla de negocio: Edad máxima 18 años', 'Validación Clínica', 'PASS', 400, res.status, 'Rechazado: mayor de 18 años');
    } else {
      recordTest('Admisión', 'Regla de negocio: Edad máxima 18 años', 'Validación Clínica', 'FAIL', 400, res.status, JSON.stringify(res.data), 'HIGH');
    }
  } catch (err) {
    recordTest('Admisión', 'Regla de negocio: Edad máxima 18 años', 'Validación Clínica', 'FAIL', 400, 'ERROR', err.message, 'HIGH');
  }

  // 5.3 Admisión Etapa 1: Creación Válida
  try {
    const res = await request(
      { method: 'POST', path: '/api/admisiones', headers: getAuthHeaders() },
      {
        nombre: 'Lucas',
        apellido: 'Fernandez',
        fechaNacimiento: '2017-06-10', // 9 años
        dni: '48999888',
        telefono: '1155667788',
        domicilio: 'Calle Falsa 123',
        tieneObraSocial: true,
        obraSocialNombre: 'OSDEPYM',
        tieneCUD: true,
      }
    );
    if (res.status === 201 && res.data.id) {
      testAdmissionId = res.data.id;
      recordTest('Admisión', 'Etapa 1: Registro inicial de admisión', 'Funcional', 'PASS', 201, res.status, `Admisión creada con ID ${testAdmissionId}`);
    } else {
      recordTest('Admisión', 'Etapa 1: Registro inicial de admisión', 'Funcional', 'FAIL', 201, res.status, JSON.stringify(res.data), 'CRITICAL');
    }
  } catch (err) {
    recordTest('Admisión', 'Etapa 1: Registro inicial de admisión', 'Funcional', 'FAIL', 201, 'ERROR', err.message, 'CRITICAL');
  }

  // 5.4 Admisión Etapa 2: Revisión de la Fisiatra
  if (testAdmissionId) {
    try {
      const res = await request(
        { method: 'POST', path: `/api/admisiones/${testAdmissionId}/revision`, headers: getAuthHeaders() },
        {
          fechaTurno: '2026-03-10',
          resultado: 'aprobado',
          devolucion: 'Paciente apto para tratamiento integral MII',
          reviewedBy: 'Dra. Gomez Fisiatra',
        }
      );
      if (res.status === 200 || res.status === 201) {
        recordTest('Admisión', 'Etapa 2: Revisión y Aprobación de Fisiatría', 'Funcional', 'PASS', '200/201', res.status, 'Revisión médica asentada y aprobada');
      } else {
        recordTest('Admisión', 'Etapa 2: Revisión y Aprobación de Fisiatría', 'Funcional', 'FAIL', '200/201', res.status, JSON.stringify(res.data), 'HIGH');
      }
    } catch (err) {
      recordTest('Admisión', 'Etapa 2: Revisión y Aprobación de Fisiatría', 'Funcional', 'FAIL', '200/201', 'ERROR', err.message, 'HIGH');
    }
  }

  // ----------------------------------------------------
  // 6. MODULO ASISTENCIAS & REPORTES
  // ----------------------------------------------------
  console.log('\n--- 6. MODULO ASISTENCIAS & ASISTENCIAS EXPORT ---');

  // 6.1 Registro de asistencia válido
  try {
    const res = await request(
      { method: 'POST', path: `/api/patients/${testPatientId}/attendances`, headers: getAuthHeaders() },
      {
        fecha: '2026-03-02',
        tratamiento: 'Psicologia',
        nota: 'Asistencia normal en consultorio',
      }
    );
    if (res.status === 200 || res.status === 201) {
      recordTest('Asistencias', 'Registro diario de asistencia de paciente', 'Funcional', 'PASS', '200/201', res.status, 'Asistencia registrada con éxito');
    } else {
      recordTest('Asistencias', 'Registro diario de asistencia de paciente', 'Funcional', 'FAIL', '200/201', res.status, JSON.stringify(res.data), 'HIGH');
    }
  } catch (err) {
    recordTest('Asistencias', 'Registro diario de asistencia de paciente', 'Funcional', 'FAIL', '200/201', 'ERROR', err.message, 'HIGH');
  }

  // 6.2 Registro de asistencia con paciente inexistente
  try {
    const res = await request(
      { method: 'POST', path: '/api/patients/paciente_inexistente_9999/attendances', headers: getAuthHeaders() },
      {
        fecha: '2026-03-02',
        tratamiento: 'Psicologia',
      }
    );
    if (res.status === 404 || res.status === 400) {
      recordTest('Asistencias', 'Asistencia para paciente inexistente', 'Integridad', 'PASS', '404/400', res.status, 'Bloqueado: paciente no encontrado');
    } else {
      recordTest('Asistencias', 'Asistencia para paciente inexistente', 'Integridad', 'WARN', '404/400', res.status, 'Debería validar existencia antes de insertar', 'MEDIUM');
    }
  } catch (err) {
    recordTest('Asistencias', 'Asistencia para paciente inexistente', 'Integridad', 'FAIL', '404/400', 'ERROR', err.message, 'MEDIUM');
  }

  // 6.3 Exportación de Asistencias a Excel
  try {
    const res = await request(
      { method: 'GET', path: '/api/attendances/export/excel?month=3&year=2026', headers: getAuthHeaders() }
    );
    if (res.status === 200) {
      recordTest('Asistencias', 'Exportación de Asistencias a Excel (.xlsx)', 'Reportes', 'PASS', 200, res.status, 'Archivo Excel generado y descargable');
    } else {
      recordTest('Asistencias', 'Exportación de Asistencias a Excel (.xlsx)', 'Reportes', 'WARN', 200, res.status, JSON.stringify(res.data), 'LOW');
    }
  } catch (err) {
    recordTest('Asistencias', 'Exportación de Asistencias a Excel (.xlsx)', 'Reportes', 'FAIL', 200, 'ERROR', err.message, 'LOW');
  }

  // ----------------------------------------------------
  // 7. MODULO OBRAS SOCIALES & GENERADOR PDF
  // ----------------------------------------------------
  console.log('\n--- 7. MODULO OBRAS SOCIALES & PDF ---');

  // 7.1 Catálogo de Obras Sociales
  try {
    const res = await request({ method: 'GET', path: '/api/obras-sociales', headers: getAuthHeaders() });
    if (res.status === 200 && Array.isArray(res.data)) {
      recordTest('Obras Sociales', 'Catálogo de obras sociales con plantillas', 'Funcional', 'PASS', 200, res.status, `${res.data.length} obras sociales catalogadas`);
    } else {
      recordTest('Obras Sociales', 'Catálogo de obras sociales con plantillas', 'Funcional', 'FAIL', 200, res.status, JSON.stringify(res.data), 'HIGH');
    }
  } catch (err) {
    recordTest('Obras Sociales', 'Catálogo de obras sociales con plantillas', 'Funcional', 'FAIL', 200, 'ERROR', err.message, 'HIGH');
  }

  // 7.2 Generación de PDF para Obra Social GALENO
  try {
    const res = await request(
      {
        method: 'GET',
        path: `/api/patients/${testPatientId}/obras-sociales/GALENO-30522428163?tratamiento=Psicologia&mes=3&anio=2026`,
        headers: getAuthHeaders(),
      }
    );
    if (res.status === 200 && String(res.headers['content-type'] || '').includes('pdf')) {
      recordTest('Obras Sociales', 'Generación y llenado de PDF oficial (GALENO)', 'Reportes PDF', 'PASS', 200, res.status, 'PDF generado con campos mapeados');
    } else {
      recordTest('Obras Sociales', 'Generación y llenado de PDF oficial (GALENO)', 'Reportes PDF', 'FAIL', 200, res.status, JSON.stringify(res.data), 'MEDIUM');
    }
  } catch (err) {
    recordTest('Obras Sociales', 'Generación y llenado de PDF oficial (GALENO)', 'Reportes PDF', 'FAIL', 200, 'ERROR', err.message, 'MEDIUM');
  }

  // Limpieza de datos de prueba
  if (testPatientId) {
    await request({ method: 'DELETE', path: `/api/patients/${testPatientId}`, headers: getAuthHeaders() }).catch(() => {});
  }
  if (testUserId) {
    await request({ method: 'DELETE', path: `/api/users/${testUserId}`, headers: getAuthHeaders() }).catch(() => {});
  }

  console.log('\n====================================================');
  console.log(`AUDITORIA COMPLETADA: ${results.length} pruebas ejecutadas.`);
  const passCount = results.filter((r) => r.status === 'PASS').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;
  const warnCount = results.filter((r) => r.status === 'WARN').length;
  console.log(`PASARON: ${passCount} | FALLARON: ${failCount} | ADVERTENCIAS: ${warnCount}`);
  console.log('====================================================\n');

  return results;
}

if (require.main === module) {
  runQAAudit().then((res) => {
    const fs = require('fs');
    fs.writeFileSync('qa-audit-results.json', JSON.stringify(res, null, 2));
  });
}

module.exports = { runQAAudit };
