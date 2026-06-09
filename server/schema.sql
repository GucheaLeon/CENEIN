CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  age TEXT,
  birth_date DATE,
  condition TEXT,
  last_visit DATE,
  last_fisiatrico DATE,
  last_fisiatrico_alta DATE,
  last_fisiatrico_vencimiento DATE,
  last_trabajo_social DATE,
  last_trabajo_social_alta DATE,
  last_trabajo_social_vencimiento DATE,
  dni TEXT,
  cuit TEXT,
  affiliate_number TEXT,
  integracion_horario TEXT,
  diagnosis TEXT,
  father_tutor_name TEXT,
  father_tutor_phone TEXT,
  mother_tutor_name TEXT,
  mother_tutor_phone TEXT,
  address_street TEXT,
  address_number TEXT,
  address_neighborhood TEXT,
  address_floor TEXT,
  address_sector TEXT,
  school_name TEXT,
  school_grade TEXT,
  school_shift TEXT,
  car_years TEXT,
  ppi_years TEXT,
  acta_acuerdo_years TEXT,
  notes TEXT,
  authorized_at DATE,
  authorization_expires_at DATE,
  is_active INTEGER DEFAULT 1,
  is_discharged INTEGER DEFAULT 0,
  discharged_at DATETIME,
  parametro INTEGER DEFAULT 0,
  module_type TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS treatments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS patient_treatments (
  patient_id TEXT NOT NULL,
  treatment_id INTEGER NOT NULL,
  PRIMARY KEY (patient_id, treatment_id),
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (treatment_id) REFERENCES treatments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS patient_turns (
  patient_id TEXT NOT NULL,
  treatment_id INTEGER NOT NULL,
  day_of_week TEXT NOT NULL,
  time TEXT NOT NULL,
  PRIMARY KEY (patient_id, treatment_id, day_of_week, time),
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (treatment_id) REFERENCES treatments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS patient_turns_monthly (
  patient_id TEXT NOT NULL,
  treatment_id INTEGER NOT NULL,
  month INTEGER NOT NULL,
  day_of_week TEXT NOT NULL,
  time TEXT NOT NULL,
  PRIMARY KEY (patient_id, treatment_id, month, day_of_week, time),
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (treatment_id) REFERENCES treatments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS patient_turns_overrides (
  patient_id TEXT NOT NULL,
  treatment_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (patient_id, treatment_id, date, time),
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (treatment_id) REFERENCES treatments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attendances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id TEXT NOT NULL,
  date DATE NOT NULL,
  treatment_id INTEGER,
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (treatment_id) REFERENCES treatments(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS patient_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  apply_treatments INTEGER NOT NULL DEFAULT 0,
  applied_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_patient_requests_patient
  ON patient_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_requests_dates
  ON patient_requests(start_date, end_date);

CREATE TABLE IF NOT EXISTS patient_request_treatments (
  request_id INTEGER NOT NULL,
  treatment_id INTEGER NOT NULL,
  PRIMARY KEY (request_id, treatment_id),
  FOREIGN KEY (request_id) REFERENCES patient_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (treatment_id) REFERENCES treatments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS login_rate_limits (
  scope_key TEXT PRIMARY KEY,
  failed_count INTEGER NOT NULL DEFAULT 0,
  blocked_until DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER,
  actor_username TEXT NOT NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  entity_label TEXT,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
