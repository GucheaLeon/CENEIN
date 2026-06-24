const path = require('path');
const fs = require('fs');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const BASE_DIR = __dirname;
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates', 'obras-sociales');
const CENTER_PATH = path.join(BASE_DIR, 'center.json');
const MAPPINGS_PATH = path.join(BASE_DIR, 'mappings.json');
const OBRAS_SOCIALES_MANUALES = [
  {
    id: 'Incluir Salud-30546663422',
    label: 'Incluir Salud-30546663422',
    hasTemplate: false,
  },
];

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function loadCenter() {
  return loadJson(CENTER_PATH);
}

function loadMappings() {
  return loadJson(MAPPINGS_PATH);
}

function loadTemplateMapping(obraSocialId) {
  const mappingPath = path.join(TEMPLATES_DIR, String(obraSocialId), 'mapping.json');
  if (!fs.existsSync(mappingPath)) return null;
  try {
    return loadJson(mappingPath);
  } catch (err) {
    return null;
  }
}

function listTemplateIds() {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  const dirents = fs.readdirSync(TEMPLATES_DIR, { withFileTypes: true });
  return dirents
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((id) => fs.existsSync(path.join(TEMPLATES_DIR, id, 'template.pdf')))
    .sort((a, b) => a.localeCompare(b));
}

function buildFallbackConfig(obraSocialId) {
  return {
    label: obraSocialId,
    template: path.join(obraSocialId, 'template.pdf'),
    fields: [],
  };
}

function resolveConfig({ obraSocialId }) {
  const mappings = loadMappings();
  const config = mappings && mappings[obraSocialId] ? mappings[obraSocialId] : null;
  const templateConfig = config ? null : loadTemplateMapping(obraSocialId);
  if (!config && !templateConfig) return buildFallbackConfig(obraSocialId);
  const baseConfig = config || templateConfig;
  const template = baseConfig.template || path.join(obraSocialId, 'template.pdf');
  return {
    ...baseConfig,
    template,
    fields: Array.isArray(baseConfig.fields) ? baseConfig.fields : [],
  };
}

function getValueByPath(obj, pathStr) {
  if (!pathStr) return '';
  return pathStr.split('.').reduce((acc, key) => {
    if (acc && Object.prototype.hasOwnProperty.call(acc, key)) {
      return acc[key];
    }
    return '';
  }, obj);
}

function sanitizeFilePart(value) {
  return String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_');
}

function formatDate(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function buildDefaultOutputName({ obraSocialId, patient }) {
  const apellido = sanitizeFilePart(patient.apellido || patient.last_name || '');
  const nombre = sanitizeFilePart(patient.nombre || patient.first_name || '');
  const fecha = formatDate();
  const base = `OS-${obraSocialId}-${apellido}_${nombre}-${fecha}`;
  return `${base}.pdf`;
}

function nombreMesEspanol(mes) {
  const meses = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];
  const idx = Number(mes) - 1;
  return idx >= 0 && idx < meses.length ? meses[idx] : '';
}

function buildHorariosPorDia(turnos) {
  const lista = Array.isArray(turnos) ? turnos : [];
  const porDia = new Map();
  for (const clave of lista) {
    const [dia, hora] = String(clave || '').split('-');
    if (!dia || !hora) continue;
    if (!porDia.has(dia)) porDia.set(dia, new Set());
    porDia.get(dia).add(hora);
  }
  const ordenDias = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
  const result = {};
  for (const d of ordenDias) {
    const horas = porDia.has(d) ? Array.from(porDia.get(d)).sort() : [];
    result[d] = horas.join(', ');
  }
  return result;
}

