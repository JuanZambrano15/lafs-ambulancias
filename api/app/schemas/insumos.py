"""Esquemas del catálogo de insumos y del chequeo de insumos (issue #20)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator


def _texto(valor: str) -> str:
    limpio = " ".join(valor.split())
    if not limpio:
        raise ValueError("No puede estar vacío")
    return limpio


class InsumoBase(BaseModel):
    categoria: str = Field(max_length=60)
    nombre: str = Field(max_length=150)
    minimo: int = Field(ge=0, le=9999)
    unidad: str | None = Field(default=None, max_length=30)

    @field_validator("categoria", "nombre")
    @classmethod
    def _no_vacio(cls, valor: str) -> str:
        return _texto(valor)

    @field_validator("unidad")
    @classmethod
    def _unidad(cls, valor: str | None) -> str | None:
        return (valor or "").strip() or None


class InsumoCreate(InsumoBase):
    ambulancia_id: int


class InsumoUpdate(BaseModel):
    categoria: str | None = Field(default=None, max_length=60)
    nombre: str | None = Field(default=None, max_length=150)
    minimo: int | None = Field(default=None, ge=0, le=9999)
    unidad: str | None = Field(default=None, max_length=30)

    @field_validator("categoria", "nombre")
    @classmethod
    def _no_vacio(cls, valor: str | None) -> str | None:
        return None if valor is None else _texto(valor)


class InsumoOut(BaseModel):
    id: int
    ambulancia_id: int
    categoria: str
    nombre: str
    minimo: int
    unidad: str | None
    orden: int

    model_config = {"from_attributes": True}


class PlantillaOut(BaseModel):
    clave: str
    nombre: str
    total: int


class CargarPlantilla(BaseModel):
    ambulancia_id: int
    plantilla: str


# --- Chequeo ---


class ItemChequeoInsumoIn(BaseModel):
    insumo_id: int
    encontrado: int = Field(ge=0, le=9999)


class ChequeoInsumosCreate(BaseModel):
    ambulancia_id: int
    items: list[ItemChequeoInsumoIn]
    observaciones: str | None = Field(default=None, max_length=2000)


class ItemChequeoInsumoOut(BaseModel):
    insumo_id: int
    categoria: str
    nombre: str
    unidad: str | None
    minimo: int
    encontrado: int
    faltante: bool


class ChequeoInsumosOut(BaseModel):
    id: int
    ambulancia_id: int
    movil: str
    auxiliar_id: int
    auxiliar_nombre: str
    realizado_en: datetime
    items: list[ItemChequeoInsumoOut]
    observaciones: str | None
    tiene_faltantes: bool
    total_faltantes: int


class ChequeoInsumosResumen(BaseModel):
    """Una fila del historial, sin los ítems."""

    id: int
    ambulancia_id: int
    movil: str
    auxiliar_nombre: str
    realizado_en: datetime
    tiene_faltantes: bool
    total_faltantes: int


class UltimoChequeoInsumos(BaseModel):
    id: int
    realizado_en: datetime
    auxiliar_nombre: str
    tiene_faltantes: bool
    total_faltantes: int


class EstadoInsumosMovil(BaseModel):
    """Una fila por móvil: tamaño de su catálogo y estado de su chequeo
    semanal."""

    ambulancia_id: int
    movil: str
    placa: str
    total_items: int
    frecuencia_dias: int
    ultimo_chequeo: UltimoChequeoInsumos | None
    dias_desde_chequeo: int | None
    chequeo_al_dia: bool


class CatalogoChequeoInsumosOut(BaseModel):
    frecuencia_dias: int
    items: list[InsumoOut]