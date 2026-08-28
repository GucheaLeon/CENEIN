import React from 'react';
import { render, screen, act } from '@testing-library/react';
import Aplicacion from './App.jsx';
import * as api from './services/api';

jest.mock('./services/api');

test('renderiza la aplicación y muestra pantalla de inicio de sesión cuando no hay usuario', async () => {
  api.obtenerUsuarioActualApi.mockResolvedValueOnce(null);

  await act(async () => {
    render(<Aplicacion />);
  });

  // Cuando no hay usuario logueado, debe renderizar la pantalla de Login
  expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /iniciar/i })).toBeInTheDocument();
});
