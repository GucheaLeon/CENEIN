# Flujo de Trabajo y Ramas (Branching) en Git — Cenein

Este documento describe la estrategia de ramas (branching) de Git que usamos en este proyecto, el flujo de trabajo paso a paso que todo desarrollador debe seguir y cómo manejar situaciones comunes de la vida real.

---

## Tabla de Contenidos

1. [Estructura de Ramas](#estructura-de-ramas)
2. [Reglas de las Ramas](#reglas-de-las-ramas)
3. [Flujo de Trabajo del Desarrollador — Iniciar una Nueva Funcionalidad](#flujo-de-trabajo-del-desarrollador--iniciar-una-nueva-funcionalidad)
4. [Flujo de Trabajo del Desarrollador — Trabajo Diario (Retomando al Día Siguiente)](#flujo-de-trabajo-del-desarrollador--trabajo-diario-retomando-al-día-siguiente)
5. [Flujo de Trabajo del Desarrollador — Finalizar una Funcionalidad](#flujo-de-trabajo-del-desarrollador--finalizar-una-funcionalidad)
6. [Promoción de Código: Development → Staging → Main](#promoción-de-código-development--staging--main)
7. [Escenarios Comunes y Solución de Problemas](#escenarios-comunes-y-solución-de-problemas)
8. [Hoja de Referencia Rápida](#hoja-de-referencia-rápida)

---

## Estructura de Ramas

El proyecto utiliza **tres ramas permanentes** y ramas temporales de **funcionalidades (features)**:

```
main          ← Código de producción (estable, desplegado)
 └── staging  ← Pruebas y QA (validación pre-producción)
      └── development  ← Desarrollo activo (rama de integración)
           ├── feature/login-page
           ├── feature/patient-search
           └── feature/...
```

| Rama             | Propósito                                                              | Quién fusiona (merge) en ella                    | Se despliega en          |
| ------------------| ------------------------------------------------------------------------| --------------------------------------------------| --------------------------|
| `main`           | Código de producción estable. Solo vive aquí el código probado y aprobado.      | Líder técnico / después de aprobación de QA                    | Producción               |
| `staging`        | Pruebas de pre-producción. El código se valida aquí antes de ir a `main`. | Líder técnico / revisor designado                  | Entorno Staging / QA |
| `development`    | Rama de integración. Todas las funcionalidades completadas se fusionan aquí.            | Cualquier desarrollador (vía Pull Request o merge directo) | Entorno de Desarrollo  |
| `feature/<nombre>` | Rama temporal para una sola funcionalidad o tarea. Se elimina después de fusionarse.  | El desarrollador trabajando en la funcionalidad                 | Solo local               |

---

## Reglas de las Ramas

> **⚠️ IMPORTANTE — Nunca hagas commit directamente a `main` o `staging`.**

1. **`main`** es de solo lectura para los desarrolladores. Solo recibe merges de `staging` tras la aprobación de QA.
2. **`staging`** solo recibe merges de `development`. No se permiten commits directos.
3. **`development`** solo recibe merges de las ramas de funcionalidades (features). Evita hacer commit directamente en ella.
4. Las **Ramas de funcionalidades (Feature branches)** siempre se crean a partir de `development` y se fusionan de vuelta en `development`.
5. Cada rama de funcionalidad debe tener un nombre descriptivo: `feature/exportacion-pacientes`, `feature/fix-bug-login`, etc.

---

## Flujo de Trabajo del Desarrollador — Iniciar una Nueva Funcionalidad

Sigue estos pasos **cada vez** que empieces a trabajar en una nueva funcionalidad (feature).

### Paso 1 — Asegúrate de que tu repositorio local esté actualizado

Antes de crear cualquier rama, necesitas descargar los últimos cambios del repositorio remoto.

```bash
# Cambia a la rama de desarrollo (development)
git checkout development

# Descarga TODOS los cambios del remoto (todas las ramas)
git fetch origin

# Fusiona el development remoto más reciente en tu development local
git pull origin development
```

> **¿Por qué `fetch` + `pull`?**
> - `git fetch origin` descarga el estado más reciente de todas las ramas remotas sin modificar tus archivos locales. Actualiza tu conocimiento de lo que hay en el servidor.
> - `git pull origin development` aplica realmente esos cambios a tu rama actual. Es equivalente a `git fetch` + `git merge`.
> - Ejecutar `fetch` primero es un buen hábito porque te permite inspeccionar qué cambió antes de aplicarlo.

### Paso 2 — Crea una nueva rama de funcionalidad

```bash
# Crea y cambia a una nueva rama basada en development
git checkout -b feature/mi-nueva-funcionalidad
```

Esto crea una nueva rama llamada `feature/mi-nueva-funcionalidad` que inicia desde el estado actual de `development` e inmediatamente te cambia a ella.

> **Convención de nombres:** Usa el prefijo `feature/` seguido de un nombre corto, descriptivo y en minúsculas con guiones. Ejemplos:
> - `feature/busqueda-pacientes`
> - `feature/reporte-asistencias`
> - `feature/fix-redireccion-login`

### Paso 3 — Trabaja y haz commits

Ahora estás en tu rama de funcionalidad. Escribe tu código y haz commits frecuentemente con mensajes claros.

```bash
# Revisa qué archivos han sido modificados
git status

# Prepara (stage) archivos específicos
git add path/to/archivo1.py path/to/archivo2.html

# O prepara TODOS los archivos modificados
git add .

# Haz commit con un mensaje descriptivo
git commit -m "Agregar endpoint de búsqueda de pacientes con filtros"
```

> **Consejos para mensajes de commit:**
> - Usa el modo imperativo: "Agregar funcionalidad" no "Agregada funcionalidad"
> - Sé específico: "Arreglar puntero nulo en exportación de pacientes" no "Arreglar bug"
> - Mantén la primera línea por debajo de los 72 caracteres

### Paso 4 — Empuja (Push) tu rama de funcionalidad al remoto

Sube tu rama para que exista en GitHub (como respaldo y para que otros puedan ver tu progreso):

```bash
# Primer push — configura el seguimiento (tracking)
git push -u origin feature/mi-nueva-funcionalidad

# Pushes subsiguientes (después del primero)
git push
```

---

## Flujo de Trabajo del Desarrollador — Trabajo Diario (Retomando al Día Siguiente)

Empezaste una funcionalidad ayer pero no la terminaste. Hoy vuelves y otros desarrolladores pueden haber fusionado su trabajo en `development`. Esto es lo que debes hacer:

### Paso 1 — Descarga los últimos cambios (Fetch)

```bash
# Descarga el estado más reciente de todas las ramas remotas
git fetch origin
```

### Paso 2 — Actualiza tu rama development local

```bash
# Cambia a development
git checkout development

# Trae (pull) los últimos cambios
git pull origin development
```

### Paso 3 — Vuelve a tu rama de funcionalidad y trae los nuevos cambios

```bash
# Vuelve a tu rama de funcionalidad
git checkout feature/mi-nueva-funcionalidad

# Fusiona el development actualizado en tu rama de funcionalidad
git merge development
```

> **¿Por qué fusionar `development` en tu rama de funcionalidad?**
> Esto mantiene tu rama al día con lo que todos los demás han estado haciendo. Si te saltas este paso, te arriesgas a tener conflictos de merge grandes y dolorosos cuando intentes fusionar tu funcionalidad de vuelta a `development` más tarde.

### Paso 4 — Resuelve conflictos (si los hay)

Si Git reporta conflictos de merge (merge conflicts), significa que dos personas modificaron las mismas líneas en el mismo archivo. Git marcará las áreas conflictivas en el archivo así:

```
<<<<<<< HEAD
// Tu código (de tu rama de funcionalidad)
const timeout = 5000;
=======
// Su código (de development)
const timeout = 3000;
>>>>>>> development
```

Para resolverlo:

1. Abre cada archivo conflictivo y decide qué versión mantener (o combina ambas).
2. Elimina los marcadores de conflicto (`<<<<<<<`, `=======`, `>>>>>>>`).
3. Prepara (stage) los archivos resueltos y haz commit:

```bash
git add path/to/archivo-resuelto.js
git commit -m "Resolver conflicto de merge con development"
```

### Paso 5 — Continúa trabajando

Ahora estás al día. Continúa programando, haciendo commits y pushes de manera normal.

```bash
# ... haz cambios ...
git add .
git commit -m "Continuar implementando filtros de búsqueda de pacientes"
git push
```

---

## Flujo de Trabajo del Desarrollador — Finalizar una Funcionalidad

Tu funcionalidad está completa y lista para ser integrada.

### Paso 1 — Actualización final desde development

Antes de fusionar, asegúrate de tener la versión absolutamente más reciente de `development`:

```bash
git checkout development
git pull origin development

git checkout feature/mi-nueva-funcionalidad
git merge development
```

Resuelve cualquier conflicto si aparece (revisa los pasos de resolución de conflictos arriba).

### Paso 2 — Empuja tus cambios finales

```bash
git push
```

### Paso 3 — Fusiona (Merge) en development

**Vía Pull Request en GitHub**

1. Ve al repositorio en GitHub.
2. Haz clic en **"Compare & pull request"** para tu rama de funcionalidad.
3. Establece la rama base en `development`.
4. Agrega una descripción de lo que hace la funcionalidad.
5. Solicita una revisión de código a un compañero de equipo (si aplica).
6. Una vez aprobado, haz clic en **"Merge pull request"**.


### Paso 4 — Limpia la rama de funcionalidad

Después de que el merge esté completo, elimina la rama de funcionalidad (ya no es necesaria):

```bash
# Eliminar localmente
git branch -d feature/mi-nueva-funcionalidad

# Eliminar en el remoto
git push origin --delete feature/mi-nueva-funcionalidad
```

---

## Promoción de Código: Development → Staging → Main

Después de que varias funcionalidades se han fusionado en `development` y el equipo decide que es momento de probar y lanzar:

### Development → Staging

```bash
git checkout staging
git pull origin staging
git merge development
git push origin staging
```

En este punto, se ejecutan las pruebas en el entorno de `staging`. El equipo verifica que todo funcione correctamente.

### Staging → Main (Después de Aprobación de QA)

Solo después de que todas las pruebas pasen y el equipo confirme que el código está listo:

```bash
git checkout main
git pull origin main
git merge staging
git push origin main
```

> **🚨 Este paso solo debe ser realizado por el líder técnico o una persona designada.** Fusionar en `main` significa desplegar a producción.

---

## Escenarios Comunes y Solución de Problemas

### 📌 "Hice commit accidentalmente en `development` en lugar de mi rama de funcionalidad"

Si aún no has hecho push:

```bash
# Deshace el último commit pero mantiene tus cambios
git reset --soft HEAD~1

# Ahora crea/cambia a tu rama de funcionalidad
git checkout -b feature/mi-funcionalidad

# Vuelve a hacer commit ahí
git add .
git commit -m "Cambios de mi funcionalidad"
```

### 📌 "Olvidé hacer pull antes de empezar mi rama de funcionalidad"

Tu rama de funcionalidad está basada en una versión antigua de `development`. No hay problema — solo actualízala:

```bash
git checkout development
git pull origin development

git checkout feature/mi-funcionalidad
git merge development
# Resuelve conflictos si los hay
```


---

## Hoja de Referencia Rápida

| Tarea | Comando |
|---|---|
| Cambiar de rama | `git checkout <rama>` |
| Crear y cambiar a nueva rama | `git checkout -b feature/<nombre>` |
| Descargar cambios remotos (sin merge) | `git fetch origin` |
| Descargar y aplicar cambios remotos | `git pull origin <rama>` |
| Preparar (stage) archivos | `git add <archivos>` o `git add .` |
| Hacer Commit | `git commit -m "mensaje"` |
| Push (primera vez) | `git push -u origin feature/<nombre>` |
| Push (subsiguientes) | `git push` |
| Fusionar rama en la rama actual | `git merge <rama>` |
| Eliminar rama local | `git branch -d <rama>` |
| Eliminar rama remota | `git push origin --delete <rama>` |
| Guardar cambios temporalmente | `git stash` / `git stash pop` |
| Ver historial de commits | `git log --oneline --graph` |
| Revisar rama actual y estado | `git status` |

---

## Resumen — El Ciclo de Vida Completo

```
1.  git checkout development
2.  git fetch origin
3.  git pull origin development
4.  git checkout -b feature/mi-funcionalidad
5.  ... trabaja, haz commit, push ...
6.  (al día siguiente) git fetch → git checkout development → git pull → git checkout feature/mi-funcionalidad → git merge development
7.  ... continúa trabajando, haz commit, push ...
8.  (terminado) Merge final de development a feature, luego merge de feature a development
9.  Eliminar rama feature
10. (ciclo de lanzamiento) development → staging → main
```
