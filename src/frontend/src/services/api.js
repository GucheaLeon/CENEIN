const TOKEN_STORAGE_KEY = 'cenein_token';
const API_BASE_URL = '';

function obtenerApiBaseUrl() {
  if (typeof window !== 'undefined' && window.APP_CONFIG) {
    const runtimeUrl = String(window.APP_CONFIG.API_URL || '').trim().replace(/\/+$/, '');
    if (runtimeUrl) return runtimeUrl;
  }
  return API_BASE_URL;
}

export function obtenerToken() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return '';
    return String(window.localStorage.getItem(TOKEN_STORAGE_KEY) || '');
  } catch (err) {
    return '';
  }
}

export function guardarToken(token) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const limpio = String(token || '').trim();
    if (!limpio) {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(TOKEN_STORAGE_KEY, limpio);
  } catch (err) {}
}

export function limpiarToken() {
  guardarToken('');
}

export async function iniciarSesionApi({ username, password }) {
  const payload = {
    username: String(username || '').trim(),
    password: String(password || '').trim(),
  };
  limpiarToken();
  const data = await fetchJsonApi('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  // Guardar token en localStorage para que funcione en Safari/iOS donde la cookie
  // puede no persistir (ITP, modo privado, PWA, etc.). Las peticiones usan Authorization.
  const token = data && (data.token ?? data.accessToken ?? data.access_token);
  if (token) guardarToken(token);
  return data;
}

export async function cerrarSesionApi() {
  try {
    await fetchJsonApi('/api/auth/logout', {
      method: 'POST',
    });
  } catch (err) {
    // Si la sesion ya expiro, seguimos limpiando estado local.
  } finally {
    limpiarToken();
  }
}

export async function obtenerUsuarioActualApi(opciones = {}) {
  const headers = new Headers(opciones.headers || {});
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-cache');
  if (!headers.has('Pragma')) headers.set('Pragma', 'no-cache');
  try {
    const data = await fetchJsonApi('/api/auth/me', {
      ...opciones,
      headers,
    });
    return data;
  } catch (err) {
    return null;
  }
}

export function resolverApiUrl(path) {
  if (typeof path !== 'string' || !path.startsWith('/api/')) return null;
  const apiBaseUrl = obtenerApiBaseUrl();
  if (apiBaseUrl) return `${apiBaseUrl}${path}`;
  return null;
}

async function fetchJsonApi(path, opciones = {}) {
  const apiUrl = resolverApiUrl(path);
  const urls = apiUrl && apiUrl !== path ? [apiUrl, path] : [path];

  const headers = new Headers(opciones.headers || {});
  const token = obtenerToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let lastError = null;
  for (const url of urls) {
    try {
      const respuesta = await fetch(url, {
        ...opciones,
        headers,
        credentials: 'include',
        cache: 'no-store',
      });
      if (!respuesta.ok) {
        let detalle = '';
        let errorData = null;
        try {
          const data = await respuesta.json();
          errorData = data;
          if (data && data.error) detalle = String(data.error);
        } catch (err) {}
        const error = new Error(detalle || `HTTP ${respuesta.status}`);
        error.status = respuesta.status;
        if (errorData && typeof errorData === 'object') {
          if (errorData.retryAfterSeconds != null) {
            error.retryAfterSeconds = Number(errorData.retryAfterSeconds);
          }
          error.data = errorData;
        }
        throw error;
      }
      return await respuesta.json();
    } catch (err) {
      lastError = err;
      if (opciones && opciones.signal && opciones.signal.aborted) {
        throw err;
      }
      if (err.status) {
        throw err;
      }
    }
  }
  throw lastError || new Error('No se pudo conectar a la API.');
}

async function fetchBlobApi(path, opciones = {}) {
  const apiUrl = resolverApiUrl(path);
  const urls = apiUrl && apiUrl !== path ? [apiUrl, path] : [path];

  const headers = new Headers(opciones.headers || {});
  const token = obtenerToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let lastError = null;
  for (const url of urls) {
    try {
      const respuesta = await fetch(url, {
        ...opciones,
        headers,
        credentials: 'include',
        cache: 'no-store',
      });
      if (!respuesta.ok) {
        let detalle = '';
        try {
          const data = await respuesta.json();
          if (data && data.error) detalle = `: ${data.error}`;
        } catch (err) {}
        const error = new Error(`HTTP ${respuesta.status}${detalle}`);
        error.status = respuesta.status;
        throw error;
      }
      return await respuesta.blob();
    } catch (err) {
      lastError = err;
      if (opciones && opciones.signal && opciones.signal.aborted) throw err;
      if (err.status) throw err;
    }
  }
  throw lastError || new Error('No se pudo conectar a la API.');
}

export async function obtenerPacientes(opciones = {}) {
  try {
    const data = await fetchJsonApi('/api/patients', opciones);
    return data;
  } catch (err) {
    throw new Error('No se pudieron cargar los pacientes.');
  }
}

export async function obtenerPacientePorId(id, opciones = {}) {
  try {
    const data = await fetchJsonApi(`/api/patients/${id}`, opciones);
    return data;
  } catch (err) {
    return null;
  }
}

export async function crearPacienteApi(paciente) {
  try {
    const data = await fetchJsonApi('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paciente),
    });
    return data;
  } catch (err) {
    throw new Error('No se pudo guardar el paciente.');
  }
}

