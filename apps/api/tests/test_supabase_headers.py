from nueva_ruta_api.config import Settings


def test_legacy_service_role_jwt_keeps_bearer_compatibility() -> None:
    settings = Settings("https://supabase.invalid", "anon", "legacy-jwt")

    assert settings.service_role_headers == {
        "apikey": "legacy-jwt",
        "Authorization": "Bearer legacy-jwt",
    }
