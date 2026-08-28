'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Importamos o emulamos las funciones de validación de admisiones y pacientes
function validarDatosAdmision({ nombre, apellido, dni, fechaNacimiento, telefono, domicilio, tieneObraSocial, obraSocialNombre }) {
  if (nombre !== undefined) {
    const nom = String(nombre || '').trim();
    if (!nom) return 'El nombre es obligatorio.';
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s'-]{2,60}$/.test(nom)) {
      return 'El nombre solo puede contener letras y espacios (entre 2 y 60 caracteres).';
    }
  }
  if (apellido !== undefined) {
    const ape = String(apellido || '').trim();
    if (!ape) return 'El apellido es obligatorio.';
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s'-]{2,60}$/.test(ape)) {
      return 'El apellido solo puede contener letras y espacios (entre 2 y 60 caracteres).';
    }
  }
  if (dni !== undefined && dni !== null && String(dni).trim() !== '') {
    const dniClean = String(dni).replace(/\D/g, '');
    if (dniClean.length < 6 || dniClean.length > 9) {
      return 'El DNI debe contener entre 6 y 9 dígitos numéricos.';
    }
  }
  if (fechaNacimiento) {
    const d = new Date(fechaNacimiento);
    if (isNaN(d.getTime())) return 'La fecha de nacimiento no es válida.';
    if (d > new Date()) return 'La fecha de nacimiento no puede ser en el futuro.';
    if (d.getFullYear() < 1900) return 'La fecha de nacimiento no es válida.';

    const hoy = new Date();
    let edad = hoy.getFullYear() - d.getFullYear();
    const m = hoy.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < d.getDate())) {
      edad--;
    }
    if (edad < 3) {
      return 'El paciente no puede tener menos de 3 años de edad.';
    }
    if (edad > 18) {
      return 'El paciente no puede tener más de 18 años de edad.';
    }
  }
  if (telefono !== undefined && telefono !== null && String(telefono).trim() !== '') {
    const tel = String(telefono).trim();
    if (!/^[\d\s+()-]{6,25}$/.test(tel)) {
      return 'El teléfono ingresado no tiene un formato válido.';
    }
  }
  if (toBoolean(tieneObraSocial) && (!obraSocialNombre || !String(obraSocialNombre).trim())) {
    return 'Debe seleccionar o indicar el nombre de la Obra Social.';
  }
  return null;
}

function toBoolean(val) {
  if (typeof val === 'boolean') return val;
  if (val === 'true' || val === '1' || val === true) return true;
  return false;
}

function validarExpedienteCompleto(documentosRow) {
  const CAMPOS_REQUERIDOS = [
    'carnet_pdf',
    'cud_pdf',
    'consentimiento_pdf',
    'presupuesto_pdf',
    'informe_pdf',
    'plan_pdf',
    'historial_pdf',
    'pedidos_pdf'
  ];
  const faltantes = [];
  for (const campo of CAMPOS_REQUERIDOS) {
    if (!documentosRow || !documentosRow[campo]) {
      faltantes.push(campo);
    }
  }
  return {
    completo: faltantes.length === 0,
    faltantes
  };
}

