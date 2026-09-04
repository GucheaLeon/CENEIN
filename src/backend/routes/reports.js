'use strict';

const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const REPORT_TYPES = new Set(['initial', 'evolution', 'treatment_plan']);
const INFORMES_DIR = path.join(__dirname, '..', 'docs', 'informes');
const DEFAULT_TEMPLATES = [
  { match: /^12-MII-INFORME INICIAL\.pdf$/i, type: 'initial', code: 'MII-INFORME-INICIAL' },
  { match: /^12-MII-INFORME INICIAL\.pdf$/i, type: 'evolution', code: 'MII-INFORME-EVOLUTIVO' },
  { match: /^6-PLAN DE TRABAJO\.pdf$/i, type: 'treatment_plan', code: 'CENEIN-PLAN' },
];
const typeLabel = { initial: 'Informe inicial', evolution: 'Informe evolutivo', treatment_plan: 'Plan de tratamiento' };

const normalize = (value) => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const cleanTreatment = (value) => String(value || '').trim();

function chooseTemplate(templates, { insurerId, treatmentName, reportType, year }) {
  const candidates = templates.filter((template) => template.report_type === reportType && Number(template.year_version) <= year);
  const exact = candidates.filter((template) => template.insurer_id && String(template.insurer_id) === String(insurerId || '') && normalize(template.treatment_name) === normalize(treatmentName));
  const insurerGeneric = candidates.filter((template) => template.insurer_id && String(template.insurer_id) === String(insurerId || '') && !template.treatment_name);
  const standardTreatment = candidates.filter((template) => !template.insurer_id && normalize(template.treatment_name) === normalize(treatmentName));
  const standard = candidates.filter((template) => !template.insurer_id && !template.treatment_name && template.is_default);
  return [...exact, ...insurerGeneric, ...standardTreatment, ...standard]
    .sort((a, b) => Number(b.year_version) - Number(a.year_version))[0] || null;
}

function parseContent(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  try { return JSON.parse(String(value || '{}')); } catch { return {}; }
}

function snapshotPatient(patient, treatmentName) {
  return {
    patientId: patient.patient_id || patient.id,
    name: `${patient.last_name || patient.apellido || ''} ${patient.first_name || patient.nombre || ''}`.trim(),
    dni: patient.dni || '', affiliateNumber: patient.affiliate_number || patient.nroAfiliado || '',
    cuit: patient.cuit || '', insurer: patient.obra_social_name || patient.obraSocial || '',
    diagnosis: patient.diagnosis || patient.diagnostico || '', treatment: treatmentName,
    module: patient.moduleName || '',
  };
}

async function ensureDefaultTemplates(db) {
  if (!fs.existsSync(INFORMES_DIR)) return;
  for (const entry of fs.readdirSync(INFORMES_DIR)) {
    const definition = DEFAULT_TEMPLATES.find((item) => item.match.test(entry));
    if (!definition) continue;
    const existing = await db.get('SELECT id FROM REPORT_TEMPLATES WHERE form_code = ? AND year_version = ?', definition.code, new Date().getFullYear());
    if (existing) continue;
    const data = fs.readFileSync(path.join(INFORMES_DIR, entry));
    await db.run(`INSERT INTO REPORT_TEMPLATES (name, report_type, form_code, year_version, is_default, filename, file_data) VALUES (?, ?, ?, ?, true, ?, ?)`, typeLabel[definition.type], definition.type, definition.code, new Date().getFullYear(), entry, data);
  }
}

async function renderPdf(templateData, patient, content) {
  const pdf = await PDFDocument.load(templateData);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fields = [
    ['Paciente', patient.name], ['DNI', patient.dni], ['Afiliado', patient.affiliateNumber],
    ['Obra social', patient.insurer], ['Prestación', patient.treatment], ['Módulo clínico', patient.module], ['Prestador', content.provider],
    ['Fecha', content.reportDate], ['Tipo', content.reportKind], ['Diagnóstico', patient.diagnosis],
    ['Instrumentos y resultados', content.assessment], ['Período de abordaje', content.treatmentPeriod],
    ['Modalidad de prestación', content.modality], ['Intervenciones realizadas', content.interventions],
    ['Resultados alcanzados', content.results], ['Notas', content.notes], ['Firma del profesional', content.signature],
    ['Aclaración', content.signatureClarification],
  ].filter(([, value]) => String(value || '').trim());
  const pages = pdf.getPages();
  let index = 0;
  for (const page of pages) {
    let y = page.getHeight() - 42;
    for (let i = index; i < Math.min(fields.length, index + 9); i += 1) {
      const [label, value] = fields[i];
      page.drawText(`${label}: ${String(value).slice(0, 150)}`, { x: 35, y, size: label === 'Paciente' ? 10 : 8, font: label === 'Paciente' ? bold : font, color: rgb(0.05, 0.08, 0.07) });
      y -= 14;
    }
    index += 9;
  }
  return Buffer.from(await pdf.save());
}

