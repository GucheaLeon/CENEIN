import React from 'react';

const resolverNombreApellido = (paciente) => {
  const nombreRaw = String(paciente?.nombre || '').trim();
  const apellidoRaw = String(paciente?.apellido || '').trim();
  if (apellidoRaw) return { nombre: nombreRaw, apellido: apellidoRaw };
  const partes = nombreRaw.split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return { nombre: nombreRaw, apellido: '' };
  const usaDosApellidos = partes.length >= 4;
  const corte = usaDosApellidos ? partes.length - 2 : partes.length - 1;
  return {
    nombre: partes.slice(0, corte).join(' ').trim(),
    apellido: partes.slice(corte).join(' ').trim(),
  };
};

export default function TarjetaPaciente({
  paciente,
  alAbrir,
  alCambiarEstado,
  alCambiarBaja,
}) {
  const datos = resolverNombreApellido(paciente);
  const nombreCompleto = `${datos.apellido} ${datos.nombre}`.trim();
  const activo = paciente.activo !== false;
  const dadoDeBaja = paciente.dadoDeBaja === true;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-surface-200 bg-white shadow-soft hover:border-primary-200/80 hover:shadow-md transition-all duration-200">
      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-2">
          <h3 className="font-semibold text-surface-900 truncate">
            {nombreCompleto || '-'}
          </h3>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
              activo
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-orange-700 bg-orange-50 border-orange-200'
            }`}
          >
            {activo ? 'Autorizado' : 'No autorizado'}
          </span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
              dadoDeBaja
                ? 'text-amber-700 bg-amber-50 border-amber-200'
                : 'text-slate-700 bg-slate-50 border-slate-200'
            }`}
          >
            {dadoDeBaja ? 'Dado de baja' : 'Activo'}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-sm text-surface-600">
          <span>Edad: <span className="font-medium text-surface-700">{paciente.edad}</span></span>
          <span>Obra social: <span className="font-medium text-surface-700">{paciente.obraSocial || '-'}</span></span>
          <span>Modulo: <span className="font-medium text-surface-700">{paciente.modulo || '-'}</span></span>
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        <button
          onClick={() => alCambiarEstado && alCambiarEstado(!activo)}
          disabled={dadoDeBaja}
          className="px-3 py-2 rounded-xl text-sm font-medium border border-surface-200 text-surface-700 hover:bg-surface-100 transition-colors duration-200"
        >
          {activo ? 'No autorizar' : 'Autorizar'}
        </button>
        <button
          onClick={() => alCambiarBaja && alCambiarBaja(!dadoDeBaja)}
          className="px-3 py-2 rounded-xl text-sm font-medium border border-surface-200 text-surface-700 hover:bg-surface-100 transition-colors duration-200"
        >
          {dadoDeBaja ? 'Reactivar' : 'Dar de baja'}
        </button>
        <button
          onClick={alAbrir}
          className="px-4 py-2.5 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-500 active:bg-primary-600 transition-colors duration-200 shadow-sm"
        >
          Ver detalle
        </button>
      </div>
    </div>
  );
}
