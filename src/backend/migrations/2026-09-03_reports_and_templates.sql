CREATE TABLE IF NOT EXISTS REPORT_TEMPLATES (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    insurer_id BIGINT REFERENCES OS(id) ON DELETE SET NULL,
    treatment_name TEXT,
    report_type TEXT NOT NULL CHECK (report_type IN ('initial', 'evolution', 'treatment_plan')),
    form_code TEXT NOT NULL,
    year_version INTEGER NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    filename TEXT,
    mime_type TEXT NOT NULL DEFAULT 'application/pdf',
    file_data BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(insurer_id, treatment_name, report_type, year_version, form_code)
);

CREATE TABLE IF NOT EXISTS CLINICAL_REPORTS (
    id BIGSERIAL PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES PATIENTS(patient_id) ON DELETE CASCADE,
    treatment_id BIGINT REFERENCES TREATMENTS(id) ON DELETE SET NULL,
    treatment_name TEXT NOT NULL,
    report_type TEXT NOT NULL CHECK (report_type IN ('initial', 'evolution', 'treatment_plan')),
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    period_year INTEGER NOT NULL,
    period_month INTEGER,
    template_id BIGINT NOT NULL REFERENCES REPORT_TEMPLATES(id) ON DELETE RESTRICT,
    form_code TEXT NOT NULL,
    clinical_content JSONB NOT NULL DEFAULT '{}'::jsonb,
    administrative_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    generated_pdf BYTEA,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated')),
    created_by BIGINT REFERENCES USERS(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clinical_reports_patient ON CLINICAL_REPORTS(patient_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_report_templates_lookup ON REPORT_TEMPLATES(insurer_id, treatment_name, report_type, year_version);
