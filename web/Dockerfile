# Compila el panel web del administrador (issue #49) a estáticos.
#
# La segunda etapa NO corre la app — no hay servidor Node en
# producción para esto. Es un contenedor "de un solo uso" que deja los
# estáticos en el volumen `web_dist` (ver docker-compose.yml), que
# `caddy` monta de solo lectura para servirlos con `file_server` (ver
# infra/Caddyfile).
#
# El CMD copia /dist -> /srv/admin a propósito EN CADA EJECUCIÓN, en
# vez de depender de que Docker siembre un volumen con nombre vacío
# con el contenido de la imagen (eso solo pasa la primera vez que el
# volumen se usa): sin esta copia explícita, reconstruir la imagen con
# código nuevo y volver a hacer `docker compose up --build` dejaría el
# volumen con el build viejo para siempre, porque ya no está vacío —
# exactamente el bug que encontramos probando el panel la primera vez.
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
COPY --from=build /app/dist /dist
CMD ["sh", "-c", "rm -rf /srv/admin && mkdir -p /srv/admin && cp -a /dist/. /srv/admin/"]