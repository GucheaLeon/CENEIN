-- ============================================================
-- CENEIN - Schema Base de Datos PostgreSQL
-- ============================================================

-- ─── 1. Catálogos e Información Estática ───────────────────────
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

CREATE TABLE IF NOT EXISTS INVOICE_STATUS (
    id BIGSERIAL PRIMARY KEY,
    description TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS INVOICE_TYPE (
    id BIGSERIAL PRIMARY KEY,
    description TEXT UNIQUE
);

-- Catálogo de módulos clínicos (MII, MIS, MIE, etc.)
CREATE TABLE IF NOT EXISTS MODULE (
    id BIGSERIAL PRIMARY KEY,
    description TEXT UNIQUE,
    price DECIMAL(10,2) DEFAULT 0
);

-- ─── 2. Usuarios, Autenticación y Auditoría ────────────────────
CREATE TABLE IF NOT EXISTS USERS (
    id BIGSERIAL PRIMARY KEY,
    username TEXT UNIQUE,
    password_hash TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
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

-- ─── 3. Entidad Principal: Pacientes ───────────────────────────
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
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tablas dependientes de Pacientes (Direcciones, Contactos, Escuela, Documentos anuales)
CREATE TABLE IF NOT EXISTS PATIENT_ADDRESSES (
    id BIGSERIAL PRIMARY KEY,
    patient_id TEXT REFERENCES PATIENTS(patient_id) ON DELETE CASCADE,
    street TEXT,
    number TEXT,
    neighborhood TEXT,
    floor TEXT,
    sector TEXT
);

CREATE TABLE IF NOT EXISTS PATIENT_CONTACTS (
    id BIGSERIAL PRIMARY KEY,
    patient_id TEXT REFERENCES PATIENTS(patient_id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    phone TEXT,
    is_primary BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS PATIENT_EDUCATION (
    id BIGSERIAL PRIMARY KEY,
    patient_id TEXT REFERENCES PATIENTS(patient_id) ON DELETE CASCADE,
    school_name TEXT,
    grade TEXT,
    shift TEXT,
    integration_schedule TEXT
);

CREATE TABLE IF NOT EXISTS PATIENT_ANNUAL_DOCS (
    id BIGSERIAL PRIMARY KEY,
    patient_id TEXT REFERENCES PATIENTS(patient_id) ON DELETE CASCADE,
    doc_type TEXT,
    year INTEGER,
    status TEXT
);

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
    apply_treatments BOOLEAN DEFAULT FALSE,
    applied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS PATIENT_REQUEST_TREATMENTS (
    patient_req_treatments BIGSERIAL PRIMARY KEY,
    request_id BIGINT REFERENCES PATIENT_REQUESTS(patient_req_id) ON DELETE CASCADE,
    treatment_id BIGINT REFERENCES TREATMENTS(id) ON DELETE CASCADE
);

-- Tabla intermedia: asignación de módulos a pacientes (M:N)
CREATE TABLE IF NOT EXISTS MODULE_PATIENT (
    id BIGSERIAL PRIMARY KEY,
    patient_id TEXT REFERENCES PATIENTS(patient_id) ON DELETE CASCADE,
    module_id BIGINT REFERENCES MODULE(id) ON DELETE SET NULL,
    UNIQUE(patient_id, module_id)
);

-- ─── 4. Módulo de Admisión de Pacientes ─────────────────────────

-- Etapa 1: Datos básicos + checkboxes (Obra Social / CUD)
CREATE TABLE IF NOT EXISTS ADMISSIONS (
    id BIGSERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    birth_date DATE,
    dni TEXT,
    phone TEXT,
    address TEXT,
    tiene_obra_social BOOLEAN DEFAULT FALSE,
    obra_social_nombre TEXT,
    tiene_cud BOOLEAN DEFAULT FALSE,
    estado TEXT DEFAULT 'pendiente_turno',
    patient_id TEXT REFERENCES PATIENTS(patient_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Etapa 2: Revisión / devolución de la fisiatra
CREATE TABLE IF NOT EXISTS ADMISSION_FISIATRIC_REVIEW (
    id BIGSERIAL PRIMARY KEY,
    admission_id BIGINT NOT NULL REFERENCES ADMISSIONS(id) ON DELETE CASCADE,
    fecha_turno DATE,
    resultado TEXT,
    devolucion TEXT,
    reviewed_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Etapa 3: Armado de expediente (documentos PDF BYTEA y campos de texto)
CREATE TABLE IF NOT EXISTS ADMISSION_DOCUMENTS (
    id BIGSERIAL PRIMARY KEY,
    admission_id BIGINT NOT NULL REFERENCES ADMISSIONS(id) ON DELETE CASCADE,
    dni_numero TEXT,
    numero_afiliado TEXT,
    carnet_pdf BYTEA,
    carnet_data BYTEA,
    carnet_filename TEXT,
    carnet_mimetype TEXT,
    cud_pdf BYTEA,
    cud_data BYTEA,
    cud_filename TEXT,
    cud_mimetype TEXT,
    consentimiento_padres_pdf BYTEA,
    consentimiento_data BYTEA,
    consentimiento_filename TEXT,
    consentimiento_mimetype TEXT,
    presupuesto_pdf BYTEA,
    presupuesto_data BYTEA,
    presupuesto_filename TEXT,
    presupuesto_mimetype TEXT,
    informe_inicial_pdf BYTEA,
    informe_data BYTEA,
    informe_filename TEXT,
    informe_mimetype TEXT,
    plan_trabajo_pdf BYTEA,
    plan_data BYTEA,
    plan_filename TEXT,
    plan_mimetype TEXT,
    resumen_historial_pdf BYTEA,
    historial_data BYTEA,
    historial_filename TEXT,
    historial_mimetype TEXT,
    pedidos_medicos_pdf BYTEA,
    pedidos_data BYTEA,
    pedidos_filename TEXT,
    pedidos_mimetype TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── 5. Módulo de Facturación Electrónica (ARCA / AFIP) ─────────
CREATE TABLE IF NOT EXISTS INVOICE (
    id BIGSERIAL PRIMARY KEY,
    patient_id TEXT REFERENCES PATIENTS(patient_id) ON DELETE CASCADE,
    receptor_nombre TEXT,
    doc_tipo INTEGER DEFAULT 99,
    doc_nro TEXT,
    obra_social TEXT,
    module_patient_id BIGINT REFERENCES MODULE_PATIENT(id) ON DELETE SET NULL,
    module_direct_id BIGINT REFERENCES MODULE(id) ON DELETE SET NULL,
    amount DECIMAL(10,2),
    mon_id TEXT DEFAULT 'PES',
    concepto INTEGER DEFAULT 2,
    invoice_type_id BIGINT REFERENCES INVOICE_TYPE(id) ON DELETE SET NULL,
    invoice_status_id BIGINT REFERENCES INVOICE_STATUS(id) ON DELETE SET NULL,
    payment_date DATE,
    cae TEXT,
    cae_vto TEXT,
    cbte_nro INTEGER,
    cbte_tipo INTEGER DEFAULT 6,
    pto_vta INTEGER DEFAULT 1,
    fecha_emision DATE,
    pdf_filename TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tratamientos incluidos en cada factura (M:N)
CREATE TABLE IF NOT EXISTS INVOICE_TREATMENTS (
    invoice_id   BIGINT NOT NULL REFERENCES INVOICE(id) ON DELETE CASCADE,
    treatment_id BIGINT NOT NULL REFERENCES TREATMENTS(id) ON DELETE CASCADE,
    PRIMARY KEY (invoice_id, treatment_id)
);

-- ─── 6. Índices para Optimización de Consultas ─────────────────
CREATE INDEX IF NOT EXISTS idx_patients_dni            ON PATIENTS(dni);
CREATE INDEX IF NOT EXISTS idx_patients_os             ON PATIENTS(os_id);
CREATE INDEX IF NOT EXISTS idx_patients_state          ON PATIENTS(patient_state_id);
CREATE INDEX IF NOT EXISTS idx_patient_requests_p      ON PATIENT_REQUESTS(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_requests_dates  ON PATIENT_REQUESTS(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_module_patient_p        ON MODULE_PATIENT(patient_id);
CREATE INDEX IF NOT EXISTS idx_module_patient_m        ON MODULE_PATIENT(module_id);
CREATE INDEX IF NOT EXISTS idx_invoice_patient         ON INVOICE(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoice_cae             ON INVOICE(cae);
CREATE INDEX IF NOT EXISTS idx_invoice_fecha           ON INVOICE(fecha_emision);
CREATE INDEX IF NOT EXISTS idx_invoice_module          ON INVOICE(module_direct_id);
CREATE INDEX IF NOT EXISTS idx_invoice_module_pat      ON INVOICE(module_patient_id);
CREATE INDEX IF NOT EXISTS idx_invoice_status          ON INVOICE(invoice_status_id);
CREATE INDEX IF NOT EXISTS idx_inv_treatments_inv      ON INVOICE_TREATMENTS(invoice_id);
