
"""Fotos del accidente SOAT, adjuntadas después del cierre (issue
#18): subir, listar, descargar, borrar, y el permiso especial de
"solo el que atendió, o un admin" (ver nota de módulo en
`app/models/formato_accidente_soat_foto.py`).
 
También cubre `GET /atenciones/mis-cerradas`, el endpoint nuevo que
le da al auxiliar/médico desde dónde llegar a estas fotos.
"""
 
from __future__ import annotations
 
import base64
import itertools
from datetime import date
 
from app.core.security import hash_secret
from app.models.ambulancia import Ambulancia, TipoAmbulancia
from app.models.empleado import Empleado
from app.models.formato_accidente_soat import FormatoAccidenteSoat
from app.models.rol import Rol
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
 
# Varias pruebas de este archivo crean más de una ambulancia/conductor
# en la misma prueba (p.ej. dos atenciones cerradas para comparar
# orden) -- un contador evita choques con las restricciones `unique`
# de `movil`/`placa`/`cedula`.
_contador = itertools.count(1)
 
ENCABEZADO_VALIDO = {
    "fecha_atencion": "2027-01-01",
    "hora_atencion": "08:00:00",
    "hora_entrega": None,
    "identificado": True,
    "paciente_tipo_documento": "cc",
    "paciente_numero_documento": "123456789",
    "paciente_aseguradora": "SOAT Seguros XYZ",
    "paciente_nombres": "Pepito",
    "paciente_apellidos": "Pérez",
    "paciente_edad": 45,
    "paciente_sexo": "m",
    "lugar_ocurrencia": "Av. Gran Colombia con calle 10",
    "ciudad": "Cúcuta",
    "telefono_contacto": "3001234567",
    "rol_victima": "conductor",
    "poliza_vigente_desde": "2026-01-01",
    "poliza_vigente_hasta": "2027-01-01",
    "numero_poliza": "SOAT-0001",
    "vehiculo_placa": "ABC123",
    "vehiculo_tipo": "Motocicleta",
    "vehiculo_marca": "Yamaha",
}
 
# PNG 1x1 real (no un string cualquiera) -- mismo que usa
# test_formato_accidente_soat_pdf.py para firmas, acá como el
# contenido de una "foto" de prueba.
_FOTO_PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB"
    "CAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)
 
# JPEG 1x1 real -- issue #18 (corregido tras QA): la validación ahora
# decodifica el archivo con Pillow en vez de confiar en el
# `content_type` que mande el cliente, así que las pruebas necesitan
# un JPEG de verdad (no basta con ponerle "image/jpeg" a los bytes de
# un PNG) para ejercitar ese otro formato.
_FOTO_JPEG_BYTES = base64.b64decode(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkS"
    "Ew8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJ"
    "CQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy"
    "MjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEA"
    "AAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIh"
    "MUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6"
    "Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZ"
    "mqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx"
    "8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREA"
    "AgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAV"
    "YnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hp"
    "anN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPE"
    "xcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDi"
    "6KKK+ZP3E//Z"
)
 
 
def _crear_ambulancia(db: Session) -> Ambulancia:
    n = next(_contador)
    ambulancia = Ambulancia(
        movil=f"M-foto{n}",
        placa=f"FT{n:04d}"[:10],
        tipo=TipoAmbulancia.basica,
        vencimiento_soat=date(2027, 1, 1),
        vencimiento_tecnomecanica=date(2027, 1, 1),
        activa=True,
    )
    db.add(ambulancia)
    db.commit()
    db.refresh(ambulancia)
    return ambulancia
 
 
def _crear_conductor(db: Session) -> Empleado:
    cedula = f"8000{next(_contador):05d}"
    empleado = Empleado(nombres="Carlos", apellidos="Gómez", cedula=cedula)
    db.add(empleado)
    db.flush()
 
    rol = db.query(Rol).filter(Rol.nombre == "conductor").first()
    if rol is None:
        rol = Rol(nombre="conductor", descripcion="Rol de prueba")
        db.add(rol)
        db.flush()
 
    usuario = Usuario(
        documento=cedula, password_hash=hash_secret("clave-conductor"), empleado_id=empleado.id
    )
    db.add(usuario)
    db.flush()
    db.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))
 
    db.commit()
    db.refresh(empleado)
    return empleado
 
 
