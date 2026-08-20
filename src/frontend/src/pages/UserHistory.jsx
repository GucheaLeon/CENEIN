import React, { useEffect, useMemo, useState } from 'react';
import { obtenerActividadUsuariosApi } from '../services/api';

/* ─── Helpers de formato ────────────────────────────────────────────── */

function formatearFechaHora(valor) {
  const raw = String(valor || '').trim();
  if (!raw) return '-';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function formatearFechaRelativa(valor) {
  const raw = String(valor || '').trim();
  if (!raw) return '-';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.round(diffMs / (1000 * 60));
  const diffHoras = Math.round(diffMs / (1000 * 60 * 60));
  const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffMin < 1) return 'Hace un momento';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHoras < 24) return `Hace ${diffHoras} h`;
  if (diffDias === 1) return 'Ayer';
  if (diffDias < 30) return `Hace ${diffDias} días`;
  return formatearFechaHora(valor);
}

/* ─── Parseo de detalles ────────────────────────────────────────────── */

function parsearDetails(details) {
  if (!details) return null;
  const raw = String(details).trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * Devuelve el nombre legible del "objetivo" de la acción,
 * preferiendo nombre/apellido sobre DNI o IDs numéricos.
 */
function extraerNombreObjetivo(item) {
  const label = String(item.entityLabel || '').trim();
  if (label && !/^\d+$/.test(label)) return label;

  const parsed = parsearDetails(item.details);
  if (parsed && typeof parsed === 'object') {
    if (parsed.nombre && parsed.apellido) return `${parsed.nombre} ${parsed.apellido}`;
    if (parsed.nombre) return parsed.nombre;
    if (parsed.apellido) return parsed.apellido;
    if (parsed.name) return parsed.name;
    if (parsed.tratamiento) return parsed.tratamiento;
    if (parsed.username) return `@${parsed.username}`;
    if (parsed.dni) return `DNI ${parsed.dni}`;
  }

  if (label) return label;
  const id = String(item.entityId || '').trim();
  if (id) return `#${id}`;
  return null;
}

/**
 * Construye la oración descriptiva de la acción.
 * Ej: "Creó al paciente Juan García" / "Eliminó la asistencia del 12/06"
 */
function construirDescripcionAccion(item) {
  const actor = item.actorUsername || 'Sistema';
  const tipo = String(item.actionType || '').toLowerCase();
  const entidad = String(item.entityType || '').toLowerCase();
  const objetivo = extraerNombreObjetivo(item);

  let verbo = 'Realizó una acción sobre';
  if (['create', 'crear', 'creo'].includes(tipo)) verbo = 'Creó';
  else if (['delete', 'eliminar', 'elimino'].includes(tipo)) verbo = 'Eliminó';
  else if (['update', 'actualizar', 'actualizo', 'modificar'].includes(tipo)) verbo = 'Modificó';
  else if (['login', 'ingreso'].includes(tipo)) verbo = 'Inició sesión en';
  else if (['logout', 'salida'].includes(tipo)) verbo = 'Cerró sesión en';
  else if (tipo) verbo = tipo.charAt(0).toUpperCase() + tipo.slice(1);

  let articulo = 'el registro';
  if (entidad.includes('paciente') || entidad.includes('patient')) articulo = 'al paciente';
  else if (entidad.includes('asistencia') || entidad.includes('attendance')) articulo = 'la asistencia';
  else if (entidad.includes('usuario') || entidad.includes('user')) articulo = 'al usuario';
  else if (entidad.includes('admision') || entidad.includes('admission')) articulo = 'la admisión';
  else if (entidad.includes('factura') || entidad.includes('invoice')) articulo = 'la factura';

  const parteObjetivo = objetivo ? ` ${articulo} ${objetivo}` : ` un elemento del sistema`;
  return { actor, frase: `${verbo}${parteObjetivo}` };
}

/* ─── Renderizado de detalles adicionales ────────────────────────────── */

function renderizarDetalleExtra(item) {
  const parsed = parsearDetails(item.details);

  if (!parsed) {
    return <span className="text-slate-400 text-xs italic">Sin detalle adicional</span>;
  }

  if (typeof parsed === 'string') {
    return <span className="text-xs text-slate-700">{parsed}</span>;
  }

  if (Array.isArray(parsed?.tratamientos)) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-slate-500">Tratamientos:</span>
        {parsed.tratamientos.map((t, idx) => (
          <span
            key={`t-${idx}`}
            className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200"
          >
            {t}
          </span>
        ))}
      </div>
    );
  }

  if (typeof parsed?.isAdmin === 'boolean') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
          parsed.isAdmin
            ? 'bg-purple-50 text-purple-700 border border-purple-200'
            : 'bg-slate-100 text-slate-700'
        }`}
      >
        {parsed.isAdmin ? 'Promovido a Administrador' : 'Cambiado a Operador'}
      </span>
    );
  }

  const clavesMostrar = Object.entries(parsed).filter(
    ([k]) => !['nombre', 'apellido', 'name'].includes(k.toLowerCase())
  );

  if (clavesMostrar.length === 0) {
    return <span className="text-slate-400 text-xs italic">Sin detalle adicional</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {clavesMostrar.map(([k, v]) => (
        <span
          key={k}
          className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700"
        >
          <span className="text-slate-400 font-medium">{k}:</span>
          <span className="font-semibold text-slate-800">{String(v)}</span>
        </span>
      ))}
    </div>
  );
}

/* ─── Insignias ─────────────────────────────────────────────────────── */

function InsigniaAccion({ actionType }) {
  const tipo = String(actionType || '').toLowerCase();
  if (['create', 'crear', 'creo'].includes(tipo)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-[#006d44]">
        <span className="material-symbols-outlined text-[14px]">add_circle</span>
        Creación
      </span>
    );
  }
  if (['delete', 'eliminar', 'elimino'].includes(tipo)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700">
        <span className="material-symbols-outlined text-[14px]">delete</span>
        Eliminación
      </span>
    );
  }
  if (['update', 'actualizar', 'actualizo', 'modificar'].includes(tipo)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
        <span className="material-symbols-outlined text-[14px]">edit</span>
        Modificación
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
      <span className="material-symbols-outlined text-[14px]">info</span>
      {actionType || 'Evento'}
    </span>
  );
}

function InsigniaEntidad({ entityType }) {
  const ent = String(entityType || '').toLowerCase();
  let estilo = 'bg-slate-100 text-slate-700';
  let icono = 'description';

  if (ent.includes('paciente') || ent.includes('patient')) {
    estilo = 'bg-teal-50 text-teal-800 border border-teal-200';
    icono = 'person';
  } else if (ent.includes('asistencia') || ent.includes('attendance')) {
    estilo = 'bg-blue-50 text-blue-800 border border-blue-200';
    icono = 'event_available';
  } else if (ent.includes('usuario') || ent.includes('user')) {
    estilo = 'bg-purple-50 text-purple-800 border border-purple-200';
    icono = 'account_circle';
  } else if (ent.includes('admision') || ent.includes('admission')) {
    estilo = 'bg-indigo-50 text-indigo-800 border border-indigo-200';
    icono = 'assignment_ind';
  } else if (ent.includes('factura') || ent.includes('invoice')) {
    estilo = 'bg-orange-50 text-orange-800 border border-orange-200';
    icono = 'receipt_long';
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold ${estilo}`}>
      <span className="material-symbols-outlined text-[14px]">{icono}</span>
      {entityType || 'Sistema'}
    </span>
  );
}

