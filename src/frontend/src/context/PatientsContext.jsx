import React, {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAutenticacion } from './AuthContext';
import {
  obtenerPacientes,
  obtenerObrasSocialesApi,
  crearPacienteApi,
  actualizarPacienteApi,
  eliminarPacienteApi,
  cambiarEstadoPacienteApi,
  cambiarBajaPacienteApi,
  cambiarEstadoOperativoApi,
  crearSolicitudPacienteApi,
  agregarTratamientosApi,
  eliminarTratamientoApi,
  alternarTurnoApi,
  guardarAsistenciaApi,
  guardarTurnoExcepcionApi,
  moverTurnosHorarioApi,
  moverTurnosFechaApi,
  revertirTurnosFechaApi,
} from '../services/api';

const ContextoPacientes = createContext(null);
const ULTIMO_CAMBIO_FECHA_STORAGE_KEY = 'cenein.ultimoCambioFecha';

function calcularEdadDesdeFecha(fechaNacimiento) {
  if (!fechaNacimiento || typeof fechaNacimiento !== 'string') return '-';
  const m = fechaNacimiento.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '-';
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!year || !month || !day) return '-';
  const now = new Date();
  let edad = now.getFullYear() - year;
  const mesActual = now.getMonth() + 1;
  const diaActual = now.getDate();
  if (mesActual < month || (mesActual === month && diaActual < day)) {
    edad -= 1;
  }
  return Number.isFinite(edad) && edad >= 0 ? String(edad) : '-';
}

function normalizarModulosEntrada(valor) {
  const lista = Array.isArray(valor)
    ? valor
    : String(valor || '')
        .split(',')
        .map((item) => String(item || '').trim().toUpperCase())
        .filter(Boolean);
  return Array.from(new Set(lista.filter((item) => ['MII', 'MIS', 'MIE'].includes(item))));
}

function normalizarAniosEscolares(valor) {
  const lista = Array.isArray(valor)
    ? valor
    : String(valor || '')
        .split(',')
        .map((item) => String(item || '').trim())
        .filter(Boolean);
  return Array.from(
    new Set(lista.filter((item) => ['2026', '2027', '2028', '2029', '2030'].includes(item)))
  );
}

