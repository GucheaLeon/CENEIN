# CENEIN-FAT local

Esta copia esta preparada para trabajar en local sin Render, Supabase, `DATABASE_URL`, API keys ni archivos `.env`.

## Requisitos

- Node.js
- npm

## Instalar

Desde esta carpeta:

```powershell
cd server
npm install

cd ..\app-cenein
npm install
```

## Ejecutar

En una terminal:

```powershell
cd server
npm start
```

En otra terminal:

```powershell
cd app-cenein
npm start
```

La app abre en `http://localhost:3000` y la API local corre en `http://localhost:4000`.

Usuario inicial local:

- usuario: `admin`
- password: `admin1234`

La base local se crea automaticamente en `server/data/local.sqlite`.
