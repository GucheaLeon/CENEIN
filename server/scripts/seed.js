const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const { faker } = require('@faker-js/faker');

const SCHEMA_SQL_PATH = path.join(__dirname, '..', 'schema.sql');
const LOCAL_DATA_DIR = path.join(__dirname, '..', 'data');
const LOCAL_DB_PATH = path.join(LOCAL_DATA_DIR, 'local.sqlite');

function normalizeSqlForLocal(sql) {
  return String(sql || '')
    .replace(/\bnow\(\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/\bTRUE\b/g, '1')
    .replace(/\bFALSE\b/g, '0');
}

const TRATAMIENTOS_BASE = [
  'Fonoaudiologia',
  'Psicologia',
  'Psicopedagogia',
  'Psicomotricidad',
  'Kinesiologia',
  'TO Terapia Ocupacional',
  'Integracion',
];

async function seed() {
  console.log('Iniciando script para poblar la base de datos (Seed)...');
  
  if (!fs.existsSync(LOCAL_DATA_DIR)) {
    fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
  }

  // Si ya existe la DB, la eliminamos para generar una nueva y limpia
  if (fs.existsSync(LOCAL_DB_PATH)) {
    console.log(`Eliminando base de datos existente en ${LOCAL_DB_PATH}...`);
    fs.unlinkSync(LOCAL_DB_PATH);
  }

  const SQL = await initSqlJs();
  const database = new SQL.Database();
  
  // Ejecutar esquema
  const schema = fs.readFileSync(SCHEMA_SQL_PATH, 'utf8');
  database.exec(normalizeSqlForLocal('PRAGMA foreign_keys = ON;'));
  
  // El schema puede tener múltiples sentencias. sql.js exec ejecuta múltiples, pero a veces falla con ciertas sintaxis
  // Lo partimos en sentencias individuales por si acaso (separadas por ;)
  const statements = schema.split(';').filter(s => s.trim().length > 0);
  for (const stmt of statements) {
    try {
      database.exec(normalizeSqlForLocal(stmt));
    } catch (e) {
      console.warn('Advertencia al ejecutar sentencia SQL:', e.message, stmt);
    }
  }
  
  // Insertar tratamientos base
  for (const nombre of TRATAMIENTOS_BASE) {
    database.run('INSERT INTO treatments (name) VALUES (?)', [nombre]);
  }

  // Insertar usuarios (admin/admin1234)
  const crypto = require('crypto');
  function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const iterations = 310000;
    const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
    return `pbkdf2$${iterations}$${salt.toString('base64')}$${hash.toString('base64')}`;
  }
  
  database.run('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)', ['admin', hashPassword('admin1234'), 1]);
  console.log('Usuario creado: admin / admin1234');

  // Generar pacientes
  console.log('Generando datos de 50 pacientes...');
  faker.seed(123); // Para que siempre genere los mismos datos
  const modules = ['MII', 'MIS', 'MIE'];
  const dias = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'];
  
  for (let i = 0; i < 50; i++) {
    const id = faker.string.uuid();
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const fullName = `${firstName} ${lastName}`;
    const age = faker.number.int({ min: 3, max: 18 });
    const birthDate = faker.date.birthdate({ min: 3, max: 18, mode: 'age' }).toISOString().split('T')[0];
    
    // Fechas lógicas
    const pastDate = faker.date.recent({ days: 100 }).toISOString().split('T')[0];
    const futureDate = faker.date.future({ years: 1 }).toISOString().split('T')[0];
    
    // Insertar paciente con todos sus campos
    database.run(`
      INSERT INTO patients (
        id, full_name, first_name, last_name, age, birth_date, condition, 
        last_visit, last_fisiatrico, last_fisiatrico_alta, last_fisiatrico_vencimiento,
        last_trabajo_social, last_trabajo_social_alta, last_trabajo_social_vencimiento,
        dni, cuit, affiliate_number, integracion_horario, diagnosis,
        father_tutor_name, father_tutor_phone, mother_tutor_name, mother_tutor_phone,
        address_street, address_number, address_neighborhood, address_floor, address_sector,
        school_name, school_grade, school_shift, car_years, ppi_years, acta_acuerdo_years,
        notes, authorized_at, authorization_expires_at, is_active, is_discharged, discharged_at,
        parametro, module_type
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, 
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?
      )
    `, [
      id, fullName, firstName, lastName, age.toString(), birthDate, faker.helpers.arrayElement(['TEA', 'TGD', 'Sindrome de Down', 'Paralisis Cerebral', 'Retraso Madurativo', 'Ninguno']),
      pastDate, pastDate, pastDate, futureDate,
      pastDate, pastDate, futureDate,
      faker.string.numeric(8), faker.string.numeric(11), faker.string.alphanumeric(10), 'Mañana', faker.lorem.words(2),
      faker.person.fullName({ sex: 'male' }), faker.phone.number(), faker.person.fullName({ sex: 'female' }), faker.phone.number(),
      faker.location.street(), faker.location.buildingNumber(), faker.location.county(), faker.number.int({ min: 1, max: 10 }).toString(), 'A',
      'Escuela ' + faker.number.int({ min: 1, max: 100 }), faker.number.int({ min: 1, max: 6 }) + ' Grado', 'Mañana', '2025, 2026', '2025, 2026', '2025, 2026',
      faker.helpers.arrayElement(['IOMA', 'OSDE', 'Swiss Medical', 'Galeno', 'PAMI', 'Medife']), pastDate, futureDate, 1, 0, null,
      0, faker.helpers.arrayElement(modules)
    ]);

    // Tratamientos aleatorios (1 a 3)
    const numTreatments = faker.number.int({ min: 1, max: 3 });
    const selectedTreatments = new Set();
    while (selectedTreatments.size < numTreatments) {
      selectedTreatments.add(faker.number.int({ min: 1, max: 7 })); // IDs 1 to 7
    }
    
    for (const tId of selectedTreatments) {
      database.run('INSERT INTO patient_treatments (patient_id, treatment_id) VALUES (?, ?)', [id, tId]);
      
      // Turnos aleatorios (1 o 2 por semana)
      const numTurns = faker.number.int({ min: 1, max: 2 });
      const selectedDays = new Set();
      while (selectedDays.size < numTurns) {
        selectedDays.add(faker.helpers.arrayElement(dias));
      }
      
      for (const day of selectedDays) {
        const hour = faker.number.int({ min: 8, max: 18 });
        const time = `${hour.toString().padStart(2, '0')}:00`;
        database.run('INSERT INTO patient_turns (patient_id, treatment_id, day_of_week, time) VALUES (?, ?, ?, ?)', [id, tId, day, time]);
        
        // Agregar también turnos mensuales para meses actuales (ej. mayo, junio, julio) para que aparezcan en Gestión de Asistencias
        for (const month of [5, 6, 7]) {
          database.run('INSERT INTO patient_turns_monthly (patient_id, treatment_id, month, day_of_week, time) VALUES (?, ?, ?, ?, ?)', [id, tId, month, day, time]);
        }
      }
    }
    
    // Asistencias para los últimos 30 días
    const tIdArray = Array.from(selectedTreatments);
    for (let d = 0; d < 10; d++) {
      const pastDateAtt = faker.date.recent({ days: 30 }).toISOString().split('T')[0];
      const randomTid = faker.helpers.arrayElement(tIdArray);
      database.run('INSERT INTO attendances (patient_id, date, treatment_id, note) VALUES (?, ?, ?, ?)', [id, pastDateAtt, randomTid, faker.lorem.sentence()]);
    }
  }

  // Guardar archivo
  const data = database.export();
  fs.writeFileSync(LOCAL_DB_PATH, Buffer.from(data));
  console.log(`¡Base de datos poblada exitosamente en ${LOCAL_DB_PATH}!`);
  console.log('Se han generado 50 pacientes con tratamientos, turnos y asistencias.');
}

seed().catch(err => {
  console.error('Error al poblar la base de datos:', err);
  process.exit(1);
});
