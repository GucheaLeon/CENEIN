-- Catálogos e información estática
CREATE TABLE IF NOT EXISTS OS (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS SEDE (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS TREATMENTS (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS PATIENT_STATE (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS REPORT_TYPES (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS DOCUMENTS_TYPE (
    id BIGSERIAL PRIMARY KEY,
    description TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS ROLES (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE
);

-- Usuarios y Autenticación
CREATE TABLE IF NOT EXISTS USERS (
    id BIGSERIAL PRIMARY KEY,
    username TEXT UNIQUE,
    password_hash TEXT,
    is_admin BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS USER_ROLES (
    user_rol_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES USERS(id) ON DELETE CASCADE,
    role_id BIGINT REFERENCES ROLES(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS SESSIONS (
    token TEXT PRIMARY KEY,
    user_id BIGINT REFERENCES USERS(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS USER_ACTIVITY_LOGS (
    id BIGSERIAL PRIMARY KEY,
    actor_user_id BIGINT REFERENCES USERS(id) ON DELETE SET NULL,
    actor_username TEXT,
    action_type TEXT,
    entity_type TEXT,
    entity_id TEXT,
    entity_label TEXT,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS login_rate_limits (
  scope_key TEXT PRIMARY KEY,
  failed_count INTEGER NOT NULL DEFAULT 0,
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Entidad Principal: Pacientes
CREATE TABLE IF NOT EXISTS PATIENTS (
    patient_id TEXT PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
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
    os_id BIGINT REFERENCES OS(id) ON DELETE SET NULL,
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
    authorization_expires_at DATE,
    is_active BOOLEAN,
    is_discharged BOOLEAN,
    patient_state_id BIGINT REFERENCES PATIENT_STATE(id) ON DELETE SET NULL,
    discharged_at TIMESTAMPTZ,
    parametro INTEGER,
    module_type TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tablas dependientes de Pacientes
CREATE TABLE IF NOT EXISTS PATIENTS_SEDE (
    patient_sede_id BIGSERIAL PRIMARY KEY,
    patient_id TEXT REFERENCES PATIENTS(patient_id) ON DELETE CASCADE,
    sede_id BIGINT REFERENCES SEDE(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PATIENT_STATE_HISTORY (
    id BIGSERIAL PRIMARY KEY,
    patient_id TEXT REFERENCES PATIENTS(patient_id) ON DELETE CASCADE,
    state_id BIGINT REFERENCES PATIENT_STATE(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS AUTHORIZATIONS (
    id BIGSERIAL PRIMARY KEY,
    patient_id TEXT REFERENCES PATIENTS(patient_id) ON DELETE CASCADE,
    status TEXT,
    rejection_reason TEXT,
    authorization_date DATE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS TREATMENT_PLANS (
    id BIGSERIAL PRIMARY KEY,
    patient_id TEXT REFERENCES PATIENTS(patient_id) ON DELETE CASCADE,
    start_date DATE,
    end_date DATE,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS PATIENT_RECORDS (
    id BIGSERIAL PRIMARY KEY,
    patient_id TEXT REFERENCES PATIENTS(patient_id) ON DELETE CASCADE,
    treatment_plan_id BIGINT REFERENCES TREATMENT_PLANS(id) ON DELETE SET NULL,
    shipment_type TEXT,
    shipment_date DATE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS TREATMENT_PLAN_ITEMS (
    treatment_id BIGINT REFERENCES TREATMENTS(id) ON DELETE CASCADE,
    treatment_plan_id BIGINT REFERENCES TREATMENT_PLANS(id) ON DELETE CASCADE,
    PRIMARY KEY(treatment_id, treatment_plan_id)
);

CREATE TABLE IF NOT EXISTS PATIENT_DOCUMENTS (
    id BIGSERIAL PRIMARY KEY,
    patient_record_id BIGINT REFERENCES PATIENT_RECORDS(id) ON DELETE SET NULL,
    document_type BIGINT REFERENCES DOCUMENTS_TYPE(id) ON DELETE SET NULL,
    file_path TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS PACIENT_REPORTS (
    id BIGSERIAL PRIMARY KEY,
    patient_id TEXT REFERENCES PATIENTS(patient_id) ON DELETE CASCADE,
    report_type_id BIGINT REFERENCES REPORT_TYPES(id) ON DELETE SET NULL,
    report_date DATE,
    report_type TEXT,
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS PATIENT_TREATMENTS (
    patient_treatment_id BIGSERIAL PRIMARY KEY,
    patient_id TEXT REFERENCES PATIENTS(patient_id) ON DELETE CASCADE,
    treatment_id BIGINT REFERENCES TREATMENTS(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PATIENT_TURNS (
    patient_id TEXT REFERENCES PATIENTS(patient_id) ON DELETE CASCADE,
    treatment_id BIGINT REFERENCES TREATMENTS(id) ON DELETE CASCADE,
    day_of_week TEXT,
    time TIME,
    PRIMARY KEY(patient_id, treatment_id, day_of_week, time)
);

CREATE TABLE IF NOT EXISTS PATIENT_TURNS_MONTHLY (
    patient_id TEXT REFERENCES PATIENTS(patient_id) ON DELETE CASCADE,
    treatment_id BIGINT REFERENCES TREATMENTS(id) ON DELETE CASCADE,
    month INTEGER,
    day_of_week TEXT,
    time TIME,
    PRIMARY KEY(patient_id, treatment_id, month, day_of_week, time)
);

CREATE TABLE IF NOT EXISTS PATIENT_TURNS_OVERRIDES (
    patient_id TEXT REFERENCES PATIENTS(patient_id) ON DELETE CASCADE,
    treatment_id BIGINT REFERENCES TREATMENTS(id) ON DELETE CASCADE,
    date DATE,
    time TIME,
    active BOOLEAN,
    PRIMARY KEY(patient_id, treatment_id, date, time)
);

CREATE TABLE IF NOT EXISTS ATTENDANCES (
    id BIGSERIAL PRIMARY KEY,
    patient_id TEXT REFERENCES PATIENTS(patient_id) ON DELETE CASCADE,
    date DATE,
    treatment_id BIGINT REFERENCES TREATMENTS(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS PATIENT_REQUESTS (
    patient_req_id BIGSERIAL PRIMARY KEY,
    patient_id TEXT REFERENCES PATIENTS(patient_id) ON DELETE CASCADE,
    start_date DATE,
    end_date DATE,
    apply_treatments BOOLEAN,
    applied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS PATIENT_REQUEST_TREATMENTS (
    patient_req_treatments BIGSERIAL PRIMARY KEY,
    request_id BIGINT REFERENCES PATIENT_REQUESTS(patient_req_id) ON DELETE CASCADE,
    treatment_id BIGINT REFERENCES TREATMENTS(id) ON DELETE CASCADE
);
