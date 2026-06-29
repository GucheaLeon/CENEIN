import React, { useEffect, useMemo, useState } from 'react';
import { usePacientes } from '../context/PatientsContext';
import { useAutenticacion } from '../context/AuthContext';
import { obtenerToken, resolverApiUrl } from '../services/api';

const MESES = [
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
const ANIO_BASE = new Date().getFullYear();
const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const DIAS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'];
const ETIQUETAS_DIAS = {
  Lun: 'Lun',
  Mar: 'Mar',
  Mie: 'Mie',
  Jue: 'Jue',
  Vie: 'Viernes',
};
const ORDEN_DIAS_RESUMEN = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const TRATAMIENTOS_BASE = [
  'Fonoaudiologia',
  'Psicologia',
  'Psicopedagogia',
  'Psicomotricidad',
  'Kinesiologia',
  'TO Terapia Ocupacional',
  'Integracion',
];
const MODULOS_PACIENTE = [
  { id: 'MII', label: 'Modulo integral intensivo (MII)' },
  { id: 'MIS', label: 'Modulo integral simple (MIS)' },
  { id: 'MIE', label: 'Modulo integracion escolar (MIE)' },
];
const ANIOS_ESCOLARES = ['2026', '2027', '2028', '2029', '2030'];

const normalizarModulosPaciente = (valor) => {
  const lista = Array.isArray(valor)
    ? valor
    : String(valor || '')
        .split(',')
        .map((item) => String(item || '').trim().toUpperCase())
        .filter(Boolean);
  return Array.from(new Set(lista.filter((item) => ['MII', 'MIS', 'MIE'].includes(item))));
};

const normalizarAniosEscolares = (valor) => {
  const lista = Array.isArray(valor)
    ? valor
    : String(valor || '')
        .split(',')
        .map((item) => String(item || '').trim())
        .filter(Boolean);
  return Array.from(new Set(lista.filter((item) => ANIOS_ESCOLARES.includes(item))));
};

const generarHorarios = () => {
  const horarios = [];
  const inicio = 8 * 60 + 15;
  const fin = 19 * 60 + 30;
  const paso = 45;
  for (let t = inicio; t <= fin; t += paso) {
    const h = String(Math.floor(t / 60)).padStart(2, '0');
    const m = String(t % 60).padStart(2, '0');
    horarios.push(`${h}:${m}`);
  }
  return horarios;
};

const HORARIOS = generarHorarios();
const HORARIOS_EXTRA_ALTA = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '09:15',
  '09:45',
  '10:45',
  '14:30',
  '14:45',
  '15:15',
  '15:30',
  '16:15',
  '16:45',
  '17:30',
  '17:45',
  '18:15',
  '18:30',
  '19:45',
];
const HORARIOS_POR_OBRA_SOCIAL = {
  ospe: ['8', '9', '10', '11', '12', '14', '15', '16', '17', '18', '19'],
  galeno: ['9', '9.45', '14.45', '15.30', '16.15', '17', '17.45', '18.30'],
  osolsac: [
    '9.15',
    '10',
    '10.45',
    '14.30',
    '15.15',
    '16',
    '16.45',
    '17.30',
    '18.15',
    '19',
    '19.45',
  ],
  omin: ['14', '14.45', '15.30'],
};
const normalizarTexto = (valor) =>
  String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
