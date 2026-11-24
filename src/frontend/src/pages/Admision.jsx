import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePacientes } from '../context/PatientsContext';
import {
  actualizarAdmisionApi,
  crearAdmisionApi,
  descargarArchivoExpedienteApi,
  eliminarAdmisionApi,
  finalizarAdmisionApi,
  guardarExpedienteAdmisionApi,
  guardarRevisionAdmisionApi,
  obtenerAdmisionesApi,
  obtenerExpedienteAdmisionApi,
  obtenerObrasSocialesApi,
  obtenerRevisionAdmisionApi,
} from '../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de estado / badge
// ─────────────────────────────────────────────────────────────────────────────
const ESTADO_META = {
  pendiente_turno: {
    label: 'Pendiente turno',
    color: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-400',
  },
  en_revision: {
    label: 'En revisión',
    color: 'bg-blue-100 text-blue-700',
    dot: 'bg-blue-400',
  },
  aprobado: {
    label: 'Armando expediente',
    color: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-400',
  },
  completado: {
    label: 'Expediente completo / Admitido',
    color: 'bg-emerald-100 text-emerald-700',
    dot: 'bg-emerald-400',
  },
  desestimado: {
    label: 'Desestimado',
    color: 'bg-rose-100 text-rose-700',
    dot: 'bg-rose-400',
  },
};

