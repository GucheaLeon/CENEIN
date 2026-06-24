import React, { useEffect, useMemo, useState } from 'react';
import { usePacientes } from '../context/PatientsContext';

const TRATAMIENTOS = [
  'Fonoaudiologia',
  'Psicologia',
  'Psicopedagogia',
  'Psicomotricidad',
  'Kinesiologia',
  'TO Terapia Ocupacional',
  'Integracion',
];
const MODULOS = ['MII', 'MIS', 'MIE'];
const MODULO_ESTILOS = {
  MII: {
    punto: 'bg-emerald-500',
    ficha: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    opcion: 'border-emerald-200 bg-emerald-50/70',
  },
  MIS: {
    punto: 'bg-amber-500',
    ficha: 'border-amber-200 bg-amber-50 text-amber-700',
    opcion: 'border-amber-200 bg-amber-50/70',
  },
  MIE: {
    punto: 'bg-sky-500',
    ficha: 'border-sky-200 bg-sky-50 text-sky-700',
    opcion: 'border-sky-200 bg-sky-50/70',
  },
};
const ANIOS_DOCUMENTACION = [2026, 2027, 2028, 2029, 2030];
const CAMPOS_FECHA_SECTORIZADOS = [
  {
    value: 'fechaVencimientoControlTrabajoSocial',
    label: 'Vencimiento control de trabajo social',
  },
  {
    value: 'fechaAltaControlTrabajoSocial',
    label: 'Alta control de trabajo social',
  },
  {
    value: 'ultimoControlTrabajoSocial',
    label: 'Fecha control de trabajo social',
  },
  {
    value: 'fechaVencimientoControlFisiatrico',
    label: 'Vencimiento control fisiatrico',
  },
  {
    value: 'fechaAltaControlFisiatrico',
    label: 'Alta control fisiatrico',
  },
  {
    value: 'ultimoControlFisiatrico',
    label: 'Fecha control fisiatrico',
  },
];
const CAMPOS_CUMPLIMIENTO = [
  { value: 'car', label: 'CAR' },
  { value: 'ppi', label: 'PPI' },
  { value: 'controlTrabajoSocial', label: 'Control de trabajo social' },
  { value: 'controlFisiatrico', label: 'Control fisiatrico' },
];
const CAMPOS_FECHA_POR_CUMPLIMIENTO = {
  controlTrabajoSocial: [
    'fechaVencimientoControlTrabajoSocial',
    'fechaAltaControlTrabajoSocial',
    'ultimoControlTrabajoSocial',
  ],
  controlFisiatrico: [
    'fechaVencimientoControlFisiatrico',
    'fechaAltaControlFisiatrico',
    'ultimoControlFisiatrico',
  ],
};

const normalizarModulos = (valor) => {
  const lista = Array.isArray(valor)
    ? valor
    : String(valor || '')
        .split(',')
        .map((item) => String(item || '').trim().toUpperCase())
        .filter(Boolean);
  return Array.from(new Set(lista.filter((item) => MODULOS.includes(item))));
};
const clasesModulo = (modulo) => MODULO_ESTILOS[modulo] || MODULO_ESTILOS.MII;
const renderModuloBadge = (modulo, { compacto = false } = {}) => {
  const estilos = clasesModulo(modulo);
  return (
    <span
      key={`modulo-badge-${modulo}`}
      className={`inline-flex items-center rounded-lg border font-bold uppercase tracking-wide ${
        compacto ? 'gap-1.5 px-2 py-1 text-[10px]' : 'gap-2 px-2.5 py-1.5 text-xs'
      } ${estilos.ficha}`}
    >
      <span className={`h-2.5 w-2.5 rounded-[4px] ${estilos.punto}`} />
      {modulo}
    </span>
  );
};

const DIAS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'];
const ETIQUETAS_DIAS = {
  Lun: 'Lun',
  Mar: 'Mar',
  Mie: 'Mie',
  Jue: 'Jue',
  Vie: 'Viernes',
};
const DIAS_COMPLETO = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
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
const RESULTADOS_POR_PAGINA = 10;

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
const pad2 = (valor) => String(valor).padStart(2, '0');
const normalizarTexto = (valor) =>
  String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
