import React, { useState } from 'react';

export default function FormularioAsistencia({ alEnviar }) {
  const [tratamiento, setTratamiento] = useState('Fonoaudiologia');
  const [nota, setNota] = useState('');

  const enviar = (e) => {
    e.preventDefault();
    const hoy = new Date().toISOString().slice(0, 10);
    alEnviar({ fecha: hoy, tratamiento, nota: nota || 'Sin nota' });
    setNota('');
  };

  return (
    <form onSubmit={enviar} style={{ marginBottom: 12 }}>
      <select value={tratamiento} onChange={(e) => setTratamiento(e.target.value)}>
        <option>Fonoaudiologia</option>
        <option>Psicologia</option>
        <option>Psicopedagogia</option>
        <option>Psicomotricidad</option>
        <option>Kinesiologia</option>
        <option>Integracion</option>
      </select>
      <input
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Nota breve"
        style={{ marginLeft: 8, padding: 6 }}
      />
      <button type="submit" style={{ marginLeft: 8 }}>Guardar</button>
    </form>
  );
}
