# CHANGELOG

## [1.2.4] - 2026/08/19

### Agregado
* Requerir la carga completa de los 8 PDFs antes de habilitar la validación y admisión de pacientes.
* sembrado automático de estados operativos en patient_state
* rediseño de la ficha de detalle del paciente con navegación por pestañas y banner clínico
* rediseño integral del buscador de pacientes con control unificado y filtros avanzados
### Modificado
* Arreglo de la API de Groq para automatizar el changelog.  
* Corrección de la fecha y versión del changelog generado automáticamente.
* corrección de consultas SQL con patient_id para generación de PDFs y exportación de asistencias

### Testing
* agregar suite de pruebas automatizadas de QA senior y generador de reporte

---

## [1.2.3] - 2026/08/19

### Modificado
* Rediseño visual de la pantalla de Alta de Pacientes y la gestión de asistencias en el frontend.


---

## [1.2.2] - 2026/08/19

### Agregado
* Rediseño moderno de vistas de usuarios y auditoría usando Tailwind CSS en el frontend.


---

## [1.2.1] - 2026/08/19

### Agregado
* Validación del rango de edad (3‑18 años) al ingresar pacientes.
* Pase automático de pacientes a la lista correspondiente.
* Validaciones estrictas en los formularios de admisión.

### Modificado
* Corrección en el almacenamiento de archivos PDF.


---

## [1.2.0] - 2026/08/19

### Agregado
* Automatización de la API Groq para generar el CHANGELOG.  
* Autocompletado por paciente en facturación, catálogo de módulos con precios y cálculo automático del importe.  
* Módulo de facturación electrónica ARCA.  

### Modificado
* Limpieza y simplificación del front‑end en las pantallas de inicio y login, eliminando código innecesario y sin función.  
* Corrección de la sintaxis del componente Badge en Facturacion.jsx.


---

## [1.1.5] - 2026/08/14

### Modificado
* Se realizó un cambio en el front del proyecto


---

## [1.1.4] - 2026/08/13

### Agregado
* Implementación adecuada de AI en changelog con Grok


---

## [1.1.3] - 2026/08/12

### Testing
* Testing de las primeras Facturas

### Modificado
* Arreglado de error al agregar un paciente

---

## [1.1.2] - 2026/08/11

### agregado
* Cambio de UI en Admision
* Busqueda de obra social
* Rutas de Backend (cambiadas "Admision.jsx")


---

## [1.1.1] - 2026/08/04

### agregado
* Agregado modulo de Admision



## [1.1.0] - 2026/08/04

### agregado
* Actualizacion de BD
* Organizacion del modulo Factura



## [1.0.3] - 2026/08/04

### agregado
* Definicion de etapas en el modulo Admision
* Agregado de checkboxes de OS y CUD


---

## [1.0.2] - 2026/07/28

### agregado
* Agregado de modulo de Admision


---


## [1.0.1] - 2026/07/21


### modificado
* Se soluciono la planilla en funcion de las semanas 

---


## [1.0.0] - 2026/06/30

### agregado
* Deploy del proyecto en la web 




### modificado
* Modificacion de la estructura de la base de datos

---

## [0.2.0] - 2026/06/15

### agregado
* Migración de base de datos a PostgreSQL y dockerización del entorno
* Esquema inicial y cargado de datos de la base de datos 
* Módulo de informes del paciente e informes generales 
* Núcleo de la aplicación CENEIN y servidor backend

### modificado
* Correcciones e integridad en las tablas de la base de datos 
* Correccion en implementacion de las ramas de Git


## [0.1.0] - 2026/05/20

### agregado
* Commits de prueba en rama `feature_prueba` 
* Subida inicial de la base de datos y documento SRS en PDF 
* Primer commit y estructura base del proyecto
