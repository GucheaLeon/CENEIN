const { PDFDocument } = require('pdf-lib');
const { fillTemplate } = require('../obras-sociales');

async function combinarPdfsBuffers(buffers = []) {
  const merged = await PDFDocument.create();
  for (const b of buffers) {
    if (!b || !b.length) continue;
    const doc = await PDFDocument.load(b);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    for (const page of pages) merged.addPage(page);
  }
  return merged.save();
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZipBuffer(files = []) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const now = new Date();
  const dosTime =
    (now.getHours() << 11) | (now.getMinutes() << 5) | (Math.floor(now.getSeconds() / 2));
  const dosDate =
    ((Math.max(1980, now.getFullYear()) - 1980) << 9) |
    ((now.getMonth() + 1) << 5) |
    now.getDate();

  for (const file of files) {
    const nameBuf = Buffer.from(String(file.name || 'archivo.pdf'), 'utf8');
    const dataBuf = Buffer.isBuffer(file.data)
      ? file.data
      : Buffer.from(file.data || []);
    const checksum = crc32(dataBuf);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(dataBuf.length, 18);
    localHeader.writeUInt32LE(dataBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBuf, dataBuf);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(dataBuf.length, 20);
    centralHeader.writeUInt32LE(dataBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + dataBuf.length;
  }

  const centralSize = centralParts.reduce((acc, p) => acc + p.length, 0);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(files.length, 8);
  endRecord.writeUInt16LE(files.length, 10);
  endRecord.writeUInt32LE(centralSize, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, endRecord]);
}

function uniqueName(rawName, usedNames) {
  const raw = String(rawName || 'archivo.pdf').trim() || 'archivo.pdf';
  const dot = raw.lastIndexOf('.');
  const base = dot > 0 ? raw.slice(0, dot) : raw;
  const ext = dot > 0 ? raw.slice(dot) : '.pdf';
  let name = `${base}${ext}`;
  let i = 2;
  while (usedNames.has(name.toLowerCase())) {
    name = `${base} (${i})${ext}`;
    i += 1;
  }
  usedNames.add(name.toLowerCase());
  return name;
}

function normalizarTratamiento(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function esTratamientoIntegracion(valor) {
  return normalizarTratamiento(valor) === 'integracion';
}

function normalizarObraSocial(valor) {
  return String(valor || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function esOspecon(obraSocialId) {
  return normalizarObraSocial(obraSocialId).startsWith('OSPECON');
}

function registerAttendancesExportRoute(app, { db, construirPaciente }) {
  app.post('/api/attendances/export', async (req, res) => {
    try {
      const body = req.body || {};
      const ids = Array.isArray(body.patientIds)
        ? body.patientIds.map((v) => String(v || '').trim()).filter(Boolean)
        : [];
      if (!ids.length) {
        res.status(400).json({ error: 'Selecciona al menos un paciente.' });
        return;
      }
      const tratamiento = String(body.tratamiento || '').trim();
      const formato = String(body.formato || 'pdf').trim().toLowerCase();
      const mes = String(body.mes || '').trim();
      const anio = String(body.anio || '').trim();
      const obraSocialForzada = String(body.obraSocialId || '').trim();
      const tratamientoForzadoEsIntegracion = esTratamientoIntegracion(tratamiento);

      const resultados = [];
      for (const id of ids) {
        const fila = await db.get('SELECT * FROM patients WHERE id = ?', id);
        if (!fila) continue;
        if (Boolean(fila.is_discharged)) continue;
        if (fila.is_active === false || fila.is_active === 0 || fila.is_active === '0') continue;
        const paciente = await construirPaciente(db, fila);
        if (!paciente) continue;
        if (paciente.dadoDeBaja === true) continue;
        if (paciente.activo === false) continue;
        const obraSocialId = obraSocialForzada || String(paciente.obraSocial || '').trim();
        if (!obraSocialId) continue;
        const tratamientosPaciente = Array.isArray(paciente.tratamientos)
          ? paciente.tratamientos
          : [];
        const tratamientosAProcesar = tratamiento
          ? [tratamiento]
          : tratamientosPaciente;
        const requiereUnaSolaPlanilla = esOspecon(obraSocialId);
        const tratamientoUnico = requiereUnaSolaPlanilla
          ? (tratamientosAProcesar.find((t) => !esTratamientoIntegracion(t)) || '')
          : '';
        const tratamientosFinales = requiereUnaSolaPlanilla
          ? (tratamientoUnico ? [tratamientoUnico] : [])
          : tratamientosAProcesar;
        for (const tratamientoActual of tratamientosFinales) {
          const tratamientoLimpio = String(tratamientoActual || '').trim();
          if (!tratamientoLimpio) continue;
          if (esTratamientoIntegracion(tratamientoLimpio)) continue;
          try {
            const pdf = await fillTemplate({
              obraSocialId,
              patient: paciente,
              context: { tratamiento: tratamientoLimpio, mes, anio },
            });
            resultados.push({
              outputName: pdf.outputName,
              bytes: Buffer.from(pdf.bytes || []),
            });
          } catch (err) {
            // Si falla un PDF no rompemos toda la exportacion.
            console.error(
              `[ATTENDANCES] No se pudo generar PDF para paciente ${id} tratamiento ${tratamientoLimpio}`,
              err
            );
          }
        }
      }

      if (!resultados.length) {
        if (tratamientoForzadoEsIntegracion) {
          res.status(400).json({
            error: 'Integracion no genera asistencias para imprimir.',
          });
          return;
        }
        res.status(400).json({
          error:
            'No se pudieron generar PDFs para los pacientes seleccionados. Revisa obra social y plantillas.',
        });
        return;
      }

      if (formato === 'zip') {
        const used = new Set();
        const zipFiles = resultados.map((r) => ({
          name: uniqueName(r.outputName, used),
          data: r.bytes,
        }));
        const zipBytes = buildZipBuffer(zipFiles);
        const zipNombre = `asistencias-${anio || 'anio'}-${mes || 'mes'}.zip`;
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipNombre}"`);
        res.send(zipBytes);
        return;
      }

      const mergedBytes = await combinarPdfsBuffers(resultados.map((r) => r.bytes));
      const nombre = `asistencias-${anio || 'anio'}-${mes || 'mes'}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
      res.send(Buffer.from(mergedBytes));
    } catch (err) {
      console.error('[ATTENDANCES] Error exportando asistencias', err);
      res.status(500).json({ error: 'No se pudieron exportar las asistencias.' });
    }
  });
}

module.exports = { registerAttendancesExportRoute };
