'use strict';
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

/**
 * Rutas del Módulo de Admisión de Pacientes
 *
 * Etapa 1: Registrar / listar admisiones (datos básicos + checkboxes)
 * Etapa 2: Revisión de la fisiatra (aprobar / desestimar + devolución)
 * Etapa 3: Armado del expediente (DNI, afiliado, PDFs)
 */

// Carpeta donde se guardan los PDFs subidos
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'admisiones');

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

// Parsea multipart/form-data de forma nativa (sin multer, sin dependencias extra)
// Devuelve { fields: {}, files: { fieldName: { filename, mimetype, data: Buffer } } }
async function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/i);
    if (!boundaryMatch) {
      // Si no hay boundary, leemos como JSON normal
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          resolve({ fields: JSON.parse(body || '{}'), files: {} });
        } catch {
          resolve({ fields: {}, files: {} });
        }
      });
      req.on('error', reject);
      return;
    }

    const boundary = boundaryMatch[1] || boundaryMatch[2];
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      const fields = {};
      const files = {};
      const sep = Buffer.from(`--${boundary}`);
      let start = 0;

      // Dividir en partes
      const parts = [];
      let pos = 0;
      while (pos < buf.length) {
        const idx = buf.indexOf(sep, pos);
        if (idx === -1) break;
        if (pos !== 0) parts.push(buf.slice(pos, idx - 2)); // quita \r\n previo
        pos = idx + sep.length;
        if (buf.slice(pos, pos + 2).equals(Buffer.from('--'))) break; // final
        pos += 2; // salta \r\n
      }

      for (const part of parts) {
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;
        const headerRaw = part.slice(0, headerEnd).toString('utf8');
        const body = part.slice(headerEnd + 4);

        const dispositionMatch = headerRaw.match(/Content-Disposition:[^\r\n]*name="([^"]+)"/i);
        if (!dispositionMatch) continue;
        const fieldName = dispositionMatch[1];

        const filenameMatch = headerRaw.match(/Content-Disposition:[^\r\n]*filename="([^"]*)"/i);
        const ctMatch = headerRaw.match(/Content-Type:\s*([^\r\n]+)/i);

        if (filenameMatch) {
          files[fieldName] = {
            filename: filenameMatch[1],
            mimetype: (ctMatch && ctMatch[1].trim()) || 'application/octet-stream',
            data: body,
          };
        } else {
          fields[fieldName] = body.toString('utf8').replace(/\r\n$/, '');
        }
      }
      resolve({ fields, files });
    });
    req.on('error', reject);
  });
}

function toBoolean(val) {
  if (typeof val === 'boolean') return val;
  if (val === 'true' || val === '1' || val === true) return true;
  return false;
}

function formatAdmission(row) {
  if (!row) return null;
  return {
    id: row.id,
    nombre: row.first_name,
    apellido: row.last_name,
    fechaNacimiento: row.birth_date || '',
    dni: row.dni || '',
    telefono: row.phone || '',
    domicilio: row.address || '',
    tieneObraSocial: Boolean(row.tiene_obra_social),
    obraSocialNombre: row.obra_social_nombre || '',
    tieneCUD: Boolean(row.tiene_cud),
    estado: row.estado || 'pendiente_turno',
    patientId: row.patient_id || null,
    creadoEn: row.created_at,
    actualizadoEn: row.updated_at,
  };
}

function formatReview(row) {
  if (!row) return null;
  return {
    id: row.id,
    admissionId: row.admission_id,
    fechaTurno: row.fecha_turno || '',
    resultado: row.resultado || '',
    devolucion: row.devolucion || '',
    reviewedBy: row.reviewed_by || '',
    creadoEn: row.created_at,
  };
}

function formatDocuments(row) {
  if (!row) return null;
  return {
    id: row.id,
    admissionId: row.admission_id,
    dniNumero: row.dni_numero || '',
    numeroAfiliado: row.numero_afiliado || '',
    carnetPdf: row.carnet_pdf || '',
    cudPdf: row.cud_pdf || '',
    consentimientoPadresPdf: row.consentimiento_padres_pdf || '',
    presupuestoPdf: row.presupuesto_pdf || '',
    informeInicialPdf: row.informe_inicial_pdf || '',
    planTrabajoPdf: row.plan_trabajo_pdf || '',
    resumenHistorialPdf: row.resumen_historial_pdf || '',
    pedidosMedicosPdf: row.pedidos_medicos_pdf || '',
    creadoEn: row.created_at,
    actualizadoEn: row.updated_at,
  };
}

