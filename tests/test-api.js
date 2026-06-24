const http = require('http');

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Cookie'] = `cenein_auth=${token}`;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);

    const req = http.request(
      { host: 'localhost', port: 4000, path, method, headers },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let parsed = raw;
          try {
            parsed = JSON.parse(raw);
          } catch (e) {}
          resolve({ status: res.statusCode, data: parsed });
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('--- Iniciando Test E2E ---');
  let token = null;
  let patientId = null;

  try {
    // 1. Login
    console.log('[1] Login...');
    const loginRes = await request('POST', '/api/auth/login', {
      username: 'admin',
      password: 'admin1234',
    });
    if (loginRes.status !== 200) throw new Error(`Login fallo: ${JSON.stringify(loginRes.data)}`);
    token = loginRes.data.token;
    console.log('OK. Token obtenido.');

    // 2. Crear Catalogo (Sede)
    console.log('[2] Crear Sede...');
    const sedeRes = await request('POST', '/api/catalogs/sede', { valor: 'Sede Test' }, token);
    if (sedeRes.status !== 200) console.log('Sede crear (pudo fallar por UNIQUE):', sedeRes.data.error);

    // 3. Crear Paciente
    console.log('[3] Crear Paciente...');
    const idUnico = Date.now().toString().slice(-6);
    const patRes = await request('POST', '/api/patients', {
        nombre: `Test_${idUnico}`,
        apellido: 'Automatico',
        dni: `11${idUnico}`,
        estado: 'Activo',
        fechaNacimiento: '1990-01-01'
    }, token);
    
    if (patRes.status !== 200) throw new Error(`Crear Paciente fallo: ${JSON.stringify(patRes.data)}`);
    patientId = patRes.data.id;
    console.log('OK. Paciente creado:', patientId);

    // 4. Modificar Status
    console.log('[4] Modificar Status (Authorizations)...');
    const statRes = await request('PATCH', `/api/patients/${patientId}/status`, {
        activo: true,
        autorizadoDesde: '2026-01-01',
        autorizadoHasta: '2026-12-31'
    }, token);
    if (statRes.status !== 200) throw new Error(`Patch Status fallo: ${JSON.stringify(statRes.data)}`);
    console.log('OK. Status modificado.');

    // 5. Asignar Tratamiento
    console.log('[5] Asignar Tratamiento (Psicologia)...');
    const treatRes = await request('PUT', `/api/patients/${patientId}/treatments`, {
        tratamientos: ['Psicologia']
    }, token);
    if (treatRes.status !== 200) throw new Error(`Assign Treatment fallo: ${JSON.stringify(treatRes.data)}`);
    console.log('OK. Tratamiento asignado.');

    // 6. Asignar Turno Mensual
    console.log('[6] Alternar Turno Mensual...');
    const turnRes = await request('POST', `/api/patients/${patientId}/turns/toggle`, {
        tratamiento: 'Psicologia',
        clave: 'LU-10:00',
        mes: 6
    }, token);
    if (turnRes.status !== 200) throw new Error(`Toggle Turn fallo: ${JSON.stringify(turnRes.data)}`);
    console.log('OK. Turno asignado.');

    // 7. Crear Asistencia
    console.log('[7] Registrar Asistencia...');
    const attRes = await request('POST', `/api/patients/${patientId}/attendances`, {
        fecha: '2026-06-22',
        tratamiento: 'Psicologia',
        nota: 'Asistio correctamente'
    }, token);
    if (attRes.status !== 200) throw new Error(`Crear Asistencia fallo: ${JSON.stringify(attRes.data)}`);
    console.log('OK. Asistencia registrada.');

    // 8. Crear Solicitud (Request)
    console.log('[8] Crear Solicitud...');
    const reqRes = await request('POST', `/api/patients/${patientId}/requests`, {
        fechaInicio: '2026-06-01',
        fechaFin: '2026-06-30',
        tratamientos: ['Psicologia', 'Fonoaudiologia'],
        aplicarTratamientos: true
    }, token);
    if (reqRes.status !== 200) throw new Error(`Crear Solicitud fallo: ${JSON.stringify(reqRes.data)}`);
    console.log('OK. Solicitud global creada y aplicada a tratamientos.');

    // 9. Listar todos los pacientes para confirmar la vista general
    console.log('[9] Listar todos los pacientes...');
    const listRes = await request('GET', '/api/patients', null, token);
    if (listRes.status !== 200) throw new Error(`Listar Pacientes fallo: ${JSON.stringify(listRes.data)}`);
    console.log(`OK. Listados ${listRes.data.length} pacientes.`);

    // 10. Eliminar el paciente de test
    console.log('[10] Eliminar Paciente de Test...');
    const delRes = await request('DELETE', `/api/patients/${patientId}`, null, token);
    if (delRes.status !== 200) throw new Error(`Eliminar Paciente fallo: ${JSON.stringify(delRes.data)}`);
    console.log('OK. Paciente eliminado.');

    console.log('\\n*** TODOS LOS TESTS PASARON EXITOSAMENTE ***');
  } catch (err) {
    console.error('\\n[ERROR CRITICO]', err);
  }
}

runTests();
