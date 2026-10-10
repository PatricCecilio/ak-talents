import unittest
from unittest import mock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import ai
from app.core.config import settings


class AIStatusTestCase(unittest.TestCase):
    def setUp(self) -> None:
        app = FastAPI()
        app.include_router(ai.router, prefix="/ai")
        self.client = TestClient(app)

    def test_unavailable_without_key(self) -> None:
        for value in ("", "   "):
            with mock.patch.object(settings, "OPENAI_API_KEY", value):
                self.assertEqual(self.client.get("/ai/status").json(), {"available": False})

    def test_available_with_key_and_never_reveals_it(self) -> None:
        with mock.patch.object(settings, "OPENAI_API_KEY", "sk-teste-nao-real"):
            response = self.client.get("/ai/status")
        self.assertEqual(response.json(), {"available": True})
        self.assertNotIn("sk-", response.text)


if __name__ == "__main__":
    unittest.main()
