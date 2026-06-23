# CENEIN-FAT local (Actualizado para PostgreSQL)

Esta copia está preparada para trabajar en local mediante **Docker**. Hemos migrado la base de datos de SQLite a **PostgreSQL** para garantizar estabilidad y rendimiento.

## Requisitos

- **Docker** y **Docker Compose** instalados.
- Node.js y npm (Solo para editar el frontend localmente).

## Ejecutar el Backend y Base de Datos

Ya no necesitas hacer `npm install` ni `npm start` en la carpeta `server`. Todo el entorno del backend y la base de datos se levantan con un solo comando gracias a Docker:

Desde la raíz del proyecto (donde está el archivo `docker-compose.yml`), abre una terminal y ejecuta:

```bash
docker compose up -d db backend
```

Esto descargará PostgreSQL, instalará las dependencias del servidor Node.js y levantará la API automáticamente en `http://localhost:4000`. 
*La base de datos se guardará internamente en un volumen de Docker, por lo que no perderás datos al apagar tu PC.*

## Ejecutar el Frontend (Desarrollo)

Para trabajar visualmente en React con recarga automática:

```bash
cd app-cenein
npm install
npm start
```

La app abrirá en `http://localhost:3000` y se conectará sola a tu backend Dockerizado.

### Usuario inicial local:
- usuario: `admin`
- password: `admin1234`
