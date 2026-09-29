# ADR-0001: Stack inicial del backend

- **Fecha:** 2026-09-28
- **Estado:** Aceptada

## Contexto

L.A.F.S. Ambulancias necesita digitalizar sus formatos en papel. El
proyecto lo desarrolla una sola persona, a tiempo parcial, para 4
ambulancias y unos 12 usuarios. Ver el documento de diseño completo para
el análisis funcional; este ADR cubre solo la decisión técnica del
backend.

## Decisión

FastAPI + PostgreSQL + SQLAlchemy + Alembic, en Docker Compose detrás de
Caddy, en un único VPS.

## Alternativas consideradas

- **Django / Django REST Framework** — más "baterías incluidas", pero más
  pesado de lo que necesita una API que solo sirve a una app móvil y un
  panel web; FastAPI da validación automática (Pydantic) y documentación
  OpenAPI generada sola con menos código.
- **Node.js / NestJS** — válido, pero el desarrollador tiene más
  experiencia y velocidad en Python, y no hay ningún requisito del cliente
  que empuje hacia Node.
- **Microservicios** — descartado: la carga es baja (4 ambulancias) y
  separar servicios solo sumaría trabajo de operación sin beneficio real.
- **Base de datos NoSQL (MongoDB, etc.)** — descartada: los datos son
  relacionales (atenciones, tripulación, lotes de medicamentos), y las
  columnas JSONB de PostgreSQL ya cubren la parte flexible de los
  formatos sin sacrificar integridad referencial.

## Consecuencias

- Un solo lenguaje de backend que mantener (Python), con tipado estático
  vía type hints + mypy.
- Migraciones de esquema versionadas y reproducibles con Alembic desde el
  primer commit.
- Si la operación creciera mucho más allá de 4 ambulancias, este ADR
  debería revisarse (ver también la fila "Docker Compose en un servidor"
  del documento de diseño, que ya contempla ese escenario).