def _crear_atencion(client: TestClient, db: Session, headers: dict[str, str]) -> int:
    ambulancia = _crear_ambulancia(db)
    conductor = _crear_conductor(db)
    response = client.post(
        "/atenciones",
        json={
            "tipo": "atencion_soat",
            "ambulancia_id": ambulancia.id,
            "conductor_id": conductor.id,
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["id"]
 
 
CLINICO_VALIDO = {
    "tratamiento": ["collar_cervical", "oxigeno"],
    "signos_vitales": [{"hora": "08:05", "ta": "120/80", "fc": 88, "fr": 18, "spo2": 97}],
    "glasgow_ocular": 4,
    "glasgow_verbal": 5,
    "glasgow_motora": 6,
    "triage": "ii",
    "descripcion": "Paciente víctima de accidente de tránsito, trasladado estable.",
    "nota_auxiliar": "Paciente estable durante el traslado.",
    "atendido_por": "Ana Ruiz",
    "firma_atendido_por": "data:image/png;base64,AAAA",
    "profesional_recibe_nombre": "Dra. Carolina Pinto",
    "profesional_recibe_cedula": "1098765432",
    "firma_profesional_recibe": "data:image/png;base64,CCCC",
}
 
 
def _cerrar_atencion(
    client: TestClient, db: Session, headers: dict[str, str], atencion_id: int
) -> None:
    """Cierra con el PIN de quien cierra -- cualquier auxiliar/médico
    puede cerrar cualquier atención abierta (ver el docstring de
    `cerrar_atencion`), así que el PIN que importa es el de quien
    manda la petición (`headers`), no el del responsable original."""
    documento = client.get("/auth/me", headers=headers).json()["documento"]
    usuario = db.query(Usuario).filter(Usuario.documento == documento).one()
    usuario.pin_hash = hash_secret("1234")
    db.commit()
 
    respuesta = client.put(
        f"/atenciones/{atencion_id}/cerrar", json={"pin": "1234"}, headers=headers
    )
    assert respuesta.status_code == 200
 
 
def _crear_atencion_cerrada(client: TestClient, db: Session, headers: dict[str, str]) -> int:
    """Atención SOAT con encabezado + clínico completos, ya cerrada --
    el punto de partida de casi todas las pruebas de este archivo."""
    atencion_id = _crear_atencion(client, db, headers)
    respuesta = client.put(
        f"/atenciones/{atencion_id}/formato-accidente-soat",
        json=ENCABEZADO_VALIDO,
        headers=headers,
    )
    assert respuesta.status_code == 200
    respuesta = client.put(
        f"/atenciones/{atencion_id}/formato-accidente-soat/clinico",
        json=CLINICO_VALIDO,
        headers=headers,
    )
    assert respuesta.status_code == 200
    _cerrar_atencion(client, db, headers, atencion_id)
    return atencion_id
 
 
def _subir_foto(
    client: TestClient,
    atencion_id: int,
    headers: dict[str, str],
    content_type: str = "image/png",
    contenido: bytes = _FOTO_PNG_BYTES,
):
    return client.post(
        f"/atenciones/{atencion_id}/formato-accidente-soat/fotos",
        headers=headers,
        files={"archivo": ("foto.png", contenido, content_type)},
    )
 
 
class TestSubirFoto:
    def test_sin_token_da_401(self, client: TestClient) -> None:
        response = client.post("/atenciones/1/formato-accidente-soat/fotos")
        assert response.status_code == 401
 
    def test_no_se_puede_subir_mientras_esta_abierta(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = _crear_atencion(client, db, auxiliar_headers)
        respuesta = client.put(
            f"/atenciones/{atencion_id}/formato-accidente-soat",
            json=ENCABEZADO_VALIDO,
            headers=auxiliar_headers,
        )
        assert respuesta.status_code == 200
 
        response = _subir_foto(client, atencion_id, auxiliar_headers)
        assert response.status_code == 409
 
    def test_el_auxiliar_que_atendio_puede_subir(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = _crear_atencion_cerrada(client, db, auxiliar_headers)
 
        response = _subir_foto(client, atencion_id, auxiliar_headers)
 
        assert response.status_code == 201
        body = response.json()
        assert body["atencion_id"] == atencion_id
        assert body["content_type"] == "image/png"
        assert body["tamanio_bytes"] == len(_FOTO_PNG_BYTES)
        assert body["subida_por"]["documento"] == "700000001"
 
    def test_el_administrador_puede_subir_a_cualquier_atencion(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion_cerrada(client, db, auxiliar_headers)
 
        response = _subir_foto(client, atencion_id, admin_headers)
 
        assert response.status_code == 201
 
    def test_otro_auxiliar_no_puede_subir(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        medico_headers: dict[str, str],
    ) -> None:
        """Issue #18: a diferencia del resto del formato (cualquier
        auxiliar/médico puede editar cualquier atención, ver el
        comentario en `cerrar_atencion`), acá sí se exige ser quien
        atendió -- el médico de `medico_headers` no es el responsable
        de esta atención (la cerró el auxiliar)."""
        atencion_id = _crear_atencion_cerrada(client, db, auxiliar_headers)
 
        response = _subir_foto(client, atencion_id, medico_headers)
 
        assert response.status_code == 403
 
    def test_un_archivo_que_no_es_una_imagen_da_422(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        """A diferencia de antes, lo que decide si se acepta no es el
        `content_type` que mande el cliente -- son los bytes de
        verdad (ver `_detectar_formato_foto`) -- así que para que esta
        prueba rechace algo, el contenido mismo tiene que no ser una
        imagen válida, sin importar qué diga el header."""
        atencion_id = _crear_atencion_cerrada(client, db, auxiliar_headers)
 
        response = _subir_foto(
            client,
            atencion_id,
            auxiliar_headers,
            content_type="image/png",
            contenido=b"esto no es una imagen, aunque el content-type diga que si",
        )
 
        assert response.status_code == 422
 
    def test_una_foto_jpeg_de_verdad_se_acepta(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        """Issue #18 (corregido tras QA): un JPG real se rechazaba
        antes si el cliente mandaba un `content_type` distinto a
        "image/jpeg" exacto (p. ej. "image/jpg", o genérico) -- ahora
        se acepta igual porque el contenido sí es un JPEG válido,
        detectado con Pillow en vez de confiar en ese header."""
        atencion_id = _crear_atencion_cerrada(client, db, auxiliar_headers)
 
        response = _subir_foto(
            client,
            atencion_id,
            auxiliar_headers,
            content_type="application/octet-stream",
            contenido=_FOTO_JPEG_BYTES,
        )
 
        assert response.status_code == 201
        assert response.json()["content_type"] == "image/jpeg"
 
    def test_una_foto_png_con_content_type_erroneo_se_acepta_igual(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = _crear_atencion_cerrada(client, db, auxiliar_headers)
 
        response = _subir_foto(
            client,
            atencion_id,
            auxiliar_headers,
            content_type="application/pdf",
            contenido=_FOTO_PNG_BYTES,
        )
 
        assert response.status_code == 201
        assert response.json()["content_type"] == "image/png"
 
    def test_archivo_vacio_da_422(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = _crear_atencion_cerrada(client, db, auxiliar_headers)
 
        response = _subir_foto(client, atencion_id, auxiliar_headers, contenido=b"")
 
        assert response.status_code == 422
 
    def test_archivo_demasiado_grande_da_413(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = _crear_atencion_cerrada(client, db, auxiliar_headers)
        # 8 MB + 1 byte -- un byte por encima del límite declarado en
        # `_TAMANIO_MAXIMO_FOTO_BYTES`.
        contenido_grande = b"\x00" * (8 * 1024 * 1024 + 1)
 
        response = _subir_foto(client, atencion_id, auxiliar_headers, contenido=contenido_grande)
 
        assert response.status_code == 413
 
    def test_subir_regenera_el_pdf_guardado(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = _crear_atencion_cerrada(client, db, auxiliar_headers)
        formato_antes = db.get(FormatoAccidenteSoat, atencion_id)
        assert formato_antes is not None
        pdf_generado_en_antes = formato_antes.pdf_generado_en
 
        response = _subir_foto(client, atencion_id, auxiliar_headers)
        assert response.status_code == 201
 
        db.expire_all()
        formato_despues = db.get(FormatoAccidenteSoat, atencion_id)
        assert formato_despues is not None
        assert formato_despues.pdf_generado_en is not None
        assert formato_despues.pdf_generado_en != pdf_generado_en_antes
 
 
class TestListarFotos:
    def test_sin_token_da_401(self, client: TestClient) -> None:
        response = client.get("/atenciones/1/formato-accidente-soat/fotos")
        assert response.status_code == 401
 
    def test_lista_vacia_si_no_hay_fotos(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = _crear_atencion_cerrada(client, db, auxiliar_headers)
 
        response = client.get(
            f"/atenciones/{atencion_id}/formato-accidente-soat/fotos", headers=auxiliar_headers
        )
 
        assert response.status_code == 200
        assert response.json() == []
 
    def test_trae_las_fotos_subidas_en_orden(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = _crear_atencion_cerrada(client, db, auxiliar_headers)
        _subir_foto(client, atencion_id, auxiliar_headers)
        _subir_foto(client, atencion_id, auxiliar_headers)
 
        response = client.get(
            f"/atenciones/{atencion_id}/formato-accidente-soat/fotos", headers=auxiliar_headers
        )
 
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 2
        assert body[0]["id"] < body[1]["id"]
 
    def test_cualquier_clinico_o_admin_puede_listar_aunque_no_atendiera(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        medico_headers: dict[str, str],
    ) -> None:
        """A diferencia de subir/borrar, listar (y descargar, ver el
        resto de la clase) no exige ser quien atendió -- mismo
        criterio que ya rige para ver el PDF o el historial."""
        atencion_id = _crear_atencion_cerrada(client, db, auxiliar_headers)
        _subir_foto(client, atencion_id, auxiliar_headers)
 
        response = client.get(
            f"/atenciones/{atencion_id}/formato-accidente-soat/fotos", headers=medico_headers
        )
 
        assert response.status_code == 200
        assert len(response.json()) == 1
 
 
class TestDescargarFoto:
    def test_descarga_el_contenido_real(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = _crear_atencion_cerrada(client, db, auxiliar_headers)
        subida = _subir_foto(client, atencion_id, auxiliar_headers)
        foto_id = subida.json()["id"]
 
        response = client.get(
            f"/atenciones/{atencion_id}/formato-accidente-soat/fotos/{foto_id}",
            headers=auxiliar_headers,
        )
 
        assert response.status_code == 200
        assert response.content == _FOTO_PNG_BYTES
        assert response.headers["content-type"] == "image/png"
 
    def test_foto_de_otra_atencion_da_404(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id_1 = _crear_atencion_cerrada(client, db, auxiliar_headers)
        subida = _subir_foto(client, atencion_id_1, auxiliar_headers)
        foto_id = subida.json()["id"]
        atencion_id_2 = _crear_atencion_cerrada(client, db, auxiliar_headers)
 
        response = client.get(
            f"/atenciones/{atencion_id_2}/formato-accidente-soat/fotos/{foto_id}",
            headers=auxiliar_headers,
        )
 
        assert response.status_code == 404
 
 
class TestEliminarFoto:
    def test_el_auxiliar_que_atendio_puede_borrar(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = _crear_atencion_cerrada(client, db, auxiliar_headers)
        subida = _subir_foto(client, atencion_id, auxiliar_headers)
        foto_id = subida.json()["id"]
 
        response = client.delete(
            f"/atenciones/{atencion_id}/formato-accidente-soat/fotos/{foto_id}",
            headers=auxiliar_headers,
        )
        assert response.status_code == 204
 
        listado = client.get(
            f"/atenciones/{atencion_id}/formato-accidente-soat/fotos", headers=auxiliar_headers
        )
        assert listado.json() == []
 
    def test_el_administrador_puede_borrar(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion_cerrada(client, db, auxiliar_headers)
        subida = _subir_foto(client, atencion_id, auxiliar_headers)
        foto_id = subida.json()["id"]
 
        response = client.delete(
            f"/atenciones/{atencion_id}/formato-accidente-soat/fotos/{foto_id}",
            headers=admin_headers,
        )
        assert response.status_code == 204
 
    def test_otro_auxiliar_no_puede_borrar(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        medico_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion_cerrada(client, db, auxiliar_headers)
        subida = _subir_foto(client, atencion_id, auxiliar_headers)
        foto_id = subida.json()["id"]
 
        response = client.delete(
            f"/atenciones/{atencion_id}/formato-accidente-soat/fotos/{foto_id}",
            headers=medico_headers,
        )
 
        assert response.status_code == 403
 
    def test_foto_inexistente_da_404(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = _crear_atencion_cerrada(client, db, auxiliar_headers)
 
        response = client.delete(
            f"/atenciones/{atencion_id}/formato-accidente-soat/fotos/999999",
            headers=auxiliar_headers,
        )
 
        assert response.status_code == 404
 
    def test_borrar_regenera_el_pdf_guardado(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = _crear_atencion_cerrada(client, db, auxiliar_headers)
        subida = _subir_foto(client, atencion_id, auxiliar_headers)
        foto_id = subida.json()["id"]
        formato_con_foto = db.get(FormatoAccidenteSoat, atencion_id)
        assert formato_con_foto is not None
        pdf_generado_en_con_foto = formato_con_foto.pdf_generado_en
 
        response = client.delete(
            f"/atenciones/{atencion_id}/formato-accidente-soat/fotos/{foto_id}",
            headers=auxiliar_headers,
        )
        assert response.status_code == 204
 
        db.expire_all()
        formato_sin_foto = db.get(FormatoAccidenteSoat, atencion_id)
        assert formato_sin_foto is not None
        assert formato_sin_foto.pdf_generado_en != pdf_generado_en_con_foto
 
 
class TestMisAtencionesCerradas:
    """`GET /atenciones/mis-cerradas` (issue #18): de dónde sale el
    auxiliar/médico para llegar a la pantalla de fotos de una atención
    que ya cerró -- a diferencia de `GET /atenciones/cerradas` (issue
    #15), que es solo para el administrador y no filtra por
    responsable.
    """
 
    def test_sin_token_da_401(self, client: TestClient) -> None:
        response = client.get("/atenciones/mis-cerradas")
        assert response.status_code == 401
 
    def test_conductor_no_puede_verlas(
        self, client: TestClient, conductor_headers: dict[str, str]
    ) -> None:
        response = client.get("/atenciones/mis-cerradas", headers=conductor_headers)
        assert response.status_code == 403
 
    def test_administrador_no_tiene_este_endpoint(
        self, client: TestClient, admin_headers: dict[str, str]
    ) -> None:
        """El administrador usa el panel web (`GET /atenciones/cerradas`,
        issue #15), no este -- este es "las mías", y el admin no es
        responsable de ninguna atención."""
        response = client.get("/atenciones/mis-cerradas", headers=admin_headers)
        assert response.status_code == 403
 
    def test_trae_las_propias_cerradas_mas_recientes_primero(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        primera = _crear_atencion_cerrada(client, db, auxiliar_headers)
        segunda = _crear_atencion_cerrada(client, db, auxiliar_headers)
 
        response = client.get("/atenciones/mis-cerradas", headers=auxiliar_headers)
 
        assert response.status_code == 200
        ids = [atencion["id"] for atencion in response.json()]
        assert ids == [segunda, primera]
 
    def test_no_trae_las_de_otro_responsable(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        medico_headers: dict[str, str],
    ) -> None:
        _crear_atencion_cerrada(client, db, auxiliar_headers)
 
        response = client.get("/atenciones/mis-cerradas", headers=medico_headers)
 
        assert response.status_code == 200
        assert response.json() == []
 
    def test_no_trae_atenciones_todavia_abiertas(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        _crear_atencion(client, db, auxiliar_headers)
 
        response = client.get("/atenciones/mis-cerradas", headers=auxiliar_headers)
 
        assert response.status_code == 200
        assert response.json() == []