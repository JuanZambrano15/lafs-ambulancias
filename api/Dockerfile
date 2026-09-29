# Build reproducible y liviano: dependencias fijadas por versión exacta,
# imagen slim, usuario no-root en tiempo de ejecución.
#
# Se fija "bookworm" (Debian 12) explícitamente, en vez de "slim" a secas:
# la etiqueta "slim" apunta a la versión estable de Debian en cada momento
# y puede cambiar de un día para otro (p. ej. de bookworm a trixie),
# renombrando paquetes de apt y rompiendo el build sin que el Dockerfile
# haya cambiado. Fijar el codename evita esa sorpresa.
FROM python:3.12-slim-bookworm AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /srv/app

# Dependencias del sistema que necesita WeasyPrint (generación de PDF)
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf2.0-0 libffi-dev \
        shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app
COPY migrations ./migrations
COPY alembic.ini .

# Usuario sin privilegios: si alguien logra ejecutar código en el
# contenedor, no corre como root.
RUN useradd --create-home --shell /bin/false lafs
USER lafs

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
