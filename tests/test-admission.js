const http = require('http');

async function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks);
        let parsed = null;
        try {
          parsed = JSON.parse(raw.toString('utf8'));
        } catch {}
        resolve({ status: res.statusCode, headers: res.headers, raw, json: parsed });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function run() {
  console.log('--- Probando Ciclo de Admisión y PDFs ---');
  // 1. Login
  const loginBody = JSON.stringify({ username: 'admin', password: 'admin1234' });
  const loginRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginBody) }
  }, loginBody);
  const token = loginRes.json.token;
  console.log('[1] Login OK. Token obtenido.');

  // 2. Crear admisión
  const admBody = JSON.stringify({
    nombre: 'Juan',
    apellido: 'Garcia',
    dni: '42345678',
    telefono: '1145678901',
    domicilio: 'Av. Corrientes 1234',
    fechaNacimiento: '2010-04-12',
    tieneObraSocial: true,
    obraSocialNombre: 'OSDE',
    tieneCUD: true
  });
  const admRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/admisiones',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(admBody), 'Authorization': 'Bearer ' + token }
  }, admBody);
  const adm = admRes.json;
  console.log('[2] Admisión creada ID:', adm.id, adm.apellido, adm.nombre);

  // 3. Revisión Fisiátrica
  const revBody = JSON.stringify({ fechaTurno: '2026-08-25', resultado: 'aprobado', devolucion: 'Aprobado para estimulación' });
  const revRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/admisiones/${adm.id}/revision`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(revBody), 'Authorization': 'Bearer ' + token }
  }, revBody);
  console.log('[3] Revisión Fisiátrica OK. Estado:', revRes.json.resultado);

  // 4. Subir PDF
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const fakePdfContent = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
  const part1 = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="numeroAfiliado"\r\n\r\n12345-6\r\n`);
  const part2 = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="carnet_pdf"; filename="carnet_juan.pdf"\r\nContent-Type: application/pdf\r\n\r\n`);
  const part3 = Buffer.from(`\r\n--${boundary}--\r\n`);
  const multipartBody = Buffer.concat([part1, part2, fakePdfContent, part3]);

  const expRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/admisiones/${adm.id}/expediente`,
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': multipartBody.length,
      'Authorization': `Bearer ${token}`
    }
  }, multipartBody);
  console.log('[4] Expediente guardado. Carnet filename:', expRes.json.carnetFilename, 'Tiene carnet:', expRes.json.carnetTiene);

  // 5. Descargar PDF
  const fileRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/admisiones/${adm.id}/expediente/carnet/archivo`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('[5] Descarga de PDF status:', fileRes.status, 'Size:', fileRes.raw.length, 'Matches:', fileRes.raw.equals(fakePdfContent));
  if (!fileRes.raw.equals(fakePdfContent)) {
    throw new Error('El PDF descargado no coincide con el subido');
  }

  // 6. Finalizar admisión y verificar creación de paciente en tabla PATIENTS
  const finRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/admisiones/${adm.id}/finalizar`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  });
  console.log('[6] Finalizar admisión status:', finRes.status, 'Paciente ID:', finRes.json.patientId, 'Mensaje:', finRes.json.mensaje);

  // 7. Verificar que el paciente exista en el endpoint general de pacientes
  const pacListRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/patients',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const lista = Array.isArray(pacListRes.json) ? pacListRes.json : (pacListRes.json?.pacientes || []);
  const creadoEnLista = lista.find(p => p.id === finRes.json.patientId || p.dni === '42345678');
  console.log('[7] Paciente verificado en lista general de pacientes:', Boolean(creadoEnLista), 'Nombre:', creadoEnLista?.nombre, creadoEnLista?.apellido);

  console.log('--- Test finalizado con éxito ---');
}

run().catch(console.error);
