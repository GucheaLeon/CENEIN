const path = require('path');
const {
  verifyCertsExist,
  getAfipStatus,
  getLastVoucherNumber,
  createVoucher
} = require('../services/afipService');
const { generateInvoicePdf, listInvoicePdfs, getInvoicePdfPath } = require('../services/pdfService');

function registerFacturacionRoutes(app, { db } = {}) {

  // ─── helpers internos ───────────────────────────────────────────────────────

  /** Resuelve el id de INVOICE_STATUS por descripción, creando si no existe. */
  async function resolveStatusId(desc) {
    if (!db) return null;
    const row = await db.get('SELECT id FROM INVOICE_STATUS WHERE description = $1', [desc]);
    if (row) return row.id;
    const ins = await db.run('INSERT INTO INVOICE_STATUS (description) VALUES ($1)', [desc]);
    return ins.lastID;
  }

  /** Resuelve el id de INVOICE_TYPE por descripción del tipo de comprobante. */
  async function resolveTypeId(cbteTipo) {
    if (!db) return null;
    const label =
      cbteTipo === 1 ? 'Factura A' :
      cbteTipo === 11 ? 'Factura C' : 'Factura B';
    const row = await db.get('SELECT id FROM INVOICE_TYPE WHERE description = $1', [label]);
    if (row) return row.id;
    const ins = await db.run('INSERT INTO INVOICE_TYPE (description) VALUES ($1)', [label]);
    return ins.lastID;
  }

  // ─── rutas ──────────────────────────────────────────────────────────────────

  /**
   * GET /api/facturacion/status
   */
  app.get('/api/facturacion/status', async (req, res) => {
    try {
      const certCheck = verifyCertsExist();
      if (!certCheck.valid) {
        return res.status(200).json({
          ok: false,
          configured: false,
          certCheck,
          message: 'Certificados no encontrados. Coloca homo.crt y homo.key en src/backend/certs/.'
        });
      }
      const serverStatus = await getAfipStatus();
      return res.status(200).json({ ok: true, configured: true, certCheck, serverStatus });
    } catch (err) {
      console.error('Error al consultar estado ARCA/AFIP:', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * GET /api/facturacion/pacientes
   * Lista pacientes con módulos y tratamientos para autocompletado.
   * Query: ?q=texto (búsqueda por nombre/apellido/DNI)
   */
  app.get('/api/facturacion/pacientes', async (req, res) => {
    if (!db) return res.status(503).json({ ok: false, error: 'Base de datos no disponible.' });
    try {
      const busqueda = String(req.query.q || '').trim().toLowerCase();

      const filas = await db.all(
        `SELECT
           p.patient_id,
           p.first_name,
           p.last_name,
           p.dni,
           p.cuit,
           p.affiliate_number,
           o.name AS obra_social_name
         FROM PATIENTS p
         LEFT JOIN OS o ON p.os_id = o.id
         WHERE p.is_discharged IS NOT TRUE
         ORDER BY p.last_name, p.first_name
         LIMIT 300`
      );

      // Módulos en batch
      const modulosRows = await db.all(
        `SELECT mp.patient_id, m.id AS module_id, m.description AS module_desc, m.price AS module_price, mp.id AS mp_id
         FROM MODULE_PATIENT mp
         JOIN MODULE m ON mp.module_id = m.id`
      );
      const modulosPorPaciente = new Map();
      for (const r of modulosRows) {
        if (!modulosPorPaciente.has(r.patient_id)) modulosPorPaciente.set(r.patient_id, []);
        modulosPorPaciente.get(r.patient_id).push({
          id: r.module_id,
          mpId: r.mp_id,
          descripcion: r.module_desc,
          price: Number(r.module_price || 0)
        });
      }

      // Tratamientos en batch
      const tratRows = await db.all(
        `SELECT pt.patient_id, t.id AS treatment_id, t.name
         FROM PATIENT_TREATMENTS pt
         JOIN TREATMENTS t ON t.id = pt.treatment_id`
      );
      const tratamientosPorPaciente = new Map();
      for (const t of tratRows) {
        if (!tratamientosPorPaciente.has(t.patient_id)) tratamientosPorPaciente.set(t.patient_id, []);
        tratamientosPorPaciente.get(t.patient_id).push({ id: t.treatment_id, nombre: t.name });
      }

      const pacientes = filas
        .map((p) => ({
          id: p.patient_id,
          nombre: p.first_name || '',
          apellido: p.last_name || '',
          nombreCompleto: `${p.last_name || ''}, ${p.first_name || ''}`.replace(/^,\s*/, '').trim(),
          dni: p.dni || '',
          cuit: p.cuit || '',
          nroAfiliado: p.affiliate_number || '',
          obraSocial: p.obra_social_name || '',
          modulos: modulosPorPaciente.get(p.patient_id) || [],
          tratamientos: tratamientosPorPaciente.get(p.patient_id) || [],
        }))
        .filter((p) => {
          if (!busqueda) return true;
          return `${p.nombre} ${p.apellido} ${p.nombreCompleto} ${p.dni}`
            .toLowerCase().includes(busqueda);
        });

      return res.status(200).json({ ok: true, data: pacientes });
    } catch (err) {
      console.error('Error al listar pacientes para facturación:', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * GET /api/facturacion/pacientes/:id
   * Retorna datos completos de un paciente para precargar el formulario.
   */
  app.get('/api/facturacion/pacientes/:id', async (req, res) => {
    if (!db) return res.status(503).json({ ok: false, error: 'Base de datos no disponible.' });
    try {
      const patientId = String(req.params.id || '').trim();
      if (!patientId) return res.status(400).json({ ok: false, error: 'ID requerido.' });

      const fila = await db.get(
        `SELECT p.patient_id, p.first_name, p.last_name, p.dni, p.cuit,
                p.affiliate_number, p.father_tutor_name, p.mother_tutor_name,
                o.name AS obra_social_name
         FROM PATIENTS p
         LEFT JOIN OS o ON p.os_id = o.id
         WHERE p.patient_id = $1`,
        [patientId]
      );
      if (!fila) return res.status(404).json({ ok: false, error: 'Paciente no encontrado.' });

      const modulos = await db.all(
        `SELECT mp.id AS mp_id, m.id AS module_id, m.description, m.price
         FROM MODULE_PATIENT mp
         JOIN MODULE m ON mp.module_id = m.id
         WHERE mp.patient_id = $1`,
        [patientId]
      );

      const tratamientos = await db.all(
        `SELECT t.id AS treatment_id, t.name
         FROM PATIENT_TREATMENTS pt
         JOIN TREATMENTS t ON t.id = pt.treatment_id
         WHERE pt.patient_id = $1`,
        [patientId]
      );

      return res.status(200).json({
        ok: true,
        data: {
          id: fila.patient_id,
          nombre: fila.first_name || '',
          apellido: fila.last_name || '',
          nombreCompleto: `${fila.first_name || ''} ${fila.last_name || ''}`.trim(),
          dni: fila.dni || '',
          cuit: fila.cuit || '',
          nroAfiliado: fila.affiliate_number || '',
          obraSocial: fila.obra_social_name || '',
          tutor: fila.father_tutor_name || fila.mother_tutor_name || '',
          modulos: modulos.map((m) => ({ id: m.module_id, mpId: m.mp_id, descripcion: m.description, price: Number(m.price || 0) })),
          tratamientos: tratamientos.map((t) => ({ id: t.treatment_id, nombre: t.name })),
        }
      });
    } catch (err) {
      console.error('Error al obtener datos del paciente:', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * GET /api/facturacion/modulos
   * Catálogo de módulos.
   */
  app.get('/api/facturacion/modulos', async (req, res) => {
    if (!db) return res.status(503).json({ ok: false, error: 'Base de datos no disponible.' });
    try {
      const rows = await db.all('SELECT id, description, price FROM MODULE ORDER BY description');
      return res.status(200).json({ ok: true, data: rows.map(r => ({ ...r, price: Number(r.price || 0) })) });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * GET /api/facturacion/ultimo-comprobante
   */
  app.get('/api/facturacion/ultimo-comprobante', async (req, res) => {
    try {
      const ptoVta = req.query.ptoVta ? Number(req.query.ptoVta) : null;
      const cbteTipo = req.query.cbteTipo ? Number(req.query.cbteTipo) : 6;
      const result = await getLastVoucherNumber(ptoVta, cbteTipo);
      return res.status(200).json({ ok: true, data: result });
    } catch (err) {
      console.error('Error al obtener último comprobante:', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * POST /api/facturacion/emitir
   * Emite en ARCA, genera PDF y persiste en INVOICE + INVOICE_TREATMENTS.
   */
  app.post('/api/facturacion/emitir', async (req, res) => {
    try {
      const {
        ptoVta,
        cbteTipo = 6,
        docTipo = 99,
        docNro = 0,
        impTotal = 100,
        concepto = 2,
        cbteFch,
        condicionIVAReceptorId = 5,
        impTotConc, impNeto, impOpEx, impIVA, impTrib,
        monId = 'PES',
        monCotiz = 1,
        ivaArray,
        fchServDesde, fchServHasta, fchVtoPago,
        // Datos receptor / paciente
        receptorNombre = 'Consumidor Final',
        receptorObraSocial,
        emisorNombre,
        emisorCuit,
        emisorDomicilio,
        // IDs para vincular a DB
        patientId,
        moduloMpId,      // MODULE_PATIENT.id (asignación exacta)
        moduleDirectId,  // MODULE.id
        treatmentIds,    // array de TREATMENTS.id
        // Extras para PDF
        receptorModulos,
        receptorTratamientos,
      } = req.body || {};

      if (!impTotal || Number(impTotal) <= 0) {
        return res.status(400).json({ ok: false, error: 'El importe total debe ser mayor a 0.' });
      }

      // 1. Emitir en ARCA
      const voucherData = await createVoucher({
        ptoVta, cbteTipo, docTipo, docNro, impTotal, concepto, cbteFch,
        condicionIVAReceptorId, impTotConc, impNeto, impOpEx, impIVA, impTrib,
        monId, monCotiz, ivaArray, fchServDesde, fchServHasta, fchVtoPago,
      });

      // 2. Generar PDF
      let pdfInfo = null;
      try {
        pdfInfo = await generateInvoicePdf({
          ...voucherData, concepto,
          receptorNombre, receptorModulos, receptorTratamientos, receptorObraSocial,
          receptorDocTipo: docTipo, receptorDocNro: docNro,
          emisorNombre, emisorCuit, emisorDomicilio, patientId,
        });
      } catch (pdfErr) {
        console.error('Error generando PDF (CAE emitido en ARCA):', pdfErr);
      }

      // 3. Persistir en DB
      let invoiceDbId = null;
      if (db) {
        try {
          const statusId = await resolveStatusId('Emitida');
          const typeId = await resolveTypeId(Number(cbteTipo));

          const ins = await db.run(
            `INSERT INTO INVOICE
               (patient_id, receptor_nombre, doc_tipo, doc_nro, obra_social,
                module_patient_id, module_direct_id,
                amount, mon_id, concepto,
                invoice_type_id, invoice_status_id,
                cae, cae_vto, cbte_nro, cbte_tipo, pto_vta,
                fecha_emision, pdf_filename)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
            [
              patientId || null,
              receptorNombre,
              Number(docTipo),
              docNro != null ? String(docNro) : null,
              receptorObraSocial || null,
              moduloMpId ? Number(moduloMpId) : null,
              moduleDirectId ? Number(moduleDirectId) : null,
              Number(impTotal),
              monId,
              Number(concepto),
              typeId,
              statusId,
              voucherData.cae,
              voucherData.caeVto || null,
              voucherData.cbteNro,
              voucherData.cbteTipo,
              voucherData.ptoVta,
              voucherData.fechaEmision || null,
              pdfInfo?.fileName || null,
            ]
          );
          invoiceDbId = ins.lastID;

          // Guardar tratamientos asociados
          if (invoiceDbId && Array.isArray(treatmentIds) && treatmentIds.length > 0) {
            for (const tid of treatmentIds) {
              try {
                await db.run(
                  'INSERT INTO INVOICE_TREATMENTS (invoice_id, treatment_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                  [invoiceDbId, Number(tid)]
                );
              } catch (_) {}
            }
          }
        } catch (dbErr) {
          console.error('Error al persistir factura en DB (CAE emitido):', dbErr);
        }
      }

      return res.status(200).json({
        ok: true,
        message: 'Factura emitida con éxito en ARCA.',
        data: {
          ...voucherData,
          pdfFileName: pdfInfo?.fileName || null,
          invoiceId: invoiceDbId,
        }
      });
    } catch (err) {
      console.error('Error al emitir factura:', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /** @deprecated — redirige a /emitir */
  app.post('/api/facturacion/emitir-prueba', async (req, res) => {
    req.url = '/api/facturacion/emitir';
    app._router.handle(req, res, () => {});
  });

  /**
   * GET /api/facturacion/invoices
   * Lista facturas con filtros avanzados.
   * Query params: patient_id, module_id, treatment_id, status, desde, hasta, page, limit
   */
  app.get('/api/facturacion/invoices', async (req, res) => {
    if (!db) return res.status(503).json({ ok: false, error: 'Base de datos no disponible.' });
    try {
      const {
        patient_id, module_id, treatment_id, status,
        desde, hasta,
        page = 1, limit = 30
      } = req.query;

      const conditions = [];
      const params = [];
      let pi = 1;

      if (patient_id) { conditions.push(`i.patient_id = $${pi++}`); params.push(patient_id); }
      if (module_id) { conditions.push(`i.module_direct_id = $${pi++}`); params.push(Number(module_id)); }
      if (status) { conditions.push(`ist.description = $${pi++}`); params.push(status); }
      if (desde) { conditions.push(`i.fecha_emision >= $${pi++}`); params.push(desde); }
      if (hasta) { conditions.push(`i.fecha_emision <= $${pi++}`); params.push(hasta); }

      let treatmentJoin = '';
      if (treatment_id) {
        treatmentJoin = `JOIN INVOICE_TREATMENTS it ON it.invoice_id = i.id AND it.treatment_id = $${pi++}`;
        params.push(Number(treatment_id));
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

      const rows = await db.all(
        `SELECT
           i.id, i.patient_id,
           p.first_name, p.last_name,
           i.receptor_nombre, i.doc_tipo, i.doc_nro, i.obra_social,
           i.amount, i.mon_id, i.concepto,
           i.cae, i.cae_vto, i.cbte_nro, i.cbte_tipo, i.pto_vta,
           i.fecha_emision, i.pdf_filename, i.payment_date,
           ist.description AS status,
           itp.description AS invoice_type,
           m.description AS modulo,
           i.created_at
         FROM INVOICE i
         LEFT JOIN PATIENTS p ON p.patient_id = i.patient_id
         LEFT JOIN INVOICE_STATUS ist ON ist.id = i.invoice_status_id
         LEFT JOIN INVOICE_TYPE itp ON itp.id = i.invoice_type_id
         LEFT JOIN MODULE m ON m.id = i.module_direct_id
         ${treatmentJoin}
         ${where}
         ORDER BY i.created_at DESC
         LIMIT $${pi++} OFFSET $${pi++}`,
        [...params, Number(limit), offset]
      );

      // Agregar tratamientos a cada factura
      const invoiceIds = rows.map((r) => r.id);
      let tratamientosPorFactura = new Map();
      if (invoiceIds.length > 0) {
        const placeholders = invoiceIds.map((_, i) => `$${i + 1}`).join(',');
        const trats = await db.all(
          `SELECT it.invoice_id, t.id AS treatment_id, t.name
           FROM INVOICE_TREATMENTS it
           JOIN TREATMENTS t ON t.id = it.treatment_id
           WHERE it.invoice_id IN (${placeholders})`,
          invoiceIds
        );
        for (const t of trats) {
          if (!tratamientosPorFactura.has(t.invoice_id)) tratamientosPorFactura.set(t.invoice_id, []);
          tratamientosPorFactura.get(t.invoice_id).push({ id: t.treatment_id, nombre: t.name });
        }
      }

      // Contar total
      const countRow = await db.get(
        `SELECT COUNT(*) AS total
         FROM INVOICE i
         LEFT JOIN INVOICE_STATUS ist ON ist.id = i.invoice_status_id
         LEFT JOIN MODULE m ON m.id = i.module_direct_id
         ${treatmentJoin}
         ${where}`,
        params.slice(0, params.length - (treatment_id ? 1 : 0)) // params sin limit/offset y con treatment si aplica
      );

      const invoices = rows.map((r) => ({
        id: r.id,
        paciente: { id: r.patient_id, nombre: r.first_name || '', apellido: r.last_name || '' },
        receptorNombre: r.receptor_nombre,
        obraSocial: r.obra_social,
        modulo: r.modulo,
        tratamientos: tratamientosPorFactura.get(r.id) || [],
        importe: r.amount,
        cae: r.cae,
        caeVto: r.cae_vto,
        cbteNro: r.cbte_nro,
        cbteTipo: r.cbte_tipo,
        ptoVta: r.pto_vta,
        fechaEmision: r.fecha_emision,
        pdfFileName: r.pdf_filename,
        estado: r.status,
        tipo: r.invoice_type,
        fechaPago: r.payment_date,
        creadoEn: r.created_at,
      }));

      return res.status(200).json({
        ok: true,
        data: invoices,
        total: Number(countRow?.total || 0),
        page: Number(page),
        limit: Number(limit),
      });
    } catch (err) {
      console.error('Error al listar facturas:', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * PATCH /api/facturacion/invoices/:id/status
   * Actualiza el estado de una factura.
   * Body: { status: 'Pagada' | 'Anulada' | 'Emitida' | 'Pendiente de pago' }
   */
  app.patch('/api/facturacion/invoices/:id/status', async (req, res) => {
    if (!db) return res.status(503).json({ ok: false, error: 'Base de datos no disponible.' });
    try {
      const invoiceId = Number(req.params.id);
      const { status, payment_date } = req.body || {};
      if (!status) return res.status(400).json({ ok: false, error: 'status requerido.' });

      const statusId = await resolveStatusId(status);
      await db.run(
        `UPDATE INVOICE
         SET invoice_status_id = $1,
             payment_date = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [statusId, payment_date || null, invoiceId]
      );
      return res.status(200).json({ ok: true, message: `Estado actualizado a "${status}".` });
    } catch (err) {
      console.error('Error al actualizar estado:', err);
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * GET /api/facturacion/pdfs
   */
  app.get('/api/facturacion/pdfs', (req, res) => {
    try {
      const files = listInvoicePdfs();
      return res.status(200).json({ ok: true, data: files });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * GET /api/facturacion/pdfs/:fileName
   */
  app.get('/api/facturacion/pdfs/:fileName', (req, res) => {
    try {
      const filePath = getInvoicePdfPath(req.params.fileName);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
      res.sendFile(filePath);
    } catch (err) {
      return res.status(404).json({ ok: false, error: err.message });
    }
  });

  /**
   * GET /api/facturacion/pdfs/:fileName/preview
   */
  app.get('/api/facturacion/pdfs/:fileName/preview', (req, res) => {
    try {
      const filePath = getInvoicePdfPath(req.params.fileName);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
      res.sendFile(filePath);
    } catch (err) {
      return res.status(404).json({ ok: false, error: err.message });
    }
  });
}

module.exports = { registerFacturacionRoutes };
