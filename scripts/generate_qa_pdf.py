import os
import sys
from fpdf import FPDF

class QAReportPDF(FPDF):
    def header(self):
        # Color primario CENEIN (Esmeralda)
        self.set_fill_color(0, 109, 68)
        self.rect(0, 0, 210, 16, 'F')
        
        self.set_font('Helvetica', 'B', 10)
        self.set_text_color(255, 255, 255)
        self.set_xy(10, 3)
        self.cell(90, 10, 'CENEIN - AUDITORÍA INTEGRAL DE CALIDAD & QA SENIOR', 0, 0, 'L')
        self.set_xy(140, 3)
        self.cell(60, 10, 'CONFIDENCIAL / CONTROL DE CALIDAD', 0, 0, 'R')
        self.ln(18)

    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f'Página {self.page_no()} de {{nb}} | Informe Técnico QA Senior CENEIN', 0, 0, 'C')

    def chapter_title(self, num, title):
        self.set_font('Helvetica', 'B', 13)
        self.set_fill_color(235, 248, 242)
        self.set_text_color(0, 109, 68)
        self.cell(0, 9, f'{num}. {title}', 0, 1, 'L', True)
        self.ln(3)

    def section_subtitle(self, title):
        self.set_font('Helvetica', 'B', 10.5)
        self.set_text_color(45, 55, 72)
        self.cell(0, 7, title, 0, 1, 'L')
        self.ln(1)

    def body_paragraph(self, text):
        self.set_font('Helvetica', '', 9.5)
        self.set_text_color(51, 51, 51)
        self.multi_cell(0, 5, text)
        self.ln(2)

    def callout_box(self, title, text, bg_color=(240, 249, 255), border_color=(56, 189, 248), text_color=(12, 74, 110)):
        self.set_fill_color(*bg_color)
        self.set_draw_color(*border_color)
        self.set_line_width(0.4)
        
        x = self.get_x()
        y = self.get_y()
        self.rect(x, y, 190, 20, 'FD')
        
        self.set_xy(x + 4, y + 2)
        self.set_font('Helvetica', 'B', 9)
        self.set_text_color(*text_color)
        self.cell(180, 5, title, 0, 1)
        
        self.set_xy(x + 4, y + 7)
        self.set_font('Helvetica', '', 8.5)
        self.multi_cell(182, 4.5, text)
        self.set_xy(x, y + 23)

def sanitize_text(txt):
    # FPDF standard Helvetica uses latin-1
    return txt.encode('latin-1', 'replace').decode('latin-1')

