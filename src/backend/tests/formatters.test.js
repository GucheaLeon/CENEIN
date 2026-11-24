'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ─── Funciones a probar ────────────────────────────────────────────────────────

function resolverNombreApellido(paciente) {
  const nombreRaw = String(paciente?.nombre || '').trim();
  const apellidoRaw = String(paciente?.apellido || '').trim();
  if (apellidoRaw) return { nombre: nombreRaw, apellido: apellidoRaw };
  const partes = nombreRaw.split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return { nombre: nombreRaw, apellido: '' };
  const usaDosApellidos = partes.length >= 4;
  const corte = usaDosApellidos ? partes.length - 2 : partes.length - 1;
  return {
    nombre: partes.slice(0, corte).join(' ').trim(),
    apellido: partes.slice(corte).join(' ').trim(),
  };
}

function normalizarFecha(fecha) {
  if (!fecha || typeof fecha !== 'string') return null;
  const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return null;
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function calcularEdadDesdeNacimiento(fechaNacimiento) {
  const parts = normalizarFecha(fechaNacimiento);
  if (!parts) return '';
  const now = new Date();
  let edad = now.getFullYear() - parts.year;
  const mesActual = now.getMonth() + 1;
  const diaActual = now.getDate();
  if (
    mesActual < parts.month ||
    (mesActual === parts.month && diaActual < parts.day)
  ) {
    edad -= 1;
  }
  if (!Number.isFinite(edad) || edad < 0) return '';
  return String(edad);
}

function normalizarTextoSimple(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizarModulo(valor, fallback = '') {
  const raw = String(valor || '').trim();
  if (!raw) return String(fallback || '').trim();
  const upper = raw.toUpperCase();
  if (['MII', 'MIS', 'MIE'].includes(upper)) return upper;
  const norm = normalizarTextoSimple(raw);
  if (norm.includes('modulo integral intensivo')) return 'MII';
  if (norm.includes('modulo integral simple')) return 'MIS';
  if (norm.includes('modulo integracion escolar')) return 'MIE';
  return String(fallback || '').trim();
}

function parseActivo(valor, fallback = true) {
  if (valor === undefined || valor === null || valor === '') return Boolean(fallback);
  if (typeof valor === 'boolean') return valor;
  const num = Number(valor);
  if (Number.isFinite(num)) return num !== 0;
  const txt = String(valor).trim().toLowerCase();
  if (['false', 'f', 'no', 'off', 'inactivo', 'inactive', 'no autorizado', 'no_autorizado'].includes(txt)) return false;
  if (['true', 't', 'si', 'on', 'activo', 'active', 'autorizado'].includes(txt)) return true;
  return Boolean(fallback);
}

function parseBaja(valor, fallback = false) {
  if (valor === undefined || valor === null || valor === '') return Boolean(fallback);
  if (typeof valor === 'boolean') return valor;
  const num = Number(valor);
  if (Number.isFinite(num)) return num !== 0;
  const txt = String(valor).trim().toLowerCase();
  if (['false', 'f', 'no', 'off', 'activo', 'active', 'alta', 'habilitado'].includes(txt)) return false;
  if (['true', 't', 'si', 'on', 'baja', 'dado_de_baja', 'dado de baja'].includes(txt)) return true;
  return Boolean(fallback);
}

function calcularTotalFactura(items) {
  if (!Array.isArray(items)) return 0;
  const total = items.reduce((acc, it) => {
    const cantidad = Number(it.cantidad || 1);
    const precioUnitario = Number(it.precioUnitario || it.precio || 0);
    return acc + (cantidad * precioUnitario);
  }, 0);
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('Formateadores y Transformaciones de Datos', () => {
  describe('Desglose y Formateo de Nombres de Pacientes', () => {
    it('debe separar correctamente cuando nombre y apellido ya vienen separados', () => {
      const res = resolverNombreApellido({ nombre: 'Juan Ignacio', apellido: 'García' });
      assert.deepStrictEqual(res, { nombre: 'Juan Ignacio', apellido: 'García' });
    });

    it('debe desglosar un nombre compuesto sin campo apellido', () => {
      const res = resolverNombreApellido({ nombre: 'Lucas Gomez' });
      assert.deepStrictEqual(res, { nombre: 'Lucas', apellido: 'Gomez' });
    });

    it('debe manejar nombres con 4 o más palabras asignando 2 apellidos', () => {
      const res = resolverNombreApellido({ nombre: 'Maria Luz Sanchez Lopez' });
      assert.deepStrictEqual(res, { nombre: 'Maria Luz', apellido: 'Sanchez Lopez' });
    });

    it('debe manejar nombres con una sola palabra', () => {
      const res = resolverNombreApellido({ nombre: 'Valentina' });
      assert.deepStrictEqual(res, { nombre: 'Valentina', apellido: '' });
    });
  });

  describe('Normalización de Fechas y Cálculo de Edad', () => {
    it('debe normalizar fechas válidas en formato YYYY-MM-DD', () => {
      const res = normalizarFecha('2020-05-15');
      assert.deepStrictEqual(res, { year: 2020, month: 5, day: 15 });
    });

    it('debe retornar null para fechas inválidas o días inexistentes (ej: 31 de Febrero)', () => {
      assert.strictEqual(normalizarFecha('2020-02-31'), null);
      assert.strictEqual(normalizarFecha('fecha-invalida'), null);
      assert.strictEqual(normalizarFecha(null), null);
    });

    it('debe calcular la edad correctamente desde la fecha de nacimiento', () => {
      const anioActual = new Date().getFullYear();
      const fecha10Anios = `${anioActual - 10}-01-01`;
      assert.strictEqual(calcularEdadDesdeNacimiento(fecha10Anios), '10');
    });
  });

  describe('Normalización de Módulos Operativos', () => {
    it('debe reconocer siglas exactas MII, MIS, MIE', () => {
      assert.strictEqual(normalizarModulo('mii'), 'MII');
      assert.strictEqual(normalizarModulo('MIS'), 'MIS');
      assert.strictEqual(normalizarModulo('mie'), 'MIE');
    });

    it('debe normalizar descripciones largas a códigos de módulo', () => {
      assert.strictEqual(normalizarModulo('Modulo Integral Intensivo'), 'MII');
      assert.strictEqual(normalizarModulo('modulo integral simple'), 'MIS');
      assert.strictEqual(normalizarModulo('Modulo Integracion Escolar'), 'MIE');
    });

    it('debe retornar fallback cuando el valor no coincide', () => {
      assert.strictEqual(normalizarModulo('Modulo Desconocido', 'N/A'), 'N/A');
    });
  });

  describe('Parseo de Banderas Booleanas (Activo, Autorizado, Baja)', () => {
    it('debe parsear correctamente estados de autorización', () => {
      assert.strictEqual(parseActivo('autorizado'), true);
      assert.strictEqual(parseActivo('activo'), true);
      assert.strictEqual(parseActivo('si'), true);
      assert.strictEqual(parseActivo('1'), true);
      assert.strictEqual(parseActivo('no autorizado'), false);
      assert.strictEqual(parseActivo('inactivo'), false);
      assert.strictEqual(parseActivo('false'), false);
    });

    it('debe parsear correctamente estados de baja', () => {
      assert.strictEqual(parseBaja('dado de baja'), true);
      assert.strictEqual(parseBaja('baja'), true);
      assert.strictEqual(parseBaja('alta'), false);
      assert.strictEqual(parseBaja('activo'), false);
    });
  });

  describe('Cálculo de Totales de Facturación', () => {
    it('debe calcular la suma de items multiplicando cantidad por precio unitario', () => {
      const items = [
        { cantidad: 2, precioUnitario: 1500.50 },
        { cantidad: 1, precioUnitario: 3000 },
        { cantidad: 4, precioUnitario: 500.25 }
      ];
      const total = calcularTotalFactura(items);
      assert.strictEqual(total, 8002.00);
    });

    it('debe retornar 0 para listas vacías o inválidas', () => {
      assert.strictEqual(calcularTotalFactura([]), 0);
      assert.strictEqual(calcularTotalFactura(null), 0);
    });
  });
});