describe('Validaciones de Admisión y Pacientes', () => {
  describe('Reglas de Validación de Edad (Entre 3 y 18 años)', () => {
    it('debe rechazar pacientes menores a 3 años de edad', () => {
      const fechaMenor = new Date();
      fechaMenor.setFullYear(fechaMenor.getFullYear() - 2);
      const fechaIso = fechaMenor.toISOString().split('T')[0];

      const err = validarDatosAdmision({
        nombre: 'Mateo',
        apellido: 'González',
        fechaNacimiento: fechaIso
      });
      assert.match(err, /menos de 3 años/i);
    });

    it('debe rechazar pacientes mayores a 18 años de edad', () => {
      const fechaMayor = new Date();
      fechaMayor.setFullYear(fechaMayor.getFullYear() - 25);
      const fechaIso = fechaMayor.toISOString().split('T')[0];

      const err = validarDatosAdmision({
        nombre: 'Carlos',
        apellido: 'Lopez',
        fechaNacimiento: fechaIso
      });
      assert.match(err, /más de 18 años/i);
    });

    it('debe aceptar pacientes en el rango etario permitido (ej. 8 años)', () => {
      const fechaValida = new Date();
      fechaValida.setFullYear(fechaValida.getFullYear() - 8);
      const fechaIso = fechaValida.toISOString().split('T')[0];

      const err = validarDatosAdmision({
        nombre: 'Sofia',
        apellido: 'Martínez',
        dni: '45123987',
        fechaNacimiento: fechaIso,
        telefono: '1145678901'
      });
      assert.strictEqual(err, null);
    });

    it('debe rechazar fechas de nacimiento futuras', () => {
      const fechaFutura = new Date();
      fechaFutura.setFullYear(fechaFutura.getFullYear() + 1);
      const fechaIso = fechaFutura.toISOString().split('T')[0];

      const err = validarDatosAdmision({
        nombre: 'Lucas',
        apellido: 'Perez',
        fechaNacimiento: fechaIso
      });
      assert.match(err, /futuro/i);
    });

    it('debe rechazar fechas de nacimiento anteriores a 1900 o inválidas', () => {
      const err = validarDatosAdmision({
        nombre: 'Lucas',
        apellido: 'Perez',
        fechaNacimiento: '1850-01-01'
      });
      assert.match(err, /no es válida/i);
    });
  });

  describe('Validación de Nombre, Apellido y DNI', () => {
    it('debe rechazar nombres vacíos o con caracteres inválidos', () => {
      assert.strictEqual(validarDatosAdmision({ nombre: ' ' }), 'El nombre es obligatorio.');
      assert.match(validarDatosAdmision({ nombre: 'Juan123' }), /solo puede contener letras/i);
      assert.match(validarDatosAdmision({ nombre: 'J' }), /entre 2 y 60 caracteres/i);
    });

    it('debe aceptar nombres y apellidos válidos con acentos y guiones', () => {
      assert.strictEqual(validarDatosAdmision({ nombre: 'María-José', apellido: 'Ñáñez de la Peña' }), null);
    });

    it('debe validar longitud de DNI numérico (6 a 9 dígitos)', () => {
      assert.match(validarDatosAdmision({ dni: '123' }), /entre 6 y 9 dígitos/i);
      assert.match(validarDatosAdmision({ dni: '12345678901' }), /entre 6 y 9 dígitos/i);
      assert.strictEqual(validarDatosAdmision({ dni: '45.123.456' }), null);
      assert.strictEqual(validarDatosAdmision({ dni: '45123456' }), null);
    });

    it('debe requerir nombre de Obra Social si tieneObraSocial es true', () => {
      const err = validarDatosAdmision({
        nombre: 'Ana',
        apellido: 'Diaz',
        tieneObraSocial: true,
        obraSocialNombre: ''
      });
      assert.match(err, /nombre de la Obra Social/i);
    });
  });

  describe('Validación de Expediente y Documentación (8 PDFs requeridos)', () => {
    it('debe detectar cuando faltan documentos PDF en el expediente', () => {
      const expedienteIncompleto = {
        carnet_pdf: 'carnet.pdf',
        cud_pdf: 'cud.pdf'
      };
      const validacion = validarExpedienteCompleto(expedienteIncompleto);
      assert.strictEqual(validacion.completo, false);
      assert.strictEqual(validacion.faltantes.length, 6);
      assert.ok(validacion.faltantes.includes('consentimiento_pdf'));
    });

    it('debe dar por completado el expediente cuando los 8 PDFs están presentes', () => {
      const expedienteCompleto = {
        carnet_pdf: 'carnet.pdf',
        cud_pdf: 'cud.pdf',
        consentimiento_pdf: 'consentimiento.pdf',
        presupuesto_pdf: 'presupuesto.pdf',
        informe_pdf: 'informe.pdf',
        plan_pdf: 'plan.pdf',
        historial_pdf: 'historial.pdf',
        pedidos_pdf: 'pedidos.pdf'
      };
      const validacion = validarExpedienteCompleto(expedienteCompleto);
      assert.strictEqual(validacion.completo, true);
      assert.strictEqual(validacion.faltantes.length, 0);
    });
  });
});