export function ProveedorPacientes({ children }) {
  const { usuario, cargando } = useAutenticacion();
  const [pacientes, setPacientes] = useState([]);
  const [idSeleccionado, setIdSeleccionado] = useState(null);
  const [obrasSociales, setObrasSociales] = useState([]);
  const [ultimoCambioFecha, setUltimoCambioFecha] = useState(() => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      const raw = window.localStorage.getItem(ULTIMO_CAMBIO_FECHA_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (err) {
      return null;
    }
  });

  const pacienteSeleccionado = useMemo(
    () => pacientes.find((p) => p.id === idSeleccionado) || null,
    [pacientes, idSeleccionado]
  );

  const refrescarPacientes = useCallback(async (signal) => {
    const lista = await obtenerPacientes({ signal });
    const deduplicada = Array.isArray(lista)
      ? lista.map(p => ({ ...p, tratamientos: Array.from(new Set(p.tratamientos || [])) }))
      : [];
    setPacientes(deduplicada);
  }, []);

  useEffect(() => {
    if (cargando) return;
    if (!usuario) {
      setPacientes([]);
      setIdSeleccionado(null);
      return;
    }
    const controller = new AbortController();
    refrescarPacientes(controller.signal).catch((err) => {
      if (controller.signal.aborted) return;
      console.error('No se pudieron cargar pacientes desde la API.', err);
      setPacientes([]);
    });
    return () => controller.abort();
  }, [cargando, usuario, refrescarPacientes]);

  useEffect(() => {
    if (cargando) return;
    if (!usuario) {
      setObrasSociales([]);
      return;
    }
    const controller = new AbortController();
    obtenerObrasSocialesApi({ signal: controller.signal })
      .then((lista) => setObrasSociales(lista))
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error('No se pudieron cargar obras sociales desde la API.', err);
        setObrasSociales([]);
      });
    return () => controller.abort();
  }, [cargando, usuario]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      if (ultimoCambioFecha) {
        window.localStorage.setItem(
          ULTIMO_CAMBIO_FECHA_STORAGE_KEY,
          JSON.stringify(ultimoCambioFecha)
        );
      } else {
        window.localStorage.removeItem(ULTIMO_CAMBIO_FECHA_STORAGE_KEY);
      }
    } catch (err) {
      // Ignoramos errores de almacenamiento para no bloquear la UI.
    }
  }, [ultimoCambioFecha]);

  const seleccionarPaciente = (id) => setIdSeleccionado(id);

  const agregarAsistencia = (pacienteId, asistencia) => {
    setPacientes((prev) =>
      prev.map((p) => {
        if (p.id !== pacienteId) return p;
        return {
          ...p,
          asistencias: [asistencia, ...p.asistencias],
          ultimaVisita: asistencia.fecha,
        };
      })
    );
    guardarAsistenciaApi(pacienteId, asistencia).catch(() => {});
  };

  const agregarPaciente = (datos, tratamientosOverride = []) => {
    const entrada =
      typeof datos === 'string' || typeof datos === 'number'
        ? { nombre: String(datos), apellido: '', tratamientos: tratamientosOverride }
        : datos || {};
    const nombre = String(entrada.nombre || '').trim();
    const apellido = String(entrada.apellido || '').trim();
    const nombreCompleto = `${nombre} ${apellido}`.trim();
	    if (!nombreCompleto) return null;
		    const nuevoPaciente = {
		      id: `p-${Date.now()}`,
		      nombre,
		      apellido,
		      fechaNacimiento: String(
		        entrada.fechaNacimiento || entrada.birthDate || entrada.birth_date || ''
		      ).trim(),
		      edad: calcularEdadDesdeFecha(
		        String(
		          entrada.fechaNacimiento || entrada.birthDate || entrada.birth_date || ''
		        ).trim()
		      ),
		      condicion: 'Nuevo',
	      ultimaVisita: '-',
	      ultimoControlFisiatrico: entrada.ultimoControlFisiatrico || '',
        fechaAltaControlFisiatrico: entrada.fechaAltaControlFisiatrico || '',
        fechaVencimientoControlFisiatrico: entrada.fechaVencimientoControlFisiatrico || '',
        ultimoControlTrabajoSocial: entrada.ultimoControlTrabajoSocial || '',
        fechaAltaControlTrabajoSocial: entrada.fechaAltaControlTrabajoSocial || '',
        fechaVencimientoControlTrabajoSocial: entrada.fechaVencimientoControlTrabajoSocial || '',
	      dni: String(entrada.dni || '').trim(),
	      cuit: String(entrada.cuit || '').trim(),
	      nroAfiliado: String(entrada.nroAfiliado || '').trim(),
	      integracionHorario: String(entrada.integracionHorario || '').trim(),
	      diagnostico: String(entrada.diagnostico || '').trim(),
	      padreTutor: String(entrada.padreTutor || '').trim(),
	      telefonoPadreTutor: String(entrada.telefonoPadreTutor || '').trim(),
	      madreTutora: String(entrada.madreTutora || '').trim(),
	      telefonoMadreTutora: String(entrada.telefonoMadreTutora || '').trim(),
	      calle: String(entrada.calle || '').trim(),
	      numeracion: String(entrada.numeracion || '').trim(),
	      barrio: String(entrada.barrio || '').trim(),
	      piso: String(entrada.piso || '').trim(),
	      sector: String(entrada.sector || '').trim(),
	      escuela: String(entrada.escuela || '').trim(),
	      anioGrado: String(entrada.anioGrado || '').trim(),
	      turnoEscolar: String(entrada.turnoEscolar || '').trim(),
        carAnios: normalizarAniosEscolares(entrada.carAnios),
        ppiAnios: normalizarAniosEscolares(entrada.ppiAnios),
        actaAcuerdoAnios: normalizarAniosEscolares(entrada.actaAcuerdoAnios),
        autorizadoDesde: String(entrada.autorizadoDesde || '').trim(),
        autorizadoHasta: String(entrada.autorizadoHasta || '').trim(),
	      obraSocial: String(entrada.obraSocial || '').trim(),
	      modulo: normalizarModulosEntrada(entrada.modulo || entrada.modulos).join(', '),
        modulos: normalizarModulosEntrada(entrada.modulo || entrada.modulos),
		      activo: true,
		      estado: 'autorizado',
		      dadoDeBaja: false,
		      fechaBaja: '',
		      estadoPaciente: 'activo',
		      parametro: Boolean(entrada.parametro),
	      tratamientos: Array.isArray(entrada.tratamientos)
	        ? entrada.tratamientos
	        : [],
      turnosPorMes: {},
      turnosOverrides: [],
      turnos: {},
      asistencias: [],
    };
    setPacientes((prev) => [nuevoPaciente, ...prev]);
    const payload = {
      ...nuevoPaciente,
      nombreCompleto,
      affiliate_number: nuevoPaciente.nroAfiliado,
      affiliateNumber: nuevoPaciente.nroAfiliado,
      numeroAfiliado: nuevoPaciente.nroAfiliado,
      turnosBase: entrada.turnosBase || {},
    };
    crearPacienteApi(payload)
      .then(() => refrescarPacientes())
      .catch((err) => {
        console.error('No se pudo guardar el paciente en la base de datos.', err);
        // Si no se guardo en DB, lo sacamos de la UI para no confundir.
        setPacientes((prev) => prev.filter((p) => p.id !== nuevoPaciente.id));
      });
    return nuevoPaciente;
  };

  const eliminarPaciente = (pacienteId) => {
    eliminarPacienteApi(pacienteId)
      .then(() => refrescarPacientes())
      .catch((err) => {
        console.error('No se pudo eliminar el paciente en DB.', err);
        refrescarPacientes().catch(() => {});
      });
  };

  const cambiarEstadoPaciente = (pacienteId, activo) => {
    const activoFinal = Boolean(activo);
    setPacientes((prev) =>
      prev.map((p) => {
        if (p.id !== pacienteId) return p;
        return {
          ...p,
          activo: activoFinal,
          estado: activoFinal ? 'autorizado' : 'no_autorizado',
        };
      })
    );
    cambiarEstadoPacienteApi(pacienteId, activoFinal)
      .then(() => refrescarPacientes())
      .catch((err) => {
        console.error('No se pudo actualizar el estado del paciente en DB.', err);
        refrescarPacientes().catch(() => {});
      });
  };

  const cambiarBajaPaciente = (pacienteId, dadoDeBaja) => {
    const bajaFinal = Boolean(dadoDeBaja);
    const ahoraIso = new Date().toISOString();
    setPacientes((prev) =>
      prev.map((p) => {
        if (p.id !== pacienteId) return p;
        return {
          ...p,
          dadoDeBaja: bajaFinal,
          fechaBaja: bajaFinal ? (p.fechaBaja || ahoraIso) : '',
          estadoPaciente: bajaFinal ? 'baja' : 'activo',
        };
      })
    );
    cambiarBajaPacienteApi(pacienteId, bajaFinal)
      .then(() => refrescarPacientes())
      .catch((err) => {
        console.error('No se pudo actualizar la baja del paciente en DB.', err);
        refrescarPacientes().catch(() => {});
      });
  };

  const cambiarEstadoOperativo = (pacienteId, newStateName, reason = '') => {
    return cambiarEstadoOperativoApi(pacienteId, newStateName, reason)
      .then(async (pacienteActualizado) => {
        setPacientes((prev) =>
          prev.map((p) => (p.id === pacienteId ? { 
            ...p, 
            ...pacienteActualizado, 
            patient_state_name: newStateName,
            tratamientos: Array.from(new Set(pacienteActualizado.tratamientos || p.tratamientos || []))
          } : p))
        );
        try {
          await refrescarPacientes();
        } catch (e) {}
        return pacienteActualizado;
      })
      .catch((err) => {
        console.error('No se pudo actualizar el estado operativo del paciente.', err);
        throw err;
      });
  };

  const agregarTratamientos = (pacienteId, tratamientos) => {
    const nuevos = Array.isArray(tratamientos) ? tratamientos : [];
    if (!nuevos.length) return;
    setPacientes((prev) =>
      prev.map((p) => {
        if (p.id !== pacienteId) return p;
        const actuales = Array.isArray(p.tratamientos) ? p.tratamientos : [];
        const combinados = Array.from(new Set([...actuales, ...nuevos]));
        return { ...p, tratamientos: combinados };
      })
    );
    agregarTratamientosApi(pacienteId, nuevos)
      .then(() => refrescarPacientes())
      .catch((err) => {
        console.error('No se pudieron guardar los tratamientos en DB.', err);
        refrescarPacientes().catch(() => {});
      });
  };

  const eliminarTratamiento = (pacienteId, tratamiento) => {
    if (!tratamiento) return;
    setPacientes((prev) =>
      prev.map((p) => {
        if (p.id !== pacienteId) return p;
        const actuales = Array.isArray(p.tratamientos) ? p.tratamientos : [];
        const turnosPorMes = Object.fromEntries(
          Object.entries(p.turnosPorMes || {}).map(([mes, porTratamiento]) => [
            mes,
            Object.fromEntries(
              Object.entries(porTratamiento || {}).filter(
                ([key]) => key !== tratamiento
              )
            ),
          ])
        );
        return {
          ...p,
          tratamientos: actuales.filter((t) => t !== tratamiento),
          turnosPorMes,
          turnosOverrides: (p.turnosOverrides || []).filter(
            (o) => o.tratamiento !== tratamiento
          ),
        };
      })
    );
    eliminarTratamientoApi(pacienteId, tratamiento)
      .then(() => refrescarPacientes())
      .catch((err) => {
        console.error('No se pudo eliminar el tratamiento en DB.', err);
        refrescarPacientes().catch(() => {});
      });
  };

  const actualizarPaciente = (pacienteId, cambios) => {
    let actual = null;
    setPacientes((prev) =>
      prev.map((p) => {
        if (p.id !== pacienteId) return p;
        actual = p;
        return { ...p, ...cambios };
      })
    );
    if (!actual) return Promise.resolve(null);
    const actualizado = { ...actual, ...cambios };
    return actualizarPacienteApi(actualizado)
      .then(async () => {
        try {
          await refrescarPacientes();
        } catch (errRefresh) {
          // El guardado ya ocurrio: no lo tratamos como error de guardado.
          console.error('Paciente guardado, pero fallo el refresco de lista.', errRefresh);
        }
      })
      .catch((err) => {
        console.error('No se pudo actualizar el paciente en DB.', err);
        return refrescarPacientes()
          .catch(() => {})
          .then(() => {
            throw err;
          });
      });
  };

  const alternarTurno = (pacienteId, tratamiento, claveTurno, mes) => {
    if (!tratamiento || !claveTurno || !mes) return;
    setPacientes((prev) =>
      prev.map((p) => {
        if (p.id !== pacienteId) return p;
        const turnosPorMes = p.turnosPorMes || {};
        const mesActual = turnosPorMes[mes] || {};
        const lista = Array.isArray(mesActual[tratamiento])
          ? mesActual[tratamiento]
          : [];
        const existe = lista.includes(claveTurno);
        const [dia] = String(claveTurno).split('-');
        const nuevaLista = existe
          ? lista.filter((t) => t !== claveTurno)
          : [...lista.filter((t) => !String(t).startsWith(`${dia}-`)), claveTurno];
        return {
          ...p,
          turnosPorMes: {
            ...turnosPorMes,
            [mes]: {
              ...mesActual,
              [tratamiento]: nuevaLista,
            },
          },
        };
      })
    );
    alternarTurnoApi(pacienteId, tratamiento, claveTurno, mes)
      .then(() => refrescarPacientes())
      .catch((err) => {
        console.error('No se pudo guardar el turno en DB.', err);
        refrescarPacientes().catch(() => {});
      });
  };

  const guardarExcepcionTurno = (pacienteId, tratamiento, fecha, hora, activo) => {
    setPacientes((prev) =>
      prev.map((p) => {
        if (p.id !== pacienteId) return p;
        const actuales = Array.isArray(p.turnosOverrides) ? p.turnosOverrides : [];
        const filtrados = actuales.filter(
          (o) =>
            !(
              o.tratamiento === tratamiento &&
              o.fecha === fecha &&
              o.hora === hora
            )
        );
        return {
          ...p,
          turnosOverrides: [
            ...filtrados,
            { tratamiento, fecha, hora, activo },
          ],
        };
      })
    );
    guardarTurnoExcepcionApi(pacienteId, tratamiento, fecha, hora, activo)
      .then(() => refrescarPacientes())
      .catch((err) => {
        console.error('No se pudo guardar la excepcion del turno.', err);
        refrescarPacientes().catch(() => {});
      });
  };

  const moverTurnosHorario = async ({
    pacienteId,
    diaOrigen,
    diaDestino,
    mes,
  }) => {
    try {
      const resultado = await moverTurnosHorarioApi({
        fromDay: diaOrigen,
        toDay: diaDestino,
        patientId: pacienteId || undefined,
        month: mes,
      });
      await refrescarPacientes();
      return resultado;
    } catch (err) {
      console.error('No se pudo mover el horario.', err);
      refrescarPacientes().catch(() => {});
      throw err;
    }
  };

  const moverTurnosFecha = async ({
    pacienteId,
    fechaOrigen,
    fechaDestino,
    tratamiento,
    month,
    year,
    onlyDisable,
  }) => {
    try {
      const resultado = await moverTurnosFechaApi({
        fromDate: fechaOrigen,
        toDate: fechaDestino,
        patientId: pacienteId || undefined,
        tratamiento: tratamiento || undefined,
        month,
        year,
        onlyDisable: Boolean(onlyDisable),
      });
      setUltimoCambioFecha({
        pacienteId: pacienteId || '',
        fechaOrigen,
        fechaDestino,
        tratamiento: tratamiento || '',
        month,
        year,
        onlyDisable: Boolean(onlyDisable),
        updated: resultado?.updated ?? 0,
        timestamp: new Date().toISOString(),
      });
      await refrescarPacientes();
      return resultado;
    } catch (err) {
      console.error('No se pudo mover el turno por fecha.', err);
      refrescarPacientes().catch(() => {});
      throw err;
    }
  };

  const deshacerUltimoCambioFecha = async (overridePayload) => {
    const payload = overridePayload || ultimoCambioFecha;
    if (!payload?.fechaOrigen || !payload?.fechaDestino) {
      throw new Error('No hay un cambio de fecha para deshacer.');
    }
    try {
      const resultado = await revertirTurnosFechaApi({
        fromDate: payload.fechaOrigen,
        toDate: payload.fechaDestino,
        patientId: payload.pacienteId || undefined,
        tratamiento: payload.tratamiento || undefined,
        month: payload.month,
        year: payload.year,
      });
      setUltimoCambioFecha(null);
      await refrescarPacientes();
      return resultado;
    } catch (err) {
      console.error('No se pudo deshacer el cambio de fecha.', err);
      refrescarPacientes().catch(() => {});
      throw err;
    }
  };

  const guardarSolicitudPaciente = async (pacienteId, payload) => {
    try {
      const data = await crearSolicitudPacienteApi(pacienteId, payload);
      await refrescarPacientes();
      return data;
    } catch (err) {
      console.error('No se pudo guardar la solicitud en DB.', err);
      refrescarPacientes().catch(() => {});
      throw err;
    }
  };

  const valor = useMemo(
    () => ({
      pacientes,
      obrasSociales,
      pacienteSeleccionado,
      seleccionarPaciente,
      refrescarPacientes,
      agregarAsistencia,
      agregarPaciente,
      agregarTratamientos,
      eliminarTratamiento,
      actualizarPaciente,
      eliminarPaciente,
      cambiarEstadoPaciente,
      cambiarBajaPaciente,
      cambiarEstadoOperativo,
      alternarTurno,
      guardarExcepcionTurno,
      moverTurnosHorario,
      moverTurnosFecha,
      ultimoCambioFecha,
      deshacerUltimoCambioFecha,
      guardarSolicitudPaciente,
    }),
    [
      pacientes,
      obrasSociales,
      pacienteSeleccionado,
      refrescarPacientes,
      ultimoCambioFecha,
    ]
  );

  return (
    <ContextoPacientes.Provider value={valor}>
      {children}
    </ContextoPacientes.Provider>
  );
}

export function usePacientes() {
  const ctx = useContext(ContextoPacientes);
  if (!ctx) {
    throw new Error('usePacientes debe usarse dentro de ProveedorPacientes');
  }
  return ctx;
}
