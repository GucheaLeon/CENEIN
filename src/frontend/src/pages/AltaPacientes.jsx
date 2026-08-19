import React, { useState, useMemo } from 'react';
import { usePacientes } from '../context/PatientsContext';
import { obtenerToken, resolverApiUrl } from '../services/api';

const TRATAMIENTOS = [
  'Fonoaudiologia',
  'Psicologia',
  'Psicopedagogia',
  'Psicomotricidad',
  'Kinesiologia',
  'TO Terapia Ocupacional',
  'Integracion',
];

const TRATAMIENTO_INFO = {
  Fonoaudiologia: { icono: 'record_voice_over', color: 'emerald' },
  Psicologia: { icono: 'psychology', color: 'blue' },
  Psicopedagogia: { icono: 'menu_book', color: 'purple' },
  Psicomotricidad: { icono: 'directions_run', color: 'amber' },
  Kinesiologia: { icono: 'accessibility_new', color: 'teal' },
  'TO Terapia Ocupacional': { icono: 'front_hand', color: 'indigo' },
  Integracion: { icono: 'school', color: 'rose' },
};

const DIAS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'];
const ETIQUETAS_DIAS = {
  Lun: 'Lunes',
  Mar: 'Martes',
  Mie: 'Miércoles',
  Jue: 'Jueves',
  Vie: 'Viernes',
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

const normalizarTexto = (valor) =>
  String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const toHora = (valor) => {
  const raw = String(valor || '').trim().replace('.', ':');
  if (!raw) return '';
  if (/^\d{1,2}$/.test(raw)) {
    return `${String(Number(raw)).padStart(2, '0')}:00`;
  }
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

const MODULOS = [
  { id: 'MII', label: 'Módulo Integral Intensivo (MII)', desc: 'Asistencia y terapias integrales de alta frecuencia' },
  { id: 'MIS', label: 'Módulo Integral Simple (MIS)', desc: 'Plan terapéutico regular ambulatorio' },
  { id: 'MIE', label: 'Módulo Integración Escolar (MIE)', desc: 'Acompañamiento y apoyo psicopedagógico en aula' },
];

const ANIOS_ESCOLARES = ['2026', '2027', '2028', '2029', '2030'];

const normalizarModulos = (valor) => {
  const lista = Array.isArray(valor)
    ? valor
    : String(valor || '')
        .split(',')
        .map((item) => String(item || '').trim().toUpperCase())
        .filter(Boolean);
  return Array.from(new Set(lista.filter((item) => ['MII', 'MIS', 'MIE'].includes(item))));
};

function calcularEdad(fecha) {
  if (!fecha) return null;
  const birth = new Date(fecha);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

function CronogramaCard({ tratamiento, turnosSeleccionados, alAlternar, horarios }) {
  const listaHorarios = Array.isArray(horarios) && horarios.length ? horarios : HORARIOS;
  const count = turnosSeleccionados.length;
  const info = TRATAMIENTO_INFO[tratamiento] || { icono: 'medical_services', color: 'emerald' };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300">
      <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d6ffe8] text-[#006d44]">
            <span className="material-symbols-outlined text-[22px]">{info.icono}</span>
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-base">{tratamiento}</h4>
            <p className="text-xs text-slate-400">Seleccioná los turnos semanales correspondientes</p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
            count > 0 ? 'bg-[#d6ffe8] text-[#006d44]' : 'bg-slate-100 text-slate-500'
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">
            {count > 0 ? 'check_circle' : 'schedule'}
          </span>
          {count} {count === 1 ? 'turno' : 'turnos'}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-100 bg-[#f8faf9]">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-bold uppercase tracking-wider">
              <th className="px-3.5 py-2.5 w-24">Hora</th>
              {DIAS.map((d) => (
                <th key={d} className="px-3.5 py-2.5 text-center">
                  {ETIQUETAS_DIAS[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {listaHorarios.map((hora) => (
              <tr key={hora} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-3.5 py-2 font-semibold text-slate-700 whitespace-nowrap bg-slate-50/30">
                  {hora}
                </td>
                {DIAS.map((dia) => {
                  const clave = `${dia}-${hora}`;
                  const marcado = turnosSeleccionados.includes(clave);
                  return (
                    <td key={clave} className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => alAlternar(clave)}
                        title={`${ETIQUETAS_DIAS[dia]} ${hora}`}
                        className={`h-8 w-full min-w-[48px] rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                          marcado
                            ? 'bg-[#006d44] text-white shadow-sm ring-1 ring-[#006d44]'
                            : 'bg-[#f1f4f5] text-slate-500 hover:bg-[#e2e8ea] hover:text-slate-700'
                        }`}
                      >
                        {marcado ? (
                          <>
                            <span className="material-symbols-outlined text-[13px]">check</span>
                            <span>{dia}</span>
                          </>
                        ) : (
                          <span>-</span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AltaPacientes({ alAbrirPaciente }) {
  const { pacientes, obrasSociales, seleccionarPaciente, agregarPaciente } = usePacientes();

  // Estados del paciente
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [obraSocial, setObraSocial] = useState('');
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
  const [autorizadoDesde, setAutorizadoDesde] = useState('');
  const [autorizadoHasta, setAutorizadoHasta] = useState('');
  const [obraSocialPdfId, setObraSocialPdfId] = useState('');
  const [tratamientoOs, setTratamientoOs] = useState('');
  const [mesOs, setMesOs] = useState(() => new Date().getMonth() + 1);
  const [anioOs, setAnioOs] = useState(() => new Date().getFullYear());
  const [pacienteCreadoId, setPacienteCreadoId] = useState('');
  const [pacienteCreadoNombre, setPacienteCreadoNombre] = useState('');
  const [integracionHorario, setIntegracionHorario] = useState('');
  const [moduloNuevo, setModuloNuevo] = useState([]);
  const [tratamientosNuevo, setTratamientosNuevo] = useState([]);
  const [turnosNuevo, setTurnosNuevo] = useState({});
  const [guardado, setGuardado] = useState(false);
  const [errorAlta, setErrorAlta] = useState('');
  const [descargandoPdf, setDescargandoPdf] = useState(false);

  const edadCalculada = useMemo(() => calcularEdad(fechaNacimiento), [fechaNacimiento]);

  const horariosCronograma = useMemo(
    () => resolverHorariosPorObraSocial(obraSocialPdfId || obraSocial),
    [obraSocialPdfId, obraSocial]
  );

  const moverFocoAlSiguienteCampo = (contenedor, actual) => {
    if (!contenedor || typeof contenedor.querySelectorAll !== 'function') return;
    const candidatos = contenedor.querySelectorAll('input, select, textarea, button');
    const campos = Array.from(candidatos).filter((el) => {
      if (!el || el.disabled) return false;
      if (el.tabIndex < 0) return false;
      const tipo = String(el.getAttribute('type') || '').toLowerCase();
      if (tipo === 'hidden') return false;
      if (el.getAttribute('aria-hidden') === 'true') return false;
      return el.offsetParent !== null;
    });
    if (!campos.length) return;
    const idx = campos.indexOf(actual);
    if (idx < 0) {
      campos[0].focus();
      return;
    }
    const siguiente = campos[idx + 1];
    if (siguiente) {
      siguiente.focus();
      return;
    }
    actual.blur();
  };

  const manejarEnterComoTab = (e) => {
    if (e.key !== 'Enter') return;
    const objetivo = e.target;
    if (!objetivo || typeof objetivo.tagName !== 'string') return;
    const tipo = String(objetivo.getAttribute?.('type') || '').toLowerCase();
    if (tipo === 'submit') {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    moverFocoAlSiguienteCampo(e.currentTarget, objetivo);
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
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [pacientes]);

  const alternarNuevo = (t) => {
    setTratamientosNuevo((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
    setTurnosNuevo((prev) => {
      if (prev[t]) {
        const copia = { ...prev };
        delete copia[t];
        return copia;
      }
      return { ...prev, [t]: [] };
    });
  };

  const alternarTurnoNuevo = (tratamiento, clave) => {
    setTurnosNuevo((prev) => {
      const actuales = Array.isArray(prev[tratamiento]) ? prev[tratamiento] : [];
      const existe = actuales.includes(clave);
      const [dia] = String(clave).split('-');
      const nuevos = existe
        ? actuales.filter((x) => x !== clave)
        : [...actuales.filter((x) => !String(x).startsWith(`${dia}-`)), clave];
      return { ...prev, [tratamiento]: nuevos };
    });
  };

  const alternarModulo = (idModulo) => {
    setModuloNuevo((prev) => {
      const actuales = normalizarModulos(prev);
      return actuales.includes(idModulo)
        ? actuales.filter((item) => item !== idModulo)
        : [...actuales, idModulo];
    });
  };

  const descargarObraSocial = async () => {
    const pacienteId = String(pacienteCreadoId || '').trim();
    if (!pacienteId) {
      setErrorAlta('Primero creá y guardá el paciente para poder generar el PDF de obra social.');
      return;
    }
    const obraId = String(obraSocialPdfId || obraSocial || '').trim();
    if (!obraId) {
      setErrorAlta('Seleccioná una obra social para la planilla.');
      return;
    }
    const tratamiento = String(tratamientoOs || '').trim();
    if (!tratamiento) {
      setErrorAlta('Seleccioná un tratamiento para la planilla.');
      return;
    }
    const mesNum = Number(mesOs);
    const anioNum = Number(anioOs);
    if (!Number.isInteger(mesNum) || mesNum < 1 || mesNum > 12) {
      setErrorAlta('El mes seleccionado es inválido.');
      return;
    }
    if (!Number.isInteger(anioNum) || anioNum < 2000 || anioNum > 2100) {
      setErrorAlta('El año seleccionado es inválido.');
      return;
    }

    setDescargandoPdf(true);
    const url = `/api/patients/${encodeURIComponent(
      pacienteId
    )}/obras-sociales/${encodeURIComponent(obraId)}?tratamiento=${encodeURIComponent(
      tratamiento
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
        setErrorAlta(`No se pudo descargar el PDF: ${mensaje}`);
        return;
      }
      const blob = await respuesta.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = blobUrl;
      enlace.download = `${obraId}-${tratamiento}-${mesNum}-${anioNum}.pdf`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setErrorAlta('No se pudo descargar el PDF. Revisá la conexión con el servidor.');
    } finally {
      setDescargandoPdf(false);
    }
  };

  const limpiarFormulario = () => {
    setNombre('');
    setApellido('');
    setFechaNacimiento('');
    setObraSocial('');
    setUltimoControlFisiatrico('');
    setFechaAltaControlFisiatrico('');
    setFechaVencimientoControlFisiatrico('');
    setUltimoControlTrabajoSocial('');
    setFechaAltaControlTrabajoSocial('');
    setFechaVencimientoControlTrabajoSocial('');
    setDni('');
    setCuit('');
    setNroAfiliado('');
    setDiagnostico('');
    setPadreTutor('');
    setTelefonoPadreTutor('');
    setMadreTutora('');
    setTelefonoMadreTutora('');
    setCalle('');
    setNumeracion('');
    setBarrio('');
    setPiso('');
    setSector('');
    setEscuela('');
    setAnioGrado('');
    setTurnoEscolar('');
    setAutorizadoDesde('');
    setAutorizadoHasta('');
    setCarAnios([]);
    setPpiAnios([]);
    setActaAcuerdoAnios([]);
    setObraSocialPdfId('');
    setTratamientoOs('');
    setMesOs(new Date().getMonth() + 1);
    setAnioOs(new Date().getFullYear());
    setIntegracionHorario('');
    setModuloNuevo([]);
    setTratamientosNuevo([]);
    setTurnosNuevo({});
    setErrorAlta('');
  };

  const crearPaciente = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    setErrorAlta('');

    const nombreLimpio = String(nombre || '').trim();
    const apellidoLimpio = String(apellido || '').trim();
    const fechaNac = String(fechaNacimiento || '').trim();
    const dniLimpio = String(dni || '').trim();
    const cuitLimpio = String(cuit || '').trim();
    const telPadreLimpio = String(telefonoPadreTutor || '').trim();
    const telMadreLimpio = String(telefonoMadreTutora || '').trim();

    if (!nombreLimpio || !apellidoLimpio || !fechaNac) {
      setErrorAlta('Nombre, apellido y fecha de nacimiento son obligatorios.');
      return;
    }
    const regexNombreAp = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-\']+$/;
    if (!regexNombreAp.test(nombreLimpio) || !regexNombreAp.test(apellidoLimpio)) {
      setErrorAlta('El nombre y apellido solo pueden contener letras y espacios.');
      return;
    }
    if (!/^\d{7,8}$/.test(dniLimpio)) {
      setErrorAlta('El DNI debe tener 7 u 8 dígitos numéricos.');
      return;
    }
    if (cuitLimpio && !/^\d{2}\-?\d{8}\-?\d{1}$/.test(cuitLimpio)) {
      setErrorAlta('El CUIT debe tener 11 dígitos numéricos (ej: 20-12345678-9).');
      return;
    }
    const regexTel = /^[\d\s\-\+\(\)]+$/;
    if (telPadreLimpio && !regexTel.test(telPadreLimpio)) {
      setErrorAlta('El teléfono del padre/tutor contiene caracteres no válidos.');
      return;
    }
    if (telMadreLimpio && !regexTel.test(telMadreLimpio)) {
      setErrorAlta('El teléfono de la madre/tutora contiene caracteres no válidos.');
      return;
    }

    const dniExiste = (pacientes || []).some(
      (p) => String(p?.dni || '').trim() === dniLimpio
    );
    if (dniExiste) {
      setErrorAlta('Ya existe un paciente registrado con ese DNI.');
      return;
    }

    const creado = agregarPaciente({
      nombre: nombreLimpio,
      apellido: apellidoLimpio,
      fechaNacimiento: fechaNac,
      obraSocial,
      ultimoControlFisiatrico,
      fechaAltaControlFisiatrico,
      fechaVencimientoControlFisiatrico,
      ultimoControlTrabajoSocial,
      fechaAltaControlTrabajoSocial,
      fechaVencimientoControlTrabajoSocial,
      dni: dniLimpio,
      cuit,
      nroAfiliado,
      diagnostico,
      padreTutor,
      telefonoPadreTutor,
      madreTutora,
      telefonoMadreTutora,
      calle,
      numeracion,
      barrio,
      piso,
      sector,
      escuela,
      anioGrado,
      turnoEscolar,
      autorizadoDesde: autorizadoDesde || null,
      autorizadoHasta: autorizadoHasta || null,
      carAnios,
      ppiAnios,
      actaAcuerdoAnios,
      integracionHorario,
      modulo: moduloNuevo,
      modulos: moduloNuevo,
      tratamientos: tratamientosNuevo,
      turnosBase: turnosNuevo,
    });

    if (creado) {
      setPacienteCreadoId(creado.id);
      setPacienteCreadoNombre(`${nombreLimpio} ${apellidoLimpio}`);
      seleccionarPaciente(creado.id);
      setGuardado(true);
      limpiarFormulario();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setErrorAlta('No se pudo dar de alta el paciente en el sistema.');
    }
  };

  // Validaciones visuales
  const errorNombre = nombre && !/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-\']+$/.test(nombre) ? 'Solo letras y espacios' : '';
  const errorApellido = apellido && !/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-\']+$/.test(apellido) ? 'Solo letras y espacios' : '';
  const errorDni = dni && !/^\d{7,8}$/.test(dni) ? 'Debe tener 7 u 8 dígitos' : '';
  const errorCuit = cuit && !/^\d{2}\-?\d{8}\-?\d{1}$/.test(cuit) ? 'Formato: 20-12345678-9' : '';
  const errorTelPadre = telefonoPadreTutor && !/^[\d\s\-\+\(\)]+$/.test(telefonoPadreTutor) ? 'Caracteres no válidos' : '';
  const errorTelMadre = telefonoMadreTutora && !/^[\d\s\-\+\(\)]+$/.test(telefonoMadreTutora) ? 'Caracteres no válidos' : '';

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Encabezado y Navegación */}
        <section className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <nav className="mb-2 flex items-center gap-2 text-xs text-slate-400">
              <span>Pacientes</span>
              <span className="material-symbols-outlined text-[12px]">chevron_right</span>
              <span className="font-semibold text-[#006d44]">Alta y Admisión de Paciente</span>
            </nav>
            <h2 className="text-3xl font-extrabold tracking-tight text-[#2d3335] sm:text-4xl">
              Nuevo Registro de Paciente
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Completá la información de filiación, cobertura médica, escolaridad y configurá el cronograma terapéutico.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={limpiarFormulario}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <span className="material-symbols-outlined text-[18px]">restart_alt</span>
              <span>Limpiar</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (alAbrirPaciente) alAbrirPaciente('dashboard');
                else window.history.back();
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span>Volver</span>
            </button>
            <button
              type="button"
              onClick={crearPaciente}
              className="inline-flex items-center gap-2 rounded-xl bg-[#006d44] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#005837] hover:shadow"
            >
              <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
              <span>Guardar Registro</span>
            </button>
          </div>
        </section>

        {/* Notificación de Éxito al Guardar */}
        {guardado && (
          <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 shadow-sm sm:flex-row sm:items-center sm:justify-between animate-fadeIn">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <span className="material-symbols-outlined text-[24px]">verified</span>
              </div>
              <div>
                <h4 className="text-base font-bold text-emerald-950">
                  ¡Paciente registrado con éxito!
                </h4>
                <p className="text-xs text-emerald-700">
                  Se ha creado la ficha clínica de <span className="font-bold">{pacienteCreadoNombre}</span> en el sistema.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {alAbrirPaciente && pacienteCreadoId && (
                <button
                  type="button"
                  onClick={() => alAbrirPaciente(pacienteCreadoId)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#006d44] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#005837]"
                >
                  <span className="material-symbols-outlined text-[16px]">visibility</span>
                  <span>Ver Ficha del Paciente</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setGuardado(false)}
                className="rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-100/70"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
          </div>
        )}

        {/* Notificación de Error */}
        {errorAlta && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-800 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[22px] text-rose-600">error</span>
              <span>{errorAlta}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorAlta('')}
              className="text-rose-400 hover:text-rose-700"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        )}

        {/* Formulario Principal */}
        <form
          onSubmit={(e) => e.preventDefault()}
          onKeyDown={manejarEnterComoTab}
          className="space-y-8"
        >
          {/* Grilla Superior: Filiación y Obra Social */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            
            {/* 1. Datos Personales y Filiación */}
            <div className="lg:col-span-7 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
              <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d6ffe8] text-[#006d44]">
                    <span className="material-symbols-outlined text-[22px]">badge</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Filiación del Paciente</h3>
                    <p className="text-xs text-slate-400">Datos identificatorios principales</p>
                  </div>
                </div>
                {edadCalculada !== null && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-[#006d44] ring-1 ring-emerald-200">
                    <span className="material-symbols-outlined text-[14px]">cake</span>
                    {edadCalculada} {edadCalculada === 1 ? 'año' : 'años'}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Nombre <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                      person
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Juan"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className={`w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8] ${
                        errorNombre ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200 bg-white'
                      }`}
                    />
                  </div>
                  {errorNombre && <p className="mt-1 text-[11px] font-semibold text-rose-600">{errorNombre}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Apellido <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                      person_outline
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Pérez"
                      value={apellido}
                      onChange={(e) => setApellido(e.target.value)}
                      className={`w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8] ${
                        errorApellido ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200 bg-white'
                      }`}
                    />
                  </div>
                  {errorApellido && <p className="mt-1 text-[11px] font-semibold text-rose-600">{errorApellido}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Fecha de Nacimiento <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                      calendar_today
                    </span>
                    <input
                      type="date"
                      required
                      value={fechaNacimiento}
                      onChange={(e) => setFechaNacimiento(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    DNI <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                      pin
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={8}
                      required
                      placeholder="Ej: 45123456"
                      value={dni}
                      onChange={(e) => setDni(String(e.target.value || '').replace(/\D/g, '').slice(0, 8))}
                      className={`w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8] ${
                        errorDni ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200 bg-white'
                      }`}
                    />
                  </div>
                  {errorDni && <p className="mt-1 text-[11px] font-semibold text-rose-600">{errorDni}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    CUIT
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                      tag
                    </span>
                    <input
                      type="text"
                      placeholder="Ej: 20-45123456-9"
                      value={cuit}
                      onChange={(e) => setCuit(e.target.value)}
                      className={`w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8] ${
                        errorCuit ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200 bg-white'
                      }`}
                    />
                  </div>
                  {errorCuit && <p className="mt-1 text-[11px] font-semibold text-rose-600">{errorCuit}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    N° de Afiliado
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                      credit_card
                    </span>
                    <input
                      type="text"
                      placeholder="Ej: 001-987654-0"
                      value={nroAfiliado}
                      onChange={(e) => setNroAfiliado(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Diagnóstico Clínico
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                      medical_information
                    </span>
                    <input
                      type="text"
                      list="diagnosticos"
                      placeholder="Ej: Trastorno del Espectro Autista (TEA), Retraso Madurativo..."
                      value={diagnostico}
                      onChange={(e) => setDiagnostico(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
                    />
                  </div>
                  <datalist id="diagnosticos">
                    {diagnosticosDisponibles.map((d) => (
                      <option key={`diag-${d}`} value={d} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Controles Fisiátricos y de Trabajo Social */}
              <div className="mt-6 border-t border-slate-100 pt-5">
                <h4 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Seguimiento y Controles Médicos
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <span className="material-symbols-outlined text-[16px] text-teal-600">physical_therapy</span>
                      <span>Control Fisiátrico</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-500">Último control</label>
                        <input
                          type="date"
                          value={ultimoControlFisiatrico}
                          onChange={(e) => setUltimoControlFisiatrico(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 focus:border-[#006d44]"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-500">Vencimiento</label>
                        <input
                          type="date"
                          value={fechaVencimientoControlFisiatrico}
                          onChange={(e) => setFechaVencimientoControlFisiatrico(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 focus:border-[#006d44]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <span className="material-symbols-outlined text-[16px] text-blue-600">diversity_1</span>
                      <span>Control Trabajo Social</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-500">Último control</label>
                        <input
                          type="date"
                          value={ultimoControlTrabajoSocial}
                          onChange={(e) => setUltimoControlTrabajoSocial(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 focus:border-[#006d44]"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-500">Vencimiento</label>
                        <input
                          type="date"
                          value={fechaVencimientoControlTrabajoSocial}
                          onChange={(e) => setFechaVencimientoControlTrabajoSocial(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 focus:border-[#006d44]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Cobertura Médica y Facturación */}
            <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
              <div>
                <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-800">
                    <span className="material-symbols-outlined text-[22px]">health_and_safety</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Cobertura Médica</h3>
                    <p className="text-xs text-slate-400">Obra social y período de autorización</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                      Obra Social
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                        account_balance
                      </span>
                      <select
                        value={String(obraSocial || '').trim()}
                        onChange={(e) => {
                          const val = e.target.value;
                          setObraSocial(val);
                          setObraSocialPdfId(val);
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-8 text-sm text-slate-800 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
                      >
                        <option value="">(Seleccionar Obra Social)</option>
                        {obrasSocialesDisponibles.map((o) => {
                          const apiData = (obrasSociales || []).find((osObj) => osObj.id === o);
                          const showSinPlantilla = apiData && apiData.hasTemplate === false;
                          const isMissing = !apiData;
                          return (
                            <option key={`os-${o}`} value={o}>
                              {o} {showSinPlantilla || isMissing ? '· [sin plantilla]' : '· [con plantilla]'}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  {/* Período de Autorización */}
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <span className="material-symbols-outlined text-[16px] text-sky-600">event_available</span>
                      <span>Período de Autorización Vigente</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-500">Autorizado Desde</label>
                        <input
                          type="date"
                          value={autorizadoDesde}
                          onChange={(e) => setAutorizadoDesde(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 focus:border-[#006d44]"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-500">Vence el</label>
                        <input
                          type="date"
                          value={autorizadoHasta}
                          onChange={(e) => setAutorizadoHasta(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 focus:border-[#006d44]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Generación de Planilla PDF Obra Social */}
              <div className="mt-6 rounded-xl border border-sky-200/80 bg-sky-50/40 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-sky-700">picture_as_pdf</span>
                    <span className="text-xs font-bold text-sky-950">Descarga Rápida de Planilla</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-sky-600 bg-sky-100 px-2 py-0.5 rounded-md">
                    PDF Oficial
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">Tratamiento</label>
                    <select
                      value={tratamientoOs}
                      onChange={(e) => setTratamientoOs(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800"
                    >
                      <option value="">(Elegir)</option>
                      {tratamientosNuevo.map((t) => (
                        <option key={`alta-t-os-${t}`} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">Mes</label>
                    <select
                      value={String(mesOs)}
                      onChange={(e) => setMesOs(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800"
                    >
                      {MESES.map((m, idx) => (
                        <option key={`alta-mes-os-${idx + 1}`} value={idx + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">Año</label>
                    <input
                      type="number"
                      value={String(anioOs)}
                      onChange={(e) => setAnioOs(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={descargarObraSocial}
                  disabled={descargandoPdf}
                  className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-sky-800 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {descargandoPdf ? 'progress_activity' : 'download'}
                  </span>
                  <span>{descargandoPdf ? 'Generando PDF...' : 'Descargar Planilla de Asistencia PDF'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Grilla Media: Familia y Tutores + Domicilio + Escolaridad */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            
            {/* 3. Familia y Tutores */}
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
              <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                  <span className="material-symbols-outlined text-[22px]">diversity_3</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Familia y Tutores</h3>
                  <p className="text-xs text-slate-400">Contactos de responsables</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Padre / Tutor
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                      person
                    </span>
                    <input
                      type="text"
                      placeholder="Nombre completo"
                      value={padreTutor}
                      onChange={(e) => setPadreTutor(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Teléfono Padre / Tutor
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                      call
                    </span>
                    <input
                      type="tel"
                      placeholder="Ej: 351-1234567"
                      value={telefonoPadreTutor}
                      onChange={(e) => setTelefonoPadreTutor(e.target.value)}
                      className={`w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm text-slate-800 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8] ${
                        errorTelPadre ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200 bg-white'
                      }`}
                    />
                  </div>
                  {errorTelPadre && <p className="mt-1 text-[11px] font-semibold text-rose-600">{errorTelPadre}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Madre / Tutora
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                      person_3
                    </span>
                    <input
                      type="text"
                      placeholder="Nombre completo"
                      value={madreTutora}
                      onChange={(e) => setMadreTutora(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Teléfono Madre / Tutora
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                      phone_iphone
                    </span>
                    <input
                      type="tel"
                      placeholder="Ej: 351-9876543"
                      value={telefonoMadreTutora}
                      onChange={(e) => setTelefonoMadreTutora(e.target.value)}
                      className={`w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm text-slate-800 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8] ${
                        errorTelMadre ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200 bg-white'
                      }`}
                    />
                  </div>
                  {errorTelMadre && <p className="mt-1 text-[11px] font-semibold text-rose-600">{errorTelMadre}</p>}
                </div>
              </div>
            </div>

            {/* 4. Domicilio y Residencia */}
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
              <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-800">
                  <span className="material-symbols-outlined text-[22px]">home_pin</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Domicilio y Residencia</h3>
                  <p className="text-xs text-slate-400">Dirección y ubicación geográfica</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                      Calle
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Av. Colón"
                      value={calle}
                      onChange={(e) => setCalle(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3.5 text-sm text-slate-800 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                      Número
                    </label>
                    <input
                      type="text"
                      placeholder="1234"
                      value={numeracion}
                      onChange={(e) => setNumeracion(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3.5 text-sm text-slate-800 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Barrio / Localidad
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Centro, Nueva Córdoba, Alberdi"
                    value={barrio}
                    onChange={(e) => setBarrio(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3.5 text-sm text-slate-800 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                      Piso / Depto
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 4to B"
                      value={piso}
                      onChange={(e) => setPiso(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3.5 text-sm text-slate-800 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                      Sector / Mza
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Mza 12 Lote 4"
                      value={sector}
                      onChange={(e) => setSector(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3.5 text-sm text-slate-800 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Escolaridad e Institución */}
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
              <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-800">
                  <span className="material-symbols-outlined text-[22px]">school</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Escolaridad</h3>
                  <p className="text-xs text-slate-400">Institución y turno escolar</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Escuela / Colegio
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                      apartment
                    </span>
                    <input
                      type="text"
                      placeholder="Nombre de la escuela"
                      value={escuela}
                      onChange={(e) => setEscuela(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Año / Grado
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                      auto_stories
                    </span>
                    <input
                      type="text"
                      placeholder="Ej: 3er Grado Primaria / Sala 5"
                      value={anioGrado}
                      onChange={(e) => setAnioGrado(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Turno Escolar
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTurnoEscolar('manana')}
                      className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition ${
                        turnoEscolar === 'manana'
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'bg-[#f1f4f5] text-slate-600 hover:bg-[#e4e8ea]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">wb_sunny</span>
                      <span>Mañana</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTurnoEscolar('tarde')}
                      className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition ${
                        turnoEscolar === 'tarde'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-[#f1f4f5] text-slate-600 hover:bg-[#e4e8ea]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">wb_twilight</span>
                      <span>Tarde</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 6. Módulos y Documentación Escolar (CAR / PPI / Acta Acuerdo) */}
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d6ffe8] text-[#006d44]">
                  <span className="material-symbols-outlined text-[22px]">layers</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Módulos Asignados y Documentación</h3>
                  <p className="text-xs text-slate-400">Modalidad prestacional y actas escolares vigentes</p>
                </div>
              </div>
            </div>

            {/* Módulos */}
            <div className="mb-8">
              <h4 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Selección de Módulos
              </h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {MODULOS.map((m) => {
                  const activo = moduloNuevo.includes(m.id);
                  return (
                    <div
                      key={m.id}
                      onClick={() => alternarModulo(m.id)}
                      className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                        activo
                          ? 'border-[#006d44] bg-[#f0fbf5] ring-2 ring-[#d6ffe8] shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold ${
                              activo ? 'bg-[#006d44] text-white' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {m.id}
                          </span>
                          <h5 className="text-sm font-bold text-slate-800">{m.id}</h5>
                        </div>
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded-full border transition ${
                            activo
                              ? 'border-[#006d44] bg-[#006d44] text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {activo && <span className="material-symbols-outlined text-[14px]">check</span>}
                        </div>
                      </div>
                      <p className="mt-2 text-xs font-medium text-slate-700">{m.label}</p>
                      <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">{m.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Documentación por Años Escolares */}
            <div className="border-t border-slate-100 pt-6">
              <h4 className="mb-4 text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Documentación y Actas por Ciclo Lectivo
              </h4>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {/* CAR */}
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[#006d44]">description</span>
                      <span className="text-sm font-bold text-slate-800">CAR (Constancia)</span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {carAnios.length} {carAnios.length === 1 ? 'año' : 'años'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ANIOS_ESCOLARES.map((anio) => {
                      const activo = carAnios.includes(anio);
                      return (
                        <button
                          key={`car-btn-${anio}`}
                          type="button"
                          onClick={() =>
                            setCarAnios((prev) =>
                              prev.includes(anio) ? prev.filter((a) => a !== anio) : [...prev, anio]
                            )
                          }
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                            activo
                              ? 'bg-[#006d44] text-white shadow-sm'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {anio}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* PPI */}
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-purple-700">menu_book</span>
                      <span className="text-sm font-bold text-slate-800">PPI (Proyecto Indiv.)</span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {ppiAnios.length} {ppiAnios.length === 1 ? 'año' : 'años'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ANIOS_ESCOLARES.map((anio) => {
                      const activo = ppiAnios.includes(anio);
                      return (
                        <button
                          key={`ppi-btn-${anio}`}
                          type="button"
                          onClick={() =>
                            setPpiAnios((prev) =>
                              prev.includes(anio) ? prev.filter((a) => a !== anio) : [...prev, anio]
                            )
                          }
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                            activo
                              ? 'bg-purple-700 text-white shadow-sm'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {anio}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Acta Acuerdo */}
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-blue-700">handshake</span>
                      <span className="text-sm font-bold text-slate-800">Acta Acuerdo</span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {actaAcuerdoAnios.length} {actaAcuerdoAnios.length === 1 ? 'año' : 'años'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ANIOS_ESCOLARES.map((anio) => {
                      const activo = actaAcuerdoAnios.includes(anio);
                      return (
                        <button
                          key={`acta-btn-${anio}`}
                          type="button"
                          onClick={() =>
                            setActaAcuerdoAnios((prev) =>
                              prev.includes(anio) ? prev.filter((a) => a !== anio) : [...prev, anio]
                            )
                          }
                          className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                            activo
                              ? 'bg-blue-700 text-white shadow-sm'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {anio}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 7. Selección de Tratamientos y Especialidades */}
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d6ffe8] text-[#006d44]">
                  <span className="material-symbols-outlined text-[22px]">medical_services</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Tratamientos y Especialidades Terapéuticas</h3>
                  <p className="text-xs text-slate-400">
                    Activá las terapias que realizará el paciente para habilitar la grilla de turnos
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                {tratamientosNuevo.length} de {TRATAMIENTOS.length} activas
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
              {TRATAMIENTOS.map((t) => {
                const activo = tratamientosNuevo.includes(t);
                const info = TRATAMIENTO_INFO[t] || { icono: 'medical_services', color: 'emerald' };
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => alternarNuevo(t)}
                    className={`flex flex-col items-center justify-center gap-2 rounded-2xl p-4 text-center transition-all ${
                      activo
                        ? 'border-2 border-[#006d44] bg-[#f0fbf5] text-[#006d44] shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                        activo ? 'bg-[#006d44] text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">{info.icono}</span>
                    </div>
                    <span className="text-xs font-bold leading-tight line-clamp-2">{t}</span>
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider rounded-md px-1.5 py-0.5 ${
                        activo ? 'bg-emerald-200/60 text-[#006d44]' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 8. Cronograma Terapéutico Semanal */}
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-800">
                  <span className="material-symbols-outlined text-[22px]">calendar_month</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Cronograma Semanal de Turnos</h3>
                  <p className="text-xs text-slate-400">
                    Asignación de días y franjas horarias por tratamiento
                  </p>
                </div>
              </div>
            </div>

            {tratamientosNuevo.length > 0 ? (
              <div className="space-y-6">
                {tratamientosNuevo.map((t) => {
                  if (t === 'Integracion') {
                    return (
                      <div
                        key={t}
                        className="rounded-2xl border border-rose-200/80 bg-rose-50/30 p-5 shadow-sm"
                      >
                        <div className="mb-3 flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-800">
                            <span className="material-symbols-outlined text-[22px]">school</span>
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 text-base">Horario de Integración Escolar</h4>
                            <p className="text-xs text-slate-500">
                              Configuración de días y horarios de apoyo en el establecimiento educativo
                            </p>
                          </div>
                        </div>

                        <div>
                          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                            Detalle de Horarios de Integración (Texto libre)
                          </label>
                          <textarea
                            value={integracionHorario}
                            onChange={(e) => setIntegracionHorario(e.target.value)}
                            rows={3}
                            placeholder="Ej: Lunes y Miércoles de 14:00 a 16:30 hs en Escuela Mariano Moreno..."
                            className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
                          />
                        </div>
                      </div>
                    );
                  }

                  return (
                    <CronogramaCard
                      key={t}
                      tratamiento={t}
                      horarios={horariosCronograma}
                      turnosSeleccionados={turnosNuevo[t] || []}
                      alAlternar={(clave) => alternarTurnoNuevo(t, clave)}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 bg-[#f8faf9] rounded-2xl border border-dashed border-slate-200">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <span className="material-symbols-outlined text-[30px]">event_busy</span>
                </div>
                <p className="text-base font-bold text-slate-700">Sin tratamientos seleccionados</p>
                <p className="text-xs text-slate-400 max-w-md mt-1">
                  Seleccioná al menos un tratamiento en la sección superior para habilitar y configurar la grilla de turnos semanales.
                </p>
              </div>
            )}
          </div>

          {/* Barra Inferior de Acción y Guardado */}
          <div className="sticky bottom-4 z-20 flex items-center justify-between gap-4 rounded-2xl bg-white/95 p-4 shadow-xl ring-1 ring-slate-200 backdrop-blur-md">
            <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500">
              <span className="material-symbols-outlined text-[18px] text-[#006d44]">info</span>
              <span>Los campos marcados con (<span className="text-rose-500 font-bold">*</span>) son de carácter obligatorio.</span>
            </div>

            <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
              <button
                type="button"
                onClick={limpiarFormulario}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Limpiar Formulario
              </button>
              <button
                type="button"
                onClick={crearPaciente}
                className="inline-flex items-center gap-2 rounded-xl bg-[#006d44] px-8 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-[#005837] hover:shadow-lg"
              >
                <span className="material-symbols-outlined text-[20px]">check_circle</span>
                <span>Guardar Registro de Paciente</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