/* ─── Normalización de tipo de acción ───────────────────────────────── */

function normalizarTipoAccion(tipo) {
  const t = String(tipo || '').toLowerCase();
  if (['create', 'crear', 'creo'].includes(t)) return 'create';
  if (['delete', 'eliminar', 'elimino'].includes(t)) return 'delete';
  if (['update', 'actualizar', 'actualizo', 'modificar'].includes(t)) return 'update';
  return t || 'otro';
}

const ITEMS_POR_PAGINA = 15;

/* ─── Componente principal ──────────────────────────────────────────── */

export default function UserHistory() {
  const [actividad, setActividad] = useState([]);
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [filtroTipoAccion, setFiltroTipoAccion] = useState('todos');
  const [filtroEntidad, setFiltroEntidad] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [paginaActual, setPaginaActual] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  async function cargar() {
    setCargando(true);
    setError('');
    try {
      const actividadData = await obtenerActividadUsuariosApi();
      setActividad(Array.isArray(actividadData) ? actividadData : []);
    } catch (err) {
      setError(err.message || 'No se pudo cargar el historial de actividad.');
      setActividad([]);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const usuariosConActividad = useMemo(() => {
    return Array.from(
      new Set(actividad.map((i) => String(i.actorUsername || '').trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, 'es'));
  }, [actividad]);

  const entidadesDisponibles = useMemo(() => {
    return Array.from(
      new Set(actividad.map((i) => String(i.entityType || '').trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, 'es'));
  }, [actividad]);

  const stats = useMemo(() => {
    const total = actividad.length;
    const creaciones = actividad.filter((i) =>
      normalizarTipoAccion(i.actionType) === 'create'
    ).length;
    const eliminaciones = actividad.filter((i) =>
      normalizarTipoAccion(i.actionType) === 'delete'
    ).length;
    const usuariosUnicos = usuariosConActividad.length;
    return { total, creaciones, eliminaciones, usuariosUnicos };
  }, [actividad, usuariosConActividad]);

  const actividadFiltrada = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return actividad.filter((item) => {
      if (
        filtroUsuario &&
        String(item.actorUsername || '').trim().toLowerCase() !== filtroUsuario.toLowerCase()
      ) return false;

      const tipoNorm = normalizarTipoAccion(item.actionType);
      if (filtroTipoAccion !== 'todos' && tipoNorm !== filtroTipoAccion) return false;

      if (
        filtroEntidad &&
        String(item.entityType || '').trim().toLowerCase() !== filtroEntidad.toLowerCase()
      ) return false;

      if (!q) return true;
      const actor = String(item.actorUsername || '').toLowerCase();
      const entidad = String(item.entityType || '').toLowerCase();
      const objetivo = String(extraerNombreObjetivo(item) || '').toLowerCase();
      const detalles = String(item.details || '').toLowerCase();
      const { frase } = construirDescripcionAccion(item);

      return (
        actor.includes(q) ||
        entidad.includes(q) ||
        objetivo.includes(q) ||
        detalles.includes(q) ||
        frase.toLowerCase().includes(q)
      );
    });
  }, [actividad, filtroUsuario, filtroTipoAccion, filtroEntidad, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(actividadFiltrada.length / ITEMS_POR_PAGINA));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const desde = (paginaSegura - 1) * ITEMS_POR_PAGINA;
  const hasta = desde + ITEMS_POR_PAGINA;
  const actividadPaginada = actividadFiltrada.slice(desde, hasta);

  useEffect(() => {
    setPaginaActual(1);
  }, [filtroUsuario, filtroTipoAccion, filtroEntidad, busqueda]);

  const hayFiltrosActivos =
    filtroUsuario || filtroTipoAccion !== 'todos' || filtroEntidad || busqueda;

  function limpiarFiltros() {
    setFiltroUsuario('');
    setFiltroTipoAccion('todos');
    setFiltroEntidad('');
    setBusqueda('');
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-8">

        {/* ── Encabezado ── */}
        <section className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <nav className="mb-2 flex items-center gap-2 text-xs text-slate-400">
              <span>Administración</span>
              <span className="material-symbols-outlined text-[12px]">chevron_right</span>
              <span className="font-semibold text-[#006d44]">Auditoría de Actividad</span>
            </nav>
            <h2 className="text-3xl font-extrabold tracking-tight text-[#2d3335] sm:text-4xl">
              Historial de Actividad
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Registro cronológico de acciones realizadas por usuarios sobre pacientes y registros del sistema.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={cargar}
              disabled={cargando}
              className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[18px] ${cargando ? 'animate-spin' : ''}`}>
                refresh
              </span>
              <span>Actualizar</span>
            </button>
          </div>
        </section>

        {/* ── Estadísticas ── */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { icono: 'history', bg: 'bg-[#d6ffe8]', color: 'text-[#006d44]', label: 'Eventos Totales', valor: stats.total, colorValor: 'text-slate-800' },
            { icono: 'group', bg: 'bg-purple-100', color: 'text-purple-700', label: 'Usuarios Activos', valor: stats.usuariosUnicos, colorValor: 'text-purple-900' },
            { icono: 'add_circle', bg: 'bg-emerald-100', color: 'text-[#006d44]', label: 'Creaciones', valor: stats.creaciones, colorValor: 'text-[#006d44]' },
            { icono: 'delete', bg: 'bg-rose-100', color: 'text-rose-700', label: 'Eliminaciones', valor: stats.eliminaciones, colorValor: 'text-rose-700' },
          ].map(({ icono, bg, color, label, valor, colorValor }) => (
            <div key={label} className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${bg} ${color}`}>
                <span className="material-symbols-outlined text-[24px]">{icono}</span>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <p className={`font-headline text-2xl font-extrabold ${colorValor}`}>{valor}</p>
              </div>
            </div>
          ))}
        </section>

        {error && (
          <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-800">
            <span className="material-symbols-outlined text-[22px]">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* ── Panel principal ── */}
        <section className="rounded-2xl bg-[#f1f4f5] p-1">
          <div className="space-y-5 rounded-[20px] bg-white p-6 shadow-sm">

            {/* ── Filtros ── */}
            <div className="space-y-4">
              {/* Búsqueda libre */}
              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  search
                </span>
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por usuario, nombre de paciente, acción o detalle..."
                  className="w-full rounded-xl border-none bg-[#f1f4f5] py-3 pl-10 pr-10 text-sm text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-200 outline-none"
                />
                {busqueda && (
                  <button
                    type="button"
                    onClick={() => setBusqueda('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                )}
              </div>

              {/* Selectores + chips de tipo de acción */}
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-3">
                  {/* Filtro usuario */}
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[16px] pointer-events-none">person</span>
                    <select
                      value={filtroUsuario}
                      onChange={(e) => setFiltroUsuario(e.target.value)}
                      className="rounded-xl border-none bg-[#f1f4f5] py-2.5 pl-9 pr-8 text-xs font-bold uppercase tracking-wider text-slate-700 focus:ring-2 focus:ring-emerald-200 outline-none appearance-none cursor-pointer"
                    >
                      <option value="">Todos los usuarios</option>
                      {usuariosConActividad.map((u) => (
                        <option key={u} value={u}>@{u}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filtro registro / entidad */}
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[16px] pointer-events-none">folder_open</span>
                    <select
                      value={filtroEntidad}
                      onChange={(e) => setFiltroEntidad(e.target.value)}
                      className="rounded-xl border-none bg-[#f1f4f5] py-2.5 pl-9 pr-8 text-xs font-bold uppercase tracking-wider text-slate-700 focus:ring-2 focus:ring-emerald-200 outline-none appearance-none cursor-pointer"
                    >
                      <option value="">Todos los registros</option>
                      {entidadesDisponibles.map((ent) => (
                        <option key={ent} value={ent}>{ent}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Chips tipo acción */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { key: 'todos', label: 'Todas', active: 'bg-[#006d44] text-white' },
                    { key: 'create', label: 'Creaciones', active: 'bg-emerald-600 text-white' },
                    { key: 'update', label: 'Modificaciones', active: 'bg-amber-500 text-white' },
                    { key: 'delete', label: 'Eliminaciones', active: 'bg-rose-600 text-white' },
                  ].map(({ key, label, active }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFiltroTipoAccion(key)}
                      className={`rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wider transition ${
                        filtroTipoAccion === key ? active : 'bg-[#f1f4f5] text-slate-600 hover:bg-[#e5e9eb]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chips de filtros activos */}
              {hayFiltrosActivos && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-500 font-medium">Filtros activos:</span>
                  {filtroUsuario && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-800">
                      <span className="material-symbols-outlined text-[12px]">person</span>
                      @{filtroUsuario}
                      <button type="button" onClick={() => setFiltroUsuario('')} className="ml-0.5 hover:text-purple-600">
                        <span className="material-symbols-outlined text-[12px]">close</span>
                      </button>
                    </span>
                  )}
                  {filtroEntidad && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
                      <span className="material-symbols-outlined text-[12px]">folder_open</span>
                      {filtroEntidad}
                      <button type="button" onClick={() => setFiltroEntidad('')} className="ml-0.5 hover:text-indigo-600">
                        <span className="material-symbols-outlined text-[12px]">close</span>
                      </button>
                    </span>
                  )}
                  {filtroTipoAccion !== 'todos' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                      <span className="material-symbols-outlined text-[12px]">filter_alt</span>
                      {filtroTipoAccion === 'create' ? 'Creaciones' : filtroTipoAccion === 'delete' ? 'Eliminaciones' : 'Modificaciones'}
                      <button type="button" onClick={() => setFiltroTipoAccion('todos')} className="ml-0.5 hover:text-amber-600">
                        <span className="material-symbols-outlined text-[12px]">close</span>
                      </button>
                    </span>
                  )}
                  {busqueda && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                      <span className="material-symbols-outlined text-[12px]">search</span>
                      "{busqueda}"
                      <button type="button" onClick={() => setBusqueda('')} className="ml-0.5 hover:text-slate-500">
                        <span className="material-symbols-outlined text-[12px]">close</span>
                      </button>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={limpiarFiltros}
                    className="text-xs text-slate-400 hover:text-rose-600 font-semibold transition underline underline-offset-2 ml-1"
                  >
                    Limpiar todo
                  </button>
                </div>
              )}
            </div>

            {/* ── Paginación superior ── */}
            <div className="flex flex-col gap-3 border-y border-slate-100 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Mostrando {actividadPaginada.length ? desde + 1 : 0}–{Math.min(hasta, actividadFiltrada.length)} de{' '}
                {actividadFiltrada.length} eventos
                {hayFiltrosActivos && (
                  <span className="ml-1 text-[#006d44] font-semibold">(filtrados de {actividad.length})</span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                  disabled={paginaSegura === 1}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                  Anterior
                </button>
                <span className="rounded-lg bg-[#006d44] px-3 py-1 text-xs font-bold text-white">
                  {paginaSegura} / {totalPaginas}
                </span>
                <button
                  type="button"
                  onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                  disabled={paginaSegura === totalPaginas}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-[#006d44] transition hover:bg-emerald-50 disabled:opacity-40"
                >
                  Siguiente
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
              </div>
            </div>

            {/* ── Cabecera tabla ── */}
            <div className="hidden grid-cols-12 gap-4 rounded-xl border-b border-slate-200 bg-[#f5f7f8] px-6 py-3.5 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 md:grid">
              <div className="col-span-2">Fecha y Hora</div>
              <div className="col-span-2">Usuario</div>
              <div className="col-span-2">Tipo</div>
              <div className="col-span-3">Acción Realizada</div>
              <div className="col-span-3">Detalle del Registro</div>
            </div>

            {/* ── Cuerpo ── */}
            {cargando ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <span className="material-symbols-outlined animate-spin text-[36px] text-[#006d44]">
                  progress_activity
                </span>
                <p className="mt-3 text-sm font-medium">Cargando registros de auditoría...</p>
              </div>
            ) : actividadPaginada.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <span className="material-symbols-outlined text-[28px]">history_toggle_off</span>
                </div>
                <p className="text-base font-bold text-slate-700">No hay actividad registrada</p>
                <p className="text-xs text-slate-400">
                  {hayFiltrosActivos
                    ? 'No se encontraron registros con los filtros seleccionados.'
                    : 'Aún no se han producido eventos auditados en el sistema.'}
                </p>
                {hayFiltrosActivos && (
                  <button
                    type="button"
                    onClick={limpiarFiltros}
                    className="mt-4 rounded-xl bg-[#f1f4f5] px-4 py-2 text-xs font-bold text-slate-600 hover:bg-[#e5e9eb] transition"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {actividadPaginada.map((item) => {
                  const username = item.actorUsername || 'Sistema';
                  const iniciales = String(username).substring(0, 2).toUpperCase();
                  const nombreObjetivo = extraerNombreObjetivo(item);
                  const { frase } = construirDescripcionAccion(item);

                  return (
                    <div
                      key={item.id || `${item.createdAt}-${item.actorUsername}`}
                      className="grid grid-cols-1 gap-3 px-4 py-4 transition-colors hover:bg-[#f8faf9] md:grid-cols-12 md:items-start md:px-6 md:py-5"
                    >
                      {/* Fecha */}
                      <div className="md:col-span-2">
                        <p className="text-xs font-bold text-slate-800">{formatearFechaHora(item.createdAt)}</p>
                        <p className="text-[11px] text-slate-400">{formatearFechaRelativa(item.createdAt)}</p>
                      </div>

                      {/* Usuario */}
                      <div className="flex items-center gap-2.5 md:col-span-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#d6ffe8] text-xs font-bold text-[#006d44]">
                          {iniciales}
                        </div>
                        <p className="text-xs font-bold text-slate-800 truncate">@{username}</p>
                      </div>

                      {/* Tipo de acción + entidad */}
                      <div className="md:col-span-2 flex flex-col gap-1.5">
                        <InsigniaAccion actionType={item.actionType} />
                        <InsigniaEntidad entityType={item.entityType} />
                      </div>

                      {/* Acción descriptiva */}
                      <div className="md:col-span-3 space-y-1">
                        <p className="text-xs font-semibold text-slate-800 leading-snug">{frase}</p>
                        {nombreObjetivo && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 border border-teal-200 px-2 py-0.5 text-[11px] font-bold text-teal-800">
                            <span className="material-symbols-outlined text-[11px]">person_pin</span>
                            {nombreObjetivo}
                          </span>
                        )}
                      </div>

                      {/* Detalle extra */}
                      <div className="md:col-span-3 overflow-hidden">
                        {renderizarDetalleExtra(item)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Paginación inferior numérica ── */}
            {actividadPaginada.length > 0 && (
              <div className="flex items-center justify-center gap-2 border-t border-slate-100 pt-4 flex-wrap">
                <button
                  type="button"
                  onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                  disabled={paginaSegura === 1}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                  Anterior
                </button>
                {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPaginas || Math.abs(p - paginaSegura) <= 1)
                  .reduce((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-xs text-slate-400">…</span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPaginaActual(p)}
                        className={`min-w-[32px] rounded-lg px-2 py-1.5 text-xs font-bold transition ${
                          p === paginaSegura ? 'bg-[#006d44] text-white' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  type="button"
                  onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                  disabled={paginaSegura === totalPaginas}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-[#006d44] transition hover:bg-emerald-50 disabled:opacity-40"
                >
                  Siguiente
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

