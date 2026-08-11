'use strict';
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

/**
 * Rutas del Módulo de Admisión de Pacientes
 *
 * Etapa 1: Registrar / listar admisiones (datos básicos + checkboxes)
 * Etapa 2: Revisión de la fisiatra (aprobar / desestimar + devolución)
 * Etapa 3: Armado del expediente (DNI, afiliado, PDFs almacenados en DB como BYTEA)
 */

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

// Mapeo de claves de campo a nombres de columna en DB
const CAMPO_MAP = {
  carnet:         { dbField: 'carnet_pdf',                  dataCol: 'carnet_data',         filenameCol: 'carnet_filename',         mimetypeCol: 'carnet_mimetype' },
  cud:            { dbField: 'cud_pdf',                     dataCol: 'cud_data',             filenameCol: 'cud_filename',             mimetypeCol: 'cud_mimetype' },
  consentimiento: { dbField: 'consentimiento_padres_pdf',   dataCol: 'consentimiento_data',  filenameCol: 'consentimiento_filename',  mimetypeCol: 'consentimiento_mimetype' },
  presupuesto:    { dbField: 'presupuesto_pdf',             dataCol: 'presupuesto_data',     filenameCol: 'presupuesto_filename',     mimetypeCol: 'presupuesto_mimetype' },
  informe:        { dbField: 'informe_inicial_pdf',         dataCol: 'informe_data',         filenameCol: 'informe_filename',         mimetypeCol: 'informe_mimetype' },
  plan:           { dbField: 'plan_trabajo_pdf',            dataCol: 'plan_data',            filenameCol: 'plan_filename',            mimetypeCol: 'plan_mimetype' },
  historial:      { dbField: 'resumen_historial_pdf',       dataCol: 'historial_data',       filenameCol: 'historial_filename',       mimetypeCol: 'historial_mimetype' },
  pedidos:        { dbField: 'pedidos_medicos_pdf',         dataCol: 'pedidos_data',         filenameCol: 'pedidos_filename',         mimetypeCol: 'pedidos_mimetype' },
};

// Claves de campo de formulario → clave de CAMPO_MAP
const FORM_FIELD_MAP = {
  carnet_pdf:               'carnet',
  cud_pdf:                  'cud',
  consentimiento_pdf:       'consentimiento',
  presupuesto_pdf:          'presupuesto',
  informe_pdf:              'informe',
  plan_pdf:                 'plan',
  historial_pdf:            'historial',
  pedidos_pdf:              'pedidos',
};