async function prepararInforme(db, body, templateId = null) {
  const patientId = String(body.patientId || '').trim();
  const treatmentName = cleanTreatment(body.treatmentName);
  const reportType = String(body.reportType || '').trim();
  const today = new Date();
  const year = Number(body.periodYear) || today.getFullYear();
  const reportDate = String(body.reportDate || '').trim() || today.toISOString().slice(0, 10);
  const date = new Date(`${reportDate}T00:00:00Z`);
  const periodMonth = Number(body.periodMonth) || date.getUTCMonth() + 1;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate) || Number.isNaN(date.getTime()) || date > new Date(`${today.toISOString().slice(0, 10)}T23:59:59Z`)) {
    const error = new Error('La fecha del informe no puede ser futura y debe ser válida.'); error.status = 400; throw error;
  }
  if (year > today.getFullYear() || (year === today.getFullYear() && periodMonth > today.getMonth() + 1)) {
    const error = new Error('No se pueden cargar períodos futuros.'); error.status = 400; throw error;
  }
  if (!patientId || !treatmentName || !REPORT_TYPES.has(reportType)) {
    const error = new Error('Paciente, prestación y tipo de documento son obligatorios.');
    error.status = 400;
    throw error;
  }
  await ensureDefaultTemplates(db);
  const patient = await db.get(`SELECT p.*, o.name AS obra_social_name FROM PATIENTS p LEFT JOIN OS o ON o.id = p.os_id WHERE p.patient_id = ?`, patientId);
  if (!patient) { const error = new Error('Paciente no encontrado.'); error.status = 404; throw error; }
  const template = templateId
    ? await db.get('SELECT * FROM REPORT_TEMPLATES WHERE id = ?', templateId)
    : chooseTemplate(await db.all('SELECT * FROM REPORT_TEMPLATES'), { insurerId: patient.os_id, treatmentName, reportType, year });
  if (!template) { const error = new Error('No existe una plantilla compatible para esta combinación.'); error.status = 409; throw error; }
  patient.moduleName = String(body.moduleName || '').trim();
  const snapshot = snapshotPatient(patient, treatmentName);
  const clinicalContent = { ...parseContent(body.content), reportDate, reportKind: reportType === 'initial' ? 'Inicial' : 'Evolutivo' };
  const pdf = await renderPdf(template.file_data, snapshot, clinicalContent);
  return { patientId, treatmentName, reportType, year, patient, template, snapshot, clinicalContent, pdf, reportDate, periodMonth };
}

function reportResponse(report) {
  return { id: report.id, patientId: report.patient_id, treatmentName: report.treatment_name, reportType: report.report_type, reportDate: report.report_date, periodYear: report.period_year, periodMonth: report.period_month, formCode: report.form_code, content: parseContent(report.clinical_content), status: report.status, createdAt: report.created_at };
}

