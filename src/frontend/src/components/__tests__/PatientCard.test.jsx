import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TarjetaPaciente from '../PatientCard';

describe('TarjetaPaciente Component', () => {
  const pacienteBase = {
    id: 1,
    nombre: 'Juan',
    apellido: 'Perez',
    edad: '9',
    obraSocial: 'OSDE',
    modulo: 'MII',
    activo: true,
    dadoDeBaja: false,
  };

  it('renderiza la información básica del paciente (nombre, edad, obra social, modulo)', () => {
    render(
      <TarjetaPaciente
        paciente={pacienteBase}
        alAbrir={() => {}}
        alCambiarEstado={() => {}}
        alCambiarBaja={() => {}}
      />
    );

    expect(screen.getByText('Perez Juan')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('OSDE')).toBeInTheDocument();
    expect(screen.getByText('MII')).toBeInTheDocument();
  });

  it('muestra los badges correctos para paciente Activo y Autorizado', () => {
    render(
      <TarjetaPaciente
        paciente={pacienteBase}
        alAbrir={() => {}}
        alCambiarEstado={() => {}}
        alCambiarBaja={() => {}}
      />
    );

    expect(screen.getByText('Autorizado')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it('muestra los badges y botones correspondientes para paciente No autorizado y Dado de baja', () => {
    const pacienteInactivoBaja = {
      ...pacienteBase,
      activo: false,
      dadoDeBaja: true,
    };

    render(
      <TarjetaPaciente
        paciente={pacienteInactivoBaja}
        alAbrir={() => {}}
        alCambiarEstado={() => {}}
        alCambiarBaja={() => {}}
      />
    );

    expect(screen.getByText('No autorizado')).toBeInTheDocument();
    expect(screen.getByText('Dado de baja')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reactivar/i })).toBeInTheDocument();
  });

  it('ejecuta los callbacks al hacer click en los botones de acción', () => {
    const mockAlAbrir = jest.fn();
    const mockAlCambiarEstado = jest.fn();
    const mockAlCambiarBaja = jest.fn();

    render(
      <TarjetaPaciente
        paciente={pacienteBase}
        alAbrir={mockAlAbrir}
        alCambiarEstado={mockAlCambiarEstado}
        alCambiarBaja={mockAlCambiarBaja}
      />
    );

    // Botón Ver Detalle
    const btnDetalle = screen.getByRole('button', { name: /ver detalle/i });
    fireEvent.click(btnDetalle);
    expect(mockAlAbrir).toHaveBeenCalledTimes(1);

    // Botón No autorizar (cambiar estado a false)
    const btnEstado = screen.getByRole('button', { name: /no autorizar/i });
    fireEvent.click(btnEstado);
    expect(mockAlCambiarEstado).toHaveBeenCalledWith(false);

    // Botón Dar de baja (cambiar baja a true)
    const btnBaja = screen.getByRole('button', { name: /dar de baja/i });
    fireEvent.click(btnBaja);
    expect(mockAlCambiarBaja).toHaveBeenCalledWith(true);
  });
});