const toHora = (valor) => {
  const raw = String(valor || '').trim().replace('.', ':');
  if (!raw) return '';
  if (/^\d{1,2}$/.test(raw)) return `${String(Number(raw)).padStart(2, '0')}:00`;
  const m = raw.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return '';
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isInteger(hh) || !Number.isInteger(mm)) return '';
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return '';
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};
const minHora = (hora) => {
  const m = String(hora || '').trim().match(/^(\d{2}):(\d{2})$/);
  if (!m) return Number.MAX_SAFE_INTEGER;
  return Number(m[1]) * 60 + Number(m[2]);
};
const resolverHorariosPorObraSocial = (obraSocialId) => {
  const base = [...HORARIOS, ...HORARIOS_EXTRA_ALTA];
  const os = normalizarTexto(obraSocialId);
  let extras = [];
  if (os.includes('osolsac')) extras = HORARIOS_POR_OBRA_SOCIAL.osolsac;
  else if (os.includes('galeno')) extras = HORARIOS_POR_OBRA_SOCIAL.galeno;
  else if (os.includes('omin') || os.includes('omint')) extras = HORARIOS_POR_OBRA_SOCIAL.omin;
  else if (os === 'ospe' || os.startsWith('ospe ')) extras = HORARIOS_POR_OBRA_SOCIAL.ospe;
  const normalizados = extras.map(toHora).filter(Boolean);
  const set = new Set([...base, ...normalizados]);
  return Array.from(set).sort((a, b) => minHora(a) - minHora(b));
};
const normalizarHora = (valor) => {
  const m = String(valor || '').trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return String(valor || '').trim();
  return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`;
};
const normalizarBooleano = (valor) => {
  if (typeof valor === 'boolean') return valor;
  const num = Number(valor);
  if (Number.isFinite(num)) return num !== 0;
  const txt = String(valor || '').trim().toLowerCase();
  return ['true', 't', 'si', 'on', '1'].includes(txt);
};

const normalizarFechaParaInput = (valor) => {
  if (!valor) return '';
  const raw = String(valor).trim();
  if (!raw) return '';
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const dt = new Date(raw);
  if (!Number.isFinite(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
};

const ordenarDiasResumen = (dias = []) => {
  return Array.from(dias).sort((a, b) => {
    const ia = ORDEN_DIAS_RESUMEN.indexOf(String(a));
    const ib = ORDEN_DIAS_RESUMEN.indexOf(String(b));
    const va = ia === -1 ? 999 : ia;
    const vb = ib === -1 ? 999 : ib;
    if (va !== vb) return va - vb;
    return String(a).localeCompare(String(b));
  });
};

export default function DetallePaciente({ alVolver }) {
  const { usuario } = useAutenticacion();
  const {
    pacientes,
    obrasSociales,
    pacienteSeleccionado,
    refrescarPacientes,
    actualizarPaciente,
    eliminarPaciente,
    agregarTratamientos,
    eliminarTratamiento,
    alternarTurno,
    guardarExcepcionTurno,
    guardarSolicitudPaciente,
    cambiarEstadoOperativo,
  } = usePacientes();
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [obraSocial, setObraSocial] = useState('');
  const [obraSocialPdfId, setObraSocialPdfId] = useState('');
  const [ultimoControlFisiatrico, setUltimoControlFisiatrico] = useState('');
  const [fechaAltaControlFisiatrico, setFechaAltaControlFisiatrico] = useState('');
  const [fechaVencimientoControlFisiatrico, setFechaVencimientoControlFisiatrico] = useState('');
  const [ultimoControlTrabajoSocial, setUltimoControlTrabajoSocial] = useState('');
  const [fechaAltaControlTrabajoSocial, setFechaAltaControlTrabajoSocial] = useState('');
  const [fechaVencimientoControlTrabajoSocial, setFechaVencimientoControlTrabajoSocial] = useState('');
  const [dni, setDni] = useState('');
  const [cuit, setCuit] = useState('');
  const [nroAfiliado, setNroAfiliado] = useState('');
  const [diagnostico, setDiagnostico] = useState('');
  const [modulo, setModulo] = useState([]);
  const [padreTutor, setPadreTutor] = useState('');
  const [telefonoPadreTutor, setTelefonoPadreTutor] = useState('');
  const [madreTutora, setMadreTutora] = useState('');
  const [telefonoMadreTutora, setTelefonoMadreTutora] = useState('');
  const [calle, setCalle] = useState('');
  const [numeracion, setNumeracion] = useState('');
  const [barrio, setBarrio] = useState('');
  const [piso, setPiso] = useState('');
  const [sector, setSector] = useState('');
  const [escuela, setEscuela] = useState('');
  const [anioGrado, setAnioGrado] = useState('');
  const [turnoEscolar, setTurnoEscolar] = useState('');
  const [carAnios, setCarAnios] = useState([]);
  const [ppiAnios, setPpiAnios] = useState([]);
  const [actaAcuerdoAnios, setActaAcuerdoAnios] = useState([]);
  const [integracionHorario, setIntegracionHorario] = useState('');
  const [guardado, setGuardado] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState('');
  const [mostrarHorarios, setMostrarHorarios] = useState(false);
  const [mesesSeleccionados, setMesesSeleccionados] = useState(() => new Set());
  const [mostrarCronogramaBase, setMostrarCronogramaBase] = useState(false);
  const [cronogramaGeneralDraft, setCronogramaGeneralDraft] = useState({});
  const [tratamientoOs, setTratamientoOs] = useState('');
  const [mesOs, setMesOs] = useState(() => new Date().getMonth() + 1);
  const [anioOs, setAnioOs] = useState(() => new Date().getFullYear());
  const [autorizadoDesde, setAutorizadoDesde] = useState('');
  const [autorizadoHasta, setAutorizadoHasta] = useState('');
  const [solicitudFechaInicio, setSolicitudFechaInicio] = useState('');
  const [solicitudFechaFin, setSolicitudFechaFin] = useState('');
  const [solicitudTratamientos, setSolicitudTratamientos] = useState(() => new Set());
  const [modoSolicitudTratamientos, setModoSolicitudTratamientos] = useState('mismos');
  const [aplicarCambiosSolicitud, setAplicarCambiosSolicitud] = useState(true);
  const [mensajeSolicitud, setMensajeSolicitud] = useState('');
  const [errorSolicitud, setErrorSolicitud] = useState('');
  const [guardandoSolicitud, setGuardandoSolicitud] = useState(false);
  
  const [razonDesestimacion, setRazonDesestimacion] = useState('');
  const [mostrandoModalDesestimar, setMostrandoModalDesestimar] = useState(false);
  const estadoOperativo = pacienteSeleccionado?.patient_state_name || 'Nuevo';

  useEffect(() => {
    if (!pacienteSeleccionado) return;
    setNombre(pacienteSeleccionado.nombre || '');
    setApellido(pacienteSeleccionado.apellido || '');
    setFechaNacimiento(normalizarFechaParaInput(pacienteSeleccionado.fechaNacimiento));
    const obraSocialActual = String(pacienteSeleccionado.obraSocial || '').trim();
    setObraSocial(obraSocialActual);
    const existePlantilla = (obrasSociales || []).some(
      (o) =>
        String(o?.id || '').trim() === obraSocialActual &&
        o?.hasTemplate !== false
    );
    setObraSocialPdfId(existePlantilla ? obraSocialActual : '');
    setUltimoControlFisiatrico(
      normalizarFechaParaInput(pacienteSeleccionado.ultimoControlFisiatrico)
    );
    setFechaAltaControlFisiatrico(
      normalizarFechaParaInput(pacienteSeleccionado.fechaAltaControlFisiatrico)
    );
    setFechaVencimientoControlFisiatrico(
      normalizarFechaParaInput(pacienteSeleccionado.fechaVencimientoControlFisiatrico)
    );
    setUltimoControlTrabajoSocial(
      normalizarFechaParaInput(pacienteSeleccionado.ultimoControlTrabajoSocial)
    );
    setFechaAltaControlTrabajoSocial(
      normalizarFechaParaInput(pacienteSeleccionado.fechaAltaControlTrabajoSocial)
    );
    setFechaVencimientoControlTrabajoSocial(
      normalizarFechaParaInput(pacienteSeleccionado.fechaVencimientoControlTrabajoSocial)
    );
    setDni(pacienteSeleccionado.dni || '');
    setCuit(pacienteSeleccionado.cuit || '');
    setNroAfiliado(pacienteSeleccionado.nroAfiliado || '');
    setDiagnostico(pacienteSeleccionado.diagnostico || '');
    setModulo(normalizarModulosPaciente(pacienteSeleccionado.modulos || pacienteSeleccionado.modulo));
    setPadreTutor(pacienteSeleccionado.padreTutor || '');
    setTelefonoPadreTutor(pacienteSeleccionado.telefonoPadreTutor || '');
    setMadreTutora(pacienteSeleccionado.madreTutora || '');
    setTelefonoMadreTutora(pacienteSeleccionado.telefonoMadreTutora || '');
    setCalle(pacienteSeleccionado.calle || '');
    setNumeracion(pacienteSeleccionado.numeracion || '');
    setBarrio(pacienteSeleccionado.barrio || '');
    setPiso(pacienteSeleccionado.piso || '');
    setSector(pacienteSeleccionado.sector || '');
    setEscuela(pacienteSeleccionado.escuela || '');
    setAnioGrado(pacienteSeleccionado.anioGrado || '');
    setTurnoEscolar(pacienteSeleccionado.turnoEscolar || '');
    setCarAnios(normalizarAniosEscolares(pacienteSeleccionado.carAnios));
    setPpiAnios(normalizarAniosEscolares(pacienteSeleccionado.ppiAnios));
    setActaAcuerdoAnios(normalizarAniosEscolares(pacienteSeleccionado.actaAcuerdoAnios));
    setIntegracionHorario(pacienteSeleccionado.integracionHorario || '');
    const listaTrat = Array.isArray(pacienteSeleccionado.tratamientos)
      ? pacienteSeleccionado.tratamientos
      : [];
    setAutorizadoDesde(normalizarFechaParaInput(pacienteSeleccionado.autorizadoDesde));
    setAutorizadoHasta(normalizarFechaParaInput(pacienteSeleccionado.autorizadoHasta));
    setSolicitudFechaInicio('');
    setSolicitudFechaFin('');
    setSolicitudTratamientos(new Set(listaTrat));
    setModoSolicitudTratamientos('mismos');
    setAplicarCambiosSolicitud(true);
    setMensajeSolicitud('');
    setErrorSolicitud('');
    setGuardandoSolicitud(false);
    setMostrarHorarios(false);
    setMostrarCronogramaBase(false);
    setCronogramaGeneralDraft({});
    setTratamientoOs(listaTrat.length ? listaTrat[0] : '');
    setMesesSeleccionados(new Set());
  }, [pacienteSeleccionado, obrasSociales]);

  useEffect(() => {
    const controller = new AbortController();
    refrescarPacientes(controller.signal).catch(() => {});
    return () => controller.abort();
  }, [refrescarPacientes]);

  const resumenTurnos = useMemo(() => {
    if (!pacienteSeleccionado) return {};
    const turnosPorMes = pacienteSeleccionado.turnosPorMes || {};
    const resultado = {};
    Object.keys(turnosPorMes).forEach((mesKey) => {
      const porTratamiento = turnosPorMes[mesKey] || {};
      Object.keys(porTratamiento).forEach((tratamiento) => {
        const lista = porTratamiento[tratamiento] || [];
        if (!lista.length) return;
        if (!resultado[tratamiento]) {
          resultado[tratamiento] = {
            meses: [],
            dias: new Set(),
            horas: new Set(),
          };
        }
        resultado[tratamiento].meses.push(Number(mesKey));
        lista.forEach((clave) => {
          const [dia, hora] = String(clave).split('-');
          if (dia) resultado[tratamiento].dias.add(dia);
          if (hora) resultado[tratamiento].horas.add(hora);
        });
      });
    });
    return resultado;
  }, [pacienteSeleccionado]);

  const overridesMap = useMemo(() => {
    const mapa = {};
    const lista = pacienteSeleccionado?.turnosOverrides || [];
    lista.forEach((o) => {
      if (!o.fecha || !o.tratamiento || !o.hora) return;
      const fecha = String(o.fecha).slice(0, 10);
      const hora = normalizarHora(o.hora);
      const activo = normalizarBooleano(o.activo);
      if (!fecha || !hora) return;
      if (!mapa[fecha]) mapa[fecha] = {};
      if (!mapa[fecha][o.tratamiento]) mapa[fecha][o.tratamiento] = {};
      const previo = mapa[fecha][o.tratamiento][hora];
      if (previo === undefined) {
        mapa[fecha][o.tratamiento][hora] = activo;
      } else {
        mapa[fecha][o.tratamiento][hora] = previo === false || activo === false ? false : true;
      }
    });
    return mapa;
  }, [pacienteSeleccionado]);
  const horariosDisponiblesPaciente = useMemo(
    () =>
      resolverHorariosPorObraSocial(
        String(obraSocialPdfId || obraSocial || pacienteSeleccionado?.obraSocial || '').trim()
      ),
    [obraSocialPdfId, obraSocial, pacienteSeleccionado?.obraSocial]
  );

  const obtenerCalendarioMes = (mes) => {
    const diasEnMes = new Date(ANIO_BASE, mes, 0).getDate();
    const semanas = [];
    let semana = [null, null, null, null, null];
    for (let dia = 1; dia <= diasEnMes; dia += 1) {
      const fecha = new Date(ANIO_BASE, mes - 1, dia);
      const dow = fecha.getDay();
      if (dow === 0 || dow === 6) continue;
      const idx = dow - 1;
      semana[idx] = dia;
      if (dow === 5) {
        semanas.push(semana);
        semana = [null, null, null, null, null];
      }
    }
    if (semana.some((d) => d !== null)) {
      semanas.push(semana);
    }
    return semanas;
  };

  const obtenerHorasBase = (mes, tratamiento) => {
    const turnosMes = (pacienteSeleccionado?.turnosPorMes || {})[mes] || {};
    const lista = turnosMes[tratamiento] || [];
    const porDia = {};
    lista.forEach((clave) => {
      const [dia, hora] = String(clave).split('-');
      if (!dia || !hora) return;
      if (!porDia[dia]) porDia[dia] = [];
      porDia[dia].push(normalizarHora(hora));
    });
    Object.keys(porDia).forEach((d) => porDia[d].sort());
    return porDia;
  };

  const obtenerHorasDia = (mes, tratamiento, diaNumero) => {
    const fecha = new Date(ANIO_BASE, mes - 1, diaNumero);
    const dow = fecha.getDay();
    const diaNombre = DIAS_SEMANA[dow];
    const base = obtenerHorasBase(mes, tratamiento);
    const horasBase = base[diaNombre] || [];
    const fechaStr = `${ANIO_BASE}-${String(mes).padStart(2, '0')}-${String(
      diaNumero
    ).padStart(2, '0')}`;
    const overridesTratamiento =
      overridesMap[fechaStr] && overridesMap[fechaStr][tratamiento]
        ? overridesMap[fechaStr][tratamiento]
        : {};
    const horas = new Set(horasBase);
    Object.keys(overridesTratamiento).forEach((h) => {
      const activo = overridesTratamiento[normalizarHora(h)];
      if (activo) {
        horas.add(normalizarHora(h));
      } else {
        horas.delete(normalizarHora(h));
      }
    });
    return Array.from(horas).sort();
  };

  const alternarExcepcion = (mes, tratamiento, diaNumero, hora, activo) => {
    const fechaStr = `${ANIO_BASE}-${String(mes).padStart(2, '0')}-${String(
      diaNumero
    ).padStart(2, '0')}`;
    guardarExcepcionTurno(
      pacienteSeleccionado.id,
      tratamiento,
      fechaStr,
      hora,
      activo
    );
  };

  const guardarCambios = async (e) => {
    e.preventDefault();
    if (!pacienteSeleccionado) return;
    setErrorGuardado('');
    const nombreLimpio = String(nombre || '').trim();
    const apellidoLimpio = String(apellido || '').trim();
    const fechaNac = String(fechaNacimiento || '').trim();
    const dniLimpio = String(dni || '').trim();
    const cuitLimpio = String(cuit || '').trim();
    const telPadreLimpio = String(telefonoPadreTutor || '').trim();
    const telMadreLimpio = String(telefonoMadreTutora || '').trim();

    if (!nombreLimpio || !apellidoLimpio || !fechaNac) {
      setErrorGuardado('Nombre, apellido y fecha de nacimiento son obligatorios.');
      return;
    }
    const regexNombreAp = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-\']+$/;
    if (!regexNombreAp.test(nombreLimpio) || !regexNombreAp.test(apellidoLimpio)) {
      setErrorGuardado('El nombre y apellido solo pueden contener letras y espacios.');
      return;
    }
    if (!/^\d{7,8}$/.test(dniLimpio)) {
      setErrorGuardado('El DNI debe tener 7 u 8 dígitos numéricos.');
      return;
    }
    if (cuitLimpio && !/^\d{2}\-?\d{8}\-?\d{1}$/.test(cuitLimpio)) {
      setErrorGuardado('El CUIT debe tener 11 dígitos numéricos (ej: 20-12345678-9).');
      return;
    }
    const regexTel = /^[\d\s\-\+\(\)]+$/;
    if (telPadreLimpio && !regexTel.test(telPadreLimpio)) {
      setErrorGuardado('El teléfono del padre/tutor contiene caracteres no válidos.');
      return;
    }
    if (telMadreLimpio && !regexTel.test(telMadreLimpio)) {
      setErrorGuardado('El teléfono de la madre/tutora contiene caracteres no válidos.');
      return;
    }

    try {
      await actualizarPaciente(pacienteSeleccionado.id, {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        fechaNacimiento,
        obraSocial: obraSocial.trim(),
        ultimoControlFisiatrico,
        fechaAltaControlFisiatrico,
        fechaVencimientoControlFisiatrico,
        ultimoControlTrabajoSocial,
        fechaAltaControlTrabajoSocial,
        fechaVencimientoControlTrabajoSocial,
        dni: dni.trim(),
        cuit: cuit.trim(),
        nroAfiliado: nroAfiliado.trim(),
        numeroAfiliado: nroAfiliado.trim(),
        affiliateNumber: nroAfiliado.trim(),
        affiliate_number: nroAfiliado.trim(),
        diagnostico: diagnostico.trim(),
        modulo,
        modulos: modulo,
        padreTutor: padreTutor.trim(),
        telefonoPadreTutor: telefonoPadreTutor.trim(),
        madreTutora: madreTutora.trim(),
        telefonoMadreTutora: telefonoMadreTutora.trim(),
        calle: calle.trim(),
        numeracion: numeracion.trim(),
        barrio: barrio.trim(),
        piso: piso.trim(),
        sector: sector.trim(),
        escuela: escuela.trim(),
        anioGrado: anioGrado.trim(),
        turnoEscolar: turnoEscolar.trim(),
        carAnios,
        ppiAnios,
        actaAcuerdoAnios,
        integracionHorario: integracionHorario.trim(),
        autorizadoDesde: autorizadoDesde || null,
        autorizadoHasta: autorizadoHasta || null,
      });
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
    } catch (err) {
      const msg = String(err?.message || '').trim();
      setErrorGuardado(msg || 'No se pudieron guardar los cambios.');
    }
  };

  const confirmarEliminacion = () => {
    if (!pacienteSeleccionado) return;
    if (!usuario?.isAdmin) return;
    const ok = window.confirm('Estas seguro de eliminar este paciente?');
    if (!ok) return;
    eliminarPaciente(pacienteSeleccionado.id);
    alVolver();
  };

  const confirmarQuitarTratamiento = (tratamiento) => {
    if (!pacienteSeleccionado) return;
    const ok = window.confirm(
      `Estas seguro de quitar el tratamiento ${tratamiento}?`
    );
    if (!ok) return;
    eliminarTratamiento(pacienteSeleccionado.id, tratamiento);
  };

  const alternarMesSeleccionado = (mes) => {
    setMesesSeleccionados((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(mes)) {
        nuevo.delete(mes);
      } else {
        nuevo.add(mes);
      }
      return nuevo;
    });
  };

  const tratamientosDisponibles = useMemo(() => {
    const set = new Set(TRATAMIENTOS_BASE);
    (pacienteSeleccionado?.tratamientos || []).forEach((t) => set.add(t));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [pacienteSeleccionado]);

  const tratamientosSolicitudDisponibles = useMemo(() => {
    return (pacienteSeleccionado?.tratamientos || []).slice().sort((a, b) => a.localeCompare(b, 'es'));
  }, [pacienteSeleccionado?.tratamientos]);

  const historialSolicitudes = useMemo(() => {
    const lista = Array.isArray(pacienteSeleccionado?.solicitudes)
      ? pacienteSeleccionado.solicitudes
      : [];
    return lista
      .slice()
      .sort((a, b) => {
        const fa = String(a?.fechaInicio || '');
        const fb = String(b?.fechaInicio || '');
        return fb.localeCompare(fa, 'es');
      });
  }, [pacienteSeleccionado?.solicitudes]);

  const alternarTratamientoSolicitud = (tratamiento) => {
    setSolicitudTratamientos((prev) => {
      const next = new Set(prev);
      if (next.has(tratamiento)) next.delete(tratamiento);
      else next.add(tratamiento);
      return next;
    });
  };

  const usarMismosTratamientosSolicitud = () => {
    const actuales = Array.isArray(pacienteSeleccionado?.tratamientos)
      ? pacienteSeleccionado.tratamientos
      : [];
    setModoSolicitudTratamientos('mismos');
    setSolicitudTratamientos(new Set(actuales));
    setAplicarCambiosSolicitud(false);
    setMensajeSolicitud('');
    setErrorSolicitud('');
  };

  const usarNuevosTratamientosSolicitud = () => {
    const actuales = Array.isArray(pacienteSeleccionado?.tratamientos)
      ? pacienteSeleccionado.tratamientos
      : [];
    setModoSolicitudTratamientos('nuevos');
    setSolicitudTratamientos(new Set(actuales));
    setAplicarCambiosSolicitud(true);
    setMensajeSolicitud('');
    setErrorSolicitud('');
  };

  const guardarSolicitud = async () => {
    if (!pacienteSeleccionado) return;
    setMensajeSolicitud('');
    setErrorSolicitud('');
    const inicio = String(solicitudFechaInicio || '').trim();
    const fin = String(solicitudFechaFin || '').trim();
    const tratamientos = Array.from(solicitudTratamientos);
    if (!inicio || !fin) {
      setErrorSolicitud('Completa inicio y fin de solicitud.');
      return;
    }
    if (fin < inicio) {
      setErrorSolicitud('La fecha de fin no puede ser anterior al inicio.');
      return;
    }
    const tratamientosFinales =
      modoSolicitudTratamientos === 'mismos'
        ? (Array.isArray(pacienteSeleccionado?.tratamientos)
          ? pacienteSeleccionado.tratamientos.slice()
          : [])
        : tratamientos;
    if (!tratamientosFinales.length) {
      setErrorSolicitud('Selecciona al menos una terapia para la solicitud.');
      return;
    }
    setGuardandoSolicitud(true);
    try {
      await guardarSolicitudPaciente(pacienteSeleccionado.id, {
        fechaInicio: inicio,
        fechaFin: fin,
        tratamientos: tratamientosFinales,
        aplicarTratamientos:
          modoSolicitudTratamientos === 'nuevos' && aplicarCambiosSolicitud,
      });
      setSolicitudFechaInicio('');
      setSolicitudFechaFin('');
      setSolicitudTratamientos(new Set(tratamientosFinales));
      setModoSolicitudTratamientos('mismos');
      setAplicarCambiosSolicitud(true);
      setMensajeSolicitud('Solicitud guardada correctamente.');
    } catch (err) {
      const msg = String(err?.message || '').trim();
      setErrorSolicitud(msg || 'No se pudo guardar la solicitud.');
    } finally {
      setGuardandoSolicitud(false);
    }
  };

  const obrasSocialesDisponibles = useMemo(() => {
    const set = new Set();
    (obrasSociales || []).forEach((o) => {
      const valor = String(o?.id || '').trim();
      if (valor) set.add(valor);
    });
    (pacientes || []).forEach((p) => {
      const valor = String(p.obraSocial || '').trim();
      if (valor) set.add(valor);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [pacientes, obrasSociales]);

  const diagnosticosDisponibles = useMemo(() => {
    const set = new Set();
    (pacientes || []).forEach((p) => {
      const valor = String(p?.diagnostico || '').trim();
      if (valor) set.add(valor);
    });
    const actual = String(diagnostico || '').trim();
    if (actual) set.add(actual);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [pacientes, diagnostico]);

  const obrasSocialesPorId = useMemo(() => {
    const mapa = {};
    (obrasSociales || []).forEach((o) => {
      if (!o?.id) return;
      mapa[String(o.id)] = o.label || o.id;
    });
    return mapa;
  }, [obrasSociales]);

  const ordenarObrasSociales = useMemo(() => {
    return (obrasSociales || [])
      .filter((o) => o?.id)
      .slice()
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }, [obrasSociales]);

  const descargarObraSocial = async () => {
    if (!pacienteSeleccionado) return;
    const obraSocialId = String(obraSocialPdfId || '').trim();
    if (!obraSocialId) {
      const obraActual = String(obraSocial || '').trim();
      const obraConfig = (obrasSociales || []).find(
        (o) => String(o?.id || '').trim() === obraActual
      );
      if (obraConfig && obraConfig.hasTemplate === false) {
        window.alert('La obra social seleccionada existe, pero no tiene plantilla para imprimir.');
        return;
      }
      window.alert(
        'Selecciona una obra social desde "Lista de obras sociales (carpeta - CUIT)" para generar el PDF.'
      );
      return;
    }
    if (!String(tratamientoOs || '').trim()) {
      window.alert('Selecciona un tratamiento para generar la planilla.');
      return;
    }
    const mesNum = Number(mesOs);
    const anioNum = Number(anioOs);
    if (!Number.isInteger(mesNum) || mesNum < 1 || mesNum > 12) {
      window.alert('Mes inválido.');
      return;
    }
    if (!Number.isInteger(anioNum) || anioNum < 2000 || anioNum > 2100) {
      window.alert('Año inválido.');
      return;
    }
    const url = `/api/patients/${encodeURIComponent(
      pacienteSeleccionado.id
    )}/obras-sociales/${encodeURIComponent(obraSocialId)}?tratamiento=${encodeURIComponent(
      String(tratamientoOs).trim()
    )}&mes=${encodeURIComponent(String(mesNum))}&anio=${encodeURIComponent(
      String(anioNum)
    )}`;
    const finalUrl = resolverApiUrl(url) || url;
    const token = obtenerToken();
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      const respuesta = await fetch(finalUrl, {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      if (!respuesta.ok) {
        let mensaje = `Error ${respuesta.status}`;
        try {
          const data = await respuesta.json();
          if (data && data.error) mensaje = data.error;
        } catch (err) {}
        window.alert(`No se pudo descargar el PDF: ${mensaje}`);
        return;
      }
      const blob = await respuesta.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = blobUrl;
      enlace.download = `${obraSocialId}.pdf`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      window.alert('No se pudo descargar el PDF. Revisa la conexión con el servidor.');
    }
  };

  const turnosPorMes = pacienteSeleccionado?.turnosPorMes || {};

  const claveEnTodosLosMeses = (tratamiento, clave) => {
    for (let mes = 1; mes <= 12; mes += 1) {
      const lista = (turnosPorMes[mes] || {})[tratamiento] || [];
      if (!lista.includes(clave)) return false;
    }
    return true;
  };

  const alternarTurnoTodosLosMeses = (tratamiento, clave, target) => {
    if (!pacienteSeleccionado) return;
    for (let mes = 1; mes <= 12; mes += 1) {
      const lista = (turnosPorMes[mes] || {})[tratamiento] || [];
      const tiene = lista.includes(clave);
      if (target && !tiene) {
        alternarTurno(pacienteSeleccionado.id, tratamiento, clave, mes);
      } else if (!target && tiene) {
        alternarTurno(pacienteSeleccionado.id, tratamiento, clave, mes);
      }
    }
  };

  const obtenerMarcadoGeneral = (tratamiento, clave) => {
    const draft = cronogramaGeneralDraft[tratamiento];
    if (draft && Object.prototype.hasOwnProperty.call(draft, clave)) {
      return draft[clave];
    }
    return claveEnTodosLosMeses(tratamiento, clave);
  };

  const alternarDraftGeneral = (tratamiento, clave) => {
    setCronogramaGeneralDraft((prev) => {
      const actual = obtenerMarcadoGeneral(tratamiento, clave);
      const siguiente = !actual;
      const copiaTrat = { ...(prev[tratamiento] || {}) };
      const [dia] = String(clave).split('-');
      if (siguiente && dia) {
        horariosDisponiblesPaciente.forEach((h) => {
          copiaTrat[`${dia}-${h}`] = false;
        });
      }
      copiaTrat[clave] = siguiente;
      return { ...prev, [tratamiento]: copiaTrat };
    });
  };

  const hayCambiosGeneral = Object.values(cronogramaGeneralDraft).some(
    (t) => Object.keys(t || {}).length
  );

  const guardarCronogramaGeneral = () => {
    if (!pacienteSeleccionado) return;
    Object.entries(cronogramaGeneralDraft).forEach(([tratamiento, mapa]) => {
      Object.entries(mapa || {}).forEach(([clave, target]) => {
        alternarTurnoTodosLosMeses(tratamiento, clave, target);
      });
    });
    setCronogramaGeneralDraft({});
  };

  const descartarCronogramaGeneral = () => {
    setCronogramaGeneralDraft({});
  };

  const alternarTratamientoPaciente = (tratamiento, activo) => {
    if (!pacienteSeleccionado || !tratamiento) return;
    const actuales = pacienteSeleccionado.tratamientos || [];
    if (activo) {
      if (actuales.includes(tratamiento)) return;
      agregarTratamientos(pacienteSeleccionado.id, [tratamiento]);
    } else {
      if (!actuales.includes(tratamiento)) return;
      confirmarQuitarTratamiento(tratamiento);
    }
  };

  if (!pacienteSeleccionado) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="py-16 text-center rounded-2xl border-2 border-dashed border-surface-200 bg-surface-50/50">
          <p className="text-surface-600 font-medium">No hay paciente seleccionado.</p>
          <button
            onClick={alVolver}
            className="mt-4 px-4 py-2.5 rounded-xl text-sm font-medium bg-surface-200 text-surface-800 hover:bg-surface-300 transition-colors duration-200"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  const inputBase = "w-full px-4 py-2.5 rounded-lg border border-surface-200 bg-white text-surface-800 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all duration-200";
  const labelBase = "block text-sm font-medium text-surface-700 mb-1.5";
  const seccionBase = "rounded-[28px] border border-surface-200/80 bg-gradient-to-br from-white to-surface-50/60 p-5 mb-5 shadow-sm shadow-black/5";
  const tituloSeccion = "text-sm font-semibold text-primary-700 uppercase tracking-wide mb-4 mt-0";

  const errorNombre = (nombre && !/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-\']+$/.test(nombre)) ? 'Solo se permiten letras y espacios.' : '';
  const errorApellido = (apellido && !/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-\']+$/.test(apellido)) ? 'Solo se permiten letras y espacios.' : '';
  const errorDni = (dni && !/^\d{7,8}$/.test(dni)) ? 'Debe tener 7 u 8 dígitos numéricos.' : '';
  const errorCuit = (cuit && !/^\d{2}\-?\d{8}\-?\d{1}$/.test(cuit)) ? 'Debe tener 11 dígitos numéricos.' : '';
  const errorTelPadre = (telefonoPadreTutor && !/^[\d\s\-\+\(\)]+$/.test(telefonoPadreTutor)) ? 'Solo se permiten números y símbolos telefónicos.' : '';
  const errorTelMadre = (telefonoMadreTutora && !/^[\d\s\-\+\(\)]+$/.test(telefonoMadreTutora)) ? 'Solo se permiten números y símbolos telefónicos.' : '';

  const labelObligatorio = (texto) => (
    <label className={labelBase}>
      {texto} <span className="text-rose-500 font-bold ml-1">*</span>
    </label>
  );

  const getInputClass = (err) => `w-full px-4 py-2.5 rounded-lg border bg-white text-surface-800 placeholder:text-surface-400 focus:outline-none focus:ring-2 transition-all duration-200 ${err ? 'border-rose-500/50 focus:ring-rose-500/30 focus:border-rose-500' : 'border-surface-200 focus:ring-primary-500/30 focus:border-primary-500'}`;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="mb-10 flex flex-col gap-6 rounded-[28px] border border-surface-200/70 bg-gradient-to-r from-primary-50/80 via-white to-white p-5 md:flex-row md:items-end md:justify-between sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            onClick={alVolver}
            className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/20 bg-white px-4 py-2.5 text-sm font-medium text-on-surface transition-all duration-200 hover:bg-surface-container hover:border-outline-variant/40"
          >
            <span className="material-symbols-outlined text-base" aria-hidden>arrow_back</span>
            Volver
          </button>
          <h2 className="text-3xl font-extrabold tracking-tight text-on-surface">
            Detalle del paciente
          </h2>
        </div>
        <div className="text-sm text-on-surface-variant">
          Gestion de historia clinica, autorizaciones y cronograma terapeutico.
        </div>
      </div>

      <div className={seccionBase}>
        <h4 className={tituloSeccion}>Flujo Operativo (Máquina de Estados)</h4>
        <div className="flex flex-col md:flex-row items-center justify-between bg-surface-100 p-4 rounded-xl border border-surface-200 gap-4">
          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-full font-bold text-sm tracking-wide shadow-sm
              ${estadoOperativo === 'Nuevo' ? 'bg-blue-100 text-blue-800' :
                estadoOperativo === 'En_admision' ? 'bg-amber-100 text-amber-800' :
                estadoOperativo === 'En_expediente' ? 'bg-indigo-100 text-indigo-800' :
                estadoOperativo === 'Desestimado' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'}`}>
              {String(estadoOperativo).replace('_', ' ').toUpperCase()}
            </div>
            <p className="text-sm text-surface-600">
              {estadoOperativo === 'Nuevo' && 'Paciente recién registrado.'}
              {estadoOperativo === 'En_admision' && 'Validando obra social y datos.'}
              {estadoOperativo === 'En_expediente' && 'Armando expediente para auditoría.'}
              {estadoOperativo === 'Desestimado' && 'El paciente no cumple con los requisitos.'}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {estadoOperativo === 'Nuevo' && (
              <button
                type="button"
                onClick={() => cambiarEstadoOperativo(pacienteSeleccionado.id, 'En_admision')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium shadow-sm hover:bg-blue-700 transition-colors"
              >
                Iniciar Admisión
              </button>
            )}
            {estadoOperativo === 'En_admision' && (
              <>
                <button
                  type="button"
                  onClick={() => cambiarEstadoOperativo(pacienteSeleccionado.id, 'En_expediente')}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium shadow-sm hover:bg-indigo-700 transition-colors"
                >
                  Validación Exitosa (Pasar a Expediente)
                </button>
                <button
                  type="button"
                  onClick={() => setMostrandoModalDesestimar(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium shadow-sm hover:bg-red-700 transition-colors"
                >
                  Desestimar
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {mostrandoModalDesestimar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Desestimar Paciente</h3>
            <p className="text-sm text-gray-600 mb-4">¿Por qué se desestima este paciente? (ej. falta CUD, obra social inválida)</p>
            <textarea
              className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none mb-4"
              rows={3}
              value={razonDesestimacion}
              onChange={(e) => setRazonDesestimacion(e.target.value)}
              placeholder="Motivo del rechazo..."
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setMostrandoModalDesestimar(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  cambiarEstadoOperativo(pacienteSeleccionado.id, 'Desestimado', razonDesestimacion);
                  setMostrandoModalDesestimar(false);
                  setRazonDesestimacion('');
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium shadow-sm"
              >
                Confirmar Desestimación
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={guardarCambios} className="">
        <div className={seccionBase}>
          <h4 className={tituloSeccion}>Paciente</h4>
          <div className="space-y-4">
            <div>
              {labelObligatorio('Nombre')}
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className={getInputClass(errorNombre)}
              />
              {errorNombre && <p className="text-xs text-rose-500 mt-1 ml-1 font-medium">{errorNombre}</p>}
            </div>
            <div>
              {labelObligatorio('Apellido')}
              <input
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                className={getInputClass(errorApellido)}
              />
              {errorApellido && <p className="text-xs text-rose-500 mt-1 ml-1 font-medium">{errorApellido}</p>}
            </div>
            <div>
              {labelObligatorio('Fecha de nacimiento')}
              <input
                type="date"
                value={fechaNacimiento}
                onChange={(e) => setFechaNacimiento(e.target.value)}
                className={inputBase}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelBase}>Último control fisiatrico</label>
                <input
                  type="date"
                  value={ultimoControlFisiatrico}
                  onChange={(e) => setUltimoControlFisiatrico(e.target.value)}
                  className={inputBase}
                />
              </div>
              <div>
                <label className={labelBase}>Vencimiento control fisiatrico</label>
                <input
                  type="date"
                  value={fechaVencimientoControlFisiatrico}
                  onChange={(e) => setFechaVencimientoControlFisiatrico(e.target.value)}
                  className={inputBase}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelBase}>Último control de trabajo social</label>
                <input
                  type="date"
                  value={ultimoControlTrabajoSocial}
                  onChange={(e) => setUltimoControlTrabajoSocial(e.target.value)}
                  className={inputBase}
                />
              </div>
              <div>
                <label className={labelBase}>Vencimiento de trabajo social</label>
                <input
                  type="date"
                  value={fechaVencimientoControlTrabajoSocial}
                  onChange={(e) => setFechaVencimientoControlTrabajoSocial(e.target.value)}
                  className={inputBase}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                {labelObligatorio('DNI')}
                <input
                  value={dni}
                  onChange={(e) =>
                    setDni(String(e.target.value || '').replace(/\D/g, '').slice(0, 8))
                  }
                  inputMode="numeric"
                  maxLength={8}
                  className={getInputClass(errorDni)}
                />
                {errorDni && <p className="text-xs text-rose-500 mt-1 ml-1 font-medium">{errorDni}</p>}
              </div>
              <div>
                <label className={labelBase}>CUIT</label>
                <input value={cuit} onChange={(e) => setCuit(e.target.value)} className={getInputClass(errorCuit)} />
                {errorCuit && <p className="text-xs text-rose-500 mt-1 ml-1 font-medium">{errorCuit}</p>}
              </div>
              <div>
                <label className={labelBase}>N° afiliado</label>
                <input value={nroAfiliado} onChange={(e) => setNroAfiliado(e.target.value)} className={inputBase} />
              </div>
            </div>
            <div>
              <label className={labelBase}>Diagnóstico</label>
              <input
                value={diagnostico}
                onChange={(e) => setDiagnostico(e.target.value)}
                list="diagnosticos-paciente"
                className={inputBase}
              />
              <datalist id="diagnosticos-paciente">
                {diagnosticosDisponibles.map((d) => (
                  <option key={`diag-p-${d}`} value={d} />
                ))}
              </datalist>
            </div>
            <div>
              <label className={labelBase}>Modulo</label>
              <div className="mt-2 flex flex-wrap gap-3">
                {MODULOS_PACIENTE.map((m) => (
                  <label
                    key={m.id}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-surface-200 hover:border-surface-300 cursor-pointer transition-colors duration-200"
                  >
                    <input
                      type="checkbox"
                      checked={modulo.includes(m.id)}
                      onChange={() =>
                        setModulo((prev) =>
                          prev.includes(m.id)
                            ? prev.filter((item) => item !== m.id)
                            : [...prev, m.id]
                        )
                      }
                      className="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="pt-2 border-t border-surface-200">
              <h5 className="text-sm font-semibold text-surface-800 mb-3">Autorización</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelBase}>Autorizado desde</label>
                  <input
                    type="date"
                    value={autorizadoDesde}
                    onChange={(e) => setAutorizadoDesde(e.target.value)}
                    className={inputBase}
                  />
                </div>
                <div>
                  <label className={labelBase}>Vence el</label>
                  <input
                    type="date"
                    value={autorizadoHasta}
                    onChange={(e) => setAutorizadoHasta(e.target.value)}
                    className={inputBase}
                  />
                </div>
              </div>
            </div>
            <div>
              <label className={labelBase}>CAR</label>
              <div className="mt-2 flex flex-wrap gap-3">
                {ANIOS_ESCOLARES.map((anio) => (
                  <label
                    key={`car-modulo-${anio}`}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-surface-200 hover:border-surface-300 cursor-pointer transition-colors duration-200"
                  >
                    <input
                      type="checkbox"
                      checked={carAnios.includes(anio)}
                      onChange={() =>
                        setCarAnios((prev) =>
                          prev.includes(anio)
                            ? prev.filter((item) => item !== anio)
                            : [...prev, anio]
                        )
                      }
                      className="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                    />
                    {anio}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className={labelBase}>PPI</label>
              <div className="mt-2 flex flex-wrap gap-3">
                {ANIOS_ESCOLARES.map((anio) => (
                  <label
                    key={`ppi-modulo-${anio}`}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-surface-200 hover:border-surface-300 cursor-pointer transition-colors duration-200"
                  >
                    <input
                      type="checkbox"
                      checked={ppiAnios.includes(anio)}
                      onChange={() =>
                        setPpiAnios((prev) =>
                          prev.includes(anio)
                            ? prev.filter((item) => item !== anio)
                            : [...prev, anio]
                        )
                      }
                      className="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                    />
                    {anio}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className={labelBase}>Acta Acuerdo</label>
              <div className="mt-2 flex flex-wrap gap-3">
                {ANIOS_ESCOLARES.map((anio) => (
                  <label
                    key={`acta-acuerdo-modulo-${anio}`}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-surface-200 hover:border-surface-300 cursor-pointer transition-colors duration-200"
                  >
                    <input
                      type="checkbox"
                      checked={actaAcuerdoAnios.includes(anio)}
                      onChange={() =>
                        setActaAcuerdoAnios((prev) =>
                          prev.includes(anio)
                            ? prev.filter((item) => item !== anio)
                            : [...prev, anio]
                        )
                      }
                      className="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                    />
                    {anio}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className={seccionBase}>
          <h4 className={tituloSeccion}>Escuela</h4>
          <div className="space-y-4">
            <div>
              <label className={labelBase}>Escuela</label>
              <input
                value={escuela}
                onChange={(e) => setEscuela(e.target.value)}
                className={inputBase}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelBase}>Año/Grado</label>
                <input
                  value={anioGrado}
                  onChange={(e) => setAnioGrado(e.target.value)}
                  className={inputBase}
                />
              </div>
              <div>
                <label className={labelBase}>Turno escolar</label>
                <select
                  value={turnoEscolar}
                  onChange={(e) => setTurnoEscolar(e.target.value)}
                  className={inputBase}
                >
                  <option value="">(Seleccionar)</option>
                  <option value="manana">Mañana</option>
                  <option value="tarde">Tarde</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <div className={seccionBase}>
          <h4 className={tituloSeccion}>Padres</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelBase}>Padre/Tutor</label>
              <input
                value={padreTutor}
                onChange={(e) => setPadreTutor(e.target.value)}
                className={inputBase}
              />
            </div>
            <div>
              <label className={labelBase}>Teléfono Padre/Tutor</label>
              <input
                value={telefonoPadreTutor}
                onChange={(e) => setTelefonoPadreTutor(e.target.value)}
                className={getInputClass(errorTelPadre)}
              />
              {errorTelPadre && <p className="text-xs text-rose-500 mt-1 ml-1 font-medium">{errorTelPadre}</p>}
            </div>
            <div>
              <label className={labelBase}>Madre/Tutora</label>
              <input
                value={madreTutora}
                onChange={(e) => setMadreTutora(e.target.value)}
                className={inputBase}
              />
            </div>
            <div>
              <label className={labelBase}>Teléfono Madre/Tutora</label>
              <input
                value={telefonoMadreTutora}
                onChange={(e) => setTelefonoMadreTutora(e.target.value)}
                className={getInputClass(errorTelMadre)}
              />
              {errorTelMadre && <p className="text-xs text-rose-500 mt-1 ml-1 font-medium">{errorTelMadre}</p>}
            </div>
          </div>
        </div>
        <div className={seccionBase}>
          <h4 className={tituloSeccion}>Domicilio</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className={labelBase}>Calle</label>
              <input
                value={calle}
                onChange={(e) => setCalle(e.target.value)}
                className={inputBase}
              />
            </div>
            <div>
              <label className={labelBase}>Numeración</label>
              <input
                value={numeracion}
                onChange={(e) => setNumeracion(e.target.value)}
                className={inputBase}
              />
            </div>
            <div>
              <label className={labelBase}>Barrio</label>
              <input
                value={barrio}
                onChange={(e) => setBarrio(e.target.value)}
                className={inputBase}
              />
            </div>
            <div>
              <label className={labelBase}>Piso</label>
              <input
                value={piso}
                onChange={(e) => setPiso(e.target.value)}
                className={inputBase}
              />
            </div>
            <div>
              <label className={labelBase}>Sector</label>
              <input
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className={inputBase}
              />
            </div>
          </div>
        </div>

        <div className={seccionBase}>
          <h4 className={tituloSeccion}>Obra social</h4>
          <div className="space-y-4">
            <div>
              <label className={labelBase}>Obra social</label>
              <select
                value={String(obraSocial || '').trim()}
                onChange={(e) => {
                  const val = e.target.value;
                  setObraSocial(val);
                  setObraSocialPdfId(val);
                }}
                className={inputBase}
              >
                <option value="">(Seleccionar)</option>
                {obrasSocialesDisponibles.map((o) => {
                  const apiData = obrasSociales.find(osObj => osObj.id === o);
                  const showSinPlantilla = apiData && apiData.hasTemplate === false;
                  const isMissing = !apiData;
                  return (
                    <option key={`os-${o}`} value={o}>
                      {o}{(showSinPlantilla || isMissing) ? ' (sin plantilla)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelBase}>Tratamiento (planilla)</label>
                <select
                  value={tratamientoOs}
                  onChange={(e) => setTratamientoOs(e.target.value)}
                  className={inputBase}
                >
                  <option value="">(Seleccionar)</option>
                  {(pacienteSeleccionado.tratamientos || []).map((t) => (
                    <option key={`t-os-${t}`} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelBase}>Mes (planilla)</label>
                <select
                  value={String(mesOs)}
                  onChange={(e) => setMesOs(Number(e.target.value))}
                  className={inputBase}
                >
                  {MESES.map((m, idx) => (
                    <option key={`mes-os-${idx + 1}`} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelBase}>Año (planilla)</label>
                <input
                  value={String(anioOs)}
                  onChange={(e) => setAnioOs(e.target.value)}
                  className={inputBase}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={descargarObraSocial}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-primary-600 text-white shadow-sm hover:bg-primary-500 active:bg-primary-600 transition-all duration-200"
            >
              Descargar PDF de obra social
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-500 active:bg-primary-600 transition-colors duration-200"
          >
            Guardar cambios
          </button>
          {usuario?.isAdmin ? (
            <button
              type="button"
              onClick={confirmarEliminacion}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300 transition-colors duration-200"
            >
              Eliminar paciente
            </button>
          ) : null}
          {guardado ? (
            <span className="text-primary-600 font-medium text-sm">Cambios guardados.</span>
          ) : null}
          {errorGuardado ? (
            <span className="text-rose-600 font-medium text-sm">{errorGuardado}</span>
          ) : null}
        </div>
      </form>

      <div className={seccionBase}>
        <h3 className="text-base font-semibold text-surface-900 mb-2">Tratamientos</h3>
        <p className="text-surface-500 text-sm mb-4">
          Marca o desmarca tratamientos para este paciente.
        </p>
        <div className="flex flex-wrap gap-2 mb-6">
          {tratamientosDisponibles.map((t) => {
            const checked = (pacienteSeleccionado.tratamientos || []).includes(t);
            return (
              <label
                key={`trat-${t}`}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors duration-200 ${
                  checked ? 'border-primary-300 bg-primary-50 text-primary-800' : 'border-surface-200 hover:border-surface-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => alternarTratamientoPaciente(t, e.target.checked)}
                  className="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                />
                {t}
              </label>
            );
          })}
        </div>

        <h3 className="text-base font-semibold text-surface-900 mb-3">Tratamientos y meses</h3>
        {(pacienteSeleccionado.tratamientos || []).length ? (
          <div className="flex flex-wrap gap-3">
            {pacienteSeleccionado.tratamientos.map((t) => {
              const resumen = resumenTurnos[t];
              return (
                <div
                  key={t}
                  className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-surface-200 bg-surface-50/50"
                >
                  <strong className="text-surface-800">{t}</strong>
                  <span className="text-surface-600 text-sm">
                    {resumen && resumen.dias.size
                      ? `Días: ${ordenarDiasResumen(resumen.dias).join(', ')}`
                      : 'Días: -'}
                  </span>
                  <span className="text-surface-600 text-sm">
                    {resumen && resumen.horas.size
                      ? `Horarios: ${Array.from(resumen.horas).sort().join(', ')}`
                      : 'Horarios: -'}
                  </span>
                  <button
                    type="button"
                    onClick={() => confirmarQuitarTratamiento(t)}
                    className="ml-auto px-3 py-1.5 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors duration-200"
                  >
                    Quitar
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-surface-500 text-sm">Sin tratamientos.</p>
        )}
      </div>

      <div className={seccionBase}>
        <h3 className="text-base font-semibold text-surface-900 mb-2">Solicitud</h3>
        <p className="text-surface-500 text-sm mb-4">
          Carga períodos de solicitud con terapias. Puedes dejar preguardada la próxima antes del vencimiento.
        </p>
        <div className="mb-4">
          <div className="text-sm text-surface-600 mb-2">
            <strong>Tratamientos actuales:</strong>{' '}
            {(pacienteSeleccionado.tratamientos || []).length
              ? (pacienteSeleccionado.tratamientos || []).join(', ')
              : '-'}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={usarMismosTratamientosSolicitud}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors duration-200 ${
                modoSolicitudTratamientos === 'mismos'
                  ? 'border-primary-300 bg-primary-50 text-primary-800'
                  : 'border-surface-200 text-surface-700 hover:bg-surface-100'
              }`}
            >
              Mismos tratamientos
            </button>
            <button
              type="button"
              onClick={usarNuevosTratamientosSolicitud}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors duration-200 ${
                modoSolicitudTratamientos === 'nuevos'
                  ? 'border-primary-300 bg-primary-50 text-primary-800'
                  : 'border-surface-200 text-surface-700 hover:bg-surface-100'
              }`}
            >
              Nuevos tratamientos
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelBase}>Inicio solicitud</label>
            <input
              type="date"
              value={solicitudFechaInicio}
              onChange={(e) => setSolicitudFechaInicio(e.target.value)}
              className={inputBase}
            />
          </div>
          <div>
            <label className={labelBase}>Fin solicitud</label>
            <input
              type="date"
              value={solicitudFechaFin}
              onChange={(e) => setSolicitudFechaFin(e.target.value)}
              className={inputBase}
            />
          </div>
        </div>
        <div className="mb-4">
          <label className={labelBase}>Terapias de la solicitud</label>
          {modoSolicitudTratamientos === 'mismos' ? (
            <p className="text-surface-600 text-sm">
              Se usarán los tratamientos actuales del paciente para esta solicitud.
            </p>
          ) : tratamientosSolicitudDisponibles.length ? (
            <div className="flex flex-wrap gap-2">
              {tratamientosSolicitudDisponibles.map((t) => {
                const checked = solicitudTratamientos.has(t);
                return (
                  <label
                    key={`sol-${t}`}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors duration-200 ${
                      checked
                        ? 'border-primary-300 bg-primary-50 text-primary-800'
                        : 'border-surface-200 hover:border-surface-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => alternarTratamientoSolicitud(t)}
                      className="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                    />
                    {t}
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="text-surface-500 text-sm">
              Este paciente todavía no tiene terapias asignadas.
            </p>
          )}
        </div>
        {modoSolicitudTratamientos === 'nuevos' ? (
          <label className="inline-flex items-center gap-2 text-sm text-surface-700 mb-4">
            <input
              type="checkbox"
              checked={aplicarCambiosSolicitud}
              onChange={(e) => setAplicarCambiosSolicitud(e.target.checked)}
              className="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
            />
            Aplicar nuevos tratamientos automáticamente desde la fecha de inicio
          </label>
        ) : null}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <button
            type="button"
            onClick={guardarSolicitud}
            disabled={guardandoSolicitud}
            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-500 active:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {guardandoSolicitud ? 'Guardando solicitud...' : 'Guardar solicitud'}
          </button>
          {mensajeSolicitud ? (
            <span className="text-primary-600 font-medium text-sm">{mensajeSolicitud}</span>
          ) : null}
          {errorSolicitud ? (
            <span className="text-rose-600 font-medium text-sm">{errorSolicitud}</span>
          ) : null}
        </div>
        <div className="pt-4 border-t border-surface-200">
          <h4 className="text-sm font-semibold text-surface-800 mb-3">
            Historial de solicitudes (últimos 12 meses)
          </h4>
          {historialSolicitudes.length ? (
            <div className="space-y-2">
              {historialSolicitudes.map((sol) => (
                <div
                  key={`hist-sol-${sol.id}`}
                  className="rounded-lg border border-surface-200 bg-surface-50/60 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <strong className="text-surface-800">
                      {sol.fechaInicio || '-'} a {sol.fechaFin || '-'}
                    </strong>
                    <span className="text-xs px-2 py-0.5 rounded-full border border-surface-200 text-surface-600 bg-white">
                      {sol.vigente ? 'Vigente' : sol.futura ? 'Futura' : 'Vencida'}
                    </span>
                  </div>
                  <div className="text-sm text-surface-600">
                    Terapias: {(sol.tratamientos || []).length ? sol.tratamientos.join(', ') : '-'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-surface-500 text-sm">Sin solicitudes registradas en el último año.</p>
          )}
        </div>
      </div>

      <div className={seccionBase}>
        <button
          type="button"
          onClick={() => setMostrarCronogramaBase((prev) => !prev)}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-medium bg-surface-100 text-surface-700 hover:bg-surface-200 border border-surface-200 transition-colors duration-200"
        >
          {mostrarCronogramaBase
            ? 'Ocultar Cronograma general'
            : 'Cronograma general'}
        </button>
        {mostrarCronogramaBase ? (
          <div className="mt-4 space-y-4">
            {(pacienteSeleccionado.tratamientos || []).length ? (
              (pacienteSeleccionado.tratamientos || []).map((t) => (
                <div key={`cronograma-${t}`} className="pt-4 border-t border-surface-200 first:pt-0 first:border-t-0">
                  <strong className="text-surface-800">{t}</strong>
                  {t === 'Integracion' ? (
                    <div className="mt-3">
                      <label className={labelBase}>Horario de Integración (texto libre)</label>
                      <textarea
                        value={integracionHorario}
                        onChange={(e) => setIntegracionHorario(e.target.value)}
                        rows={3}
                        className={`${inputBase} resize-y`}
                        placeholder="Ej: Lunes y Miércoles 14:00 a 15:00"
                      />
                    </div>
                  ) : (
                    <div className="overflow-x-auto mt-3">
                      <table className="w-full min-w-[500px] table-fixed border-collapse">
                        <thead>
                          <tr>
                            <th className="text-left p-2 text-sm font-medium text-surface-600">Hora</th>
                            {DIAS.map((d) => (
                              <th key={`dia-${d}`} className="text-left p-2 text-sm font-medium text-surface-600">
                                {ETIQUETAS_DIAS[d] || d}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {horariosDisponiblesPaciente.map((hora) => (
                            <tr key={`hora-${hora}`}>
                              <td className="p-2 whitespace-nowrap text-sm text-surface-600">
                                {hora}
                              </td>
                              {DIAS.map((dia) => {
                                const clave = `${dia}-${hora}`;
                                const marcado = obtenerMarcadoGeneral(t, clave);
                                return (
                                  <td key={clave} className="p-2">
                                    <input
                                      type="checkbox"
                                      checked={marcado}
                                      onChange={() => alternarDraftGeneral(t, clave)}
                                      className="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-surface-500 text-sm">Asigna tratamientos para habilitar el cronograma.</p>
            )}
            <div className="flex flex-wrap items-center gap-3 pt-4">
              <button
                type="button"
                onClick={guardarCronogramaGeneral}
                disabled={!hayCambiosGeneral}
                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-500 active:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Guardar cronograma general
              </button>
              <button
                type="button"
                onClick={descartarCronogramaGeneral}
                disabled={!hayCambiosGeneral}
                className="px-4 py-2.5 rounded-xl text-sm font-medium border border-surface-200 text-surface-700 hover:bg-surface-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Descartar cambios
              </button>
              {hayCambiosGeneral ? (
                <span className="text-surface-500 text-sm">Cambios pendientes sin guardar.</span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className={seccionBase}>
        <button
          type="button"
          onClick={() => setMostrarHorarios((prev) => !prev)}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-medium bg-surface-100 text-surface-700 hover:bg-surface-200 border border-surface-200 transition-colors duration-200"
        >
          {mostrarHorarios ? 'Ocultar horarios' : 'Configurar horarios por fecha'}
        </button>

        {mostrarHorarios ? (
          <div className="mt-4">
            <h3 className="text-base font-semibold text-surface-900 mb-3">Horarios por fecha (excepciones)</h3>
            <div className="mb-4">
              <div className="text-sm font-medium text-surface-700 mb-2">Meses</div>
              <div className="flex flex-wrap gap-2">
                {MESES.map((mesNombre, idx) => {
                  const mes = idx + 1;
                  return (
                    <label
                      key={mes}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-surface-200 hover:border-surface-300 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={mesesSeleccionados.has(mes)}
                        onChange={() => alternarMesSeleccionado(mes)}
                        className="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                      />
                      {mesNombre}
                    </label>
                  );
                })}
              </div>
            </div>
            {(pacienteSeleccionado.tratamientos || []).length ? (
            <div className="space-y-8">
              {!mesesSeleccionados.size ? (
                <p className="text-surface-500 text-sm">
                  Selecciona al menos un mes para ver y editar horarios.
                </p>
              ) : null}
              {MESES.map((mesNombre, idx) => {
                const mes = idx + 1;
                if (!mesesSeleccionados.has(mes)) return null;
                const semanas = obtenerCalendarioMes(mes);
                return (
                  <div key={mes} className="rounded-xl border border-surface-200 bg-white overflow-hidden shadow-sm">
                    <div className="px-4 py-3 bg-surface-50 border-b border-surface-200">
                      <h4 className="font-semibold text-surface-800">{mesNombre}</h4>
                    </div>
                    <div className="p-4 space-y-6">
                      {(pacienteSeleccionado.tratamientos || []).map((t) => (
                        <div key={t} className="rounded-lg border border-surface-200 bg-surface-50/50 overflow-hidden">
                          <div className="px-3 py-2 bg-surface-100/80 border-b border-surface-200 text-sm font-medium text-surface-700">
                            {t}
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[520px] border-collapse">
                              <thead>
                                <tr className="bg-surface-100">
                                  <th className="text-left p-2.5 text-xs font-semibold text-surface-600 border-b border-r border-surface-200 w-14">Lun</th>
                                  <th className="text-left p-2.5 text-xs font-semibold text-surface-600 border-b border-r border-surface-200 w-14">Mar</th>
                                  <th className="text-left p-2.5 text-xs font-semibold text-surface-600 border-b border-r border-surface-200 w-14">Mie</th>
                                  <th className="text-left p-2.5 text-xs font-semibold text-surface-600 border-b border-r border-surface-200 w-14">Jue</th>
                                  <th className="text-left p-2.5 text-xs font-semibold text-surface-600 border-b border-surface-200 w-14">Viernes</th>
                                </tr>
                              </thead>
                              <tbody>
                                {semanas.map((semana, idxSemana) => (
                                  <tr key={`${mes}-semana-${idxSemana}`} className="border-b border-surface-100 last:border-b-0">
                                    {semana.map((diaNumero, idxDia) => (
                                      <td
                                        key={`${mes}-${idxSemana}-${idxDia}`}
                                        className="p-2 align-top border-r border-surface-100 last:border-r-0 min-w-[96px] max-w-[132px]"
                                      >
                                        {diaNumero ? (
                                          (() => {
                                            const horasDia = obtenerHorasDia(mes, t, diaNumero);
                                            const disponibles = horariosDisponiblesPaciente.filter(
                                              (h) => !horasDia.includes(h)
                                            );
                                            const fechaStr = `${ANIO_BASE}-${String(mes).padStart(2, '0')}-${String(
                                              diaNumero
                                            ).padStart(2, '0')}`;
                                            return (
                                              <div className="space-y-1.5">
                                                <span className="inline-block text-xs font-semibold text-surface-700">
                                                  {diaNumero}
                                                </span>
                                                {horasDia.length ? (
                                                  <div className="space-y-1">
                                                    {horasDia.map((hora) => {
                                                      const overrideActual =
                                                        overridesMap[fechaStr] &&
                                                        overridesMap[fechaStr][t] &&
                                                        overridesMap[fechaStr][t][hora];
                                                      const activo =
                                                        overrideActual === undefined
                                                          ? true
                                                          : overrideActual;
                                                      return (
                                                        <label
                                                          key={`${diaNumero}-${hora}`}
                                                          className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-surface-100 rounded px-1 py-0.5 -mx-1"
                                                        >
                                                          <input
                                                            type="checkbox"
                                                            checked={activo}
                                                            onChange={(e) =>
                                                              alternarExcepcion(
                                                                mes,
                                                                t,
                                                                diaNumero,
                                                                hora,
                                                                e.target.checked
                                                              )
                                                            }
                                                            className="rounded border-surface-300 text-primary-600 focus:ring-primary-500 shrink-0"
                                                          />
                                                          <span className="truncate">{hora}</span>
                                                        </label>
                                                      );
                                                    })}
                                                  </div>
                                                ) : (
                                                  <span className="text-surface-400 text-xs">Sin horarios</span>
                                                )}
                                                <select
                                                  defaultValue=""
                                                  onChange={(e) => {
                                                    const hora = e.target.value;
                                                    if (!hora) return;
                                                    alternarExcepcion(
                                                      mes,
                                                      t,
                                                      diaNumero,
                                                      hora,
                                                      true
                                                    );
                                                    e.target.value = '';
                                                  }}
                                                  className="w-full text-xs px-2 py-1 rounded border border-surface-200 bg-white mt-0.5"
                                                >
                                                  <option value="">+ Agregar</option>
                                                  {disponibles.map((h) => (
                                                    <option key={h} value={h}>
                                                      {h}
                                                    </option>
                                                  ))}
                                                </select>
                                              </div>
                                            );
                                          })()
                                        ) : (
                                          <span className="text-surface-300 text-xs">—</span>
                                        )}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-surface-500 text-sm">Asigna tratamientos para habilitar el cronograma.</p>
          )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
