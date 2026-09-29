"""Configuración de logging en JSON estructurado.

Logs en JSON (en vez de texto libre) para que, cuando el proyecto crezca,
se puedan filtrar y buscar fácilmente (por request_id, usuario, endpoint)
sin tener que parsear texto con regex.

IMPORTANTE: nunca loggear contraseñas, PIN, tokens JWT completos ni el
contenido clínico de un formato (diagnóstico, notas). Loggear solo
identificadores (ids, no nombres) cuando sea posible.
"""

import logging
import sys
from datetime import UTC, datetime

import orjson


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return orjson.dumps(payload).decode()


def configure_logging(level: int = logging.INFO) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)
