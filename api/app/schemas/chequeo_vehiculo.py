"""Esquemas del chequeo semanal del vehículo (issue #19)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.core.chequeo_vehiculo import ITEMS_CHEQUEO_VEHICULO
from app.models.ambulancia import TipoAmbulancia
from app.models.chequeo_vehiculo import EstadoItemChequeo

Semaforo = Literal["verde", "amarillo", "rojo"]


class ItemChequeo(BaseModel):
    item: str
    estado: EstadoItemChequeo
    observacion: str | None = Field(default=None, max_length=300)


class ChequeoVehiculoCreate(BaseModel):
    ambulancia_id: int
    items: list[ItemChequeo]
    observaciones: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _items_completos(self) -> ChequeoVehiculoCreate:
        """Debe venir cada ítem del catálogo exactamente una vez, y toda
        falla debe decir qué pasó (una falla sin descripción no sirve
        a quien la tiene que arreglar)."""
        nombres = [i.item for i in self.items]
        esperados = set(ITEMS_CHEQUEO_VEHICULO)
        if len(nombres) != len(set(nombres)) or set(nombres) != esperados:
            raise ValueError("El chequeo debe traer cada ítem del catálogo exactamente una vez")
        for i in self.items:
            if i.estado == EstadoItemChequeo.falla and not (i.observacion or "").strip():
                raise ValueError(f"Describe la falla de: {i.item}")
        return self


class ChequeoVehiculoOut(BaseModel):
    id: int
    ambulancia_id: int
    movil: str
    conductor_id: int
    conductor_nombre: str
    realizado_en: datetime
    items: list[ItemChequeo]
    observaciones: str | None
    tiene_fallas: bool
    total_fallas: int


class ChequeoVehiculoResumen(BaseModel):
    """Una fila del historial, sin los 37 ítems."""

    id: int
    ambulancia_id: int
    movil: str
    conductor_nombre: str
    realizado_en: datetime
    tiene_fallas: bool
    total_fallas: int


class CatalogoChequeoOut(BaseModel):
    frecuencia_dias: int
    items: list[str]


class UltimoChequeo(BaseModel):
    id: int
    realizado_en: datetime
    conductor_nombre: str
    tiene_fallas: bool
    total_fallas: int


class EstadoFlotaOut(BaseModel):
    """Una ambulancia activa con lo que hay que saber de un vistazo:
    vigencias con semáforo y estado del chequeo semanal."""

    ambulancia_id: int
    movil: str
    placa: str
    tipo: TipoAmbulancia
    vencimiento_soat: date
    dias_soat: int
    semaforo_soat: Semaforo
    vencimiento_tecnomecanica: date
    dias_tecnomecanica: int
    semaforo_tecnomecanica: Semaforo
    ultimo_chequeo: UltimoChequeo | None
    dias_desde_chequeo: int | None
    chequeo_al_dia: bool