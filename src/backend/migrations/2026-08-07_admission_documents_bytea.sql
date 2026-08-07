-- Migración: Agregar columnas BYTEA para almacenar archivos PDF directamente en la base de datos
-- Tabla: admission_documents
-- Fecha: 2026-08-07

-- Para cada campo PDF, se agregan 3 columnas:
--   _data     BYTEA  → contenido binario del archivo
--   _filename TEXT   → nombre original del archivo
--   _mimetype TEXT   → tipo MIME (ej: application/pdf)

ALTER TABLE admission_documents
  ADD COLUMN IF NOT EXISTS carnet_data       BYTEA,
  ADD COLUMN IF NOT EXISTS carnet_filename    TEXT,
  ADD COLUMN IF NOT EXISTS carnet_mimetype    TEXT;

ALTER TABLE admission_documents
  ADD COLUMN IF NOT EXISTS cud_data          BYTEA,
  ADD COLUMN IF NOT EXISTS cud_filename      TEXT,
  ADD COLUMN IF NOT EXISTS cud_mimetype      TEXT;

ALTER TABLE admission_documents
  ADD COLUMN IF NOT EXISTS consentimiento_data      BYTEA,
  ADD COLUMN IF NOT EXISTS consentimiento_filename   TEXT,
  ADD COLUMN IF NOT EXISTS consentimiento_mimetype   TEXT;

ALTER TABLE admission_documents
  ADD COLUMN IF NOT EXISTS presupuesto_data     BYTEA,
  ADD COLUMN IF NOT EXISTS presupuesto_filename  TEXT,
  ADD COLUMN IF NOT EXISTS presupuesto_mimetype  TEXT;

ALTER TABLE admission_documents
  ADD COLUMN IF NOT EXISTS informe_data      BYTEA,
  ADD COLUMN IF NOT EXISTS informe_filename   TEXT,
  ADD COLUMN IF NOT EXISTS informe_mimetype   TEXT;

ALTER TABLE admission_documents
  ADD COLUMN IF NOT EXISTS plan_data         BYTEA,
  ADD COLUMN IF NOT EXISTS plan_filename      TEXT,
  ADD COLUMN IF NOT EXISTS plan_mimetype      TEXT;

ALTER TABLE admission_documents
  ADD COLUMN IF NOT EXISTS historial_data    BYTEA,
  ADD COLUMN IF NOT EXISTS historial_filename TEXT,
  ADD COLUMN IF NOT EXISTS historial_mimetype TEXT;

ALTER TABLE admission_documents
  ADD COLUMN IF NOT EXISTS pedidos_data      BYTEA,
  ADD COLUMN IF NOT EXISTS pedidos_filename   TEXT,
  ADD COLUMN IF NOT EXISTS pedidos_mimetype   TEXT;
