# L.A.F.S. Ambulancias — Panel web del administrador

Panel web, hecho con React + Vite + TypeScript y estilado con Tailwind
CSS — mismas convenciones que `../app/`, para un navegador de
escritorio (no empaquetado, no usa Capacitor). Ver ADR-0013.

Cubre el login de administrador y el CRUD de usuarios, empleados y
roles (issue #49). El panel de pendientes y alertas (issue #15) se
agrega encima en un issue aparte.

## Requisitos

- Node 20+
- La API corriendo (ver `../api/README.md`)

## Desarrollo

```bash
npm install
cp .env.example .env   # ajustar VITE_API_URL si la API no corre en localhost:8000
npm run dev            # puerto 5174 — distinto al 5173 de ../app/
```

## Verificación local

```bash
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm run test       # vitest
npm run build      # tsc -b && vite build
```

## Despliegue

En producción no corre como servidor Node: `docker-compose.yml`
compila este proyecto a estáticos (`web-build`, ver `Dockerfile`) y
Caddy los sirve bajo `/admin/` del mismo dominio que la API (ver
`../infra/Caddyfile` y ADR-0013).