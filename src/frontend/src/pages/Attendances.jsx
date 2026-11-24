import React, { useEffect, useMemo, useState } from 'react';
import { usePacientes } from '../context/PatientsContext';
import { exportarAsistenciasPdf } from '../services/api';

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const DIAS_COMPLETO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function normalizarTextoFiltro(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function nombreCompletoApellidoNombre(paciente) {
  const apellido = String(paciente?.apellido || '').trim();
  const nombre = String(paciente?.nombre || '').trim();
  return `${apellido} ${nombre}`.trim() || String(paciente?.id || '');
}

function obtenerInicialesPaciente(paciente) {
  const apellido = String(paciente?.apellido || '').trim();
  const nombre = String(paciente?.nombre || '').trim();
  const iniciales = `${nombre.charAt(0)}${apellido.charAt(0)}`.trim();
  return iniciales.toUpperCase() || 'P';
}

function ordenarPacientesPorApellidoNombre(a, b) {
  const apellidoA = String(a?.apellido || '').trim();
  const apellidoB = String(b?.apellido || '').trim();
  const cmpApellido = apellidoA.localeCompare(apellidoB, 'es', {
    sensitivity: 'base',
  });
  if (cmpApellido !== 0) return cmpApellido;
  const nombreA = String(a?.nombre || '').trim();
  const nombreB = String(b?.nombre || '').trim();
  const cmpNombre = nombreA.localeCompare(nombreB, 'es', {
    sensitivity: 'base',
  });
  if (cmpNombre !== 0) return cmpNombre;
  return String(a?.id || '').localeCompare(String(b?.id || ''), 'es', {
    sensitivity: 'base',
  });
}

function compararHoras(a, b) {
  const toMin = (value) => {
    const m = String(value || '').match(/^(\d{2}):(\d{2})$/);
    if (!m) return Number.MAX_SAFE_INTEGER;
    return Number(m[1]) * 60 + Number(m[2]);
  };
  return toMin(a) - toMin(b);
}

function formatearFechaCorta(value) {
  if (!value) return '-';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value);
  return `${match[3]}/${match[2]}/${match[1]}`;
}

const generarMesActual = () => {
  const hoy = new Date();
  return String(hoy.getMonth() + 1);
};

const generarFechasMes = (anio, mes) => {
  const fechas = [];
  const totalDias = new Date(anio, mes, 0).getDate();
  for (let dia = 1; dia <= totalDias; dia += 1) {
    const fecha = new Date(anio, mes - 1, dia);
    const dow = fecha.getDay();
    if (dow === 0 || dow === 6) continue;
    const nombreDia = DIAS_COMPLETO[dow];
    const fechaStr = `${anio}-${String(mes).padStart(2, '0')}-${String(
      dia
    ).padStart(2, '0')}`;
    fechas.push({ value: fechaStr, label: `${nombreDia} ${dia}` });
  }
  return fechas;
};

function descargarBlob(blob, nombre) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

function imprimirBlob(blob) {
  const url = window.URL.createObjectURL(blob);
  const popup = window.open('', '_blank');
  if (!popup) {
    window.URL.revokeObjectURL(url);
    window.alert('El navegador bloqueó la ventana de impresión. Habilitá popups para este sitio.');
    return;
  }
  popup.document.open();
  popup.document.write(
    `<!doctype html><html><head><title>Imprimir Asistencias</title></head><body style="margin:0">
      <iframe id="pdf" src="${url}" style="border:0;width:100vw;height:100vh"></iframe>
      <script>
        const frame = document.getElementById('pdf');
        frame.addEventListener('load', () => {
          try {
            frame.contentWindow.focus();
            frame.contentWindow.print();
          } catch (e) {}
        });
      </script>
    </body></html>`
  );
  popup.document.close();
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 30000);
}

async function detectarTipoBlob(blob) {
  const ab = await blob.arrayBuffer();
  const bytes = new Uint8Array(ab.slice(0, 4));
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  ) {
    return 'zip';
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return 'pdf';
  }
  return 'otro';
}