export async function actualizarPacienteApi(paciente) {
  return crearPacienteApi(paciente);
}

export async function eliminarPacienteApi(pacienteId) {
  try {
    const data = await fetchJsonApi(`/api/patients/${pacienteId}`, {
      method: 'DELETE',
    });
    return data;
  } catch (err) {
    throw new Error(String(err?.message || 'No se pudo eliminar el paciente.'));
  }
}

export async function cambiarEstadoPacienteApi(pacienteId, activo) {
  try {
    const data = await fetchJsonApi(`/api/patients/${pacienteId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: Boolean(activo) }),
    });
    return data;
  } catch (err) {
    throw new Error(String(err?.message || 'No se pudo actualizar el estado del paciente.'));
  }
}

export async function cambiarBajaPacienteApi(pacienteId, dadoDeBaja) {
  try {
    const data = await fetchJsonApi(`/api/patients/${pacienteId}/discharge`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dadoDeBaja: Boolean(dadoDeBaja) }),
    });
    return data;
  } catch (err) {
    throw new Error(String(err?.message || 'No se pudo actualizar la baja del paciente.'));
  }
}

export async function cambiarEstadoOperativoApi(pacienteId, newStateName, reason = '') {
  try {
    const data = await fetchJsonApi(`/api/patients/${pacienteId}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newStateName, reason }),
    });
    return data;
  } catch (err) {
    throw new Error(String(err?.message || 'No se pudo cambiar el estado operativo.'));
  }
}

export async function crearSolicitudPacienteApi(pacienteId, payload = {}) {
  try {
    const data = await fetchJsonApi(`/api/patients/${pacienteId}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return data;
  } catch (err) {
    throw new Error(String(err?.message || 'No se pudo guardar la solicitud.'));
  }
}

export async function agregarTratamientosApi(pacienteId, tratamientos) {
  try {
    const data = await fetchJsonApi(`/api/patients/${pacienteId}/treatments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tratamientos }),
    });
    return data;
  } catch (err) {
    throw new Error('No se pudieron agregar tratamientos.');
  }
}

export async function eliminarTratamientoApi(pacienteId, tratamiento) {
  try {
    const data = await fetchJsonApi(`/api/patients/${pacienteId}/treatments`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tratamiento }),
    });
    return data;
  } catch (err) {
    throw new Error('No se pudo eliminar el tratamiento.');
  }
}

export async function alternarTurnoApi(pacienteId, tratamiento, clave, mes) {
  try {
    const data = await fetchJsonApi(`/api/patients/${pacienteId}/turns/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tratamiento, clave, mes }),
    });
    return data;
  } catch (err) {
    throw new Error('No se pudo actualizar el turno.');
  }
}

export async function guardarAsistenciaApi(pacienteId, asistencia) {
  try {
    const data = await fetchJsonApi(`/api/patients/${pacienteId}/attendances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(asistencia),
    });
    return data;
  } catch (err) {
    throw new Error('No se pudo guardar la asistencia.');
  }
}

