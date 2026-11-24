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

  // 2. Probar validaciones de edad (entre 3 y 18 años)
  // Caso A: Menor a 3 años (1 año)
  const fechaMenor3 = new Date(new Date().getFullYear() - 1, 0, 1).toISOString().split('T')[0];
  const menor3Res = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/admisiones',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, JSON.stringify({ nombre: 'Bebe', apellido: 'Perez', fechaNacimiento: fechaMenor3, dni: '55111222', telefono: '1122334455' }));
  console.log('[2a] Rechazo menor a 3 años status:', menor3Res.status, 'Error:', menor3Res.json?.error);
  if (menor3Res.status !== 400 || !menor3Res.json?.error?.includes('3 años')) {
    throw new Error('Debería rechazar a menores de 3 años');
  }

  // Caso B: Mayor a 18 años (25 años)
  const fechaMayor18 = new Date(new Date().getFullYear() - 25, 0, 1).toISOString().split('T')[0];
  const mayor18Res = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/admisiones',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, JSON.stringify({ nombre: 'Adulto', apellido: 'Perez', fechaNacimiento: fechaMayor18, dni: '30111222', telefono: '1122334455' }));
  console.log('[2b] Rechazo mayor a 18 años status:', mayor18Res.status, 'Error:', mayor18Res.json?.error);
  if (mayor18Res.status !== 400 || !mayor18Res.json?.error?.includes('18 años')) {
    throw new Error('Debería rechazar a mayores de 18 años');
  }

  // Caso C: Edad válida (entre 3 y 18 años)
  const fechaValida = new Date(new Date().getFullYear() - 10, 3, 12).toISOString().split('T')[0];
  const admBody = JSON.stringify({
    nombre: 'Juan',
    apellido: 'Garcia',
    dni: '42345678',
    telefono: '1145678901',
    domicilio: 'Av. Corrientes 1234',
    fechaNacimiento: fechaValida,
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
  console.log('[2c] Admisión creada ID:', adm.id, adm.apellido, adm.nombre, 'Fecha Nac:', adm.fechaNacimiento);

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

  // 4. Subir solo 1 PDF (carnet_pdf)
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const fakePdfContent = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
  const part1 = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="numeroAfiliado"\r\n\r\n12345-6\r\n`);
  const part2 = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="carnet_pdf"; filename="carnet_juan.pdf"\r\nContent-Type: application/pdf\r\n\r\n`);
  const part3 = Buffer.from(`\r\n--${boundary}--\r\n`);
  const multipartBody1 = Buffer.concat([part1, part2, fakePdfContent, part3]);

  const expRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/admisiones/${adm.id}/expediente`,
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': multipartBody1.length,
      'Authorization': `Bearer ${token}`
    }
  }, multipartBody1);
  console.log('[4] Expediente guardado con 1 solo PDF (Carnet). Tiene carnet:', expRes.json.carnetTiene);

  // 5. Intentar finalizar la admisión sin todos los PDFs (debe fallar con 400)
  const intentoFallidoFinRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/admisiones/${adm.id}/finalizar`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  });
  console.log('[5] Intento finalizar sin todos los PDFs status:', intentoFallidoFinRes.status, 'Error:', intentoFallidoFinRes.json?.error);
  if (intentoFallidoFinRes.status !== 400 || !intentoFallidoFinRes.json?.error?.includes('faltan')) {
    throw new Error('Debería rechazar finalizar admisión si faltan documentos PDF');
  }

  // 6. Subir los 7 PDFs restantes
  const boundaryAll = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const remainingFields = ['cud_pdf', 'consentimiento_pdf', 'presupuesto_pdf', 'informe_pdf', 'plan_pdf', 'historial_pdf', 'pedidos_pdf'];
  const allParts = [Buffer.from(`--${boundaryAll}\r\nContent-Disposition: form-data; name="numeroAfiliado"\r\n\r\n12345-6\r\n`)];
  for (const field of remainingFields) {
    allParts.push(Buffer.from(`--${boundaryAll}\r\nContent-Disposition: form-data; name="${field}"; filename="${field}.pdf"\r\nContent-Type: application/pdf\r\n\r\n`));
    allParts.push(fakePdfContent);
    allParts.push(Buffer.from('\r\n'));
  }
  allParts.push(Buffer.from(`--${boundaryAll}--\r\n`));
  const multipartBodyAll = Buffer.concat(allParts);

  const expAllRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/admisiones/${adm.id}/expediente`,
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundaryAll}`,
      'Content-Length': multipartBodyAll.length,
      'Authorization': `Bearer ${token}`
    }
  }, multipartBodyAll);
  console.log('[6] Todos los 8 PDFs guardados en expediente.');

  // 7. Descargar PDF y verificar integridad
  const fileRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/admisiones/${adm.id}/expediente/carnet/archivo`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('[7] Descarga de PDF status:', fileRes.status, 'Size:', fileRes.raw.length, 'Matches:', fileRes.raw.equals(fakePdfContent));
  if (!fileRes.raw.equals(fakePdfContent)) {
    throw new Error('El PDF descargado no coincide con el subido');
  }

  // 8. Finalizar admisión con todos los 8 PDFs (ahora debe tener éxito)
  const finRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/api/admisiones/${adm.id}/finalizar`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  });
  console.log('[8] Finalizar admisión status:', finRes.status, 'Paciente ID:', finRes.json.patientId, 'Mensaje:', finRes.json.mensaje);
  if (finRes.status !== 200 || !finRes.json.ok) {
    throw new Error('Error al finalizar admisión con todos los PDFs completos');
  }

  // 9. Verificar que el paciente exista en el endpoint general de pacientes
  const pacListRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/api/patients',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const lista = Array.isArray(pacListRes.json) ? pacListRes.json : (pacListRes.json?.pacientes || []);
  const creadoEnLista = lista.find(p => p.id === finRes.json.patientId || p.dni === '42345678');
  console.log('[9] Paciente verificado en lista general de pacientes:', Boolean(creadoEnLista), 'Nombre:', creadoEnLista?.nombre, creadoEnLista?.apellido);

  console.log('--- Test finalizado con éxito ---');
}

run().catch(console.error);
