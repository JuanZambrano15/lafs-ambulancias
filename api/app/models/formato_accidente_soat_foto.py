"""Fotos del accidente SOAT, adjuntadas después del cierre (issue
#18): "El auxiliar, el medico o el administrador pueden adjuntar
fotos mas adelante, no en el momento del accidente."
 
A diferencia del resto de este formato (encabezado/clínico, uno-a-uno
con `Atencion`), acá es muchos-a-uno: puede haber cualquier cantidad
de fotos, o ninguna, y no se versionan como `FormatoAccidenteSoatVersion`
-- borrar o agregar una foto no es una "corrección" de un campo, es
simplemente la lista cambiando.
 
Solo se pueden subir una vez la atención ya está *cerrada* (ver
`_puede_gestionar_fotos_soat` en `app/api/routes/atenciones.py`) --
decisión explícita del cliente, coincide con el título del issue
("después de firmado"). Y, a diferencia del resto del formato (ver el
comentario en `cerrar_atencion` sobre por qué cualquier auxiliar/
médico puede editar cualquier atención), acá sí se exige que quien
suba o borre una foto sea el mismo `responsable_id` que atendió -- o
un administrador: así lo pidió el cliente, para que fotos de un caso
ajeno no se puedan subir "por error" desde otro turno.
 
Se guardan como blobs en la base de datos, mismo criterio que la
firma y el PDF ya guardado (`pdf_generado`) -- sin infraestructura de
almacenamiento nueva. `content_type` y `tamanio_bytes` se guardan
aparte del blob para poder listar las fotos de una atención (nombre,
tamaño, quién y cuándo) sin tener que leer cada imagen completa.
"""
 
from __future__ import annotations
 
from datetime import datetime
from typing import TYPE_CHECKING
 
from sqlalchemy import DateTime, ForeignKey, Integer, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
 
from app.db.base import Base
 
if TYPE_CHECKING:
    from app.models.atencion import Atencion
    from app.models.usuario import Usuario
 
 
class FormatoAccidenteSoatFoto(Base):
    __tablename__ = "formato_accidente_soat_foto"
 
    id: Mapped[int] = mapped_column(primary_key=True)
    atencion_id: Mapped[int] = mapped_column(ForeignKey("atencion.id"), index=True)
    atencion: Mapped[Atencion] = relationship()
 
    contenido: Mapped[bytes] = mapped_column(LargeBinary)
    # p. ej. "image/jpeg" -- validado contra una lista fija al subir
    # (ver `_CONTENT_TYPES_FOTO_PERMITIDOS`), nunca confiado tal cual
    # venga del cliente para servir el archivo después.
    content_type: Mapped[str] = mapped_column(String(50))
    tamanio_bytes: Mapped[int] = mapped_column(Integer)
 
    subida_por_id: Mapped[int] = mapped_column(ForeignKey("usuario.id"))
    subida_por: Mapped[Usuario] = relationship()
    subida_en: Mapped[datetime] = mapped_column(DateTime(timezone=True))