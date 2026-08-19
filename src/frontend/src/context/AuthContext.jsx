import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  iniciarSesionApi,
  obtenerUsuarioActualApi,
  cerrarSesionApi,
  limpiarToken,
} from '../services/api';

const ContextoAutenticacion = createContext(null);

export function ProveedorAutenticacion({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activa = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    setCargando(true);
    obtenerUsuarioActualApi({ signal: controller.signal })
      .then((data) => {
        if (!activa) return;
        if (!data || typeof data !== 'object') {
          setUsuario(null);
          return;
        }
        const username = String(data?.username || '').trim();
        if (!username) {
          setUsuario(null);
          return;
        }
        setUsuario({
          nombre: username,
          username,
          isAdmin: Boolean(data?.isAdmin),
        });
      })
      .catch((err) => {
        if (!activa) return;
        if (controller.signal.aborted || err?.name === 'AbortError') {
          setUsuario(null);
          return;
        }
        limpiarToken();
        setUsuario(null);
      })
      .finally(() => {
        if (!activa) return;
        clearTimeout(timeoutId);
        setCargando(false);
      });
    return () => {
      activa = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  const iniciarSesion = async ({ username, password, recordarSesion }) => {
    const u = String(username || '').trim();
    const p = String(password || '').trim();
    if (!u || !p) return { ok: false, error: 'Completa usuario y contraseÃ±a.' };
    try {
      const data = await iniciarSesionApi({ username: u, password: p, recordarSesion });
      const nombre = String(data?.user?.username || '').trim() || u;
      setUsuario({
        nombre,
        username: nombre,
        isAdmin: Boolean(data?.user?.isAdmin),
      });
      return { ok: true };
    } catch (err) {
      const detalle = String(err?.message || '').trim();
      if (detalle) {
        return {
          ok: false,
          error: detalle,
          retryAfterSeconds: Number.isFinite(Number(err?.retryAfterSeconds))
            ? Number(err.retryAfterSeconds)
            : 0,
        };
      }
      return { ok: false, error: 'No se pudo iniciar sesiÃ³n.' };
    }
  };

  const cerrarSesion = () => {
    cerrarSesionApi();
    limpiarToken();
    setUsuario(null);
  };

  const valor = useMemo(
    () => ({ usuario, cargando, iniciarSesion, cerrarSesion }),
    [usuario, cargando]
  );

  return (
    <ContextoAutenticacion.Provider value={valor}>
      {children}
    </ContextoAutenticacion.Provider>
  );
}

export function useAutenticacion() {
  const ctx = useContext(ContextoAutenticacion);
  if (!ctx) {
    throw new Error('useAutenticacion debe usarse dentro de ProveedorAutenticacion');
  }
  return ctx;
}

