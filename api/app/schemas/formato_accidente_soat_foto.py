"""Esquema de salida de las fotos del accidente SOAT adjuntadas
después del cierre (issue #18) -- ver nota de módulo en
`app/models/formato_accidente_soat_foto.py`.
 
El contenido binario de la foto nunca viaja en este esquema (sería un
payload JSON enorme en base64 para cada una de la lista) -- se
descarga aparte, por un endpoint propio que devuelve la imagen
directamente (mismo criterio que el PDF ya guardado,
`descargar_pdf_formato_accidente_soat`).
"""
 
from __future__ import annotations
 
from datetime import datetime
 
from pydantic import BaseModel, ConfigDict
 
from app.schemas.formato_version import UsuarioResumenOut
 
 
class FormatoAccidenteSoatFotoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
 
    id: int
    atencion_id: int
    content_type: str
    tamanio_bytes: int
    subida_por: UsuarioResumenOut
    subida_en: datetime
 

 