function BadgeEstado({ estado }) {
  const m = ESTADO_META[estado] || {
    label: estado,
    color: 'bg-slate-100 text-slate-600',
    dot: 'bg-slate-400',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${m.color}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Wizard de nueva admisión — formulario paso a paso (Etapa 1)
// ─────────────────────────────────────────────────────────────────────────────
const PASOS = [
  { num: 1, label: 'Nombre', icon: 'badge' },
  { num: 2, label: 'Datos personales', icon: 'calendar_month' },
  { num: 3, label: 'Domicilio', icon: 'home' },
  { num: 4, label: 'Documentación', icon: 'description' },
];

function WizardNuevaAdmision({ onGuardar, onCancelar }) {
  const [paso, setPaso] = useState(1);
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    fechaNacimiento: '',
    dni: '',
    telefono: '',
    domicilio: '',
    tieneObraSocial: false,
    obraSocialNombre: '',
    tieneCUD: false,
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [animDir, setAnimDir] = useState('forward'); // forward | backward
  const [obrasSociales, setObrasSociales] = useState([]);
  const [busquedaOS, setBusquedaOS] = useState('');

  useEffect(() => {
    if (form.tieneObraSocial && obrasSociales.length === 0) {
      obtenerObrasSocialesApi()
        .then((data) => setObrasSociales(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  }, [form.tieneObraSocial, obrasSociales.length]);

  const cambiar = (campo, valor) =>
    setForm((prev) => ({ ...prev, [campo]: valor }));

  const validarPaso = () => {
    const soloLetras = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s'-]{2,60}$/;
    const soloNumerosDni = /^\d{6,9}$/;
    const telValido = /^[\d\s+()-]{6,25}$/;
    const alfanumericoDomicilio = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s.,#º°/-]{3,120}$/;

    if (paso === 1) {
      if (!form.nombre.trim()) return 'El nombre es obligatorio.';
      if (!soloLetras.test(form.nombre.trim())) return 'El nombre solo puede contener letras y espacios (mínimo 2 letras).';
      if (!form.apellido.trim()) return 'El apellido es obligatorio.';
      if (!soloLetras.test(form.apellido.trim())) return 'El apellido solo puede contener letras y espacios (mínimo 2 letras).';
    }
    if (paso === 2) {
      if (!form.fechaNacimiento) return 'La fecha de nacimiento es obligatoria.';
      const d = new Date(form.fechaNacimiento);
      if (isNaN(d.getTime())) return 'La fecha de nacimiento no es válida.';
      if (d > new Date()) return 'La fecha de nacimiento no puede ser en el futuro.';
      if (d.getFullYear() < 1900) return 'La fecha de nacimiento no es válida.';
      const hoy = new Date();
      let edad = hoy.getFullYear() - d.getFullYear();
      const m = hoy.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && hoy.getDate() < d.getDate())) {
        edad--;
      }
      if (edad < 3) return 'El paciente no puede tener menos de 3 años de edad.';
      if (edad > 18) return 'El paciente no puede tener más de 18 años de edad.';
      if (!form.dni.trim()) return 'El DNI es obligatorio.';
      if (!soloNumerosDni.test(form.dni.trim())) return 'El DNI debe contener entre 6 y 9 números sin puntos ni letras.';
      if (!form.telefono.trim()) return 'El teléfono es obligatorio.';
      if (!telValido.test(form.telefono.trim())) return 'El teléfono debe contener al menos 6 dígitos válidos.';
    }
    if (paso === 3) {
      if (form.domicilio.trim() && !alfanumericoDomicilio.test(form.domicilio.trim())) {
        return 'El domicilio contiene caracteres no permitidos.';
      }
    }
    if (paso === 4) {
      if (form.tieneObraSocial && !form.obraSocialNombre.trim()) {
        return 'Debe seleccionar o ingresar el nombre de la Obra Social.';
      }
    }
    return '';
  };

  const avanzar = () => {
    const err = validarPaso();
    if (err) { setError(err); return; }
    setError('');
    setAnimDir('forward');
    setPaso((p) => Math.min(p + 1, PASOS.length));
  };

  const retroceder = () => {
    setError('');
    setAnimDir('backward');
    setPaso((p) => Math.max(p - 1, 1));
  };

  const handleSubmit = async () => {
    const err = validarPaso();
    if (err) { setError(err); return; }
    setGuardando(true);
    setError('');
    try {
      const creada = await crearAdmisionApi(form);
      onGuardar(creada);
    } catch (err) {
      setError(err.message || 'No se pudo guardar la admisión.');
    } finally {
      setGuardando(false);
    }
  };

  const progreso = ((paso - 1) / (PASOS.length - 1)) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#006d44] to-[#00a066] px-6 py-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Nueva Admisión</h2>
              <p className="mt-0.5 text-xs text-white/70">
                Paso {paso} de {PASOS.length} — {PASOS[paso - 1].label}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancelar}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/20 hover:text-white transition"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          {/* Stepper visual */}
          <div className="flex items-center gap-0">
            {PASOS.map((p, idx) => {
              const isCompleto = paso > p.num;
              const isActual = paso === p.num;
              return (
                <React.Fragment key={p.num}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                        isCompleto
                          ? 'bg-white text-[#006d44]'
                          : isActual
                          ? 'bg-white/30 ring-2 ring-white text-white'
                          : 'bg-white/10 text-white/40'
                      }`}
                    >
                      {isCompleto ? (
                        <span className="material-symbols-outlined text-sm">check</span>
                      ) : (
                        <span className="material-symbols-outlined text-sm">{p.icon}</span>
                      )}
                    </div>
                    <span className={`mt-1 text-[10px] font-medium hidden sm:block ${isActual ? 'text-white' : 'text-white/40'}`}>
                      {p.label}
                    </span>
                  </div>
                  {idx < PASOS.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 rounded transition-all ${paso > p.num ? 'bg-white' : 'bg-white/20'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Contenido del paso */}
        <div className="px-6 py-6 min-h-[220px]">
          {/* PASO 1: Nombre y Apellido */}
          {paso === 1 && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#006d44] text-base">badge</span>
                ¿Cómo se llama el paciente?
              </p>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Nombre <span className="text-rose-500">*</span>
                </label>
                <input
                  id="wizard-nombre"
                  type="text"
                  autoFocus
                  value={form.nombre}
                  onChange={(e) => cambiar('nombre', e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s'-]/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && avanzar()}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-base focus:border-[#006d44] focus:outline-none focus:bg-white transition"
                  placeholder="Ej: Juan"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Apellido <span className="text-rose-500">*</span>
                </label>
                <input
                  id="wizard-apellido"
                  type="text"
                  value={form.apellido}
                  onChange={(e) => cambiar('apellido', e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s'-]/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && avanzar()}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-base focus:border-[#006d44] focus:outline-none focus:bg-white transition"
                  placeholder="Ej: García"
                />
              </div>
            </div>
          )}

          {/* PASO 2: Fecha de nac., DNI, Teléfono */}
          {paso === 2 && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#006d44] text-base">calendar_month</span>
                Datos personales de{' '}
                <span className="text-[#006d44]">{form.nombre} {form.apellido}</span>
              </p>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Fecha de nacimiento <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] font-medium text-slate-500">
                    (Entre 3 y 18 años)
                  </span>
                </div>
                <input
                  id="wizard-fecha-nac"
                  type="date"
                  min={new Date(new Date().getFullYear() - 18, new Date().getMonth(), new Date().getDate()).toISOString().split('T')[0]}
                  max={new Date(new Date().getFullYear() - 3, new Date().getMonth(), new Date().getDate()).toISOString().split('T')[0]}
                  value={form.fechaNacimiento}
                  onChange={(e) => cambiar('fechaNacimiento', e.target.value)}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-base focus:border-[#006d44] focus:outline-none focus:bg-white transition"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    DNI <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="wizard-dni"
                    type="text"
                    inputMode="numeric"
                    maxLength={9}
                    value={form.dni}
                    onChange={(e) => cambiar('dni', e.target.value.replace(/\D/g, '').slice(0, 9))}
                    className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-base focus:border-[#006d44] focus:outline-none focus:bg-white transition"
                    placeholder="Ej: 40123456"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Teléfono <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="wizard-telefono"
                    type="tel"
                    value={form.telefono}
                    onChange={(e) => cambiar('telefono', e.target.value.replace(/[^\d\s+()-]/g, '').slice(0, 20))}
                    className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-base focus:border-[#006d44] focus:outline-none focus:bg-white transition"
                    placeholder="Ej: 2634 123456"
                  />
                </div>
              </div>
            </div>
          )}

          {/* PASO 3: Domicilio */}
          {paso === 3 && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#006d44] text-base">home</span>
                ¿Dónde vive{' '}
                <span className="text-[#006d44]">{form.nombre}</span>?
              </p>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Domicilio (Calle y número)
                </label>
                <input
                  id="wizard-domicilio"
                  type="text"
                  autoFocus
                  value={form.domicilio}
                  onChange={(e) => cambiar('domicilio', e.target.value.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s.,#º°/-]/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && avanzar()}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-base focus:border-[#006d44] focus:outline-none focus:bg-white transition"
                  placeholder="Ej: Av. San Martín 123, Mendoza"
                />
              </div>
              <p className="text-xs text-slate-400">
                <span className="material-symbols-outlined text-xs mr-1">info</span>
                Este campo es opcional, podés completarlo más adelante.
              </p>
            </div>
          )}

          {/* PASO 4: Documentación (OS / CUD) */}
          {paso === 4 && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#006d44] text-base">description</span>
                ¿El paciente cuenta con documentación especial?
              </p>
              <div className="grid grid-cols-2 gap-3">
                {/* Obra Social */}
                <button
                  type="button"
                  id="wizard-os-pill"
                  onClick={() => cambiar('tieneObraSocial', !form.tieneObraSocial)}
                  className={`flex flex-col items-center gap-2 rounded-2xl border-2 px-4 py-5 transition-all ${
                    form.tieneObraSocial
                      ? 'border-[#006d44] bg-[#f0faf4]'
                      : 'border-slate-200 bg-slate-50 hover:border-[#006d44]/30'
                  }`}
                >
                  <span className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    form.tieneObraSocial ? 'bg-[#006d44] text-white' : 'bg-slate-200 text-slate-400'
                  }`}>
                    <span className="material-symbols-outlined">health_and_safety</span>
                  </span>
                  <span className={`text-sm font-semibold ${form.tieneObraSocial ? 'text-[#006d44]' : 'text-slate-500'}`}>
                    Obra Social
                  </span>
                  {form.tieneObraSocial && (
                    <span className="text-xs text-[#006d44]">✓ Sí tiene</span>
                  )}
                </button>

                {/* CUD */}
                <button
                  type="button"
                  id="wizard-cud-pill"
                  onClick={() => cambiar('tieneCUD', !form.tieneCUD)}
                  className={`flex flex-col items-center gap-2 rounded-2xl border-2 px-4 py-5 transition-all ${
                    form.tieneCUD
                      ? 'border-violet-500 bg-violet-50'
                      : 'border-slate-200 bg-slate-50 hover:border-violet-300'
                  }`}
                >
                  <span className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    form.tieneCUD ? 'bg-violet-600 text-white' : 'bg-slate-200 text-slate-400'
                  }`}>
                    <span className="material-symbols-outlined">verified</span>
                  </span>
                  <span className={`text-sm font-semibold ${form.tieneCUD ? 'text-violet-700' : 'text-slate-500'}`}>
                    CUD
                  </span>
                  {form.tieneCUD && (
                    <span className="text-xs text-violet-600">✓ Sí tiene</span>
                  )}
                </button>
              </div>

              {/* Buscador / Selector compacto de alta legibilidad para Obra Social */}
              {form.tieneObraSocial && (
                <div className="rounded-lg border border-emerald-300 bg-emerald-50/90 p-1.5 space-y-1 shadow-2xs animate-fade-in">
                  {form.obraSocialNombre ? (
                    <div className="flex items-center justify-between rounded-md bg-[#006d44] px-2.5 py-1 text-white shadow-2xs">
                      <span className="text-xs font-bold truncate">OS: {form.obraSocialNombre}</span>
                      <button
                        type="button"
                        onClick={() => {
                          cambiar('obraSocialNombre', '');
                          setBusquedaOS('');
                        }}
                        className="text-white/80 hover:text-white ml-2 flex items-center gap-0.5 text-xs font-semibold underline"
                      >
                        Cambiar
                        <span className="material-symbols-outlined" style={{fontSize:'13px'}}>close</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" style={{fontSize:'14px'}}>
                          search
                        </span>
                        <input
                          id="wizard-os-busqueda"
                          type="text"
                          value={busquedaOS}
                          onChange={(e) => {
                            setBusquedaOS(e.target.value);
                          }}
                          placeholder="Buscar o escribir obra social..."
                          className="w-full rounded-md border border-slate-300 bg-white py-1 pl-6 pr-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-[#006d44] focus:outline-none focus:ring-1 focus:ring-[#006d44]"
                        />
                      </div>

                      {/* Lista desplegable compacta con divisores */}
                      <ul className="max-h-20 overflow-y-auto space-y-0 rounded-md bg-white border border-slate-300 divide-y divide-slate-100 shadow-inner">
                        {obrasSociales
                          .filter((os) =>
                            !busquedaOS ||
                            os.label.toLowerCase().includes(busquedaOS.toLowerCase())
                          )
                          .map((os) => (
                            <li key={os.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  cambiar('obraSocialNombre', os.label);
                                  setBusquedaOS('');
                                }}
                                className="flex w-full items-center gap-1.5 px-2 py-0.5 text-left text-xs font-medium text-slate-800 hover:bg-[#006d44] hover:text-white transition-colors"
                              >
                                {os.label}
                              </button>
                            </li>
                          ))}
                        {obrasSociales.filter((os) =>
                          !busquedaOS ||
                          os.label.toLowerCase().includes(busquedaOS.toLowerCase())
                        ).length === 0 && (
                          <li className="px-2 py-1">
                            {busquedaOS ? (
                              <button
                                type="button"
                                onClick={() => {
                                  cambiar('obraSocialNombre', busquedaOS);
                                  setBusquedaOS('');
                                }}
                                className="w-full text-left text-[11px] font-semibold text-slate-500 hover:text-[#006d44]"
                              >
                                Se registrará: "{busquedaOS}" (Click para confirmar)
                              </button>
                            ) : (
                              <span className="text-[11px] font-semibold text-slate-500">Cargando obras sociales...</span>
                            )}
                          </li>
                        )}
                      </ul>
                    </>
                  )}
                </div>
              )}

              {/* Resumen */}
              <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Resumen del paciente</p>
                {[
                  ['Nombre completo', `${form.apellido}, ${form.nombre}`],
                  ['Fecha de nac.', form.fechaNacimiento || '-'],
                  ['DNI', form.dni || '-'],
                  ['Teléfono', form.telefono || '-'],
                  ['Domicilio', form.domicilio || '-'],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span className="text-slate-400">{label}</span>
                    <span className="text-slate-700 font-medium">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="mt-3 rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-600 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">error</span>
              {error}
            </p>
          )}
        </div>

        {/* Footer con botones */}
        <div className="border-t border-slate-100 px-6 py-4 flex gap-3">
          {paso > 1 ? (
            <button
              type="button"
              onClick={retroceder}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Atrás
            </button>
          ) : (
            <button
              type="button"
              onClick={onCancelar}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
          )}

          <div className="flex-1" />

          {paso < PASOS.length ? (
            <button
              type="button"
              id={`wizard-siguiente-${paso}`}
              onClick={avanzar}
              className="flex items-center gap-2 rounded-xl bg-[#006d44] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#005a38] transition"
            >
              Siguiente
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          ) : (
            <button
              type="button"
              id="wizard-registrar-btn"
              onClick={handleSubmit}
              disabled={guardando}
              className="flex items-center gap-2 rounded-xl bg-[#006d44] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#005a38] disabled:opacity-60 transition"
            >
              {guardando ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                  Guardando...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  Registrar admisión
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel de detalle: revisión de fisiatra (Etapa 2)
// ─────────────────────────────────────────────────────────────────────────────
function PanelRevisionFisiatra({ admision, onActualizar }) {
  const [revision, setRevision] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState({ fechaTurno: '', resultado: '', devolucion: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await obtenerRevisionAdmisionApi(admision.id);
      setRevision(data);
    } finally {
      setCargando(false);
    }
  }, [admision.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.resultado) {
      setError('Seleccioná un resultado.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      await guardarRevisionAdmisionApi(admision.id, form);
      await cargar();
      setMostrarForm(false);
      onActualizar();
    } catch (err) {
      setError(err.message || 'No se pudo guardar la revisión.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return <p className="py-4 text-sm text-slate-400">Cargando revisión...</p>;
  }

  return (
    <div className="space-y-4">
      {revision && !mostrarForm && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Revisión de la Fisiatra</p>
            <div className="flex items-center gap-2">
              <BadgeEstado estado={revision.resultado} />
              <button
                type="button"
                onClick={() => {
                  setForm({
                    fechaTurno: revision.fechaTurno || '',
                    resultado: revision.resultado || '',
                    devolucion: revision.devolucion || '',
                  });
                  setMostrarForm(true);
                }}
                className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-[#006d44] hover:bg-[#006d44] hover:text-white transition"
              >
                <span className="material-symbols-outlined text-xs">edit</span>
                Editar
              </button>
            </div>
          </div>
          {revision.fechaTurno && (
            <p className="text-sm text-slate-600">
              <span className="font-medium">Fecha de turno:</span> {revision.fechaTurno}
            </p>
          )}
          {revision.devolucion && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Devolución
              </p>
              <p className="rounded-xl bg-white border border-slate-200 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                {revision.devolucion}
              </p>
            </div>
          )}
          {revision.reviewedBy && (
            <p className="text-xs text-slate-400">Registrado por: {revision.reviewedBy}</p>
          )}
        </div>
      )}

      {!revision && !mostrarForm && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
          <span className="material-symbols-outlined mb-2 block text-3xl text-slate-300">
            event_available
          </span>
          <p className="text-sm text-slate-500">
            Todavía no se registró la devolución de la Fisiatra.
          </p>
        </div>
      )}

      {mostrarForm ? (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-[#006d44]/20 bg-[#f0faf4] p-5">
          <p className="text-sm font-semibold text-[#006d44]">
            {revision ? 'Editar devolución de la Fisiatra' : 'Registrar devolución de la Fisiatra'}
          </p>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Fecha del turno
            </label>
            <input
              type="date"
              value={form.fechaTurno}
              onChange={(e) => setForm((f) => ({ ...f, fechaTurno: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-[#006d44] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Resultado <span className="text-rose-500">*</span>
            </label>
                <div className="flex gap-3">
                  {['aprobado', 'desestimado'].map((op) => (
                    <label
                      key={op}
                      className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition
                        ${
                          form.resultado === op
                            ? op === 'aprobado'
                              ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                              : 'border-rose-400 bg-rose-50 text-rose-700'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                        }`}
                    >
                      <input
                        type="radio"
                        name="resultado"
                        value={op}
                        checked={form.resultado === op}
                        onChange={(e) => setForm((f) => ({ ...f, resultado: e.target.value }))}
                        className="sr-only"
                      />
                      <span className="material-symbols-outlined text-base">
                        {op === 'aprobado' ? 'check_circle' : 'cancel'}
                      </span>
                      {op === 'aprobado' ? 'Aprobado' : 'Desestimado'}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Devolución / Observaciones
                </label>
                <textarea
                  rows={4}
                  value={form.devolucion}
                  onChange={(e) => setForm((f) => ({ ...f, devolucion: e.target.value }))}
                  placeholder="Escribí las observaciones o devolución de la Fisiatra..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-[#006d44] focus:outline-none resize-none"
                />
              </div>

              {error && <p className="text-sm text-rose-600">{error}</p>}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setMostrarForm(false)}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="flex-1 rounded-xl bg-[#006d44] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {guardando ? 'Guardando...' : 'Guardar devolución'}
                </button>
              </div>
            </form>
      ) : (
        !revision && (
          <button
            type="button"
            onClick={() => setMostrarForm(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#006d44]/30 bg-[#f0faf4] px-4 py-3 text-sm font-semibold text-[#006d44] hover:bg-[#e3f5ea]"
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            Registrar devolución de la Fisiatra
          </button>
        )
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Visor de PDF inline
// ─────────────────────────────────────────────────────────────────────────────
function VisorPdf({ admisionId, campo, label, onCerrar }) {
  const [cargando, setCargando] = useState(true);
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let url = null;
    async function cargar() {
      setCargando(true);
      setError('');
      try {
        const blob = await descargarArchivoExpedienteApi(admisionId, campo);
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } catch (err) {
        setError('No se pudo cargar el archivo.');
      } finally {
        setCargando(false);
      }
    }
    cargar();
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [admisionId, campo]);

  const handleDescargar = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${campo}_admision_${admisionId}.pdf`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
      <div className="flex flex-col w-full max-w-4xl h-[90vh] rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header del visor */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 bg-slate-50">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-rose-400 text-xl">picture_as_pdf</span>
            <div>
              <p className="text-sm font-semibold text-slate-800">{label}</p>
              <p className="text-xs text-slate-400">Admisión #{admisionId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {blobUrl && (
              <button
                type="button"
                onClick={handleDescargar}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-[#006d44]/30 hover:text-[#006d44] transition"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                Descargar
              </button>
            )}
            <button
              type="button"
              onClick={onCerrar}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-hidden bg-slate-100">
          {cargando ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <span className="material-symbols-outlined animate-spin text-4xl text-[#006d44]/40">progress_activity</span>
                <p className="mt-3 text-sm text-slate-500">Cargando archivo...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <span className="material-symbols-outlined text-4xl text-rose-300">error</span>
                <p className="mt-3 text-sm text-rose-600">{error}</p>
                <button
                  type="button"
                  onClick={onCerrar}
                  className="mt-4 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Cerrar
                </button>
              </div>
            </div>
          ) : (
            <iframe
              src={blobUrl}
              title={label}
              className="h-full w-full border-0"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel de detalle: expediente / documentos (Etapa 3) con visor inline
// ─────────────────────────────────────────────────────────────────────────────
const DOCUMENTOS_PDF = [
  { key: 'carnet', field: 'carnetPdf', tieneField: 'carnetTiene', filenameField: 'carnetFilename', label: 'Carnet' },
  { key: 'cud', field: 'cudPdf', tieneField: 'cudTiene', filenameField: 'cudFilename', label: 'CUD' },
  { key: 'consentimiento', field: 'consentimientoPdf', tieneField: 'consentimientoTiene', filenameField: 'consentimientoFilename', label: 'Consentimiento de los padres' },
  { key: 'presupuesto', field: 'presupuestoPdf', tieneField: 'presupuestoTiene', filenameField: 'presupuestoFilename', label: 'Presupuesto' },
  { key: 'informe', field: 'informePdf', tieneField: 'informeTiene', filenameField: 'informeFilename', label: 'Informe inicial' },
  { key: 'plan', field: 'planPdf', tieneField: 'planTiene', filenameField: 'planFilename', label: 'Plan de trabajo' },
  { key: 'historial', field: 'historialPdf', tieneField: 'historialTiene', filenameField: 'historialFilename', label: 'Resumen historial clínico' },
  { key: 'pedidos', field: 'pedidosPdf', tieneField: 'pedidosTiene', filenameField: 'pedidosFilename', label: 'Pedidos médicos' },
];

function PanelExpediente({ admision, onActualizar, alAbrirPaciente, alNavegar }) {
  const { refrescarPacientes } = usePacientes();
  const [expediente, setExpediente] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [archivos, setArchivos] = useState({});
  const [campos, setCampos] = useState({ numeroAfiliado: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [admitidoModal, setAdmitidoModal] = useState(null); // { patientId, nombre, mensaje }
  const [visorAbierto, setVisorAbierto] = useState(null); // { key, label }
  const fileRefs = useRef({});

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await obtenerExpedienteAdmisionApi(admision.id);
      if (data) {
        setExpediente(data);
        setCampos({
          numeroAfiliado: data.numeroAfiliado || '',
        });
      }
    } finally {
      setCargando(false);
    }
  }, [admision.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleFileChange = (campo, file) => {
    if (file && file.size > 15 * 1024 * 1024) {
      alert('El archivo no debe superar los 15MB.');
      return;
    }
    setArchivos((prev) => ({ ...prev, [campo]: file }));
  };

  const handleGuardar = async () => {
    setGuardando(true);
    setError('');
    setExito('');
    try {
      const fd = new FormData();
      fd.append('dniNumero', admision.dni || '');
      fd.append('numeroAfiliado', campos.numeroAfiliado || '');
      for (const doc of DOCUMENTOS_PDF) {
        if (archivos[doc.key]) {
          fd.append(`${doc.key}_pdf`, archivos[doc.key]);
        }
      }
      const dataActualizada = await guardarExpedienteAdmisionApi(admision.id, fd);
      if (dataActualizada) {
        setExpediente(dataActualizada);
        setCampos({
          numeroAfiliado: dataActualizada.numeroAfiliado || '',
        });
      } else {
        await cargar();
      }
      setArchivos({});
      setExito('Expediente guardado correctamente.');
      if (onActualizar) onActualizar();
      setTimeout(() => setExito(''), 4000);
    } catch (err) {
      setError(err.message || 'No se pudo guardar el expediente.');
      throw err;
    } finally {
      setGuardando(false);
    }
  };

  const isDocCargado = (doc) => Boolean((expediente && expediente[doc.tieneField]) || archivos[doc.key]);
  const docsCargadosCount = DOCUMENTOS_PDF.filter(isDocCargado).length;
  const totalDocs = DOCUMENTOS_PDF.length;
  const todosPdfsCargados = docsCargadosCount === totalDocs;
  const docsFaltantes = DOCUMENTOS_PDF.filter((doc) => !isDocCargado(doc));

  const handleFinalizar = async () => {
    if (!todosPdfsCargados) {
      setError(`Debés adjuntar todos los PDFs requeridos antes de admitir al paciente. Faltan: ${docsFaltantes.map(d => d.label).join(', ')}.`);
      return;
    }
    if (!window.confirm('¿Finalizar los 3 pasos de admisión y admitir formalmente al paciente en el sistema?')) {
      return;
    }
    setGuardando(true);
    setError('');
    try {
      if (
        Object.keys(archivos).length > 0 ||
        campos.numeroAfiliado !== (expediente?.numeroAfiliado || '')
      ) {
        await handleGuardar();
      }
      const res = await finalizarAdmisionApi(admision.id);
      if (refrescarPacientes) {
        await refrescarPacientes();
      }
      setExito(res.mensaje || '¡Paciente admitido con éxito!');
      setAdmitidoModal({
        patientId: res.patientId,
        nombre: `${admision.apellido}, ${admision.nombre}`,
        mensaje: res.mensaje,
      });
      if (onActualizar) onActualizar();
    } catch (err) {
      setError(err.message || 'No se pudo finalizar la admisión.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-10">
        <span className="material-symbols-outlined animate-spin text-3xl text-[#006d44]/40">progress_activity</span>
      </div>
    );
  }

  if (admision.estado !== 'aprobado' && admision.estado !== 'completado') {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
        <span className="material-symbols-outlined mb-2 block text-3xl text-slate-300">lock</span>
        <p className="text-sm font-medium text-slate-500">
          El expediente se habilitará una vez que la Fisiatra apruebe al paciente.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Visor de PDF modal */}
      {visorAbierto && (
        <VisorPdf
          admisionId={admision.id}
          campo={visorAbierto.key}
          label={visorAbierto.label}
          onCerrar={() => setVisorAbierto(null)}
        />
      )}

      {/* Modal de confirmación de admisión exitosa */}
      {admitidoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-fade-in text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-[#006d44]">
              <span className="material-symbols-outlined text-3xl">how_to_reg</span>
            </div>
            <h3 className="text-xl font-extrabold text-slate-800">
              ¡Paciente Admitido con Éxito!
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              El proceso de los 3 pasos (Datos, Revisión Fisiatra y Expediente) ha concluido.
            </p>
            <div className="mt-4 rounded-2xl bg-slate-50 p-3.5 border border-slate-200 text-left">
              <p className="text-xs font-semibold text-slate-500 uppercase">Paciente</p>
              <p className="text-sm font-bold text-slate-800">{admitidoModal.nombre}</p>
              <p className="mt-1 text-xs text-[#006d44] font-semibold">
                ID de paciente: <span className="font-mono">{admitidoModal.patientId}</span>
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-2.5">
              {alAbrirPaciente && (
                <button
                  type="button"
                  onClick={() => {
                    setAdmitidoModal(null);
                    alAbrirPaciente(admitidoModal.patientId);
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#006d44] py-3 text-sm font-bold text-white shadow-md hover:bg-[#005a38] transition"
                >
                  <span className="material-symbols-outlined text-base">person</span>
                  Ir a la ficha del paciente
                </button>
              )}
              {alNavegar && (
                <button
                  type="button"
                  onClick={() => {
                    setAdmitidoModal(null);
                    alNavegar('patients');
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  <span className="material-symbols-outlined text-base">groups</span>
                  Ver lista general de pacientes
                </button>
              )}
              <button
                type="button"
                onClick={() => setAdmitidoModal(null)}
                className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-700"
              >
                Permanecer en admisiones
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {/* Banner de estado completado */}
        {admision.estado === 'completado' && (
          <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-50 p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#006d44] text-white">
                <span className="material-symbols-outlined text-xl">verified</span>
              </span>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide text-[#006d44]">
                  Paciente Admitido en el Sistema
                </p>
                <p className="text-xs font-semibold text-slate-700">
                  {admision.patientId ? `ID en padrón: ${admision.patientId}` : 'Proceso de admisión completado'}
                </p>
              </div>
            </div>
            {alAbrirPaciente && admision.patientId && (
              <button
                type="button"
                onClick={() => alAbrirPaciente(admision.patientId)}
                className="flex items-center gap-1.5 rounded-xl bg-[#006d44] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#005a38] transition"
              >
                <span className="material-symbols-outlined text-sm">open_in_new</span>
                Ver en Lista de Pacientes
              </button>
            )}
          </div>
        )}

        {/* Campos de texto */}
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Número de afiliado
            </label>
            <input
              type="text"
              value={campos.numeroAfiliado}
              onChange={(e) => setCampos((c) => ({ ...c, numeroAfiliado: e.target.value }))}
              placeholder="Ej: 12345-6"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-[#006d44] focus:outline-none"
            />
          </div>
        </div>

        {/* Documentos PDF */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Documentos PDF del Expediente
            </p>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                todosPdfsCargados
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-amber-300 bg-amber-50 text-amber-800'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${todosPdfsCargados ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {docsCargadosCount} de {totalDocs} PDFs cargados
            </span>
          </div>

          {DOCUMENTOS_PDF.map((doc) => {
            const yaSubido = expediente && expediente[doc.tieneField];
            const filename = expediente && expediente[doc.filenameField];
            const nuevo = archivos[doc.key];
            return (
              <div
                key={doc.key}
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-all ${
                  nuevo
                    ? 'border-emerald-400 bg-emerald-50/90 shadow-2xs'
                    : yaSubido
                    ? 'border-emerald-300 bg-emerald-50/40'
                    : 'border-slate-200 bg-slate-50/80'
                }`}
              >
                <span className={`material-symbols-outlined text-xl flex-shrink-0 ${
                  nuevo ? 'text-[#006d44]' : yaSubido ? 'text-emerald-600' : 'text-slate-400'
                }`}>
                  picture_as_pdf
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800">{doc.label}</p>
                  {nuevo ? (
                    <p className="text-[11px] font-bold text-[#006d44] truncate flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">upload</span>
                      Listo para guardar: {nuevo.name}
                    </p>
                  ) : yaSubido ? (
                    <p className="text-[11px] font-semibold text-emerald-700 truncate flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">check_circle</span>
                      {filename || 'Archivo guardado'}
                    </p>
                  ) : (
                    <p className="text-[11px] font-medium text-amber-700 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      Sin archivo adjunto (Pendiente)
                    </p>
                  )}
                </div>

                {/* Botones de acción */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {yaSubido && (
                    <button
                      type="button"
                      onClick={() => setVisorAbierto({ key: doc.key, label: doc.label })}
                      className="flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition"
                    >
                      <span className="material-symbols-outlined text-xs">visibility</span>
                      Ver PDF
                    </button>
                  )}
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    ref={(el) => (fileRefs.current[doc.key] = el)}
                    className="hidden"
                    onChange={(e) => handleFileChange(doc.key, e.target.files?.[0] || null)}
                  />
                  <button
                    type="button"
                    onClick={() => fileRefs.current[doc.key]?.click()}
                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                      nuevo
                        ? 'border-emerald-600 bg-[#006d44] text-white hover:bg-[#005a38]'
                        : yaSubido
                        ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                        : 'border-slate-300 bg-white text-slate-800 hover:border-[#006d44] hover:text-[#006d44]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xs">upload_file</span>
                    {nuevo ? 'Cambiar PDF' : yaSubido ? 'Reemplazar PDF' : 'Adjuntar PDF'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Resumen de archivos a subir */}
        {Object.keys(archivos).length > 0 && (
          <div className="rounded-xl bg-[#006d44]/10 border border-[#006d44]/30 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#006d44] text-base">cloud_upload</span>
              <p className="text-xs font-bold text-[#006d44]">
                {Object.keys(archivos).length} PDF(s) seleccionado(s) pendiente(s) de guardar
              </p>
            </div>
            <span className="text-[11px] font-semibold text-[#006d44]">Hacé clic en "Guardar expediente" abajo</span>
          </div>
        )}

        {/* Aviso de validación de PDFs cuando está en estado aprobado */}
        {admision.estado === 'aprobado' && (
          !todosPdfsCargados ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                <span className="material-symbols-outlined text-amber-600 text-base">warning</span>
                <span>Expediente incompleto ({docsCargadosCount}/{totalDocs} PDFs cargados)</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                El botón para validar y admitir al paciente en la lista de pacientes aparecerá únicamente cuando se hayan adjuntado todos los PDFs requeridos.
              </p>
              {docsFaltantes.length > 0 && (
                <div className="pt-1">
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">
                    Documentos pendientes ({docsFaltantes.length}):
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {docsFaltantes.map((d) => (
                      <span
                        key={d.key}
                        className="inline-flex items-center gap-1 rounded-md bg-white border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
                      >
                        <span className="h-1 w-1 rounded-full bg-amber-400" />
                        {d.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#006d44] text-white">
                  <span className="material-symbols-outlined text-base">task_alt</span>
                </span>
                <div>
                  <p className="text-xs font-bold text-[#006d44]">
                    ¡Todos los PDFs cargados ({totalDocs}/{totalDocs})!
                  </p>
                  <p className="text-[11px] text-slate-600">
                    El expediente está completo. Ya podés validar y admitir al paciente en la lista general.
                  </p>
                </div>
              </div>
            </div>
          )
        )}

        {error && (
          <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-600 flex items-center gap-2 border border-rose-200">
            <span className="material-symbols-outlined text-sm">error</span>
            {error}
          </p>
        )}
        {exito && (
          <p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800 flex items-center gap-2 border border-emerald-200">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            {exito}
          </p>
        )}

        {/* Botones de acción principal */}
        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <button
            type="button"
            onClick={handleGuardar}
            disabled={guardando}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-100 border border-slate-300 px-6 py-2.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-200 disabled:opacity-60 transition"
          >
            {guardando ? (
              <>
                <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                Guardando...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">save</span>
                {admision.estado === 'completado' ? 'Actualizar documentos' : 'Guardar borrador de expediente'}
              </>
            )}
          </button>
          {admision.estado === 'aprobado' && todosPdfsCargados && (
            <button
              type="button"
              id="btn-validar-admitir"
              onClick={handleFinalizar}
              disabled={guardando}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-[#006d44] bg-[#006d44] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#005a38] disabled:opacity-60 transition animate-fade-in"
            >
              <span className="material-symbols-outlined text-base">how_to_reg</span>
              Validar y Admitir Paciente
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel lateral de detalle de admisión (gestor de pestañas)
// ─────────────────────────────────────────────────────────────────────────────
function PanelDetalle({ admision, onCerrar, onActualizar, alAbrirPaciente, alNavegar }) {
  const [pestana, setPestana] = useState('datos');
  const [tieneOS, setTieneOS] = useState(admision.tieneObraSocial);
  const [nombreOS, setNombreOS] = useState(admision.obraSocialNombre || '');
  const [tieneCUD, setTieneCUD] = useState(admision.tieneCUD);
  const [guardandoDoc, setGuardandoDoc] = useState(false);
  const [docError, setDocError] = useState('');
  const [obrasSociales, setObrasSociales] = useState([]);
  const [busquedaOS, setBusquedaOS] = useState('');

  React.useEffect(() => {
    if (tieneOS && obrasSociales.length === 0) {
      obtenerObrasSocialesApi()
        .then((data) => setObrasSociales(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  }, [tieneOS]);

  React.useEffect(() => {
    setTieneOS(admision.tieneObraSocial);
    setNombreOS(admision.obraSocialNombre || '');
    setTieneCUD(admision.tieneCUD);
  }, [admision.id, admision.tieneObraSocial, admision.obraSocialNombre, admision.tieneCUD]);

  const guardarDocumentacion = async () => {
    setGuardandoDoc(true);
    setDocError('');
    try {
      await actualizarAdmisionApi(admision.id, {
        tieneObraSocial: tieneOS,
        obraSocialNombre: tieneOS ? nombreOS : '',
        tieneCUD,
      });
      onActualizar();
    } catch (err) {
      setDocError(err.message || 'No se pudo guardar.');
    } finally {
      setGuardandoDoc(false);
    }
  };

  const TABS = [
    { key: 'datos', label: 'Datos', icon: 'person' },
    { key: 'revision', label: 'Revisión Fisiatra', icon: 'stethoscope' },
    { key: 'expediente', label: 'Expediente', icon: 'folder_open' },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Cabecera */}
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {admision.apellido}, {admision.nombre}
            </h2>
            <div className="mt-1 flex items-center gap-2">
              <BadgeEstado estado={admision.estado} />
              {admision.patientId && (
                <span className="text-[11px] font-mono font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  ID: {admision.patientId}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 transition"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-1">
          {TABS.map((tab) => {
            const isSelected = pestana === tab.key;
            let unselectedStyle = 'text-slate-500 hover:bg-slate-100';
            let icon = tab.icon;

            if (tab.key === 'revision') {
              if (admision.estado === 'aprobado' || admision.estado === 'completado') {
                unselectedStyle = 'text-[#006d44] bg-[#006d44]/5 hover:bg-[#006d44]/10';
                icon = 'check_circle';
              } else if (admision.estado === 'desestimado') {
                unselectedStyle = 'text-rose-600 bg-rose-50 hover:bg-rose-100';
                icon = 'cancel';
              }
            }

            if (tab.key === 'expediente') {
              if (admision.estado === 'completado') {
                unselectedStyle = 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100';
                icon = 'task_alt';
              }
            }

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setPestana(tab.key)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  isSelected ? 'bg-[#006d44] text-white shadow-sm' : unselectedStyle
                }`}
              >
                <span className="material-symbols-outlined text-sm">{icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {pestana === 'datos' && (
          <div className="space-y-2">
            {admision.patientId && alAbrirPaciente && (
              <div className="mb-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#006d44]">check_circle</span>
                  <div>
                    <p className="text-xs font-bold text-[#006d44]">Paciente Admitido</p>
                    <p className="text-[11px] text-slate-600">Este paciente ya forma parte del padrón de CENEIN.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => alAbrirPaciente(admision.patientId)}
                  className="flex items-center gap-1 rounded-lg bg-[#006d44] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#005a38] transition"
                >
                  <span className="material-symbols-outlined text-xs">open_in_new</span>
                  Ver Ficha
                </button>
              </div>
            )}

            {[
              ['Nombre completo', `${admision.apellido}, ${admision.nombre}`],
              ['DNI', admision.dni || '-'],
              ['Fecha de nacimiento', admision.fechaNacimiento
                ? new Date(admision.fechaNacimiento).toLocaleDateString('es-AR', { timeZone: 'UTC' })
                : '-'],
              ['Teléfono', admision.telefono || '-'],
              ['Domicilio', admision.domicilio || '-'],
              ['Registrado el', admision.creadoEn ? new Date(admision.creadoEn).toLocaleDateString('es-AR') : '-'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-center gap-3 rounded-lg bg-slate-100 px-3 py-1.5 border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{label}</span>
                <span className="text-xs font-bold text-slate-900 text-right">{value}</span>
              </div>
            ))}

            {/* Tarjetas interactivas OS / CUD */}
            <div className="pt-1 space-y-1.5">
              <div className="grid grid-cols-2 gap-2">
                {/* Obra Social */}
                <button
                  type="button"
                  onClick={() => setTieneOS((v) => !v)}
                  className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 shadow-2xs transition-all ${
                    tieneOS
                      ? 'border-[#006d44] bg-emerald-50 text-[#004d30] font-bold'
                      : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                      tieneOS ? 'bg-[#006d44] text-white' : 'bg-slate-300 text-slate-600'
                    }`}>
                      <span className="material-symbols-outlined" style={{fontSize:'12px'}}>health_and_safety</span>
                    </span>
                    <span className="text-xs font-bold">Obra Social</span>
                  </div>
                  <div className={`flex h-3.5 w-6 flex-shrink-0 items-center rounded-full px-0.5 transition-all ${
                    tieneOS ? 'justify-end bg-[#006d44]' : 'justify-start bg-slate-400'
                  }`}>
                    <div className="h-2.5 w-2.5 rounded-full bg-white shadow-xs" />
                  </div>
                </button>

                {/* CUD */}
                <button
                  type="button"
                  onClick={() => setTieneCUD((v) => !v)}
                  className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 shadow-2xs transition-all ${
                    tieneCUD
                      ? 'border-violet-600 bg-violet-50 text-violet-900 font-bold'
                      : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                      tieneCUD ? 'bg-violet-600 text-white' : 'bg-slate-300 text-slate-600'
                    }`}>
                      <span className="material-symbols-outlined" style={{fontSize:'12px'}}>verified</span>
                    </span>
                    <span className="text-xs font-bold">CUD</span>
                  </div>
                  <div className={`flex h-3.5 w-6 flex-shrink-0 items-center rounded-full px-0.5 transition-all ${
                    tieneCUD ? 'justify-end bg-violet-600' : 'justify-start bg-slate-400'
                  }`}>
                    <div className="h-2.5 w-2.5 rounded-full bg-white shadow-xs" />
                  </div>
                </button>
              </div>

              {/* Selector compacto de alta legibilidad para Obra Social */}
              {tieneOS && (
                <div className="rounded-lg border border-emerald-300 bg-emerald-50/90 p-1.5 space-y-1 shadow-2xs">
                  {nombreOS ? (
                    <div className="flex items-center justify-between rounded-md bg-[#006d44] px-2.5 py-1 text-white shadow-2xs">
                      <span className="text-xs font-bold truncate">OS: {nombreOS}</span>
                      <button
                        type="button"
                        onClick={() => { setNombreOS(''); setBusquedaOS(''); }}
                        className="text-white/80 hover:text-white ml-2 flex items-center gap-0.5 text-xs font-semibold underline"
                      >
                        Cambiar
                        <span className="material-symbols-outlined" style={{fontSize:'13px'}}>close</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" style={{fontSize:'14px'}}>search</span>
                        <input
                          type="text"
                          value={busquedaOS}
                          onChange={(e) => setBusquedaOS(e.target.value)}
                          placeholder="Buscar obra social..."
                          className="w-full rounded-md border border-slate-300 bg-white py-1 pl-6 pr-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-[#006d44] focus:outline-none focus:ring-1 focus:ring-[#006d44]"
                        />
                      </div>
                      <ul className="max-h-20 overflow-y-auto space-y-0 rounded-md bg-white border border-slate-300 divide-y divide-slate-100 shadow-inner">
                        {obrasSociales
                          .filter((os) =>
                            !busquedaOS ||
                            os.label.toLowerCase().includes(busquedaOS.toLowerCase())
                          )
                          .map((os) => (
                            <li key={os.id}>
                              <button
                                type="button"
                                onClick={() => { setNombreOS(os.label); setBusquedaOS(''); }}
                                className="flex w-full items-center gap-1.5 px-2 py-0.5 text-left text-xs font-medium text-slate-800 hover:bg-[#006d44] hover:text-white transition-colors"
                              >
                                {os.label}
                              </button>
                            </li>
                          ))}
                        {obrasSociales.filter((os) =>
                          !busquedaOS ||
                          os.label.toLowerCase().includes(busquedaOS.toLowerCase())
                        ).length === 0 && (
                          <li className="px-2 py-1 text-[11px] font-semibold text-slate-500">Sin resultados</li>
                        )}
                      </ul>
                    </>
                  )}
                </div>
              )}

              {/* Botón guardar cambios de documentación */}
              {(tieneOS !== admision.tieneObraSocial ||
                nombreOS !== (admision.obraSocialNombre || '') ||
                tieneCUD !== admision.tieneCUD) && (
                <div className="space-y-1">
                  {docError && <p className="text-xs text-rose-600">{docError}</p>}
                  <button
                    type="button"
                    onClick={guardarDocumentacion}
                    disabled={guardandoDoc}
                    className="w-full rounded-xl bg-[#006d44] py-2 text-sm font-semibold text-white hover:bg-[#005a38] disabled:opacity-60"
                  >
                    {guardandoDoc ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {pestana === 'revision' && (
          <PanelRevisionFisiatra admision={admision} onActualizar={onActualizar} />
        )}

        {pestana === 'expediente' && (
          <PanelExpediente
            admision={admision}
            onActualizar={onActualizar}
            alAbrirPaciente={alAbrirPaciente}
            alNavegar={alNavegar}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal: Admision
// ─────────────────────────────────────────────────────────────────────────────
export default function Admision({ alAbrirPaciente, alNavegar }) {
  const [admisiones, setAdmisiones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [seleccionada, setSeleccionada] = useState(null);
  const [eliminando, setEliminando] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = await obtenerAdmisionesApi();
      setAdmisiones(data);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las admisiones.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleNuevaAdmision = (creada) => {
    setMostrarForm(false);
    setAdmisiones((prev) => [creada, ...prev]);
    setSeleccionada(creada);
  };

  const handleEliminar = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('¿Eliminar esta admisión?')) return;
    setEliminando(id);
    try {
      await eliminarAdmisionApi(id);
      setAdmisiones((prev) => prev.filter((a) => a.id !== id));
      if (seleccionada?.id === id) setSeleccionada(null);
    } catch (err) {
      alert(err.message || 'No se pudo eliminar.');
    } finally {
      setEliminando(null);
    }
  };

  const handleActualizarDetalle = async () => {
    const data = await obtenerAdmisionesApi();
    setAdmisiones(data);
    if (seleccionada) {
      const actualizada = data.find((a) => a.id === seleccionada.id);
      if (actualizada) setSeleccionada(actualizada);
    }
  };

  const admisionesFiltradas = admisiones.filter((a) => {
    if (!filtro) return true;
    const q = filtro.toLowerCase();
    return (
      (a.nombre || '').toLowerCase().includes(q) ||
      (a.apellido || '').toLowerCase().includes(q) ||
      (a.dni || '').includes(q)
    );
  });

  // Agrupar por estado para mostrar
  const grupos = [
    { key: 'pendiente_turno', label: 'Pendiente turno' },
    { key: 'aprobado', label: 'Armando expediente' },
    { key: 'completado', label: 'Completados' },
    { key: 'desestimado', label: 'Desestimados' },
  ];

  return (
    <div className="flex h-[calc(100vh-65px)] flex-col">
      {/* ── Header ── */}
      <div className="border-b border-slate-200 bg-white px-6 py-4 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-[#006d44]">Admisión</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Proceso de ingreso de nuevos pacientes a CENEIN
            </p>
          </div>
          <button
            id="btn-nueva-admision"
            type="button"
            onClick={() => setMostrarForm(true)}
            className="flex items-center gap-2 self-start rounded-2xl bg-[#006d44] px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-[#005a38] sm:self-auto transition"
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            Nueva admisión
          </button>
        </div>
      </div>

      {/* ── Cuerpo ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Lista */}
        <div
          className={`flex flex-col border-r border-slate-200 bg-white transition-all ${
            seleccionada ? 'w-full sm:w-[420px]' : 'w-full'
          }`}
        >
          {/* Buscador + contador */}
          <div className="border-b border-slate-100 px-5 py-3">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                search
              </span>
              <input
                type="text"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar por nombre, apellido o DNI..."
                className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm focus:border-[#006d44] focus:outline-none focus:ring-2 focus:ring-[#006d44]/20"
              />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {admisionesFiltradas.length}{' '}
              {admisionesFiltradas.length === 1 ? 'admisión' : 'admisiones'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {cargando ? (
              <div className="flex h-full items-center justify-center py-16">
                <span className="material-symbols-outlined animate-spin text-3xl text-[#006d44]/40">
                  progress_activity
                </span>
              </div>
            ) : error ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-rose-600">{error}</p>
                <button
                  type="button"
                  onClick={cargar}
                  className="mt-3 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Reintentar
                </button>
              </div>
            ) : admisionesFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
                <span className="material-symbols-outlined mb-3 text-5xl text-slate-200">
                  folder_open
                </span>
                <p className="text-sm font-medium text-slate-500">
                  {filtro ? 'No hay admisiones que coincidan con la búsqueda.' : 'Todavía no hay admisiones registradas.'}
                </p>
                {!filtro && (
                  <button
                    type="button"
                    onClick={() => setMostrarForm(true)}
                    className="mt-4 rounded-2xl bg-[#006d44] px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    Registrar primera admisión
                  </button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {admisionesFiltradas.map((admision) => (
                  <li key={admision.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setSeleccionada((prev) =>
                          prev?.id === admision.id ? null : admision
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSeleccionada((prev) =>
                            prev?.id === admision.id ? null : admision
                          );
                        }
                      }}
                      className={`group w-full cursor-pointer px-5 py-4 text-left transition hover:bg-slate-50 ${
                        seleccionada?.id === admision.id ? 'bg-[#f0faf4] border-l-2 border-[#006d44]' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        {/* Avatar */}
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#d6ffe8] font-bold text-[#006d44] text-sm">
                          {admision.apellido?.[0]?.toUpperCase()}
                          {admision.nombre?.[0]?.toUpperCase()}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {admision.apellido}, {admision.nombre}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {admision.dni ? `DNI: ${admision.dni}` : 'Sin DNI registrado'}
                            {admision.telefono ? ` · ${admision.telefono}` : ''}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <BadgeEstado estado={admision.estado} />
                            {admision.tieneObraSocial && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                                <span className="material-symbols-outlined text-xs">health_and_safety</span>
                                OS
                              </span>
                            )}
                            {admision.tieneCUD && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600">
                                <span className="material-symbols-outlined text-xs">verified</span>
                                CUD
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleEliminar(admision.id, e)}
                          disabled={eliminando === admision.id}
                          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Panel de detalle */}
        {seleccionada && (
          <div className="hidden flex-1 overflow-hidden sm:flex sm:flex-col bg-white">
            <PanelDetalle
              admision={seleccionada}
              onCerrar={() => setSeleccionada(null)}
              onActualizar={handleActualizarDetalle}
              alAbrirPaciente={alAbrirPaciente}
              alNavegar={alNavegar}
            />
          </div>
        )}
      </div>

      {/* Modal wizard nueva admisión */}
      {mostrarForm && (
        <WizardNuevaAdmision
          onGuardar={handleNuevaAdmision}
          onCancelar={() => setMostrarForm(false)}
        />
      )}
    </div>
  );
}