function registerReportsRoutes(app, { db, authMiddleware }) {
  app.get('/api/reports/templates', authMiddleware, async (req, res) => {
    try { await ensureDefaultTemplates(db); res.json(await db.all(`SELECT id, name, insurer_id AS "insurerId", treatment_name AS "treatmentName", report_type AS "reportType", form_code AS "formCode", year_version AS "yearVersion", is_default AS "isDefault", filename FROM REPORT_TEMPLATES ORDER BY year_version DESC, name`)); }
    catch (error) { console.error('[REPORTS] templates', error); res.status(500).json({ error: 'No se pudieron cargar las plantillas.' }); }
  });

  app.post('/api/reports/templates', authMiddleware, async (req, res) => {
    try {
      if (!req.auth.isAdmin) return res.status(403).json({ error: 'Solo administradores pueden administrar plantillas.' });
      const body = req.body || {};
      if (!REPORT_TYPES.has(body.reportType) || !body.fileData) return res.status(400).json({ error: 'Tipo de documento y archivo PDF son obligatorios.' });
      const data = Buffer.from(String(body.fileData).replace(/^data:application\/pdf;base64,/, ''), 'base64');
      const row = await db.run(`INSERT INTO REPORT_TEMPLATES (name, insurer_id, treatment_name, report_type, form_code, year_version, is_default, filename, file_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, body.name || typeLabel[body.reportType], body.insurerId || null, body.treatmentName || null, body.reportType, body.formCode || `CUSTOM-${Date.now()}`, Number(body.yearVersion) || new Date().getFullYear(), Boolean(body.isDefault), body.filename || 'plantilla.pdf', data);
      res.status(201).json({ id: row.lastID });
    } catch (error) { console.error('[REPORTS] create template', error); res.status(500).json({ error: 'No se pudo guardar la plantilla.' }); }
  });

  app.get('/api/reports', authMiddleware, async (req, res) => {
    try { res.json(await db.all(`SELECT r.id, r.patient_id AS "patientId", r.treatment_name AS "treatmentName", r.report_type AS "reportType", r.report_date AS "reportDate", r.period_year AS "periodYear", r.form_code AS "formCode", r.status, r.created_at AS "createdAt", p.first_name AS "firstName", p.last_name AS "lastName" FROM CLINICAL_REPORTS r JOIN PATIENTS p ON p.patient_id = r.patient_id WHERE (? = '' OR r.patient_id = ?) ORDER BY r.report_date DESC, r.updated_at DESC`, String(req.query.patientId || ''), String(req.query.patientId || ''))); }
    catch (error) { console.error('[REPORTS] list', error); res.status(500).json({ error: 'No se pudieron cargar los informes.' }); }
  });

  app.post('/api/reports', authMiddleware, async (req, res) => {
    try {
      const data = await prepararInforme(db, req.body || {}, req.body?.templateId || null);
      const row = await db.run(`INSERT INTO CLINICAL_REPORTS (patient_id, treatment_name, report_type, report_date, period_year, period_month, template_id, form_code, clinical_content, administrative_snapshot, generated_pdf, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, 'generated', ?)`, data.patientId, data.treatmentName, data.reportType, data.reportDate, data.year, data.periodMonth, data.template.id, data.template.form_code, JSON.stringify(data.clinicalContent), JSON.stringify(data.snapshot), data.pdf, req.auth.userId);
      res.status(201).json({ id: row.lastID, formCode: data.template.form_code, templateId: data.template.id, status: 'generated' });
    } catch (error) { console.error('[REPORTS] create', error); res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo guardar el informe.' }); }
  });

  app.post('/api/reports/preview', authMiddleware, async (req, res) => {
    try { const data = await prepararInforme(db, req.body || {}, req.body?.templateId || null); res.json({ ...req.body, templateId: data.template.id, formCode: data.template.form_code, pdfBase64: data.pdf.toString('base64') }); }
    catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo generar la vista previa.' }); }
  });

  app.get('/api/reports/:id', authMiddleware, async (req, res) => {
    const row = await db.get('SELECT * FROM CLINICAL_REPORTS WHERE id = ?', req.params.id);
    if (!row) return res.status(404).json({ error: 'Informe no encontrado.' });
    res.json(reportResponse(row));
  });

  app.put('/api/reports/:id', authMiddleware, async (req, res) => {
    try {
      const current = await db.get('SELECT * FROM CLINICAL_REPORTS WHERE id = ?', req.params.id);
      if (!current) return res.status(404).json({ error: 'Informe no encontrado.' });
      const data = await prepararInforme(db, { ...req.body, patientId: current.patient_id, templateId: current.template_id }, current.template_id);
      await db.run(`UPDATE CLINICAL_REPORTS SET treatment_name = ?, report_type = ?, report_date = ?, period_year = ?, period_month = ?, form_code = ?, clinical_content = ?::jsonb, administrative_snapshot = ?::jsonb, generated_pdf = ?, status = 'generated', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, data.treatmentName, data.reportType, data.reportDate, data.year, data.periodMonth, data.template.form_code, JSON.stringify(data.clinicalContent), JSON.stringify(data.snapshot), data.pdf, req.params.id);
      res.json({ id: Number(req.params.id), formCode: data.template.form_code, status: 'generated' });
    } catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo actualizar el informe.' }); }
  });

  app.delete('/api/reports/:id', authMiddleware, async (req, res) => {
    const result = await db.run('DELETE FROM CLINICAL_REPORTS WHERE id = ?', req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Informe no encontrado.' });
    res.status(204).end();
  });

  app.get('/api/reports/:id/pdf', authMiddleware, async (req, res) => { const row = await db.get('SELECT generated_pdf, form_code FROM CLINICAL_REPORTS WHERE id = ?', req.params.id); if (!row?.generated_pdf) return res.status(404).json({ error: 'PDF no encontrado.' }); res.type('application/pdf').set('Content-Disposition', `inline; filename=${row.form_code}.pdf`).send(row.generated_pdf); });
}

module.exports = { registerReportsRoutes, chooseTemplate };
