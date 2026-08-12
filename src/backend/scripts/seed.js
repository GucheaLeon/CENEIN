const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');

const candidateSchemaPaths = [
  path.join(__dirname, '..', 'schema.sql'),
  path.join(__dirname, 'schema.sql'),
  '/app/schema.sql',
  path.resolve(process.cwd(), 'schema.sql'),
  path.resolve(process.cwd(), 'src', 'backend', 'schema.sql')
];
const SCHEMA_SQL_PATH = candidateSchemaPaths.find(p => fs.existsSync(p)) || candidateSchemaPaths[0];

const candidateMigrationPaths = [
  path.join(__dirname, '..', 'migrations'),
  path.join(__dirname, 'migrations'),
  '/app/migrations',
  path.resolve(process.cwd(), 'migrations'),
  path.resolve(process.cwd(), 'src', 'backend', 'migrations')
];
const MIGRATIONS_DIR = candidateMigrationPaths.find(p => fs.existsSync(p)) || candidateMigrationPaths[0];

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://cenein:supersecret@127.0.0.1:5432/cenein_db';

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const iterations = 310000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  return `pbkdf2$${iterations}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

// Generador de datos pseudo-aleatorios reproducible
function createRandom(seed = 12345) {
  let s = seed;
  return {
    next() {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    },
    int(min, max) {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    pick(arr) {
      return arr[this.int(0, arr.length - 1)];
    },
    pickMultiple(arr, count) {
      const shuffled = [...arr].sort(() => this.next() - 0.5);
      return shuffled.slice(0, Math.min(count, arr.length));
    },
    uuid() {
      return 'f' + Math.random().toString(16).substring(2, 10) + '-' +
             Math.random().toString(16).substring(2, 6) + '-4' +
             Math.random().toString(16).substring(2, 5) + '-a' +
             Math.random().toString(16).substring(2, 5) + '-' +
             Math.random().toString(16).substring(2, 14);
    },
    dni() {
      return String(this.int(35000000, 58000000));
    },
    cuit(dni) {
      const prefix = this.pick(['20', '27', '23', '24']);
      const suffix = this.int(0, 9);
      return `${prefix}${dni}${suffix}`;
    },
    phone() {
      const cod = this.pick(['11', '351', '341', '261', '221', '381', '223']);
      const num = this.int(4000000, 9999999);
      return `+54 ${cod} ${num}`;
    },
    dateBetween(startYear = 2024, endYear = 2026) {
      const y = this.int(startYear, endYear);
      const m = String(this.int(1, 12)).padStart(2, '0');
      const d = String(this.int(1, 28)).padStart(2, '0');
      return `${y}-${m}-${d}`;
    },
    recentDate(daysAgo = 60) {
      const now = new Date('2026-08-12');
      const past = new Date(now.getTime() - this.int(1, daysAgo) * 24 * 3600 * 1000);
      return past.toISOString().split('T')[0];
    },
    futureDate(daysAhead = 180) {
      const now = new Date('2026-08-12');
      const future = new Date(now.getTime() + this.int(5, daysAhead) * 24 * 3600 * 1000);
      return future.toISOString().split('T')[0];
    }
  };
}

const NOMBRES_VARONES = [
  'Mateo', 'Joaquín', 'Benjamin', 'Felipe', 'Santiago', 'Lucas', 'Bautista', 'Thiago', 'Gabriel', 'Ignacio',
  'Tomas', 'Agustin', 'Nicolas', 'Franco', 'Bruno', 'Santino', 'Valentino', 'Lautaro', 'Juan', 'Francisco',
  'Enzo', 'Facundo', 'Gonzalo', 'Ramiro', 'Manuel', 'Julian', 'Sebastian', 'Leandro', 'Ezequiel', 'Marcos',
  'Emiliano', 'Esteban', 'Alan', 'Dante', 'Ian', 'Matias', 'Patricio', 'Simon', 'Tiziano', 'Lisandro'
];

const NOMBRES_MUJERES = [
  'Emma', 'Olivia', 'Martina', 'Sofia', 'Isabella', 'Catalina', 'Delfina', 'Valentina', 'Mia', 'Victoria',
  'Renata', 'Juana', 'Lucia', 'Alma', 'Clara', 'Zoe', 'Elena', 'Guadalupe', 'Camila', 'Josefina',
  'Agustina', 'Lola', 'Abril', 'Bianca', 'Julieta', 'Antonella', 'Paula', 'Carolina', 'Florencia', 'Rosario',
  'Constanza', 'Micaela', 'Paloma', 'Malena', 'Rocio', 'Sol', 'Candela', 'Belen', 'Violeta', 'Celeste'
];

const APELLIDOS = [
  'Gonzalez', 'Rodriguez', 'Gomez', 'Fernandez', 'Lopez', 'Diaz', 'Martinez', 'Perez', 'Garcia', 'Sanchez',
  'Romero', 'Sosa', 'Alvarez', 'Torres', 'Ruiz', 'Ramirez', 'Flores', 'Acosta', 'Benitez', 'Medina',
  'Herrera', 'Aguirre', 'Castro', 'Gimenez', 'Gutiérrez', 'Molina', 'Silva', 'Rojas', 'Ortiz', 'Nunez',
  'Luna', 'Juarez', 'Cabrera', 'Rios', 'Morales', 'Godoy', 'Moreno', 'Ferreyra', 'Domínguez', 'Carrizo'
];

const CALLES = [
  'Av. Santa Fe', 'Av. Cabildo', 'Av. Rivadavia', 'Av. Corrientes', 'Av. Maipú', 'Av. Belgrano', 'Av. San Martín',
  'Calle Italia', 'Calle España', 'Calle San Lorenzo', 'Av. Libertador', 'Calle Mitre', 'Calle Sarmiento',
  'Calle Urquiza', 'Av. Córdoba', 'Calle Lavalle', 'Calle Tucumán', 'Calle Mendoza', 'Calle Salta', 'Calle Jujuy'
];

const BARRIOS = [
  'Belgrano', 'Palermo', 'Recoleta', 'Caballito', 'Flores', 'San Isidro', 'Olivos', 'Vicente López',
  'Avellaneda', 'Quilmes', 'Banfield', 'Lomas de Zamora', 'Martínez', 'Villa Urquiza', 'Villa Devoto', 'Córdoba Centro'
];

const CONDICIONES = [
  'TEA (Trastorno del Espectro Autista)',
  'TGD (Trastorno Generalizado del Desarrollo)',
  'Síndrome de Down',
  'Parálisis Cerebral',
  'Retraso Madurativo Global',
  'Hipoacusia Neurosensorial',
  'Trastorno del Lenguaje y la Comunicación',
  'TDAH (Déficit de Atención e Hiperactividad)',
  'Discapacidad Motora',
  'Trastorno de la Coordinación Motriz',
  'Ninguno'
];

const DIAGNOSTICOS = [
  'Trastorno del Espectro Autista Grado 1 con requerimiento de apoyo psicopedagógico y fonoaudiológico.',
  'Trastorno del Espectro Autista Grado 2 con compromiso en lenguaje expresivo y conducta adaptativa.',
  'Retraso Madurativo Severo con afectación en pautas motoras y lenguaje.',
  'Síndrome de Down con hipotonía muscular leve y desafío de integración escolar.',
  'Parálisis Cerebral tipo Diplejía Espástica en tratamiento kinesiológico.',
  'Trastorno Mixto del Aprendizaje con dificultades de atención y lectura escritura.',
  'Hipoacusia Bilateral Moderada con equipamiento audioprotésico.',
  'Trastorno del Lenguaje Expresivo-Comprensivo con indicación de fonoaudiología intensiva.',
  'Déficit de Atención con Hiperactividad en seguimiento multidisciplinario.',
  'Retraso del Desarrollo Psicomotor con necesidad de terapia ocupacional.'
];

const ESCUELAS = [
  'Escuela Primaria N° 12 San Martín', 'Colegio San José', 'Instituto Nuestra Señora del Carmen',
  'Escuela Especial N° 501', 'Colegio Belgrano Day School', 'Escuela N° 4 Manuel Belgrano',
  'Instituto Educativo Siglo XXI', 'Escuela Parroquial Santa Teresa', 'Colegio Modelo Lomas',
  'Escuela Primaria N° 8 Domingo F. Sarmiento', 'Instituto Sagrado Corazón'
];

const NOTAS_CLINICAS = [
  'Paciente con buena evolución en el área de comunicación verbal. Muestra mayor tolerancia a actividades estructuradas.',
  'Se sugiere continuar con el plan actual de tratamiento. La familia acompaña de forma activa el proceso.',
  'Se observa avance en la motricidad fina y autorregulación emocional durante las sesiones.',
  'Pendiente de presentación de informe escolar de fin de cuatrimestre.',
  'Se ajustan días de concurrencia a pedido del equipo de integración escolar.',
  'Paciente adaptado al espacio terapéutico. Muestra empatía con el equipo multidisciplinario.',
  'Se requiere actualización de CUD y renovación de orden médica para prórroga de módulo.',
  'Reunión de equipo realizada con la escuela integradora. Acuerdos pedagógicos fijados.'
];

async function seed() {
  console.log('🚀 Iniciando script de repoblación masiva de la base de datos (PostgreSQL)...');
  console.log(`📌 Conectando a PostgreSQL en: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);

  const pool = new Pool({ connectionString: DATABASE_URL });
  
  try {
    const client = await pool.connect();
    console.log('✅ Conexión a PostgreSQL establecida correctamente.');

    // 1. Ejecutar Schema base si es necesario
    console.log('📄 Cargando esquema de base de datos...');
    const schemaSql = fs.readFileSync(SCHEMA_SQL_PATH, 'utf8');
    await client.query(schemaSql);

    // 2. Ejecutar Migraciones
    if (fs.existsSync(MIGRATIONS_DIR)) {
      console.log('🔄 Verificando y aplicando migraciones...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS _schema_migrations (
          name TEXT PRIMARY KEY,
          applied_at TIMESTAMPTZ DEFAULT now()
        )
      `);
      const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
      for (const file of files) {
        const checkRes = await client.query('SELECT name FROM _schema_migrations WHERE name = $1', [file]);
        if (checkRes.rowCount === 0) {
          const migSql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
          await client.query(migSql);
          await client.query('INSERT INTO _schema_migrations (name) VALUES ($1)', [file]);
          console.log(`   └─ Migración aplicada: ${file}`);
        }
      }
    }

    // 3. Limpiar datos existentes en orden de dependencias
    console.log('🧹 Limpiando tablas previas para regeneración limpia...');
    const tablesToTruncate = [
      'attendances', 'patient_turns_overrides', 'patient_turns_monthly', 'patient_turns',
      'patient_treatments', 'pacient_reports', 'patient_documents', 'patient_records',
      'treatment_plan_items', 'treatment_plans', 'authorizations', 'patient_state_history',
      'patients_sede', 'patient_request_treatments', 'patient_requests', 'invoice',
      'module_patient', 'admission_documents', 'admission_fisiatric_review', 'admissions',
      'user_activity_logs', 'user_roles', 'users', 'patients', 'module', 'invoice_type',
      'invoice_status', 'roles', 'documents_type', 'report_types', 'patient_state',
      'treatments', 'sede', 'os'
    ];

    for (const table of tablesToTruncate) {
      await client.query(`TRUNCATE TABLE ${table} CASCADE;`).catch(() => {});
    }

    console.log('✅ Tablas limpiadas.');

    // 4. Cargar Catálogos Edictos Base
    console.log('📦 Poblando tablas de catálogo...');

    const obrasSociales = [
      'OSDE', 'Swiss Medical', 'OSECAC', 'IOMA', 'PAMI', 'Galeno',
      'Unión Personal', 'Medifé', 'Omint', 'Ospaca', 'Particular'
    ];
    for (const os of obrasSociales) {
      await client.query('INSERT INTO os (name) VALUES ($1) ON CONFLICT DO NOTHING', [os]);
    }

    const sedes = [
      'Sede Central (Belgrano)', 'Sede Norte (San Isidro)', 'Sede Sur (Avellaneda)', 'Sede Córdoba'
    ];
    for (const s of sedes) {
      await client.query('INSERT INTO sede (name) VALUES ($1) ON CONFLICT DO NOTHING', [s]);
    }

    const tratamientos = [
      'Fonoaudiologia', 'Psicologia', 'Psicopedagogia', 'Psicomotricidad',
      'Kinesiologia', 'TO Terapia Ocupacional', 'Integracion', 'Estimulacion Temprana', 'Musicoterapia'
    ];
    for (const t of tratamientos) {
      await client.query('INSERT INTO treatments (name) VALUES ($1) ON CONFLICT DO NOTHING', [t]);
    }

    const estadosPaciente = [
      'En Tratamiento', 'En Evaluacion', 'Pendiente Autorizacion', 'Suspendido', 'Dado de Alta', 'En Admision'
    ];
    for (const ep of estadosPaciente) {
      await client.query('INSERT INTO patient_state (name) VALUES ($1) ON CONFLICT DO NOTHING', [ep]);
    }

    const tiposReportes = [
      'Informe Evolutivo', 'Informe Inicial', 'Informe Fisiatrico', 'Informe Trabajo Social',
      'Evaluacion Diagnostica', 'Informe de Cierre'
    ];
    for (const tr of tiposReportes) {
      await client.query('INSERT INTO report_types (name) VALUES ($1) ON CONFLICT DO NOTHING', [tr]);
    }

    const tiposDocumentos = [
      'DNI Paciente', 'DNI Tutor', 'CUD (Certificado Único de Discapacidad)', 'Carnet Obra Social',
      'Pedido Médico', 'Presupuesto Aprobado', 'Consentimiento Informado', 'Resumen Historia Clínica'
    ];
    for (const td of tiposDocumentos) {
      await client.query('INSERT INTO documents_type (description) VALUES ($1) ON CONFLICT DO NOTHING', [td]);
    }

    const rolesList = ['Admin', 'Fisiatra', 'Trabajo Social', 'profesional', 'Recepcion', 'Coordinacion'];
    for (const r of rolesList) {
      await client.query('INSERT INTO roles (name) VALUES ($1) ON CONFLICT DO NOTHING', [r]);
    }

    const invoiceStatuses = ['Pendiente', 'Pagada', 'Vencida', 'Anulada'];
    for (const invs of invoiceStatuses) {
      await client.query('INSERT INTO invoice_status (description) VALUES ($1)', [invs]);
    }

    const invoiceTypes = ['Factura A', 'Factura B', 'Factura C', 'Recibo'];
    for (const invt of invoiceTypes) {
      await client.query('INSERT INTO invoice_type (description) VALUES ($1)', [invt]);
    }

    const modules = [
      'MII (Móvil/Integración Inicial)', 'MIS (Módulo Integración Escolar)',
      'MIE (Módulo Integración Especial)', 'MET (Módulo Estimulación Temprana)',
      'MAR (Módulo Ambulatorio Rehabilitación)'
    ];
    for (const mod of modules) {
      await client.query('INSERT INTO module (description) VALUES ($1) ON CONFLICT DO NOTHING', [mod]);
    }

    // Obtenemos IDs insertados
    const osRows = (await client.query('SELECT id, name FROM os')).rows;
    const sedeRows = (await client.query('SELECT id, name FROM sede')).rows;
    const treatmentRows = (await client.query('SELECT id, name FROM treatments')).rows;
    const stateRows = (await client.query('SELECT id, name FROM patient_state')).rows;
    const reportTypeRows = (await client.query('SELECT id, name FROM report_types')).rows;
    const docTypeRows = (await client.query('SELECT id, description FROM documents_type')).rows;
    const roleRows = (await client.query('SELECT id, name FROM roles')).rows;
    const moduleRows = (await client.query('SELECT id, description FROM module')).rows;
    const invTypeRows = (await client.query('SELECT id, description FROM invoice_type')).rows;
    const invStatusRows = (await client.query('SELECT id, description FROM invoice_status')).rows;

    const roleMap = Object.fromEntries(roleRows.map(r => [r.name, r.id]));

    // 5. Crear Empleados y Usuarios
    console.log('👥 Creando usuarios y personal del centro (Empleados)...');
    
    const usuariosDefault = [
      { username: 'admin', pass: 'admin1234', isAdmin: true, role: 'Admin' },
      { username: 'dra.gonzalez', pass: 'fisiatra123', isAdmin: false, role: 'Fisiatra' },
      { username: 'dr.rodriguez', pass: 'fisiatra123', isAdmin: false, role: 'Fisiatra' },
      { username: 'lic.lopez', pass: 'tsocial123', isAdmin: false, role: 'Trabajo Social' },
      { username: 'lic.martinez', pass: 'tsocial123', isAdmin: false, role: 'Trabajo Social' },
      { username: 'kine.alvarez', pass: 'profesional123', isAdmin: false, role: 'profesional' },
      { username: 'psico.gomez', pass: 'profesional123', isAdmin: false, role: 'profesional' },
      { username: 'fono.perez', pass: 'profesional123', isAdmin: false, role: 'profesional' },
      { username: 'psicoped.romero', pass: 'profesional123', isAdmin: false, role: 'profesional' },
      { username: 'to.silva', pass: 'profesional123', isAdmin: false, role: 'profesional' },
      { username: 'psicomot.torres', pass: 'profesional123', isAdmin: false, role: 'profesional' },
      { username: 'integrador.diaz', pass: 'profesional123', isAdmin: false, role: 'profesional' },
      { username: 'recepcion.sofia', pass: 'recepcion123', isAdmin: false, role: 'Recepcion' },
      { username: 'coord.martin', pass: 'coord123', isAdmin: false, role: 'Coordinacion' }
    ];

    const createdUsers = [];
    for (const u of usuariosDefault) {
      const pHash = hashPassword(u.pass);
      const res = await client.query(
        'INSERT INTO users (username, password_hash, is_admin) VALUES ($1, $2, $3) RETURNING id, username',
        [u.username, pHash, u.isAdmin]
      );
      const userId = res.rows[0].id;
      createdUsers.push(res.rows[0]);
      if (roleMap[u.role]) {
        await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [userId, roleMap[u.role]]);
      }
    }
    console.log(`✅ ${createdUsers.length} empleados creados con sus roles asignados.`);

    // 6. Generación masiva de Pacientes (300 Pacientes)
    console.log('👶 Generando 300 pacientes completos con todo su historial...');
    const rng = createRandom(999);
    const TOTAL_PATIENTS = 300;

    const diasSemana = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'];

    for (let i = 1; i <= TOTAL_PATIENTS; i++) {
      const isMale = rng.int(0, 1) === 0;
      const firstName = isMale ? rng.pick(NOMBRES_VARONES) : rng.pick(NOMBRES_MUJERES);
      const lastName = rng.pick(APELLIDOS) + ' ' + rng.pick(APELLIDOS);
      const patientId = rng.uuid();

      const birthDate = rng.dateBetween(2005, 2022);
      const condition = rng.pick(CONDICIONES);
      const diagnosis = rng.pick(DIAGNOSTICOS);

      const dni = rng.dni();
      const cuit = rng.cuit(dni);
      const affiliateNumber = 'AFF-' + rng.int(100000, 999999);

      const fatherName = rng.pick(NOMBRES_VARONES) + ' ' + lastName.split(' ')[0];
      const motherName = rng.pick(NOMBRES_MUJERES) + ' ' + lastName.split(' ')[1];

      const osChoice = rng.pick(osRows);

      // Estado activo/inactivo/alta
      const isDischarged = i % 10 === 0; // 10% de altas
      const isActive = !isDischarged && i % 7 !== 0; // ~85% activos
      const stateChoice = isDischarged ? stateRows.find(s => s.name === 'Dado de Alta') :
                          !isActive ? stateRows.find(s => s.name === 'Suspendido') :
                          rng.pick(stateRows.filter(s => s.name !== 'Dado de Alta'));

      // Fechas de validez (algunos vigentes, algunos por vencer, algunos vencidos)
      let authExpires;
      if (i % 8 === 0) {
        authExpires = rng.recentDate(60); // Vencido
      } else if (i % 5 === 0) {
        authExpires = rng.futureDate(20); // Por vencer pronto (< 30 días)
      } else {
        authExpires = rng.futureDate(180); // Vigente holgado
      }

      const lastVisit = rng.recentDate(45);
      const lastFisiatrico = rng.recentDate(90);
      const lastFisiatricoAlta = rng.recentDate(120);
      const lastFisiatricoVencimiento = authExpires;

      const lastTS = rng.recentDate(90);
      const lastTSAlta = rng.recentDate(120);
      const lastTSVencimiento = authExpires;

      const dischargedAt = isDischarged ? rng.recentDate(30) + 'T10:00:00Z' : null;

      await client.query(`
        INSERT INTO patients (
          patient_id, first_name, last_name, birth_date, condition,
          last_visit, last_fisiatrico, last_fisiatrico_alta, last_fisiatrico_vencimiento,
          last_trabajo_social, last_trabajo_social_alta, last_trabajo_social_vencimiento,
          dni, cuit, os_id, affiliate_number, integracion_horario, diagnosis,
          father_tutor_name, father_tutor_phone, mother_tutor_name, mother_tutor_phone,
          address_street, address_number, address_neighborhood, address_floor, address_sector,
          school_name, school_grade, school_shift, car_years, ppi_years, acta_acuerdo_years,
          notes, authorization_expires_at, authorized_at, is_active, is_discharged, patient_state_id, discharged_at, parametro
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12,
          $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22,
          $23, $24, $25, $26, $27,
          $28, $29, $30, $31, $32, $33,
          $34, $35, $36, $37, $38, $39, $40, $41
        )
      `, [
        patientId, firstName, lastName, birthDate, condition,
        lastVisit, lastFisiatrico, lastFisiatricoAlta, lastFisiatricoVencimiento,
        lastTS, lastTSAlta, lastTSVencimiento,
        dni, cuit, osChoice.id, affiliateNumber, rng.pick(['Mañana (08:00 - 12:00)', 'Tarde (13:00 - 17:00)', 'Jornada Completa']), diagnosis,
        fatherName, rng.phone(), motherName, rng.phone(),
        rng.pick(CALLES), String(rng.int(100, 9500)), rng.pick(BARRIOS), String(rng.int(1, 12)), rng.pick(['A', 'B', 'C', 'D']),
        rng.pick(ESCUELAS), `${rng.int(1, 7)}° Grado`, rng.pick(['Mañana', 'Tarde']),
        '2025, 2026', '2025, 2026', '2025, 2026',
        rng.pick(NOTAS_CLINICAS), authExpires, rng.recentDate(180), isActive, isDischarged, stateChoice ? stateChoice.id : null, dischargedAt, 0
      ]);

      // 6.1 Sede asignada
      const assignedSedes = rng.pickMultiple(sedeRows, rng.int(1, 2));
      for (const s of assignedSedes) {
        await client.query('INSERT INTO patients_sede (patient_id, sede_id) VALUES ($1, $2)', [patientId, s.id]);
      }

      // 6.2 Historial de Estados
      const histStates = [
        { state: stateRows.find(s => s.name === 'En Admision') || stateRows[0], reason: 'Ingreso inicial de la solicitud' },
        { state: stateRows.find(s => s.name === 'En Evaluacion') || stateRows[1], reason: 'Evaluación por equipo interdisciplinario' },
        { state: stateChoice || stateRows[0], reason: 'Actualización periódica de ficha clínica' }
      ];
      for (const h of histStates) {
        await client.query('INSERT INTO patient_state_history (patient_id, state_id, reason) VALUES ($1, $2, $3)', [patientId, h.state.id, h.reason]);
      }

      // 6.3 Autorizaciones
      const authStatus = rng.pick(['Aprobada', 'Aprobada', 'Aprobada', 'Pendiente', 'Rechazada']);
      await client.query(`
        INSERT INTO authorizations (patient_id, status, rejection_reason, authorization_date)
        VALUES ($1, $2, $3, $4)
      `, [patientId, authStatus, authStatus === 'Rechazada' ? 'Falta firma del médico auditor' : null, rng.recentDate(90)]);

      // 6.4 Módulo asignado y Facturas
      const modChoice = rng.pick(moduleRows);
      const modPatRes = await client.query('INSERT INTO module_patient (patient_id, module_id) VALUES ($1, $2) RETURNING id', [patientId, modChoice.id]);
      const modPatId = modPatRes.rows[0].id;

      // Generar 3 a 5 facturas
      for (let inv = 1; inv <= rng.int(3, 5); inv++) {
        const invType = rng.pick(invTypeRows);
        const invStat = rng.pick(invStatusRows);
        const amount = rng.int(45000, 280000);
        await client.query(`
          INSERT INTO invoice (patient_id, amount, invoice_type_id, payment_date, module_id, invoice_status_id)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [patientId, amount, invType.id, rng.recentDate(120), modPatId, invStat.id]);
      }

      // 6.5 Tratamientos asignados (1 a 4 tratamientos por paciente)
      const selectedTreatments = rng.pickMultiple(treatmentRows, rng.int(1, 4));
      for (const t of selectedTreatments) {
        await client.query('INSERT INTO patient_treatments (patient_id, treatment_id) VALUES ($1, $2)', [patientId, t.id]);

        // 6.6 Turnos semanales y mensuales
        const turnsCount = rng.int(1, 2);
        const selectedDays = rng.pickMultiple(diasSemana, turnsCount);
        for (const day of selectedDays) {
          const hour = rng.int(8, 17);
          const timeStr = `${String(hour).padStart(2, '0')}:00`;
          await client.query(`
            INSERT INTO patient_turns (patient_id, treatment_id, day_of_week, time)
            VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING
          `, [patientId, t.id, day, timeStr]);

          // Turnos mensuales para meses 1 a 12 de 2026
          for (let m = 1; m <= 12; m++) {
            await client.query(`
              INSERT INTO patient_turns_monthly (patient_id, treatment_id, month, day_of_week, time)
              VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING
            `, [patientId, t.id, m, day, timeStr]);
          }
        }
      }

      // 6.7 Asistencias (10 a 20 asistencias pasadas por paciente)
      const attCount = rng.int(10, 20);
      for (let att = 0; att < attCount; att++) {
        const attDate = rng.recentDate(75);
        const randomT = rng.pick(selectedTreatments);
        const attNote = rng.pick([
          'Presente. Concurre puntualmente y trabaja con buena predisposición.',
          'Presente. Se observa fatiga ligera hacia el final de la sesión.',
          'Ausente con aviso previa comunicación de la madre por turno médico.',
          'Ausente sin aviso. Se envía recordatorio a la familia.',
          'Presente. Avances destacados en la dinámica de la actividad.',
          'Cancelado por feriado o jornada institucional.'
        ]);
        await client.query(`
          INSERT INTO attendances (patient_id, date, treatment_id, note)
          VALUES ($1, $2, $3, $4)
        `, [patientId, attDate, randomT.id, attNote]);
      }

      // 6.8 Informes Clínicos del Paciente
      const numReports = rng.int(2, 4);
      for (let rep = 0; rep < numReports; rep++) {
        const rType = rng.pick(reportTypeRows);
        const rDate = rng.recentDate(120);
        const rContent = `## ${rType.name} - Paciente: ${firstName} ${lastName}\n\n` +
          `**Fecha de Informe:** ${rDate}\n` +
          `**Diagnóstico de base:** ${diagnosis}\n\n` +
          `### Resumen de Evolución Clinica\n` +
          `El paciente ${firstName} ha asistido de manera regular a las sesiones programadas. ` +
          `En relación a las pautas de trabajo fijadas al inicio del ciclo, se observan avances progresivos ` +
          `en el desempeño motriz, la interacción comunicativa y la adaptación a normas estructuradas.\n\n` +
          `### Objetivos Terapéuticos Alcanzados:\n` +
          `- Fortalecimiento del vínculo terapéutico y confianza en el espacio de trabajo.\n` +
          `- Incremento del tiempo de atención sostenida en tareas de coordinación.\n` +
          `- Integración satisfactoria con el grupo de pares e integradores escolares.\n\n` +
          `### Recomendaciones para el Próximo Período:\n` +
          `Se sugiere sostener la frecuencia de sesiones actual y mantener la articulación constante con la institución escolar.`;

        await client.query(`
          INSERT INTO pacient_reports (patient_id, report_type_id, report_date, report_type, content)
          VALUES ($1, $2, $3, $4, $5)
        `, [patientId, rType.id, rDate, rType.name, rContent]);
      }

      // 6.9 Solicitudes y prórrogas
      const reqRes = await client.query(`
        INSERT INTO patient_requests (patient_id, start_date, end_date, apply_treatments, applied_at)
        VALUES ($1, $2, $3, $4, $5) RETURNING patient_req_id
      `, [patientId, '2026-03-01', '2026-12-31', true, rng.recentDate(30) + 'T12:00:00Z']);
      
      const reqId = reqRes.rows[0].patient_req_id;
      for (const t of selectedTreatments) {
        await client.query(`
          INSERT INTO patient_request_treatments (request_id, treatment_id)
          VALUES ($1, $2) ON CONFLICT DO NOTHING
        `, [reqId, t.id]);
      }

      if (i % 50 === 0 || i === TOTAL_PATIENTS) {
        console.log(`   └─ Generados ${i} / ${TOTAL_PATIENTS} pacientes con sus tablas derivadas...`);
      }
    }

    // 7. Admisiones en Proceso (40 Admisiones)
    console.log('📑 Generando 40 fichas de admisión en distintas etapas del pipeline...');
    const estadosAdmision = ['pendiente_turno', 'en_revision', 'aprobado', 'desestimado'];
    
    for (let adm = 1; adm <= 40; adm++) {
      const isM = rng.int(0, 1) === 0;
      const fn = isM ? rng.pick(NOMBRES_VARONES) : rng.pick(NOMBRES_MUJERES);
      const ln = rng.pick(APELLIDOS) + ' ' + rng.pick(APELLIDOS);
      const est = estadosAdmision[adm % 4];
      const dniAdm = rng.dni();

      const admRes = await client.query(`
        INSERT INTO admissions (first_name, last_name, birth_date, dni, phone, address, tiene_obra_social, obra_social_nombre, tiene_cud, estado)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id
      `, [
        fn, ln, rng.dateBetween(2008, 2022), dniAdm, rng.phone(),
        rng.pick(CALLES) + ' ' + rng.int(100, 3000), adm % 2 === 0, rng.pick(obrasSociales), adm % 3 !== 0, est
      ]);

      const admId = admRes.rows[0].id;

      if (est !== 'pendiente_turno') {
        const resultFisiatra = est === 'desestimado' ? 'desestimado' : 'aprobado';
        const reviewer = rng.pick(['dra.gonzalez', 'dr.rodriguez']);
        const feedback = resultFisiatra === 'aprobado'
          ? 'Evaluación fisiátrica favorable. Paciente apto para esquema de rehabilitación multidisciplinaria.'
          : 'Se sugiere interconsulta con centro de alta complejidad por requerimiento técnico específico.';

        await client.query(`
          INSERT INTO admission_fisiatric_review (admission_id, fecha_turno, resultado, devolucion, reviewed_by)
          VALUES ($1, $2, $3, $4, $5)
        `, [admId, rng.recentDate(20), resultFisiatra, feedback, reviewer]);
      }

      await client.query(`
        INSERT INTO admission_documents (admission_id, dni_numero, numero_afiliado)
        VALUES ($1, $2, $3)
      `, [admId, dniAdm, 'AFIL-' + rng.int(10000, 99999)]);
    }

    // 8. Logs de Actividad de Usuarios (Auditoría)
    console.log('📜 Generando logs de actividad para auditoría...');
    const acciones = [
      { action: 'LOGIN', entity: 'AUTH', label: 'Inicio de sesión exitoso' },
      { action: 'CREATE_PATIENT', entity: 'PATIENT', label: 'Nuevo paciente registrado' },
      { action: 'UPDATE_PATIENT', entity: 'PATIENT', label: 'Modificación de ficha clínica' },
      { action: 'REGISTER_ATTENDANCE', entity: 'ATTENDANCE', label: 'Registro de asistencia diaria' },
      { action: 'UPLOAD_REPORT', entity: 'REPORT', label: 'Carga de informe de evolución' },
      { action: 'APPROVE_ADMISSION', entity: 'ADMISSION', label: 'Aprobación de admisión de paciente' }
    ];

    for (let logIdx = 1; logIdx <= 150; logIdx++) {
      const u = rng.pick(createdUsers);
      const a = rng.pick(acciones);
      await client.query(`
        INSERT INTO user_activity_logs (actor_user_id, actor_username, action_type, entity_type, entity_id, entity_label, details)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        u.id, u.username, a.action, a.entity, String(rng.int(1, 300)), a.label,
        `Acción realizada por el usuario ${u.username} desde el panel de gestión.`
      ]);
    }

    console.log('\n🎉 ¡PROCESO DE POBLAMIENTO COMPLETADO EXITOSAMENTE!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(` • Empleados/Usuarios:  ${createdUsers.length} creados`);
    console.log(` • Pacientes Totales:   ${TOTAL_PATIENTS} con turnos, asistencias y reportes`);
    console.log(` • Admisiones Pipeline: 40 registros`);
    console.log(` • Registros Auditoría: 150 logs`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔑 Credenciales de acceso de prueba:');
    console.log('   - Admin:                username: admin         password: admin1234');
    console.log('   - Fisiatra:             username: dra.gonzalez  password: fisiatra123');
    console.log('   - Trabajo Social:       username: lic.lopez     password: tsocial123');
    console.log('   - Profesional Kine:     username: kine.alvarez  password: profesional123');
    console.log('   - Recepción:            username: recepcion.sofia password: recepcion123');
    console.log('═══════════════════════════════════════════════════════════════\n');

    client.release();
    await pool.end();
  } catch (err) {
    console.error('❌ Error al poblar la base de datos PostgreSQL:', err);
    await pool.end();
    process.exit(1);
  }
}

seed();
