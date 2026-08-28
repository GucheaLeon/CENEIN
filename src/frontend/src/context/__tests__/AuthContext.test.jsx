import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { ProveedorAutenticacion, useAutenticacion } from '../AuthContext';
import * as api from '../../services/api';

jest.mock('../../services/api');

function TestConsumer() {
  const { usuario, cargando, iniciarSesion, cerrarSesion } = useAutenticacion();
  return (
    <div>
      <div data-testid="cargando">{cargando ? 'cargando' : 'listo'}</div>
      <div data-testid="usuario">{usuario ? usuario.username : 'anonimo'}</div>
      <button
        data-testid="btn-login"
        onClick={() => iniciarSesion({ username: 'admin', password: 'password' })}
      >
        Login
      </button>
      <button data-testid="btn-logout" onClick={cerrarSesion}>
        Logout
      </button>
    </div>
  );
}

describe('AuthContext Component & Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('inicia cargando y resuelve a usuario null si no hay sesión previa', async () => {
    api.obtenerUsuarioActualApi.mockResolvedValueOnce(null);

    await act(async () => {
      render(
        <ProveedorAutenticacion>
          <TestConsumer />
        </ProveedorAutenticacion>
      );
    });

    expect(screen.getByTestId('cargando').textContent).toBe('listo');
    expect(screen.getByTestId('usuario').textContent).toBe('anonimo');
  });

  it('restaura la sesión si la API devuelve un usuario válido', async () => {
    api.obtenerUsuarioActualApi.mockResolvedValueOnce({
      username: 'lucia_admin',
      isAdmin: true,
    });

    await act(async () => {
      render(
        <ProveedorAutenticacion>
          <TestConsumer />
        </ProveedorAutenticacion>
      );
    });

    expect(screen.getByTestId('cargando').textContent).toBe('listo');
    expect(screen.getByTestId('usuario').textContent).toBe('lucia_admin');
  });

  it('inicia sesión correctamente y actualiza el estado global', async () => {
    api.obtenerUsuarioActualApi.mockResolvedValueOnce(null);
    api.iniciarSesionApi.mockResolvedValueOnce({
      user: { username: 'admin', isAdmin: true },
      token: 'jwt-mock-token',
    });

    await act(async () => {
      render(
        <ProveedorAutenticacion>
          <TestConsumer />
        </ProveedorAutenticacion>
      );
    });

    const btnLogin = screen.getByTestId('btn-login');
    await act(async () => {
      btnLogin.click();
    });

    expect(screen.getByTestId('usuario').textContent).toBe('admin');
  });

  it('cierra sesión y limpia los datos del usuario', async () => {
    api.obtenerUsuarioActualApi.mockResolvedValueOnce({
      username: 'usuario_activo',
      isAdmin: false,
    });

    await act(async () => {
      render(
        <ProveedorAutenticacion>
          <TestConsumer />
        </ProveedorAutenticacion>
      );
    });

    expect(screen.getByTestId('usuario').textContent).toBe('usuario_activo');

    const btnLogout = screen.getByTestId('btn-logout');
    await act(async () => {
      btnLogout.click();
    });

    expect(api.cerrarSesionApi).toHaveBeenCalled();
    expect(api.limpiarToken).toHaveBeenCalled();
    expect(screen.getByTestId('usuario').textContent).toBe('anonimo');
  });
});