export default function Attendances() {
  const {
    pacientes,
    obrasSociales,
    pacienteSeleccionado,
    moverTurnosFecha,
    ultimoCambioFecha,
    deshacerUltimoCambioFecha,
    cambiarEstadoPaciente,
  } = usePacientes();

  const [modo, setModo] = useState('mes');
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [fecha, setFecha] = useState('');
  const [tratamiento, setTratamiento] = useState('');
  const [obraSocialFiltro, setObraSocialFiltro] = useState('');
  const [filtroAutorizacion, setFiltroAutorizacion] = useState('autorizados');
  const [busqueda, setBusqueda] = useState('');
  const [seleccion, setSeleccion] = useState(new Set());
  const [cargando, setCargando] = useState(false);

  // Cambio de fecha general
  const [cambioFechaVisible, setCambioFechaVisible] = useState(false);
  const [fechaMes, setFechaMes] = useState(generarMesActual());
  const [fechaOrigen, setFechaOrigen] = useState('');
  const [fechaDestino, setFechaDestino] = useState('');
  const [fechaTratamiento, setFechaTratamiento] = useState('');
  const [fechaSoloPaciente, setFechaSoloPaciente] = useState(false);
  const [fechaPacienteId, setFechaPacienteId] = useState('');
  const [fechaMensaje, setFechaMensaje] = useState('');
  const [fechaMensajeTipo, setFechaMensajeTipo] = useState('info');
  const [aplicandoCambio, setAplicandoCambio] = useState(false);
  const anioCambioFecha = Number(anio) || new Date().getFullYear();

  const [cronogramaModal, setCronogramaModal] = useState(null);

  const pacientesDisponibles = useMemo(
    () => (pacientes || []).sort(ordenarPacientesPorApellidoNombre),
    [pacientes]
  );

  const tratamientosDisponibles = useMemo(() => {
    const set = new Set();
    pacientesDisponibles.forEach((p) =>
      (p.tratamientos || []).forEach((t) => set.add(t))
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [pacientesDisponibles]);

  const pacientesOrdenados = useMemo(() => [...pacientesDisponibles], [pacientesDisponibles]);

  const fechasDisponibles = useMemo(() => {
    const mesNum = Number(fechaMes);
    if (!mesNum) return [];
    return generarFechasMes(anioCambioFecha, mesNum);
  }, [anioCambioFecha, fechaMes]);

  useEffect(() => {
    if (pacienteSeleccionado?.id) {
      setFechaPacienteId(pacienteSeleccionado.id);
    }
  }, [pacienteSeleccionado?.id]);

  useEffect(() => {
    if (!fechasDisponibles.length) {
      setFechaOrigen('');
      setFechaDestino('');
      return;
    }
    if (!fechaOrigen) setFechaOrigen(fechasDisponibles[0].value);
    if (!fechaDestino) {
      const destino = fechasDisponibles[1] || fechasDisponibles[0];
      setFechaDestino(destino.value);
    }
  }, [fechasDisponibles, fechaOrigen, fechaDestino]);

  const diaFiltro = useMemo(() => {
    if (!fecha) return '';
    const d = new Date(`${fecha}T00:00:00`);
    if (Number.isNaN(d.getTime())) return '';
    return DIAS_CORTOS[d.getDay()] || '';
  }, [fecha]);

  const pacientesFiltrados = useMemo(() => {
    const mesNum = Number(mes);
    const tratamientoSel = normalizarTextoFiltro(tratamiento);
    const obraSocialSel = normalizarTextoFiltro(obraSocialFiltro);
    const autorizacionSel = String(filtroAutorizacion || '').trim();
    const q = normalizarTextoFiltro(busqueda);

    return pacientesDisponibles
      .filter((p) => {
        if (autorizacionSel === 'autorizados' && p?.activo === false) return false;
        if (autorizacionSel === 'no_autorizados' && p?.activo !== false) return false;

        const tratamientosPaciente = Array.isArray(p.tratamientos)
          ? p.tratamientos.map((t) => String(t || '').trim()).filter(Boolean)
          : [];
        const tieneTratamientoSeleccionado = tratamientoSel
          ? tratamientosPaciente.some(
              (t) => normalizarTextoFiltro(t) === tratamientoSel
            )
          : true;
        if (!tieneTratamientoSeleccionado) return false;

        const obraPaciente = String(p.obraSocial || '').trim();
        if (
          obraSocialSel &&
          normalizarTextoFiltro(obraPaciente) !== obraSocialSel
        ) {
          return false;
        }

        const turnosMes = (p.turnosPorMes || {})[mesNum] || {};
        const tratamientosKeys = tratamientoSel
          ? Object.keys(turnosMes).filter(
              (t) => normalizarTextoFiltro(t) === tratamientoSel
            )
          : Object.keys(turnosMes);
        const turnos = tratamientosKeys.flatMap((t) => turnosMes[t] || []);
        if (!tratamientoSel && !turnos.length) return false;
        if (modo === 'dia' && diaFiltro) {
          if (!turnos.length) return false;
          const coincideDia = turnos.some((k) => String(k).startsWith(`${diaFiltro}-`));
          if (!coincideDia) return false;
        }
        if (!q) return true;
        const nombre = normalizarTextoFiltro(
          `${p.nombre || ''} ${p.apellido || ''}`.trim()
        );
        const obra = normalizarTextoFiltro(p.obraSocial || '');
        const prestaciones = normalizarTextoFiltro(
          (p.tratamientos || []).join(' ')
        );
        return nombre.includes(q) || obra.includes(q) || prestaciones.includes(q);
      })
      .sort(ordenarPacientesPorApellidoNombre);
  }, [pacientesDisponibles, mes, tratamiento, obraSocialFiltro, filtroAutorizacion, modo, diaFiltro, busqueda]);

  const togglePaciente = (id) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const alternarAutorizacionDesdeAsistencias = (paciente) => {
    if (!paciente?.id) return;
    const autorizar = paciente?.activo === false;
    const mensaje = autorizar
      ? `¿Deseás autorizar a ${nombreCompletoApellidoNombre(paciente)}?`
      : `¿Deseás marcar como no autorizado a ${nombreCompletoApellidoNombre(paciente)}?`;
    if (!window.confirm(mensaje)) return;
    cambiarEstadoPaciente(paciente.id, autorizar);
  };

  const seleccionarTodos = () => {
    const ids = pacientesFiltrados.map((p) => p.id);
    setSeleccion(new Set(ids));
  };

  const limpiarSeleccion = () => setSeleccion(new Set());

  const aplicarCambioFecha = async () => {
    setFechaMensaje('');
    setFechaMensajeTipo('info');
    if (!fechaOrigen) return;
    if (!fechaDestino) return;
    if (fechaOrigen === fechaDestino) {
      setFechaMensaje('La fecha origen y destino no pueden ser iguales.');
      setFechaMensajeTipo('error');
      return;
    }
    const patientId = fechaSoloPaciente ? fechaPacienteId : null;
    if (fechaSoloPaciente && !patientId) {
      setFechaMensaje('Seleccioná un paciente para aplicar el cambio.');
      setFechaMensajeTipo('error');
      return;
    }
    if (!fechaSoloPaciente) {
      const ok = window.confirm(
        '¿Estás seguro de mover los turnos para todos los pacientes registrados?'
      );
      if (!ok) return;
    }
    setAplicandoCambio(true);
    try {
      const tratamientoNormalizado = normalizarTextoFiltro(fechaTratamiento);
      const tratamientoPayload =
        !fechaTratamiento || tratamientoNormalizado === 'todos'
          ? undefined
          : fechaTratamiento;
      const resultado = await moverTurnosFecha({
        pacienteId: patientId || undefined,
        fechaOrigen,
        fechaDestino,
        tratamiento: tratamientoPayload,
        month: Number(fechaMes),
        year: anioCambioFecha,
      });
      const cantidad = resultado?.updated ?? 0;
      if (cantidad > 0) {
        setFechaMensaje(`Se movieron ${cantidad} turnos exitosamente.`);
        setFechaMensajeTipo('success');
      } else {
        setFechaMensaje(
          'No se encontró ningún turno para mover en esa fecha.'
        );
        setFechaMensajeTipo('warning');
      }
    } catch (err) {
      setFechaMensaje(String(err?.message || 'No se pudo aplicar el cambio de fecha.'));
      setFechaMensajeTipo('error');
    } finally {
      setAplicandoCambio(false);
    }
  };

  const volverCambioFecha = async () => {
    setFechaMensaje('');
    setFechaMensajeTipo('info');
    const patientId = fechaSoloPaciente ? fechaPacienteId : null;
    const tratamientoNormalizado = normalizarTextoFiltro(fechaTratamiento);
    const tratamientoPayload =
      !fechaTratamiento || tratamientoNormalizado === 'todos'
        ? undefined
        : fechaTratamiento;

    const payloadFallback =
      fechaOrigen && fechaDestino
        ? {
            pacienteId: patientId || undefined,
            fechaOrigen,
            fechaDestino,
            tratamiento: tratamientoPayload,
            month: Number(fechaMes),
            year: anioCambioFecha,
          }
        : null;

    const usandoSeleccionActual =
      payloadFallback &&
      (!ultimoCambioFecha ||
        ultimoCambioFecha.fechaOrigen !== payloadFallback.fechaOrigen ||
        ultimoCambioFecha.fechaDestino !== payloadFallback.fechaDestino ||
        Number(ultimoCambioFecha.month) !== Number(payloadFallback.month) ||
        Number(ultimoCambioFecha.year) !== Number(payloadFallback.year) ||
        String(ultimoCambioFecha.pacienteId || '') !==
          String(payloadFallback.pacienteId || '') ||
        String(ultimoCambioFecha.tratamiento || '') !==
          String(payloadFallback.tratamiento || ''));

    const payload = usandoSeleccionActual
      ? payloadFallback
      : ultimoCambioFecha || payloadFallback;
    if (!payload?.fechaOrigen || !payload?.fechaDestino) {
      setFechaMensaje('No hay un cambio previo para deshacer.');
      setFechaMensajeTipo('warning');
      return;
    }

    const fechaDesde = formatearFechaCorta(payload.fechaDestino);
    const fechaHacia = formatearFechaCorta(payload.fechaOrigen);
    const ok = window.confirm(
      `Se van a mover los turnos de ${fechaDesde} de regreso a ${fechaHacia}. ¿Deseás continuar?`
    );
    if (!ok) return;

    setAplicandoCambio(true);
    try {
      const resultado = await deshacerUltimoCambioFecha(payload);
      const cantidad = resultado?.updated ?? 0;
      if (cantidad > 0) {
        setFechaMensaje(`Se revirtieron ${cantidad} turnos correctamente.`);
        setFechaMensajeTipo('success');
      } else {
        setFechaMensaje(
          `No se encontró ningún turno para mover de ${fechaDesde} hacia ${fechaHacia}.`
        );
        setFechaMensajeTipo('warning');
      }
    } catch (err) {
      setFechaMensaje(
        String(err?.message || 'No se pudo revertir el cambio de fecha.')
      );
      setFechaMensajeTipo('error');
    } finally {
      setAplicandoCambio(false);
    }
  };

  const verCronogramaPaciente = (paciente) => {
    const mesNum = Number(mes);
    const turnosMes = (paciente?.turnosPorMes || {})[mesNum] || {};
    const tratamientosPaciente = Array.isArray(paciente?.tratamientos)
      ? paciente.tratamientos.map((t) => String(t || '').trim()).filter(Boolean)
      : [];
    const tratamientos = Array.from(
      new Set([
        ...tratamientosPaciente,
        ...Object.keys(turnosMes),
      ])
    ).sort((a, b) => a.localeCompare(b));

    const nombrePaciente =
      `${paciente?.nombre || ''} ${paciente?.apellido || ''}`.trim() ||
      paciente?.id ||
      'Paciente';
    const titulo = `Cronograma de ${nombrePaciente} - ${MESES[mesNum - 1] || mesNum} ${anio}`;

    if (!tratamientos.length) {
      setCronogramaModal({ titulo, tratamientos: [], nombrePaciente });
      return;
    }

    const ordenDias = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
    const detallesTratamientos = tratamientos.map((trat) => {
      const basePorDia = new Map();
      (turnosMes[trat] || []).forEach((clave) => {
        const [dia, hora] = String(clave || '').split('-');
        if (!dia || !hora) return;
        if (!basePorDia.has(dia)) basePorDia.set(dia, []);
        basePorDia.get(dia).push(hora);
      });
      const dias = [];
      ordenDias.forEach((dia) => {
        const horas = Array.from(new Set(basePorDia.get(dia) || [])).sort(compararHoras);
        if (horas.length) {
          dias.push({ dia, horas });
        }
      });
      return { trat, dias };
    });

    setCronogramaModal({ titulo, tratamientos: detallesTratamientos, nombrePaciente });
  };

  const generarUno = async (paciente, imprimir = false) => {
    const obraSocialId = String(paciente.obraSocial || '').trim();
    if (!obraSocialId) {
      window.alert(
        `El paciente ${paciente.nombre || ''} ${
          paciente.apellido || ''
        } no tiene obra social asignada.`
      );
      return;
    }
    setCargando(true);
    try {
      const blob = await exportarAsistenciasPdf({
        patientIds: [paciente.id],
        tratamiento: tratamiento || undefined,
        mes: Number(mes),
        anio: Number(anio),
        obraSocialId,
        formato: 'pdf',
      });
      if (imprimir) imprimirBlob(blob);
      else {
        descargarBlob(
          blob,
          `${obraSocialId}-${paciente.apellido || ''}_${paciente.nombre || ''}.pdf`
        );
      }
    } catch (err) {
      window.alert(`No se pudo generar el PDF: ${err?.message || 'Error del servidor'}`);
    } finally {
      setCargando(false);
    }
  };

  const exportarSeleccion = async (imprimir = false) => {
    const ids = Array.from(seleccion);
    if (!ids.length) {
      window.alert('Por favor seleccioná al menos un paciente marcando la casilla de la izquierda.');
      return;
    }
    setCargando(true);
    try {
      const blob = await exportarAsistenciasPdf({
        patientIds: ids,
        tratamiento: tratamiento || undefined,
        mes: Number(mes),
        anio: Number(anio),
        formato: imprimir ? 'pdf' : 'zip',
      });
      if (imprimir) imprimirBlob(blob);
      else {
        const tipo = await detectarTipoBlob(blob);
        if (tipo === 'zip') {
          descargarBlob(blob, `asistencias-${anio}-${String(mes).padStart(2, '0')}.zip`);
        } else if (tipo === 'pdf') {
          descargarBlob(blob, `asistencias-${anio}-${String(mes).padStart(2, '0')}.pdf`);
        } else {
          descargarBlob(blob, `asistencias-${anio}-${String(mes).padStart(2, '0')}.bin`);
        }
      }
    } catch (err) {
      window.alert(`No se pudo exportar: ${err?.message || 'Error del servidor'}`);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* Título Principal y Subtítulo claro */}
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 sm:text-4xl">
          Gestión de Asistencias
        </h2>
        <p className="mt-1 text-base text-slate-500">
          Control de asistencias mensuales y exportación de planillas de obras sociales.
        </p>
      </div>

      {/* Bloque 1: Cambio de fecha general (Familiar, claro y fácil de abrir) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <button
          type="button"
          onClick={() => setCambioFechaVisible((prev) => !prev)}
          className="flex w-full items-center justify-between text-left text-base font-bold text-slate-800 hover:text-[#006d44]"
        >
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[22px] text-amber-600">
              {cambioFechaVisible ? 'expand_more' : 'play_arrow'}
            </span>
            <span>Cambio de fecha general (Reasignación de turnos)</span>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">
            {cambioFechaVisible ? 'Ocultar' : 'Abrir opciones'}
          </span>
        </button>

        {cambioFechaVisible && (
          <div className="mt-5 border-t border-slate-100 pt-5 space-y-4 animate-fadeIn">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-600">Mes</label>
                <select
                  value={fechaMes}
                  onChange={(e) => setFechaMes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-medium text-slate-800 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
                >
                  {MESES.map((m, idx) => (
                    <option key={`fecha-mes-${m}`} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-600">De (Fecha actual)</label>
                <select
                  value={fechaOrigen}
                  onChange={(e) => setFechaOrigen(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-medium text-slate-800 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
                >
                  {fechasDisponibles.map((f) => (
                    <option key={`from-date-${f.value}`} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-600">A (Nueva fecha)</label>
                <select
                  value={fechaDestino}
                  onChange={(e) => setFechaDestino(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-medium text-slate-800 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
                >
                  {fechasDisponibles.map((f) => (
                    <option key={`to-date-${f.value}`} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-600">Tratamiento</label>
                <select
                  value={fechaTratamiento}
                  onChange={(e) => setFechaTratamiento(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-medium text-slate-800 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
                >
                  <option value="">Todos</option>
                  {tratamientosDisponibles.map((t) => (
                    <option key={`trat-${t}`} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-600">Aplicar a</label>
                <label className="flex h-[42px] cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={fechaSoloPaciente}
                    onChange={(e) => setFechaSoloPaciente(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#006d44] focus:ring-[#006d44]"
                  />
                  <span>Solo un paciente</span>
                </label>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-600">Elegir Paciente</label>
                <select
                  value={fechaPacienteId}
                  onChange={(e) => setFechaPacienteId(e.target.value)}
                  disabled={!fechaSoloPaciente}
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-medium text-slate-800 disabled:bg-slate-100 disabled:text-slate-400 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
                >
                  <option value="">(Seleccionar)</option>
                  {pacientesOrdenados.map((p) => (
                    <option key={`fecha-p-${p.id}`} value={p.id}>
                      {nombreCompletoApellidoNombre(p)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Mensajes de resultado */}
            {fechaMensaje && (
              <div
                className={`flex items-center justify-between rounded-xl p-3 text-sm font-semibold ${
                  fechaMensajeTipo === 'success'
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : fechaMensajeTipo === 'warning'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-rose-100 text-rose-900 border border-rose-300'
                }`}
              >
                <span>{fechaMensaje}</span>
                <button type="button" onClick={() => setFechaMensaje('')} className="text-slate-500 font-bold">
                  ✕
                </button>
              </div>
            )}

            {/* Botones de acción del cambio */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={aplicarCambioFecha}
                disabled={aplicandoCambio}
                className="rounded-xl bg-[#006d44] px-5 py-2.5 text-sm font-bold text-white shadow transition hover:bg-[#005837] disabled:opacity-50"
              >
                {aplicandoCambio ? 'Aplicando...' : 'Aplicar cambio'}
              </button>

              <button
                type="button"
                onClick={volverCambioFecha}
                disabled={aplicandoCambio || (!ultimoCambioFecha && (!fechaOrigen || !fechaDestino))}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                Volver cambios atrás
              </button>

              {ultimoCambioFecha?.fechaOrigen && ultimoCambioFecha?.fechaDestino && (
                <span className="text-xs font-semibold text-slate-500">
                  Último cambio: {formatearFechaCorta(ultimoCambioFecha.fechaOrigen)} ➔ {formatearFechaCorta(ultimoCambioFecha.fechaDestino)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bloque 2: Filtros de Búsqueda (Grandes, claros y legibles) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
          
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-600">Modo</label>
            <select
              value={modo}
              onChange={(e) => setModo(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-medium text-slate-800 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
            >
              <option value="mes">Por mes</option>
              <option value="dia">Por día</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-600">Mes</label>
            <select
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-medium text-slate-800 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
            >
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-600">Año</label>
            <input
              type="number"
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-medium text-slate-800 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-600">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              disabled={modo !== 'dia'}
              className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-medium text-slate-800 disabled:bg-slate-100 disabled:text-slate-400 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-600">Tratamiento</label>
            <select
              value={tratamiento}
              onChange={(e) => setTratamiento(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-medium text-slate-800 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
            >
              <option value="">Todos</option>
              {tratamientosDisponibles.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-600">Obra social</label>
            <select
              value={obraSocialFiltro}
              onChange={(e) => setObraSocialFiltro(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-medium text-slate-800 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
            >
              <option value="">Todas</option>
              {(obrasSociales || []).map((o) => (
                <option key={`fil-${o.id}`} value={o.id}>
                  {o.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-600">Autorización</label>
            <select
              value={filtroAutorizacion}
              onChange={(e) => setFiltroAutorizacion(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-medium text-slate-800 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
            >
              <option value="autorizados">Solo autorizados</option>
              <option value="no_autorizados">Solo no autorizados</option>
              <option value="todos">Todos</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-600">Buscar</label>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre, obra..."
              className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#006d44] focus:ring-2 focus:ring-[#d6ffe8]"
            />
          </div>
        </div>
      </div>

      {/* Bloque 3: Barra de Acciones y Selección */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        
        {/* Pacientes filtrados y botones de selección */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-slate-700">
            Pacientes filtrados: <strong className="text-slate-900 text-base">{pacientesFiltrados.length}</strong>
          </span>

          <button
            type="button"
            onClick={seleccionarTodos}
            disabled={cargando || pacientesFiltrados.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">select_all</span>
            <span>Seleccionar todos</span>
          </button>

          <button
            type="button"
            onClick={limpiarSeleccion}
            disabled={cargando || seleccion.size === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">deselect</span>
            <span>Limpiar selección</span>
          </button>
        </div>

        {/* Botones Grandes de Exportación */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => exportarSeleccion(false)}
            disabled={cargando}
            className="inline-flex items-center gap-2 rounded-xl bg-[#006d44] px-6 py-3 text-sm font-bold text-white shadow transition hover:bg-[#005837] disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">
              {cargando ? 'progress_activity' : 'folder_zip'}
            </span>
            <span>Guardar asistencias (ZIP)</span>
          </button>

          <button
            type="button"
            onClick={() => exportarSeleccion(true)}
            disabled={cargando}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">print</span>
            <span>Imprimir seleccionadas</span>
          </button>
        </div>
      </div>

      {/* Bloque 4: Tabla Principal Limpia y Clara */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
                <th className="py-3.5 px-4 w-12 text-center">SEL</th>
                <th className="py-3.5 px-4">PACIENTE</th>
                <th className="py-3.5 px-4">OBRA SOCIAL</th>
                <th className="py-3.5 px-4 text-right">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {pacientesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-500 font-medium">
                    No hay pacientes para este filtro.
                  </td>
                </tr>
              ) : (
                pacientesFiltrados.map((p) => {
                  const estaSeleccionado = seleccion.has(p.id);

                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors ${
                        estaSeleccionado ? 'bg-emerald-50/50' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      {/* Checkbox grande */}
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={estaSeleccionado}
                          onChange={() => togglePaciente(p.id)}
                          disabled={cargando}
                          className="h-5 w-5 rounded border-slate-300 text-[#006d44] focus:ring-[#006d44] cursor-pointer"
                        />
                      </td>

                      {/* Paciente y badges */}
                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-bold text-slate-900 text-base">
                            {nombreCompletoApellidoNombre(p)}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs font-semibold">
                            {p?.dadoDeBaja === true && (
                              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-amber-800">
                                Dado de baja
                              </span>
                            )}
                            {p?.activo === false ? (
                              <span className="rounded-md bg-rose-100 px-2 py-0.5 text-rose-800">
                                No autorizado
                              </span>
                            ) : (
                              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-emerald-800">
                                Autorizado
                              </span>
                            )}
                            {modo === 'dia' && diaFiltro && (
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">
                                {diaFiltro}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Obra Social */}
                      <td className="py-3.5 px-4 font-semibold text-slate-700">
                        {p.obraSocial || '-'}
                      </td>

                      {/* Acciones claras con botones visibles */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => verCronogramaPaciente(p)}
                            className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800 transition hover:bg-sky-100"
                          >
                            Ver cronograma
                          </button>

                          <button
                            type="button"
                            onClick={() => generarUno(p, false)}
                            disabled={cargando}
                            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-[#006d44] transition hover:bg-emerald-100 disabled:opacity-50"
                          >
                            Guardar PDF
                          </button>

                          <button
                            type="button"
                            onClick={() => generarUno(p, true)}
                            disabled={cargando}
                            className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
                          >
                            Imprimir
                          </button>

                          <button
                            type="button"
                            onClick={() => alternarAutorizacionDesdeAsistencias(p)}
                            disabled={cargando}
                            className={`rounded-xl px-3 py-2 text-xs font-bold transition disabled:opacity-50 ${
                              p?.activo === false
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                            }`}
                          >
                            {p?.activo === false ? 'Autorizar' : 'No autorizar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Cronograma del Paciente (Limpio y fácil de leer) */}
      {cronogramaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="bg-[#006d44] px-6 py-4 text-white flex items-center justify-between">
              <h3 className="text-lg font-bold">Cronograma de Terapias</h3>
              <button
                type="button"
                onClick={() => setCronogramaModal(null)}
                className="text-white hover:text-slate-200 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
              <p className="text-sm font-semibold text-slate-600">{cronogramaModal.titulo}</p>

              {cronogramaModal.tratamientos.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 font-medium">
                  Sin horarios cargados para este mes.
                </div>
              ) : (
                cronogramaModal.tratamientos.map((t, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h4 className="font-bold text-slate-800 text-sm mb-2 border-b border-slate-200 pb-1">
                      {t.trat}
                    </h4>
                    {t.dias.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">Sin horarios cargados</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {t.dias.map((d, j) => (
                          <div
                            key={j}
                            className="flex items-center justify-between rounded-lg bg-white p-2.5 border border-slate-200 text-xs"
                          >
                            <span className="font-bold text-slate-700">{d.dia}</span>
                            <span className="font-semibold text-[#006d44] bg-[#d6ffe8] px-2 py-0.5 rounded">
                              {d.horas.join(', ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-slate-100 bg-slate-50 px-6 py-3.5 flex justify-end">
              <button
                type="button"
                onClick={() => setCronogramaModal(null)}
                className="rounded-xl bg-[#006d44] px-5 py-2 text-xs font-bold text-white shadow transition hover:bg-[#005837]"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