const tokenizarBusqueda = (valor) =>
  normalizarTexto(valor)
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
const normalizarHora = (valor) => {
  const m = String(valor || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return String(valor || '').trim();
  return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`;
};
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
const normalizarFechaIso = (valor) => String(valor || '').trim().slice(0, 10);
const normalizarAnios = (valor) => {
  if (Array.isArray(valor)) {
    return Array.from(
      new Set(
        valor
          .map((item) => Number(item))
          .filter((item) => Number.isInteger(item))
      )
    ).sort((a, b) => a - b);
  }
  return String(valor || '')
    .split(',')
    .map((item) => Number(String(item || '').trim()))
    .filter((item) => Number.isInteger(item))
    .filter((item, index, arr) => arr.indexOf(item) === index)
    .sort((a, b) => a - b);
};
const tieneDato = (valor) => String(valor || '').trim() !== '';
const resolverEstadoCumplimiento = (paciente, campo, anio) => {
  if (campo === 'car') {
    const anios = normalizarAnios(paciente?.carAnios);
    if (!anio) return anios.length > 0;
    return anios.includes(Number(anio));
  }
  if (campo === 'ppi') {
    const anios = normalizarAnios(paciente?.ppiAnios);
    if (!anio) return anios.length > 0;
    return anios.includes(Number(anio));
  }
  if (campo === 'controlTrabajoSocial') {
    return (
      tieneDato(paciente?.ultimoControlTrabajoSocial) ||
      tieneDato(paciente?.fechaVencimientoControlTrabajoSocial)
    );
  }
  if (campo === 'controlFisiatrico') {
    return (
      tieneDato(paciente?.ultimoControlFisiatrico) ||
      tieneDato(paciente?.fechaVencimientoControlFisiatrico)
    );
  }
  return true;
};
const describirDocumentacionPaciente = (paciente) => {
  const car = normalizarAnios(paciente?.carAnios);
  const ppi = normalizarAnios(paciente?.ppiAnios);
  return [
    `CAR: ${car.length ? car.join(', ') : 'No'}`,
    `PPI: ${ppi.length ? ppi.join(', ') : 'No'}`,
    `Trabajo social: ${
      resolverEstadoCumplimiento(paciente, 'controlTrabajoSocial') ? 'Si' : 'No'
    }`,
    `Fisiatrico: ${
      resolverEstadoCumplimiento(paciente, 'controlFisiatrico') ? 'Si' : 'No'
    }`,
  ].join(' | ');
};
const claveTurnoNormalizada = (tratamiento, hora) =>
  `${normalizarTexto(tratamiento)}|${normalizarHora(hora)}`;
const resolverNombreApellido = (paciente) => {
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
};
const formatearEtiquetaPaciente = (paciente) => {
  const datos = resolverNombreApellido(paciente);
  const etiqueta = `${datos.apellido} ${datos.nombre}`.trim();
  return etiqueta || '-';
};
const obtenerInicialesPaciente = (paciente) => {
  const datos = resolverNombreApellido(paciente);
  const iniciales = `${datos.nombre.charAt(0)}${datos.apellido.charAt(0)}`.trim();
  return iniciales.toUpperCase() || 'P';
};
const compararPacientesPorApellidoNombre = (a, b) => {
  const datosA = resolverNombreApellido(a);
  const datosB = resolverNombreApellido(b);
  const apellidoA = normalizarTexto(datosA.apellido);
  const apellidoB = normalizarTexto(datosB.apellido);
  const cmpApellido = apellidoA.localeCompare(apellidoB, 'es');
  if (cmpApellido !== 0) return cmpApellido;
  const nombreA = normalizarTexto(datosA.nombre);
  const nombreB = normalizarTexto(datosB.nombre);
  const cmpNombre = nombreA.localeCompare(nombreB, 'es');
  if (cmpNombre !== 0) return cmpNombre;
  return String(a?.id || '').localeCompare(String(b?.id || ''), 'es');
};
const coincideBusquedaNombrePaciente = (paciente, consulta) => {
  const tokensConsulta = tokenizarBusqueda(consulta);
  if (!tokensConsulta.length) return true;
  const dniPaciente = String(paciente?.dni || '').replace(/\D/g, '');
  if (dniPaciente) {
    const consultaDni = String(consulta || '').replace(/\D/g, '');
    if (consultaDni && dniPaciente.includes(consultaDni)) {
      return true;
    }
  }
  const datos = resolverNombreApellido(paciente);
  const variantes = [
    `${datos.apellido} ${datos.nombre}`.trim(),
    `${datos.nombre} ${datos.apellido}`.trim(),
    String(paciente?.nombre || '').trim(),
    String(paciente?.apellido || '').trim(),
  ];
  const tokensPaciente = Array.from(
    new Set(
      variantes.flatMap((texto) => tokenizarBusqueda(texto))
    )
  );
  if (!tokensPaciente.length) return false;
  return tokensConsulta.every((token) =>
    tokensPaciente.some((tokenPaciente) => tokenPaciente.startsWith(token))
  );
};
const obtenerSemanasMes = (mes, anio) => {
  const year = Number(anio) || ANIO_BASE;
  const diasEnMes = new Date(year, mes, 0).getDate();
  const semanas = [];
  let semana = [null, null, null, null, null];
  for (let dia = 1; dia <= diasEnMes; dia += 1) {
    const fecha = new Date(year, mes - 1, dia);
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
const generarEtiquetaSemana = (semana, index) => {
  const dias = semana.filter((d) => d);
  if (!dias.length) return `Semana ${index + 1}`;
  return `Semana ${index + 1} (${dias[0]}-${dias[dias.length - 1]})`;
};
const tieneTurnoEnFecha = (paciente, mes, diaNumero, tratamientoFiltro, anio) => {
  if (!paciente || !mes || !diaNumero) return false;
  const year = Number(anio) || ANIO_BASE;
  const fecha = new Date(year, mes - 1, diaNumero);
  const dow = fecha.getDay();
  const diaNombre = DIAS_COMPLETO[dow];
  const turnosMes = (paciente.turnosPorMes || {})[mes] || {};
  const tratamientos = tratamientoFiltro
    ? [tratamientoFiltro]
    : Object.keys(turnosMes);
  const activos = new Set();
  tratamientos.forEach((t) => {
    const lista = turnosMes[t] || [];
    lista.forEach((clave) => {
      const [dia, hora] = String(clave).split('-');
      if (dia === diaNombre && hora) {
        activos.add(claveTurnoNormalizada(t, hora));
      }
    });
  });
  const fechaStr = `${year}-${pad2(mes)}-${pad2(diaNumero)}`;
  const overrides = Array.isArray(paciente.turnosOverrides)
    ? paciente.turnosOverrides
    : [];
  overrides.forEach((o) => {
    if (normalizarFechaIso(o.fecha) !== fechaStr) return;
    if (
      tratamientoFiltro &&
      normalizarTexto(o.tratamiento) !== normalizarTexto(tratamientoFiltro)
    ) {
      return;
    }
    if (!o.tratamiento || !o.hora) return;
    const clave = claveTurnoNormalizada(o.tratamiento, o.hora);
    if (o.activo) {
      activos.add(clave);
    } else {
      activos.delete(clave);
    }
  });
  return activos.size > 0;
};

const filtrarPacientes = (lista, filtros) => {
  const qNombre = String(filtros.nombre || '').trim();
  const qObra = normalizarTexto(filtros.obraSocial);
  const mes = Number(filtros.mes);
  const dia = Number(filtros.dia);
  const semana = Number(filtros.semana);
  const anio = Number(filtros.anio) || ANIO_BASE;
  const tratamiento = filtros.tratamiento;
  const modulo = String(filtros.modulo || '').trim().toUpperCase();
  const tipoFecha = filtros.tipoFecha;
  const campoFecha = String(filtros.campoFecha || '').trim();
  const campoCumplimiento = String(filtros.campoCumplimiento || '').trim();
  const estadoCumplimiento = String(filtros.estadoCumplimiento || '').trim();
  const anioCumplimiento = Number(filtros.anioCumplimiento);
  const autorizacion = String(filtros.autorizacion || '').trim();
  const estadoPaciente = String(filtros.estadoPaciente || '').trim();
  return lista.filter((p) => {
    if (!coincideBusquedaNombrePaciente(p, qNombre)) return false;
    if (qObra && !normalizarTexto(p?.obraSocial).includes(qObra)) {
      return false;
    }
    if (estadoPaciente === 'activo' && p.dadoDeBaja === true) return false;
    if (estadoPaciente === 'baja' && p.dadoDeBaja !== true) return false;
    if (autorizacion === 'autorizado' && p.activo === false) return false;
    if (autorizacion === 'no_autorizado' && p.activo !== false) return false;
    if (tratamiento && !(p.tratamientos || []).includes(tratamiento)) {
      return false;
    }
    if (modulo && modulo !== 'TODOS') {
      const modulosPaciente = normalizarModulos(p?.modulos || p?.modulo);
      if (!modulosPaciente.includes(modulo)) return false;
    }
    if (campoFecha) {
      const fechaCampo = normalizarFechaIso(p?.[campoFecha]);
      if (!fechaCampo) return false;
      const [anioCampo, mesCampo] = fechaCampo.split('-').map(Number);
      if (mes && mesCampo !== mes) return false;
      if (anio && anioCampo !== anio) return false;
    }
    if (campoCumplimiento && estadoCumplimiento) {
      const cumple = resolverEstadoCumplimiento(
        p,
        campoCumplimiento,
        anioCumplimiento || null
      );
      if (estadoCumplimiento === 'tiene' && !cumple) return false;
      if (estadoCumplimiento === 'no_tiene' && cumple) return false;
    }
    if (tipoFecha === 'dia') {
      if (!mes || !dia) return true;
      return tieneTurnoEnFecha(p, mes, dia, tratamiento, anio);
    }
    if (tipoFecha === 'semana') {
      if (!mes || !semana) return true;
      const semanas = obtenerSemanasMes(mes, anio);
      const semanaSeleccionada = semanas[semana - 1] || [];
      return semanaSeleccionada.some(
        (diaNumero) =>
          diaNumero && tieneTurnoEnFecha(p, mes, diaNumero, tratamiento, anio)
      );
    }
    return true;
  });
};

function AlternarLista({ seleccionados, alCambiar, deshabilitados = [] }) {
  const bloqueados = new Set(
    Array.isArray(deshabilitados) ? deshabilitados : []
  );
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
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
            opacity: bloqueados.has(t) ? 0.6 : 1,
          }}
        >
          <input
            type="checkbox"
            checked={seleccionados.includes(t)}
            disabled={bloqueados.has(t)}
            onChange={() => {
              if (bloqueados.has(t)) return;
              alCambiar(t);
            }}
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
    <div style={{ marginTop: 12, border: '1px solid #ddd', padding: 12 }}>
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

export default function Pacientes({ alAbrirPaciente }) {
  const {
    pacientes,
    seleccionarPaciente,
    agregarTratamientos,
    alternarTurno,
    cambiarEstadoPaciente,
    cambiarBajaPaciente,
    actualizarPaciente,
  } = usePacientes();

  const [filtroNombre, setFiltroNombre] = useState('');
  const [filtroObraSocial, setFiltroObraSocial] = useState('');
  const [filtroTratamiento, setFiltroTratamiento] = useState('');
  const [filtroModulo, setFiltroModulo] = useState('TODOS');
  const [filtroAutorizacion, setFiltroAutorizacion] = useState('');
  const [filtroEstadoPaciente, setFiltroEstadoPaciente] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroAnio, setFiltroAnio] = useState(String(ANIO_BASE));
  const [filtroTipoFecha, setFiltroTipoFecha] = useState('');
  const [filtroDia, setFiltroDia] = useState('');
  const [filtroSemana, setFiltroSemana] = useState('');
  const [filtroCampoFecha, setFiltroCampoFecha] = useState('');
  const [filtroCampoCumplimiento, setFiltroCampoCumplimiento] = useState('');
  const [filtroEstadoCumplimiento, setFiltroEstadoCumplimiento] = useState('');
  const [filtroAnioCumplimiento, setFiltroAnioCumplimiento] = useState('');
  const [filtrosAplicados, setFiltrosAplicados] = useState(null);
  const [mensajeBusqueda, setMensajeBusqueda] = useState('');
  const [idSeleccionado, setIdSeleccionado] = useState('');
  const [tratamientosAgregar, setTratamientosAgregar] = useState([]);
  const [mesSeleccionado, setMesSeleccionado] = useState(1);
  const [paginaResultados, setPaginaResultados] = useState(1);
  const [moduloEdicion, setModuloEdicion] = useState([]);
  const [mensajeModulo, setMensajeModulo] = useState('');

  const filtrosActuales = useMemo(
    () => ({
      nombre: filtroNombre,
      obraSocial: filtroObraSocial,
      tratamiento: filtroTratamiento,
      modulo: filtroModulo,
      autorizacion: filtroAutorizacion,
      estadoPaciente: filtroEstadoPaciente,
      mes: filtroMes,
      anio: filtroAnio,
      tipoFecha: filtroTipoFecha,
      dia: filtroDia,
      semana: filtroSemana,
      campoFecha: filtroCampoFecha,
      campoCumplimiento: filtroCampoCumplimiento,
      estadoCumplimiento: filtroEstadoCumplimiento,
      anioCumplimiento: filtroAnioCumplimiento,
    }),
    [
      filtroNombre,
      filtroObraSocial,
      filtroTratamiento,
      filtroModulo,
      filtroAutorizacion,
      filtroEstadoPaciente,
      filtroMes,
      filtroAnio,
      filtroTipoFecha,
      filtroDia,
      filtroSemana,
      filtroCampoFecha,
      filtroCampoCumplimiento,
      filtroEstadoCumplimiento,
      filtroAnioCumplimiento,
    ]
  );

  const tratamientosFiltro = useMemo(() => {
    const set = new Set(TRATAMIENTOS);
    pacientes.forEach((p) => {
      (p.tratamientos || []).forEach((t) => set.add(t));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [pacientes]);

  const semanasDisponibles = useMemo(() => {
    const mes = Number(filtroMes);
    const anio = Number(filtroAnio) || ANIO_BASE;
    if (!mes) return [];
    return obtenerSemanasMes(mes, anio);
  }, [filtroMes, filtroAnio]);

  const diasDisponibles = useMemo(() => {
    const mes = Number(filtroMes);
    const anio = Number(filtroAnio) || ANIO_BASE;
    if (!mes) return [];
    const total = new Date(anio, mes, 0).getDate();
    return Array.from({ length: total }, (_, i) => i + 1);
  }, [filtroMes, filtroAnio]);
  const camposFechaSectorizadaDisponibles = useMemo(() => {
    if (!filtroCampoCumplimiento) return CAMPOS_FECHA_SECTORIZADOS;
    const camposCompatibles = CAMPOS_FECHA_POR_CUMPLIMIENTO[filtroCampoCumplimiento];
    if (!camposCompatibles) return [];
    return CAMPOS_FECHA_SECTORIZADOS.filter((campo) =>
      camposCompatibles.includes(campo.value)
    );
  }, [filtroCampoCumplimiento]);

  const pacientesFiltrados = useMemo(() => {
    const filtros = filtrosAplicados || filtrosActuales;
    return filtrarPacientes(pacientes, filtros).slice().sort(compararPacientesPorApellidoNombre);
  }, [
    pacientes,
    filtrosAplicados,
    filtrosActuales,
  ]);

  const totalPaginasResultados = Math.max(
    1,
    Math.ceil(pacientesFiltrados.length / RESULTADOS_POR_PAGINA)
  );
  const paginaResultadosSegura = Math.min(
    paginaResultados,
    totalPaginasResultados
  );
  const inicioResultados =
    (paginaResultadosSegura - 1) * RESULTADOS_POR_PAGINA;
  const finResultados = inicioResultados + RESULTADOS_POR_PAGINA;
  const pacientesPaginados = pacientesFiltrados.slice(
    inicioResultados,
    finResultados
  );
  const desgloseObrasSociales = useMemo(() => {
    const conteo = new Map();
    pacientesFiltrados.forEach((p) => {
      const obra = String(p.obraSocial || '').trim() || 'Sin obra social';
      conteo.set(obra, (conteo.get(obra) || 0) + 1);
    });
    return Array.from(conteo.entries())
      .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
  }, [pacientesFiltrados]);
  const resumenObrasSociales = useMemo(
    () => desgloseObrasSociales.slice(0, 4),
    [desgloseObrasSociales]
  );

  const pacienteActual = useMemo(
    () => pacientes.find((p) => p.id === idSeleccionado) || null,
    [pacientes, idSeleccionado]
  );
  const horariosDisponiblesPaciente = useMemo(
    () => resolverHorariosPorObraSocial(String(pacienteActual?.obraSocial || '').trim()),
    [pacienteActual?.obraSocial]
  );
  const pacienteBloqueado = pacienteActual?.dadoDeBaja === true;

  useEffect(() => {
    if (paginaResultados > totalPaginasResultados) {
      setPaginaResultados(totalPaginasResultados);
    }
  }, [paginaResultados, totalPaginasResultados]);

  useEffect(() => {
    if (!filtroCampoFecha) return;
    const sigueDisponible = camposFechaSectorizadaDisponibles.some(
      (campo) => campo.value === filtroCampoFecha
    );
    if (!sigueDisponible) {
      setFiltroCampoFecha('');
    }
  }, [filtroCampoFecha, camposFechaSectorizadaDisponibles]);

  useEffect(() => {
    setModuloEdicion(normalizarModulos(pacienteActual?.modulos || pacienteActual?.modulo));
    setMensajeModulo('');
  }, [pacienteActual?.id, pacienteActual?.modulo, pacienteActual?.modulos]);

  const alternarAgregar = (t) => {
    if ((pacienteActual?.tratamientos || []).includes(t)) return;
    setTratamientosAgregar((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const agregarAlPaciente = (e) => {
    e.preventDefault();
    if (!pacienteActual) return;
    if (pacienteBloqueado) return;
    agregarTratamientos(pacienteActual.id, tratamientosAgregar);
    setTratamientosAgregar([]);
  };

  const guardarModuloPaciente = async () => {
    if (!pacienteActual) return;
    const moduloNormalizado = normalizarModulos(moduloEdicion);
    try {
      await actualizarPaciente(pacienteActual.id, { modulo: moduloNormalizado, modulos: moduloNormalizado });
      setMensajeModulo('Modulo guardado.');
    } catch (err) {
      setMensajeModulo('No se pudo guardar el modulo.');
    }
  };

  const limpiarFiltros = () => {
    setFiltroNombre('');
    setFiltroObraSocial('');
    setFiltroTratamiento('');
    setFiltroModulo('TODOS');
    setFiltroAutorizacion('');
    setFiltroEstadoPaciente('');
    setFiltroMes('');
    setFiltroAnio(String(ANIO_BASE));
    setFiltroTipoFecha('');
    setFiltroDia('');
    setFiltroSemana('');
    setFiltroCampoFecha('');
    setFiltroCampoCumplimiento('');
    setFiltroEstadoCumplimiento('');
    setFiltroAnioCumplimiento('');
    setFiltrosAplicados(null);
    setMensajeBusqueda('');
    setPaginaResultados(1);
  };

  const buscarPacientes = () => {
    const resultados = filtrarPacientes(pacientes, filtrosActuales);
    setFiltrosAplicados(filtrosActuales);
    setMensajeBusqueda(
      `Busqueda realizada. Resultados: ${resultados.length}`
    );
    setPaginaResultados(1);
  };

  const inputClass =
    'w-full rounded-lg border-none bg-surface-container-lowest px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40';
  const selectClass =
    'w-full rounded-lg border-none bg-surface-container-lowest px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/40';
  const filterLabelClass =
    'mb-2 block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant';
  const filtroActivoClass =
    'border shadow-sm';

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <h2 className="mb-2 text-3xl font-extrabold tracking-tight text-on-surface">
            Buscador Avanzado
          </h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={limpiarFiltros}
            className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-white px-6 py-2.5 text-sm font-semibold text-on-surface transition-all hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[20px]">filter_alt_off</span>
            Limpiar filtros
          </button>
          <button
            type="button"
            onClick={buscarPacientes}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-primary to-primary-dim px-8 py-2.5 text-sm font-semibold text-on-primary shadow-lg shadow-primary/20 transition-all hover:opacity-90"
          >
            <span className="material-symbols-outlined text-[20px]">search</span>
            Buscar pacientes
          </button>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 to-white p-6 shadow-sm shadow-primary/5 md:col-span-2">
          <label className="mb-3 block text-[11px] font-bold uppercase tracking-widest text-primary">
            Identificación Principal
          </label>
          <div className="space-y-4">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-3 text-outline text-lg">
                person
              </span>
              <input
                value={filtroNombre}
                onChange={(e) => setFiltroNombre(e.target.value)}
                placeholder="Apellido y nombre o DNI, por ejemplo: rodriguez p o 30123456"
                className={`w-full rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 ${
                  filtroNombre
                    ? `${filtroActivoClass} border-primary/35 bg-primary/10 text-on-surface shadow-primary/10 focus:ring-primary/25`
                    : 'border-none bg-surface-container-lowest text-on-surface placeholder:text-outline/60 focus:ring-primary/40'
                }`}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-3 text-outline text-lg">
                  admin_panel_settings
                </span>
                <input
                  value={filtroObraSocial}
                  onChange={(e) => setFiltroObraSocial(e.target.value)}
                  placeholder="Obra social"
                  className={`w-full rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 ${
                    filtroObraSocial
                      ? `${filtroActivoClass} border-sky-300 bg-sky-50 text-on-surface shadow-sky-100 focus:ring-sky-200`
                      : 'border-none bg-surface-container-lowest text-on-surface placeholder:text-outline/60 focus:ring-primary/40'
                  }`}
                />
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-3 text-outline text-lg">
                  medical_services
                </span>
                <select
                  value={filtroTratamiento}
                  onChange={(e) => setFiltroTratamiento(e.target.value)}
                  className={`w-full appearance-none rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 ${
                    filtroTratamiento
                      ? `${filtroActivoClass} border-emerald-300 bg-emerald-50 text-emerald-800 shadow-emerald-100 focus:ring-emerald-200`
                      : 'border-none bg-surface-container-lowest text-on-surface focus:ring-primary/40'
                  }`}
                >
                  <option value="">Terapias</option>
                  {tratamientosFiltro.map((t) => (
                    <option key={`filtro-${t}`} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-outline-variant/10 bg-gradient-to-br from-surface-container-low to-white p-6 shadow-sm shadow-black/5 md:col-span-2">
          <label className="mb-3 block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
            Administrativo y Estado
          </label>
          <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-4">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-3 text-outline text-lg">
                  view_module
                </span>
                <select
                  value={filtroModulo}
                  onChange={(e) => setFiltroModulo(e.target.value)}
                  className={`w-full appearance-none rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 ${
                    filtroModulo && filtroModulo !== 'TODOS'
                      ? `${filtroActivoClass} border-primary/35 bg-primary/10 text-primary shadow-primary/10 focus:ring-primary/25`
                      : 'border-none bg-surface-container-lowest text-on-surface focus:ring-primary/40'
                  }`}
                >
                  <option value="TODOS">Módulo</option>
                  {MODULOS.map((m) => (
                    <option key={`modulo-${m}`} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-3 text-outline text-lg">
                  verified
                </span>
                <select
                  value={filtroAutorizacion}
                  onChange={(e) => setFiltroAutorizacion(e.target.value)}
                  className={`w-full appearance-none rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 ${
                    filtroAutorizacion === 'autorizado'
                      ? `${filtroActivoClass} border-emerald-300 bg-emerald-50 text-emerald-800 shadow-emerald-100 focus:ring-emerald-200`
                      : filtroAutorizacion === 'no_autorizado'
                      ? `${filtroActivoClass} border-amber-300 bg-amber-50 text-amber-800 shadow-amber-100 focus:ring-amber-200`
                      : 'border-none bg-surface-container-lowest text-on-surface focus:ring-primary/40'
                  }`}
                >
                  <option value="">Autorización</option>
                  <option value="autorizado">Autorizado</option>
                  <option value="no_autorizado">No autorizado</option>
                </select>
              </div>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-3 text-outline text-lg">
                  clinical_notes
                </span>
                <select
                  value={filtroEstadoPaciente}
                  onChange={(e) => setFiltroEstadoPaciente(e.target.value)}
                  className={`w-full appearance-none rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 ${
                    filtroEstadoPaciente === 'activo'
                      ? `${filtroActivoClass} border-sky-300 bg-sky-50 text-sky-800 shadow-sky-100 focus:ring-sky-200`
                      : filtroEstadoPaciente === 'baja'
                      ? `${filtroActivoClass} border-rose-300 bg-rose-50 text-rose-800 shadow-rose-100 focus:ring-rose-200`
                      : 'border-none bg-surface-container-lowest text-on-surface focus:ring-primary/40'
                  }`}
                >
                  <option value="">Estado paciente</option>
                  <option value="activo">Activo</option>
                  <option value="baja">Dado de baja</option>
                </select>
              </div>
              <div className="flex min-h-[88px] items-center justify-center rounded-lg border border-dashed border-outline-variant/30 bg-surface-container px-4">
                <p className="text-center text-[10px] font-medium text-outline-variant">
                  Utilice varios filtros y luego busque para congelar los resultados.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-3xl border border-outline-variant/10 bg-gradient-to-br from-surface-container-low/70 to-white p-6 shadow-sm shadow-black/5 md:col-span-4 md:grid-cols-4">
          <div>
            <label className={filterLabelClass}>Fecha Sectorizada</label>
            <select
              value={filtroCampoFecha}
              onChange={(e) => setFiltroCampoFecha(e.target.value)}
              disabled={
                Boolean(filtroCampoCumplimiento) &&
                camposFechaSectorizadaDisponibles.length === 0
              }
              className={`${selectClass} ${
                filtroCampoFecha
                  ? 'border border-primary/30 bg-primary/10 text-primary shadow-sm shadow-primary/10 focus:ring-primary/25'
                  : ''
              }`}
            >
              <option value="">Ninguna</option>
              {camposFechaSectorizadaDisponibles.map((campo) => (
                <option key={campo.value} value={campo.value}>
                  {campo.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={filterLabelClass}>CAR / PPI / Controles</label>
            <select
              value={filtroCampoCumplimiento}
              onChange={(e) => {
                const valor = e.target.value;
                setFiltroCampoCumplimiento(valor);
                setFiltroCampoFecha('');
                if (valor !== 'car' && valor !== 'ppi') {
                  setFiltroAnioCumplimiento('');
                }
              }}
              className={`${selectClass} ${
                filtroCampoCumplimiento
                  ? 'border border-amber-300 bg-amber-50 text-amber-800 shadow-sm shadow-amber-100 focus:ring-amber-200'
                  : ''
              }`}
            >
              <option value="">Seleccionar</option>
              {CAMPOS_CUMPLIMIENTO.map((campo) => (
                <option key={campo.value} value={campo.value}>
                  {campo.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={filterLabelClass}>Tiene / No Tiene</label>
            <select
              value={filtroEstadoCumplimiento}
              onChange={(e) => setFiltroEstadoCumplimiento(e.target.value)}
              disabled={!filtroCampoCumplimiento}
              className={`${selectClass} ${
                filtroEstadoCumplimiento === 'tiene'
                  ? 'border border-emerald-300 bg-emerald-50 text-emerald-800 shadow-sm shadow-emerald-100 focus:ring-emerald-200'
                  : filtroEstadoCumplimiento === 'no_tiene'
                  ? 'border border-rose-300 bg-rose-50 text-rose-800 shadow-sm shadow-rose-100 focus:ring-rose-200'
                  : ''
              }`}
            >
              <option value="">Todos</option>
              <option value="tiene">Tiene</option>
              <option value="no_tiene">No tiene</option>
            </select>
          </div>
          <div>
            <label className={filterLabelClass}>Año documental</label>
            <select
              value={filtroAnioCumplimiento}
              onChange={(e) => setFiltroAnioCumplimiento(e.target.value)}
              disabled={
                filtroCampoCumplimiento !== 'car' &&
                filtroCampoCumplimiento !== 'ppi'
              }
              className={`${selectClass} ${
                filtroAnioCumplimiento
                  ? 'border border-sky-300 bg-sky-50 text-sky-800 shadow-sm shadow-sky-100 focus:ring-sky-200'
                  : ''
              }`}
            >
              <option value="">Todos</option>
              {ANIOS_DOCUMENTACION.map((anioItem) => (
                <option key={`anio-doc-${anioItem}`} value={anioItem}>
                  {anioItem}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={filterLabelClass}>Mes</label>
            <select
              value={filtroMes}
              onChange={(e) => {
                setFiltroMes(e.target.value);
                setFiltroDia('');
                setFiltroSemana('');
              }}
              className={`${selectClass} ${
                filtroMes
                  ? 'border border-primary/30 bg-primary/10 text-primary shadow-sm shadow-primary/10 focus:ring-primary/25'
                  : ''
              }`}
            >
              <option value="">Mes</option>
              {MESES.map((m, idx) => (
                <option key={`mes-filtro-${m}`} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={filterLabelClass}>Año</label>
            <input
              type="number"
              value={filtroAnio}
              onChange={(e) => setFiltroAnio(e.target.value)}
              placeholder="Año"
              className={`${inputClass} ${
                filtroAnio
                  ? 'border border-sky-300 bg-sky-50 text-sky-800 shadow-sm shadow-sky-100 focus:ring-sky-200'
                  : ''
              }`}
            />
          </div>
          <div>
            <label className={filterLabelClass}>Periodo</label>
            <select
              value={filtroTipoFecha}
              onChange={(e) => {
                setFiltroTipoFecha(e.target.value);
                setFiltroDia('');
                setFiltroSemana('');
              }}
              className={`${selectClass} ${
                filtroTipoFecha
                  ? 'border border-violet-300 bg-violet-50 text-violet-800 shadow-sm shadow-violet-100 focus:ring-violet-200'
                  : ''
              }`}
            >
              <option value="">Día o semana</option>
              <option value="dia">Día específico</option>
              <option value="semana">Semana del mes</option>
            </select>
          </div>
          <div>
            <label className={filterLabelClass}>
              {filtroTipoFecha === 'semana' ? 'Semana' : 'Día'}
            </label>
            {filtroTipoFecha === 'semana' ? (
              <select
                value={filtroSemana}
                onChange={(e) => setFiltroSemana(e.target.value)}
                disabled={!filtroMes}
                className={`${selectClass} ${
                  filtroSemana
                    ? 'border border-violet-300 bg-violet-50 text-violet-800 shadow-sm shadow-violet-100 focus:ring-violet-200'
                    : ''
                }`}
              >
                <option value="">Semana</option>
                {semanasDisponibles.map((semana, idx) => (
                  <option key={`semana-${idx + 1}`} value={idx + 1}>
                    {generarEtiquetaSemana(semana, idx)}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={filtroDia}
                onChange={(e) => setFiltroDia(e.target.value)}
                disabled={!filtroMes}
                className={`${selectClass} ${
                  filtroDia
                    ? 'border border-violet-300 bg-violet-50 text-violet-800 shadow-sm shadow-violet-100 focus:ring-violet-200'
                    : ''
                }`}
              >
                <option value="">Día</option>
                {diasDisponibles.map((d) => (
                  <option key={`dia-${d}`} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </section>

      {mensajeBusqueda ? (
        <div style={{ marginTop: 10, color: '#1b7f3a' }}>
          {mensajeBusqueda}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <div className="mb-6 flex flex-col gap-4 rounded-[28px] border border-outline-variant/10 bg-gradient-to-r from-primary/5 via-transparent to-transparent p-4 md:flex-row md:items-center md:justify-between sm:p-5">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-on-surface">
                <span className="h-2 w-2 rounded-full bg-primary"></span>
                Resultados encontrados ({pacientesFiltrados.length})
              </h4>
              {resumenObrasSociales.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {resumenObrasSociales.map(([obra, cantidad]) => (
                    <span
                      key={`obra-resumen-${obra}`}
                      className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary"
                    >
                      {obra}: {cantidad}
                    </span>
                  ))}
                  {desgloseObrasSociales.length > resumenObrasSociales.length ? (
                    <span className="rounded-full bg-surface-container-low px-3 py-1 text-[11px] font-semibold text-on-surface-variant">
                      +{desgloseObrasSociales.length - resumenObrasSociales.length} obras sociales
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
            {pacientesFiltrados.length ? (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-container-low px-3 py-2 text-xs font-semibold text-on-surface-variant shadow-sm">
                <button
                  type="button"
                  onClick={() => setPaginaResultados((p) => Math.max(1, p - 1))}
                  disabled={paginaResultadosSegura === 1}
                  className="rounded-lg bg-surface-container-lowest px-3 py-2 transition-colors hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Anterior
                </button>
                <span>
                  Página {paginaResultadosSegura} de {totalPaginasResultados}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPaginaResultados((p) => Math.min(totalPaginasResultados, p + 1))
                  }
                  disabled={paginaResultadosSegura === totalPaginasResultados}
                  className="rounded-lg bg-surface-container-lowest px-3 py-2 transition-colors hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            ) : null}
          </div>

          {pacientesFiltrados.length ? (
            <div className="grid grid-cols-1 gap-4 xl:gap-5">
              {pacientesPaginados.map((p) => {
                const seleccionado = pacienteActual?.id === p.id;
                const modulosPaciente = normalizarModulos(p?.modulos || p?.modulo);
                return (
                  <div
                    key={`resultado-${p.id}`}
                    className={`relative overflow-hidden rounded-[24px] border-2 p-3.5 pl-4 transition-all duration-200 sm:p-4 sm:pl-5 ${
                      seleccionado
                        ? 'border-primary bg-gradient-to-br from-emerald-50 via-white to-white shadow-lg shadow-primary/10 ring-2 ring-primary/15'
                        : 'border-primary/35 bg-gradient-to-br from-emerald-50/80 via-white to-white shadow-sm shadow-primary/10 hover:-translate-y-0.5 hover:border-primary hover:shadow-lg hover:shadow-on-surface/5'
                    }`}
                  >
                    <div
                      className={`absolute inset-y-3 left-0 w-3 rounded-r-full ${
                        seleccionado ? 'bg-primary shadow-[0_0_0_1px_rgba(0,109,68,0.08)]' : 'bg-primary'
                      }`}
                    />
                    <div className="mb-3 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 to-primary/5 px-3 py-2.5 shadow-sm sm:px-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-extrabold text-on-primary shadow-md shadow-primary/20">
                            {obtenerInicialesPaciente(p)}
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-base font-bold leading-tight text-on-surface sm:text-lg">
                              {formatearEtiquetaPaciente(p)}
                            </h5>
                            <p className="mt-1 text-xs font-medium text-on-surface-variant">
                              {p.edad ?? '-'} años
                              {' · '}
                              {p.obraSocial || 'Sin obra social'}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-tight ${
                              p.activo === false
                                ? 'bg-error-container/20 text-error-dim'
                                : 'bg-tertiary-container text-on-tertiary-container'
                            }`}
                          >
                            {p.activo === false ? 'No autorizado' : 'Autorizado'}
                          </span>
                          {p.dadoDeBaja ? (
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-tight text-amber-700">
                              Baja
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="mb-3 flex flex-wrap items-start gap-2.5 rounded-2xl bg-surface-container-low/70 px-3 py-2.5">
                      <div className="min-w-[110px]">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
                          Estado
                        </p>
                        <p className="text-xs font-semibold text-on-surface-variant">
                          {p.dadoDeBaja
                            ? `Baja${p.fechaBaja ? ` (${String(p.fechaBaja).slice(0, 10)})` : ''}`
                            : 'Activo'}
                        </p>
                      </div>
                      <div className="min-w-[140px] flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
                          Módulos
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {modulosPaciente.length ? (
                            modulosPaciente.map((modulo) =>
                              renderModuloBadge(modulo, { compacto: true })
                            )
                          ) : (
                            <span className="text-xs font-semibold text-on-surface-variant">Sin módulos</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <p className="mb-3 rounded-2xl border border-outline-variant/10 bg-surface-container-low/50 px-3 py-2 text-[11px] leading-relaxed text-on-surface-variant">
                      {describirDocumentacionPaciente(p)}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={p.dadoDeBaja === true}
                        onClick={() => {
                          setIdSeleccionado(p.id);
                          seleccionarPaciente(p.id);
                        }}
                        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-on-primary shadow-sm shadow-primary/20 transition-all hover:-translate-y-0.5 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Seleccionar
                      </button>
                      <button
                        type="button"
                        onClick={() => alAbrirPaciente(p.id)}
                        className="min-h-9 rounded-xl bg-sky-100 px-3.5 py-2 text-xs font-bold text-sky-700 shadow-sm transition-colors hover:bg-sky-200"
                      >
                        Ver ficha
                      </button>
                      <button
                        type="button"
                        disabled={p.dadoDeBaja === true}
                        onClick={() => cambiarEstadoPaciente(p.id, p.activo === false)}
                        className={`min-h-9 rounded-xl px-3 py-2 text-xs font-bold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          p.activo === false
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        }`}
                      >
                        {p.activo === false ? 'Autorizar' : 'No autorizar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => cambiarBajaPaciente(p.id, p.dadoDeBaja !== true)}
                        className={`min-h-9 rounded-xl px-3 py-2 text-xs font-bold shadow-sm transition-colors ${
                          p.dadoDeBaja === true
                            ? 'bg-rose-600 text-white hover:bg-rose-500'
                            : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                        }`}
                      >
                        {p.dadoDeBaja === true ? 'Reactivar' : 'Dar de baja'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
              No hay resultados con los filtros actuales.
            </div>
          )}
        </div>

        <aside className="h-fit rounded-[28px] border border-outline-variant/10 bg-gradient-to-br from-surface-container-lowest to-white p-6 shadow-sm shadow-black/5">
          {pacienteActual ? (
            <div className="space-y-6">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-outline">
                  Paciente seleccionado
                </p>
                <h3 className="text-2xl font-extrabold text-on-surface">
                  {formatearEtiquetaPaciente(pacienteActual)}
                </h3>
                <p className="mt-2 text-sm text-on-surface-variant">
                  Edad: {pacienteActual.edad || '-'} | Obra social:{' '}
                  {pacienteActual.obraSocial || '-'}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-tight ${
                    pacienteActual.activo === false
                      ? 'bg-error-container/20 text-error-dim'
                      : 'bg-tertiary-container text-on-tertiary-container'
                  }`}
                >
                  {pacienteActual.activo === false ? 'No autorizado' : 'Autorizado'}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-tight ${
                    pacienteActual.dadoDeBaja
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {pacienteActual.dadoDeBaja ? 'Dado de baja' : 'Activo'}
                </span>
              </div>

              {pacienteBloqueado ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Paciente dado de baja: solo se puede consultar y reactivar.
                </div>
              ) : null}

              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  Módulo
                </p>
                <div className="mb-3 flex flex-wrap gap-2">
                  {moduloEdicion.length ? (
                    moduloEdicion.map((modulo) => renderModuloBadge(modulo))
                  ) : (
                    <span className="text-sm font-medium text-on-surface-variant">Sin módulos asignados</span>
                  )}
                </div>
                <div className="space-y-3">
                  {MODULOS.map((m) => (
                    <label
                      key={`detalle-mod-${m}`}
                      className={`flex items-center gap-3 rounded-xl border p-4 transition-all hover:border-primary/20 ${
                        clasesModulo(m).opcion
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={moduloEdicion.includes(m)}
                        onChange={() =>
                          setModuloEdicion((prev) =>
                            prev.includes(m)
                              ? prev.filter((item) => item !== m)
                              : [...prev, m]
                          )
                        }
                        className="rounded border-outline-variant/50 text-primary focus:ring-primary/30"
                      />
                      <span className={`h-3 w-3 rounded-[4px] ${clasesModulo(m).punto}`} />
                      <span className="text-sm font-medium text-on-surface">{m}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={guardarModuloPaciente}
                    className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary transition-all hover:opacity-90"
                  >
                    Guardar módulo
                  </button>
                  {mensajeModulo ? (
                    <span
                      className={`text-xs font-semibold ${
                        mensajeModulo.includes('No se pudo') ? 'text-error' : 'text-primary'
                      }`}
                    >
                      {mensajeModulo}
                    </span>
                  ) : null}
                </div>
              </div>

              <div>
                <label className={filterLabelClass}>Mes</label>
                <select
                  value={mesSeleccionado}
                  onChange={(e) => setMesSeleccionado(Number(e.target.value))}
                  className={selectClass}
                >
                  {MESES.map((nombreMes, index) => (
                    <option key={nombreMes} value={index + 1}>
                      {nombreMes}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  Tratamientos actuales
                </p>
                {(pacienteActual.tratamientos || []).length ? (
                  <div className="flex flex-wrap gap-2">
                    {pacienteActual.tratamientos.map((t) => (
                      <span
                        key={t}
                        className="rounded-lg bg-surface-container-low px-3 py-2 text-xs font-bold text-on-surface-variant"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-on-surface-variant">Sin tratamientos.</p>
                )}
              </div>

              <form onSubmit={agregarAlPaciente} className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                  Agregar tratamientos
                </p>
                <AlternarLista
                  seleccionados={tratamientosAgregar}
                  deshabilitados={pacienteActual?.tratamientos || []}
                  alCambiar={pacienteBloqueado ? () => {} : alternarAgregar}
                />
                <button
                  type="submit"
                  disabled={pacienteBloqueado}
                  className="rounded-xl bg-gradient-to-br from-primary to-primary-dim px-5 py-2.5 text-sm font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Agregar al paciente
                </button>
              </form>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-lg font-bold text-on-surface">Cronograma de turnos</h4>
                  <button
                    type="button"
                    onClick={() => alAbrirPaciente(pacienteActual.id)}
                    className="text-xs font-bold text-primary"
                  >
                    Ver detalle
                  </button>
                </div>
                {(pacienteActual.tratamientos || []).length ? (
                  <div className="space-y-4">
                    {(pacienteActual.tratamientos || []).map((t) => (
                      <div
                        key={t}
                        className="overflow-hidden rounded-xl border border-outline-variant/20"
                      >
                        <Cronograma
                          tratamiento={t}
                          turnosSeleccionados={
                            ((pacienteActual.turnosPorMes || {})[mesSeleccionado] || {})[t] || []
                          }
                          horarios={horariosDisponiblesPaciente}
                          alAlternar={(clave) =>
                            pacienteBloqueado
                              ? null
                              : alternarTurno(pacienteActual.id, t, clave, mesSeleccionado)
                          }
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-on-surface-variant">
                    Asigna tratamientos para habilitar el cronograma.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-low p-8 text-center">
              <p className="text-sm font-semibold text-on-surface">Sin paciente seleccionado</p>
              <p className="mt-2 text-xs text-on-surface-variant">
                Elija un resultado para habilitar edición rápida, módulo y cronograma.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
