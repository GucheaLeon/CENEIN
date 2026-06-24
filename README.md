# CENEIN - Sistema de Gestión

Bienvenido al repositorio oficial de **CENEIN**, un sistema integral diseñado para la gestión de centros médicos, pacientes y turnos.

## 📖 Propósito del Proyecto
CENEIN nació con el objetivo de digitalizar y optimizar la administración de un centro de atención. Permite llevar un control exhaustivo sobre:
- Registro y ficha médica de pacientes.
- Gestión de obras sociales y tipos de documentos.
- Autenticación de usuarios y asignación de roles jerárquicos.
- Reportes automáticos y exportación de datos.

## 🛠️ Tecnologías y Arquitectura
El proyecto utiliza una arquitectura moderna basada en contenedores (Docker) para garantizar que funcione idénticamente en cualquier entorno:

- **Frontend:** React.js (servido de forma ultra-rápida mediante Nginx).
- **Backend:** Node.js + Express (API RESTful).
- **Base de Datos:** PostgreSQL (Relacional, estructurada en 26 tablas).
- **Proxy Inverso:** Caddy (Enrutamiento automático y certificados HTTPS gratuitos).
- **Infraestructura:** Todo el ecosistema está unificado bajo **Docker Compose**.

---

## 🚀 Requisitos Previos
Para poder levantar este proyecto, independientemente de tu sistema operativo, solo necesitas tener instalado:
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)
- *(Opcional)* Node.js y npm si deseas desarrollar el Frontend localmente con recarga automática.

---

## ⚙️ Configuración (Variables de Entorno)

El proyecto utiliza variables de entorno para manejar contraseñas y configuraciones secretas. 
En la raíz del proyecto, puedes crear un archivo `.env` para sobreescribir los valores por defecto (ideal para **Producción**).

Ejemplo de `.env`:
```env
DB_PASSWORD=tu_contraseña_super_segura
JWT_SECRET=un_secreto_muy_largo_y_dificil_de_adivinar
ADMIN_USERNAME=admin_cenein
ADMIN_PASSWORD=clave_admin_segura
```
*Nota: Si no creas este archivo en tu entorno local, Docker utilizará valores por defecto inseguros (`supersecret`, `admin1234`), lo cual es aceptable **solo para desarrollo en tu propia computadora**.*

---

## 💻 Instrucciones de Instalación y Ejecución

Existen dos formas principales de correr el proyecto, dependiendo de si eres un desarrollador escribiendo código, o si estás desplegando a un servidor.

### Opción A: Modo Desarrollo (Hot-Reload de React)
Si vas a modificar el diseño y quieres ver los cambios en tiempo real, te conviene levantar el Backend en Docker, pero correr el Frontend directamente en tu computadora:

1. Levanta la Base de Datos y la API:
   ```bash
   docker compose up -d db backend
   ```
2. En otra terminal, entra a la carpeta del Frontend e instala sus dependencias (solo la primera vez):
   ```bash
   cd app-cenein
   npm install
   ```
3. Inicia el servidor de desarrollo de React:
   ```bash
   npm start
   ```
Tu aplicación estará disponible en `http://localhost:3000` y la API en `http://localhost:4000`.

### Opción B: Modo Producción (Despliegue Completo)
Si quieres probar la aplicación terminada (tal cual se vería en internet) o estás desplegando en una VPS, utiliza este comando para levantar todos los servicios, incluyendo el proxy de Caddy:

```bash
docker compose up --build -d
```
Una vez que termine de construir las imágenes, tu aplicación estará disponible directamente en `http://localhost` (Puerto 80 por defecto).

---

## 🔐 Primer Inicio de Sesión
Al levantar la base de datos por primera vez, el sistema creará automáticamente un usuario administrador utilizando las variables de entorno. 
- **Usuario:** `admin` (o el valor de `ADMIN_USERNAME`)
- **Contraseña:** `admin1234` (o el valor de `ADMIN_PASSWORD`)

## 💾 Resguardo de Datos (Volúmenes)
Los datos de PostgreSQL no se pierden si apagas los contenedores. Docker los guarda automáticamente en un volumen persistente llamado `cenein-db-data`. Si necesitas "formatear" la base de datos y empezar de cero, puedes borrar el volumen ejecutando:
`docker compose down -v`