function parseHoraToMin(horaStr) {
  const match = String(horaStr || '').match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isInteger(hh) || !Number.isInteger(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function formatMinToHora(min) {
  const total = ((Number(min) % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function normalizarHoraHHMM(horaStr) {
  const mins = parseHoraToMin(horaStr);
  if (mins == null) return String(horaStr || '').trim();
  return formatMinToHora(mins);
}

function buildHorariosIngresoEgresoPorDia(turnos, duracionMin = 45) {
  const lista = Array.isArray(turnos) ? turnos : [];
  const porDia = new Map();
  for (const clave of lista) {
    const [dia, hora] = String(clave || '').split('-');
    if (!dia || !hora) continue;
    const mins = parseHoraToMin(hora);
    if (mins == null) continue;
    if (!porDia.has(dia)) porDia.set(dia, new Set());
    porDia.get(dia).add(mins);
  }

  const ordenDias = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
  const ingreso = {};
  const egreso = {};
  for (const d of ordenDias) {
    const mins = porDia.has(d) ? Array.from(porDia.get(d)).sort((a, b) => a - b) : [];
    ingreso[d] = mins.map(formatMinToHora).join(', ');
    egreso[d] = mins.map((m) => formatMinToHora(m + duracionMin)).join(', ');
  }
  return { ingreso, egreso };
}

function buildHorariosIngresoEgresoPorDiaPorSemana({
  horariosIngresoPorDia,
  horariosEgresoPorDia,
  fechasPorDiaPorSemana,
}) {
  const ordenDias = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
  const ingreso = {};
  const egreso = {};
  const ingresoEgreso = {};
  for (const dia of ordenDias) {
    ingreso[dia] = { 1: '', 2: '', 3: '', 4: '', 5: '' };
    egreso[dia] = { 1: '', 2: '', 3: '', 4: '', 5: '' };
    ingresoEgreso[dia] = { 1: '', 2: '', 3: '', 4: '', 5: '' };
    for (let semana = 1; semana <= 5; semana += 1) {
      const fechaSemana =
        fechasPorDiaPorSemana &&
        fechasPorDiaPorSemana[dia] &&
        fechasPorDiaPorSemana[dia][semana]
          ? String(fechasPorDiaPorSemana[dia][semana]).trim()
          : '';
      if (!fechaSemana) continue;
      const horaIngreso = (horariosIngresoPorDia && horariosIngresoPorDia[dia]) || '';
      const horaEgreso = (horariosEgresoPorDia && horariosEgresoPorDia[dia]) || '';
      ingreso[dia][semana] = horaIngreso;
      egreso[dia][semana] = horaEgreso;
      ingresoEgreso[dia][semana] =
        horaIngreso && horaEgreso
          ? `${horaIngreso} - ${horaEgreso}`
          : horaIngreso || horaEgreso || '';
    }
  }
  return { ingreso, egreso, ingresoEgreso };
}

function buildPlanillaSemanalFlat({
  fechasPorDiaPorSemana,
  horariosIngresoPorDiaPorSemana,
  horariosEgresoPorDiaPorSemana,
}) {
  const dias = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'];
  const registros = [];
  let ordenOriginal = 0;
  for (let semana = 1; semana <= 5; semana += 1) {
    for (const dia of dias) {
      const fecha =
        fechasPorDiaPorSemana &&
        fechasPorDiaPorSemana[dia] &&
        fechasPorDiaPorSemana[dia][semana]
          ? String(fechasPorDiaPorSemana[dia][semana]).trim()
          : '';
      if (!fecha) continue;
      const horaIngreso =
        horariosIngresoPorDiaPorSemana &&
        horariosIngresoPorDiaPorSemana[dia] &&
        horariosIngresoPorDiaPorSemana[dia][semana]
          ? String(horariosIngresoPorDiaPorSemana[dia][semana]).trim()
          : '';
      const horaEgreso =
        horariosEgresoPorDiaPorSemana &&
        horariosEgresoPorDiaPorSemana[dia] &&
        horariosEgresoPorDiaPorSemana[dia][semana]
          ? String(horariosEgresoPorDiaPorSemana[dia][semana]).trim()
          : '';
      registros.push({
        fecha,
        horaIngreso,
        horaEgreso,
        ordenOriginal,
      });
      ordenOriginal += 1;
    }
  }

  const parseFechaDdMm = (valor) => {
    const m = String(valor || '').trim().match(/^(\d{1,2})\/(\d{1,2})$/);
    if (!m) return Number.MAX_SAFE_INTEGER;
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isInteger(dd) || !Number.isInteger(mm)) return Number.MAX_SAFE_INTEGER;
    return mm * 100 + dd;
  };

  registros.sort((a, b) => {
    const ka = parseFechaDdMm(a.fecha);
    const kb = parseFechaDdMm(b.fecha);
    if (ka !== kb) return ka - kb;

    const ha = parseHoraToMin(a.horaIngreso);
    const hb = parseHoraToMin(b.horaIngreso);
    if (ha != null && hb != null && ha !== hb) return ha - hb;
    if (ha == null && hb != null) return 1;
    if (ha != null && hb == null) return -1;
    return a.ordenOriginal - b.ordenOriginal;
  });

  const fechas = {};
  const ingresos = {};
  const egresos = {};
  const ingresoEgreso = {};
  let idx = 1;
  for (const item of registros) {
    const key = String(idx);
    fechas[key] = item.fecha;
    ingresos[key] = item.horaIngreso;
    egresos[key] = item.horaEgreso;
    ingresoEgreso[key] =
      item.horaIngreso && item.horaEgreso
        ? `${item.horaIngreso} - ${item.horaEgreso}`
        : item.horaIngreso || item.horaEgreso || '';
    idx += 1;
  }
  return { fechas, ingresos, egresos, ingresoEgreso };
}

function buildAsistenciaLineasFlat(planillaSemanalFlat) {
  const fechas = (planillaSemanalFlat && planillaSemanalFlat.fechas) || {};
  const ingresos = (planillaSemanalFlat && planillaSemanalFlat.ingresos) || {};
  const egresos = (planillaSemanalFlat && planillaSemanalFlat.egresos) || {};
  const lineas = {};
  for (let i = 1; i <= 25; i += 1) {
    const key = String(i);
    const fecha = String(fechas[key] || '').trim();
    const ingreso = String(ingresos[key] || '').trim();
    const egreso = String(egresos[key] || '').trim();
    lineas[key] = [fecha, ingreso, egreso].filter(Boolean).join('  ');
  }
  return lineas;
}

function buildAsistenciaDetallesFlat(planillaSemanalFlat) {
  const fechas = (planillaSemanalFlat && planillaSemanalFlat.fechas) || {};
  const ingresos = (planillaSemanalFlat && planillaSemanalFlat.ingresos) || {};
  const egresos = (planillaSemanalFlat && planillaSemanalFlat.egresos) || {};
  const lineas = {};
  for (let i = 1; i <= 25; i += 1) {
    const key = String(i);
    const fecha = String(fechas[key] || '').trim();
    const ingreso = String(ingresos[key] || '').trim();
    const egreso = String(egresos[key] || '').trim();
    const matchFecha = fecha.match(/^(\d{1,2})\/(\d{1,2})$/);
    lineas[key] = {
      fecha,
      dia: matchFecha ? String(matchFecha[1]).padStart(2, '0') : '',
      mes: matchFecha ? String(matchFecha[2]).padStart(2, '0') : '',
      inicio: ingreso,
      fin: egreso,
    };
  }
  return lineas;
}

function formatDateDdMm(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function formatDateDdMmAaaa(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function buildPrimerDiaHabilDelMes({ year, month }) {
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
  if (month < 1 || month > 12) return null;
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1 && (d.getDay() === 0 || d.getDay() === 6)) {
    d.setDate(d.getDate() + 1);
  }
  if (d.getMonth() !== month - 1) return null;
  return d;
}

function listDatesForWeekdayInMonth({ year, month, weekdayIndex }) {
  const dates = [];
  if (!Number.isInteger(year) || !Number.isInteger(month)) return dates;
  if (month < 1 || month > 12) return dates;
  if (!Number.isInteger(weekdayIndex) || weekdayIndex < 0 || weekdayIndex > 6) return dates;

  const first = new Date(year, month - 1, 1);
  const firstDay = first.getDay(); // 0=Dom..6=Sab
  const delta = (weekdayIndex - firstDay + 7) % 7;
  let d = new Date(year, month - 1, 1 + delta);
  while (d.getMonth() === month - 1) {
    dates.push(new Date(d));
    d = new Date(year, month - 1, d.getDate() + 7);
  }
  return dates;
}

function buildFechasPorDia({ year, month, diasActivos }) {
  const dias = diasActivos instanceof Set ? diasActivos : new Set();
  const idxByDia = {
    Dom: 0,
    Lun: 1,
    Mar: 2,
    Mie: 3,
    Jue: 4,
    Vie: 5,
    Sab: 6,
  };
  const ordenDias = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
  const result = {};
  for (const dia of ordenDias) {
    if (!dias.has(dia)) {
      result[dia] = '';
      continue;
    }
    const dates = listDatesForWeekdayInMonth({
      year,
      month,
      weekdayIndex: idxByDia[dia],
    });
    result[dia] = dates.map(formatDateDdMm).join(', ');
  }
  return result;
}

function buildFechasPorDiaPorSemana({ year, month, diasActivos }) {
  const dias = diasActivos instanceof Set ? diasActivos : new Set();
  const idxByDia = {
    Dom: 0,
    Lun: 1,
    Mar: 2,
    Mie: 3,
    Jue: 4,
    Vie: 5,
    Sab: 6,
  };
  const ordenDias = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
  const result = {};
  for (const dia of ordenDias) {
    const semana = { 1: '', 2: '', 3: '', 4: '', 5: '' };
    if (!dias.has(dia)) {
      result[dia] = semana;
      continue;
    }
    const dates = listDatesForWeekdayInMonth({
      year,
      month,
      weekdayIndex: idxByDia[dia],
    });
    for (let index = 0; index < 5; index += 1) {
      semana[index + 1] = dates[index] ? formatDateDdMm(dates[index]) : '';
    }
    result[dia] = semana;
  }
  return result;
}

function normalizeFechasSemanalesSinDuplicarSemana5(fechasPorDiaPorSemana) {
  const ordenDias = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
  const result = {};
  for (const dia of ordenDias) {
    const semanas =
      fechasPorDiaPorSemana &&
      fechasPorDiaPorSemana[dia] &&
      typeof fechasPorDiaPorSemana[dia] === 'object'
        ? { ...fechasPorDiaPorSemana[dia] }
        : { 1: '', 2: '', 3: '', 4: '', 5: '' };
    const s4 = String(semanas[4] || '').trim();
    const s5 = String(semanas[5] || '').trim();
    if (s4 && s5 && s4 === s5) {
      semanas[5] = '';
    }
    result[dia] = semanas;
  }
  return result;
}

function buildFechasPorDiaPorSemanaCalendario({ year, month, diasActivos, onlyCurrentMonth = true }) {
  const ordenDias = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
  const dias =
    diasActivos instanceof Set && diasActivos.size
      ? diasActivos
      : new Set(ordenDias);
  const result = {};
  for (const dia of ordenDias) {
    result[dia] = { 1: '', 2: '', 3: '', 4: '', 5: '' };
  }
  if (!Number.isInteger(year) || !Number.isInteger(month)) return result;
  if (month < 1 || month > 12) return result;

  const firstOfMonth = new Date(year, month - 1, 1);
  const dow = firstOfMonth.getDay(); // 0=Dom..6=Sab
  const offsetToMonday = dow === 0 ? -6 : 1 - dow;
  const mondayWeek1 = new Date(year, month - 1, 1 + offsetToMonday);

  const semanasVisibles = [];
  for (let semana = 1; semana <= 6; semana += 1) {
    const semanaActual = {};
    let tieneAlMenosUnDiaDelMes = false;
    for (let dayIndex = 0; dayIndex < ordenDias.length; dayIndex += 1) {
      const dia = ordenDias[dayIndex];
      if (!dias.has(dia)) continue;
      const date = new Date(mondayWeek1);
      date.setDate(mondayWeek1.getDate() + (semana - 1) * 7 + dayIndex);
      if (onlyCurrentMonth && date.getMonth() !== month - 1) continue;
      semanaActual[dia] = formatDateDdMm(date);
      if (semanaActual[dia]) {
        tieneAlMenosUnDiaDelMes = true;
      }
    }
    if (tieneAlMenosUnDiaDelMes) {
      semanasVisibles.push(semanaActual);
    }
  }

  for (let semana = 1; semana <= 5; semana += 1) {
    const visible = semanasVisibles[semana - 1] || {};
    for (const dia of ordenDias) {
      if (!dias.has(dia)) continue;
      result[dia][semana] = visible[dia] || '';
    }
  }
  return result;
}

function buildHorariosTexto(turnos) {
  const porDia = buildHorariosPorDia(turnos);
  const ordenDias = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
  return ordenDias
    .map((d) => (porDia[d] ? `${d} ${porDia[d]}` : ''))
    .filter(Boolean)
    .join(' | ');
}

function normalizarObraSocialId(valor) {
  return String(valor || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function limpiarSemanaCinco(dataPorDia) {
  const out = dataPorDia && typeof dataPorDia === 'object' ? dataPorDia : {};
  const dias = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
  for (const dia of dias) {
    if (!out[dia] || typeof out[dia] !== 'object') continue;
    out[dia][5] = '';
  }
  return out;
}

function buildPlanillaContext({ patient, tratamiento, mes, anio, obraSocialId }) {
  const now = new Date();
  const mesNum = Number(mes) || now.getMonth() + 1;
  const anioNum = Number(anio) || now.getFullYear();
  const primerDiaHabilDelMesDate = buildPrimerDiaHabilDelMes({ year: anioNum, month: mesNum });
  const tratamientoStr = String(tratamiento || '').trim();
  const tratamientoTodas = tratamientoStr === '__TODAS__' || !tratamientoStr;
  const turnosMes = (patient && patient.turnosPorMes ? patient.turnosPorMes : {})[mesNum] || {};
  const ordenDias = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
  const crearSemanaVacia = () => ({ 1: '', 2: '', 3: '', 4: '', 5: '' });
  const fechasPorDiaPorSemanaCalendario = {};
  const horariosPorSemanaCalendario = {
    ingreso: {},
    egreso: {},
    ingresoEgreso: {},
  };
  for (const dia of ordenDias) {
    fechasPorDiaPorSemanaCalendario[dia] = crearSemanaVacia();
    horariosPorSemanaCalendario.ingreso[dia] = crearSemanaVacia();
    horariosPorSemanaCalendario.egreso[dia] = crearSemanaVacia();
    horariosPorSemanaCalendario.ingresoEgreso[dia] = crearSemanaVacia();
  }
  const normalizarTexto = (valor) =>
    String(valor || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  const tratamientoNorm = normalizarTexto(tratamientoStr);
  const normalizarBooleano = (valor) => {
    if (typeof valor === 'boolean') return valor;
    const num = Number(valor);
    if (Number.isFinite(num)) return num !== 0;
    const txt = String(valor || '').trim().toLowerCase();
    return ['true', 't', 'si', 'on', '1'].includes(txt);
  };
  const pad2 = (num) => String(num).padStart(2, '0');
  const validarIsoPartes = (year, month, day) => {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    const d = new Date(Date.UTC(year, month - 1, day));
    if (
      Number.isNaN(d.getTime()) ||
      d.getUTCFullYear() !== year ||
      d.getUTCMonth() + 1 !== month ||
      d.getUTCDate() !== day
    ) {
      return null;
    }
    return { year, month, day };
  };
  const parseIsoDate = (valor) => {
    if (!valor) return null;
    if (typeof valor === 'object') {
      const fromObj = validarIsoPartes(
        Number(valor.year),
        Number(valor.month),
        Number(valor.day)
      );
      if (fromObj) return fromObj;
    }
    const raw = String(valor || '').trim();
    const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      return validarIsoPartes(
        Number(isoMatch[1]),
        Number(isoMatch[2]),
        Number(isoMatch[3])
      );
    }
    const latamMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (latamMatch) {
      return validarIsoPartes(
        Number(latamMatch[3]),
        Number(latamMatch[2]),
        Number(latamMatch[1])
      );
    }
    const dt = new Date(raw);
    if (!Number.isFinite(dt.getTime())) {
      return null;
    }
    return validarIsoPartes(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  };
  const isoToKey = (isoParts) => `${isoParts.year}-${pad2(isoParts.month)}-${pad2(isoParts.day)}`;
  const dayLabelFromIso = (isoParts) => {
    const date = new Date(Date.UTC(isoParts.year, isoParts.month - 1, isoParts.day));
    return ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'][date.getUTCDay()] || '';
  };
  const weekdayOccurrenceInMonth = (isoParts) => {
    const date = new Date(Date.UTC(isoParts.year, isoParts.month - 1, isoParts.day));
    const targetDow = date.getUTCDay();
    let count = 0;
    for (let d = 1; d <= isoParts.day; d += 1) {
      const current = new Date(Date.UTC(isoParts.year, isoParts.month - 1, d));
      if (current.getUTCDay() === targetDow) count += 1;
    }
    return count;
  };
  const toDdMm = (isoParts) =>
    `${pad2(isoParts.day)}/${pad2(isoParts.month)}`;
  const add45 = (hora) => {
    const mins = parseHoraToMin(hora);
    return mins == null ? '' : formatMinToHora(mins + 45);
  };
  const calendarioBasePorDia = buildFechasPorDiaPorSemanaCalendario({
    year: anioNum,
    month: mesNum,
    diasActivos: new Set(ordenDias),
    onlyCurrentMonth: true,
  });
  const resolverSemanaCalendario = (dia, isoParts) => {
    const fechaDdMm = toDdMm(isoParts);
    const semanasDia = calendarioBasePorDia[dia] || {};
    for (let semana = 1; semana <= 5; semana += 1) {
      if (String(semanasDia[semana] || '').trim() === fechaDdMm) {
        return semana;
      }
    }
    return weekdayOccurrenceInMonth(isoParts);
  };
  const horasBasePorDia = new Map();
  const turnosTratamientoRaw = Object.entries(turnosMes)
    .filter(([nombreTrat]) => {
      if (tratamientoTodas) return true;
      return normalizarTexto(nombreTrat) === tratamientoNorm;
    })
    .flatMap(([, lista]) => (Array.isArray(lista) ? lista : []));
  const turnosTratamiento = Array.from(
    new Set(turnosTratamientoRaw.map((t) => String(t || '').trim()).filter(Boolean))
  );
  for (const clave of turnosTratamiento) {
    const [diaBase, horaBase] = String(clave || '').split('-');
    if (!diaBase || !ordenDias.includes(diaBase)) continue;
    const horaNorm = normalizarHoraHHMM(horaBase);
    if (!horaNorm || parseHoraToMin(horaNorm) == null) continue;
    if (!horasBasePorDia.has(diaBase)) horasBasePorDia.set(diaBase, new Set());
    horasBasePorDia.get(diaBase).add(horaNorm);
  }

  const overrides = Array.isArray(patient?.turnosOverrides) ? patient.turnosOverrides : [];
  const overridesConsolidados = new Map();
  for (const ov of overrides) {
    const ovTratNorm = normalizarTexto(ov?.tratamiento);
    if (!tratamientoTodas && ovTratNorm !== tratamientoNorm) continue;
    const iso = parseIsoDate(ov?.fecha);
    if (!iso || iso.year !== anioNum || iso.month !== mesNum) continue;
    const horaIngreso = normalizarHoraHHMM(ov?.hora);
    if (!horaIngreso || parseHoraToMin(horaIngreso) == null) continue;
    const activo = normalizarBooleano(ov?.activo);
    const key = `${isoToKey(iso)}|${horaIngreso}`;
    if (!overridesConsolidados.has(key)) {
      overridesConsolidados.set(key, { iso, horaIngreso, activo });
      continue;
    }
    const previo = overridesConsolidados.get(key);
    overridesConsolidados.set(key, {
      iso,
      horaIngreso,
      activo: previo.activo === false || activo === false ? false : true,
    });
  }
  const overridesPorFecha = new Map();
  for (const ov of overridesConsolidados.values()) {
    const fechaKey = isoToKey(ov.iso);
    if (!overridesPorFecha.has(fechaKey)) overridesPorFecha.set(fechaKey, new Map());
    overridesPorFecha.get(fechaKey).set(ov.horaIngreso, ov.activo);
  }

  const sesionesOrdenadas = [];
  const totalDiasMes = new Date(anioNum, mesNum, 0).getDate();
  for (let diaMes = 1; diaMes <= totalDiasMes; diaMes += 1) {
    const iso = { year: anioNum, month: mesNum, day: diaMes };
    const dia = dayLabelFromIso(iso);
    if (!dia || !ordenDias.includes(dia)) continue;
    const fechaKey = isoToKey(iso);
    const horasEfectivas = new Set(Array.from(horasBasePorDia.get(dia) || []));
    const overridesDia = overridesPorFecha.get(fechaKey);
    if (overridesDia) {
      for (const [hora, activo] of overridesDia.entries()) {
        if (activo) horasEfectivas.add(hora);
        else horasEfectivas.delete(hora);
      }
    }
    const horasOrdenadas = Array.from(horasEfectivas).sort((a, b) => {
      const ma = parseHoraToMin(a);
      const mb = parseHoraToMin(b);
      if (ma == null && mb == null) return String(a).localeCompare(String(b));
      if (ma == null) return 1;
      if (mb == null) return -1;
      return ma - mb;
    });
    for (const horaIngreso of horasOrdenadas) {
      sesionesOrdenadas.push({ iso, horaIngreso });
    }
  }

  const setSemanaSlot = (dia, semana, fechaDdMm, horaIngreso, horaEgreso) => {
    if (!dia || semana < 1 || semana > 5) return;
    if (!fechasPorDiaPorSemanaCalendario[dia]) return;
    fechasPorDiaPorSemanaCalendario[dia][semana] = fechaDdMm || '';
    horariosPorSemanaCalendario.ingreso[dia][semana] = horaIngreso || '';
    horariosPorSemanaCalendario.egreso[dia][semana] = horaEgreso || '';
    horariosPorSemanaCalendario.ingresoEgreso[dia][semana] =
      horaIngreso && horaEgreso ? `${horaIngreso} - ${horaEgreso}` : horaIngreso || horaEgreso || '';
  };
  const clearSemanaSlot = (dia, semana) => {
    if (!dia || semana < 1 || semana > 5) return;
    if (!fechasPorDiaPorSemanaCalendario[dia]) return;
    fechasPorDiaPorSemanaCalendario[dia][semana] = '';
    horariosPorSemanaCalendario.ingreso[dia][semana] = '';
    horariosPorSemanaCalendario.egreso[dia][semana] = '';
    horariosPorSemanaCalendario.ingresoEgreso[dia][semana] = '';
  };

  // Rehidratar cuadrícula mensual del PDF desde sesiones efectivas por fecha.
  for (const sesion of sesionesOrdenadas) {
    const dia = dayLabelFromIso(sesion.iso);
    if (!dia || !fechasPorDiaPorSemanaCalendario[dia]) continue;
    const semana = resolverSemanaCalendario(dia, sesion.iso);
    if (semana < 1 || semana > 5) continue;
    const actual = String(horariosPorSemanaCalendario.ingreso[dia][semana] || '').trim();
    if (actual) {
      const minsActual = parseHoraToMin(actual);
      const minsNueva = parseHoraToMin(sesion.horaIngreso);
      if (minsActual != null && minsNueva != null && minsActual <= minsNueva) continue;
      clearSemanaSlot(dia, semana);
    }
    setSemanaSlot(dia, semana, toDdMm(sesion.iso), sesion.horaIngreso, add45(sesion.horaIngreso));
  }
  const obraIdNorm = normalizarObraSocialId(obraSocialId);
  if (obraIdNorm.startsWith('OSMEDICA')) {
    limpiarSemanaCinco(fechasPorDiaPorSemanaCalendario);
    limpiarSemanaCinco(horariosPorSemanaCalendario.ingreso);
    limpiarSemanaCinco(horariosPorSemanaCalendario.egreso);
    limpiarSemanaCinco(horariosPorSemanaCalendario.ingresoEgreso);
  }
  const fechasPorDia = {};
  const horariosIngresoFinalPorDia = {};
  const horariosEgresoFinalPorDia = {};
  for (const dia of ordenDias) {
    const semanas = fechasPorDiaPorSemanaCalendario[dia] || {};
    const ingresoSem = (horariosPorSemanaCalendario.ingreso || {})[dia] || {};
    const egresoSem = (horariosPorSemanaCalendario.egreso || {})[dia] || {};
    const fechasDia = [];
    const horasIn = [];
    const horasOut = [];
    for (let s = 1; s <= 5; s += 1) {
      const f = String(semanas[s] || '').trim();
      if (!f) continue;
      fechasDia.push(f);
      const hin = String(ingresoSem[s] || '').trim();
      const hout = String(egresoSem[s] || '').trim();
      if (hin) horasIn.push(hin);
      if (hout) horasOut.push(hout);
    }
    fechasPorDia[dia] = fechasDia.join(', ');
    horariosIngresoFinalPorDia[dia] = Array.from(new Set(horasIn)).join(', ');
    horariosEgresoFinalPorDia[dia] = Array.from(new Set(horasOut)).join(', ');
  }
  const cuadrantes = {};
  const prestacionPorCuadrante = {};
  const cantidadSesionesCuadrante = String(
    patient && patient.cantidadSesiones != null && String(patient.cantidadSesiones).trim()
      ? patient.cantidadSesiones
      : 1
  );
  for (let i = 1; i <= 25; i += 1) {
    cuadrantes[i] = { fecha: '', horario: '', cantidadSesiones: '' };
    prestacionPorCuadrante[i] = '';
  }
  const planillaSemanalFlat = buildPlanillaSemanalFlat({
    fechasPorDiaPorSemana: fechasPorDiaPorSemanaCalendario,
    horariosIngresoPorDiaPorSemana: horariosPorSemanaCalendario.ingreso,
    horariosEgresoPorDiaPorSemana: horariosPorSemanaCalendario.egreso,
  });
  for (let i = 1; i <= 25; i += 1) {
    const key = String(i);
    const fecha = String(planillaSemanalFlat.fechas[key] || '').trim();
    const horario = String(planillaSemanalFlat.ingresoEgreso[key] || '').trim();
    if (!fecha) continue;
    cuadrantes[i] = {
      fecha,
      horario,
      cantidadSesiones: cantidadSesionesCuadrante,
    };
    prestacionPorCuadrante[i] = tratamientoTodas ? 'Todas las terapias' : tratamientoStr;
  }
  const asistenciaLineasFlat = buildAsistenciaLineasFlat(planillaSemanalFlat);
  const asistenciaDetallesFlat = buildAsistenciaDetallesFlat(planillaSemanalFlat);
  return {
    tratamiento: tratamientoTodas ? 'Todas las terapias' : tratamientoStr,
    mes: mesNum,
    mesNombre: nombreMesEspanol(mesNum),
    anio: anioNum,
    periodo: `${nombreMesEspanol(mesNum)} ${anioNum}`,
    primerDiaHabilDelMes: primerDiaHabilDelMesDate ? formatDateDdMm(primerDiaHabilDelMesDate) : '',
    primerDiaHabilMesAnio: primerDiaHabilDelMesDate
      ? formatDateDdMmAaaa(primerDiaHabilDelMesDate)
      : '',
    anioCorto: String(anioNum).slice(-2),
    horarios: buildHorariosTexto(
      sesionesOrdenadas.map((s) => `${dayLabelFromIso(s.iso)}-${s.horaIngreso}`)
    ),
    horariosPorDia: horariosIngresoFinalPorDia,
    horariosIngresoPorDia: horariosIngresoFinalPorDia,
    horariosEgresoPorDia: horariosEgresoFinalPorDia,
    fechasPorDia,
    fechasPorDiaPorSemana: fechasPorDiaPorSemanaCalendario,
    fechasPorDiaPorSemanaCalendario,
    horariosIngresoPorDiaPorSemana: horariosPorSemanaCalendario.ingreso,
    horariosEgresoPorDiaPorSemana: horariosPorSemanaCalendario.egreso,
    horariosIngresoEgresoPorDiaPorSemana: horariosPorSemanaCalendario.ingresoEgreso,
    horariosIngresoPorDiaPorSemanaCalendario: horariosPorSemanaCalendario.ingreso,
    horariosEgresoPorDiaPorSemanaCalendario: horariosPorSemanaCalendario.egreso,
    horariosIngresoEgresoPorDiaPorSemanaCalendario: horariosPorSemanaCalendario.ingresoEgreso,
    cuadrantes,
    fechasPorDiaPorSemanaFlat: planillaSemanalFlat.fechas,
    horariosIngresoPorDiaPorSemanaFlat: planillaSemanalFlat.ingresos,
    horariosEgresoPorDiaPorSemanaFlat: planillaSemanalFlat.egresos,
    horariosIngresoEgresoPorDiaPorSemanaFlat: planillaSemanalFlat.ingresoEgreso,
    asistenciaLineasFlat,
    asistenciaDetallesFlat,
    prestacionPorCuadrante,
  };
}

function buildAsistenciasDesdePlanilla(planilla, cantidadSesiones = '') {
  const dias = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'];
  const asistencias = [];
  for (let semana = 1; semana <= 5; semana += 1) {
    for (const dia of dias) {
      const fecha =
        planilla &&
        planilla.fechasPorDiaPorSemana &&
        planilla.fechasPorDiaPorSemana[dia] &&
        planilla.fechasPorDiaPorSemana[dia][semana]
          ? String(planilla.fechasPorDiaPorSemana[dia][semana]).trim()
          : '';
      if (!fecha) continue;
      const horaIngreso =
        planilla &&
        planilla.horariosIngresoPorDiaPorSemana &&
        planilla.horariosIngresoPorDiaPorSemana[dia] &&
        planilla.horariosIngresoPorDiaPorSemana[dia][semana]
          ? String(planilla.horariosIngresoPorDiaPorSemana[dia][semana]).trim()
          : '';
      const horaEgreso =
        planilla &&
        planilla.horariosEgresoPorDiaPorSemana &&
        planilla.horariosEgresoPorDiaPorSemana[dia] &&
        planilla.horariosEgresoPorDiaPorSemana[dia][semana]
          ? String(planilla.horariosEgresoPorDiaPorSemana[dia][semana]).trim()
          : '';
      const horario =
        horaIngreso && horaEgreso
          ? `${horaIngreso} - ${horaEgreso}`
          : horaIngreso || horaEgreso || '';
      asistencias.push({
        fecha,
        horario,
        cantidadSesiones: String(cantidadSesiones || ''),
      });
    }
  }
  return asistencias;
}

function buildData(patient, context = {}) {
  const center = loadCenter();
  const padreOMadreTutor = String(
    patient.padreTutor ||
      patient.fatherTutorName ||
      patient.father_tutor_name ||
      patient.madreTutora ||
      patient.motherTutorName ||
      patient.mother_tutor_name ||
      ''
  ).trim();
  const ahora = new Date();
  const fechaActual = {
    anio: String(ahora.getFullYear()),
    mes: String(ahora.getMonth() + 1).padStart(2, '0'),
    dia: String(ahora.getDate()).padStart(2, '0'),
  };
  const planillaBase = buildPlanillaContext({
    patient,
    tratamiento: context.tratamiento,
    mes: context.mes,
    anio: context.anio,
    obraSocialId: context.obraSocialId,
  });
  const cantidadSesiones =
    patient && patient.cantidadSesiones != null
      ? patient.cantidadSesiones
      : center && center.cantidadSesiones != null
      ? center.cantidadSesiones
      : '';
  const planilla = {
    ...planillaBase,
    asistencias: buildAsistenciasDesdePlanilla(planillaBase, cantidadSesiones),
  };
  return {
    patient: {
      ...patient,
      padreOMadreTutor,
      dniNroAfiliado: [patient.dni, patient.nroAfiliado]
        .map((v) => String(v || '').trim())
        .filter(Boolean)
        .join(' - '),
      nombreCompleto:
        patient.nombre && patient.apellido
          ? `${patient.apellido} ${patient.nombre}`
          : patient.full_name || '',
      nombreCompletoAfiliado:
        [
          patient.nombre && patient.apellido
            ? `${patient.apellido} ${patient.nombre}`
            : patient.full_name || '',
          patient.nroAfiliado || '',
        ]
          .map((v) => String(v || '').trim())
          .filter(Boolean)
          .join('    '),
    },
    center,
    planilla,
    fechaActual,
    fecha: formatDate(),
  };
}

async function fillTemplate({ obraSocialId, patient, context }) {
  const config = resolveConfig({ obraSocialId });

  const templatePath = path.join(TEMPLATES_DIR, config.template);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  const bytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(bytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const data = buildData(patient, { ...(context || {}), obraSocialId });

  let form = null;
  try {
    form = pdfDoc.getForm();
  } catch (err) {
    form = null;
  }

  const meta = config && typeof config === 'object' ? config._meta : null;

  const fields = config.fields || [];
  for (const field of fields) {
    if (field.visibleIfSource) {
      const visibleValue = getValueByPath(data, field.visibleIfSource);
      if (!String(visibleValue || '').trim()) {
        continue;
      }
    }

    let value = '';
    if (Object.prototype.hasOwnProperty.call(field, 'value')) {
      value = field.value;
    } else if (field.source) {
      value = getValueByPath(data, field.source);
    }
    const valueStr = String(value || '');

    if (field.acroField && form) {
      try {
        const tf = form.getTextField(String(field.acroField));
        tf.setText(valueStr);
      } catch (err) {
        if (!field.optional) {
          throw err;
        }
      }
      continue;
    }

    const pageIndex = Number.isInteger(field.page) ? field.page : 0;
    const page = pdfDoc.getPage(pageIndex);

    let x = field.x || 0;
    let y = field.y || 0;

    if (meta && Number.isFinite(meta.refHeight)) {
      const pageHeight = page.getHeight();
      y += pageHeight - Number(meta.refHeight);
    }

    const fontSize = field.size || 10;
    const color = field.color || '#000000';
    const [r, g, b] = color
      .replace('#', '')
      .match(/.{1,2}/g)
      .map((c) => parseInt(c, 16) / 255);

    page.drawText(valueStr, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(r, g, b),
    });
  }

  if (form) {
    try {
      form.updateFieldAppearances(font);
    } catch (err) {
      // Ignorar si falla el update de apariencias.
    }
  }

  const outputName = config.outputName
    ? config.outputName
        .replace('{obraSocialId}', obraSocialId)
        .replace('{apellido}', sanitizeFilePart(patient.apellido || ''))
        .replace('{nombre}', sanitizeFilePart(patient.nombre || ''))
        .replace('{fecha}', formatDate())
    : buildDefaultOutputName({ obraSocialId, patient });

  const outputBytes = await pdfDoc.save();
  return { outputName, bytes: Buffer.from(outputBytes) };
}

module.exports = {
  fillTemplate,
  loadMappings,
  loadCenter,
  listTemplateIds,
  resolveConfig,
  listObrasSociales: function listObrasSociales() {
    const ids = listTemplateIds();
    const mappings = loadMappings();
    const conPlantilla = ids.map((id) => {
      const cfg = mappings && mappings[id] ? mappings[id] : null;
      const templateCfg = cfg ? null : loadTemplateMapping(id);
      return {
        id,
        label: (cfg && cfg.label) || (templateCfg && templateCfg.label) || id,
        hasTemplate: true,
      };
    });
    const mapa = new Map(conPlantilla.map((item) => [String(item.id), item]));
    OBRAS_SOCIALES_MANUALES.forEach((item) => {
      const key = String(item.id);
      if (!mapa.has(key)) mapa.set(key, item);
    });
    return Array.from(mapa.values()).sort((a, b) =>
      String(a.id).localeCompare(String(b.id), 'es', { sensitivity: 'base' })
    );
  },
};
