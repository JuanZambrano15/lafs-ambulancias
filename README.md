# LAFS Ambulancias — Sistema de formatos digitales

[![CI](https://github.com/JuanZambrano15/lafs-ambulancias/actions/workflows/ci.yml/badge.svg)](https://github.com/JuanZambrano15/lafs-ambulancias/actions/workflows/ci.yml)
[![Licencia](https://img.shields.io/badge/licencia-MIT-blue.svg)](LICENSE)

Sistema para digitalizar los formatos en papel de **L.A.F.S. Ambulancias
S.A.S.**: traslado asistencial de pacientes, atención de accidentes SOAT,
chequeos de vehículo e insumos, e inventario de medicamentos. Pensado para
operar sin conexión durante todo el servicio y sincronizar al llegar al
garaje, que es el único punto con internet.

## Problema

El personal llena hoy estos formatos en papel, lo que dificulta el
seguimiento, las correcciones auditables y el reporte de servicios para
nómina. El objetivo es llevarlos a una app Android (celular y tablet) y un
panel web, sin depender de conexión durante el traslado.

## Documentación

- [Documento de diseño completo](../../) — mapa de formatos, modelo de
  datos, arquitectura, decisiones técnicas y estimación por fases.
- [Maqueta interactiva de las pantallas](../../)
- [Backlog y estado del proyecto](../../projects) (tablero Kanban)

*(reemplaza estos enlaces por los de los artefactos publicados una vez
estén en el repo o enlazados desde aquí)*

## Arquitectura

- **App (celular y tablet):** React + Vite + TypeScript, empaquetada como
  APK con Capacitor (necesario para modo kiosco y borrado remoto).
- **Backend:** FastAPI + PostgreSQL, con SQLAlchemy y Alembic.
- **Sin conexión:** almacenamiento local en el dispositivo, sincronización
  por lote al reconectar.
- **Despliegue:** Docker Compose detrás de Caddy, en un único VPS.

Diagrama de componentes y decisiones detalladas en el documento de diseño.

## Estado del proyecto

Ver el [tablero del proyecto](../../projects) para el estado semana a
semana. El desarrollo sigue un Kanban personal (ver
[CONTRIBUTING.md](CONTRIBUTING.md)): backlog en Issues, iteraciones
semanales, sin ceremonias de equipo formales al ser un desarrollador único.

| Fase | Contenido | Estado |
|------|-----------|--------|
| 0 — Diseño y maqueta | Mapa de formatos, modelo de datos, arquitectura | ✅ Hecho |
| 1 — MVP de traslados | Usuarios, auth, formato de traslado completo, offline | 🔄 En curso |
| 2 — Más formatos y chequeos | SOAT, chequeos de vehículo e insumos | ⏳ Pendiente |
| 3 — Inventario, reportes y despliegue | Lotes, reporte del contador, producción | ⏳ Pendiente |

## Cómo correrlo localmente

```bash
git clone https://github.com/JuanZambrano15/lafs-ambulancias.git
cd lafs-ambulancias
cp .env.example .env
docker compose up --build
```

*(se completa a medida que exista código real de la API y la app)*

## Licencia

MIT — ver [LICENSE](LICENSE).
