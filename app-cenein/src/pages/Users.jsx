import React, { useEffect, useState } from 'react';
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
    timeStyle: 'medium',
  }).format(date);
}

export default function Users() {
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosBloqueados, setUsuariosBloqueados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: '', password: '', isAdmin: false });

  async function cargar() {
    setCargando(true);
    setError('');
    try {
      const usuariosData = await obtenerUsuariosApi();
      setUsuarios(usuariosData);
      try {
        const bloqueadosData = await obtenerUsuariosBloqueadosApi();
        setUsuariosBloqueados(bloqueadosData);
      } catch (err) {
        setUsuariosBloqueados([]);
      }
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los usuarios.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crear(e) {
    e.preventDefault();
    setError('');
    try {
      await crearUsuarioApi(form);
      setForm({ username: '', password: '', isAdmin: false });
      await cargar();
    } catch (err) {
      setError(err.message || 'No se pudo crear el usuario.');
    }
  }

  async function toggleAdmin(usuario) {
    setError('');
    try {
      await actualizarUsuarioApi(usuario.id, { isAdmin: !usuario.isAdmin });
      await cargar();
    } catch (err) {
      setError(err.message || 'No se pudo actualizar permisos.');
    }
  }

  async function resetPassword(usuario) {
    const nueva = window.prompt(`Nueva password para ${usuario.username} (min 8 caracteres):`, '');
    if (!nueva) return;
    setError('');
    try {
      await actualizarUsuarioApi(usuario.id, { password: nueva });
      window.alert('Password actualizada.');
    } catch (err) {
      setError(err.message || 'No se pudo actualizar password.');
    }
  }

  async function eliminar(usuario) {
    if (!window.confirm(`Eliminar usuario ${usuario.username}?`)) return;
    setError('');
    try {
      await eliminarUsuarioApi(usuario.id);
      await cargar();
    } catch (err) {
      setError(err.message || 'No se pudo eliminar el usuario.');
    }
  }

  async function desbloquear(username) {
    setError('');
    try {
      await desbloquearUsuarioApi(username);
      await cargar();
    } catch (err) {
      setError(err.message || 'No se pudo desbloquear el usuario.');
    }
  }

  const grupoAccionesStyle = {
    display: 'inline-flex',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    padding: 8,
    border: '1px solid #d7e8de',
    borderRadius: 12,
    background: '#f8fbf9',
  };

  const botonAccionStyle = {
    border: '1px solid #cfe3d8',
    borderRadius: 10,
    background: '#ffffff',
    padding: '6px 10px',
    cursor: 'pointer',
  };

  return (
    <section style={{ padding: 24 }}>
      <h2>Usuarios</h2>
      <form onSubmit={crear} style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          placeholder="username"
          value={form.username}
          onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
        />
        <input
          type="password"
          placeholder="password (min 8)"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
        />
        <label>
          <input
            type="checkbox"
            checked={form.isAdmin}
            onChange={(e) => setForm((f) => ({ ...f, isAdmin: e.target.checked }))}
          />{' '}
          admin
        </label>
        <button type="submit">Crear usuario</button>
      </form>

      {error ? <div style={{ color: '#b00', marginBottom: 12 }}>{error}</div> : null}
      {cargando ? (
        <div>Cargando...</div>
      ) : (
        <>
          <table cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 24 }}>
            <thead>
              <tr>
                <th align="left">Usuario</th>
                <th align="left">Admin</th>
                <th align="left">Creado</th>
                <th align="left">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.isAdmin ? 'Si' : 'No'}</td>
                  <td>{formatearFechaHora(u.createdAt)}</td>
                  <td>
                    <div style={grupoAccionesStyle}>
                      <button onClick={() => toggleAdmin(u)} style={botonAccionStyle}>
                        {u.isAdmin ? 'Quitar admin' : 'Hacer admin'}
                      </button>
                      <button onClick={() => resetPassword(u)} style={botonAccionStyle}>
                        Cambiar password
                      </button>
                      <button
                        onClick={() => eliminar(u)}
                        style={{ ...botonAccionStyle, borderColor: '#f0c7c7', color: '#b42318' }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>Usuarios bloqueados</h3>
          {!usuariosBloqueados.length ? (
            <div>No hay usuarios bloqueados.</div>
          ) : (
            <table cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th align="left">Usuario</th>
                  <th align="left">Intentos</th>
                  <th align="left">Bloqueado hasta</th>
                  <th align="left">Ultima actualizacion</th>
                  <th align="left">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuariosBloqueados.map((u) => (
                  <tr key={u.username}>
                    <td>{u.username}</td>
                    <td>{u.failedCount}</td>
                    <td>{formatearFechaHora(u.blockedUntil)}</td>
                    <td>{formatearFechaHora(u.updatedAt)}</td>
                    <td>
                      <button onClick={() => desbloquear(u.username)}>Desbloquear</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}

