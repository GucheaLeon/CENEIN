-- ============================================================
-- 2026-08-19: Refactor módulos + INVOICE con datos ARCA
-- ============================================================

-- 1. Ampliar INVOICE con todos los campos de ARCA y descriptivos
ALTER TABLE INVOICE
  ADD COLUMN IF NOT EXISTS cae TEXT,
  ADD COLUMN IF NOT EXISTS cae_vto TEXT,
  ADD COLUMN IF NOT EXISTS cbte_nro INTEGER,
  ADD COLUMN IF NOT EXISTS cbte_tipo INTEGER DEFAULT 6,
  ADD COLUMN IF NOT EXISTS pto_vta INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fecha_emision DATE,
  ADD COLUMN IF NOT EXISTS pdf_filename TEXT,
  ADD COLUMN IF NOT EXISTS receptor_nombre TEXT,
  ADD COLUMN IF NOT EXISTS doc_tipo INTEGER DEFAULT 99,
  ADD COLUMN IF NOT EXISTS doc_nro TEXT,
  ADD COLUMN IF NOT EXISTS obra_social TEXT,
  ADD COLUMN IF NOT EXISTS concepto INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS mon_id TEXT DEFAULT 'PES';

-- 2. Agregar module_patient_id: referencia a la asignación exacta paciente-módulo
ALTER TABLE INVOICE
  ADD COLUMN IF NOT EXISTS module_patient_id BIGINT REFERENCES MODULE_PATIENT(id) ON DELETE SET NULL;

-- Migrar datos existentes: copiar module_id → module_patient_id
UPDATE INVOICE
SET module_patient_id = module_id
WHERE module_id IS NOT NULL
  AND module_patient_id IS NULL;

-- 3. Agregar module_direct_id: referencia directa a MODULE para filtros simples
ALTER TABLE INVOICE
  ADD COLUMN IF NOT EXISTS module_direct_id BIGINT REFERENCES MODULE(id) ON DELETE SET NULL;

-- Poblar module_direct_id desde la asignación paciente-módulo
UPDATE INVOICE i
SET module_direct_id = mp.module_id
FROM MODULE_PATIENT mp
WHERE mp.id = i.module_patient_id
  AND i.module_direct_id IS NULL;

-- 4. Tabla M:N tratamientos por factura
CREATE TABLE IF NOT EXISTS INVOICE_TREATMENTS (
    invoice_id  BIGINT NOT NULL REFERENCES INVOICE(id) ON DELETE CASCADE,
    treatment_id BIGINT NOT NULL REFERENCES TREATMENTS(id) ON DELETE CASCADE,
    PRIMARY KEY (invoice_id, treatment_id)
);

-- 5. Poblar estados de factura si la tabla está vacía
INSERT INTO INVOICE_STATUS (description)
SELECT unnest(ARRAY['Emitida', 'Pagada', 'Anulada', 'Pendiente de pago'])
WHERE NOT EXISTS (SELECT 1 FROM INVOICE_STATUS LIMIT 1);

-- 6. Poblar tipos de factura si la tabla está vacía
INSERT INTO INVOICE_TYPE (description)
SELECT unnest(ARRAY['Factura B', 'Factura A', 'Factura C'])
WHERE NOT EXISTS (SELECT 1 FROM INVOICE_TYPE LIMIT 1);

-- 7. Índices para filtros rápidos
CREATE INDEX IF NOT EXISTS idx_invoice_patient    ON INVOICE(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoice_cae        ON INVOICE(cae);
CREATE INDEX IF NOT EXISTS idx_invoice_fecha      ON INVOICE(fecha_emision);
CREATE INDEX IF NOT EXISTS idx_invoice_module     ON INVOICE(module_direct_id);
CREATE INDEX IF NOT EXISTS idx_invoice_status     ON INVOICE(invoice_status_id);
CREATE INDEX IF NOT EXISTS idx_invoice_module_pat ON INVOICE(module_patient_id);
CREATE INDEX IF NOT EXISTS idx_module_patient_p   ON MODULE_PATIENT(patient_id);
CREATE INDEX IF NOT EXISTS idx_module_patient_m   ON MODULE_PATIENT(module_id);
CREATE INDEX IF NOT EXISTS idx_inv_treatments_inv ON INVOICE_TREATMENTS(invoice_id);
