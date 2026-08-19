import React, { useEffect, useMemo, useState } from 'react';
import { usePacientes } from '../context/PatientsContext';

const PACIENTES_POR_PAGINA = 12;
const MODULOS = ['MII', 'MIS', 'MIE'];
const MODULO_ESTILOS = {
  MII: {
    punto: 'bg-emerald-500',
    ficha: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  MIS: {
    punto: 'bg-amber-500',
    ficha: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  MIE: {
    punto: 'bg-sky-500',
    ficha: 'border-sky-200 bg-sky-50 text-sky-700',
  },
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

const normalizarTexto = (valor) =>
  String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

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
  return `${datos.apellido} ${datos.nombre}`.trim() || paciente?.id || '-';
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

const obtenerIniciales = (paciente) => {
  const datos = resolverNombreApellido(paciente);
  return `${datos.nombre.charAt(0)}${datos.apellido.charAt(0)}`.trim().toUpperCase() || 'P';
};

const formatearFecha = (valor) => {
  const iso = String(valor || '').slice(0, 10);
  if (!iso) return 'Sin fecha';
  const [anio, mes, dia] = iso.split('-');
  if (!anio || !mes || !dia) return iso;
  return `${dia}/${mes}/${anio.slice(-2)}`;
};

export default function PanelPrincipal({ alAbrirPaciente }) {
  const { pacientes, cambiarEstadoPaciente, cambiarBajaPaciente } = usePacientes();
  const [busqueda, setBusqueda] = useState('');
  const [filtroAutorizacion, setFiltroAutorizacion] = useState('todos');
  const [filtroModulo, setFiltroModulo] = useState('TODOS');
  const [paginaActual, setPaginaActual] = useState(1);

  const alternarFiltroAutorizacion = (destino) => {
    setBusqueda('');
    setFiltroAutorizacion((prev) => (prev === destino ? 'todos' : destino));
  };

  const pacientesFiltrados = useMemo(() => {
    const q = String(busqueda || '').trim().toLowerCase();
    const base = Array.isArray(pacientes) ? pacientes : [];
    const autorizacion = String(filtroAutorizacion || 'todos').trim();
    const moduloFiltro = String(filtroModulo || 'TODOS').trim().toUpperCase();
    const basePorAutorizacion = base.filter((p) => {
      if (autorizacion === 'autorizados') return p?.activo !== false;
      if (autorizacion === 'no_autorizados') return p?.activo === false;
      return true;
    });
    const baseFiltrada = basePorAutorizacion.filter((p) => {
      if (!moduloFiltro || moduloFiltro === 'TODOS') return true;
      return normalizarModulos(p?.modulos || p?.modulo).includes(moduloFiltro);
    });
    const filtrados = !q
      ? baseFiltrada
      : baseFiltrada.filter((p) => {
          const nombre = `${p.nombre || ''} ${p.apellido || ''}`.trim().toLowerCase();
          const obra = String(p.obraSocial || '').toLowerCase();
          const prestaciones = (p.tratamientos || []).join(' ').toLowerCase();
          return nombre.includes(q) || obra.includes(q) || prestaciones.includes(q);
        });
    return filtrados.slice().sort(compararPacientesPorApellidoNombre);
  }, [pacientes, busqueda, filtroAutorizacion, filtroModulo]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(pacientesFiltrados.length / PACIENTES_POR_PAGINA)
  );
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const desde = (paginaSegura - 1) * PACIENTES_POR_PAGINA;
  const hasta = desde + PACIENTES_POR_PAGINA;
  const pacientesPaginados = pacientesFiltrados.slice(desde, hasta);

  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda, filtroAutorizacion, filtroModulo]);

  useEffect(() => {
    if (paginaActual > totalPaginas) {
      setPaginaActual(totalPaginas);
    }
  }, [paginaActual, totalPaginas]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <nav className="mb-2 flex items-center gap-2 text-xs text-slate-400">
              <span>Administración</span>
              <span className="material-symbols-outlined text-[12px]">chevron_right</span>
              <span className="font-semibold text-[#006d44]">Lista de Pacientes</span>
            </nav>
            <h2 className="text-4xl font-extrabold tracking-tight text-[#2d3335]">
              Gestión de Pacientes
            </h2>
          </div>

          <div className="flex gap-4">
            <div className="flex items-center gap-4 rounded-2xl bg-white px-6 py-4 shadow-sm">
              <div className="text-right">
                <p className="text-xs font-medium text-slate-500">Total Pacientes</p>
                <p className="font-headline text-3xl font-extrabold text-[#006d44]">
                  {pacientesFiltrados.length}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#d6ffe8] text-[#006d44]">
                <span className="material-symbols-outlined">groups</span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-[#f1f4f5] p-1">
          <div className="space-y-6 rounded-[20px] bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full max-w-xl">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  search
                </span>
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, obra social o prestación"
                  className="w-full rounded-xl border-none bg-[#f1f4f5] py-3 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <select
                  value={filtroModulo}
                  onChange={(e) => setFiltroModulo(e.target.value)}
                  className="rounded-xl border-none bg-[#f1f4f5] px-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-200"
                >
                  <option value="TODOS">Módulo (todos)</option>
                  {MODULOS.map((m) => (
                    <option key={`dash-mod-${m}`} value={m}>
                      {m}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => alternarFiltroAutorizacion('autorizados')}
                  className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    filtroAutorizacion === 'autorizados'
                      ? 'bg-[#e4f9bd] text-[#4f6032]'
                      : 'bg-[#f1f4f5] text-slate-600 hover:bg-[#e5e9eb]'
                  }`}
                >
                  Autorizados
                </button>
                <button
                  type="button"
                  onClick={() => alternarFiltroAutorizacion('no_autorizados')}
                  className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    filtroAutorizacion === 'no_autorizados'
                      ? 'bg-[#ffe0df] text-[#a83836]'
                      : 'bg-[#f1f4f5] text-slate-600 hover:bg-[#e5e9eb]'
                  }`}
                >
                  No autorizados
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-4 border-y border-slate-200 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-8">
              <span className="text-xs font-medium text-slate-500">
                Mostrando {pacientesPaginados.length ? desde + 1 : 0}-{Math.min(hasta, pacientesFiltrados.length)} de{' '}
                {pacientesFiltrados.length} pacientes
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                  disabled={paginaSegura === 1}
                  className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-[#f1f4f5] disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  Anterior
                </button>
                <span className="rounded-lg bg-[#006d44] px-3 py-2 text-xs font-bold text-white">
                  {paginaSegura}
                </span>
                <button
                  type="button"
                  onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                  disabled={paginaSegura === totalPaginas}
                  className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold text-[#006d44] transition hover:bg-[#ecfdf5] disabled:opacity-50"
                >
                  Siguiente
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
              </div>
            </div>

            <div className="hidden grid-cols-12 gap-4 border-b border-slate-200 bg-[#f5f7f8] px-8 py-4 text-xs font-bold uppercase tracking-[0.22em] text-slate-500 md:grid">
              <div className="col-span-5">Nombre y Perfil</div>
              <div className="col-span-3">Obra Social</div>
              <div className="col-span-2">Estado</div>
              <div className="col-span-2 text-right">Acciones</div>
            </div>

            <div className="divide-y divide-slate-200">
              {pacientesPaginados.map((p) => {
                const ingreso = formatearFecha(p?.fechaNacimiento);
                const noAutorizado = p?.activo === false;
                const dadoDeBaja = p?.dadoDeBaja === true;
                const modulosPaciente = normalizarModulos(p?.modulos || p?.modulo);
                return (
                  <div
                    key={p.id}
                    className="grid grid-cols-1 gap-4 px-4 py-4 transition-colors hover:bg-[#f8faf9] md:grid-cols-12 md:items-center md:px-8"
                  >
                    <div className="flex items-center gap-4 md:col-span-5">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#d0e8d6] font-bold text-[#006d44]">
                        {obtenerIniciales(p)}
                      </div>
                      <div>
                        <p className="font-bold text-[#2d3335]">{formatearEtiquetaPaciente(p)}</p>
                        <p className="text-sm text-slate-500">
                          {p.edad ?? '-'} años • Fecha de nacimiento: {ingreso}
                        </p>
                      </div>
                    </div>

                    <div className="md:col-span-3">
                      <p className="text-sm font-medium text-[#4f6456]">
                        {p.obraSocial || 'Sin obra social'}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {modulosPaciente.length ? (
                          modulosPaciente.map((modulo) => (
                            <span
                              key={`dashboard-modulo-${p.id}-${modulo}`}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                                clasesModulo(modulo).ficha
                              }`}
                            >
                              <span
                                className={`h-2.5 w-2.5 rounded-[4px] ${clasesModulo(modulo).punto}`}
                              />
                              {modulo}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs font-medium text-slate-400">Sin módulos</span>
                        )}
                      </div>
                    </div>

                    <div className="md:col-span-2 flex flex-col gap-1.5 items-start">
                      {dadoDeBaja ? (
                        <span className="rounded-full bg-[#fff1cc] px-3 py-1 text-[11px] font-bold uppercase tracking-tight text-[#92400e]">
                          Baja
                        </span>
                      ) : (
                        <>
                          <span className="rounded-full bg-blue-100 px-3 py-1 text-[11px] font-bold uppercase tracking-tight text-blue-800">
                            {String(p.patient_state_name || 'Nuevo').replace('_', ' ')}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-tight ${
                              noAutorizado
                                ? 'bg-[#ffe0df] text-[#a83836]'
                                : 'bg-[#e4f9bd] text-[#4f6032]'
                            }`}
                          >
                            {noAutorizado ? 'Pendiente' : 'Autorizado'}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 md:col-span-2 md:justify-end">
                      <button
                        type="button"
                        title="No autorizar"
                        onClick={() => cambiarEstadoPaciente(p.id, p.activo === false)}
                        className="rounded-lg bg-[#ffe8e7] p-2 text-[#a83836] transition hover:bg-[#fa746f] hover:text-white"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          block
                        </span>
                      </button>
                      <button
                        type="button"
                        title="Dar de baja"
                        onClick={() => cambiarBajaPaciente(p.id, p.dadoDeBaja !== true)}
                        className="rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-600 hover:text-white"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          person_off
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => alAbrirPaciente(p.id)}
                        className="rounded-lg bg-[#006d44] px-4 py-2 text-xs font-bold text-white transition hover:opacity-90"
                      >
                        Ver detalle
                      </button>
                    </div>
                  </div>
                );
              })}

              {!pacientesFiltrados.length ? (
                <div className="px-4 py-12 text-center text-sm text-slate-500 md:px-8">
                  No hay pacientes para ese filtro.
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-xl border-l-4 border-[#006d44] bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center gap-3">
              <span className="material-symbols-outlined text-[#006d44]">info</span>
              <h4 className="text-sm font-bold text-[#2d3335]">Vista General</h4>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Utiliza los filtros para separar rápidamente pacientes autorizados, pendientes o por
              módulo sin salir de la grilla principal.
            </p>
          </div>
          <div className="rounded-xl border-l-4 border-[#546537] bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center gap-3">
              <span className="material-symbols-outlined text-[#546537]">task_alt</span>
              <h4 className="text-sm font-bold text-[#2d3335]">Seguimiento</h4>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Desde esta lista podés autorizar, marcar baja o abrir el detalle completo de cada
              paciente sin perder contexto.
            </p>
          </div>
          <div className="rounded-xl border-l-4 border-[#4f6456] bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center gap-3">
              <span className="material-symbols-outlined text-[#4f6456]">shield</span>
              <h4 className="text-sm font-bold text-[#2d3335]">Trazabilidad</h4>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Los cambios administrativos siguen usando la misma lógica actual del sistema; este
              ajuste es visual y conserva el comportamiento existente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
