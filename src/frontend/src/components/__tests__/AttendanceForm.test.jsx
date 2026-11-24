import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FormularioAsistencia from '../AttendanceForm';

describe('FormularioAsistencia Component', () => {
  it('renderiza correctamente el select de tratamientos y el campo de nota', () => {
    render(<FormularioAsistencia alEnviar={() => {}} />);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/nota breve/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar/i })).toBeInTheDocument();
  });

  it('permite cambiar el tratamiento seleccionado', () => {
    render(<FormularioAsistencia alEnviar={() => {}} />);
    const select = screen.getByRole('combobox');

    fireEvent.change(select, { target: { value: 'Psicologia' } });
    expect(select.value).toBe('Psicologia');
  });

  it('envia los datos correctos con nota personalizada al hacer submit', () => {
    const mockAlEnviar = jest.fn();
    render(<FormularioAsistencia alEnviar={mockAlEnviar} />);

    const select = screen.getByRole('combobox');
    const inputNota = screen.getByPlaceholderText(/nota breve/i);
    const botonGuardar = screen.getByRole('button', { name: /guardar/i });

    fireEvent.change(select, { target: { value: 'Kinesiologia' } });
    fireEvent.change(inputNota, { target: { value: 'Sesión completada con éxito' } });
    fireEvent.click(botonGuardar);

    expect(mockAlEnviar).toHaveBeenCalledTimes(1);
    const hoy = new Date().toISOString().slice(0, 10);
    expect(mockAlEnviar).toHaveBeenCalledWith({
      fecha: hoy,
      tratamiento: 'Kinesiologia',
      nota: 'Sesión completada con éxito'
    });
    // El input de nota debe haberse reseteado a vacío
    expect(inputNota.value).toBe('');
  });

  it('asigna "Sin nota" por defecto si el campo de nota queda vacío', () => {
    const mockAlEnviar = jest.fn();
    render(<FormularioAsistencia alEnviar={mockAlEnviar} />);

    const botonGuardar = screen.getByRole('button', { name: /guardar/i });
    fireEvent.click(botonGuardar);

    expect(mockAlEnviar).toHaveBeenCalledTimes(1);
    expect(mockAlEnviar).toHaveBeenCalledWith(
      expect.objectContaining({
        tratamiento: 'Fonoaudiologia',
        nota: 'Sin nota'
      })
    );
  });
});
