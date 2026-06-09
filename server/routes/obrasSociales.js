const { fillTemplate, listObrasSociales } = require('../obras-sociales');

function esRespuestaInline(req) {
  const valor = String(req.query?.inline || '').trim().toLowerCase();
  return valor === '1' || valor === 'true' || valor === 'si' || valor === 'yes';
}

function enviarPdfInline(res, result) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${result.outputName}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(Buffer.from(result.bytes || []));
}

function enviarPdfDescarga(res, result) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${result.outputName}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(Buffer.from(result.bytes || []));
}

function registerObrasSocialesRoutes(app, { db, construirPaciente }) {
  async function buscarPacienteParaObraSocial(patientId) {
    if (patientId) {
      return db.get('SELECT * FROM patients WHERE id = ?', patientId);
    }
    return db.get('SELECT * FROM patients ORDER BY created_at DESC LIMIT 1');
  }

  async function generarObraSocial(req, res) {
    const fila = await db.get('SELECT * FROM patients WHERE id = ?', req.params.id);
    const paciente = await construirPaciente(db, fila);
    if (!paciente) {
      res.status(404).json({ error: 'Paciente no encontrado' });
      return;
    }
    const tratamiento = req.query?.tratamiento || req.body?.tratamiento || '';
    const mes = req.query?.mes || req.body?.mes || '';
    const anio = req.query?.anio || req.body?.anio || '';
    try {
      const result = await fillTemplate({
        obraSocialId: req.params.obraSocialId,
        patient: paciente,
        context: { tratamiento, mes, anio },
      });
      if (esRespuestaInline(req)) {
        enviarPdfInline(res, result);
        return;
      }
      enviarPdfDescarga(res, result);
    } catch (err) {
      console.error(err);
      const msg = String(err && err.message ? err.message : '');
      if (msg.includes('Template not found')) {
        res.status(400).json({
          error:
            'No existe plantilla para esa obra social. Selecciona una desde la lista (carpeta - CUIT).',
        });
        return;
      }
      res.status(500).json({ error: 'No se pudo generar la obra social' });
    }
  }

  async function generarPreviewObraSocial(req, res) {
    const patientId = String(req.params.id || req.query?.patientId || req.query?.id || '').trim();
    const fila = await buscarPacienteParaObraSocial(patientId);
    const paciente = await construirPaciente(db, fila);
    if (!paciente) {
      res.status(404).json({ error: 'Paciente no encontrado para preview' });
      return;
    }
    const tratamiento = String(req.query?.tratamiento || '').trim();
    const mes = String(req.query?.mes || '').trim();
    const anio = String(req.query?.anio || '').trim();
    try {
      const result = await fillTemplate({
        obraSocialId: req.params.obraSocialId,
        patient: paciente,
        context: { tratamiento, mes, anio },
      });
      enviarPdfInline(res, result);
    } catch (err) {
      console.error(err);
      const msg = String(err && err.message ? err.message : '');
      if (msg.includes('Template not found')) {
        res.status(400).json({
          error:
            'No existe plantilla para esa obra social. Selecciona una desde la lista (carpeta - CUIT).',
        });
        return;
      }
      res.status(500).json({ error: 'No se pudo generar el preview de la obra social' });
    }
  }

  app.get('/api/obras-sociales', (req, res) => {
    try {
      res.json(listObrasSociales());
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'No se pudieron cargar las obras sociales' });
    }
  });

  app.get('/api/patients/:id/obras-sociales/:obraSocialId', generarObraSocial);
  app.post('/api/patients/:id/obras-sociales/:obraSocialId', generarObraSocial);
  app.get('/api/patients/:id/obras-sociales/:obraSocialId/preview', generarPreviewObraSocial);
  app.get('/api/obras-sociales/:obraSocialId/preview', generarPreviewObraSocial);
}

module.exports = { registerObrasSocialesRoutes };
