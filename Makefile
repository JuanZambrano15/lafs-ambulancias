.PHONY: up down logs test lint format typecheck migrate revision shell

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f api

# --- Calidad de código (correr dentro del entorno virtual de api/) ---

test:
	pytest --cov=app --cov-report=term-missing

lint:
	ruff check .

format:
	ruff format .
	ruff check --fix .

typecheck:
	mypy api/app

# --- Base de datos ---

migrate:
	cd api && alembic upgrade head

revision:
	cd api && alembic revision --autogenerate -m "$(m)"

shell:
	docker compose exec api /bin/sh
