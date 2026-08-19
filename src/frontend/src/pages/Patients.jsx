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
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    botonActivo: 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20',
  },
  MIS: {
    punto: 'bg-amber-500',
    badge: 'border-amber-200 bg-amber-50 text-amber-800',
    botonActivo: 'border-amber-500 bg-amber-50 text-amber-800 ring-2 ring-amber-500/20',
  },
  MIE: {
    punto: 'bg-sky-500',
    badge: 'border-sky-200 bg-sky-50 text-sky-800',
    botonActivo: 'border-sky-500 bg-sky-50 text-sky-800 ring-2 ring-sky-500/20',
  },
};

const ANIOS_DOCUMENTACION = [2026, 2027, 2028, 2029, 2030];

const CAMPOS_FECHA_SECTORIZADOS = [
  { value: 'fechaVencimientoControlTrabajoSocial', label: 'Vencimiento control de trabajo social' },
  { value: 'fechaAltaControlTrabajoSocial', label: 'Alta control de trabajo social' },
  { value: 'ultimoControlTrabajoSocial', label: 'Fecha control de trabajo social' },
  { value: 'fechaVencimientoControlFisiatrico', label: 'Vencimiento control fisiatrico' },
  { value: 'fechaAltaControlFisiatrico', label: 'Alta control fisiatrico' },
  { value: 'ultimoControlFisiatrico', label: 'Fecha control fisiatrico' },
];