function formatDocuments(row) {
  if (!row) return null;
  const result = {
    id: row.id,
    admissionId: row.admission_id,
    dniNumero: row.dni_numero || '',
    numeroAfiliado: row.numero_afiliado || '',
    creadoEn: row.created_at,
    actualizadoEn: row.updated_at,
  };
  // Para cada documento: tieneField=true si tiene filename guardado, filenameField=nombre del archivo
  for (const [key, meta] of Object.entries(CAMPO_MAP)) {
    const filename = row[meta.filenameCol] || row[meta.dbField] || '';
    result[`${key}Filename`] = filename;
    result[`${key}Tiene`] = Boolean(filename);
    // Valor legible del campo (nombre de archivo o vacío)
    result[`${key}Pdf`] = filename;
  }
  return result;
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
      const reviewedBy = req.session?.username || req.user?.username || req.auth?.username || '';

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
  // ETAPA 3 – EXPEDIENTE / DOCUMENTOS (archivos guardados en DB como BYTEA)
  // -----------------------------------------------------------------------

  // GET /api/admisiones/:id/expediente – obtener expediente (sin datos binarios)
  app.get('/api/admisiones/:id/expediente', authMiddleware, async (req, res) => {
    try {
      const row = await db.get(
        `SELECT id, admission_id, dni_numero, numero_afiliado,
                carnet_pdf, carnet_filename, carnet_mimetype,
                cud_pdf, cud_filename, cud_mimetype,
                consentimiento_padres_pdf, consentimiento_filename, consentimiento_mimetype,
                presupuesto_pdf, presupuesto_filename, presupuesto_mimetype,
                informe_inicial_pdf, informe_filename, informe_mimetype,
                plan_trabajo_pdf, plan_filename, plan_mimetype,
                resumen_historial_pdf, historial_filename, historial_mimetype,
                pedidos_medicos_pdf, pedidos_filename, pedidos_mimetype,
                created_at, updated_at
         FROM admission_documents WHERE admission_id = ?`,
        req.params.id
      );
      res.json(formatDocuments(row));
    } catch (err) {
      console.error('[ADMISIONES] GET /api/admisiones/:id/expediente', err);
      res.status(500).json({ error: 'No se pudo obtener el expediente.' });
    }
  });

  // POST /api/admisiones/:id/expediente – crear/actualizar expediente con subida de archivos a DB
  app.post('/api/admisiones/:id/expediente', authMiddleware, async (req, res) => {
    try {
      const admissionId = req.params.id;

      // Verificar que la admisión exista y esté en estado válido para expediente
      const admission = await db.get(
        `SELECT * FROM admissions WHERE id = ?`,
        admissionId
      );
      if (!admission) {
        return res.status(404).json({ error: 'Admisión no encontrada.' });
      }
      if (admission.estado !== 'aprobado' && admission.estado !== 'completado') {
        return res.status(400).json({ error: 'La admisión debe estar aprobada para armar el expediente.' });
      }

      const { fields, files } = await parseMultipart(req);
      console.log('[EXPEDIENTE] fields recibidos:', Object.keys(fields), 'files recibidos:', Object.keys(files), 'content-type:', req.headers['content-type']?.substring(0, 60));
      for (const [k, f] of Object.entries(files)) {
        console.log(`  archivo: ${k} -> filename=${f.filename} dataLen=${f.data?.length}`);
      }

      const existing = await db.get(
        `SELECT id FROM admission_documents WHERE admission_id = ?`,
        admissionId
      );

      // Construir actualizaciones para archivos recibidos
      const fileUpdates = {};
      for (const [formField, campoKey] of Object.entries(FORM_FIELD_MAP)) {
        if (files[formField] && files[formField].data && files[formField].data.length > 0) {
          const meta = CAMPO_MAP[campoKey];
          fileUpdates[campoKey] = {
            data: files[formField].data,
            filename: files[formField].filename || formField,
            mimetype: files[formField].mimetype || 'application/pdf',
            meta,
          };
        }
      }

      if (existing) {
        // Actualizar campos de texto solo si se enviaron valores no vacíos
        const dniVal = (fields.dniNumero || '').trim();
        const afiliadoVal = (fields.numeroAfiliado || '').trim();
        if (dniVal || afiliadoVal) {
          await db.run(
            `UPDATE admission_documents SET
              dni_numero = CASE WHEN ?::text <> '' THEN ?::text ELSE dni_numero END,
              numero_afiliado = CASE WHEN ?::text <> '' THEN ?::text ELSE numero_afiliado END,
              updated_at = now()
             WHERE admission_id = ?`,
            dniVal,
            dniVal,
            afiliadoVal,
            afiliadoVal,
            admissionId
          );
        }
        // Actualizar archivos binarios uno por uno (BYTEA)
        console.log('[EXPEDIENTE] fileUpdates keys:', Object.keys(fileUpdates));
        for (const [campoKey, update] of Object.entries(fileUpdates)) {
          const { meta, data, filename, mimetype } = update;
          console.log(`[EXPEDIENTE] Guardando archivo: campo=${campoKey} filename=${filename} mimetype=${mimetype} dataLen=${data?.length}`);
          try {
            const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
            await db.run(
              `UPDATE admission_documents SET
                ${meta.dataCol} = ?,
                ${meta.filenameCol} = ?,
                ${meta.mimetypeCol} = ?,
                ${meta.dbField} = ?,
                updated_at = now()
               WHERE admission_id = ?`,
              buf,
              filename,
              mimetype,
              filename,
              admissionId
            );
            console.log(`[EXPEDIENTE] OK guardado: ${campoKey}`);
          } catch (fileErr) {
            console.error(`[EXPEDIENTE] Error guardando ${campoKey}:`, fileErr.message);
          }
        }
      } else {
        // Crear registro base
        await db.run(
          `INSERT INTO admission_documents
            (admission_id, dni_numero, numero_afiliado)
           VALUES (?, ?, ?)`,
          admissionId,
          fields.dniNumero || null,
          fields.numeroAfiliado || null
        );
        // Agregar archivos binarios
        console.log('[EXPEDIENTE] INSERT nuevo, fileUpdates keys:', Object.keys(fileUpdates));
        for (const [campoKey, update] of Object.entries(fileUpdates)) {
          const { meta, data, filename, mimetype } = update;
          console.log(`[EXPEDIENTE] Guardando archivo nuevo: campo=${campoKey} filename=${filename} dataLen=${data?.length}`);
          try {
            const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
            await db.run(
              `UPDATE admission_documents SET
                ${meta.dataCol} = ?,
                ${meta.filenameCol} = ?,
                ${meta.mimetypeCol} = ?,
                ${meta.dbField} = ?,
                updated_at = now()
               WHERE admission_id = ?`,
              buf,
              filename,
              mimetype,
              filename,
              admissionId
            );
            console.log(`[EXPEDIENTE] OK guardado nuevo: ${campoKey}`);
          } catch (fileErr) {
            console.error(`[EXPEDIENTE] Error guardando nuevo ${campoKey}:`, fileErr.message);
          }
        }
      }

      const updated = await db.get(
        `SELECT id, admission_id, dni_numero, numero_afiliado,
                carnet_pdf, carnet_filename, carnet_mimetype,
                cud_pdf, cud_filename, cud_mimetype,
                consentimiento_padres_pdf, consentimiento_filename, consentimiento_mimetype,
                presupuesto_pdf, presupuesto_filename, presupuesto_mimetype,
                informe_inicial_pdf, informe_filename, informe_mimetype,
                plan_trabajo_pdf, plan_filename, plan_mimetype,
                resumen_historial_pdf, historial_filename, historial_mimetype,
                pedidos_medicos_pdf, pedidos_filename, pedidos_mimetype,
                created_at, updated_at
         FROM admission_documents WHERE admission_id = ?`,
        admissionId
      );
      res.status(200).json(formatDocuments(updated));
    } catch (err) {
      console.error('[ADMISIONES] POST /api/admisiones/:id/expediente', err);
      res.status(500).json({ error: 'No se pudo guardar el expediente.' });
    }
  });

  // GET /api/admisiones/:id/expediente/:campo/archivo – descargar un archivo específico desde DB
  app.get('/api/admisiones/:id/expediente/:campo/archivo', authMiddleware, async (req, res) => {
    try {
      const campoKey = req.params.campo;
      const meta = CAMPO_MAP[campoKey];
      if (!meta) return res.status(400).json({ error: 'Campo no válido.' });

      // Traer solo las columnas del campo solicitado
      const row = await db.get(
        `SELECT ${meta.dataCol}, ${meta.filenameCol}, ${meta.mimetypeCol}
         FROM admission_documents WHERE admission_id = ?`,
        req.params.id
      );

      if (!row) return res.status(404).json({ error: 'Expediente no encontrado.' });

      const fileData = row[meta.dataCol];
      if (!fileData) return res.status(404).json({ error: 'Archivo no encontrado.' });

      const mimetype = row[meta.mimetypeCol] || 'application/pdf';
      const filename = row[meta.filenameCol] || `${campoKey}.pdf`;

      // fileData puede ser un Buffer o un Uint8Array desde pg
      const buffer = Buffer.isBuffer(fileData) ? fileData : Buffer.from(fileData);

      res.setHeader('Content-Type', mimetype);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
      res.setHeader('Content-Length', buffer.length);
      res.end(buffer);
    } catch (err) {
      console.error('[ADMISIONES] GET /api/admisiones/:id/expediente/:campo/archivo', err);
      res.status(500).json({ error: 'No se pudo descargar el archivo.' });
    }
  });

  // GET /api/admisiones/:id/expediente/:campo/info – metadata del archivo (sin binario)
  app.get('/api/admisiones/:id/expediente/:campo/info', authMiddleware, async (req, res) => {
    try {
      const campoKey = req.params.campo;
      const meta = CAMPO_MAP[campoKey];
      if (!meta) return res.status(400).json({ error: 'Campo no válido.' });

      const row = await db.get(
        `SELECT
           ${meta.filenameCol} AS filename,
           ${meta.mimetypeCol} AS mimetype,
           octet_length(${meta.dataCol}) AS size
         FROM admission_documents WHERE admission_id = ?`,
        req.params.id
      );

      if (!row) return res.status(404).json({ error: 'Expediente no encontrado.' });

      res.json({
        campo: campoKey,
        filename: row.filename || null,
        mimetype: row.mimetype || null,
        size: row.size || 0,
        existe: Boolean(row.size && row.size > 0),
      });
    } catch (err) {
      console.error('[ADMISIONES] GET /api/admisiones/:id/expediente/:campo/info', err);
      res.status(500).json({ error: 'No se pudo obtener la información del archivo.' });
    }
  });
}

module.exports = { registerAdmisionsRoutes };
