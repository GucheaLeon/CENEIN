import React, { useEffect, useState } from 'react';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Lista de pacientes', icon: 'person_search' },
  { key: 'patients', label: 'Buscador', icon: 'search_check' },
  { key: 'attendances', label: 'Asistencias', icon: 'calendar_today' },
  { key: 'alta', label: 'Alta Pacientes', icon: 'person_add' },
  { key: 'admision', label: 'Admisión', icon: 'assignment_ind' },
  { key: 'facturacion', label: 'Facturación', icon: 'receipt_long' },
];

const ADMIN_ITEMS = [
  { key: 'users', label: 'Usuarios', icon: 'group' },
  { key: 'user-history', label: 'Historial por usuario', icon: 'history' },
];

const PAGE_TITLES = {
  dashboard: 'Lista de pacientes',
  patients: 'Buscador',
  attendances: 'Asistencias',
  alta: 'Alta Pacientes',
  admision: 'Admisión',
  facturacion: 'Facturación',
  users: 'Usuarios',
  'user-history': 'Historial por usuario',
  patient: 'Paciente',
};

function NavLink({ activo, icono, etiqueta, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-3 px-4 py-3 text-left transition-all duration-200 ${
        activo
          ? 'rounded-2xl bg-white text-[#006d44] font-semibold shadow-sm ring-1 ring-[#d7e8de]'
          : 'rounded-2xl text-slate-500 hover:bg-white hover:text-[#006d44] hover:shadow-sm'
      }`}
    >
      <span className={`material-symbols-outlined text-[20px] ${activo ? 'text-[#006d44]' : ''}`}>{icono}</span>
      <span className="text-sm">{etiqueta}</span>
    </button>
  );
}

export default function Distribucion({
  children,
  paginaActual,
  alNavegar,
  usuario,
  alCerrarSesion,
}) {
  const items = usuario?.isAdmin ? [...NAV_ITEMS, ...ADMIN_ITEMS] : NAV_ITEMS;
  const tituloPagina = PAGE_TITLES[paginaActual] || 'CENEIN';
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);

  useEffect(() => {
    setMenuMovilAbierto(false);
  }, [paginaActual]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f8f9fa] text-[#2d3335]">
      {usuario ? (
        <>
          {menuMovilAbierto ? (
            <button
              type="button"
              aria-label="Cerrar menú"
              onClick={() => setMenuMovilAbierto(false)}
              className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden"
            />
          ) : null}

          <aside
            className={`fixed left-0 top-0 z-50 flex h-full w-[86vw] max-w-64 flex-col border-r border-slate-200 bg-gradient-to-b from-[#f8f9fa] via-[#f8f9fa] to-[#eef4f1] py-6 shadow-xl transition-transform lg:w-64 lg:max-w-none lg:translate-x-0 lg:shadow-none ${
              menuMovilAbierto ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="mb-10 flex items-center gap-3 px-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d6ffe8] text-[#006d44] shadow-sm">
                <span className="material-symbols-outlined">clinical_notes</span>
              </div>
              <div>
                <h2 className="text-lg font-extrabold leading-tight text-[#006d44]">
                  CENEIN Admin
                </h2>
              </div>
            </div>

            <nav className="flex-1 space-y-2 px-4">
              {items.map((item) => (
                <NavLink
                  key={item.key}
                  activo={paginaActual === item.key}
                  icono={item.icon}
                  etiqueta={item.label}
                  onClick={() => {
                    setMenuMovilAbierto(false);
                    alNavegar(item.key);
                  }}
                />
              ))}
            </nav>

          </aside>

          <div className="min-h-screen bg-[#f8f9fa] lg:ml-64">
            <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 bg-[#f8f9fa]/90 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8">
              <div className="flex items-center gap-6">
                <button
                  type="button"
                  onClick={() => setMenuMovilAbierto((prev) => !prev)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-transparent p-0 text-slate-600 shadow-none hover:bg-[#f1f4f5] lg:hidden"
                >
                  <span className="material-symbols-outlined">
                    {menuMovilAbierto ? 'close' : 'menu'}
                  </span>
                </button>
                <h1 className="text-2xl font-extrabold tracking-tight text-[#006d44]">
                  CENEIN
                </h1>
                <div className="hidden h-6 w-px bg-slate-300 md:block" />
                <div className="hidden md:block">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                    {tituloPagina}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-4">
                <div className="mx-1 hidden h-8 w-px bg-slate-300 sm:block" />

                <div className="flex items-center gap-3">
                  <div className="hidden text-right sm:block">
                    <p className="text-sm font-bold text-slate-800">
                      {usuario?.nombre || 'Usuario'}
                    </p>
                    <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">
                      {usuario?.isAdmin ? 'Administrador' : 'Operador'}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d6ffe8] font-bold text-[#006d44] ring-4 ring-white">
                    {String(usuario?.nombre || 'U').trim().charAt(0).toUpperCase()}
                  </div>
                  <button
                    type="button"
                    onClick={alCerrarSesion}
                    className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-none transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 sm:inline-flex"
                  >
                    Salir
                  </button>
                </div>
              </div>
            </header>

            <main>{children}</main>
          </div>
        </>
      ) : (
        <main>{children}</main>
      )}
    </div>
  );
}
