# Obras sociales (PDF)

Los PDFs de cada obra social viven en `server/templates/obras-sociales/<OBRA_SOCIAL_ID>/template.pdf`.

Para que el sistema complete los datos automáticamente, se define un mapping en
`server/obras-sociales/mappings.json`.

## Datos disponibles para mapear

El motor arma este objeto:

- `patient`: datos del paciente (ej: `patient.nombre`, `patient.apellido`, `patient.dni`, `patient.cuit`, `patient.integracionHorario`, etc.)
- `patient.nroAfiliado`: número de afiliado
- `patient.nombreCompleto`: `"APELLIDO NOMBRE"` si existen nombre+apellido, si no usa `full_name`
- `center`: datos genéricos del centro (CENEIN) desde `server/obras-sociales/center.json`
- `planilla`: contexto para planillas de asistencia
  - `planilla.tratamiento`
  - `planilla.mesNombre`
  - `planilla.anio` / `planilla.anioCorto`
  - `planilla.horarios` (texto armado desde los turnos del mes)
  - `planilla.horariosPorDia` (objeto: `planilla.horariosPorDia.Lun`, `planilla.horariosPorDia.Mar`, etc.)
  - `planilla.horariosIngresoPorDia` (igual que `horariosPorDia`, para la columna "Hora ingreso")
  - `planilla.horariosEgresoPorDia` (hora de egreso = ingreso + 45min, para la columna "Hora egreso")
  - `planilla.fechasPorDia` (fechas del mes que caen en ese día; ej `planilla.fechasPorDia.Lun` => `03/02, 10/02, ...`)
  - `planilla.fechasPorDiaPorSemana` (para cuadrantes por semana; ej `planilla.fechasPorDiaPorSemana.Jue.1`, `.2`, `.3`, `.4`, `.5`)
  - `planilla.horariosIngresoPorDiaPorSemana` (cuadrantes por semana; ej `planilla.horariosIngresoPorDiaPorSemana.Jue.1`)
  - `planilla.horariosEgresoPorDiaPorSemana` (cuadrantes por semana; ej `planilla.horariosEgresoPorDiaPorSemana.Jue.1`)
- `fecha`: fecha de hoy (YYYY-MM-DD)

## Formato de `mappings.json`

La clave debe coincidir con el nombre de la carpeta del template (el `OBRA_SOCIAL_ID`).

Ejemplo mínimo:

```json
{
  "DASUTEN-30546671166": {
    "label": "DASUTEN",
    "template": "DASUTEN-30546671166/template.pdf",
    "outputName": "OS-{obraSocialId}-{apellido}_{nombre}-{fecha}.pdf",
    "fields": [
      { "page": 0, "x": 100, "y": 700, "size": 12, "source": "patient.nombreCompleto" },
      { "page": 0, "x": 100, "y": 680, "size": 12, "source": "patient.dni" },
      { "page": 0, "x": 100, "y": 660, "size": 10, "source": "center.razonSocial" }
    ]
  }
}
```

### Tipos de field soportados

- Coordenadas (texto “dibujado” encima):
  - `{ page, x, y, size, color, source }`
- AcroForm (si el PDF tiene campos de formulario):
  - `{ acroField: "NOMBRE_DEL_CAMPO", source: "patient.dni", optional: true }`
