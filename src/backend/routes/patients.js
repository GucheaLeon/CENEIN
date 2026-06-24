function registerPatientsRoutes(
  app,
  {
    db,
    listarPacientes,
    construirPaciente,
    normalizarFecha,
    calcularEdadDesdeNacimiento,
    obtenerTratamientoId,
    guardarTurnosMensuales,
    normalizarMes,
    DIAS_VALIDOS,
    DIAS_INDICE,
    logUserActivity,
  }
) {
  const parseActivo = (valor, fallback = true) => {
    if (valor === undefined || valor === null || valor === '') return Boolean(fallback);
    if (typeof valor === 'boolean') return valor;
    const num = Number(valor);
    if (Number.isFinite(num)) return num !== 0;
    const txt = String(valor).trim().toLowerCase();
    if (['false', 'f', 'no', 'off', 'inactivo', 'inactive', 'no autorizado', 'no_autorizado'].includes(txt)) return false;
    if (['true', 't', 'si', 'on', 'activo', 'active', 'autorizado'].includes(txt)) return true;
    return Boolean(fallback);
  };

  const parseBaja = (valor, fallback = false) => {
    if (valor === undefined || valor === null || valor === '') return Boolean(fallback);
    if (typeof valor === 'boolean') return valor;
    const num = Number(valor);
    if (Number.isFinite(num)) return num !== 0;
    const txt = String(valor).trim().toLowerCase();
    if (['false', 'f', 'no', 'off', 'activo', 'active', 'alta', 'habilitado'].includes(txt)) return false;
    if (['true', 't', 'si', 'on', 'baja', 'dado_de_baja', 'dado de baja'].includes(txt)) return true;
    return Boolean(fallback);
  };

  const parseBoolean = (valor, fallback = false) => {
    if (valor === undefined || valor === null || valor === '') return Boolean(fallback);
    if (typeof valor === 'boolean') return valor;
    const num = Number(valor);
    if (Number.isFinite(num)) return num !== 0;
    const txt = String(valor).trim().toLowerCase();
    if (['false', 'f', 'no', 'off', '0'].includes(txt)) return false;
    if (['true', 't', 'si', 'on', '1'].includes(txt)) return true;
    return Boolean(fallback);
  };

  const normalizarTextoSimple = (valor) =>
    String(valor || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const normalizarModulo = (valor, fallback = '') => {
    const raw = String(valor || '').trim();
    if (!raw) return String(fallback || '').trim();
    const upper = raw.toUpperCase();
    if (['MII', 'MIS', 'MIE'].includes(upper)) return upper;
    const norm = normalizarTextoSimple(raw);
    if (norm.includes('modulo integral intensivo')) return 'MII';
    if (norm.includes('modulo integral simple')) return 'MIS';
    if (norm.includes('modulo integracion escolar')) return 'MIE';
    return String(fallback || '').trim();
  };

  const normalizarModulos = (valor, fallback = []) => {
    const fallbackLista = Array.isArray(fallback)
      ? fallback
      : String(fallback || '')
          .split(',')
          .map((item) => String(item || '').trim())
          .filter(Boolean);
    const entrada = Array.isArray(valor)
      ? valor
      : valor == null
      ? []
      : String(valor)
          .split(',')
          .map((item) => String(item || '').trim())
          .filter(Boolean);
    const lista = entrada.length ? entrada : fallbackLista;
    return Array.from(
      new Set(
        lista
          .map((item) => normalizarModulo(item, ''))
          .filter(Boolean)
      )
    );
  };

  const serializarModulos = (valor, fallback = []) =>
    normalizarModulos(valor, fallback).join(', ');

  const normalizarAniosEscolares = (valor, fallback = []) => {
    const fallbackLista = Array.isArray(fallback)
      ? fallback
      : String(fallback || '')
          .split(',')
          .map((item) => String(item || '').trim())
          .filter(Boolean);
    const entrada = Array.isArray(valor)
      ? valor
      : valor == null
      ? []
      : String(valor)
          .split(',')
          .map((item) => String(item || '').trim())
          .filter(Boolean);
    const lista = entrada.length ? entrada : fallbackLista;
    return Array.from(
      new Set(lista.filter((item) => ['2026', '2027', '2028', '2029', '2030'].includes(item)))
    );
  };

  const serializarAniosEscolares = (valor, fallback = []) =>
    normalizarAniosEscolares(valor, fallback).join(', ');

  const resolverFechaBaja = (valor, fallback = '') => {
    const raw = String(valor || '').trim();
    if (!raw) return String(fallback || '').trim();
    const iso = new Date(raw);
    if (!Number.isFinite(iso.getTime())) return String(fallback || '').trim();
    return iso.toISOString();
  };

  const normalizarFechaInput = (valor) => {
    const raw = String(valor || '').trim();
    if (!raw || raw === '-') return '';
    const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoMatch && normalizarFecha(isoMatch[1])) return isoMatch[1];
    const dt = new Date(raw);
    if (!Number.isFinite(dt.getTime())) return '';
    return dt.toISOString().slice(0, 10);
  };

  const obtenerFechaActualIso = () => new Date().toISOString().slice(0, 10);

  const tienePropiedad = (obj, clave) =>
    Boolean(obj && Object.prototype.hasOwnProperty.call(obj, clave));

  const valorPorClaves = (obj, claves = []) => {
    for (const clave of claves) {
      if (tienePropiedad(obj, clave)) return obj[clave];
    }
    return undefined;
  };

  const obtenerFechaCorteSolicitudes = (meses = 12) => {
    const mesesHistorial = Number.isFinite(Number(meses))
      ? Math.max(1, Number(meses))
      : 12;
    const now = new Date();
    const cutoff = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    cutoff.setUTCMonth(cutoff.getUTCMonth() - mesesHistorial);
    return cutoff.toISOString().slice(0, 10);
  };

  const parsearFechaShift = (valor, { month, year } = {}) => {
    const raw = String(valor || '').trim();
    if (!raw) return null;

    const iso = normalizarFecha(raw);
    if (iso) {
      return `${iso.year}-${String(iso.month).padStart(2, '0')}-${String(iso.day).padStart(2, '0')}`;
    }

    const textoDia = raw.match(/^(?:dom|lun|mar|mie|jue|vie|sab)\s+(\d{1,2})$/i);
    if (textoDia) {
      const m = Number(month);
      const y = Number(year);
      const d = Number(textoDia[1]);
      if (!Number.isInteger(m) || !Number.isInteger(y)) return null;
      const isoLike = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const validada = normalizarFecha(isoLike);
      if (!validada) return null;
      return isoLike;
    }

    return null;
  };

  const validarPacienteOperable = async (patientId, res) => {
    const fila = await db.get(
      'SELECT patient_id, is_discharged FROM PATIENTS WHERE patient_id = $1',
      [patientId]
    );
    if (!fila) {
      res.status(404).json({ error: 'Paciente no encontrado' });
      return null;
    }
    if (Boolean(fila.is_discharged)) {
      res.status(409).json({ error: 'Paciente dado de baja. Reactivalo para operar.' });
      return null;
    }
    return fila;
  };

  const obtenerFilaPacienteBase = async (id) => {
    return await db.get(
      `SELECT
         p.*,
         o.name AS obra_social_name,
         s.name AS patient_state_name,
         auth.authorization_date AS authorized_at
       FROM PATIENTS p
       LEFT JOIN OS o ON p.os_id = o.id
       LEFT JOIN PATIENT_STATE s ON p.patient_state_id = s.id
       LEFT JOIN LATERAL (
           SELECT authorization_date
           FROM AUTHORIZATIONS
           WHERE patient_id = p.patient_id
           ORDER BY created_at DESC
           LIMIT 1
       ) auth ON true
       WHERE p.patient_id = $1`,
      [id]
    );
  };

  app.get('/api/patients', async (req, res) => {
    const lista = await listarPacientes(db);
    res.json(lista);
  });

  app.get('/api/patients/:id', async (req, res) => {
    const fila = await obtenerFilaPacienteBase(req.params.id);
    const paciente = await construirPaciente(db, fila);
    if (!paciente) {
      res.status(404).json({ error: 'Paciente no encontrado' });
      return;
    }
    res.json(paciente);
  });

  app.post('/api/patients', async (req, res) => {
    const data = req.body || {};
    let id = String(data.id || '').trim();
    const nombre = String(data.nombre || data.first_name || '').trim();
    const apellido = String(data.apellido || data.last_name || '').trim();
    const nombreCompleto =
      `${nombre} ${apellido}`.trim() ||
      String(data.full_name || data.nombreCompleto || '').trim();
    if (!nombre) {
      res.status(400).json({ error: 'Nombre requerido' });
      return;
    }
    if (!apellido) {
      res.status(400).json({ error: 'Apellido requerido' });
      return;
    }
    if (!id) {
      id = `p-${Date.now()}`;
    }

    const filaExistente = await db.get(
      `SELECT patient_id, birth_date, dni, diagnosis, is_active, is_discharged, discharged_at, module_type, authorization_expires_at, car_years, ppi_years, acta_acuerdo_years
       FROM PATIENTS
       WHERE patient_id = $1`,
      [id]
    );
    const esActualizacion = Boolean(filaExistente);

    const fechaNacimientoEntrada =
      data.fechaNacimiento || data.birthDate || data.birth_date || '';
    const fechaNacimientoBase = esActualizacion
      ? String(fechaNacimientoEntrada || filaExistente.birth_date || '').trim()
      : String(fechaNacimientoEntrada || '').trim();
    const fechaNacimientoNormalizada = normalizarFechaInput(fechaNacimientoBase);
    if (!fechaNacimientoNormalizada) {
      res.status(400).json({ error: 'Fecha de nacimiento requerida (YYYY-MM-DD)' });
      return;
    }

    const dniEntrada = String(data.dni || '').trim();
    const dniNormalizado = esActualizacion
      ? String(dniEntrada || filaExistente.dni || '').trim()
      : dniEntrada;
    if (!/^\d{1,8}$/.test(dniNormalizado)) {
      res
        .status(400)
        .json({ error: 'DNI invalido. Debe tener solo digitos y maximo 8.' });
      return;
    }

    const existentePorDni = await db.get(
      `SELECT patient_id
       FROM PATIENTS
       WHERE trim(dni) = trim($1)
       LIMIT 1`,
      [dniNormalizado]
    );
    if (existentePorDni?.patient_id && existentePorDni.patient_id !== id) {
      res.status(409).json({ error: 'Ya existe un paciente con ese DNI.' });
      return;
    }

    const obraSocial =
      data.obraSocial ||
      data.obra_social ||
      data.notas ||
      data.notes ||
      '';
    const normalizarFechaOpcional = (valor) => {
      const normalizada = normalizarFechaInput(valor);
      return normalizada || null;
    };
    const parametro = data.parametro ? 1 : 0;
    const activoPayload =
      Object.prototype.hasOwnProperty.call(data, 'activo')
        ? data.activo
        : (Object.prototype.hasOwnProperty.call(data, 'isActive')
          ? data.isActive
          : data.estado);
    const hasAutorizadoDesde = [
      'autorizadoDesde',
      'authorizedAt',
      'authorized_at',
    ].some((k) => tienePropiedad(data, k));
    const hasAutorizadoHasta = [
      'autorizadoHasta',
      'authorizationExpiresAt',
      'authorization_expires_at',
    ].some((k) => tienePropiedad(data, k));
    const autorizadoDesdeInput = hasAutorizadoDesde
      ? normalizarFechaOpcional(
          valorPorClaves(data, ['autorizadoDesde', 'authorizedAt', 'authorized_at'])
        )
      : null;
    const autorizadoHastaInput = hasAutorizadoHasta
      ? normalizarFechaOpcional(
          valorPorClaves(data, [
            'autorizadoHasta',
            'authorizationExpiresAt',
            'authorization_expires_at',
          ])
        )
      : null;
    const bajaPayload =
      Object.prototype.hasOwnProperty.call(data, 'dadoDeBaja')
        ? data.dadoDeBaja
        : (Object.prototype.hasOwnProperty.call(data, 'isDischarged')
          ? data.isDischarged
          : data.estadoPaciente);
    const fechaBajaPayload =
      data.fechaBaja || data.dischargedAt || data.discharged_at || '';
    const ultimoControlFisiatrico = normalizarFechaOpcional(
      data.ultimoControlFisiatrico || data.last_fisiatrico
    );
    const fechaAltaControlFisiatrico = normalizarFechaOpcional(
      valorPorClaves(data, ['fechaAltaControlFisiatrico', 'last_fisiatrico_alta'])
    );
    const fechaVencimientoControlFisiatrico = normalizarFechaOpcional(
      valorPorClaves(data, ['fechaVencimientoControlFisiatrico', 'last_fisiatrico_vencimiento'])
    );
    const ultimoControlTrabajoSocial = normalizarFechaOpcional(
      valorPorClaves(data, ['ultimoControlTrabajoSocial', 'last_trabajo_social'])
    );
    const fechaAltaControlTrabajoSocial = normalizarFechaOpcional(
      valorPorClaves(data, ['fechaAltaControlTrabajoSocial', 'last_trabajo_social_alta'])
    );
    const fechaVencimientoControlTrabajoSocial = normalizarFechaOpcional(
      valorPorClaves(data, ['fechaVencimientoControlTrabajoSocial', 'last_trabajo_social_vencimiento'])
    );
    const ultimaVisita = normalizarFechaOpcional(
      data.ultimaVisita || data.last_visit
    );
    const edadCalculada = calcularEdadDesdeNacimiento(fechaNacimientoNormalizada);
    const edadFinal = edadCalculada || data.edad || data.age || '-';
    const dni = dniNormalizado;
    const cuit = data.cuit || '';
    const nroAfiliado = String(
      data.nroAfiliado ??
        data.numeroAfiliado ??
        data.affiliateNumber ??
        data.affiliate_number ??
        ''
    ).trim();
    const integracionHorario = data.integracionHorario || data.integracion_horario || '';
    const padreTutor = String(
      data.padreTutor || data.fatherTutorName || data.father_tutor_name || ''
    ).trim();
    const telefonoPadreTutor = String(
      data.telefonoPadreTutor || data.fatherTutorPhone || data.father_tutor_phone || ''
    ).trim();
    const madreTutora = String(
      data.madreTutora || data.motherTutorName || data.mother_tutor_name || ''
    ).trim();
    const telefonoMadreTutora = String(
      data.telefonoMadreTutora || data.motherTutorPhone || data.mother_tutor_phone || ''
    ).trim();
    const calle = String(
      data.calle || data.addressStreet || data.address_street || ''
    ).trim();
    const numeracion = String(
      data.numeracion || data.addressNumber || data.address_number || ''
    ).trim();
    const barrio = String(
      data.barrio || data.addressNeighborhood || data.address_neighborhood || ''
    ).trim();
    const piso = String(
      data.piso || data.addressFloor || data.address_floor || ''
    ).trim();
    const sector = String(
      data.sector || data.addressSector || data.address_sector || ''
    ).trim();
    const escuela = String(
      data.escuela || data.schoolName || data.school_name || ''
    ).trim();
    const anioGrado = String(
      data.anioGrado || data.grado || data.schoolGrade || data.school_grade || ''
    ).trim();
    const turnoEscolar = String(
      data.turnoEscolar || data.turno || data.schoolShift || data.school_shift || ''
    ).trim();
    const carAnios = serializarAniosEscolares(
      valorPorClaves(data, ['carAnios', 'car_years']),
      esActualizacion ? filaExistente?.car_years || '' : []
    );
    const ppiAnios = serializarAniosEscolares(
      valorPorClaves(data, ['ppiAnios', 'ppi_years']),
      esActualizacion ? filaExistente?.ppi_years || '' : []
    );
    const actaAcuerdoAnios = serializarAniosEscolares(
      valorPorClaves(data, ['actaAcuerdoAnios', 'acta_acuerdo_years']),
      esActualizacion ? filaExistente?.acta_acuerdo_years || '' : []
    );
    const hasDiagnostico =
      Object.prototype.hasOwnProperty.call(data, 'diagnostico') ||
      Object.prototype.hasOwnProperty.call(data, 'diagnosis');
    const diagnosticoRecibido = hasDiagnostico
      ? String(data.diagnostico || data.diagnosis || '').trim()
      : null;
    const hasModulo =
      Object.prototype.hasOwnProperty.call(data, 'modulo') ||
      Object.prototype.hasOwnProperty.call(data, 'modulos') ||
      Object.prototype.hasOwnProperty.call(data, 'moduleType') ||
      Object.prototype.hasOwnProperty.call(data, 'module_type') ||
      Object.prototype.hasOwnProperty.call(data, 'module_types');
    const moduloRecibido = hasModulo
      ? normalizarModulos(
          valorPorClaves(data, ['modulo', 'modulos', 'moduleType', 'module_type', 'module_types']),
          []
        )
      : null;
    if (esActualizacion) {
      const diagnosticoFinal =
        diagnosticoRecibido != null
          ? diagnosticoRecibido
          : String(filaExistente?.diagnosis || '').trim();
      const moduloFinal =
        moduloRecibido != null
          ? serializarModulos(moduloRecibido, [])
          : serializarModulos(filaExistente?.module_type, []);
      const activoFinal = parseActivo(activoPayload, parseActivo(filaExistente?.is_active, true));
      let autorizadoDesdeFinal = hasAutorizadoDesde
        ? autorizadoDesdeInput
        : (filaExistente?.authorized_at || null);
      const autorizadoHastaFinal = hasAutorizadoHasta
        ? autorizadoHastaInput
        : (filaExistente?.authorization_expires_at || null);
      if (activoFinal && !autorizadoDesdeFinal) {
        autorizadoDesdeFinal = obtenerFechaActualIso();
      }
      const bajaFinal = parseBaja(bajaPayload, Boolean(filaExistente?.is_discharged));
      const fechaBajaFinal = bajaFinal
        ? resolverFechaBaja(fechaBajaPayload, filaExistente?.discharged_at || new Date().toISOString())
        : null;
      await db.run(
        `UPDATE PATIENTS
         SET first_name = $1, last_name = $2, birth_date = $3, condition = $4, last_visit = $5, last_fisiatrico = $6, last_fisiatrico_alta = $7, last_fisiatrico_vencimiento = $8, last_trabajo_social = $9, last_trabajo_social_alta = $10, last_trabajo_social_vencimiento = $11, dni = $12, cuit = $13, affiliate_number = $14, integracion_horario = $15, diagnosis = $16, father_tutor_name = $17, father_tutor_phone = $18, mother_tutor_name = $19, mother_tutor_phone = $20, address_street = $21, address_number = $22, address_neighborhood = $23, address_floor = $24, address_sector = $25, school_name = $26, school_grade = $27, school_shift = $28, car_years = $29, ppi_years = $30, acta_acuerdo_years = $31, notes = $32, module_type = $33, authorization_expires_at = $34, is_active = $35, is_discharged = $36, discharged_at = $37, parametro = $38
         WHERE patient_id = $39`,
        [
          nombre,
          apellido,
          fechaNacimientoNormalizada,
          data.condicion || data.condition || '-',
          ultimaVisita,
          ultimoControlFisiatrico,
          fechaAltaControlFisiatrico,
          fechaVencimientoControlFisiatrico,
          ultimoControlTrabajoSocial,
          fechaAltaControlTrabajoSocial,
          fechaVencimientoControlTrabajoSocial,
          dni,
          cuit,
          nroAfiliado,
          integracionHorario,
          diagnosticoFinal,
          padreTutor,
          telefonoPadreTutor,
          madreTutora,
          telefonoMadreTutora,
          calle,
          numeracion,
          barrio,
          piso,
          sector,
          escuela,
          anioGrado,
          turnoEscolar,
          carAnios,
          ppiAnios,
          actaAcuerdoAnios,
          obraSocial,
          moduloFinal,
          autorizadoHastaFinal,
          activoFinal,
          bajaFinal,
          fechaBajaFinal,
          parametro,
          id
        ]
      );
      if (autorizadoDesdeFinal || autorizadoHastaFinal) {
        await db.run(
          `INSERT INTO AUTHORIZATIONS (patient_id, authorization_date) VALUES ($1, $2)`,
          [id, autorizadoDesdeFinal]
        );
      }
    } else {
      const diagnosticoFinal = String(diagnosticoRecibido || '').trim();
      const moduloFinal = serializarModulos(moduloRecibido, []);
      const activoFinal = parseActivo(activoPayload, true);
      let autorizadoDesdeFinal = hasAutorizadoDesde
        ? autorizadoDesdeInput
        : null;
      const autorizadoHastaFinal = hasAutorizadoHasta
        ? autorizadoHastaInput
        : null;
      if (activoFinal && !autorizadoDesdeFinal) {
        autorizadoDesdeFinal = obtenerFechaActualIso();
      }
      const bajaFinal = parseBaja(bajaPayload, false);
      const fechaBajaFinal = bajaFinal
        ? resolverFechaBaja(fechaBajaPayload, new Date().toISOString())
        : null;
      await db.run(
        `INSERT INTO PATIENTS (patient_id, first_name, last_name, birth_date, condition, last_visit, last_fisiatrico, last_fisiatrico_alta, last_fisiatrico_vencimiento, last_trabajo_social, last_trabajo_social_alta, last_trabajo_social_vencimiento, dni, cuit, affiliate_number, integracion_horario, diagnosis, father_tutor_name, father_tutor_phone, mother_tutor_name, mother_tutor_phone, address_street, address_number, address_neighborhood, address_floor, address_sector, school_name, school_grade, school_shift, car_years, ppi_years, acta_acuerdo_years, notes, module_type, authorization_expires_at, is_active, is_discharged, discharged_at, parametro)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39)`,
        [
          id,
          nombre,
          apellido,
          fechaNacimientoNormalizada,
          data.condicion || data.condition || '-',
          ultimaVisita,
          ultimoControlFisiatrico,
          fechaAltaControlFisiatrico,
          fechaVencimientoControlFisiatrico,
          ultimoControlTrabajoSocial,
          fechaAltaControlTrabajoSocial,
          fechaVencimientoControlTrabajoSocial,
          dni,
          cuit,
          nroAfiliado,
          integracionHorario,
          diagnosticoFinal,
          padreTutor,
          telefonoPadreTutor,
          madreTutora,
          telefonoMadreTutora,
          calle,
          numeracion,
          barrio,
          piso,
          sector,
          escuela,
          anioGrado,
          turnoEscolar,
          carAnios,
          ppiAnios,
          actaAcuerdoAnios,
          obraSocial,
          moduloFinal,
          autorizadoHastaFinal,
          activoFinal,
          bajaFinal,
          fechaBajaFinal,
          parametro
        ]
      );
      if (autorizadoDesdeFinal || autorizadoHastaFinal) {
        await db.run(
          `INSERT INTO AUTHORIZATIONS (patient_id, authorization_date) VALUES ($1, $2)`,
          [id, autorizadoDesdeFinal]
        );
      }
    }

    const tratamientos = Array.isArray(data.tratamientos)
      ? data.tratamientos
      : [];
    for (const t of tratamientos) {
      const tratamientoId = await obtenerTratamientoId(db, t);
      if (tratamientoId) {
        await db.run(
          'INSERT INTO PATIENT_TREATMENTS (patient_id, treatment_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, tratamientoId]
        );
      }
    }

    if (data.turnosBase) {
      await guardarTurnosMensuales(db, id, data.turnosBase);
    }

    const fila = await obtenerFilaPacienteBase(id);
    const paciente = await construirPaciente(db, fila);
    if (!esActualizacion) {
      await logUserActivity(req, {
        actionType: 'create',
        entityType: 'patient',
        entityId: id,
        entityLabel: `${nombre} ${apellido}`.trim() || id,
        details: { dni },
      });
    }
    res.json(paciente);
  });

  app.put('/api/patients/:id/treatments', async (req, res) => {
    if (!(await validarPacienteOperable(req.params.id, res))) return;
    const tratamientos = Array.isArray(req.body?.tratamientos)
      ? req.body.tratamientos
      : [];
    for (const t of tratamientos) {
      const tratamientoId = await obtenerTratamientoId(db, t);
      if (tratamientoId) {
        await db.run(
          'INSERT INTO PATIENT_TREATMENTS (patient_id, treatment_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [req.params.id, tratamientoId]
        );
      }
    }
    if (tratamientos.length) {
      await logUserActivity(req, {
        actionType: 'create',
        entityType: 'patient_treatment',
        entityId: req.params.id,
        entityLabel: req.params.id,
        details: { tratamientos },
      });
    }
    const fila = await obtenerFilaPacienteBase(req.params.id);
    const paciente = await construirPaciente(db, fila);
    res.json(paciente);
  });

  app.delete('/api/patients/:id/treatments', async (req, res) => {
    if (!(await validarPacienteOperable(req.params.id, res))) return;
    const tratamiento = req.body?.tratamiento;
    if (!tratamiento) {
      res.status(400).json({ error: 'Tratamiento requerido' });
      return;
    }
    const tratamientoId = await obtenerTratamientoId(db, tratamiento);
    if (!tratamientoId) {
      res.status(400).json({ error: 'Tratamiento invalido' });
      return;
    }
    await db.run(
      `DELETE FROM PATIENT_TREATMENTS
       WHERE patient_id = $1 AND treatment_id = $2`,
      [req.params.id, tratamientoId]
    );
    await db.run(
      `DELETE FROM PATIENT_TURNS
       WHERE patient_id = $1 AND treatment_id = $2`,
      [req.params.id, tratamientoId]
    );
    await db.run(
      `DELETE FROM PATIENT_TURNS_MONTHLY
       WHERE patient_id = $1 AND treatment_id = $2`,
      [req.params.id, tratamientoId]
    );
    await logUserActivity(req, {
      actionType: 'delete',
      entityType: 'patient_treatment',
      entityId: req.params.id,
      entityLabel: req.params.id,
      details: { tratamiento: String(tratamiento || '') },
    });
    const fila = await obtenerFilaPacienteBase(req.params.id);
    const paciente = await construirPaciente(db, fila);
    res.json(paciente);
  });

  app.post('/api/patients/:id/turns/toggle', async (req, res) => {
    if (!(await validarPacienteOperable(req.params.id, res))) return;
    const tratamiento = req.body?.tratamiento;
    const clave = req.body?.clave;
    const mes = normalizarMes(req.body?.mes);
    if (!tratamiento || !clave) {
      res.status(400).json({ error: 'Datos incompletos' });
      return;
    }
    if (!mes) {
      res.status(400).json({ error: 'Mes invalido' });
      return;
    }
    const [dia, hora] = String(clave).split('-');
    if (!dia || !hora) {
      res.status(400).json({ error: 'Formato de turno invalido' });
      return;
    }
    const tratamientoId = await obtenerTratamientoId(db, tratamiento);
    if (!tratamientoId) {
      res.status(400).json({ error: 'Tratamiento invalido' });
      return;
    }
    const existe = await db.get(
      `SELECT 1
       FROM PATIENT_TURNS_MONTHLY
       WHERE patient_id = $1 AND treatment_id = $2 AND month = $3 AND day_of_week = $4 AND time = $5`,
      [req.params.id, tratamientoId, mes, dia, hora]
    );
    if (existe) {
      await db.run(
        `DELETE FROM PATIENT_TURNS_MONTHLY
         WHERE patient_id = $1 AND treatment_id = $2 AND month = $3 AND day_of_week = $4 AND time = $5`,
        [req.params.id, tratamientoId, mes, dia, hora]
      );
    } else {
      // Regla de negocio: un solo horario por dia para cada tratamiento/mes.
      await db.run(
        `DELETE FROM PATIENT_TURNS_MONTHLY
         WHERE patient_id = $1 AND treatment_id = $2 AND month = $3 AND day_of_week = $4`,
        [req.params.id, tratamientoId, mes, dia]
      );
      await db.run(
        `INSERT INTO PATIENT_TURNS_MONTHLY (patient_id, treatment_id, month, day_of_week, time)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.params.id, tratamientoId, mes, dia, hora]
      );
    }
    const fila = await obtenerFilaPacienteBase(req.params.id);
    const paciente = await construirPaciente(db, fila);
    res.json(paciente);
  });

  app.post('/api/patients/:id/turns/override', async (req, res) => {
    if (!(await validarPacienteOperable(req.params.id, res))) return;
    const tratamiento = req.body?.tratamiento;
    const fecha = req.body?.fecha;
    const hora = req.body?.hora;
    const activo = req.body?.activo ? 1 : 0;
    if (!tratamiento || !fecha || !hora) {
      res.status(400).json({ error: 'Datos incompletos' });
      return;
    }
    const tratamientoId = await obtenerTratamientoId(db, tratamiento);
    if (!tratamientoId) {
      res.status(400).json({ error: 'Tratamiento invalido' });
      return;
    }
    await db.run(
      `INSERT INTO PATIENT_TURNS_OVERRIDES
       (patient_id, treatment_id, date, time, active)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (patient_id, treatment_id, date, time)
       DO UPDATE SET active = EXCLUDED.active`,
      [req.params.id, tratamientoId, fecha, hora, activo]
    );
    const fila = await obtenerFilaPacienteBase(req.params.id);
    const paciente = await construirPaciente(db, fila);
    res.json(paciente);
  });

  app.post('/api/patients/turns/shift', async (req, res) => {
    const fromDay = req.body?.fromDay;
    const toDay = req.body?.toDay;
    const patientId = req.body?.patientId;
    const month = req.body?.month;
    const monthNum = month === undefined || month === null ? null : normalizarMes(month);
    if (!fromDay || !toDay) {
      res.status(400).json({ error: 'Datos incompletos' });
      return;
    }
    if (!DIAS_VALIDOS.has(fromDay) || !DIAS_VALIDOS.has(toDay)) {
      res.status(400).json({ error: 'Dia invalido' });
      return;
    }
    if (month !== undefined && month !== null && !monthNum) {
      res.status(400).json({ error: 'Mes invalido' });
      return;
    }
    if (fromDay === toDay) {
      res.status(400).json({ error: 'Dia origen y destino iguales' });
      return;
    }
    if (patientId && !(await validarPacienteOperable(patientId, res))) return;
    const wherePaciente = patientId ? ' AND patient_id = ?' : '';
    const whereMes = monthNum ? ' AND month = ?' : '';
    let actualizados = 0;
    try {
      const query = `SELECT patient_id, treatment_id, month
         FROM PATIENT_TURNS_MONTHLY
         WHERE day_of_week = $1${wherePaciente}${whereMes}
           AND EXISTS (
             SELECT 1 FROM PATIENTS p
             WHERE p.patient_id = PATIENT_TURNS_MONTHLY.patient_id
               AND COALESCE(p.is_discharged, FALSE) = FALSE
           )`;
      let filas = [];
      if (patientId && monthNum) {
        filas = await db.all(query, fromDay, patientId, monthNum);
      } else if (patientId) {
        filas = await db.all(query, fromDay, patientId);
      } else if (monthNum) {
        filas = await db.all(query, fromDay, monthNum);
      } else {
        filas = await db.all(query, fromDay);
      }
      for (const fila of filas) {
        const horas = await db.all(
          `SELECT time
           FROM PATIENT_TURNS_MONTHLY
           WHERE patient_id = $1 AND treatment_id = $2 AND month = $3 AND day_of_week = $4`,
          [fila.patient_id, fila.treatment_id, fila.month, fromDay]
        );
        for (const h of horas) {
          const existe = await db.get(
            `SELECT 1
             FROM PATIENT_TURNS_MONTHLY
             WHERE patient_id = $1 AND treatment_id = $2 AND month = $3 AND day_of_week = $4 AND time = $5`,
            [fila.patient_id, fila.treatment_id, fila.month, toDay, h.time]
          );
          if (existe) {
            await db.run(
              `DELETE FROM PATIENT_TURNS_MONTHLY
               WHERE patient_id = $1 AND treatment_id = $2 AND month = $3 AND day_of_week = $4 AND time = $5`,
              [fila.patient_id, fila.treatment_id, fila.month, fromDay, h.time]
            );
          } else {
            await db.run(
              `UPDATE PATIENT_TURNS_MONTHLY
               SET day_of_week = $1
               WHERE patient_id = $2 AND treatment_id = $3 AND month = $4 AND day_of_week = $5 AND time = $6`,
              [toDay, fila.patient_id, fila.treatment_id, fila.month, fromDay, h.time]
            );
          }
          actualizados += 1;
        }
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: String(err?.message || 'No se pudo actualizar') });
      return;
    }
    res.json({ updated: actualizados });
  });

  app.post('/api/patients/turns/shift-date', async (req, res) => {
    const fromDateRaw = req.body?.fromDate;
    const toDateRaw = req.body?.toDate;
    const onlyDisable = Boolean(req.body?.onlyDisable);
    const month = req.body?.month;
    const year = req.body?.year;
    const fromDate = parsearFechaShift(fromDateRaw, { month, year });
    const toDate = onlyDisable
      ? null
      : parsearFechaShift(toDateRaw, { month, year });
    const patientId = req.body?.patientId;
    const tratamientoRaw = req.body?.tratamiento;
    const tratamiento =
      normalizarTextoSimple(tratamientoRaw) === 'todos'
        ? ''
        : tratamientoRaw;
    const origen = normalizarFecha(fromDate);
    const destino = toDate ? normalizarFecha(toDate) : null;
    if (!origen || (!onlyDisable && !destino)) {
      res.status(400).json({ error: 'Fecha invalida' });
      return;
    }
    if (!onlyDisable && fromDate === toDate) {
      res.status(400).json({ error: 'Fecha origen y destino iguales' });
      return;
    }
    const fechaOrigen = new Date(Date.UTC(origen.year, origen.month - 1, origen.day));
    const diaSemana = DIAS_INDICE[fechaOrigen.getUTCDay()];
    if (!DIAS_VALIDOS.has(diaSemana)) {
      res.status(400).json({ error: 'Dia fuera de rango' });
      return;
    }
    if (patientId && !(await validarPacienteOperable(patientId, res))) return;

    let tratamientoId = null;
    if (tratamiento) {
      tratamientoId = await obtenerTratamientoId(db, tratamiento);
      if (!tratamientoId) {
        res.status(400).json({ error: 'Tratamiento invalido' });
        return;
      }
    }

    const esActivoOverride = (valor) => {
      if (typeof valor === 'boolean') return valor;
      const num = Number(valor);
      if (Number.isFinite(num)) return num !== 0;
      const txt = String(valor || '').trim().toLowerCase();
      return ['1', 'true', 't', 'si', 'on'].includes(txt);
    };

    let actualizados = 0;
    try {
      const filtrosBase = [];
      const paramsBase = [origen.month, diaSemana];
      if (patientId) {
        filtrosBase.push(' AND ptm.patient_id = ?');
        paramsBase.push(patientId);
      }
      if (tratamientoId) {
        filtrosBase.push(' AND ptm.treatment_id = ?');
        paramsBase.push(tratamientoId);
      }
      const baseRows = await db.all(
        `SELECT ptm.patient_id, ptm.treatment_id, ptm.time
         FROM PATIENT_TURNS_MONTHLY ptm
         WHERE ptm.month = $1 AND ptm.day_of_week = $2${filtrosBase.join('')}
           AND EXISTS (
             SELECT 1 FROM PATIENTS p
             WHERE p.patient_id = ptm.patient_id
               AND COALESCE(p.is_discharged, FALSE) = FALSE
           )`,
        ...paramsBase
      );

      const filtrosOverrides = [];
      const paramsOverrides = [fromDate];
      if (patientId) {
        filtrosOverrides.push(' AND o.patient_id = ?');
        paramsOverrides.push(patientId);
      }
      if (tratamientoId) {
        filtrosOverrides.push(' AND o.treatment_id = ?');
        paramsOverrides.push(tratamientoId);
      }
      const overrideRows = await db.all(
        `SELECT o.patient_id, o.treatment_id, o.time, o.active
         FROM PATIENT_TURNS_OVERRIDES o
         WHERE o.date = $1${filtrosOverrides.join('')}
           AND EXISTS (
             SELECT 1 FROM PATIENTS p
             WHERE p.patient_id = o.patient_id
               AND COALESCE(p.is_discharged, FALSE) = FALSE
           )`,
        ...paramsOverrides
      );

      const efectivos = new Map();
      const claveRow = (fila) =>
        `${fila.patient_id}|${fila.treatment_id}|${String(fila.time || '').trim()}`;
      baseRows.forEach((fila) => {
        efectivos.set(claveRow(fila), {
          patient_id: fila.patient_id,
          treatment_id: fila.treatment_id,
          time: String(fila.time || '').trim(),
        });
      });
      overrideRows.forEach((fila) => {
        const normalizada = {
          patient_id: fila.patient_id,
          treatment_id: fila.treatment_id,
          time: String(fila.time || '').trim(),
        };
        const key = claveRow(normalizada);
        if (esActivoOverride(fila.active)) {
          efectivos.set(key, normalizada);
        } else {
          efectivos.delete(key);
        }
      });

      const filas = Array.from(efectivos.values());
      const fechasAnuladas = new Set();

      await db.run('BEGIN');
      for (const fila of filas) {
        const claveAnulacion = `${fila.patient_id}|${fila.treatment_id}`;
        if (!fechasAnuladas.has(claveAnulacion)) {
          await db.run(
            `UPDATE PATIENT_TURNS_OVERRIDES
             SET active = $1
             WHERE patient_id = $2 AND treatment_id = $3 AND date = $4`,
            [0, fila.patient_id, fila.treatment_id, fromDate]
          );
          fechasAnuladas.add(claveAnulacion);
        }
        await db.run(
          `INSERT INTO PATIENT_TURNS_OVERRIDES
           (patient_id, treatment_id, date, time, active)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (patient_id, treatment_id, date, time)
           DO UPDATE SET active = EXCLUDED.active`,
          [fila.patient_id, fila.treatment_id, fromDate, fila.time, 0]
        );
        if (!onlyDisable && toDate) {
          await db.run(
            `INSERT INTO PATIENT_TURNS_OVERRIDES
             (patient_id, treatment_id, date, time, active)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (patient_id, treatment_id, date, time)
             DO UPDATE SET active = EXCLUDED.active`,
            [fila.patient_id, fila.treatment_id, toDate, fila.time, 1]
          );
        }
        actualizados += 1;
      }
      await db.run('COMMIT');
    } catch (err) {
      try {
        await db.run('ROLLBACK');
      } catch (_) {}
      console.error(err);
      res.status(500).json({ error: String(err?.message || 'No se pudo actualizar') });
      return;
    }
    res.json({ updated: actualizados });
  });

  app.post('/api/patients/turns/revert-date-shift', async (req, res) => {
    const fromDateRaw = req.body?.fromDate;
    const toDateRaw = req.body?.toDate;
    const month = req.body?.month;
    const year = req.body?.year;
    const fromDate = parsearFechaShift(fromDateRaw, { month, year });
    const toDate = parsearFechaShift(toDateRaw, { month, year });
    const patientId = req.body?.patientId;
    const tratamientoRaw = req.body?.tratamiento;
    const tratamiento =
      normalizarTextoSimple(tratamientoRaw) === 'todos'
        ? ''
        : tratamientoRaw;
    const origen = normalizarFecha(fromDate);
    const destino = normalizarFecha(toDate);

    if (!origen || !destino) {
      res.status(400).json({ error: 'Fecha invalida' });
      return;
    }
    if (fromDate === toDate) {
      res.status(400).json({ error: 'Fecha origen y destino iguales' });
      return;
    }
    if (patientId && !(await validarPacienteOperable(patientId, res))) return;

    let tratamientoId = null;
    if (tratamiento) {
      tratamientoId = await obtenerTratamientoId(db, tratamiento);
      if (!tratamientoId) {
        res.status(400).json({ error: 'Tratamiento invalido' });
        return;
      }
    }

    let actualizados = 0;
    try {
      const filtros = [];
      const params = [fromDate, toDate];
      if (patientId) {
        filtros.push(' AND dest.patient_id = ?');
        params.push(patientId);
      }
      if (tratamientoId) {
        filtros.push(' AND dest.treatment_id = ?');
        params.push(tratamientoId);
      }

      const filas = await db.all(
        `SELECT dest.patient_id, dest.treatment_id, dest.time
         FROM patient_turns_overrides dest
         INNER JOIN patient_turns_overrides orig
           ON orig.patient_id = dest.patient_id
          AND orig.treatment_id = dest.treatment_id
          AND orig.time = dest.time
          AND orig.date = ?
         WHERE dest.date = ?
           AND COALESCE(dest.active, 0) <> 0
           AND COALESCE(orig.active, 1) = 0${filtros.join('')}
           AND EXISTS (
             SELECT 1 FROM patients p
             WHERE p.id = dest.patient_id
               AND COALESCE(p.is_discharged, FALSE) = FALSE
           )`,
        ...params
      );

      await db.run('BEGIN');
      for (const fila of filas) {
        await db.run(
          `INSERT INTO patient_turns_overrides
           (patient_id, treatment_id, date, time, active)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (patient_id, treatment_id, date, time)
           DO UPDATE SET active = EXCLUDED.active`,
          fila.patient_id,
          fila.treatment_id,
          toDate,
          fila.time,
          0
        );

        await db.run(
          `INSERT INTO patient_turns_overrides
           (patient_id, treatment_id, date, time, active)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (patient_id, treatment_id, date, time)
           DO UPDATE SET active = EXCLUDED.active`,
          fila.patient_id,
          fila.treatment_id,
          fromDate,
          fila.time,
          1
        );

        actualizados += 1;
      }
      await db.run('COMMIT');
    } catch (err) {
      try {
        await db.run('ROLLBACK');
      } catch (_) {}
      console.error(err);
      res.status(500).json({ error: String(err?.message || 'No se pudo revertir') });
      return;
    }

    res.json({ updated: actualizados });
  });

  app.post('/api/patients/:id/attendances', async (req, res) => {
    if (!(await validarPacienteOperable(req.params.id, res))) return;
    const asistencia = req.body || {};
    if (!asistencia.fecha) {
      res.status(400).json({ error: 'Fecha requerida' });
      return;
    }
    let tratamientoId = null;
    if (asistencia.tratamiento) {
      tratamientoId = await obtenerTratamientoId(db, asistencia.tratamiento);
    }
    await db.run(
      `INSERT INTO ATTENDANCES (patient_id, date, treatment_id, note)
       VALUES ($1, $2, $3, $4)`,
      [req.params.id, asistencia.fecha, tratamientoId, asistencia.nota || '']
    );
    await logUserActivity(req, {
      actionType: 'create',
      entityType: 'attendance',
      entityId: req.params.id,
      entityLabel: req.params.id,
      details: {
        fecha: asistencia.fecha,
        tratamiento: asistencia.tratamiento || '',
      },
    });
    res.json({ ok: true });
  });

  app.patch('/api/patients/:id/status', async (req, res) => {
    if (!(await validarPacienteOperable(req.params.id, res))) return;
    const filaActual = await db.get(
      `SELECT p.patient_id, p.authorization_expires_at, auth.authorization_date AS authorized_at
       FROM PATIENTS p
       LEFT JOIN LATERAL (
           SELECT authorization_date
           FROM AUTHORIZATIONS
           WHERE patient_id = p.patient_id
           ORDER BY created_at DESC
           LIMIT 1
       ) auth ON true
       WHERE p.patient_id = $1`,
      [req.params.id]
    );
    if (!filaActual) {
      res.status(404).json({ error: 'Paciente no encontrado' });
      return;
    }
    const activo = parseActivo(
      Object.prototype.hasOwnProperty.call(req.body || {}, 'activo')
        ? req.body.activo
        : req.body?.estado,
      true
    );
    const body = req.body || {};
    const hasAutorizadoDesde = [
      'autorizadoDesde',
      'authorizedAt',
      'authorized_at',
    ].some((k) => tienePropiedad(body, k));
    const hasAutorizadoHasta = [
      'autorizadoHasta',
      'authorizationExpiresAt',
      'authorization_expires_at',
    ].some((k) => tienePropiedad(body, k));
    let autorizadoDesde = hasAutorizadoDesde
      ? (normalizarFechaInput(valorPorClaves(body, ['autorizadoDesde', 'authorizedAt', 'authorized_at'])) || null)
      : (filaActual.authorized_at || null);
    const autorizadoHasta = hasAutorizadoHasta
      ? (normalizarFechaInput(
          valorPorClaves(body, ['autorizadoHasta', 'authorizationExpiresAt', 'authorization_expires_at'])
        ) || null)
      : (filaActual.authorization_expires_at || null);
    if (activo && !autorizadoDesde) {
      autorizadoDesde = obtenerFechaActualIso();
    }
    await db.run(
      'UPDATE PATIENTS SET is_active = $1, authorization_expires_at = $2 WHERE patient_id = $3',
      [activo, autorizadoHasta, req.params.id]
    );
    if (autorizadoDesde && autorizadoDesde !== filaActual.authorized_at) {
      await db.run(
        `INSERT INTO AUTHORIZATIONS (patient_id, authorization_date)
         VALUES ($1, $2)`,
        [req.params.id, autorizadoDesde]
      );
    }
    const fila = await obtenerFilaPacienteBase(req.params.id);
    const paciente = await construirPaciente(db, fila);
    if (!paciente) {
      res.status(404).json({ error: 'Paciente no encontrado' });
      return;
    }
    res.json(paciente);
  });

  app.patch('/api/patients/:id/discharge', async (req, res) => {
    const fila = await db.get(
      'SELECT patient_id, is_discharged, discharged_at FROM PATIENTS WHERE patient_id = $1',
      [req.params.id]
    );
    if (!fila) {
      res.status(404).json({ error: 'Paciente no encontrado' });
      return;
    }
    const dadoDeBaja = parseBaja(
      Object.prototype.hasOwnProperty.call(req.body || {}, 'dadoDeBaja')
        ? req.body.dadoDeBaja
        : req.body?.estadoPaciente,
      Boolean(fila.is_discharged)
    );
    const fechaBaja = dadoDeBaja
      ? resolverFechaBaja(req.body?.fechaBaja, fila.discharged_at || new Date().toISOString())
      : null;
    await db.run(
      'UPDATE PATIENTS SET is_discharged = $1, discharged_at = $2 WHERE patient_id = $3',
      [dadoDeBaja, fechaBaja, req.params.id]
    );
    const actualizada = await obtenerFilaPacienteBase(req.params.id);
    const paciente = await construirPaciente(db, actualizada);
    res.json(paciente);
  });

  app.get('/api/patients/:id/requests', async (req, res) => {
    const paciente = await db.get('SELECT patient_id FROM PATIENTS WHERE patient_id = $1', [req.params.id]);
    if (!paciente) {
      res.status(404).json({ error: 'Paciente no encontrado' });
      return;
    }
    const historyMonths = Number(req.query?.historyMonths || 12);
    const cutoff = obtenerFechaCorteSolicitudes(historyMonths);
    const solicitudes = await db.all(
      `SELECT patient_req_id AS id, start_date, end_date, apply_treatments, applied_at, created_at, updated_at
       FROM PATIENT_REQUESTS
       WHERE patient_id = $1
         AND (end_date >= $2 OR start_date >= $3)
       ORDER BY start_date DESC, patient_req_id DESC`,
      [req.params.id, cutoff, cutoff]
    );
    const filasTratamientos = await db.all(
      `SELECT prt.request_id, t.name
       FROM PATIENT_REQUEST_TREATMENTS prt
       JOIN PATIENT_REQUESTS pr ON pr.patient_req_id = prt.request_id
       JOIN TREATMENTS t ON t.id = prt.treatment_id
       WHERE pr.patient_id = $1
         AND (pr.end_date >= $2 OR pr.start_date >= $3)`,
      [req.params.id, cutoff, cutoff]
    );
    const tratamientosPorSolicitud = new Map();
    for (const row of filasTratamientos) {
      if (!tratamientosPorSolicitud.has(row.request_id)) {
        tratamientosPorSolicitud.set(row.request_id, []);
      }
      tratamientosPorSolicitud.get(row.request_id).push(row.name);
    }
    const hoy = obtenerFechaActualIso();
    const data = solicitudes.map((s) => {
      const fechaInicio = String(s.start_date || '').slice(0, 10);
      const fechaFin = String(s.end_date || '').slice(0, 10);
      return {
        id: s.id,
        fechaInicio,
        fechaFin,
        tratamientos: (tratamientosPorSolicitud.get(s.id) || []).slice().sort((a, b) => a.localeCompare(b, 'es')),
        aplicaTratamientos: parseBoolean(s.apply_treatments, false),
        aplicadaEn: s.applied_at || '',
        creadaEn: s.created_at || '',
        actualizadaEn: s.updated_at || '',
        vigente: Boolean(fechaInicio && fechaFin && fechaInicio <= hoy && hoy <= fechaFin),
        futura: Boolean(fechaInicio && fechaInicio > hoy),
        vencida: Boolean(fechaFin && fechaFin < hoy),
      };
    });
    res.json(data);
  });

  app.post('/api/patients/:id/requests', async (req, res) => {
    if (!(await validarPacienteOperable(req.params.id, res))) return;
    const data = req.body || {};
    const fechaInicio = normalizarFechaInput(
      valorPorClaves(data, ['fechaInicio', 'startDate', 'start_date'])
    );
    const fechaFin = normalizarFechaInput(
      valorPorClaves(data, ['fechaFin', 'endDate', 'end_date'])
    );
    if (!fechaInicio || !fechaFin) {
      res.status(400).json({ error: 'Fecha de inicio y fecha de fin requeridas.' });
      return;
    }
    if (fechaFin < fechaInicio) {
      res.status(400).json({ error: 'La fecha de fin no puede ser anterior al inicio.' });
      return;
    }
    const tratamientosRaw = Array.isArray(data.tratamientos) ? data.tratamientos : [];
    const tratamientos = Array.from(
      new Set(
        tratamientosRaw
          .map((t) => String(t || '').trim())
          .filter(Boolean)
      )
    );
    if (!tratamientos.length) {
      res.status(400).json({ error: 'Debes seleccionar al menos una terapia.' });
      return;
    }
    const aplicarTratamientos = parseBoolean(
      valorPorClaves(data, ['aplicarTratamientos', 'applyTreatments', 'apply_treatments']),
      false
    );
    const tratamientoIds = [];
    for (const tratamiento of tratamientos) {
      const treatmentId = await obtenerTratamientoId(db, tratamiento);
      if (!treatmentId) {
        res.status(400).json({ error: `Tratamiento invalido: ${tratamiento}` });
        return;
      }
      tratamientoIds.push(treatmentId);
    }
    try {
      await db.run('BEGIN');
      const inserted = await db.get(
        `INSERT INTO PATIENT_REQUESTS (patient_id, start_date, end_date, apply_treatments, updated_at)
         VALUES ($1, $2, $3, $4, now())
         RETURNING patient_req_id`,
        [req.params.id, fechaInicio, fechaFin, aplicarTratamientos]
      );
      const requestId =
        inserted?.patient_req_id ||
        (
          await db.get(
            `SELECT patient_req_id
             FROM PATIENT_REQUESTS
             WHERE patient_id = $1 AND start_date = $2 AND end_date = $3 AND apply_treatments = $4
             ORDER BY patient_req_id DESC
             LIMIT 1`,
            [req.params.id, fechaInicio, fechaFin, aplicarTratamientos]
          )
        )?.patient_req_id;
      if (!requestId) {
        throw new Error('No se pudo crear la solicitud.');
      }
      for (const treatmentId of tratamientoIds) {
        await db.run(
          `INSERT INTO PATIENT_REQUEST_TREATMENTS (request_id, treatment_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [requestId, treatmentId]
        );
      }
      await db.run('COMMIT');
      await logUserActivity(req, {
        actionType: 'create',
        entityType: 'patient_request',
        entityId: String(requestId),
        entityLabel: req.params.id,
        details: { fechaInicio, fechaFin, tratamientos, aplicarTratamientos },
      });
    } catch (err) {
      try {
        await db.run('ROLLBACK');
      } catch (_) {}
      console.error(err);
      res.status(500).json({ error: 'No se pudo guardar la solicitud.' });
      return;
    }
    const fila = await obtenerFilaPacienteBase(req.params.id);
    const paciente = await construirPaciente(db, fila);
    res.json(paciente);
  });

  app.delete('/api/patients/:id', async (req, res) => {
    if (!req.auth?.isAdmin) {
      res.status(403).json({ error: 'Solo administradores pueden eliminar pacientes.' });
      return;
    }
    const target = await db.get(
      'SELECT patient_id AS id, first_name, last_name FROM PATIENTS WHERE patient_id = $1',
      [req.params.id]
    );
    if (!target) {
      res.status(404).json({ error: 'Paciente no encontrado' });
      return;
    }
    await db.run('DELETE FROM PATIENTS WHERE patient_id = $1', [req.params.id]);
    await logUserActivity(req, {
      actionType: 'delete',
      entityType: 'patient',
      entityId: target.id,
      entityLabel:
        `${String(target.first_name || '').trim()} ${String(target.last_name || '').trim()}`.trim() ||
        String(target.full_name || '').trim() ||
        target.id,
    });
    res.json({ ok: true });
  });
}

module.exports = { registerPatientsRoutes };
