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
      'SELECT id, is_discharged FROM patients WHERE id = ?',
      patientId
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

  app.get('/api/patients', async (req, res) => {
    const lista = await listarPacientes(db);
    res.json(lista);
  });

  app.get('/api/patients/:id', async (req, res) => {
    const fila = await db.get('SELECT * FROM patients WHERE id = ?', req.params.id);
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
      `SELECT id, birth_date, dni, diagnosis, is_active, is_discharged, discharged_at, module_type, authorized_at, authorization_expires_at, car_years, ppi_years, acta_acuerdo_years
       FROM patients
       WHERE id = ?`,
      id
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
      `SELECT id
       FROM patients
       WHERE trim(dni) = trim(?)
       LIMIT 1`,
      dniNormalizado
    );
    if (existentePorDni?.id && existentePorDni.id !== id) {
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
        `UPDATE patients
         SET full_name = ?, first_name = ?, last_name = ?, age = ?, birth_date = ?, condition = ?, last_visit = ?, last_fisiatrico = ?, last_fisiatrico_alta = ?, last_fisiatrico_vencimiento = ?, last_trabajo_social = ?, last_trabajo_social_alta = ?, last_trabajo_social_vencimiento = ?, dni = ?, cuit = ?, affiliate_number = ?, integracion_horario = ?, diagnosis = ?, father_tutor_name = ?, father_tutor_phone = ?, mother_tutor_name = ?, mother_tutor_phone = ?, address_street = ?, address_number = ?, address_neighborhood = ?, address_floor = ?, address_sector = ?, school_name = ?, school_grade = ?, school_shift = ?, car_years = ?, ppi_years = ?, acta_acuerdo_years = ?, notes = ?, module_type = ?, authorized_at = ?, authorization_expires_at = ?, is_active = ?, is_discharged = ?, discharged_at = ?, parametro = ?
         WHERE id = ?`,
        nombreCompleto,
        nombre,
        apellido,
        edadFinal,
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
        autorizadoDesdeFinal,
        autorizadoHastaFinal,
        activoFinal,
        bajaFinal,
        fechaBajaFinal,
        parametro,
        id
      );
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
        `INSERT INTO patients (id, full_name, first_name, last_name, age, birth_date, condition, last_visit, last_fisiatrico, last_fisiatrico_alta, last_fisiatrico_vencimiento, last_trabajo_social, last_trabajo_social_alta, last_trabajo_social_vencimiento, dni, cuit, affiliate_number, integracion_horario, diagnosis, father_tutor_name, father_tutor_phone, mother_tutor_name, mother_tutor_phone, address_street, address_number, address_neighborhood, address_floor, address_sector, school_name, school_grade, school_shift, car_years, ppi_years, acta_acuerdo_years, notes, module_type, authorized_at, authorization_expires_at, is_active, is_discharged, discharged_at, parametro)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        nombreCompleto,
        nombre,
        apellido,
        edadFinal,
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
        autorizadoDesdeFinal,
        autorizadoHastaFinal,
        activoFinal,
        bajaFinal,
        fechaBajaFinal,
        parametro
      );
    }

    const tratamientos = Array.isArray(data.tratamientos)
      ? data.tratamientos
      : [];
    for (const t of tratamientos) {
      const tratamientoId = await obtenerTratamientoId(db, t);
      if (tratamientoId) {
        await db.run(
          'INSERT OR IGNORE INTO patient_treatments (patient_id, treatment_id) VALUES (?, ?)',
          id,
          tratamientoId
        );
      }
    }

    if (data.turnosBase) {
      await guardarTurnosMensuales(db, id, data.turnosBase);
    }

    const fila = await db.get('SELECT * FROM patients WHERE id = ?', id);
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
          'INSERT OR IGNORE INTO patient_treatments (patient_id, treatment_id) VALUES (?, ?)',
          req.params.id,
          tratamientoId
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
    const fila = await db.get('SELECT * FROM patients WHERE id = ?', req.params.id);
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
      `DELETE FROM patient_treatments
       WHERE patient_id = ? AND treatment_id = ?`,
      req.params.id,
      tratamientoId
    );
    await db.run(
      `DELETE FROM patient_turns
       WHERE patient_id = ? AND treatment_id = ?`,
      req.params.id,
      tratamientoId
    );
    await db.run(
      `DELETE FROM patient_turns_monthly
       WHERE patient_id = ? AND treatment_id = ?`,
      req.params.id,
      tratamientoId
    );
    await logUserActivity(req, {
      actionType: 'delete',
      entityType: 'patient_treatment',
      entityId: req.params.id,
      entityLabel: req.params.id,
      details: { tratamiento: String(tratamiento || '') },
    });
    const fila = await db.get('SELECT * FROM patients WHERE id = ?', req.params.id);
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
       FROM patient_turns_monthly
       WHERE patient_id = ? AND treatment_id = ? AND month = ? AND day_of_week = ? AND time = ?`,
      req.params.id,
      tratamientoId,
      mes,
      dia,
      hora
    );
    if (existe) {
      await db.run(
        `DELETE FROM patient_turns_monthly
         WHERE patient_id = ? AND treatment_id = ? AND month = ? AND day_of_week = ? AND time = ?`,
        req.params.id,
        tratamientoId,
        mes,
        dia,
        hora
      );
    } else {
      // Regla de negocio: un solo horario por dia para cada tratamiento/mes.
      await db.run(
        `DELETE FROM patient_turns_monthly
         WHERE patient_id = ? AND treatment_id = ? AND month = ? AND day_of_week = ?`,
        req.params.id,
        tratamientoId,
        mes,
        dia
      );
      await db.run(
        `INSERT INTO patient_turns_monthly (patient_id, treatment_id, month, day_of_week, time)
         VALUES (?, ?, ?, ?, ?)`,
        req.params.id,
        tratamientoId,
        mes,
        dia,
        hora
      );
    }
    const fila = await db.get('SELECT * FROM patients WHERE id = ?', req.params.id);
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
      `INSERT INTO patient_turns_overrides
       (patient_id, treatment_id, date, time, active)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (patient_id, treatment_id, date, time)
       DO UPDATE SET active = EXCLUDED.active`,
      req.params.id,
      tratamientoId,
      fecha,
      hora,
      activo
    );
    const fila = await db.get('SELECT * FROM patients WHERE id = ?', req.params.id);
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
         FROM patient_turns_monthly
         WHERE day_of_week = ?${wherePaciente}${whereMes}
           AND EXISTS (
             SELECT 1 FROM patients p
             WHERE p.id = patient_turns_monthly.patient_id
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
           FROM patient_turns_monthly
           WHERE patient_id = ? AND treatment_id = ? AND month = ? AND day_of_week = ?`,
          fila.patient_id,
          fila.treatment_id,
          fila.month,
          fromDay
        );
        for (const h of horas) {
          const existe = await db.get(
            `SELECT 1
             FROM patient_turns_monthly
             WHERE patient_id = ? AND treatment_id = ? AND month = ? AND day_of_week = ? AND time = ?`,
            fila.patient_id,
            fila.treatment_id,
            fila.month,
            toDay,
            h.time
          );
          if (existe) {
            await db.run(
              `DELETE FROM patient_turns_monthly
               WHERE patient_id = ? AND treatment_id = ? AND month = ? AND day_of_week = ? AND time = ?`,
              fila.patient_id,
              fila.treatment_id,
              fila.month,
              fromDay,
              h.time
            );
          } else {
            await db.run(
              `UPDATE patient_turns_monthly
               SET day_of_week = ?
               WHERE patient_id = ? AND treatment_id = ? AND month = ? AND day_of_week = ? AND time = ?`,
              toDay,
              fila.patient_id,
              fila.treatment_id,
              fila.month,
              fromDay,
              h.time
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
         FROM patient_turns_monthly ptm
         WHERE ptm.month = ? AND ptm.day_of_week = ?${filtrosBase.join('')}
           AND EXISTS (
             SELECT 1 FROM patients p
             WHERE p.id = ptm.patient_id
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
         FROM patient_turns_overrides o
         WHERE o.date = ?${filtrosOverrides.join('')}
           AND EXISTS (
             SELECT 1 FROM patients p
             WHERE p.id = o.patient_id
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
            `UPDATE patient_turns_overrides
             SET active = ?
             WHERE patient_id = ? AND treatment_id = ? AND date = ?`,
            0,
            fila.patient_id,
            fila.treatment_id,
            fromDate
          );
          fechasAnuladas.add(claveAnulacion);
        }
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
          0
        );
        if (!onlyDisable && toDate) {
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
            1
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
      `INSERT INTO attendances (patient_id, date, treatment_id, note)
       VALUES (?, ?, ?, ?)`,
      req.params.id,
      asistencia.fecha,
      tratamientoId,
      asistencia.nota || ''
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
      'SELECT id, authorized_at, authorization_expires_at FROM patients WHERE id = ?',
      req.params.id
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
      'UPDATE patients SET is_active = ?, authorized_at = ?, authorization_expires_at = ? WHERE id = ?',
      activo,
      autorizadoDesde,
      autorizadoHasta,
      req.params.id
    );
    const fila = await db.get('SELECT * FROM patients WHERE id = ?', req.params.id);
    const paciente = await construirPaciente(db, fila);
    if (!paciente) {
      res.status(404).json({ error: 'Paciente no encontrado' });
      return;
    }
    res.json(paciente);
  });

  app.patch('/api/patients/:id/discharge', async (req, res) => {
    const fila = await db.get(
      'SELECT id, is_discharged, discharged_at FROM patients WHERE id = ?',
      req.params.id
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
      'UPDATE patients SET is_discharged = ?, discharged_at = ? WHERE id = ?',
      dadoDeBaja,
      fechaBaja,
      req.params.id
    );
    const actualizada = await db.get('SELECT * FROM patients WHERE id = ?', req.params.id);
    const paciente = await construirPaciente(db, actualizada);
    res.json(paciente);
  });

  app.get('/api/patients/:id/requests', async (req, res) => {
    const paciente = await db.get('SELECT id FROM patients WHERE id = ?', req.params.id);
    if (!paciente) {
      res.status(404).json({ error: 'Paciente no encontrado' });
      return;
    }
    const historyMonths = Number(req.query?.historyMonths || 12);
    const cutoff = obtenerFechaCorteSolicitudes(historyMonths);
    const solicitudes = await db.all(
      `SELECT id, start_date, end_date, apply_treatments, applied_at, created_at, updated_at
       FROM patient_requests
       WHERE patient_id = ?
         AND (end_date >= ? OR start_date >= ?)
       ORDER BY start_date DESC, id DESC`,
      req.params.id,
      cutoff,
      cutoff
    );
    const filasTratamientos = await db.all(
      `SELECT prt.request_id, t.name
       FROM patient_request_treatments prt
       JOIN patient_requests pr ON pr.id = prt.request_id
       JOIN treatments t ON t.id = prt.treatment_id
       WHERE pr.patient_id = ?
         AND (pr.end_date >= ? OR pr.start_date >= ?)`,
      req.params.id,
      cutoff,
      cutoff
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
        `INSERT INTO patient_requests (patient_id, start_date, end_date, apply_treatments, updated_at)
         VALUES (?, ?, ?, ?, now())
         RETURNING id`,
        req.params.id,
        fechaInicio,
        fechaFin,
        aplicarTratamientos
      );
      const requestId =
        inserted?.id ||
        (
          await db.get(
            `SELECT id
             FROM patient_requests
             WHERE patient_id = ? AND start_date = ? AND end_date = ? AND apply_treatments = ?
             ORDER BY id DESC
             LIMIT 1`,
            req.params.id,
            fechaInicio,
            fechaFin,
            aplicarTratamientos
          )
        )?.id;
      if (!requestId) {
        throw new Error('No se pudo crear la solicitud.');
      }
      for (const treatmentId of tratamientoIds) {
        await db.run(
          `INSERT INTO patient_request_treatments (request_id, treatment_id)
           VALUES (?, ?)
           ON CONFLICT DO NOTHING`,
          requestId,
          treatmentId
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
    const fila = await db.get('SELECT * FROM patients WHERE id = ?', req.params.id);
    const paciente = await construirPaciente(db, fila);
    res.json(paciente);
  });

  app.delete('/api/patients/:id', async (req, res) => {
    if (!req.auth?.isAdmin) {
      res.status(403).json({ error: 'Solo administradores pueden eliminar pacientes.' });
      return;
    }
    const target = await db.get(
      'SELECT id, full_name, first_name, last_name FROM patients WHERE id = ?',
      req.params.id
    );
    if (!target) {
      res.status(404).json({ error: 'Paciente no encontrado' });
      return;
    }
    await db.run('DELETE FROM patients WHERE id = ?', req.params.id);
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