const CAMPOS_CUMPLIMIENTO = [
  { value: 'car', label: 'CAR' },
  { value: 'ppi', label: 'PPI' },
  { value: 'controlTrabajoSocial', label: 'Control Trabajo Social' },
  { value: 'controlFisiatrico', label: 'Control Fisiátrico' },
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

const DIAS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'];
const ETIQUETAS_DIAS = {
  Lun: 'Lun',
  Mar: 'Mar',
  Mie: 'Mié',
  Jue: 'Jue',
  Vie: 'Vie',
};
const DIAS_COMPLETO = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const ANIO_BASE = new Date().getFullYear();
const RESULTADOS_POR_PAGINA = 8;

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

const normalizarModulos = (valor) => {
  const lista = Array.isArray(valor)
    ? valor
    : String(valor || '')
        .split(',')
        .map((item) => String(item || '').trim().toUpperCase())
        .filter(Boolean);
  return Array.from(new Set(lista.filter((item) => MODULOS.includes(item))));
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
  return etiqueta || paciente?.nombre || '-';
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

const coincideBusquedaGeneral = (paciente, query) => {
  if (!query) return true;
  const q = normalizarTexto(query);
  const tokens = tokenizarBusqueda(query);

  const dniPaciente = String(paciente?.dni || '').replace(/\D/g, '');
  const qDni = query.replace(/\D/g, '');
  if (qDni && dniPaciente.includes(qDni)) return true;

  const datos = resolverNombreApellido(paciente);
  const textos = [
    `${datos.apellido} ${datos.nombre}`,
    `${datos.nombre} ${datos.apellido}`,
    paciente?.nombre,
    paciente?.apellido,
    paciente?.obraSocial,
    ...(paciente?.tratamientos || []),
  ].map(normalizarTexto);

  return tokens.every((token) => textos.some((t) => t.includes(token)));
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
  const query = String(filtros.query || '').trim();
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
    if (!coincideBusquedaGeneral(p, query)) return false;
    if (qObra && !normalizarTexto(p?.obraSocial).includes(qObra)) return false;
    if (estadoPaciente === 'activo' && p.dadoDeBaja === true) return false;
    if (estadoPaciente === 'baja' && p.dadoDeBaja !== true) return false;
    if (autorizacion === 'autorizado' && p.activo === false) return false;
    if (autorizacion === 'no_autorizado' && p.activo !== false) return false;
    if (tratamiento && !(p.tratamientos || []).includes(tratamiento)) return false;
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

function AlternarTratamientosList({ seleccionados, alCambiar, deshabilitados = [] }) {
  const bloqueados = new Set(Array.isArray(deshabilitados) ? deshabilitados : []);
  return (
    <div className="flex flex-wrap gap-2">
      {TRATAMIENTOS.map((t) => {
        const estaSeleccionado = seleccionados.includes(t);
        const estaDeshabilitado = bloqueados.has(t);
        return (
          <button
            key={t}
            type="button"
            disabled={estaDeshabilitado}
            onClick={() => alCambiar(t)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
              estaDeshabilitado
                ? 'bg-slate-100 text-slate-400 opacity-60'
                : estaSeleccionado
                ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/20'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">
              {estaSeleccionado ? 'check' : estaDeshabilitado ? 'lock' : 'add'}
            </span>
            {t}
          </button>
        );
      })}
    </div>
  );
}

function CronogramaMatrix({ tratamiento, turnosSeleccionados, alAlternar, horarios }) {
  const listaHorarios = Array.isArray(horarios) && horarios.length ? horarios : HORARIOS;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          {tratamiento}
        </span>
        <span className="text-[10px] font-medium text-slate-400">
          {turnosSeleccionados.length} turno(s)
        </span>
      </div>

      {tratamiento === 'Integracion' ? (
        <div className="rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-500">
          Los horarios de Integración se coordinan individualmente con la institución escolar.
        </div>
      ) : (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 font-semibold text-slate-600 shadow-sm">
              <tr>
                <th className="py-2 pl-3 pr-2 text-[11px]">Hora</th>
                {DIAS.map((d) => (
                  <th key={d} className="px-2 py-2 text-center text-[11px]">
                    {ETIQUETAS_DIAS[d] || d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listaHorarios.map((hora) => (
                <tr key={hora} className="hover:bg-slate-50/70">
                  <td className="py-1.5 pl-3 pr-2 font-mono text-[11px] font-medium text-slate-600">
                    {hora}
                  </td>
                  {DIAS.map((dia) => {
                    const clave = `${dia}-${hora}`;
                    const marcado = turnosSeleccionados.includes(clave);
                    return (
                      <td key={clave} className="px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() => alAlternar(clave)}
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

  // Primary Query & Filter States
  const [query, setQuery] = useState('');
  const [filtroObraSocial, setFiltroObraSocial] = useState('');
  const [filtroTratamiento, setFiltroTratamiento] = useState('');
  const [filtroModulo, setFiltroModulo] = useState('TODOS');
  const [filtroAutorizacion, setFiltroAutorizacion] = useState('');
  const [filtroEstadoPaciente, setFiltroEstadoPaciente] = useState('activo');
  
  // Advanced Filter Drawer
  const [mostrarFiltrosAvanzados, setMostrarFiltrosAvanzados] = useState(false);
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroAnio, setFiltroAnio] = useState(String(ANIO_BASE));
  const [filtroTipoFecha, setFiltroTipoFecha] = useState('');
  const [filtroDia, setFiltroDia] = useState('');
  const [filtroSemana, setFiltroSemana] = useState('');
  const [filtroCampoFecha, setFiltroCampoFecha] = useState('');
  const [filtroCampoCumplimiento, setFiltroCampoCumplimiento] = useState('');
  const [filtroEstadoCumplimiento, setFiltroEstadoCumplimiento] = useState('');
  const [filtroAnioCumplimiento, setFiltroAnioCumplimiento] = useState('');

  // UI Selection & Pagination
  const [idSeleccionado, setIdSeleccionado] = useState('');
  const [paginaResultados, setPaginaResultados] = useState(1);
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().getMonth() + 1);
  const [moduloEdicion, setModuloEdicion] = useState([]);
  const [guardandoModulo, setGuardandoModulo] = useState(false);
  const [mensajeModulo, setMensajeModulo] = useState('');
  const [tratamientosAgregar, setTratamientosAgregar] = useState([]);

  const filtrosActuales = useMemo(
    () => ({
      query,
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
      query,
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

  const obrasSocialesDisponibles = useMemo(() => {
    const set = new Set();
    pacientes.forEach((p) => {
      if (p.obraSocial) set.add(p.obraSocial);
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
    return filtrarPacientes(pacientes, filtrosActuales).slice().sort(compararPacientesPorApellidoNombre);
  }, [pacientes, filtrosActuales]);

  const totalPaginasResultados = Math.max(
    1,
    Math.ceil(pacientesFiltrados.length / RESULTADOS_POR_PAGINA)
  );
  const paginaResultadosSegura = Math.min(
    paginaResultados,
    totalPaginasResultados
  );
  const inicioResultados = (paginaResultadosSegura - 1) * RESULTADOS_POR_PAGINA;
  const finResultados = inicioResultados + RESULTADOS_POR_PAGINA;
  const pacientesPaginados = pacientesFiltrados.slice(inicioResultados, finResultados);

  const desgloseObrasSociales = useMemo(() => {
    const conteo = new Map();
    pacientesFiltrados.forEach((p) => {
      const obra = String(p.obraSocial || '').trim() || 'Sin obra social';
      conteo.set(obra, (conteo.get(obra) || 0) + 1);
    });
    return Array.from(conteo.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [pacientesFiltrados]);

  const resumenObrasSociales = useMemo(() => desgloseObrasSociales.slice(0, 4), [desgloseObrasSociales]);

  const pacienteActual = useMemo(
    () => pacientes.find((p) => p.id === idSeleccionado) || null,
    [pacientes, idSeleccionado]
  );

  const horariosDisponiblesPaciente = useMemo(
    () => resolverHorariosPorObraSocial(String(pacienteActual?.obraSocial || '').trim()),
    [pacienteActual?.obraSocial]
  );

  const pacienteBloqueado = pacienteActual?.dadoDeBaja === true;

  // Active Filter Count for badge
  const filtrosActivosCount = useMemo(() => {
    let c = 0;
    if (query) c++;
    if (filtroObraSocial) c++;
    if (filtroTratamiento) c++;
    if (filtroModulo && filtroModulo !== 'TODOS') c++;
    if (filtroAutorizacion) c++;
    if (filtroEstadoPaciente && filtroEstadoPaciente !== 'activo') c++;
    if (filtroMes) c++;
    if (filtroCampoCumplimiento) c++;
    if (filtroCampoFecha) c++;
    return c;
  }, [
    query,
    filtroObraSocial,
    filtroTratamiento,
    filtroModulo,
    filtroAutorizacion,
    filtroEstadoPaciente,
    filtroMes,
    filtroCampoCumplimiento,
    filtroCampoFecha,
  ]);

  useEffect(() => {
    setPaginaResultados(1);
  }, [query, filtroObraSocial, filtroTratamiento, filtroModulo, filtroAutorizacion, filtroEstadoPaciente, filtroMes]);

  useEffect(() => {
    setModuloEdicion(normalizarModulos(pacienteActual?.modulos || pacienteActual?.modulo));
    setMensajeModulo('');
    setTratamientosAgregar([]);
  }, [pacienteActual?.id, pacienteActual?.modulo, pacienteActual?.modulos]);

  const alternarAgregarTratamiento = (t) => {
    if ((pacienteActual?.tratamientos || []).includes(t)) return;
    setTratamientosAgregar((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const guardarTratamientosNuevos = (e) => {
    e.preventDefault();
    if (!pacienteActual || pacienteBloqueado || !tratamientosAgregar.length) return;
    agregarTratamientos(pacienteActual.id, tratamientosAgregar);
    setTratamientosAgregar([]);
  };

  const alternarModuloEdicion = (m) => {
    setModuloEdicion((prev) =>
      prev.includes(m) ? prev.filter((item) => item !== m) : [...prev, m]
    );
  };

  const guardarModuloPaciente = async () => {
    if (!pacienteActual) return;
    setGuardandoModulo(true);
    const moduloNormalizado = normalizarModulos(moduloEdicion);
    try {
      await actualizarPaciente(pacienteActual.id, {
        modulo: moduloNormalizado,
        modulos: moduloNormalizado,
      });
      setMensajeModulo('Módulos actualizados correctamente');
      setTimeout(() => setMensajeModulo(''), 3000);
    } catch (err) {
      setMensajeModulo('Error al guardar módulos');
    } finally {
      setGuardandoModulo(false);
    }
  };

  const limpiarFiltros = () => {
    setQuery('');
    setFiltroObraSocial('');
    setFiltroTratamiento('');
    setFiltroModulo('TODOS');
    setFiltroAutorizacion('');
    setFiltroEstadoPaciente('activo');
    setFiltroMes('');
    setFiltroAnio(String(ANIO_BASE));
    setFiltroTipoFecha('');
    setFiltroDia('');
    setFiltroSemana('');
    setFiltroCampoFecha('');
    setFiltroCampoCumplimiento('');
    setFiltroEstadoCumplimiento('');
    setFiltroAnioCumplimiento('');
    setPaginaResultados(1);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header Title Section */}
        <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <nav className="mb-2 flex items-center gap-2 text-xs text-slate-400">
              <span>Administración</span>
              <span className="material-symbols-outlined text-[12px]">chevron_right</span>
              <span className="font-semibold text-[#006d44]">Buscador Clínico</span>
            </nav>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Buscador de Pacientes
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Búsqueda en tiempo real por datos de filiación, obra social, terapias, cronograma y controles.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {filtrosActivosCount > 0 && (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-[18px] text-slate-400">
                  filter_alt_off
                </span>
                Limpiar filtros ({filtrosActivosCount})
              </button>
            )}
          </div>
        </section>

        {/* Command Search Control Bar */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          {/* Top Row: Search Input + Quick Segmented Chips */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            {/* Search Input Box */}
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                search
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por Apellido, Nombre, DNI, Obra Social o Terapia..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-10 text-sm text-slate-800 placeholder-slate-400 transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>

            {/* Quick Segmented Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Segment */}
              <div className="inline-flex rounded-xl bg-slate-100 p-1">
                {[
                  { key: 'activo', label: 'Activos' },
                  { key: '', label: 'Todos' },
                  { key: 'baja', label: 'Bajas' },
                ].map((st) => (
                  <button
                    key={`st-filter-${st.key}`}
                    type="button"
                    onClick={() => setFiltroEstadoPaciente(st.key)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      filtroEstadoPaciente === st.key
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Authorization Filter */}
              <div className="inline-flex rounded-xl bg-slate-100 p-1">
                {[
                  { key: '', label: 'Cualquier Auth' },
                  { key: 'autorizado', label: 'Autorizados' },
                  { key: 'no_autorizado', label: 'Pendientes' },
                ].map((auth) => (
                  <button
                    key={`auth-filter-${auth.key}`}
                    type="button"
                    onClick={() => setFiltroAutorizacion(auth.key)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      filtroAutorizacion === auth.key
                        ? auth.key === 'no_autorizado'
                          ? 'bg-rose-50 text-rose-700 shadow-sm'
                          : 'bg-emerald-50 text-emerald-800 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {auth.label}
                  </button>
                ))}
              </div>

              {/* Module Filter */}
              <div className="inline-flex rounded-xl bg-slate-100 p-1">
                {['TODOS', ...MODULOS].map((m) => (
                  <button
                    key={`mod-filter-${m}`}
                    type="button"
                    onClick={() => setFiltroModulo(m)}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                      filtroModulo === m
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {m !== 'TODOS' && (
                      <span className={`h-2 w-2 rounded-full ${MODULO_ESTILOS[m].punto}`} />
                    )}
                    {m}
                  </button>
                ))}
              </div>

              {/* Toggle Advanced Filters */}
              <button
                type="button"
                onClick={() => setMostrarFiltrosAvanzados((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                  mostrarFiltrosAvanzados || filtrosActivosCount > 2
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/10'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">tune</span>
                Filtros Avanzados
                <span className="material-symbols-outlined text-[16px]">
                  {mostrarFiltrosAvanzados ? 'expand_less' : 'expand_more'}
                </span>
              </button>
            </div>
          </div>

          {/* Collapsible Advanced Filters Drawer */}
          {mostrarFiltrosAvanzados && (
            <div className="mt-5 border-t border-slate-100 pt-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Obra Social Selector */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600">
                    Obra Social
                  </label>
                  <select
                    value={filtroObraSocial}
                    onChange={(e) => setFiltroObraSocial(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="">Todas las Obras Sociales</option>
                    {obrasSocialesDisponibles.map((os) => (
                      <option key={os} value={os}>
                        {os}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Terapia Selector */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600">
                    Terapia Específica
                  </label>
                  <select
                    value={filtroTratamiento}
                    onChange={(e) => setFiltroTratamiento(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="">Todas las Terapias</option>
                    {tratamientosFiltro.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mes y Año de Turnos */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600">
                    Mes y Año de Cronograma
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={filtroMes}
                      onChange={(e) => {
                        setFiltroMes(e.target.value);
                        setFiltroDia('');
                        setFiltroSemana('');
                      }}
                      className="w-2/3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      <option value="">Cualquier Mes</option>
                      {MESES.map((m, idx) => (
                        <option key={m} value={idx + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={filtroAnio}
                      onChange={(e) => setFiltroAnio(e.target.value)}
                      placeholder="Año"
                      className="w-1/3 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center text-xs font-medium text-slate-700 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                {/* Periodo: Día o Semana */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600">
                    Filtro por Día / Semana
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={filtroTipoFecha}
                      onChange={(e) => {
                        setFiltroTipoFecha(e.target.value);
                        setFiltroDia('');
                        setFiltroSemana('');
                      }}
                      disabled={!filtroMes}
                      className="w-1/2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-medium text-slate-700 disabled:opacity-50 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      <option value="">Todo el mes</option>
                      <option value="dia">Día puntual</option>
                      <option value="semana">Semana</option>
                    </select>
                    {filtroTipoFecha === 'semana' ? (
                      <select
                        value={filtroSemana}
                        onChange={(e) => setFiltroSemana(e.target.value)}
                        className="w-1/2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-medium text-slate-700 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      >
                        <option value="">Semana</option>
                        {semanasDisponibles.map((sem, idx) => (
                          <option key={`sem-${idx + 1}`} value={idx + 1}>
                            Semana {idx + 1}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={filtroDia}
                        onChange={(e) => setFiltroDia(e.target.value)}
                        disabled={filtroTipoFecha !== 'dia'}
                        className="w-1/2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-medium text-slate-700 disabled:opacity-50 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
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

                {/* Controles / Documentación */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600">
                    CAR / PPI / Controles
                  </label>
                  <select
                    value={filtroCampoCumplimiento}
                    onChange={(e) => {
                      setFiltroCampoCumplimiento(e.target.value);
                      setFiltroCampoFecha('');
                      if (e.target.value !== 'car' && e.target.value !== 'ppi') {
                        setFiltroAnioCumplimiento('');
                      }
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="">Sin filtrar documentación</option>
                    {CAMPOS_CUMPLIMIENTO.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Estado de Documentación */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600">
                    Estado de Cumplimiento
                  </label>
                  <select
                    value={filtroEstadoCumplimiento}
                    onChange={(e) => setFiltroEstadoCumplimiento(e.target.value)}
                    disabled={!filtroCampoCumplimiento}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="">Todos</option>
                    <option value="tiene">Tiene presentado / vigente</option>
                    <option value="no_tiene">No tiene presentado</option>
                  </select>
                </div>

                {/* Año Documental */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600">
                    Año Documental (CAR/PPI)
                  </label>
                  <select
                    value={filtroAnioCumplimiento}
                    onChange={(e) => setFiltroAnioCumplimiento(e.target.value)}
                    disabled={filtroCampoCumplimiento !== 'car' && filtroCampoCumplimiento !== 'ppi'}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="">Cualquier Año</option>
                    {ANIOS_DOCUMENTACION.map((anio) => (
                      <option key={anio} value={anio}>
                        {anio}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Fechas Sectorizadas */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600">
                    Fecha Específica de Control
                  </label>
                  <select
                    value={filtroCampoFecha}
                    onChange={(e) => setFiltroCampoFecha(e.target.value)}
                    disabled={Boolean(filtroCampoCumplimiento) && camposFechaSectorizadaDisponibles.length === 0}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="">Ninguna</option>
                    {camposFechaSectorizadaDisponibles.map((campo) => (
                      <option key={campo.value} value={campo.value}>
                        {campo.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Master - Detail Split Section */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          {/* Left Column: Search Results Feed */}
          <div className="space-y-4">
            {/* Results Header Bar */}
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 sm:flex-row sm:items-center">
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs text-emerald-800">
                    {pacientesFiltrados.length}
                  </span>
                  Resultados encontrados
                </span>

                {resumenObrasSociales.length > 0 && (
                  <div className="hidden items-center gap-1.5 md:flex">
                    <span className="text-slate-300">|</span>
                    {resumenObrasSociales.map(([obra, cantidad]) => (
                      <span
                        key={`os-tag-${obra}`}
                        className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                      >
                        {obra}: {cantidad}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Pagination Controls */}
              {pacientesFiltrados.length > 0 && (
                <div className="flex items-center gap-1 text-xs">
                  <span className="mr-2 text-slate-500">
                    Página {paginaResultadosSegura} de {totalPaginasResultados}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPaginaResultados((p) => Math.max(1, p - 1))}
                    disabled={paginaResultadosSegura === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaginaResultados((p) => Math.min(totalPaginasResultados, p + 1))}
                    disabled={paginaResultadosSegura === totalPaginasResultados}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                  </button>
                </div>
              )}
            </div>

            {/* Patients List Grid */}
            {pacientesPaginados.length > 0 ? (
              <div className="space-y-3">
                {pacientesPaginados.map((p) => {
                  const seleccionado = pacienteActual?.id === p.id;
                  const modulosPaciente = normalizarModulos(p?.modulos || p?.modulo);
                  const iniciales = obtenerInicialesPaciente(p);
                  const estaDeBaja = p?.dadoDeBaja === true;
                  const estaAutorizado = p?.activo !== false;

                  return (
                    <div
                      key={`card-${p.id}`}
                      className={`group relative overflow-hidden rounded-2xl border transition-all duration-200 ${
                        seleccionado
                          ? 'border-emerald-500 bg-emerald-50/30 shadow-md ring-2 ring-emerald-500/20'
                          : 'border-slate-200/80 bg-white shadow-sm hover:border-emerald-300 hover:shadow-md'
                      }`}
                    >
                      {/* Left Accent Color Indicator */}
                      <div
                        className={`absolute bottom-0 left-0 top-0 w-1.5 transition-colors ${
                          seleccionado ? 'bg-emerald-600' : 'bg-transparent group-hover:bg-emerald-300'
                        }`}
                      />

                      <div className="p-4 sm:p-5 pl-5 sm:pl-6">
                        {/* Top Row: Avatar + Name + Badges */}
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                          <div className="flex items-center gap-3.5">
                            <div
                              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold shadow-sm ${
                                seleccionado
                                  ? 'bg-emerald-700 text-white'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {iniciales}
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-base font-bold text-slate-900">
                                  {formatearEtiquetaPaciente(p)}
                                </h4>
                                {p.dni && (
                                  <span className="font-mono text-xs text-slate-400">
                                    DNI {p.dni}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500">
                                {p.edad ? `${p.edad} años` : 'Edad no especificada'} •{' '}
                                <span className="font-medium text-slate-700">
                                  {p.obraSocial || 'Sin obra social'}
                                </span>
                              </p>
                            </div>
                          </div>

                          {/* Status Pills */}
                          <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                            {estaDeBaja ? (
                              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                                Baja
                              </span>
                            ) : (
                              <>
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
                                  {String(p.patient_state_name || 'Admisión').replace('_', ' ')}
                                </span>
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                                    estaAutorizado
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-rose-100 text-rose-700'
                                  }`}
                                >
                                  {estaAutorizado ? 'Autorizado' : 'Pendiente'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Mid Row: Modules & Treatments */}
                        <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                          {/* Modules Badges */}
                          <div className="flex items-center gap-1.5">
                            {modulosPaciente.length > 0 ? (
                              modulosPaciente.map((mod) => (
                                <span
                                  key={`mod-badge-${p.id}-${mod}`}
                                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase ${
                                    MODULO_ESTILOS[mod].badge
                                  }`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${MODULO_ESTILOS[mod].punto}`}
                                  />
                                  {mod}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-slate-400">Sin módulos</span>
                            )}
                          </div>

                          <span className="text-slate-300">•</span>

                          {/* Treatments */}
                          <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-600">
                            {(p.tratamientos || []).length > 0 ? (
                              (p.tratamientos || []).map((t) => (
                                <span
                                  key={`treat-${p.id}-${t}`}
                                  className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                                >
                                  {t}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400">Sin terapias activas</span>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons Toolbar */}
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setIdSeleccionado(p.id);
                                seleccionarPaciente(p.id);
                              }}
                              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                                seleccionado
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                {seleccionado ? 'edit_note' : 'dashboard_customize'}
                              </span>
                              {seleccionado ? 'Editando en Panel' : 'Panel Rápido'}
                            </button>

                            <button
                              type="button"
                              onClick={() => alAbrirPaciente(p.id)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                            >
                              <span className="material-symbols-outlined text-[16px] text-slate-400">
                                open_in_new
                              </span>
                              Ver Ficha
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={estaDeBaja}
                              onClick={() => cambiarEstadoPaciente(p.id, p.activo === false)}
                              title={estaAutorizado ? 'Suspender autorización' : 'Habilitar autorización'}
                              className={`flex h-8 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold transition disabled:opacity-40 ${
                                estaAutorizado
                                  ? 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-600'
                                  : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[15px]">
                                {estaAutorizado ? 'block' : 'check_circle'}
                              </span>
                              {estaAutorizado ? 'Suspender' : 'Autorizar'}
                            </button>

                            <button
                              type="button"
                              onClick={() => cambiarBajaPaciente(p.id, !estaDeBaja)}
                              title={estaDeBaja ? 'Reactivar paciente' : 'Dar de baja administrativa'}
                              className={`flex h-8 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold transition ${
                                estaDeBaja
                                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                  : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-600'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[15px]">
                                {estaDeBaja ? 'restart_alt' : 'person_off'}
                              </span>
                              {estaDeBaja ? 'Reactivar' : 'Baja'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <span className="material-symbols-outlined text-2xl">person_search</span>
                </div>
                <h4 className="text-base font-bold text-slate-800">
                  No se encontraron pacientes
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  Prueba modificando los términos de búsqueda o limpiando los filtros seleccionados.
                </p>
                <button
                  type="button"
                  onClick={limpiarFiltros}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  Restablecer todos los filtros
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Interactive Inspector / Quick Dock */}
          <aside className="sticky top-20 h-fit space-y-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            {pacienteActual ? (
              <div className="space-y-5">
                {/* Selected Patient Hero Header */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-base font-bold text-white shadow-sm">
                      {obtenerInicialesPaciente(pacienteActual)}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                        Panel de Gestión Rápida
                      </p>
                      <h3 className="text-lg font-extrabold text-slate-900">
                        {formatearEtiquetaPaciente(pacienteActual)}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {pacienteActual.obraSocial || 'Sin obra social'} •{' '}
                        {pacienteActual.edad ? `${pacienteActual.edad} años` : 'Edad -'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIdSeleccionado('')}
                    title="Cerrar panel de edición"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>

                {pacienteBloqueado && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <strong>Paciente dado de baja:</strong> Edición de módulos y turnos restringida hasta reactivación.
                  </div>
                )}

                {/* Section 1: Module Assignment */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Módulos Clínicos</span>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {moduloEdicion.length} asignado(s)
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {MODULOS.map((m) => {
                      const activo = moduloEdicion.includes(m);
                      return (
                        <button
                          key={`dock-mod-${m}`}
                          type="button"
                          disabled={pacienteBloqueado}
                          onClick={() => alternarModuloEdicion(m)}
                          className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-bold transition ${
                            activo
                              ? MODULO_ESTILOS[m].botonActivo
                              : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <span className={`h-2 w-2 rounded-full ${MODULO_ESTILOS[m].punto}`} />
                          {m}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      disabled={pacienteBloqueado || guardandoModulo}
                      onClick={guardarModuloPaciente}
                      className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {guardandoModulo ? 'Guardando...' : 'Guardar Módulo'}
                    </button>
                    {mensajeModulo && (
                      <span className="text-xs font-semibold text-emerald-700">
                        {mensajeModulo}
                      </span>
                    )}
                  </div>
                </div>

                {/* Section 2: Assigned Treatments + Add */}
                <div className="space-y-2.5 border-t border-slate-100 pt-4">
                  <span className="block text-xs font-bold text-slate-800">
                    Terapias Asignadas
                  </span>

                  <div className="flex flex-wrap gap-1.5">
                    {(pacienteActual.tratamientos || []).length > 0 ? (
                      (pacienteActual.tratamientos || []).map((t) => (
                        <span
                          key={`dock-assigned-${t}`}
                          className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200"
                        >
                          {t}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">Sin terapias activas</span>
                    )}
                  </div>

                  {!pacienteBloqueado && (
                    <form onSubmit={guardarTratamientosNuevos} className="space-y-2 pt-2">
                      <span className="block text-[11px] font-semibold text-slate-500">
                        Agregar nuevas terapias:
                      </span>
                      <AlternarTratamientosList
                        seleccionados={tratamientosAgregar}
                        deshabilitados={pacienteActual?.tratamientos || []}
                        alCambiar={alternarAgregarTratamiento}
                      />
                      {tratamientosAgregar.length > 0 && (
                        <button
                          type="submit"
                          className="mt-2 inline-flex items-center gap-1 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-900"
                        >
                          <span className="material-symbols-outlined text-[15px]">add</span>
                          Confirmar Terapias ({tratamientosAgregar.length})
                        </button>
                      )}
                    </form>
                  )}
                </div>

                {/* Section 3: Monthly Schedule / Turnos */}
                <div className="space-y-2.5 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Cronograma Mensual
                    </span>
                    <select
                      value={mesSeleccionado}
                      onChange={(e) => setMesSeleccionado(Number(e.target.value))}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700"
                    >
                      {MESES.map((nombreMes, index) => (
                        <option key={nombreMes} value={index + 1}>
                          {nombreMes}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(pacienteActual.tratamientos || []).length > 0 ? (
                    <div className="space-y-3">
                      {(pacienteActual.tratamientos || []).map((t) => (
                        <CronogramaMatrix
                          key={`dock-crono-${t}`}
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
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">
                      Asigna al menos una terapia para habilitar la grilla de turnos.
                    </div>
                  )}
                </div>

                {/* Full Patient Detail Action Link */}
                <div className="border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => alAbrirPaciente(pacienteActual.id)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
                  >
                    <span className="material-symbols-outlined text-[16px]">person</span>
                    Abrir Ficha Completa del Paciente
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <span className="material-symbols-outlined text-3xl">touch_app</span>
                </div>
                <h4 className="text-base font-bold text-slate-900">
                  Panel de Gestión Rápida
                </h4>
                <p className="mt-1.5 max-w-[280px] text-xs leading-relaxed text-slate-500">
                  Selecciona cualquier paciente del listado para editar sus módulos clínicos, asignar terapias o configurar su cronograma mensual.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
