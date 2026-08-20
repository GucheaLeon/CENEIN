import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';

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
          ? 'rounded-2xl bg-white dark:bg-slate-700 text-[#006d44] dark:text-emerald-400 font-semibold shadow-sm ring-1 ring-[#d7e8de] dark:ring-slate-600'
          : 'rounded-2xl text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:text-[#006d44] dark:hover:text-emerald-400 hover:shadow-sm'
      }`}
    >
      <span className={`material-symbols-outlined text-[20px] ${activo ? 'text-[#006d44] dark:text-emerald-400' : ''}`}>{icono}</span>
      <span className="text-sm">{etiqueta}</span>
    </button>
  );
}

/* ─── Menú de perfil desplegable ─── */
function MenuPerfil({ usuario, alCerrarSesion }) {
  const { darkMode, toggleDarkMode } = useTheme();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  // Cierra al hacer click fuera
  useEffect(() => {
    function handleClickFuera(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setAbierto(false);
      }
    }
    if (abierto) {
      document.addEventListener('mousedown', handleClickFuera);
    }
    return () => document.removeEventListener('mousedown', handleClickFuera);
  }, [abierto]);

  // Cierra con Escape
  useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') setAbierto(false);
    }
    if (abierto) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [abierto]);

  const inicial = String(usuario?.nombre || 'U').trim().charAt(0).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      {/* Avatar / botón de apertura */}
      <button
        type="button"
        onClick={() => setAbierto((prev) => !prev)}
        aria-label="Abrir menú de perfil"
        aria-expanded={abierto}
        className={`flex h-10 w-10 items-center justify-center rounded-full font-bold transition-all duration-200 ring-4 ring-white dark:ring-slate-800 ${
          abierto
            ? 'bg-[#006d44] text-white scale-105 shadow-lg'
            : 'bg-[#d6ffe8] dark:bg-emerald-900 text-[#006d44] dark:text-emerald-300 hover:scale-105 hover:shadow-md'
        }`}
      >
        {inicial}
      </button>

      {/* Menú desplegable */}
      {abierto && (
        <div
          className="absolute right-0 top-[calc(100%+10px)] z-50 w-64 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl shadow-slate-200/60 dark:shadow-slate-900/60 ring-1 ring-slate-100 dark:ring-slate-700 animate-[fadeInDown_0.15s_ease-out]"
          role="menu"
          aria-label="Menú de perfil"
        >
          {/* Cabecera del menú */}
          <div className="border-b border-slate-100 dark:border-slate-700 px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#d6ffe8] dark:bg-emerald-900 font-bold text-[#006d44] dark:text-emerald-300 text-sm">
                {inicial}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                  {usuario?.nombre || 'Usuario'}
                </p>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  {usuario?.isAdmin ? 'Administrador' : 'Operador'}
                </p>
              </div>
            </div>
          </div>

          {/* Opciones */}
          <div className="p-2 space-y-0.5">

            {/* Toggle modo noche */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                toggleDarkMode();
              }}
              className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${darkMode ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300'}`}>
                  <span className="material-symbols-outlined text-[18px]">
                    {darkMode ? 'dark_mode' : 'light_mode'}
                  </span>
                </div>
                <span>{darkMode ? 'Modo Oscuro' : 'Modo Claro'}</span>
              </div>
              {/* Switch visual */}
              <div
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                  darkMode ? 'bg-indigo-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ${
                    darkMode ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
            </button>

            {/* Separador */}
            <div className="my-1 h-px bg-slate-100 dark:bg-slate-700" />

            {/* Cerrar sesión */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAbierto(false);
                alCerrarSesion();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 dark:text-rose-400 transition-colors hover:bg-rose-50 dark:hover:bg-rose-900/20"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900/30">
                <span className="material-symbols-outlined text-[18px]">logout</span>
              </div>
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Layout principal ─── */
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
    <div className="min-h-screen overflow-x-hidden bg-[#f8f9fa] dark:bg-slate-900 text-[#2d3335] dark:text-slate-100 transition-colors duration-300">
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
            className={`fixed left-0 top-0 z-50 flex h-full w-[86vw] max-w-64 flex-col border-r border-slate-200 dark:border-slate-700/60 bg-gradient-to-b from-[#f8f9fa] via-[#f8f9fa] to-[#eef4f1] dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 py-6 shadow-xl transition-all duration-300 lg:w-64 lg:max-w-none lg:translate-x-0 lg:shadow-none ${
              menuMovilAbierto ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="mb-10 flex items-center gap-3 px-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d6ffe8] dark:bg-emerald-900 text-[#006d44] dark:text-emerald-400 shadow-sm">
                <span className="material-symbols-outlined">clinical_notes</span>
              </div>
              <div>
                <h2 className="text-lg font-extrabold leading-tight text-[#006d44] dark:text-emerald-400">
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

          <div className="min-h-screen bg-[#f8f9fa] dark:bg-slate-900 transition-colors duration-300 lg:ml-64">
            <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700/60 bg-[#f8f9fa]/90 dark:bg-slate-900/90 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8 transition-colors duration-300">
              <div className="flex items-center gap-6">
                <button
                  type="button"
                  onClick={() => setMenuMovilAbierto((prev) => !prev)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-transparent p-0 text-slate-600 dark:text-slate-400 shadow-none hover:bg-[#f1f4f5] dark:hover:bg-slate-800 lg:hidden"
                >
                  <span className="material-symbols-outlined">
                    {menuMovilAbierto ? 'close' : 'menu'}
                  </span>
                </button>
                <h1 className="text-2xl font-extrabold tracking-tight text-[#006d44] dark:text-emerald-400">
                  CENEIN
                </h1>
                <div className="hidden h-6 w-px bg-slate-300 dark:bg-slate-600 md:block" />
                <div className="hidden md:block">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                    {tituloPagina}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-4">
                <div className="mx-1 hidden h-8 w-px bg-slate-300 dark:bg-slate-600 sm:block" />

                <div className="flex items-center gap-3">
                  {/* Nombre y rol */}
                  <div className="hidden text-right sm:block">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      {usuario?.nombre || 'Usuario'}
                    </p>
                    <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                      {usuario?.isAdmin ? 'Administrador' : 'Operador'}
                    </p>
                  </div>

                  {/* Avatar con menú desplegable */}
                  <MenuPerfil usuario={usuario} alCerrarSesion={alCerrarSesion} />
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

