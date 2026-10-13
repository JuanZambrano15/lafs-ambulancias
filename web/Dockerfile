# Compila el panel web del administrador (issue #49) a estáticos.
#
# La segunda etapa NO corre la app — no hay servidor Node en
# producción para esto. Solo existe para que `docker-compose` la use
# como contenedor "de un solo uso" que siembra el volumen con nombre
# `web_dist` (ver docker-compose.yml): Docker copia automáticamente el
# contenido de un punto de montaje hacia un volumen con nombre vacío
# la primera vez que se usa, así que basta con que la imagen tenga los
# estáticos en /srv/admin y que `caddy` monte ese mismo volumen para
# servirlos con `file_server` (ver infra/Caddyfile) — sin necesidad de
# un proceso Node corriendo en producción solo para servir archivos
# estáticos.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# Se puede pisar en build (docker compose build --build-arg) si el
# dominio real de producción es distinto — ver ADR-0013.
ARG VITE_API_URL=http://localhost:81
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM alpine:3.20
COPY --from=build /app/dist /srv/admin
CMD ["true"]