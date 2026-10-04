"""Se importan todos los modelos acá para que `Base.metadata` los
conozca al correr `alembic revision --autogenerate` (ver
api/migrations/env.py, que importa `app.db.base.Base`).
"""
 
from app.models.ambulancia import Ambulancia
from app.models.atencion import Atencion
from app.models.empleado import Empleado
from app.models.formato_traslado import FormatoTraslado
from app.models.rol import Rol
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol
 
__all__ = [
    "Ambulancia",
    "Atencion",
    "Empleado",
    "FormatoTraslado",
    "Rol",
    "Usuario",
    "UsuarioRol",
]