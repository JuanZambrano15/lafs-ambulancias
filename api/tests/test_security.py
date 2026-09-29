from app.core.security import (
    create_access_token,
    decode_token,
    hash_secret,
    verify_secret,
)


def test_hash_secret_nunca_devuelve_el_texto_plano() -> None:
    hashed = hash_secret("mi-clave-super-secreta")

    assert hashed != "mi-clave-super-secreta"
    assert hashed.startswith("$argon2")


def test_verify_secret_acepta_la_clave_correcta() -> None:
    hashed = hash_secret("correcta")

    assert verify_secret("correcta", hashed) is True


def test_verify_secret_rechaza_la_clave_incorrecta() -> None:
    hashed = hash_secret("correcta")

    assert verify_secret("incorrecta", hashed) is False


def test_access_token_se_puede_decodificar_y_trae_el_subject() -> None:
    token = create_access_token(subject="usuario-123")

    payload = decode_token(token)

    assert payload["sub"] == "usuario-123"
    assert payload["type"] == "access"