function registerAdmisionsRoutes(app, { db, authMiddleware }) {
  // -----------------------------------------------------------------------
  // ETAPA 1 – CRUD DE ADMISIONES
  // -----------------------------------------------------------------------

  // GET /api/admisiones – listar todas las admisiones
  app.get('/api/admisiones', authMiddleware, async (req, res) => {
    try {
      const rows = await db.all(
        `SELECT * FROM admissions ORDER BY created_at DESC`
      );
      res.json(rows.map(formatAdmission));
    } catch (err) {
      console.error('[ADMISIONES] GET /api/admisiones', err);
      res.status(500).json({ error: 'No se pudieron cargar las admisiones.' });
    }
  });

  // GET /api/admisiones/:id – obtener una admisión
  app.get('/api/admisiones/:id', authMiddleware, async (req, res) => {
    try {
      const row = await db.get(
        `SELECT * FROM admissions WHERE id = ?`,
        req.params.id
      );
      if (!row) return res.status(404).json({ error: 'Admisión no encontrada.' });
      res.json(formatAdmission(row));
    } catch (err) {
      console.error('[ADMISIONES] GET /api/admisiones/:id', err);
      res.status(500).json({ error: 'Error al obtener la admisión.' });
    }
  });

  // POST /api/admisiones – crear admisión (Etapa 1)
  app.post('/api/admisiones', authMiddleware, async (req, res) => {
    try {
      const {
        nombre,
        apellido,
        fechaNacimiento,
        dni,
        telefono,
        domicilio,
        tieneObraSocial,
        obraSocialNombre,
        tieneCUD,
      } = req.body || {};

      if (!nombre || !apellido) {
        return res.status(400).json({ error: 'El nombre y apellido son obligatorios.' });
      }

      const result = await db.run(
        `INSERT INTO admissions
          (first_name, last_name, birth_date, dni, phone, address,
           tiene_obra_social, obra_social_nombre, tiene_cud, estado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente_turno')`,
        String(nombre).trim(),
        String(apellido).trim(),
        fechaNacimiento || null,
        dni || null,
        telefono || null,
        domicilio || null,
        toBoolean(tieneObraSocial),
        obraSocialNombre || null,
        toBoolean(tieneCUD)
      );

      const created = await db.get(
        `SELECT * FROM admissions WHERE id = ?`,
        result.lastID
      );
      res.status(201).json(formatAdmission(created));
    } catch (err) {
      console.error('[ADMISIONES] POST /api/admisiones', err);
      res.status(500).json({ error: 'No se pudo guardar la admisión.' });
    }
  });

  // PATCH /api/admisiones/:id – actualizar datos básicos de una admisión
  app.patch('/api/admisiones/:id', authMiddleware, async (req, res) => {
    try {
      const {
        nombre,
        apellido,
        fechaNacimiento,
        dni,
        telefono,
        domicilio,
        tieneObraSocial,
        obraSocialNombre,
        tieneCUD,
        estado,
      } = req.body || {};

      await db.run(
        `UPDATE admissions SET
          first_name = COALESCE(?, first_name),
          last_name = COALESCE(?, last_name),
          birth_date = COALESCE(?, birth_date),
          dni = COALESCE(?, dni),
          phone = COALESCE(?, phone),
          address = COALESCE(?, address),
          tiene_obra_social = COALESCE(?, tiene_obra_social),
          obra_social_nombre = COALESCE(?, obra_social_nombre),
          tiene_cud = COALESCE(?, tiene_cud),
          estado = COALESCE(?, estado),
          updated_at = now()
         WHERE id = ?`,
        nombre ? String(nombre).trim() : null,
        apellido ? String(apellido).trim() : null,
        fechaNacimiento !== undefined ? (fechaNacimiento || null) : null,
        dni !== undefined ? (dni || null) : null,
        telefono !== undefined ? (telefono || null) : null,
        domicilio !== undefined ? (domicilio || null) : null,
        tieneObraSocial !== undefined ? toBoolean(tieneObraSocial) : null,
        obraSocialNombre !== undefined ? (obraSocialNombre || null) : null,
        tieneCUD !== undefined ? toBoolean(tieneCUD) : null,
        estado !== undefined ? String(estado).trim() : null,
        req.params.id
      );

      const updated = await db.get(
        `SELECT * FROM admissions WHERE id = ?`,
        req.params.id
      );
      if (!updated) return res.status(404).json({ error: 'Admisión no encontrada.' });
      res.json(formatAdmission(updated));
    } catch (err) {
      console.error('[ADMISIONES] PATCH /api/admisiones/:id', err);
      res.status(500).json({ error: 'No se pudo actualizar la admisión.' });
    }
  });

  // DELETE /api/admisiones/:id – eliminar admisión
  app.delete('/api/admisiones/:id', authMiddleware, async (req, res) => {
    try {
      await db.run(`DELETE FROM admissions WHERE id = ?`, req.params.id);
      res.json({ ok: true });
    } catch (err) {
      console.error('[ADMISIONES] DELETE /api/admisiones/:id', err);
      res.status(500).json({ error: 'No se pudo eliminar la admisión.' });
    }
  });

  // -----------------------------------------------------------------------
  // ETAPA 2 – REVISIÓN DE LA FISIATRA
  // -----------------------------------------------------------------------

  // GET /api/admisiones/:id/revision – obtener revisión de la fisiatra
  app.get('/api/admisiones/:id/revision', authMiddleware, async (req, res) => {
    try {
      const row = await db.get(
        `SELECT * FROM admission_fisiatric_review WHERE admission_id = ? ORDER BY created_at DESC LIMIT 1`,
        req.params.id
      );
      res.json(formatReview(row));
    } catch (err) {
      console.error('[ADMISIONES] GET /api/admisiones/:id/revision', err);
      res.status(500).json({ error: 'No se pudo obtener la revisión.' });
    }
  });

  // POST /api/admisiones/:id/revision – registrar revisión de la fisiatra
  app.post('/api/admisiones/:id/revision', authMiddleware, async (req, res) => {
    try {
      const { fechaTurno, resultado, devolucion } = req.body || {};
      const reviewedBy = req.session?.username || req.user?.username || '';

      if (!resultado || !['aprobado', 'desestimado'].includes(resultado)) {
        return res.status(400).json({ error: "El resultado debe ser 'aprobado' o 'desestimado'." });
      }

      const result = await db.run(
        `INSERT INTO admission_fisiatric_review
          (admission_id, fecha_turno, resultado, devolucion, reviewed_by)
         VALUES (?, ?, ?, ?, ?)`,
        req.params.id,
        fechaTurno || null,
        resultado,
        devolucion || null,
        reviewedBy
      );

      // Actualizar estado de la admisión
      await db.run(
        `UPDATE admissions SET estado = ?, updated_at = now() WHERE id = ?`,
        resultado,
        req.params.id
      );

      const created = await db.get(
        `SELECT * FROM admission_fisiatric_review WHERE id = ?`,
        result.lastID
      );
      res.status(201).json(formatReview(created));
    } catch (err) {
      console.error('[ADMISIONES] POST /api/admisiones/:id/revision', err);
      res.status(500).json({ error: 'No se pudo guardar la revisión.' });
    }
  });

  // -----------------------------------------------------------------------
  // ETAPA 3 – EXPEDIENTE / DOCUMENTOS
  // -----------------------------------------------------------------------

  // GET /api/admisiones/:id/expediente – obtener expediente
  app.get('/api/admisiones/:id/expediente', authMiddleware, async (req, res) => {
    try {
      const row = await db.get(
        `SELECT * FROM admission_documents WHERE admission_id = ?`,
        req.params.id
      );
      res.json(formatDocuments(row));
    } catch (err) {
      console.error('[ADMISIONES] GET /api/admisiones/:id/expediente', err);
      res.status(500).json({ error: 'No se pudo obtener el expediente.' });
    }
  });

  // POST /api/admisiones/:id/expediente – crear/actualizar expediente con subida de PDFs
  app.post('/api/admisiones/:id/expediente', authMiddleware, async (req, res) => {
    try {
      ensureUploadsDir();
      const admissionId = req.params.id;

      // Verificar que la admisión esté aprobada
      const admission = await db.get(
        `SELECT * FROM admissions WHERE id = ?`,
        admissionId
      );
      if (!admission) {
        return res.status(404).json({ error: 'Admisión no encontrada.' });
      }
      if (admission.estado !== 'aprobado') {
        return res.status(400).json({ error: 'La admisión debe estar aprobada para armar el expediente.' });
      }

      const { fields, files } = await parseMultipart(req);

      const existing = await db.get(
        `SELECT * FROM admission_documents WHERE admission_id = ?`,
        admissionId
      );

      // Procesar archivos PDF subidos
      const pdfFields = [
        'carnet_pdf', 'cud_pdf', 'consentimiento_padres_pdf',
        'presupuesto_pdf', 'informe_inicial_pdf', 'plan_trabajo_pdf',
        'resumen_historial_pdf', 'pedidos_medicos_pdf',
      ];
      const savedFiles = {};
      for (const field of pdfFields) {
        if (files[field] && files[field].data && files[field].filename) {
          const ext = path.extname(files[field].filename) || '.pdf';
          const fileName = `${admissionId}_${field}_${randomUUID()}${ext}`;
          const filePath = path.join(UPLOADS_DIR, fileName);
          fs.writeFileSync(filePath, files[field].data);
          savedFiles[field] = fileName;
        }
      }

      if (existing) {
        // Actualizar
        await db.run(
          `UPDATE admission_documents SET
            dni_numero = COALESCE(?, dni_numero),
            numero_afiliado = COALESCE(?, numero_afiliado),
            carnet_pdf = COALESCE(?, carnet_pdf),
            cud_pdf = COALESCE(?, cud_pdf),
            consentimiento_padres_pdf = COALESCE(?, consentimiento_padres_pdf),
            presupuesto_pdf = COALESCE(?, presupuesto_pdf),
            informe_inicial_pdf = COALESCE(?, informe_inicial_pdf),
            plan_trabajo_pdf = COALESCE(?, plan_trabajo_pdf),
            resumen_historial_pdf = COALESCE(?, resumen_historial_pdf),
            pedidos_medicos_pdf = COALESCE(?, pedidos_medicos_pdf),
            updated_at = now()
           WHERE admission_id = ?`,
          fields.dniNumero || null,
          fields.numeroAfiliado || null,
          savedFiles.carnet_pdf || null,
          savedFiles.cud_pdf || null,
          savedFiles.consentimiento_padres_pdf || null,
          savedFiles.presupuesto_pdf || null,
          savedFiles.informe_inicial_pdf || null,
          savedFiles.plan_trabajo_pdf || null,
          savedFiles.resumen_historial_pdf || null,
          savedFiles.pedidos_medicos_pdf || null,
          admissionId
        );
      } else {
        // Crear
        await db.run(
          `INSERT INTO admission_documents
            (admission_id, dni_numero, numero_afiliado,
             carnet_pdf, cud_pdf, consentimiento_padres_pdf,
             presupuesto_pdf, informe_inicial_pdf, plan_trabajo_pdf,
             resumen_historial_pdf, pedidos_medicos_pdf)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          admissionId,
          fields.dniNumero || null,
          fields.numeroAfiliado || null,
          savedFiles.carnet_pdf || null,
          savedFiles.cud_pdf || null,
          savedFiles.consentimiento_padres_pdf || null,
          savedFiles.presupuesto_pdf || null,
          savedFiles.informe_inicial_pdf || null,
          savedFiles.plan_trabajo_pdf || null,
          savedFiles.resumen_historial_pdf || null,
          savedFiles.pedidos_medicos_pdf || null
        );
      }

      const updated = await db.get(
        `SELECT * FROM admission_documents WHERE admission_id = ?`,
        admissionId
      );
      res.status(200).json(formatDocuments(updated));
    } catch (err) {
      console.error('[ADMISIONES] POST /api/admisiones/:id/expediente', err);
      res.status(500).json({ error: 'No se pudo guardar el expediente.' });
    }
  });

  // GET /api/admisiones/:id/expediente/:campo/archivo – descargar un PDF específico
  app.get('/api/admisiones/:id/expediente/:campo/archivo', authMiddleware, async (req, res) => {
    try {
      const doc = await db.get(
        `SELECT * FROM admission_documents WHERE admission_id = ?`,
        req.params.id
      );
      if (!doc) return res.status(404).json({ error: 'Expediente no encontrado.' });

      const campoMap = {
        carnet: 'carnet_pdf',
        cud: 'cud_pdf',
        consentimiento: 'consentimiento_padres_pdf',
        presupuesto: 'presupuesto_pdf',
        informe: 'informe_inicial_pdf',
        plan: 'plan_trabajo_pdf',
        historial: 'resumen_historial_pdf',
        pedidos: 'pedidos_medicos_pdf',
      };

      const dbField = campoMap[req.params.campo];
      if (!dbField) return res.status(400).json({ error: 'Campo no válido.' });

      const fileName = doc[dbField];
      if (!fileName) return res.status(404).json({ error: 'Archivo no encontrado.' });

      const filePath = path.join(UPLOADS_DIR, fileName);
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado en disco.' });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      console.error('[ADMISIONES] GET /api/admisiones/:id/expediente/:campo/archivo', err);
      res.status(500).json({ error: 'No se pudo descargar el archivo.' });
    }
  });
}

module.exports = { registerAdmisionsRoutes };
