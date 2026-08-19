import React, { useEffect, useMemo, useState } from 'react';
import { usePacientes } from '../context/PatientsContext';
import {
  exportarAsistenciasPdf,
} from '../services/api';

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
const DIAS_COMPLETO = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

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
    window.alert('El navegador bloqueo la ventana de impresion. Habilita popups para este sitio.');
    return;
  }
  popup.document.open();
  popup.document.write(
    `<!doctype html><html><head><title>Imprimir</title></head><body style="margin:0">
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
  } =
    usePacientes();
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

  const [fechaMes, setFechaMes] = useState(generarMesActual());
  const [fechaOrigen, setFechaOrigen] = useState('');
  const [fechaDestino, setFechaDestino] = useState('');
  const [fechaTratamiento, setFechaTratamiento] = useState('');
  const [fechaSoloPaciente, setFechaSoloPaciente] = useState(false);
  const [fechaPacienteId, setFechaPacienteId] = useState('');
  const [fechaMensaje, setFechaMensaje] = useState('');
  const [fechaMensajeTipo, setFechaMensajeTipo] = useState('info');
  const anioCambioFecha = Number(anio) || new Date().getFullYear();

  const pacientesDisponibles = useMemo(
    () =>
      (pacientes || [])
        .sort(ordenarPacientesPorApellidoNombre),
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
      const tratamientos = tratamientoSel
        ? Object.keys(turnosMes).filter(
            (t) => normalizarTextoFiltro(t) === tratamientoSel
          )
        : Object.keys(turnosMes);
      const turnos = tratamientos.flatMap((t) => turnosMes[t] || []);
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
      ? 'Estas seguro de autorizar este paciente?'
      : 'Estas seguro de no autorizar este paciente?';
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
      setFechaMensaje('Selecciona un paciente para aplicar el cambio.');
      setFechaMensajeTipo('error');
      return;
    }
    if (!fechaSoloPaciente) {
      const ok = window.confirm(
        'Estas seguro de aplicar el cambio a todos los pacientes?'
      );
      if (!ok) return;
    }
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
        setFechaMensaje(`Se movieron ${cantidad} turnos.`);
        setFechaMensajeTipo('success');
        window.alert(`Cambio aplicado correctamente. Se movieron ${cantidad} turnos.`);
      } else {
        setFechaMensaje(
          'No se movio ningun turno. Revisa si habia turnos cargados en esa fecha y filtro.'
        );
        setFechaMensajeTipo('warning');
        window.alert(
          'No se movio ningun turno. Revisa si habia turnos cargados en esa fecha y filtro.'
        );
      }
    } catch (err) {
      setFechaMensaje(String(err?.message || 'No se pudo aplicar el cambio.'));
      setFechaMensajeTipo('error');
      window.alert(String(err?.message || 'No se pudo aplicar el cambio.'));
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
      return;
    }

    const fechaDesde = formatearFechaCorta(payload.fechaDestino);
    const fechaHacia = formatearFechaCorta(payload.fechaOrigen);
    const ok = window.confirm(
      `Se van a mover los turnos de ${fechaDesde} hacia ${fechaHacia}. Deseas continuar?`
    );
    if (!ok) return;

    try {
      const resultado = await deshacerUltimoCambioFecha(payload);
      const cantidad = resultado?.updated ?? 0;
      if (cantidad > 0) {
        setFechaMensaje(`Se revirtieron ${cantidad} turnos correctamente.`);
        setFechaMensajeTipo('success');
        window.alert(
          `Reversion aplicada correctamente. Se revirtieron ${cantidad} turnos.`
        );
      } else {
        setFechaMensaje(
          `No se encontro ningun turno para mover de ${fechaDesde} hacia ${fechaHacia}.`
        );
        setFechaMensajeTipo('warning');
        window.alert(
          `No se encontro ningun turno para mover de ${fechaDesde} hacia ${fechaHacia}.`
        );
      }
    } catch (err) {
      setFechaMensaje(
        String(err?.message || 'No se pudo revertir el cambio de fecha.')
      );
      setFechaMensajeTipo('error');
      window.alert(
        String(err?.message || 'No se pudo revertir el cambio de fecha.')
      );
    }
  };

  const [cronogramaModal, setCronogramaModal] = useState(null);

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
        } no tiene obra social.`
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
      window.alert(`No se pudo generar PDF: ${err?.message || 'Error'}`);
    } finally {
      setCargando(false);
    }
  };

  const exportarSeleccion = async (imprimir = false) => {
    const ids = Array.from(seleccion);
    if (!ids.length) {
      window.alert('Selecciona al menos un paciente.');
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
          window.alert(
            'El servidor devolvio PDF en lugar de ZIP. Reinicia el server para aplicar el cambio de ZIP.'
          );
        } else {
          descargarBlob(blob, `asistencias-${anio}-${String(mes).padStart(2, '0')}.bin`);
        }
      }
    } catch (err) {
      window.alert(`No se pudo exportar: ${err?.message || 'Error'}`);
    } finally {
      setCargando(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border-none bg-surface-container-highest/40 px-4 py-2 text-sm text-on-surface focus:ring-2 focus:ring-primary/40';
  const selectClass =
    'w-full rounded-lg border-none bg-surface-container-highest/40 px-4 py-2 text-sm text-on-surface focus:ring-2 focus:ring-primary/40';
  const labelClass =
    'mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant';
  const fechaMensajeClass =
    fechaMensajeTipo === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : fechaMensajeTipo === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : fechaMensajeTipo === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-primary/15 bg-white text-on-surface-variant';

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight text-on-surface">
            Gestion de Asistencias
          </h2>
        </div>
      </div>

      <section className="rounded-[28px] border border-white/40 bg-gradient-to-br from-surface-container-low to-white p-6 shadow-sm shadow-black/5">
        <details>
          <summary className="cursor-pointer text-sm font-bold text-on-surface">
            Cambio de fecha general
          </summary>
          <div className="mt-4 rounded-2xl border border-outline-variant/25 bg-[#eef3f1] p-4 shadow-inner shadow-black/5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
              <div className="rounded-2xl border border-outline-variant/20 bg-white p-3 shadow-sm">
                <label className={labelClass}>Mes</label>
                <select value={fechaMes} onChange={(e) => setFechaMes(e.target.value)} className={selectClass}>
                  {MESES.map((m, idx) => (
                    <option key={`fecha-mes-${m}`} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-2xl border border-outline-variant/20 bg-white p-3 shadow-sm">
                <label className={labelClass}>De</label>
                <select value={fechaOrigen} onChange={(e) => setFechaOrigen(e.target.value)} className={selectClass}>
                  {fechasDisponibles.map((f) => (
                    <option key={`from-date-${f.value}`} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-2xl border border-outline-variant/20 bg-white p-3 shadow-sm">
                <label className={labelClass}>A</label>
                <select value={fechaDestino} onChange={(e) => setFechaDestino(e.target.value)} className={selectClass}>
                  {fechasDisponibles.map((f) => (
                    <option key={`to-date-${f.value}`} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-2xl border border-outline-variant/20 bg-white p-3 shadow-sm">
                <label className={labelClass}>Tratamiento</label>
                <select value={fechaTratamiento} onChange={(e) => setFechaTratamiento(e.target.value)} className={selectClass}>
                  <option value="">Todos</option>
                  {tratamientosDisponibles.map((t) => (
                    <option key={`trat-${t}`} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-2xl border border-outline-variant/20 bg-white p-3 shadow-sm">
                <label className={labelClass}>Aplicacion</label>
                <label className="flex items-center gap-3 rounded-lg bg-surface-container-lowest px-4 py-3 text-sm font-medium text-on-surface">
                  <input
                    type="checkbox"
                    checked={fechaSoloPaciente}
                    onChange={(e) => setFechaSoloPaciente(e.target.checked)}
                    className="rounded border-outline-variant/50 text-primary focus:ring-primary/30"
                  />
                  Solo este paciente
                </label>
              </div>
              <div className="rounded-2xl border border-outline-variant/20 bg-white p-3 shadow-sm">
                <label className={labelClass}>Paciente</label>
                <select
                  value={fechaPacienteId}
                  onChange={(e) => setFechaPacienteId(e.target.value)}
                  disabled={!fechaSoloPaciente}
                  className={selectClass}
                >
                  <option value="">Seleccionar paciente</option>
                  {pacientesOrdenados.map((p) => (
                    <option key={`fecha-p-${p.id}`} value={p.id}>
                      {nombreCompletoApellidoNombre(p) || '-'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={aplicarCambioFecha}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5 hover:opacity-90"
              >
                Aplicar cambio
              </button>
              <button
                type="button"
                onClick={volverCambioFecha}
                className="rounded-xl border border-primary/20 bg-emerald-50 px-5 py-2.5 text-sm font-bold text-primary shadow-sm transition-all hover:-translate-y-0.5 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!ultimoCambioFecha && (!fechaOrigen || !fechaDestino)}
              >
                Volver cambios atras
              </button>
              {fechaOrigen && fechaDestino ? (
                <span className="text-xs font-semibold text-on-surface-variant">
                  Reversion actual: {formatearFechaCorta(fechaOrigen)} a{' '}
                  {formatearFechaCorta(fechaDestino)}
                </span>
              ) : null}
              {ultimoCambioFecha?.fechaOrigen && ultimoCambioFecha?.fechaDestino ? (
                <span className="text-xs font-semibold text-primary/80">
                  Ultimo cambio: {formatearFechaCorta(ultimoCambioFecha.fechaOrigen)} a{' '}
                  {formatearFechaCorta(ultimoCambioFecha.fechaDestino)}
                </span>
              ) : null}
              {fechaMensaje ? (
                <div
                  className={`w-full rounded-xl border px-4 py-3 text-sm font-semibold shadow-sm ${fechaMensajeClass}`}
                >
                  {fechaMensaje}
                </div>
              ) : null}
            </div>
          </div>
        </details>
      </section>

      <section className="rounded-[28px] border border-white/40 bg-gradient-to-br from-surface-container-low to-white p-6 shadow-sm shadow-black/5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <div>
            <label className={labelClass}>Modo</label>
            <select value={modo} onChange={(e) => setModo(e.target.value)} className={selectClass}>
              <option value="mes">Por mes</option>
              <option value="dia">Por dia</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Mes</label>
            <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className={selectClass}>
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Año</label>
            <input type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={modo !== 'dia'} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Tratamiento</label>
            <select value={tratamiento} onChange={(e) => setTratamiento(e.target.value)} className={selectClass}>
              <option value="">Todos</option>
              {tratamientosDisponibles.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Obra social</label>
            <select value={obraSocialFiltro} onChange={(e) => setObraSocialFiltro(e.target.value)} className={selectClass}>
              <option value="">Todas</option>
              {(obrasSociales || []).map((o) => (
                <option key={`fil-${o.id}`} value={o.id}>{o.id}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Autorizacion</label>
            <select value={filtroAutorizacion} onChange={(e) => setFiltroAutorizacion(e.target.value)} className={selectClass}>
              <option value="autorizados">Solo autorizados</option>
              <option value="no_autorizados">Solo no autorizados</option>
              <option value="todos">Todos</option>
            </select>
          </div>
          <div className="xl:col-span-2">
            <label className={labelClass}>Buscar</label>
            <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre, obra social o prestacion" className={inputClass} />
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="text-sm font-medium text-on-surface-variant">
          Pacientes filtrados: <strong className="text-on-surface">{pacientesFiltrados.length}</strong>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={seleccionarTodos}
            disabled={cargando}
            className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary shadow-sm transition-all hover:bg-primary/10 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">select_all</span>
            Seleccionar todos
          </button>
          <button
            type="button"
            onClick={limpiarSeleccion}
            disabled={cargando}
            className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-2 text-sm font-semibold text-on-surface-variant shadow-sm transition-all hover:bg-surface-container-low disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">deselect</span>
            Limpiar seleccion
          </button>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => exportarSeleccion(false)}
            disabled={cargando}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary-container px-6 py-2.5 text-sm font-bold text-on-primary-container shadow-lg shadow-primary-container/20 transition-transform hover:scale-[1.02] disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">folder_zip</span>
            Guardar asistencias (ZIP)
          </button>
          <button
            type="button"
            onClick={() => exportarSeleccion(true)}
            disabled={cargando}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-secondary px-6 py-2.5 text-sm font-bold text-on-secondary transition-transform hover:scale-[1.02] disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">print</span>
            Imprimir seleccionadas
          </button>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm">
        <div className="divide-y divide-surface-container md:hidden">
          {pacientesFiltrados.map((p) => (
            <article key={`mobile-${p.id}`} className="space-y-4 bg-gradient-to-br from-white to-surface-container-lowest px-4 py-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-sm font-extrabold text-on-primary shadow-md shadow-primary/20">
                  {obtenerInicialesPaciente(p)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-on-surface">
                        {nombreCompletoApellidoNombre(p)}
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">
                        {p.obraSocial || 'Sin obra social'}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={seleccion.has(p.id)}
                      onChange={() => togglePaciente(p.id)}
                      disabled={cargando}
                      className="mt-1 rounded border-outline-variant text-primary focus:ring-primary/40"
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                    {p?.dadoDeBaja === true ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">
                        Dado de baja
                      </span>
                    ) : null}
                    {p?.activo === false ? (
                      <span className="rounded-full bg-error-container/20 px-2.5 py-1 text-error">
                        No autorizado
                      </span>
                    ) : (
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">
                        Autorizado
                      </span>
                    )}
                    {modo === 'dia' && diaFiltro ? (
                      <span className="rounded-full bg-surface-container px-2.5 py-1 text-on-surface-variant">
                        {diaFiltro}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-primary/5 px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    Mes
                  </p>
                  <p className="mt-1 text-xs font-semibold text-on-surface">
                    {MESES[Number(mes) - 1] || '-'} {anio}
                  </p>
                </div>
                <div className="rounded-2xl bg-surface-container-low px-3 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    Tratamiento
                  </p>
                  <p className="mt-1 text-xs font-semibold text-on-surface">
                    {tratamiento || 'Todos'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => verCronogramaPaciente(p)} className="min-h-10 rounded-lg bg-surface-container-low px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary-container">
                  Ver cronograma
                </button>
                <button type="button" onClick={() => generarUno(p, false)} disabled={cargando} className="min-h-10 rounded-xl bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-200 disabled:opacity-50">
                  Guardar PDF
                </button>
                <button type="button" onClick={() => generarUno(p, true)} disabled={cargando} className="min-h-10 rounded-xl bg-slate-200 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-300 disabled:opacity-50">
                  Imprimir
                </button>
                <button type="button" onClick={() => alternarAutorizacionDesdeAsistencias(p)} disabled={cargando} className={`min-h-10 rounded-xl px-3 py-2 text-xs font-bold shadow-sm transition-colors disabled:opacity-50 ${
                  p?.activo === false
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                }`}>
                  {p?.activo === false ? 'Autorizar' : 'No autorizar'}
                </button>
              </div>
            </article>
          ))}
          {!pacientesFiltrados.length ? (
            <div className="px-6 py-8 text-center text-sm text-on-surface-variant">
              No hay pacientes para este filtro.
            </div>
          ) : null}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-container-low/50 text-left">
                <th className="px-6 py-4"><span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Sel</span></th>
                <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Paciente</th>
                <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Obra social</th>
                <th className="px-4 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {pacientesFiltrados.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-surface-container-low/30">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={seleccion.has(p.id)}
                      onChange={() => togglePaciente(p.id)}
                      disabled={cargando}
                      className="rounded border-outline-variant text-primary focus:ring-primary/40"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-bold text-on-surface">{nombreCompletoApellidoNombre(p)}</p>
                      <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                        {p?.dadoDeBaja === true ? (
                          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-700">Dado de baja</span>
                        ) : null}
                        {p?.activo === false ? (
                          <span className="rounded-full bg-error-container/20 px-2.5 py-0.5 text-error">No autorizado</span>
                        ) : null}
                        {modo === 'dia' && diaFiltro ? (
                          <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-on-surface-variant">{diaFiltro}</span>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-on-surface">{p.obraSocial || '-'}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button type="button" onClick={() => verCronogramaPaciente(p)} className="min-h-10 rounded-xl bg-sky-100 px-3 py-2 text-xs font-bold text-sky-700 shadow-sm transition-colors hover:bg-sky-200">Ver cronograma</button>
                      <button type="button" onClick={() => generarUno(p, false)} disabled={cargando} className="min-h-10 rounded-xl bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-200 disabled:opacity-50">Guardar PDF</button>
                      <button type="button" onClick={() => generarUno(p, true)} disabled={cargando} className="min-h-10 rounded-xl bg-slate-200 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-300 disabled:opacity-50">Imprimir</button>
                      <button type="button" onClick={() => alternarAutorizacionDesdeAsistencias(p)} disabled={cargando} className={`min-h-10 rounded-xl px-3 py-2 text-xs font-bold shadow-sm transition-colors disabled:opacity-50 ${
                        p?.activo === false
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                      }`}>{p?.activo === false ? 'Autorizar' : 'No autorizar'}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!pacientesFiltrados.length ? (
                <tr>
                  <td className="px-6 py-8 text-center text-sm text-on-surface-variant" colSpan={4}>
                    No hay pacientes para este filtro.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {cronogramaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="bg-gradient-to-r from-primary to-emerald-600 px-6 py-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Cronograma del Paciente</h3>
                <button
                  type="button"
                  onClick={() => setCronogramaModal(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition hover:bg-white/20 hover:text-white"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
              <p className="mt-1 text-sm font-medium text-white/80">{cronogramaModal.titulo}</p>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-6">
              {cronogramaModal.tratamientos.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  Sin horarios cargados para este mes.
                </div>
              ) : (
                <div className="space-y-6">
                  {cronogramaModal.tratamientos.map((t, i) => (
                    <div key={i}>
                      <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-primary">
                        {t.trat}
                      </h4>
                      {t.dias.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">Sin horarios cargados</p>
                      ) : (
                        <ul className="space-y-2">
                          {t.dias.map((d, j) => (
                            <li key={j} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2 border border-slate-100 mb-2">
                              <span className="font-semibold text-slate-700">{d.dia}</span>
                              <span className="text-sm font-medium text-slate-600">
                                {d.horas.join(', ')}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 text-right">
              <button
                type="button"
                onClick={() => setCronogramaModal(null)}
                className="rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 shadow-md shadow-primary/20 hover:-translate-y-0.5"
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
