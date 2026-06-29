import React, { useState } from 'react';
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

const DIAS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'];
const ETIQUETAS_DIAS = {
  Lun: 'Lun',
  Mar: 'Mar',
  Mie: 'Mie',
  Jue: 'Jue',
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
  { id: 'MII', label: 'Modulo integral intensivo (MII)' },
  { id: 'MIS', label: 'Modulo integral simple (MIS)' },
  { id: 'MIE', label: 'Modulo integracion escolar (MIE)' },
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

function AlternarLista({ seleccionados, alCambiar }) {
  return (
    <div className="flex flex-wrap gap-3">
      {TRATAMIENTOS.map((t) => (
        <label
          key={t}
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            border: '1px solid #ddd',
            padding: '6px 10px',
            borderRadius: 6,
          }}
        >
          <input
            type="checkbox"
            checked={seleccionados.includes(t)}
            onChange={() => alCambiar(t)}
          />
          {t}
        </label>
      ))}
    </div>
  );
}

function Cronograma({ tratamiento, turnosSeleccionados, alAlternar, horarios }) {
  const listaHorarios = Array.isArray(horarios) && horarios.length ? horarios : HORARIOS;
  return (
    <div className="mt-3 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4">
      <strong>{tratamiento}</strong>
      {tratamiento === 'Integracion' ? (
        <div style={{ marginTop: 6, color: '#666' }}>
          Horarios de Integracion se configuran mas adelante.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 8 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '4px 6px' }}>Hora</th>
                {DIAS.map((d) => (
                  <th key={d} style={{ textAlign: 'left', padding: '4px 6px' }}>
                    {ETIQUETAS_DIAS[d] || d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listaHorarios.map((hora) => (
                <tr key={hora}>
                  <td style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>{hora}</td>
                  {DIAS.map((dia) => {
                    const clave = `${dia}-${hora}`;
                    const marcado = turnosSeleccionados.includes(clave);
                    return (
                      <td key={clave} style={{ padding: '4px 6px' }}>
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() => alAlternar(clave)}
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
  );
}

export default function AltaPacientes({ alAbrirPaciente }) {
  const { pacientes, obrasSociales, seleccionarPaciente, agregarPaciente } = usePacientes();
  const sectionCardClass =
    'rounded-3xl border border-outline-variant/15 bg-gradient-to-br from-surface-container-lowest to-white p-4 shadow-sm shadow-black/5 sm:p-5';

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
  const [integracionHorario, setIntegracionHorario] = useState('');
  const [moduloNuevo, setModuloNuevo] = useState([]);
  const [tratamientosNuevo, setTratamientosNuevo] = useState([]);
  const [turnosNuevo, setTurnosNuevo] = useState({});
  const [guardado, setGuardado] = useState(false);
  const [errorAlta, setErrorAlta] = useState('');
  const horariosCronograma = React.useMemo(
    () => resolverHorariosPorObraSocial(obraSocialPdfId || obraSocial),
    [obraSocialPdfId, obraSocial]
  );

  const obtenerCamposNavegables = (contenedor) => {
    if (!contenedor || typeof contenedor.querySelectorAll !== 'function') return [];
    const candidatos = contenedor.querySelectorAll('input, select, textarea, button');
    return Array.from(candidatos).filter((el) => {
      if (!el || el.disabled) return false;
      if (el.tabIndex < 0) return false;
      const tipo = String(el.getAttribute('type') || '').toLowerCase();
      if (tipo === 'hidden') return false;
      if (el.getAttribute('aria-hidden') === 'true') return false;
      return el.offsetParent !== null;
    });
  };

  const moverFocoAlSiguienteCampo = (contenedor, actual) => {
    const campos = obtenerCamposNavegables(contenedor);
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

  const obrasSocialesDisponibles = React.useMemo(() => {
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

  const diagnosticosDisponibles = React.useMemo(() => {
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
      window.alert('Primero crea el paciente para poder descargar el PDF.');
      return;
    }
    const obraId = String(obraSocialPdfId || obraSocial || '').trim();
    if (!obraId) {
      window.alert('Selecciona una obra social.');
      return;
    }
    const tratamiento = String(tratamientoOs || '').trim();
    if (!tratamiento) {
      window.alert('Selecciona un tratamiento.');
      return;
    }
    const mesNum = Number(mesOs);
    const anioNum = Number(anioOs);
    if (!Number.isInteger(mesNum) || mesNum < 1 || mesNum > 12) {
      window.alert('Mes invalido.');
      return;
    }
    if (!Number.isInteger(anioNum) || anioNum < 2000 || anioNum > 2100) {
      window.alert('Año invalido.');
      return;
    }
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
        window.alert(`No se pudo descargar el PDF: ${mensaje}`);
        return;
      }
      const blob = await respuesta.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = blobUrl;
      enlace.download = `${obraId}.pdf`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      window.alert('No se pudo descargar el PDF. Revisa la conexion con el servidor.');
    }
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
      setErrorAlta('Ya existe un paciente con ese DNI.');
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
      setPacienteCreadoId(creado.id);
      setIntegracionHorario('');
      setModuloNuevo([]);
      setTratamientosNuevo([]);
      setTurnosNuevo({});
      seleccionarPaciente(creado.id);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
    } else {
      setErrorAlta('No se pudo crear el paciente.');
    }
  };

  const errorNombre = (nombre && !/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-\']+$/.test(nombre)) ? 'Solo se permiten letras y espacios.' : '';
  const errorApellido = (apellido && !/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-\']+$/.test(apellido)) ? 'Solo se permiten letras y espacios.' : '';
  const errorDni = (dni && !/^\d{7,8}$/.test(dni)) ? 'Debe tener 7 u 8 dígitos numéricos.' : '';
  const errorCuit = (cuit && !/^\d{2}\-?\d{8}\-?\d{1}$/.test(cuit)) ? 'Debe tener 11 dígitos numéricos (ej: 20-12345678-9).' : '';
  const errorTelPadre = (telefonoPadreTutor && !/^[\d\s\-\+\(\)]+$/.test(telefonoPadreTutor)) ? 'Solo se permiten números y símbolos telefónicos.' : '';
  const errorTelMadre = (telefonoMadreTutora && !/^[\d\s\-\+\(\)]+$/.test(telefonoMadreTutora)) ? 'Solo se permiten números y símbolos telefónicos.' : '';

  const labelObligatorio = (texto) => (
    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
      {texto} <span className="text-rose-500 font-bold ml-1">*</span>
    </label>
  );

  const getInputClass = (err) => `w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40 ${err ? 'mb-1 ring-2 ring-rose-500/50' : 'mb-3'}`;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="mb-10 flex flex-col justify-between gap-6 rounded-[28px] border border-outline-variant/10 bg-gradient-to-r from-primary/5 via-transparent to-transparent p-5 md:flex-row md:items-end sm:p-6">
        <div>
          <h2 className="mb-2 text-3xl font-extrabold tracking-tight text-on-surface">
            Nuevo Registro de Paciente
          </h2>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="w-full rounded-2xl border border-outline-variant/10 bg-white px-6 py-2.5 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-primary-container/20 sm:w-auto"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={crearPaciente}
            className="w-full rounded-2xl bg-gradient-to-br from-primary to-primary-dim px-8 py-2.5 text-sm font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:opacity-90 sm:w-auto"
          >
            Guardar Registro
          </button>
        </div>
      </div>
      <form
        onSubmit={(e) => e.preventDefault()}
        onKeyDown={manejarEnterComoTab}
        className="grid grid-cols-1 gap-6 xl:grid-cols-2"
      >
        <div className={sectionCardClass}>
          <h4 className="mb-6 text-sm font-bold uppercase tracking-[0.2em] text-primary/80">PACIENTE</h4>
          {labelObligatorio('Nombre')}
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            placeholder="Ej: Juan"
            className={getInputClass(errorNombre)}
          />
          {errorNombre && <p className="text-xs text-rose-500 mb-3 ml-1 font-medium">{errorNombre}</p>}
          
          {labelObligatorio('Apellido')}
          <input
            value={apellido}
            onChange={(e) => setApellido(e.target.value)}
            required
            placeholder="Ej: Perez"
            className={getInputClass(errorApellido)}
          />
          {errorApellido && <p className="text-xs text-rose-500 mb-3 ml-1 font-medium">{errorApellido}</p>}
          
          {labelObligatorio('Fecha de nacimiento')}
          <input
            type="date"
            value={fechaNacimiento}
            onChange={(e) => setFechaNacimiento(e.target.value)}
            required
            className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40 mb-3"
          />
          <div className="mb-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Ultimo control fisiatrico
              </label>
              <input
                type="date"
                value={ultimoControlFisiatrico}
                onChange={(e) => setUltimoControlFisiatrico(e.target.value)}
                className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Vencimiento control fisiatrico
              </label>
              <input
                type="date"
                value={fechaVencimientoControlFisiatrico}
                onChange={(e) => setFechaVencimientoControlFisiatrico(e.target.value)}
                className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
          <div className="mb-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Ultimo control de trabajo social
              </label>
              <input
                type="date"
                value={ultimoControlTrabajoSocial}
                onChange={(e) => setUltimoControlTrabajoSocial(e.target.value)}
                className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Vencimiento de trabajo social
              </label>
              <input
                type="date"
                value={fechaVencimientoControlTrabajoSocial}
                onChange={(e) => setFechaVencimientoControlTrabajoSocial(e.target.value)}
                className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
          {labelObligatorio('DNI')}
          <input
            value={dni}
            onChange={(e) =>
              setDni(String(e.target.value || '').replace(/\D/g, '').slice(0, 8))
            }
            required
            inputMode="numeric"
            maxLength={8}
            className={getInputClass(errorDni)}
          />
          {errorDni && <p className="text-xs text-rose-500 mb-3 ml-1 font-medium">{errorDni}</p>}
          
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">CUIT</label>
          <input
            value={cuit}
            onChange={(e) => setCuit(e.target.value)}
            className={getInputClass(errorCuit)}
          />
          {errorCuit && <p className="text-xs text-rose-500 mb-3 ml-1 font-medium">{errorCuit}</p>}
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">N° afiliado</label>
          <input
            value={nroAfiliado}
            onChange={(e) => setNroAfiliado(e.target.value)}
            className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40 mb-3"
          />
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Diagnóstico</label>
          <input
            value={diagnostico}
            onChange={(e) => setDiagnostico(e.target.value)}
            list="diagnosticos"
            className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40 mb-3"
          />
          <datalist id="diagnosticos">
            {diagnosticosDisponibles.map((d) => (
              <option key={`diag-${d}`} value={d} />
            ))}
          </datalist>
        </div>
        <div className={sectionCardClass}>
          <h4 className="mb-6 text-sm font-bold uppercase tracking-[0.2em] text-primary/80">ESCUELA</h4>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Escuela</label>
          <input
            value={escuela}
            onChange={(e) => setEscuela(e.target.value)}
            className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40 mb-3"
          />
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Ano/Grado</label>
          <input
            value={anioGrado}
            onChange={(e) => setAnioGrado(e.target.value)}
            className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40 mb-3"
          />
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Turno escolar
          </label>
          <select
            value={turnoEscolar}
            onChange={(e) => setTurnoEscolar(e.target.value)}
            className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40"
          >
            <option value="">(Seleccionar)</option>
            <option value="manana">Manana</option>
            <option value="tarde">Tarde</option>
          </select>
        </div>
        <div className={sectionCardClass}>
          <h4 className="mb-6 text-sm font-bold uppercase tracking-[0.2em] text-primary/80">PADRES</h4>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Padre/Tutor</label>
          <input
            value={padreTutor}
            onChange={(e) => setPadreTutor(e.target.value)}
            className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40 mb-3"
          />
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Telefono Padre/Tutor
          </label>
          <input
            value={telefonoPadreTutor}
            onChange={(e) => setTelefonoPadreTutor(e.target.value)}
            className={getInputClass(errorTelPadre)}
          />
          {errorTelPadre && <p className="text-xs text-rose-500 mb-3 ml-1 font-medium">{errorTelPadre}</p>}
          
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Madre/Tutora</label>
          <input
            value={madreTutora}
            onChange={(e) => setMadreTutora(e.target.value)}
            className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40 mb-3"
          />
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Telefono Madre/Tutora
          </label>
          <input
            value={telefonoMadreTutora}
            onChange={(e) => setTelefonoMadreTutora(e.target.value)}
            className={getInputClass(errorTelMadre)}
          />
          {errorTelMadre && <p className="text-xs text-rose-500 mb-3 ml-1 font-medium">{errorTelMadre}</p>}
        </div>
        <div className={sectionCardClass}>
          <h4 className="mb-6 text-sm font-bold uppercase tracking-[0.2em] text-primary/80">DOMICILIO</h4>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Calle</label>
          <input
            value={calle}
            onChange={(e) => setCalle(e.target.value)}
            className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40 mb-3"
          />
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Numeracion</label>
          <input
            value={numeracion}
            onChange={(e) => setNumeracion(e.target.value)}
            className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40 mb-3"
          />
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Barrio</label>
          <input
            value={barrio}
            onChange={(e) => setBarrio(e.target.value)}
            className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40 mb-3"
          />
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Piso</label>
          <input
            value={piso}
            onChange={(e) => setPiso(e.target.value)}
            className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40 mb-3"
          />
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Sector</label>
          <input
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className={sectionCardClass}>
          <h4 className="mb-6 text-sm font-bold uppercase tracking-[0.2em] text-primary/80">OBRA SOCIAL</h4>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Obra social
          </label>
          <select
            value={String(obraSocial || '').trim()}
            onChange={(e) => {
              const val = e.target.value;
              setObraSocial(val);
              setObraSocialPdfId(val);
            }}
            className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40 mb-3"
          >
            <option value="">(Seleccionar)</option>
            {obrasSocialesDisponibles.map((o) => {
              const apiData = (obrasSociales || []).find(osObj => osObj.id === o);
              const showSinPlantilla = apiData && apiData.hasTemplate === false;
              const isMissing = !apiData;
              return (
                <option key={`os-${o}`} value={o}>
                  {o}{(showSinPlantilla || isMissing) ? ' (sin plantilla)' : ''}
                </option>
              );
            })}
          </select>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Tratamiento (planilla)</label>
          <select
            value={tratamientoOs}
            onChange={(e) => setTratamientoOs(e.target.value)}
            className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40 mb-3"
          >
            <option value="">(Seleccionar)</option>
            {tratamientosNuevo.map((t) => (
              <option key={`alta-t-os-${t}`} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Mes (planilla)</label>
          <select
            value={String(mesOs)}
            onChange={(e) => setMesOs(Number(e.target.value))}
            className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40 mb-3"
          >
            {MESES.map((m, idx) => (
              <option key={`alta-mes-os-${idx + 1}`} value={idx + 1}>
                {m}
              </option>
            ))}
          </select>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Año (planilla)</label>
          <input
            value={String(anioOs)}
            onChange={(e) => setAnioOs(e.target.value)}
            className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40 mb-3"
          />
          <button
            type="button"
            onClick={descargarObraSocial}
            className="w-full rounded-xl bg-primary/10 px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/15"
          >
            Descargar PDF de obra social
          </button>
        </div>
        <div className="rounded-3xl border border-transparent bg-gradient-to-br from-surface-container-lowest to-white p-5 shadow-sm shadow-black/5 sm:p-8 xl:col-span-2">
        <div className="mb-2 text-sm font-semibold text-on-surface">Tratamientos</div>
        <AlternarLista seleccionados={tratamientosNuevo} alCambiar={alternarNuevo} />
        <div className="mb-2 mt-3 text-sm font-semibold text-on-surface">Modulo</div>
        <div className="flex flex-wrap gap-3">
          {MODULOS.map((m) => (
            <label
              key={m.id}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                border: '1px solid #ddd',
                padding: '6px 10px',
                borderRadius: 6,
              }}
            >
              <input
                type="checkbox"
                checked={moduloNuevo.includes(m.id)}
                onChange={() => alternarModulo(m.id)}
              />
              {m.label}
            </label>
          ))}
        </div>
        <div
          style={{
            borderTop: '1px solid #ddd',
            marginTop: 16,
            paddingTop: 16,
            marginBottom: 12,
          }}
        >
          <h4 className="mb-6 text-xl font-bold text-on-surface">Autorizacion</h4>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Autorizado desde</label>
              <input
                type="date"
                value={autorizadoDesde}
                onChange={(e) => setAutorizadoDesde(e.target.value)}
                className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Vence el</label>
              <input
                type="date"
                value={autorizadoHasta}
                onChange={(e) => setAutorizadoHasta(e.target.value)}
                className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
        </div>
        <div className="mb-3 mt-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">CAR</div>
        <div className="mb-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          {ANIOS_ESCOLARES.map((anio) => (
            <label
              key={`car-modulo-${anio}`}
              className="flex items-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-2 hover:bg-white transition-colors"
            >
              <input
                type="checkbox"
                checked={carAnios.includes(anio)}
                onChange={() =>
                  setCarAnios((prev) =>
                    prev.includes(anio) ? prev.filter((item) => item !== anio) : [...prev, anio]
                  )
                }
              />
              {anio}
            </label>
          ))}
        </div>
        <div className="mb-3 text-xs font-bold uppercase tracking-widest text-on-surface-variant">PPI</div>
        <div className="mb-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          {ANIOS_ESCOLARES.map((anio) => (
            <label
              key={`ppi-modulo-${anio}`}
              className="flex items-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-2 hover:bg-white transition-colors"
            >
              <input
                type="checkbox"
                checked={ppiAnios.includes(anio)}
                onChange={() =>
                  setPpiAnios((prev) =>
                    prev.includes(anio) ? prev.filter((item) => item !== anio) : [...prev, anio]
                  )
                }
              />
              {anio}
            </label>
          ))}
        </div>
        <div className="mb-3 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Acta Acuerdo</div>
        <div className="mb-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          {ANIOS_ESCOLARES.map((anio) => (
            <label
              key={`acta-acuerdo-modulo-${anio}`}
              className="flex items-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-2 hover:bg-white transition-colors"
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
              />
              {anio}
            </label>
          ))}
        </div>
        <div className="rounded-3xl border border-surface-container-high/70 bg-gradient-to-br from-surface-container-low/70 to-white p-5 sm:p-8 xl:col-span-2">
          <h4 className="mb-6 text-xl font-bold text-on-surface">Horarios de terapias</h4>
          {tratamientosNuevo.length ? (
            <div className="flex flex-wrap gap-3">
              {tratamientosNuevo.map((t) => (
                <div key={t} className="min-w-[320px] flex-1">
                  {t === 'Integracion' ? (
                    <div className="mt-3 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4">
                      <strong>{t}</strong>
                      <div className="mt-2">
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                          Horario de Integracion (texto libre)
                        </label>
                        <textarea
                          value={integracionHorario}
                          onChange={(e) => setIntegracionHorario(e.target.value)}
                          rows={3}
                          className="w-full rounded-lg border-none bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40"
                          placeholder="Ej: Lunes y Miercoles 14:00 a 15:00"
                        />
                      </div>
                    </div>
                  ) : (
                    <Cronograma
                      tratamiento={t}
                      horarios={horariosCronograma}
                      turnosSeleccionados={turnosNuevo[t] || []}
                      alAlternar={(clave) => alternarTurnoNuevo(t, clave)}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-on-surface-variant">
              Selecciona tratamientos para habilitar el cronograma.
            </div>
          )}
        </div>
        <button type="button" onClick={crearPaciente} className="mt-4 w-full rounded-xl bg-gradient-to-br from-primary to-primary-dim px-8 py-3 text-sm font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:opacity-90 xl:col-span-2">
          Crear paciente
        </button>
        {guardado ? (
          <div className="mt-4 text-sm font-semibold text-primary xl:col-span-2">
            Paciente guardado.
          </div>
        ) : null}
        {errorAlta ? (
          <div className="mt-4 text-sm font-semibold text-error xl:col-span-2">{errorAlta}</div>
        ) : null}
        </div>
      </form>
    </div>
  );
}
