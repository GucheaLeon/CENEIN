import React, { useEffect, useMemo, useState } from 'react';
import {
  obtenerUsuariosApi,
  obtenerUsuariosBloqueadosApi,
  crearUsuarioApi,
  actualizarUsuarioApi,
  eliminarUsuarioApi,
  desbloquearUsuarioApi,
} from '../services/api';

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

export default function Users() {
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosBloqueados, setUsuariosBloqueados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [notificacion, setNotificacion] = useState({ tipo: '', mensaje: '' });

  // Filtros y búsqueda
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('todos'); // 'todos' | 'admin' | 'operador' | 'bloqueado'

  // Formulario nuevo usuario
  const [mostrarFormCrear, setMostrarFormCrear] = useState(false);
  const [mostrarPasswordNuevo, setMostrarPasswordNuevo] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', isAdmin: false });

  // Modal cambio de contraseña
  const [usuarioParaPassword, setUsuarioParaPassword] = useState(null);
  const [nuevoPassword, setNuevoPassword] = useState('');
  const [mostrarPasswordCambio, setMostrarPasswordCambio] = useState(false);
  const [guardandoPassword, setGuardandoPassword] = useState(false);
  const [errorPasswordModal, setErrorPasswordModal] = useState('');

  // Modal confirmar eliminación
  const [usuarioParaEliminar, setUsuarioParaEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  // Modal confirmar cambio de rol
  const [usuarioParaRol, setUsuarioParaRol] = useState(null);
  const [cambiandoRol, setCambiandoRol] = useState(false);

  const mostrarNotif = (tipo, mensaje) => {
    setNotificacion({ tipo, mensaje });
    setTimeout(() => {
      setNotificacion({ tipo: '', mensaje: '' });
    }, 4500);
  };

  async function cargar() {
    setCargando(true);
    setError('');
    try {
      const usuariosData = await obtenerUsuariosApi();
      setUsuarios(Array.isArray(usuariosData) ? usuariosData : []);
      try {
        const bloqueadosData = await obtenerUsuariosBloqueadosApi();
        setUsuariosBloqueados(Array.isArray(bloqueadosData) ? bloqueadosData : []);
      } catch (err) {
        setUsuariosBloqueados([]);
      }
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los usuarios del sistema.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  // Set de usernames bloqueados para consulta rápida
  const setBloqueados = useMemo(() => {
    return new Set(usuariosBloqueados.map((u) => String(u.username || '').toLowerCase()));
  }, [usuariosBloqueados]);

  // Contadores
  const stats = useMemo(() => {
    const total = usuarios.length;
    const admins = usuarios.filter((u) => u.isAdmin).length;
    const operadores = total - admins;
    const bloqueados = usuariosBloqueados.length;
    return { total, admins, operadores, bloqueados };
  }, [usuarios, usuariosBloqueados]);

  // Filtrado de usuarios
  const usuariosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return usuarios.filter((u) => {
      const username = String(u.username || '').toLowerCase();
      const coincideBusqueda = !q || username.includes(q);
      if (!coincideBusqueda) return false;

      const estaBloqueado = setBloqueados.has(username);
      if (filtroRol === 'admin') return Boolean(u.isAdmin);
      if (filtroRol === 'operador') return !u.isAdmin;
      if (filtroRol === 'bloqueado') return estaBloqueado;
      return true;
    });
  }, [usuarios, busqueda, filtroRol, setBloqueados]);

  async function crear(e) {
    e.preventDefault();
    if (!form.username.trim()) {
      setError('El nombre de usuario es obligatorio.');
      return;
    }
    if (!form.password || form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setError('');
    setGuardando(true);
    try {
      await crearUsuarioApi({
        username: form.username.trim(),
        password: form.password,
        isAdmin: form.isAdmin,
      });
      setForm({ username: '', password: '', isAdmin: false });
      setMostrarFormCrear(false);
      mostrarNotif('exito', `Usuario @${form.username.trim()} creado exitosamente.`);
      await cargar();
    } catch (err) {
      setError(err.message || 'No se pudo crear el usuario.');
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarCambioRol() {
    if (!usuarioParaRol) return;
    setCambiandoRol(true);
    try {
      await actualizarUsuarioApi(usuarioParaRol.id, { isAdmin: !usuarioParaRol.isAdmin });
      mostrarNotif(
        'exito',
        `Permisos de @${usuarioParaRol.username} actualizados a ${!usuarioParaRol.isAdmin ? 'Administrador' : 'Operador'}.`
      );
      setUsuarioParaRol(null);
      await cargar();
    } catch (err) {
      mostrarNotif('error', err.message || 'No se pudieron actualizar los permisos.');
    } finally {
      setCambiandoRol(false);
    }
  }

  async function confirmarResetPassword(e) {
    e.preventDefault();
    if (!nuevoPassword || nuevoPassword.length < 8) {
      setErrorPasswordModal('La contraseña debe contener un mínimo de 8 caracteres.');
      return;
    }
    setErrorPasswordModal('');
    setGuardandoPassword(true);
    try {
      await actualizarUsuarioApi(usuarioParaPassword.id, { password: nuevoPassword });
      mostrarNotif('exito', `Contraseña de @${usuarioParaPassword.username} actualizada con éxito.`);
      setUsuarioParaPassword(null);
      setNuevoPassword('');
    } catch (err) {
      setErrorPasswordModal(err.message || 'No se pudo actualizar la contraseña.');
    } finally {
      setGuardandoPassword(false);
    }
  }

  async function confirmarEliminar() {
    if (!usuarioParaEliminar) return;
    setEliminando(true);
    try {
      await eliminarUsuarioApi(usuarioParaEliminar.id);
      mostrarNotif('exito', `Usuario @${usuarioParaEliminar.username} eliminado correctamente.`);
      setUsuarioParaEliminar(null);
      await cargar();
    } catch (err) {
      mostrarNotif('error', err.message || 'No se pudo eliminar el usuario.');
    } finally {
      setEliminando(false);
    }
  }

  async function desbloquear(username) {
    try {
      await desbloquearUsuarioApi(username);
      mostrarNotif('exito', `Usuario @${username} desbloqueado exitosamente.`);
      await cargar();
    } catch (err) {
      mostrarNotif('error', err.message || 'No se pudo desbloquear el usuario.');
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Encabezado y migas de pan */}
        <section className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <nav className="mb-2 flex items-center gap-2 text-xs text-slate-400">
              <span>Administración</span>
              <span className="material-symbols-outlined text-[12px]">chevron_right</span>
              <span className="font-semibold text-[#006d44]">Gestión de Usuarios</span>
            </nav>
            <h2 className="text-3xl font-extrabold tracking-tight text-[#2d3335] sm:text-4xl">
              Usuarios del Sistema
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Administrá las cuentas de acceso, roles, niveles de privilegios y seguridad.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={cargar}
              disabled={cargando}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              title="Refrescar lista"
            >
              <span className={`material-symbols-outlined text-[18px] ${cargando ? 'animate-spin' : ''}`}>
                refresh
              </span>
              <span>Actualizar</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMostrarFormCrear((prev) => !prev);
                setError('');
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#006d44] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#005837]"
            >
              <span className="material-symbols-outlined text-[20px]">
                {mostrarFormCrear ? 'close' : 'person_add'}
              </span>
              <span>{mostrarFormCrear ? 'Cerrar formulario' : 'Nuevo Usuario'}</span>
            </button>
          </div>
        </section>

        {/* Notificación flotante / inline */}
        {notificacion.mensaje ? (
          <div
            className={`flex items-center justify-between gap-3 rounded-2xl px-5 py-4 text-sm font-medium shadow-sm transition-all ${
              notificacion.tipo === 'exito'
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[22px]">
                {notificacion.tipo === 'exito' ? 'check_circle' : 'error'}
              </span>
              <span>{notificacion.mensaje}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotificacion({ tipo: '', mensaje: '' })}
              className="text-slate-400 hover:text-slate-600"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        ) : null}

        {/* Tarjetas de estadísticas */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#d6ffe8] text-[#006d44]">
              <span className="material-symbols-outlined text-[24px]">group</span>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Total Usuarios</p>
              <p className="font-headline text-2xl font-extrabold text-slate-800">{stats.total}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
              <span className="material-symbols-outlined text-[24px]">admin_panel_settings</span>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Administradores</p>
              <p className="font-headline text-2xl font-extrabold text-purple-900">{stats.admins}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <span className="material-symbols-outlined text-[24px]">badge</span>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Operadores</p>
              <p className="font-headline text-2xl font-extrabold text-blue-900">{stats.operadores}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                stats.bloqueados > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <span className="material-symbols-outlined text-[24px]">
                {stats.bloqueados > 0 ? 'lock' : 'lock_open'}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Bloqueados</p>
              <p
                className={`font-headline text-2xl font-extrabold ${
                  stats.bloqueados > 0 ? 'text-rose-700' : 'text-slate-800'
                }`}
              >
                {stats.bloqueados}
              </p>
            </div>
          </div>
        </section>

        {/* Formulario desplegable para creación de nuevo usuario */}
        {mostrarFormCrear && (
          <section className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50/70 via-white to-white p-6 shadow-md transition-all">
            <div className="mb-6 flex items-center justify-between border-b border-emerald-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#006d44] text-white">
                  <span className="material-symbols-outlined text-[20px]">person_add</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Dar de alta nuevo usuario</h3>
                  <p className="text-xs text-slate-500">
                    Completá los datos para conceder acceso a la plataforma.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMostrarFormCrear(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {error && (
              <div className="mb-6 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <span className="material-symbols-outlined text-[20px]">error</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={crear} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Nombre de usuario
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      account_circle
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="ej. juan.perez"
                      value={form.username}
                      onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400">
                    Identificador único para iniciar sesión.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Contraseña
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      key
                    </span>
                    <input
                      type={mostrarPasswordNuevo ? 'text' : 'password'}
                      required
                      placeholder="Mínimo 8 caracteres"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-11 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarPasswordNuevo((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {mostrarPasswordNuevo ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400">
                    Debe incluir al menos 8 caracteres seguros.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4">
                <label className="flex cursor-pointer items-start gap-4">
                  <input
                    type="checkbox"
                    checked={form.isAdmin}
                    onChange={(e) => setForm((f) => ({ ...f, isAdmin: e.target.checked }))}
                    className="mt-1 h-5 w-5 rounded border-slate-300 text-[#006d44] focus:ring-[#006d44]"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-800">
                      Rol de Administrador
                    </span>
                    <p className="text-xs text-slate-500">
                      Permite gestionar otros usuarios, ver historiales de auditoría completos y modificar configuraciones avanzadas del sistema.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setMostrarFormCrear(false)}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#006d44] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#005837] disabled:opacity-50"
                >
                  {guardando ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                      <span>Creando...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      <span>Guardar Usuario</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Panel principal de tabla con filtros */}
        <section className="rounded-2xl bg-[#f1f4f5] p-1">
          <div className="space-y-6 rounded-[20px] bg-white p-6 shadow-sm">
            {/* Barra de búsqueda y selector de rol */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full max-w-md">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  search
                </span>
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar usuario por nombre de cuenta..."
                  className="w-full rounded-xl border-none bg-[#f1f4f5] py-3 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFiltroRol('todos')}
                  className={`rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                    filtroRol === 'todos'
                      ? 'bg-[#006d44] text-white shadow-sm'
                      : 'bg-[#f1f4f5] text-slate-600 hover:bg-[#e5e9eb]'
                  }`}
                >
                  Todos ({stats.total})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroRol('admin')}
                  className={`rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                    filtroRol === 'admin'
                      ? 'bg-purple-700 text-white shadow-sm'
                      : 'bg-[#f1f4f5] text-slate-600 hover:bg-[#e5e9eb]'
                  }`}
                >
                  Admins ({stats.admins})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroRol('operador')}
                  className={`rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                    filtroRol === 'operador'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-[#f1f4f5] text-slate-600 hover:bg-[#e5e9eb]'
                  }`}
                >
                  Operadores ({stats.operadores})
                </button>
                {stats.bloqueados > 0 && (
                  <button
                    type="button"
                    onClick={() => setFiltroRol('bloqueado')}
                    className={`rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                      filtroRol === 'bloqueado'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    Bloqueados ({stats.bloqueados})
                  </button>
                )}
              </div>
            </div>

            {/* Cabecera de la tabla */}
            <div className="hidden grid-cols-12 gap-4 border-b border-slate-200 bg-[#f5f7f8] px-6 py-3.5 text-xs font-bold uppercase tracking-[0.2em] text-slate-500 md:grid rounded-xl">
              <div className="col-span-4">Usuario</div>
              <div className="col-span-2">Rol / Permisos</div>
              <div className="col-span-2">Estado</div>
              <div className="col-span-2">Fecha de Alta</div>
              <div className="col-span-2 text-right">Acciones</div>
            </div>

            {/* Cuerpo de la tabla */}
            {cargando ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <span className="material-symbols-outlined animate-spin text-[36px] text-[#006d44]">
                  progress_activity
                </span>
                <p className="mt-3 text-sm font-medium">Cargando usuarios...</p>
              </div>
            ) : usuariosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <span className="material-symbols-outlined text-[28px]">search_off</span>
                </div>
                <p className="text-base font-bold text-slate-700">No se encontraron usuarios</p>
                <p className="text-xs text-slate-400">
                  {busqueda
                    ? 'Probá ajustando el término de búsqueda o cambiando el filtro.'
                    : 'No hay usuarios registrados bajo esta categoría.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {usuariosFiltrados.map((u) => {
                  const estaBloqueado = setBloqueados.has(String(u.username || '').toLowerCase());
                  const iniciales = String(u.username || 'U')
                    .substring(0, 2)
                    .toUpperCase();

                  return (
                    <div
                      key={u.id || u.username}
                      className="grid grid-cols-1 gap-4 px-4 py-4 transition-colors hover:bg-[#f8faf9] md:grid-cols-12 md:items-center md:px-6"
                    >
                      {/* Usuario y Avatar */}
                      <div className="flex items-center gap-3.5 md:col-span-4">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-bold tracking-wider ${
                            u.isAdmin
                              ? 'bg-purple-100 text-purple-800 ring-2 ring-purple-200'
                              : 'bg-[#d6ffe8] text-[#006d44] ring-2 ring-emerald-100'
                          }`}
                        >
                          {iniciales}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm md:text-base">
                            {u.username}
                          </p>
                          <p className="text-xs text-slate-400">ID: {u.id || '-'}</p>
                        </div>
                      </div>

                      {/* Rol */}
                      <div className="md:col-span-2">
                        {u.isAdmin ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800">
                            <span className="material-symbols-outlined text-[14px]">shield_person</span>
                            Administrador
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            <span className="material-symbols-outlined text-[14px]">person</span>
                            Operador
                          </span>
                        )}
                      </div>

                      {/* Estado (Activo / Bloqueado) */}
                      <div className="md:col-span-2">
                        {estaBloqueado ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800">
                            <span className="material-symbols-outlined text-[14px]">lock</span>
                            Bloqueado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e4f9bd] px-3 py-1 text-xs font-bold text-[#4f6032]">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Activo
                          </span>
                        )}
                      </div>

                      {/* Fecha de Creación */}
                      <div className="md:col-span-2">
                        <p className="text-xs font-medium text-slate-700">
                          {formatearFechaHora(u.createdAt)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {formatearFechaRelativa(u.createdAt)}
                        </p>
                      </div>

                      {/* Botones de acción */}
                      <div className="flex items-center gap-1.5 md:col-span-2 md:justify-end">
                        <button
                          type="button"
                          onClick={() => setUsuarioParaRol(u)}
                          title={u.isAdmin ? 'Cambiar a Operador' : 'Promover a Administrador'}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-purple-100 hover:text-purple-800"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {u.isAdmin ? 'arrow_downward' : 'arrow_upward'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setUsuarioParaPassword(u);
                            setNuevoPassword('');
                            setErrorPasswordModal('');
                          }}
                          title="Cambiar contraseña"
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-emerald-100 hover:text-[#006d44]"
                        >
                          <span className="material-symbols-outlined text-[18px]">key</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setUsuarioParaEliminar(u)}
                          title="Eliminar usuario"
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-rose-100 hover:text-rose-700"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Sección de Usuarios Bloqueados (con detalles de intentos y desbloqueo) */}
        {usuariosBloqueados.length > 0 && (
          <section className="rounded-2xl border border-rose-200 bg-rose-50/40 p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 text-white">
                  <span className="material-symbols-outlined text-[20px]">lock_clock</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-rose-950">
                    Cuentas Bloqueadas por Seguridad ({usuariosBloqueados.length})
                  </h3>
                  <p className="text-xs text-rose-700">
                    Usuarios que superaron el límite de intentos de inicio de sesión fallidos.
                  </p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-rose-200/60 rounded-xl bg-white shadow-sm ring-1 ring-rose-200/80">
              {usuariosBloqueados.map((b) => (
                <div
                  key={b.username}
                  className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-800 font-bold">
                      {String(b.username || 'U').substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">@{b.username}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="font-semibold text-rose-700">
                          Intentos fallidos: {b.failedCount ?? '-'}
                        </span>
                        <span>•</span>
                        <span>Bloqueado hasta: {formatearFechaHora(b.blockedUntil)}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => desbloquear(b.username)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700"
                  >
                    <span className="material-symbols-outlined text-[16px]">lock_open</span>
                    <span>Desbloquear cuenta</span>
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tarjetas informativas inferiores de buenas prácticas */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-2xl border-l-4 border-[#006d44] bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-2.5 text-[#006d44]">
              <span className="material-symbols-outlined text-[20px]">verified_user</span>
              <h4 className="text-sm font-bold text-slate-800">Política de Acceso</h4>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Los usuarios con rol Administrador tienen control total sobre historias clínicas, facturación y trazabilidad.
            </p>
          </div>
          <div className="rounded-2xl border-l-4 border-amber-500 bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-2.5 text-amber-600">
              <span className="material-symbols-outlined text-[20px]">lock_reset</span>
              <h4 className="text-sm font-bold text-slate-800">Seguridad de Claves</h4>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Todas las contraseñas deben contener al menos 8 caracteres y se almacenan con hashing seguro en el servidor.
            </p>
          </div>
          <div className="rounded-2xl border-l-4 border-blue-500 bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-2.5 text-blue-600">
              <span className="material-symbols-outlined text-[20px]">history_edu</span>
              <h4 className="text-sm font-bold text-slate-800">Auditoría Permanente</h4>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Cualquier alta, baja o modificación de usuario queda registrada en la pestaña de Historial por usuario.
            </p>
          </div>
        </div>
      </div>

      {/* Modal: Cambiar Contraseña */}
      {usuarioParaPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl transition-all">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-[#006d44]">
                  <span className="material-symbols-outlined text-[20px]">key</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Cambiar Contraseña</h3>
                  <p className="text-xs text-slate-500">Usuario: @{usuarioParaPassword.username}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUsuarioParaPassword(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {errorPasswordModal && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{errorPasswordModal}</span>
              </div>
            )}

            <form onSubmit={confirmarResetPassword} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Nueva Contraseña
                </label>
                <div className="relative">
                  <input
                    type={mostrarPasswordCambio ? 'text' : 'password'}
                    required
                    placeholder="Mínimo 8 caracteres"
                    value={nuevoPassword}
                    onChange={(e) => setNuevoPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-3.5 pr-10 text-sm text-slate-800 focus:bg-white focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarPasswordCambio((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {mostrarPasswordCambio ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Recomendamos combinar letras, números y símbolos.
                </p>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setUsuarioParaPassword(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoPassword}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#006d44] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#005837] disabled:opacity-50"
                >
                  {guardandoPassword ? 'Guardando...' : 'Actualizar Contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Cambio de Rol */}
      {usuarioParaRol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl transition-all">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-100 text-purple-800">
                <span className="material-symbols-outlined text-[24px]">manage_accounts</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Cambiar Rol de Usuario</h3>
                <p className="text-xs text-slate-500">@{usuarioParaRol.username}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-6">
              ¿Estás seguro de cambiar el rol de este usuario a{' '}
              <strong className="text-slate-900">
                {usuarioParaRol.isAdmin ? 'Operador Estándar' : 'Administrador'}
              </strong>
              ?
            </p>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setUsuarioParaRol(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarCambioRol}
                disabled={cambiandoRol}
                className="inline-flex items-center gap-2 rounded-xl bg-purple-700 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-purple-800 disabled:opacity-50"
              >
                {cambiandoRol ? 'Modificando...' : 'Confirmar Cambio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Eliminación */}
      {usuarioParaEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl transition-all">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                <span className="material-symbols-outlined text-[24px]">warning</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Eliminar Cuenta</h3>
                <p className="text-xs text-slate-500">Acción irreversible</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-6">
              ¿Confirmás que querés eliminar la cuenta de{' '}
              <strong className="text-slate-900">@{usuarioParaEliminar.username}</strong>? Este
              usuario perderá el acceso inmediatamente.
            </p>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setUsuarioParaEliminar(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEliminar}
                disabled={eliminando}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
              >
                {eliminando ? 'Eliminando...' : 'Eliminar Usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


