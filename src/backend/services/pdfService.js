const path = require('path');
const fs = require('fs');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const FACTURAS_DIR = process.env.FACTURAS_DIR
  ? path.resolve(process.env.FACTURAS_DIR)
  : path.join(__dirname, '../facturas');

function ensureFacturasDir() {
  if (!fs.existsSync(FACTURAS_DIR)) {
    fs.mkdirSync(FACTURAS_DIR, { recursive: true });
  }
}

/**
 * Genera un PDF de factura electrónica ARCA y lo guarda en disco.
 * @param {object} data - Datos devueltos por createVoucher + info adicional del receptor.
 * @returns {{ filePath: string, fileName: string }}
 */
async function generateInvoicePdf(data) {
  ensureFacturasDir();

  const {
    cae,
    caeVto,
    ptoVta,
    cbteTipo,
    cbteNro,
    fechaEmision,
    impTotal,
    qrUrl,
    emisorNombre = 'CENEIN',
    emisorCuit = '27-27959112-2',
    emisorDomicilio = '',
    receptorNombre = 'Consumidor Final',
    receptorDocTipo = 99,
    receptorDocNro = 0,
    receptorModulos = [],
    receptorTratamientos = [],
    receptorObraSocial = '',
    concepto = 2,
  } = data;

  const tipoCbteLabel =
    cbteTipo === 1 ? 'FACTURA A' :
    cbteTipo === 6 ? 'FACTURA B' :
    cbteTipo === 11 ? 'FACTURA C' :
    `COMPROBANTE TIPO ${cbteTipo}`;

  const ptoVtaStr = String(ptoVta).padStart(4, '0');
  const cbteNroStr = String(cbteNro).padStart(8, '0');
  const impTotalFmt = Number(impTotal).toLocaleString('es-AR', { minimumFractionDigits: 2 });
  const impNeto = Number((impTotal / 1.21).toFixed(2));
  const impIva = Number((impTotal - impNeto).toFixed(2));

  const conceptoLabel =
    concepto === 1 ? 'Productos' :
    concepto === 2 ? 'Servicios' :
    'Productos y Servicios';

  const docTipoLabel =
    receptorDocTipo === 80 ? 'CUIT' :
    receptorDocTipo === 86 ? 'CUIL' :
    receptorDocTipo === 96 ? 'DNI' :
    receptorDocTipo === 99 ? 'Sin Identificar' : 'Doc.';

  // ──────────────────────────────────────────────
  //  Crear documento PDF (A4: 595 x 842 pts)
  // ──────────────────────────────────────────────
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const GREEN = rgb(0, 0.427, 0.267);
  const DARK = rgb(0.176, 0.2, 0.208);
  const GRAY = rgb(0.4, 0.44, 0.46);
  const LIGHT_BG = rgb(0.973, 0.98, 0.973);
  const WHITE = rgb(1, 1, 1);
  const BORDER = rgb(0.843, 0.91, 0.878);

  const margin = 40;
  const contentW = width - margin * 2;

  // ── Header bar ──────────────────────────────────
  page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: GREEN });

  page.drawText('CENEIN', {
    x: margin, y: height - 52,
    size: 28, font: fontBold, color: WHITE,
  });
  page.drawText('Centro de Neurología Infantil', {
    x: margin, y: height - 70,
    size: 10, font: fontReg, color: rgb(0.8, 0.95, 0.87),
  });

  // Tipo de comprobante (derecha del header)
  const tipoW = fontBold.widthOfTextAtSize(tipoCbteLabel, 18);
  page.drawText(tipoCbteLabel, {
    x: width - margin - tipoW, y: height - 50,
    size: 18, font: fontBold, color: WHITE,
  });
  const ptoLabel = `Pto. Vta.: ${ptoVtaStr}  Nro.: ${cbteNroStr}`;
  const ptoW = fontReg.widthOfTextAtSize(ptoLabel, 10);
  page.drawText(ptoLabel, {
    x: width - margin - ptoW, y: height - 68,
    size: 10, font: fontReg, color: rgb(0.8, 0.95, 0.87),
  });

  // ── Separador verde claro ─────────────────────
  page.drawRectangle({ x: 0, y: height - 86, width, height: 6, color: rgb(0.6, 0.85, 0.73) });

  let y = height - 110;

  // ── Datos emisor ─────────────────────────────
  page.drawText('DATOS DEL EMISOR', {
    x: margin, y,
    size: 8, font: fontBold, color: GREEN,
  });
  y -= 16;

  const emisorLines = [
    emisorNombre,
    `CUIT: ${emisorCuit}`,
    emisorDomicilio || '',
    'Responsable Inscripto',
  ].filter(Boolean);

  for (const line of emisorLines) {
    page.drawText(line, { x: margin, y, size: 10, font: fontReg, color: DARK });
    y -= 14;
  }

  y -= 10;
  // ── Divisor ──────────────────────────────────
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: BORDER });
  y -= 18;

  // ── Datos receptor ───────────────────────────
  page.drawText('DATOS DEL RECEPTOR', {
    x: margin, y,
    size: 8, font: fontBold, color: GREEN,
  });
  y -= 16;

  page.drawText(`Nombre / Razón Social: ${receptorNombre}`, {
    x: margin, y, size: 10, font: fontReg, color: DARK,
  });
  y -= 14;
  page.drawText(`${docTipoLabel}: ${receptorDocNro || '-'}`, {
    x: margin, y, size: 10, font: fontReg, color: DARK,
  });
  y -= 14;
  page.drawText(`Condición IVA: Consumidor Final`, {
    x: margin, y, size: 10, font: fontReg, color: DARK,
  });
  y -= 14;
  if (receptorObraSocial) {
    page.drawText(`Obra Social: ${receptorObraSocial}`, {
      x: margin, y, size: 10, font: fontReg, color: DARK,
    });
    y -= 14;
  }
  const modulosArr = Array.isArray(receptorModulos) ? receptorModulos : [];
  const tratamientosArr = Array.isArray(receptorTratamientos) ? receptorTratamientos : [];
  if (modulosArr.length > 0) {
    page.drawText(`Módulo(s): ${modulosArr.join(', ')}`, {
      x: margin, y, size: 10, font: fontBold, color: GREEN,
    });
    y -= 14;
  }
  if (tratamientosArr.length > 0) {
    const tratStr = tratamientosArr.join(' · ');
    page.drawText(`Tratamientos: ${tratStr}`, {
      x: margin, y, size: 10, font: fontReg, color: DARK,
    });
    y -= 14;
  }

  // ── Divisor ──────────────────────────────────
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: BORDER });
  y -= 18;

  // ── Detalle de la operación ───────────────────
  page.drawText('DETALLE', {
    x: margin, y,
    size: 8, font: fontBold, color: GREEN,
  });
  y -= 16;

  // Cabecera de tabla
  page.drawRectangle({ x: margin, y: y - 4, width: contentW, height: 20, color: LIGHT_BG });
  page.drawText('Concepto', { x: margin + 6, y: y + 2, size: 9, font: fontBold, color: DARK });
  page.drawText('Fecha', { x: margin + 250, y: y + 2, size: 9, font: fontBold, color: DARK });
  page.drawText('Importe', { x: margin + contentW - 60, y: y + 2, size: 9, font: fontBold, color: DARK });
  y -= 20;

  // Fila de detalle
  page.drawText(conceptoLabel, { x: margin + 6, y, size: 10, font: fontReg, color: DARK });
  page.drawText(fechaEmision, { x: margin + 250, y, size: 10, font: fontReg, color: DARK });
  const impW = fontReg.widthOfTextAtSize(`$${impTotalFmt}`, 10);
  page.drawText(`$${impTotalFmt}`, {
    x: margin + contentW - impW, y, size: 10, font: fontReg, color: DARK,
  });
  y -= 30;

  // ── Cuadro de totales ─────────────────────────
  const totalesX = margin + contentW / 2;
  const totalesW = contentW / 2;

  page.drawRectangle({ x: totalesX, y: y - 70, width: totalesW, height: 80, color: LIGHT_BG });

  const rowsTotal = [
    ['Importe Neto Gravado:', `$${impNeto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`],
    ['IVA 21%:', `$${impIva.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`],
    ['TOTAL:', `$${impTotalFmt}`],
  ];

  let ty = y - 16;
  for (const [label, value] of rowsTotal) {
    const isTotal = label === 'TOTAL:';
    const fnt = isTotal ? fontBold : fontReg;
    const clr = isTotal ? GREEN : DARK;
    const sz = isTotal ? 12 : 10;
    page.drawText(label, { x: totalesX + 10, y: ty, size: sz, font: fnt, color: clr });
    const vW = fnt.widthOfTextAtSize(value, sz);
    page.drawText(value, { x: totalesX + totalesW - 10 - vW, y: ty, size: sz, font: fnt, color: clr });
    ty -= 20;
  }

  y -= 90;

  // ── Divisor ──────────────────────────────────
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: BORDER });
  y -= 18;

  // ── CAE / Vencimiento ─────────────────────────
  page.drawText('INFORMACIÓN FISCAL — ARCA (ex AFIP)', {
    x: margin, y,
    size: 8, font: fontBold, color: GREEN,
  });
  y -= 16;

  const caeVtoFmt = caeVto
    ? `${caeVto.slice(6, 8)}/${caeVto.slice(4, 6)}/${caeVto.slice(0, 4)}`
    : '-';

  const fiscalLines = [
    `CAE: ${cae}`,
    `Vencimiento CAE: ${caeVtoFmt}`,
    `Fecha de Emisión: ${fechaEmision}`,
  ];
  for (const line of fiscalLines) {
    page.drawText(line, { x: margin, y, size: 10, font: fontReg, color: DARK });
    y -= 14;
  }

  y -= 10;

  // ── QR URL ───────────────────────────────────
  page.drawText('Código QR ARCA (verificación):', { x: margin, y, size: 8, font: fontBold, color: GRAY });
  y -= 13;
  const qrDisplay = qrUrl.length > 90 ? qrUrl.slice(0, 87) + '…' : qrUrl;
  page.drawText(qrDisplay, { x: margin, y, size: 7, font: fontReg, color: GRAY });
  y -= 25;

  // ── Footer ────────────────────────────────────
  page.drawRectangle({ x: 0, y: 0, width, height: 32, color: GREEN });
  page.drawText('Comprobante generado electrónicamente — ARCA Homologación', {
    x: margin, y: 10,
    size: 8, font: fontReg, color: rgb(0.8, 0.95, 0.87),
  });
  const pageLabel = 'Pág. 1/1';
  const pgW = fontReg.widthOfTextAtSize(pageLabel, 8);
  page.drawText(pageLabel, {
    x: width - margin - pgW, y: 10,
    size: 8, font: fontReg, color: rgb(0.8, 0.95, 0.87),
  });

  // ── Guardar ───────────────────────────────────
  const pdfBytes = await pdfDoc.save();
  const fileName = `FACTURA_B_${ptoVtaStr}_${cbteNroStr}_CAE_${cae}.pdf`;
  const filePath = path.join(FACTURAS_DIR, fileName);
  fs.writeFileSync(filePath, pdfBytes);

  return { filePath, fileName };
}

/**
 * Lista todos los PDFs de facturas guardados en disco.
 */
function listInvoicePdfs() {
  ensureFacturasDir();
  const files = fs.readdirSync(FACTURAS_DIR)
    .filter((f) => f.endsWith('.pdf'))
    .map((f) => {
      const stat = fs.statSync(path.join(FACTURAS_DIR, f));
      return {
        fileName: f,
        sizeBytes: stat.size,
        createdAt: stat.birthtime.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return files;
}

/**
 * Devuelve el path absoluto de un PDF por nombre de archivo (validado).
 */
function getInvoicePdfPath(fileName) {
  // Sanitize: solo permite nombres de archivo sin slashes
  const safe = path.basename(fileName);
  if (!safe.endsWith('.pdf')) throw new Error('Archivo inválido.');
  const filePath = path.join(FACTURAS_DIR, safe);
  if (!fs.existsSync(filePath)) throw new Error('Archivo no encontrado.');
  return filePath;
}

module.exports = {
  generateInvoicePdf,
  listInvoicePdfs,
  getInvoicePdfPath,
  FACTURAS_DIR,
};