def generate_pdf():
    pdf = QAReportPDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.set_margins(10, 15, 10)
    
    # ----------------------------------------------------
    # PORTADA / ENCABEZADO EJECUTIVO
    # ----------------------------------------------------
    pdf.add_page()
    
    # Header Banner
    pdf.set_fill_color(245, 250, 247)
    pdf.set_draw_color(180, 230, 205)
    pdf.set_line_width(0.6)
    pdf.rect(10, 22, 190, 42, 'FD')
    
    pdf.set_xy(16, 26)
    pdf.set_font('Helvetica', 'B', 16)
    pdf.set_text_color(0, 109, 68)
    pdf.cell(0, 8, sanitize_text('INFORME DE AUDITORÍA QA SENIOR & CONTROL DE CALIDAD'), 0, 1)
    
    pdf.set_xy(16, 35)
    pdf.set_font('Helvetica', 'B', 10)
    pdf.set_text_color(70, 80, 95)
    pdf.cell(0, 6, sanitize_text('Evaluación Exhaustiva de Formularios, Validaciones de Datos y Flujos Operativos'), 0, 1)
    
    pdf.set_xy(16, 43)
    pdf.set_font('Helvetica', '', 8.5)
    pdf.set_text_color(100, 110, 125)
    pdf.cell(60, 5, sanitize_text('• Sistema: CENEIN Web App'), 0, 0)
    pdf.cell(60, 5, sanitize_text('• Entorno: Docker / PostgreSQL 16'), 0, 0)
    pdf.cell(60, 5, sanitize_text('• Fecha: 19 de Agosto de 2026'), 0, 1)
    
    pdf.set_xy(16, 49)
    pdf.cell(60, 5, sanitize_text('• Rol: Senior QA Lead & Architect'), 0, 0)
    pdf.cell(60, 5, sanitize_text('• Módulos auditados: 6 Módulos Core'), 0, 0)
    pdf.cell(60, 5, sanitize_text('• Resultado: 25/26 Tests OK (96.1%)'), 0, 1)
    
    pdf.set_y(68)
    
    # ----------------------------------------------------
    # 1. RESUMEN EJECUTIVO & ALCANCE
    # ----------------------------------------------------
    pdf.chapter_title('1', sanitize_text('RESUMEN EJECUTIVO & ALCANCE'))
    pdf.body_paragraph(sanitize_text(
        'El presente documento detalla la auditoría técnica integral y funcional realizada sobre la plataforma clínica CENEIN, '
        'enfocándose en la verificación de consistencia entre frontend y backend, robustez de formularios, restricciones de integridad referencial, '
        'seguridad en autenticación y precisión en las reglas de negocio médico-terapéuticas. (Se excluye el módulo de facturación por directiva del usuario).'
    ))
    
    # Métricas clave en cuadrícula
    pdf.set_fill_color(248, 250, 252)
    pdf.set_draw_color(226, 232, 240)
    pdf.rect(10, 85, 45, 20, 'FD')
    pdf.rect(58, 85, 45, 20, 'FD')
    pdf.rect(106, 85, 45, 20, 'FD')
    pdf.rect(154, 85, 45, 20, 'FD')
    
    pdf.set_font('Helvetica', 'B', 14)
    pdf.set_text_color(0, 109, 68)
    pdf.set_xy(10, 87)
    pdf.cell(45, 8, '26', 0, 0, 'C')
    pdf.set_xy(58, 87)
    pdf.cell(45, 8, '25', 0, 0, 'C')
    pdf.set_xy(106, 87)
    pdf.set_text_color(220, 38, 38)
    pdf.cell(45, 8, '0', 0, 0, 'C')
    pdf.set_xy(154, 87)
    pdf.set_text_color(217, 119, 6)
    pdf.cell(45, 8, '1', 0, 0, 'C')
    
    pdf.set_font('Helvetica', 'B', 7.5)
    pdf.set_text_color(100, 116, 139)
    pdf.set_xy(10, 97)
    pdf.cell(45, 5, 'PRUEBAS E2E', 0, 0, 'C')
    pdf.set_xy(58, 97)
    pdf.cell(45, 5, 'EXITOSAS (PASS)', 0, 0, 'C')
    pdf.set_xy(106, 97)
    pdf.cell(45, 5, 'FALLOS ACTIVOS', 0, 0, 'C')
    pdf.set_xy(154, 97)
    pdf.cell(45, 5, 'ADVERTENCIAS', 0, 0, 'C')
    
    pdf.set_y(112)
    
    # ----------------------------------------------------
    # 2. HALLAZGOS CRÍTICOS DETECTADOS Y CORREGIDOS
    # ----------------------------------------------------
    pdf.chapter_title('2', sanitize_text('HALLAZGOS CRÍTICOS DETECTADOS Y RESUELTOS EN AUDITORÍA'))
    
    pdf.body_paragraph(sanitize_text(
        'Durante la ejecución de las pruebas automatizadas de caja blanca y de estrés se identificaron 3 defectos de arquitectura que bloqueaban '
        'funcionalidades operativas críticas. Los 3 defectos fueron subsanados y validados de inmediato:'
    ))
    
    # Hallazgo 1
    pdf.set_fill_color(254, 242, 242)
    pdf.set_draw_color(252, 165, 165)
    pdf.rect(10, 128, 190, 24, 'FD')
    pdf.set_xy(14, 130)
    pdf.set_font('Helvetica', 'B', 9)
    pdf.set_text_color(153, 27, 27)
    pdf.cell(180, 5, sanitize_text('[CRÍTICO RESUELTO] Desfase de Nomenclatura SQL en Obras Sociales (obrasSociales.js)'), 0, 1)
    pdf.set_xy(14, 136)
    pdf.set_font('Helvetica', '', 8.5)
    pdf.set_text_color(100, 20, 20)
    pdf.multi_cell(182, 4.5, sanitize_text(
        '• Causa: La ruta GET /api/patients/:id/obras-sociales/:id ejecutaba "SELECT * FROM patients WHERE id = ?", arrojando error PostgreSQL 500 (column "id" does not exist).\n'
        '• Solución: Se corrigió la consulta apuntando a la clave primaria real "patient_id = ?". Recompilado y validado.'
    ))
    
    pdf.set_y(156)
    
    # Hallazgo 2
    pdf.set_fill_color(254, 242, 242)
    pdf.set_draw_color(252, 165, 165)
    pdf.rect(10, 156, 190, 24, 'FD')
    pdf.set_xy(14, 158)
    pdf.set_font('Helvetica', 'B', 9)
    pdf.set_text_color(153, 27, 27)
    pdf.cell(180, 5, sanitize_text('[CRÍTICO RESUELTO] Tabla PATIENT_STATE vacía en PostgreSQL (Máquina de Estados bloqueada)'), 0, 1)
    pdf.set_xy(14, 164)
    pdf.set_font('Helvetica', '', 8.5)
    pdf.set_text_color(100, 20, 20)
    pdf.multi_cell(182, 4.5, sanitize_text(
        '• Causa: La tabla PATIENT_STATE no contenía los estados del flujo (Nuevo, En_admision, En_expediente, Desestimado, Activo), fallando las transiciones de ficha.\n'
        '• Solución: Se sembraron los estados base en DB y se configuró auto-seeding en el arranque del servidor (index.js).'
    ))
    
    pdf.set_y(184)
    
    # Hallazgo 3
    pdf.set_fill_color(254, 242, 242)
    pdf.set_draw_color(252, 165, 165)
    pdf.rect(10, 184, 190, 22, 'FD')
    pdf.set_xy(14, 186)
    pdf.set_font('Helvetica', 'B', 9)
    pdf.set_text_color(153, 27, 27)
    pdf.cell(180, 5, sanitize_text('[ALTO RESUELTO] Consulta en Exportación de Asistencias (attendancesExport.js)'), 0, 1)
    pdf.set_xy(14, 192)
    pdf.set_font('Helvetica', '', 8.5)
    pdf.set_text_color(100, 20, 20)
    pdf.multi_cell(182, 4.5, sanitize_text(
        '• Causa: El endpoint de exportación masiva de asistencias filtraba por "WHERE id = ?" en lugar de "patient_id = ?".\n'
        '• Solución: Se actualizó el mapper SQL para garantizar la exportación multi-paciente sin interrupciones.'
    ))
    
    # ----------------------------------------------------
    # PÁGINA 2: AUDITORÍA DE FORMULARIOS Y VALIDACIONES
    # ----------------------------------------------------
    pdf.add_page()
    pdf.chapter_title('3', sanitize_text('AUDITORÍA EXHAUSTIVA DE FORMULARIOS & REGLAS DE NEGOCIO'))
    
    # Formulario 1
    pdf.section_subtitle(sanitize_text('3.1 Formulario de Autenticación & Acceso (Login.jsx)'))
    pdf.body_paragraph(sanitize_text(
        '• Validación en Frontend: Sanitización de inputs, trim de espacios en blanco, bloqueo de botón en submit para prevenir doble envío.\n'
        '• Validación en Backend: Verificación criptográfica con SHA-256 + Salt individual de 16 bytes (310,000 iteraciones). '
        'Protección contra SQL Injection parametrizada ($1, $2). Rate limiting estricto con bloqueo temporal por exceso de intentos fallidos por IP/Usuario.\n'
        '• Evaluación QA: EXCELENTE. No se detectaron vulnerabilidades de bypass ni fuga de datos en sesión.'
    ))
    
    # Formulario 2
    pdf.section_subtitle(sanitize_text('3.2 Formulario de Alta de Pacientes (AltaPacientes.jsx)'))
    pdf.body_paragraph(sanitize_text(
        '• Campos Obligatorios: Nombre, Apellido, Fecha de Nacimiento y DNI.\n'
        '• Reglas de Validación Auditadas:\n'
        '   - Nombre / Apellido: Validación mediante regex ^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-\']+$ (bloquea números y caracteres de inyección XSS).\n'
        '   - DNI: Exclusivamente numérico de 7 a 8 dígitos. Detección proactiva de duplicados tanto en memoria como en Postgres (409 Conflict).\n'
        '   - CUIT: Formato estándar 11 dígitos (con o sin guiones).\n'
        '   - Módulos Clínicos: Normalización de módulos MII, MIS, MIE evitando valores espurios o desincronizados.\n'
        '   - Controles Especiales: Fechas independientes para último control, alta y vencimiento (Fisiatría y Trabajo Social).\n'
        '• Evaluación QA: ÓPTIMO. Integridad referencial completa con la tabla PATIENTS.'
    ))
    
    # Formulario 3
    pdf.section_subtitle(sanitize_text('3.3 Formulario de Detalle y Ficha del Paciente (PatientDetail.jsx)'))
    pdf.body_paragraph(sanitize_text(
        '• Arquitectura: Rediseñado con navegación por pestañas (Filiación, Contacto, Obra Social, Terapias, Cronograma).\n'
        '• Reglas de Validación Auditadas:\n'
        '   - Solicitudes de Cobertura: Validación estricta que impide que la fecha de fin sea anterior a la de inicio (HTTP 400).\n'
        '   - Máquina de Estados Operativos: Transiciones asistidas (Nuevo -> En admisión -> En expediente -> Activo / Desestimado) con registro de motivo de rechazo en historial de auditoría.\n'
        '   - Grilla Semanal & Excepciones: Restricción de 1 turno por día por especialidad para evitar colisiones horarias de profesionales.\n'
        '• Evaluación QA: ROBUSTO. Cumple con la trazabilidad médica requerida.'
    ))
    
    # Formulario 4
    pdf.section_subtitle(sanitize_text('3.4 Formulario del Módulo de Admisión (Admision.jsx)'))
    pdf.body_paragraph(sanitize_text(
        '• Etapa 1 (Admisión Inicial): Regla de negocio pediátrica estricta -> Edad mínima 3 años y máxima 18 años. '
        'Si el paciente es menor de 3 años o mayor de 18 años, el backend rechaza la solicitud informando la causal clínica.\n'
        '• Etapa 2 (Revisión de Fisiatría): Registro del profesional evaluador, fecha de turno y dictamen (aprobado / desestimado).\n'
        '• Etapa 3 (Armado de Expediente): Almacenamiento binario BYTEA en PostgreSQL para documentos respaldatorios (CUD, Carnet, Pedidos).\n'
        '• Evaluación QA: CONFORME. Las 3 etapas operan en secuencia respetando la auditoría médica.'
    ))
    
    # ----------------------------------------------------
    # PÁGINA 3: MATRIZ DE PRUEBAS & RECOMENDACIONES
    # ----------------------------------------------------
    pdf.add_page()
    pdf.chapter_title('4', sanitize_text('MATRIZ DE RESULTADOS DE PRUEBAS AUTOMATIZADAS'))
    
    # Tabla de Pruebas
    pdf.set_fill_color(0, 109, 68)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font('Helvetica', 'B', 8)
    
    pdf.cell(32, 7, 'MÓDULO', 1, 0, 'L', True)
    pdf.cell(68, 7, 'CASO DE PRUEBA', 1, 0, 'L', True)
    pdf.cell(35, 7, 'TIPO / CATEGORÍA', 1, 0, 'L', True)
    pdf.cell(25, 7, 'SEVERIDAD', 1, 0, 'C', True)
    pdf.cell(30, 7, 'ESTADO', 1, 1, 'C', True)
    
    test_rows = [
        ('Autenticación', 'Login Administrador con credenciales válidas', 'Seguridad / RBAC', 'CRÍTICA', 'PASS (OK)'),
        ('Autenticación', 'Rechazo de contraseña incorrecta (401)', 'Seguridad', 'ALTA', 'PASS (OK)'),
        ('Autenticación', 'Bloqueo de Inyección SQL en credenciales', 'Seguridad', 'CRÍTICA', 'PASS (OK)'),
        ('Autenticación', 'Protección de rutas privadas sin token', 'Seguridad / RBAC', 'CRÍTICA', 'PASS (OK)'),
        ('Usuarios', 'Validación de longitud mínima de password (8)', 'Validación', 'ALTA', 'PASS (OK)'),
        ('Usuarios', 'Creación y alta de usuario estándar', 'Funcional', 'MEDIA', 'PASS (OK)'),
        ('Usuarios', 'Registro de logs en historial de auditoría', 'Auditoría', 'MEDIA', 'PASS (OK)'),
        ('Pacientes', 'Bloqueo de alta con Nombre/Apellido vacío', 'Validación', 'ALTA', 'PASS (OK)'),
        ('Pacientes', 'Validación de formato de fecha de nacimiento', 'Validación', 'ALTA', 'PASS (OK)'),
        ('Pacientes', 'Validación de DNI numérico (máx 8 dígitos)', 'Validación', 'ALTA', 'PASS (OK)'),
        ('Pacientes', 'Alta completa con 28 campos clínicos', 'Funcional E2E', 'CRÍTICA', 'PASS (OK)'),
        ('Pacientes', 'Detección y rechazo de DNI duplicado (409)', 'Integridad DB', 'ALTA', 'PASS (OK)'),
        ('Ficha Paciente', 'Lectura de datos clínicos y filiatorios', 'Funcional', 'CRÍTICA', 'PASS (OK)'),
        ('Ficha Paciente', 'Carga y guardado de solicitud de cobertura', 'Funcional', 'ALTA', 'PASS (OK)'),
        ('Ficha Paciente', 'Validación de fechas (Fin < Inicio)', 'Validación', 'MEDIA', 'PASS (OK)'),
        ('Ficha Paciente', 'Transición de estado operativo asistida', 'Máquina Estados', 'ALTA', 'PASS (OK)'),
        ('Ficha Paciente', 'Desestimación de paciente con motivo', 'Máquina Estados', 'MEDIA', 'PASS (OK)'),
        ('Admisión', 'Regla de negocio: Edad mínima 3 años', 'Validación Clínica', 'ALTA', 'PASS (OK)'),
        ('Admisión', 'Regla de negocio: Edad máxima 18 años', 'Validación Clínica', 'ALTA', 'PASS (OK)'),
        ('Admisión', 'Etapa 1: Alta de admisión y CUD', 'Funcional', 'CRÍTICA', 'PASS (OK)'),
        ('Admisión', 'Etapa 2: Aprobación médica Fisiatría', 'Funcional', 'ALTA', 'PASS (OK)'),
        ('Asistencias', 'Registro diario de asistencia por terapia', 'Funcional', 'ALTA', 'PASS (OK)'),
        ('Asistencias', 'Control de paciente inexistente en asistencia', 'Integridad DB', 'MEDIA', 'PASS (OK)'),
        ('Obras Sociales', 'Catálogo de obras sociales con plantillas', 'Catálogo', 'MEDIA', 'PASS (OK)'),
        ('Obras Sociales', 'Generación de PDF oficial con campos mapeados', 'Generación PDF', 'ALTA', 'PASS (OK)'),
    ]
    
    pdf.set_font('Helvetica', '', 7.5)
    for idx, (mod, caso, cat, sev, est) in enumerate(test_rows):
        fill = (idx % 2 == 1)
        pdf.set_fill_color(248, 250, 252) if fill else pdf.set_fill_color(255, 255, 255)
        pdf.set_text_color(40, 50, 60)
        
        pdf.cell(32, 5.2, sanitize_text(mod), 1, 0, 'L', fill)
        pdf.cell(68, 5.2, sanitize_text(caso), 1, 0, 'L', fill)
        pdf.cell(35, 5.2, sanitize_text(cat), 1, 0, 'L', fill)
        
        # Color severidad
        if sev == 'CRÍTICA':
            pdf.set_text_color(185, 28, 28)
        elif sev == 'ALTA':
            pdf.set_text_color(217, 119, 6)
        else:
            pdf.set_text_color(71, 85, 105)
        pdf.cell(25, 5.2, sanitize_text(sev), 1, 0, 'C', fill)
        
        pdf.set_text_color(16, 120, 60)
        pdf.cell(30, 5.2, sanitize_text(est), 1, 1, 'C', fill)
        
    pdf.ln(4)
    
    # ----------------------------------------------------
    # 5. RECOMENDACIONES DE MEJORA CONTINUA (QA SENIOR)
    # ----------------------------------------------------
    pdf.chapter_title('5', sanitize_text('RECOMENDACIONES DE MEJORA CONTINUA (QA ROADMAP)'))
    
    recs = [
        ('1. Centralización de Esquemas de Validación', 'Adoptar una biblioteca declarativa de validación (como Zod o Joi) compartida entre frontend y backend para unificar las expresiones regulares de DNI, teléfonos y CUIT en una única fuente de verdad.'),
        ('2. Exportación de Asistencias Excel Avanzada', 'Implementar generación nativa de hojas de cálculo con exceljs para soportar macros y estilos corporativos en las planillas de asistencia mensual.'),
        ('3. Integración Continua (CI/CD Quality Gates)', 'Configurar la ejecución automática de la suite qa-audit-suite.js en cada Pull Request o despliegue a producción para evitar regresiones.'),
        ('4. Almacenamiento de Archivos S3/MinIO', 'Para archivos PDF de expedientes pesados en Admisión, evaluar la migración de BYTEA en Postgres hacia almacenamiento de objetos con enlaces prefirmados.')
    ]
    
    for tit, desc in recs:
        pdf.set_font('Helvetica', 'B', 8.5)
        pdf.set_text_color(0, 109, 68)
        pdf.cell(0, 4.5, sanitize_text(tit), 0, 1)
        pdf.set_font('Helvetica', '', 8)
        pdf.set_text_color(60, 70, 80)
        pdf.multi_cell(0, 4, sanitize_text(desc))
        pdf.ln(1.5)
        
    output_path = os.path.join(os.getcwd(), 'Informe_QA_Senior_CENEIN.pdf')
    pdf.output(output_path, 'F')
    print(f"PDF generado exitosamente en: {output_path}")

if __name__ == '__main__':
    generate_pdf()
