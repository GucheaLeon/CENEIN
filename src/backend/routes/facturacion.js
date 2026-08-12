const {
  verifyCertsExist,
  getAfipStatus,
  getLastVoucherNumber,
  createVoucher
} = require('../services/afipService');

function registerFacturacionRoutes(app) {
  /**
   * GET /api/facturacion/status
   * Retorna el estado de verificación de certificados locales y de los servidores de ARCA/AFIP.
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
      return res.status(200).json({
        ok: true,
        configured: true,
        certCheck,
        serverStatus
      });
    } catch (err) {
      console.error('Error al consultar estado de ARCA/AFIP:', err);
      return res.status(500).json({
        ok: false,
        error: err.message || 'Error al conectar con servidor de ARCA/AFIP'
      });
    }
  });

  /**
   * GET /api/facturacion/ultimo-comprobante
   * Query params: ptoVta (optional), cbteTipo (optional, default 6)
   */
  app.get('/api/facturacion/ultimo-comprobante', async (req, res) => {
    try {
      const ptoVta = req.query.ptoVta ? Number(req.query.ptoVta) : null;
      const cbteTipo = req.query.cbteTipo ? Number(req.query.cbteTipo) : 6;

      const result = await getLastVoucherNumber(ptoVta, cbteTipo);
      return res.status(200).json({
        ok: true,
        data: result
      });
    } catch (err) {
      console.error('Error al obtener último comprobante:', err);
      return res.status(500).json({
        ok: false,
        error: err.message || 'Error al consultar último comprobante'
      });
    }
  });

  /**
   * POST /api/facturacion/emitir-prueba
   * Body: { ptoVta, cbteTipo, docTipo, docNro, impTotal, concepto }
   */
  app.post('/api/facturacion/emitir-prueba', async (req, res) => {
    try {
      const {
        ptoVta,
        cbteTipo = 6, // 6 = Factura B
        docTipo = 96, // 96 = DNI
        docNro = 30123456,
        impTotal = 100,
        concepto = 2 // 2 = Servicios
      } = req.body || {};

      if (!impTotal || Number(impTotal) <= 0) {
        return res.status(400).json({
          ok: false,
          error: 'El importe total (impTotal) debe ser mayor a 0.'
        });
      }

      const result = await createVoucher({
        ptoVta,
        cbteTipo,
        docTipo,
        docNro,
        impTotal,
        concepto
      });

      return res.status(200).json({
        ok: true,
        message: 'Factura de prueba emitida con éxito en el servidor de Homologación ARCA.',
        data: result
      });
    } catch (err) {
      console.error('Error al emitir factura de prueba en ARCA:', err);
      return res.status(500).json({
        ok: false,
        error: err.message || 'Error al emitir comprobante de prueba'
      });
    }
  });
}

module.exports = {
  registerFacturacionRoutes
};
