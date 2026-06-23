# Etapa 1: Construcción (Build) de React
FROM node:20-alpine AS builder

WORKDIR /app

# Copiamos package.json primero para aprovechar el caché de Docker
COPY package*.json ./
RUN npm ci

# Copiamos el resto del código y construimos la versión optimizada
COPY . .
RUN npm run build

# Etapa 2: Servidor Web Ligero (Producción)
FROM nginx:alpine

# Copiamos los archivos estáticos generados por React a Nginx
COPY --from=builder /app/build /usr/share/nginx/html

# Copiamos nuestra configuración de Nginx (para evitar errores 404 al recargar páginas)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponemos el puerto 80 del contenedor
EXPOSE 80

# Arrancamos Nginx
CMD ["nginx", "-g", "daemon off;"]
