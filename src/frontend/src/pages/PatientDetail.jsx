import React, { useEffect, useMemo, useState } from 'react';
import { usePacientes } from '../context/PatientsContext';
import { useAutenticacion } from '../context/AuthContext';
import { obtenerToken, resolverApiUrl } from '../services/api';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const ANIO_BASE = new Date().getFullYear();
const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const DIAS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'];
const ETIQUETAS_DIAS = {
  Lun: 'Lun',
  Mar: 'Mar',
  Mie: 'Mié',
  Jue: 'Jue',
  Vie: 'Vie',
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
  { id: 'MII', label: 'MII - Módulo Integral Intensivo', color: 'emerald' },
  { id: 'MIS', label: 'MIS - Módulo Integral Simple', color: 'amber' },
  { id: 'MIE', label: 'MIE - Integración Escolar', color: 'sky' },
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
  '08:00', '09:00', '10:00', '11:00', '12:00', '14:00',
  '15:00', '16:00', '17:00', '18:00', '19:00', '09:15',
  '09:45', '10:45', '14:30', '14:45', '15:15', '15:30',
  '16:15', '16:45', '17:30', '17:45', '18:15', '18:30', '19:45',
];

const HORARIOS_POR_OBRA_SOCIAL = {
  ospe: ['8', '9', '10', '11', '12', '14', '15', '16', '17', '18', '19'],
  galeno: ['9', '9.45', '14.45', '15.30', '16.15', '17', '17.45', '18.30'],
  osolsac: [
    '9.15', '10', '10.45', '14.30', '15.15', '16',
    '16.45', '17.30', '18.15', '19', '19.45'
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

const TABS = [
  { id: 'general', label: 'Filiación & Clínica', icon: 'person' },
  { id: 'contacto', label: 'Familia & Domicilio', icon: 'home' },
  { id: 'obrasocial', label: 'Obra Social & PDF', icon: 'badge' },
  { id: 'terapias', label: 'Terapias & Solicitudes', icon: 'medical_services' },
  { id: 'cronograma', label: 'Cronograma de Turnos', icon: 'calendar_month' },
];

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

  const [tabActiva, setTabActiva] = useState('general');

  // Form Fields
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
  const [autorizadoDesde, setAutorizadoDesde] = useState('');
  const [autorizadoHasta, setAutorizadoHasta] = useState('');

  // Status & Feedback
  const [guardado, setGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState('');

  // Turnos & Solicitudes
  const [mesesSeleccionados, setMesesSeleccionados] = useState(() => new Set([new Date().getMonth() + 1]));
  const [cronogramaGeneralDraft, setCronogramaGeneralDraft] = useState({});
  const [tratamientoOs, setTratamientoOs] = useState('');
  const [mesOs, setMesOs] = useState(() => new Date().getMonth() + 1);
  const [anioOs, setAnioOs] = useState(() => new Date().getFullYear());
  const [descargandoPdf, setDescargandoPdf] = useState(false);

  // Solicitudes
  const [solicitudFechaInicio, setSolicitudFechaInicio] = useState('');
  const [solicitudFechaFin, setSolicitudFechaFin] = useState('');
  const [solicitudTratamientos, setSolicitudTratamientos] = useState(() => new Set());
  const [modoSolicitudTratamientos, setModoSolicitudTratamientos] = useState('mismos');
  const [aplicarCambiosSolicitud, setAplicarCambiosSolicitud] = useState(true);
  const [mensajeSolicitud, setMensajeSolicitud] = useState('');
  const [errorSolicitud, setErrorSolicitud] = useState('');
  const [guardandoSolicitud, setGuardandoSolicitud] = useState(false);

  // Operational State Modal
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
    setUltimoControlFisiatrico(normalizarFechaParaInput(pacienteSeleccionado.ultimoControlFisiatrico));
    setFechaAltaControlFisiatrico(normalizarFechaParaInput(pacienteSeleccionado.fechaAltaControlFisiatrico));
    setFechaVencimientoControlFisiatrico(normalizarFechaParaInput(pacienteSeleccionado.fechaVencimientoControlFisiatrico));
    setUltimoControlTrabajoSocial(normalizarFechaParaInput(pacienteSeleccionado.ultimoControlTrabajoSocial));
    setFechaAltaControlTrabajoSocial(normalizarFechaParaInput(pacienteSeleccionado.fechaAltaControlTrabajoSocial));
    setFechaVencimientoControlTrabajoSocial(normalizarFechaParaInput(pacienteSeleccionado.fechaVencimientoControlTrabajoSocial));
    setDni(pacienteSeleccionado.dni || '');
    setCuit(pacienteSeleccionado.cuit || '');
    setNroAfiliado(pacienteSeleccionado.nroAfiliado || pacienteSeleccionado.numeroAfiliado || '');
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
    setCronogramaGeneralDraft({});
    setTratamientoOs(listaTrat.length ? listaTrat[0] : '');
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
    const fechaStr = `${ANIO_BASE}-${String(mes).padStart(2, '0')}-${String(diaNumero).padStart(2, '0')}`;
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
    const fechaStr = `${ANIO_BASE}-${String(mes).padStart(2, '0')}-${String(diaNumero).padStart(2, '0')}`;
    guardarExcepcionTurno(
      pacienteSeleccionado.id,
      tratamiento,
      fechaStr,
      hora,
      activo
    );
  };

  const alternarMesSeleccionado = (mes) => {
    setMesesSeleccionados((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(mes)) nuevo.delete(mes);
      else nuevo.add(mes);
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
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2500);
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

  const confirmarQuitarTratamiento = (tratamiento) => {
    if (!pacienteSeleccionado) return;
    const ok = window.confirm(`¿Estás seguro de quitar el tratamiento ${tratamiento}?`);
    if (!ok) return;
    eliminarTratamiento(pacienteSeleccionado.id, tratamiento);
  };

  const descargarObraSocial = async () => {
    if (!pacienteSeleccionado) return;
    const obraSocialId = String(obraSocialPdfId || '').trim();
    if (!obraSocialId) {
      window.alert('Selecciona una obra social válida con plantilla para generar el PDF.');
      return;
    }
    if (!String(tratamientoOs || '').trim()) {
      window.alert('Selecciona un tratamiento para generar la planilla.');
      return;
    }
    setDescargandoPdf(true);
    const url = `/api/patients/${encodeURIComponent(
      pacienteSeleccionado.id
    )}/obras-sociales/${encodeURIComponent(obraSocialId)}?tratamiento=${encodeURIComponent(
      String(tratamientoOs).trim()
    )}&mes=${encodeURIComponent(String(mesOs))}&anio=${encodeURIComponent(
      String(anioOs)
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
      enlace.download = `${obraSocialId}-${pacienteSeleccionado.apellido || 'paciente'}.pdf`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      window.alert('Error de conexión al generar el PDF.');
    } finally {
      setDescargandoPdf(false);
    }
  };

  const guardarCambios = async (e) => {
    if (e) e.preventDefault();
    if (!pacienteSeleccionado) return;
    setErrorGuardado('');
    setGuardando(true);
    const nombreLimpio = String(nombre || '').trim();
    const apellidoLimpio = String(apellido || '').trim();
    const fechaNac = String(fechaNacimiento || '').trim();
    const dniLimpio = String(dni || '').trim();
    const cuitLimpio = String(cuit || '').trim();

    if (!nombreLimpio || !apellidoLimpio || !fechaNac) {
      setErrorGuardado('Nombre, apellido y fecha de nacimiento son obligatorios.');
      setGuardando(false);
      return;
    }
    if (dniLimpio && !/^\d{7,8}$/.test(dniLimpio)) {
      setErrorGuardado('El DNI debe tener 7 u 8 dígitos numéricos.');
      setGuardando(false);
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
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminacion = () => {
    if (!pacienteSeleccionado || !usuario?.isAdmin) return;
    const ok = window.confirm('¿Estás seguro de eliminar este paciente de forma permanente?');
    if (!ok) return;
    eliminarPaciente(pacienteSeleccionado.id);
    alVolver();
  };

  if (!pacienteSeleccionado) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <span className="material-symbols-outlined text-3xl">person_off</span>
          </div>
          <h3 className="text-base font-bold text-slate-800">No hay paciente seleccionado</h3>
          <p className="mt-1 text-xs text-slate-500">Regresa a la lista o al buscador para elegir un paciente.</p>
          <button
            type="button"
            onClick={alVolver}
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-900"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Volver a la lista
          </button>
        </div>
      </div>
    );
  }

  const iniciales = `${(nombre || 'P').charAt(0)}${(apellido || '').charAt(0)}`.toUpperCase();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Top Sticky Header & Patient Banner */}
        <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={alVolver}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              title="Volver"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-lg font-bold text-white shadow-md shadow-emerald-600/20">
              {iniciales}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
                  {apellido} {nombre}
                </h2>
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-medium text-slate-600">
                  DNI {dni || 'Sin DNI'}
                </span>
                <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                  {obraSocial || 'Sin Obra Social'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Ficha clínica de paciente • Diagnóstico: <span className="font-semibold text-slate-700">{diagnostico || 'Sin diagnóstico asignado'}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {guardado && (
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-700">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                Guardado
              </span>
            )}
            {errorGuardado && (
              <span className="text-xs font-bold text-rose-600">{errorGuardado}</span>
            )}
            <button
              type="button"
              onClick={guardarCambios}
              disabled={guardando}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              {guardando ? 'Guardando...' : 'Guardar Cambios'}
            </button>
            {usuario?.isAdmin && (
              <button
                type="button"
                onClick={confirmarEliminacion}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100 hover:text-rose-700"
                title="Eliminar paciente"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            )}
          </div>
        </div>

        {/* Operational State Stepper Banner */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <span className="material-symbols-outlined text-[22px]">account_tree</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Estado Operativo
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wide ${
                      estadoOperativo === 'Nuevo'
                        ? 'bg-blue-100 text-blue-800'
                        : estadoOperativo === 'En_admision'
                        ? 'bg-amber-100 text-amber-800'
                        : estadoOperativo === 'En_expediente'
                        ? 'bg-indigo-100 text-indigo-800'
                        : estadoOperativo === 'Desestimado'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {String(estadoOperativo).replace('_', ' ')}
                  </span>
                  <span className="text-xs text-slate-500">
                    {estadoOperativo === 'Nuevo' && 'Paciente registrado, listo para iniciar proceso de admisión.'}
                    {estadoOperativo === 'En_admision' && 'En proceso de validación documental y de obra social.'}
                    {estadoOperativo === 'En_expediente' && 'Armado y revisión de expediente clínico para auditoría.'}
                    {estadoOperativo === 'Desestimado' && 'Paciente desestimado del proceso de admisión.'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {estadoOperativo === 'Nuevo' && (
                <button
                  type="button"
                  onClick={() => cambiarEstadoOperativo(pacienteSeleccionado.id, 'En_admision')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700"
                >
                  <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                  Iniciar Admisión
                </button>
              )}
              {estadoOperativo === 'En_admision' && (
                <>
                  <button
                    type="button"
                    onClick={() => cambiarEstadoOperativo(pacienteSeleccionado.id, 'En_expediente')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700"
                  >
                    <span className="material-symbols-outlined text-[16px]">check</span>
                    Aprobar a Expediente
                  </button>
                  <button
                    type="button"
                    onClick={() => setMostrandoModalDesestimar(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                    Desestimar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Modal Desestimar */}
        {mostrandoModalDesestimar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <h3 className="text-lg font-extrabold text-slate-900">Desestimar Paciente</h3>
              <p className="mt-1 text-xs text-slate-500">
                Indica el motivo por el cual se desestima el ingreso de este paciente (ej: falta CUD, obra social sin convenio).
              </p>
              <textarea
                rows={3}
                value={razonDesestimacion}
                onChange={(e) => setRazonDesestimacion(e.target.value)}
                placeholder="Motivo del rechazo..."
                className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 focus:border-rose-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMostrandoModalDesestimar(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
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
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700"
                >
                  Confirmar Desestimación
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabbed Navigation Bar */}
        <div className="flex overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm">
          {TABS.map((tab) => {
            const activa = tabActiva === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTabActiva(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
                  activa
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Filiación & Datos Clínicos */}
        {tabActiva === 'general' && (
          <div className="space-y-6">
            {/* Card: Datos Personales */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-emerald-800">
                <span className="material-symbols-outlined text-[20px] text-emerald-600">badge</span>
                Datos de Filiación e Identificación
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Nombre *</label>
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Apellido *</label>
                  <input
                    type="text"
                    value={apellido}
                    onChange={(e) => setApellido(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Fecha de Nacimiento *</label>
                  <input
                    type="date"
                    value={fechaNacimiento}
                    onChange={(e) => setFechaNacimiento(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">DNI (7-8 dígitos)</label>
                  <input
                    type="text"
                    value={dni}
                    maxLength={8}
                    onChange={(e) => setDni(String(e.target.value || '').replace(/\D/g, '').slice(0, 8))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">CUIT / CUIL</label>
                  <input
                    type="text"
                    value={cuit}
                    placeholder="20-12345678-9"
                    onChange={(e) => setCuit(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">N° Afiliado</label>
                  <input
                    type="text"
                    value={nroAfiliado}
                    onChange={(e) => setNroAfiliado(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Diagnóstico Principal</label>
                  <input
                    type="text"
                    value={diagnostico}
                    list="diagnosticos-paciente"
                    onChange={(e) => setDiagnostico(e.target.value)}
                    placeholder="Ej: Trastorno del espectro autista (TEA), Retraso madurativo..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <datalist id="diagnosticos-paciente">
                    {diagnosticosDisponibles.map((d) => (
                      <option key={`diag-${d}`} value={d} />
                    ))}
                  </datalist>
                </div>
              </div>
            </div>

            {/* Card: Módulos Clínicos */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-emerald-800">
                <span className="material-symbols-outlined text-[20px] text-emerald-600">view_module</span>
                Módulos Clínicos Asignados
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {MODULOS_PACIENTE.map((m) => {
                  const marcado = modulo.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() =>
                        setModulo((prev) =>
                          prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id]
                        )
                      }
                      className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-all ${
                        marcado
                          ? 'border-emerald-500 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <div
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
                          marcado ? 'bg-emerald-600 text-white' : 'border border-slate-300 bg-white'
                        }`}
                      >
                        {marcado && <span className="material-symbols-outlined text-[16px]">check</span>}
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-slate-900">{m.id}</span>
                        <span className="text-[11px] text-slate-500">{m.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Card: Controles Clínicos & Vencimientos */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-emerald-800">
                <span className="material-symbols-outlined text-[20px] text-emerald-600">health_and_safety</span>
                Controles de Especialidad y Vencimientos
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <h4 className="mb-3 text-xs font-bold text-slate-800">Control Fisiátrico</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600">Último control</label>
                      <input
                        type="date"
                        value={ultimoControlFisiatrico}
                        onChange={(e) => setUltimoControlFisiatrico(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600">Alta de control</label>
                      <input
                        type="date"
                        value={fechaAltaControlFisiatrico}
                        onChange={(e) => setFechaAltaControlFisiatrico(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600">Vencimiento</label>
                      <input
                        type="date"
                        value={fechaVencimientoControlFisiatrico}
                        onChange={(e) => setFechaVencimientoControlFisiatrico(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <h4 className="mb-3 text-xs font-bold text-slate-800">Control de Trabajo Social</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600">Último control</label>
                      <input
                        type="date"
                        value={ultimoControlTrabajoSocial}
                        onChange={(e) => setUltimoControlTrabajoSocial(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600">Alta de control</label>
                      <input
                        type="date"
                        value={fechaAltaControlTrabajoSocial}
                        onChange={(e) => setFechaAltaControlTrabajoSocial(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600">Vencimiento</label>
                      <input
                        type="date"
                        value={fechaVencimientoControlTrabajoSocial}
                        onChange={(e) => setFechaVencimientoControlTrabajoSocial(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <h4 className="mb-3 text-xs font-bold text-slate-800">Período de Autorización</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600">Autorizado desde</label>
                      <input
                        type="date"
                        value={autorizadoDesde}
                        onChange={(e) => setAutorizadoDesde(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600">Vence el</label>
                      <input
                        type="date"
                        value={autorizadoHasta}
                        onChange={(e) => setAutorizadoHasta(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card: Documentación Escolar por Años */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-emerald-800">
                <span className="material-symbols-outlined text-[20px] text-emerald-600">fact_check</span>
                Documentación Escolar y Proyectos Pedagógicos
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-700">Años CAR</label>
                  <div className="flex flex-wrap gap-1.5">
                    {ANIOS_ESCOLARES.map((anio) => (
                      <button
                        key={`car-${anio}`}
                        type="button"
                        onClick={() =>
                          setCarAnios((prev) =>
                            prev.includes(anio) ? prev.filter((x) => x !== anio) : [...prev, anio]
                          )
                        }
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          carAnios.includes(anio)
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {anio}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-700">Años PPI</label>
                  <div className="flex flex-wrap gap-1.5">
                    {ANIOS_ESCOLARES.map((anio) => (
                      <button
                        key={`ppi-${anio}`}
                        type="button"
                        onClick={() =>
                          setPpiAnios((prev) =>
                            prev.includes(anio) ? prev.filter((x) => x !== anio) : [...prev, anio]
                          )
                        }
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          ppiAnios.includes(anio)
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {anio}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-700">Acta Acuerdo</label>
                  <div className="flex flex-wrap gap-1.5">
                    {ANIOS_ESCOLARES.map((anio) => (
                      <button
                        key={`acta-${anio}`}
                        type="button"
                        onClick={() =>
                          setActaAcuerdoAnios((prev) =>
                            prev.includes(anio) ? prev.filter((x) => x !== anio) : [...prev, anio]
                          )
                        }
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          actaAcuerdoAnios.includes(anio)
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {anio}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Familia & Domicilio */}
        {tabActiva === 'contacto' && (
          <div className="space-y-6">
            {/* Card: Familiares / Tutores */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-emerald-800">
                <span className="material-symbols-outlined text-[20px] text-emerald-600">family_restroom</span>
                Padres y Tutores Responsables
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Padre / Tutor</label>
                  <input
                    type="text"
                    value={padreTutor}
                    onChange={(e) => setPadreTutor(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Teléfono Padre / Tutor</label>
                  <input
                    type="text"
                    value={telefonoPadreTutor}
                    onChange={(e) => setTelefonoPadreTutor(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Madre / Tutora</label>
                  <input
                    type="text"
                    value={madreTutora}
                    onChange={(e) => setMadreTutora(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Teléfono Madre / Tutora</label>
                  <input
                    type="text"
                    value={telefonoMadreTutora}
                    onChange={(e) => setTelefonoMadreTutora(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>
            </div>

            {/* Card: Escuela */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-emerald-800">
                <span className="material-symbols-outlined text-[20px] text-emerald-600">school</span>
                Institución Educativa
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Escuela / Colegio</label>
                  <input
                    type="text"
                    value={escuela}
                    onChange={(e) => setEscuela(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Año / Grado / Sala</label>
                  <input
                    type="text"
                    value={anioGrado}
                    placeholder="Ej: 3er Grado A"
                    onChange={(e) => setAnioGrado(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Turno Escolar</label>
                  <select
                    value={turnoEscolar}
                    onChange={(e) => setTurnoEscolar(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="">(Seleccionar)</option>
                    <option value="manana">Mañana</option>
                    <option value="tarde">Tarde</option>
                    <option value="jornada_completa">Jornada Completa</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Card: Domicilio */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-emerald-800">
                <span className="material-symbols-outlined text-[20px] text-emerald-600">location_on</span>
                Domicilio y Residencia
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Calle</label>
                  <input
                    type="text"
                    value={calle}
                    onChange={(e) => setCalle(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Número</label>
                  <input
                    type="text"
                    value={numeracion}
                    onChange={(e) => setNumeracion(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Barrio</label>
                  <input
                    type="text"
                    value={barrio}
                    onChange={(e) => setBarrio(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Piso / Dpto</label>
                  <input
                    type="text"
                    value={piso}
                    onChange={(e) => setPiso(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Sector / Manzana</label>
                  <input
                    type="text"
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Obra Social & PDF */}
        {tabActiva === 'obrasocial' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-emerald-800">
                <span className="material-symbols-outlined text-[20px] text-emerald-600">picture_as_pdf</span>
                Generación y Descarga de Planilla de Obra Social
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-3">
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Obra Social Asignada</label>
                  <select
                    value={String(obraSocial || '').trim()}
                    onChange={(e) => {
                      const val = e.target.value;
                      setObraSocial(val);
                      setObraSocialPdfId(val);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="">(Seleccionar Obra Social)</option>
                    {obrasSocialesDisponibles.map((o) => (
                      <option key={`os-select-${o}`} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Terapia para la Planilla</label>
                  <select
                    value={tratamientoOs}
                    onChange={(e) => setTratamientoOs(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="">(Seleccionar Terapia)</option>
                    {(pacienteSeleccionado.tratamientos || []).map((t) => (
                      <option key={`t-os-${t}`} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Mes de la Planilla</label>
                  <select
                    value={String(mesOs)}
                    onChange={(e) => setMesOs(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    {MESES.map((m, idx) => (
                      <option key={`mes-os-${idx + 1}`} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Año de la Planilla</label>
                  <input
                    type="number"
                    value={String(anioOs)}
                    onChange={(e) => setAnioOs(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={descargarObraSocial}
                  disabled={descargandoPdf}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  {descargandoPdf ? 'Generando PDF...' : 'Descargar Planilla Oficial en PDF'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Terapias & Solicitudes */}
        {tabActiva === 'terapias' && (
          <div className="space-y-6">
            {/* Active Therapies */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-emerald-800">
                Terapias Asignadas
              </h3>
              <p className="mb-4 text-xs text-slate-500">
                Selecciona las disciplinas terapéuticas que realiza el paciente en CENEIN.
              </p>
              <div className="flex flex-wrap gap-2">
                {tratamientosDisponibles.map((t) => {
                  const marcado = (pacienteSeleccionado.tratamientos || []).includes(t);
                  return (
                    <button
                      key={`trat-button-${t}`}
                      type="button"
                      onClick={() => alternarTratamientoPaciente(t, !marcado)}
                      className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                        marcado
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {marcado ? 'check_circle' : 'add_circle'}
                      </span>
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Solicitudes de Período */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-emerald-800">
                Carga de Período de Solicitud
              </h3>
              <p className="mb-4 text-xs text-slate-500">
                Planifica solicitudes de cobertura terapéutica para auditoría médica.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Inicio de Solicitud</label>
                  <input
                    type="date"
                    value={solicitudFechaInicio}
                    onChange={(e) => setSolicitudFechaInicio(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Fin de Solicitud</label>
                  <input
                    type="date"
                    value={solicitudFechaFin}
                    onChange={(e) => setSolicitudFechaFin(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-xs font-bold text-slate-700">Terapias incluidas en la solicitud</label>
                <div className="flex flex-wrap gap-2">
                  {tratamientosSolicitudDisponibles.map((t) => {
                    const marcado = solicitudTratamientos.has(t);
                    return (
                      <button
                        key={`sol-treat-${t}`}
                        type="button"
                        onClick={() => alternarTratamientoSolicitud(t)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          marcado
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={guardarSolicitud}
                  disabled={guardandoSolicitud}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-black disabled:opacity-50"
                >
                  {guardandoSolicitud ? 'Guardando...' : 'Guardar Solicitud'}
                </button>
                {mensajeSolicitud && <span className="text-xs font-bold text-emerald-700">{mensajeSolicitud}</span>}
                {errorSolicitud && <span className="text-xs font-bold text-rose-600">{errorSolicitud}</span>}
              </div>

              {/* Historial Solicitudes */}
              <div className="mt-6 border-t border-slate-100 pt-5">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Historial de Solicitudes (Últimos 12 meses)
                </h4>
                {historialSolicitudes.length > 0 ? (
                  <div className="space-y-2">
                    {historialSolicitudes.map((sol) => (
                      <div
                        key={`sol-row-${sol.id}`}
                        className="flex flex-col justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 sm:flex-row sm:items-center"
                      >
                        <div>
                          <span className="font-bold text-slate-800">
                            {sol.fechaInicio || '-'} al {sol.fechaFin || '-'}
                          </span>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Terapias: {(sol.tratamientos || []).join(', ') || 'Ninguna'}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            sol.vigente
                              ? 'bg-emerald-100 text-emerald-800'
                              : sol.futura
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {sol.vigente ? 'Vigente' : sol.futura ? 'Futura' : 'Vencida'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No hay solicitudes registradas en el último año.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Cronograma de Turnos */}
        {tabActiva === 'cronograma' && (
          <div className="space-y-6">
            {/* Cronograma General Semanal */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-800">
                    Cronograma Base Semanal
                  </h3>
                  <p className="text-xs text-slate-500">
                    Configura los turnos fijos de cada semana para replicar en todos los meses.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={guardarCronogramaGeneral}
                    disabled={!hayCambiosGeneral}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-40"
                  >
                    Guardar Cronograma Base
                  </button>
                  <button
                    type="button"
                    onClick={() => setCronogramaGeneralDraft({})}
                    disabled={!hayCambiosGeneral}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Descartar
                  </button>
                </div>
              </div>

              {(pacienteSeleccionado.tratamientos || []).length > 0 ? (
                <div className="space-y-6">
                  {(pacienteSeleccionado.tratamientos || []).map((t) => (
                    <div key={`crono-base-${t}`} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                      <h4 className="mb-2.5 flex items-center gap-2 text-xs font-bold text-slate-800">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        {t}
                      </h4>

                      {t === 'Integracion' ? (
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-slate-600">
                            Horario de Integración Escolar (texto libre):
                          </label>
                          <textarea
                            rows={2}
                            value={integracionHorario}
                            onChange={(e) => setIntegracionHorario(e.target.value)}
                            placeholder="Ej: Martes y Jueves 09:00 a 11:00 en Escuela Normal..."
                            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                          />
                        </div>
                      ) : (
                        <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                          <table className="w-full text-left text-xs">
                            <thead className="sticky top-0 bg-slate-100 font-semibold text-slate-700">
                              <tr>
                                <th className="py-2 pl-3 pr-2">Hora</th>
                                {DIAS.map((d) => (
                                  <th key={d} className="px-2 py-2 text-center">
                                    {ETIQUETAS_DIAS[d] || d}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {horariosDisponiblesPaciente.map((hora) => (
                                <tr key={`hora-base-${hora}`} className="hover:bg-slate-50/80">
                                  <td className="py-1.5 pl-3 pr-2 font-mono text-[11px] font-medium text-slate-600">
                                    {hora}
                                  </td>
                                  {DIAS.map((dia) => {
                                    const clave = `${dia}-${hora}`;
                                    const marcado = obtenerMarcadoGeneral(t, clave);
                                    return (
                                      <td key={`slot-${clave}`} className="px-2 py-1.5 text-center">
                                        <input
                                          type="checkbox"
                                          checked={marcado}
                                          onChange={() => alternarDraftGeneral(t, clave)}
                                          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
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
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                  Asigna terapias al paciente para habilitar la grilla de turnos.
                </div>
              )}
            </div>

            {/* Excepciones Mensuales / Horarios por Fecha */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-emerald-800">
                Turnos por Fecha Específica (Excepciones)
              </h3>
              <p className="mb-4 text-xs text-slate-500">
                Selecciona meses para revisar o ajustar turnos en fechas puntuales del calendario.
              </p>

              <div className="mb-5 flex flex-wrap gap-1.5">
                {MESES.map((m, idx) => {
                  const mesNum = idx + 1;
                  const seleccionado = mesesSeleccionados.has(mesNum);
                  return (
                    <button
                      key={`mes-btn-${m}`}
                      type="button"
                      onClick={() => alternarMesSeleccionado(mesNum)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                        seleccionado
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>

              {Array.from(mesesSeleccionados).map((mes) => {
                const mesNombre = MESES[mes - 1];
                const semanas = obtenerCalendarioMes(mes);
                return (
                  <div key={`mes-cal-${mes}`} className="mb-6 rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="bg-slate-100 px-4 py-2.5 font-bold text-xs text-slate-800">
                      {mesNombre} {ANIO_BASE}
                    </div>
                    <div className="p-4 space-y-4">
                      {(pacienteSeleccionado.tratamientos || []).map((t) => (
                        <div key={`cal-treat-${t}`} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                          <h5 className="mb-2 text-xs font-bold text-slate-800">{t}</h5>
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[500px] border-collapse text-xs">
                              <thead>
                                <tr className="border-b border-slate-200 text-slate-500">
                                  {DIAS.map((d) => (
                                    <th key={`cal-head-${d}`} className="p-2 text-left font-semibold">
                                      {ETIQUETAS_DIAS[d] || d}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {semanas.map((semana, idxSemana) => (
                                  <tr key={`sem-${idxSemana}`} className="border-b border-slate-100">
                                    {semana.map((diaNumero, idxDia) => {
                                      if (!diaNumero) {
                                        return <td key={`vacio-${idxDia}`} className="p-2 text-slate-200">—</td>;
                                      }
                                      const horasDia = obtenerHorasDia(mes, t, diaNumero);
                                      const fechaStr = `${ANIO_BASE}-${String(mes).padStart(2, '0')}-${String(diaNumero).padStart(2, '0')}`;
                                      const disponibles = horariosDisponiblesPaciente.filter((h) => !horasDia.includes(h));

                                      return (
                                        <td key={`dia-cell-${diaNumero}`} className="p-2 align-top">
                                          <span className="font-bold text-slate-700">{diaNumero}</span>
                                          <div className="mt-1 space-y-1">
                                            {horasDia.map((hora) => {
                                              const overrideActual =
                                                overridesMap[fechaStr] &&
                                                overridesMap[fechaStr][t] &&
                                                overridesMap[fechaStr][t][hora];
                                              const activo = overrideActual === undefined ? true : overrideActual;
                                              return (
                                                <label
                                                  key={`h-exc-${diaNumero}-${hora}`}
                                                  className="flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-[11px] shadow-sm border border-slate-200"
                                                >
                                                  <input
                                                    type="checkbox"
                                                    checked={activo}
                                                    onChange={(e) =>
                                                      alternarExcepcion(mes, t, diaNumero, hora, e.target.checked)
                                                    }
                                                    className="h-3.5 w-3.5 rounded text-emerald-600"
                                                  />
                                                  <span className="font-mono">{hora}</span>
                                                </label>
                                              );
                                            })}
                                            <select
                                              defaultValue=""
                                              onChange={(e) => {
                                                if (e.target.value) {
                                                  alternarExcepcion(mes, t, diaNumero, e.target.value, true);
                                                  e.target.value = '';
                                                }
                                              }}
                                              className="w-full rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px]"
                                            >
                                              <option value="">+ Hora</option>
                                              {disponibles.map((h) => (
                                                <option key={`disp-${h}`} value={h}>
                                                  {h}
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                        </td>
                                      );
                                    })}
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
          </div>
        )}
      </div>
    </div>
  );
}