export async function guardarTurnoExcepcionApi(pacienteId, tratamiento, fecha, hora, activo) {
  try {
    const data = await fetchJsonApi(`/api/patients/${pacienteId}/turns/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tratamiento, fecha, hora, activo }),
    });
    return data;
  } catch (err) {
    throw new Error('No se pudo guardar la excepcion.');
  }
}

export async function moverTurnosHorarioApi({
  fromDay,
  toDay,
  patientId,
  month,
}) {
  try {
    const data = await fetchJsonApi('/api/patients/turns/shift', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromDay, toDay, patientId, month }),
    });
    return data;
  } catch (err) {
    throw new Error('No se pudo mover el horario.');
  }
}

export async function moverTurnosFechaApi({
  fromDate,
  toDate,
  patientId,
  tratamiento,
  month,
  year,
  onlyDisable,
}) {
  try {
    const data = await fetchJsonApi('/api/patients/turns/shift-date', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromDate,
        toDate,
        patientId,
        tratamiento,
        month,
        year,
        onlyDisable: Boolean(onlyDisable),
      }),
    });
    return data;
  } catch (err) {
    throw new Error(
      String(err?.message || 'No se pudo mover el turno por fecha.')
    );
  }
}

export async function revertirTurnosFechaApi({
  fromDate,
  toDate,
  patientId,
  tratamiento,
  month,
  year,
}) {
  try {
    const data = await fetchJsonApi('/api/patients/turns/revert-date-shift', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromDate,
        toDate,
        patientId,
        tratamiento,
        month,
        year,
      }),
    });
    return data;
  } catch (err) {
    throw new Error(
      String(err?.message || 'No se pudo revertir el turno por fecha.')
    );
  }
}

function normalizarObrasSociales(lista) {
  if (!Array.isArray(lista)) return [];
  const map = new Map();
  for (const item of lista) {
    let id = '';
    let label = '';
    if (typeof item === 'string' || typeof item === 'number') {
      id = String(item).trim();
      label = id;
    } else if (item && typeof item === 'object') {
      id = String(item.id || item.obraSocialId || item.value || '').trim();
      label = String(item.label || item.nombre || item.name || id).trim();
    }
    if (!id) continue;
    map.set(id, { id, label: label || id });
  }
  return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));
}

export async function obtenerObrasSocialesApi(opciones = {}) {
  try {
    const data = await fetchJsonApi('/api/obras-sociales', opciones);
    return normalizarObrasSociales(data);
  } catch (err) {
    throw new Error('No se pudieron cargar las obras sociales.');
  }
}

export async function descargarObraSocialPacientePdf({
  pacienteId,
  obraSocialId,
  tratamiento,
  mes,
  anio,
  signal,
}) {
  const qs = new URLSearchParams();
  if (tratamiento) qs.set('tratamiento', String(tratamiento));
  if (mes != null) qs.set('mes', String(mes));
  if (anio != null) qs.set('anio', String(anio));
  const path = `/api/patients/${encodeURIComponent(pacienteId)}/obras-sociales/${encodeURIComponent(
    obraSocialId
  )}?${qs.toString()}`;
  return fetchBlobApi(path, { method: 'GET', signal });
}

export async function exportarAsistenciasPdf({
  patientIds,
  tratamiento,
  mes,
  anio,
  obraSocialId,
  formato,
  signal,
}) {
  return fetchBlobApi('/api/attendances/export', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientIds: Array.isArray(patientIds) ? patientIds : [],
      tratamiento,
      mes,
      anio,
      obraSocialId,
      formato,
    }),
  });
}

export async function obtenerUsuariosApi(opciones = {}) {
  const data = await fetchJsonApi('/api/users', opciones);
  return Array.isArray(data) ? data : [];
}

export async function obtenerUsuariosBloqueadosApi(opciones = {}) {
  const data = await fetchJsonApi('/api/users/blocked', opciones);
  return Array.isArray(data) ? data : [];
}

export async function obtenerActividadUsuariosApi(opciones = {}) {
  const data = await fetchJsonApi('/api/users/activity', opciones);
  return Array.isArray(data) ? data : [];
}

export async function desbloquearUsuarioApi(username) {
  return fetchJsonApi(`/api/users/blocked/${encodeURIComponent(username)}/unlock`, {
    method: 'POST',
  });
}

export async function crearUsuarioApi({ username, password, isAdmin }) {
  return fetchJsonApi('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, isAdmin: Boolean(isAdmin) }),
  });
}

export async function actualizarUsuarioApi(userId, payload = {}) {
  return fetchJsonApi(`/api/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function eliminarUsuarioApi(userId) {
  return fetchJsonApi(`/api/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

export async function cambiarPasswordActualApi({ currentPassword, newPassword }) {
  return fetchJsonApi('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

// ============================================================
// MÓDULO DE ADMISIÓN DE PACIENTES
// ============================================================

export async function obtenerAdmisionesApi(opciones = {}) {
  try {
    const data = await fetchJsonApi('/api/admisiones', opciones);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    throw new Error('No se pudieron cargar las admisiones.');
  }
}

export async function obtenerAdmisionApi(id, opciones = {}) {
  try {
    return await fetchJsonApi(`/api/admisiones/${id}`, opciones);
  } catch (err) {
    return null;
  }
}

export async function crearAdmisionApi(datos) {
  try {
    return await fetchJsonApi('/api/admisiones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
  } catch (err) {
    throw new Error(String(err?.message || 'No se pudo crear la admisión.'));
  }
}

export async function actualizarAdmisionApi(id, datos) {
  try {
    return await fetchJsonApi(`/api/admisiones/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
  } catch (err) {
    throw new Error(String(err?.message || 'No se pudo actualizar la admisión.'));
  }
}

export async function eliminarAdmisionApi(id) {
  try {
    return await fetchJsonApi(`/api/admisiones/${id}`, { method: 'DELETE' });
  } catch (err) {
    throw new Error(String(err?.message || 'No se pudo eliminar la admisión.'));
  }
}

export async function obtenerRevisionAdmisionApi(admisionId, opciones = {}) {
  try {
    return await fetchJsonApi(`/api/admisiones/${admisionId}/revision`, opciones);
  } catch (err) {
    return null;
  }
}

export async function guardarRevisionAdmisionApi(admisionId, datos) {
  try {
    return await fetchJsonApi(`/api/admisiones/${admisionId}/revision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
  } catch (err) {
    throw new Error(String(err?.message || 'No se pudo guardar la revisión.'));
  }
}

export async function obtenerExpedienteAdmisionApi(admisionId, opciones = {}) {
  try {
    return await fetchJsonApi(`/api/admisiones/${admisionId}/expediente`, opciones);
  } catch (err) {
    return null;
  }
}

export async function guardarExpedienteAdmisionApi(admisionId, formData) {
  const path = `/api/admisiones/${admisionId}/expediente`;
  const apiUrl = resolverApiUrl(path);
  const urls = apiUrl && apiUrl !== path ? [apiUrl, path] : [path];

  const headers = new Headers();
  const token = obtenerToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let lastError = null;
  for (const url of urls) {
    try {
      const respuesta = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: formData,
      });

      if (!respuesta.ok) {
        let detalle = '';
        try {
          const data = await respuesta.json();
          if (data?.error) detalle = data.error;
        } catch {}
        const error = new Error(detalle || `HTTP ${respuesta.status}`);
        error.status = respuesta.status;
        throw error;
      }
      return await respuesta.json();
    } catch (err) {
      lastError = err;
      if (err.status) throw err;
    }
  }
  throw lastError || new Error('No se pudo conectar a la API.');
}

export function urlArchivoExpediente(admisionId, campo) {
  const apiBaseUrl = obtenerApiBaseUrl();
  const path = `/api/admisiones/${admisionId}/expediente/${campo}/archivo`;
  return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
}

export async function obtenerInfoArchivoExpedienteApi(admisionId, campo) {
  try {
    return await fetchJsonApi(`/api/admisiones/${admisionId}/expediente/${campo}/info`);
  } catch (err) {
    return null;
  }
}

export async function descargarArchivoExpedienteApi(admisionId, campo) {
  const path = `/api/admisiones/${admisionId}/expediente/${campo}/archivo`;
  return fetchBlobApi(path, { method: 'GET' });
}
