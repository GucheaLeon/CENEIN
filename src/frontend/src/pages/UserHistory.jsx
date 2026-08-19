import React, { useEffect, useMemo, useState } from 'react';
import { obtenerActividadUsuariosApi } from '../services/api';

const ITEMS_POR_PAGINA = 15;

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

function renderizarDetalleActividad(valor) {
  const raw = String(valor || '').trim();
  if (!raw) return <span className="text-slate-400 text-xs italic">Sin detalle adicional</span>;

  try {
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed?.tratamientos)) {
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-600">Tratamientos:</span>
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

    if (parsed?.tratamiento && parsed?.fecha) {
      return (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
          <span className="rounded-md bg-sky-50 px-2 py-0.5 font-bold text-sky-700 border border-sky-200">
            {parsed.tratamiento}
          </span>
          <span className="text-slate-400">•</span>
          <span className="font-medium text-slate-600">Fecha: {parsed.fecha}</span>
        </div>
      );
    }

    if (parsed?.tratamiento) {
      return (
        <span className="rounded-md bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-700 border border-sky-200">
          {parsed.tratamiento}
        </span>
      );
    }

    if (parsed?.dni) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
          <span className="text-slate-400">DNI:</span>
          <strong className="font-bold text-slate-800">{parsed.dni}</strong>
        </span>
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

    if (typeof parsed === 'object' && parsed !== null) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(parsed).map(([k, v]) => (
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

    return <span className="text-xs text-slate-700">{raw}</span>;
  } catch (err) {
    return <span className="text-xs text-slate-700">{raw}</span>;
  }
}

function obtenerInsigniaAccion(actionType) {
  const tipo = String(actionType || '').toLowerCase();
  if (tipo === 'create' || tipo === 'crear' || tipo === 'creo') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-[#006d44]">
        <span className="material-symbols-outlined text-[14px]">add_circle</span>
        Creación
      </span>
    );
  }
  if (tipo === 'delete' || tipo === 'eliminar' || tipo === 'elimino') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700">
        <span className="material-symbols-outlined text-[14px]">delete</span>
        Eliminación
      </span>
    );
  }
  if (tipo === 'update' || tipo === 'actualizar' || tipo === 'actualizo' || tipo === 'modificar') {
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

function obtenerInsigniaEntidad(entityType) {
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
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold ${estilo}`}>
      <span className="material-symbols-outlined text-[14px]">{icono}</span>
      {entityType || 'Sistema'}
    </span>
  );
}

export default function UserHistory() {
  const [actividad, setActividad] = useState([]);
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [filtroTipoAccion, setFiltroTipoAccion] = useState('todos');
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
      new Set(actividad.map((item) => String(item.actorUsername || '').trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, 'es'));
  }, [actividad]);

  const stats = useMemo(() => {
    const total = actividad.length;
    const creaciones = actividad.filter((i) =>
      ['create', 'crear', 'creo'].includes(String(i.actionType || '').toLowerCase())
    ).length;
    const eliminaciones = actividad.filter((i) =>
      ['delete', 'eliminar', 'elimino'].includes(String(i.actionType || '').toLowerCase())
    ).length;
    const usuariosUnicos = usuariosConActividad.length;
    return { total, creaciones, eliminaciones, usuariosUnicos };
  }, [actividad, usuariosConActividad]);

  const actividadFiltrada = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return actividad.filter((item) => {
      // Filtro por usuario
      if (filtroUsuario && String(item.actorUsername || '').trim().toLowerCase() !== filtroUsuario.toLowerCase()) {
        return false;
      }
      // Filtro por tipo de acción
      const tipo = String(item.actionType || '').toLowerCase();
      if (filtroTipoAccion === 'create' && !['create', 'crear', 'creo'].includes(tipo)) return false;
      if (filtroTipoAccion === 'delete' && !['delete', 'eliminar', 'elimino'].includes(tipo)) return false;
      if (
        filtroTipoAccion === 'update' &&
        !['update', 'actualizar', 'actualizo', 'modificar'].includes(tipo)
      ) {
        return false;
      }

      // Búsqueda en texto libre
      if (!q) return true;
      const actor = String(item.actorUsername || '').toLowerCase();
      const entidad = String(item.entityType || '').toLowerCase();
      const etiqueta = String(item.entityLabel || item.entityId || '').toLowerCase();
      const detalles = String(item.details || '').toLowerCase();

      return actor.includes(q) || entidad.includes(q) || etiqueta.includes(q) || detalles.includes(q);
    });
  }, [actividad, filtroUsuario, filtroTipoAccion, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(actividadFiltrada.length / ITEMS_POR_PAGINA));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const desde = (paginaSegura - 1) * ITEMS_POR_PAGINA;
  const hasta = desde + ITEMS_POR_PAGINA;
  const actividadPaginada = actividadFiltrada.slice(desde, hasta);

  useEffect(() => {
    setPaginaActual(1);
  }, [filtroUsuario, filtroTipoAccion, busqueda]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Encabezado */}
        <section className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <nav className="mb-2 flex items-center gap-2 text-xs text-slate-400">
              <span>Administración</span>
              <span className="material-symbols-outlined text-[12px]">chevron_right</span>
              <span className="font-semibold text-[#006d44]">Auditoría de Actividad</span>
            </nav>
            <h2 className="text-3xl font-extrabold tracking-tight text-[#2d3335] sm:text-4xl">
              Historial de Usuarios
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Registro cronológico inmutable de acciones, creaciones, modificaciones y eliminaciones.
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
              <span>Actualizar Historial</span>
            </button>
          </div>
        </section>

        {/* Tarjetas de estadísticas de auditoría */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#d6ffe8] text-[#006d44]">
              <span className="material-symbols-outlined text-[24px]">history</span>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Eventos Totales</p>
              <p className="font-headline text-2xl font-extrabold text-slate-800">{stats.total}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
              <span className="material-symbols-outlined text-[24px]">group</span>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Usuarios Activos</p>
              <p className="font-headline text-2xl font-extrabold text-purple-900">
                {stats.usuariosUnicos}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-[#006d44]">
              <span className="material-symbols-outlined text-[24px]">add_circle</span>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Creaciones</p>
              <p className="font-headline text-2xl font-extrabold text-[#006d44]">
                {stats.creaciones}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
              <span className="material-symbols-outlined text-[24px]">delete</span>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Eliminaciones</p>
              <p className="font-headline text-2xl font-extrabold text-rose-700">
                {stats.eliminaciones}
              </p>
            </div>
          </div>
        </section>

        {error && (
          <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-800">
            <span className="material-symbols-outlined text-[22px]">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Panel de datos con filtros */}
        <section className="rounded-2xl bg-[#f1f4f5] p-1">
          <div className="space-y-6 rounded-[20px] bg-white p-6 shadow-sm">
            {/* Barra de Filtros y Búsqueda */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full max-w-md">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  search
                </span>
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por usuario, elemento o detalle..."
                  className="w-full rounded-xl border-none bg-[#f1f4f5] py-3 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Selector de Usuario */}
                <div className="relative">
                  <select
                    value={filtroUsuario}
                    onChange={(e) => setFiltroUsuario(e.target.value)}
                    className="rounded-xl border-none bg-[#f1f4f5] py-2.5 pl-4 pr-10 text-xs font-bold uppercase tracking-wider text-slate-700 focus:ring-2 focus:ring-emerald-200"
                  >
                    <option value="">Todos los Usuarios</option>
                    {usuariosConActividad.map((u) => (
                      <option key={u} value={u}>
                        @{u}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filtro de Tipo de Acción */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFiltroTipoAccion('todos')}
                    className={`rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wider transition ${
                      filtroTipoAccion === 'todos'
                        ? 'bg-[#006d44] text-white shadow-sm'
                        : 'bg-[#f1f4f5] text-slate-600 hover:bg-[#e5e9eb]'
                    }`}
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroTipoAccion('create')}
                    className={`rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wider transition ${
                      filtroTipoAccion === 'create'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-[#f1f4f5] text-slate-600 hover:bg-[#e5e9eb]'
                    }`}
                  >
                    Creaciones
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroTipoAccion('delete')}
                    className={`rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wider transition ${
                      filtroTipoAccion === 'delete'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-[#f1f4f5] text-slate-600 hover:bg-[#e5e9eb]'
                    }`}
                  >
                    Bajas
                  </button>
                </div>
              </div>
            </div>

            {/* Paginación superior */}
            <div className="flex flex-col gap-3 border-y border-slate-100 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Mostrando {actividadPaginada.length ? desde + 1 : 0}-{Math.min(hasta, actividadFiltrada.length)} de{' '}
                {actividadFiltrada.length} eventos
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

            {/* Cabecera de la tabla */}
            <div className="hidden grid-cols-12 gap-4 border-b border-slate-200 bg-[#f5f7f8] px-6 py-3.5 text-xs font-bold uppercase tracking-[0.2em] text-slate-500 md:grid rounded-xl">
              <div className="col-span-2">Fecha y Hora</div>
              <div className="col-span-2">Usuario Responsable</div>
              <div className="col-span-2">Acción</div>
              <div className="col-span-2">Entidad / Elemento</div>
              <div className="col-span-4">Detalle del Registro</div>
            </div>

            {/* Cuerpo de la tabla */}
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
                  {busqueda || filtroUsuario || filtroTipoAccion !== 'todos'
                    ? 'No se encontraron registros con los filtros seleccionados.'
                    : 'Aún no se han producido eventos auditados en el sistema.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {actividadPaginada.map((item) => {
                  const username = item.actorUsername || 'Sistema';
                  const iniciales = String(username).substring(0, 2).toUpperCase();

                  return (
                    <div
                      key={item.id || `${item.createdAt}-${item.actorUsername}`}
                      className="grid grid-cols-1 gap-3 px-4 py-4 transition-colors hover:bg-[#f8faf9] md:grid-cols-12 md:items-center md:px-6"
                    >
                      {/* Fecha y Hora */}
                      <div className="md:col-span-2">
                        <p className="text-xs font-bold text-slate-800">
                          {formatearFechaHora(item.createdAt)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {formatearFechaRelativa(item.createdAt)}
                        </p>
                      </div>

                      {/* Usuario */}
                      <div className="flex items-center gap-2.5 md:col-span-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#d6ffe8] text-xs font-bold text-[#006d44]">
                          {iniciales}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            @{username}
                          </p>
                        </div>
                      </div>

                      {/* Acción */}
                      <div className="md:col-span-2">
                        {obtenerInsigniaAccion(item.actionType)}
                      </div>

                      {/* Entidad / Elemento */}
                      <div className="space-y-1 md:col-span-2">
                        {obtenerInsigniaEntidad(item.entityType)}
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {item.entityLabel || item.entityId || '-'}
                        </p>
                      </div>

                      {/* Detalle */}
                      <div className="md:col-span-4 overflow-hidden">
                        {renderizarDetalleActividad(item.details)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

