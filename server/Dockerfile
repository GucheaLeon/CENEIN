# Usamos una versión oficial y ligera de Node 20
FROM node:20-alpine

# Establecemos la carpeta de trabajo dentro del contenedor
WORKDIR /app

# Copiamos los package.json e instalamos dependencias
COPY package*.json ./
RUN npm ci

# Copiamos todo el resto del código del servidor
COPY . .

# Exponemos el puerto en el que escucha nuestra API
EXPOSE 4000

# Comando para prender el backend
CMD ["node", "index.js"]
