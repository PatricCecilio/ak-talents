import unittest

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings

OFFICIAL = "https://aktalent.com.br,https://www.aktalent.com.br"
PREVIEW_REGEX = r"^https://ak-talents-[a-z0-9]+-patriccecilios-projects\.vercel\.app$"


def make_settings(**overrides) -> Settings:
    return Settings(_env_file=None, DATABASE_URL="sqlite://", **overrides)


def preflight(config: Settings, origin: str):
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origins,
        allow_origin_regex=config.cors_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/ping")
    def ping():
        return {"ok": True}

    return TestClient(app).options(
        "/ping", headers={"Origin": origin, "Access-Control-Request-Method": "GET"}
    )


class CorsSettingsTestCase(unittest.TestCase):
    def test_parses_comma_separated_list_and_normalizes(self) -> None:
        config = make_settings(BACKEND_CORS_ORIGINS=" https://aktalent.com.br/ , https://www.aktalent.com.br,,https://aktalent.com.br ")
        self.assertEqual(config.cors_origins, ["https://aktalent.com.br", "https://www.aktalent.com.br"])

    def test_wildcard_is_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            make_settings(BACKEND_CORS_ORIGINS="*")

    def test_regex_is_disabled_by_default(self) -> None:
        self.assertIsNone(make_settings().cors_origin_regex)

    def test_official_domains_are_allowed(self) -> None:
        config = make_settings(BACKEND_CORS_ORIGINS=OFFICIAL)
        for origin in ("https://aktalent.com.br", "https://www.aktalent.com.br"):
            response = preflight(config, origin)
            self.assertEqual(response.headers.get("access-control-allow-origin"), origin)

    def test_other_origins_and_previews_are_blocked_without_regex(self) -> None:
        config = make_settings(BACKEND_CORS_ORIGINS=OFFICIAL)
        for origin in ("https://evil.example.com", "https://ak-talents-abc123-patriccecilios-projects.vercel.app"):
            self.assertIsNone(preflight(config, origin).headers.get("access-control-allow-origin"))

    def test_preview_regex_when_enabled(self) -> None:
        config = make_settings(BACKEND_CORS_ORIGINS=OFFICIAL, BACKEND_CORS_ORIGIN_REGEX=PREVIEW_REGEX)
        allowed = "https://ak-talents-abc123-patriccecilios-projects.vercel.app"
        self.assertEqual(preflight(config, allowed).headers.get("access-control-allow-origin"), allowed)
        self.assertIsNone(
            preflight(config, "https://ak-talents-abc123-someone-else.vercel.app").headers.get("access-control-allow-origin")
        )


if __name__ == "__main__":
    unittest.main()
