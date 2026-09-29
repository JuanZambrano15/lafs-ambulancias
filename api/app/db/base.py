"""Clase base declarativa de SQLAlchemy.

Todos los modelos (Usuario, Empleado, Ambulancia, Atencion, Formato...)
heredan de `Base`. Se mantiene en un módulo aparte, sin importar los
modelos concretos aquí, para evitar imports circulares cuando cada
modelo se agregue en su propio archivo bajo `app/models/`.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
