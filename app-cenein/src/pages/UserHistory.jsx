import React, { useEffect, useState } from 'react';
import { obtenerActividadUsuariosApi } from '../services/api';

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

function formatearDetalleActividad(valor) {
  const raw = String(valor || '').trim();
  if (!raw) return '-';
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.tratamientos)) {
      return `Tratamientos: ${parsed.tratamientos.join(', ')}`;
    }
    if (parsed?.tratamiento && parsed?.fecha) {
      return `Tratamiento: ${parsed.tratamiento} | Fecha: ${parsed.fecha}`;
    }
    if (parsed?.tratamiento) {
      return `Tratamiento: ${parsed.tratamiento}`;
    }
    if (parsed?.dni) {
      return `DNI: ${parsed.dni}`;
    }
    if (typeof parsed?.isAdmin === 'boolean') {
      return `Admin: ${parsed.isAdmin ? 'Si' : 'No'}`;
    }
    return raw;
  } catch (err) {
    return raw;
  }
}

function formatearAccion(valor) {
  if (valor === 'create') return 'Creo';
  if (valor === 'delete') return 'Elimino';
  return String(valor || '-');
}

export default function UserHistory() {
  const [actividad, setActividad] = useState([]);
  const [filtroActividad, setFiltroActividad] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  async function cargar() {
    setCargando(true);
    setError('');
    try {
      const actividadData = await obtenerActividadUsuariosApi();
      setActividad(actividadData);
    } catch (err) {
      setError(err.message || 'No se pudo cargar el historial.');
      setActividad([]);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const actividadFiltrada = actividad.filter((item) => {
    if (!filtroActividad) return true;
    return String(item.actorUsername || '').trim().toLowerCase() === filtroActividad.toLowerCase();
  });

  const usuariosConActividad = Array.from(
    new Set(actividad.map((item) => String(item.actorUsername || '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'es'));

  return (
    <section style={{ padding: 24 }}>
      <h2>Historial por usuario</h2>
      <div style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>
          Usuario:{' '}
          <select
            value={filtroActividad}
            onChange={(e) => setFiltroActividad(e.target.value)}
          >
            <option value="">Todos</option>
            {usuariosConActividad.map((username) => (
              <option key={username} value={username}>
                {username}
              </option>
            ))}
          </select>
        </label>
        <button onClick={cargar}>Actualizar</button>
      </div>

      {error ? <div style={{ color: '#b00', marginBottom: 12 }}>{error}</div> : null}
      {cargando ? (
        <div>Cargando...</div>
      ) : !actividadFiltrada.length ? (
        <div>No hay actividad registrada.</div>
      ) : (
        <table cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th align="left">Fecha</th>
              <th align="left">Usuario</th>
              <th align="left">Accion</th>
              <th align="left">Tipo</th>
              <th align="left">Elemento</th>
              <th align="left">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {actividadFiltrada.map((item) => (
              <tr key={item.id}>
                <td>{formatearFechaHora(item.createdAt)}</td>
                <td>{item.actorUsername || '-'}</td>
                <td>{formatearAccion(item.actionType)}</td>
                <td>{item.entityType || '-'}</td>
                <td>{item.entityLabel || item.entityId || '-'}</td>
                <td>{formatearDetalleActividad(item.details)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
