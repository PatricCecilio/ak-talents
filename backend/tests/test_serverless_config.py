import json
import unittest
from pathlib import Path
from unittest import mock

from sqlalchemy.pool import NullPool
from starlette.requests import Request

from app.core.config import settings
from app.core.rate_limit import client_ip
from app.database.session import engine_options

BACKEND_DIR = Path(__file__).resolve().parents[1]


def make_request(headers: dict[str, str], client_host: str = "10.0.0.1") -> Request:
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [(name.lower().encode(), value.encode()) for name, value in headers.items()],
        "client": (client_host, 1234),
    }
    return Request(scope)


class ClientIpTestCase(unittest.TestCase):
    def test_without_trusted_proxy_headers_are_ignored(self) -> None:
        # Locally/elsewhere a client could fake these headers to dodge the limit.
        request = make_request({"x-forwarded-for": "1.2.3.4", "x-real-ip": "1.2.3.4"}, client_host="10.0.0.1")
        with mock.patch.object(settings, "TRUST_PROXY_HEADERS", False):
            self.assertEqual(client_ip(request), "10.0.0.1")

    def test_behind_vercel_uses_the_visitor_ip_from_vercel_headers(self) -> None:
        with mock.patch.object(settings, "TRUST_PROXY_HEADERS", True):
            self.assertEqual(client_ip(make_request({"x-vercel-forwarded-for": "200.1.1.1", "x-real-ip": "9.9.9.9"})), "200.1.1.1")
            self.assertEqual(client_ip(make_request({"x-real-ip": "200.2.2.2"})), "200.2.2.2")
            self.assertEqual(client_ip(make_request({"x-forwarded-for": "200.3.3.3, 10.1.1.1"})), "200.3.3.3")
            # No proxy header at all: fall back to the socket address.
            self.assertEqual(client_ip(make_request({}, client_host="10.0.0.7")), "10.0.0.7")

    def test_different_visitors_get_different_keys_behind_the_proxy(self) -> None:
        with mock.patch.object(settings, "TRUST_PROXY_HEADERS", True):
            first = client_ip(make_request({"x-vercel-forwarded-for": "200.1.1.1"}, client_host="10.0.0.1"))
            second = client_ip(make_request({"x-vercel-forwarded-for": "200.9.9.9"}, client_host="10.0.0.1"))
        self.assertNotEqual(first, second)

    def test_trust_proxy_headers_is_off_by_default(self) -> None:
        self.assertFalse(type(settings).model_fields["TRUST_PROXY_HEADERS"].default)


class EngineOptionsTestCase(unittest.TestCase):
    def test_vercel_uses_no_pool_in_the_function(self) -> None:
        self.assertEqual(engine_options({"VERCEL": "1"}), {"poolclass": NullPool})

    def test_elsewhere_keeps_the_pool_with_pre_ping(self) -> None:
        self.assertEqual(engine_options({}), {"pool_pre_ping": True})


class VercelProjectFilesTestCase(unittest.TestCase):
    def test_function_runs_in_sao_paulo_and_python_is_pinned(self) -> None:
        config = json.loads((BACKEND_DIR / "vercel.json").read_text(encoding="utf-8"))
        self.assertEqual(config["regions"], ["gru1"])
        self.assertEqual((BACKEND_DIR / ".python-version").read_text(encoding="utf-8").strip(), "3.12")

    def test_entrypoint_is_where_vercel_looks_for_it(self) -> None:
        self.assertIn("app = FastAPI(", (BACKEND_DIR / "app" / "main.py").read_text(encoding="utf-8"))

    def test_local_only_files_are_not_bundled(self) -> None:
        ignored = (BACKEND_DIR / ".vercelignore").read_text(encoding="utf-8").split()
        for pattern in (".venv/", "tests/", ".env"):
            self.assertIn(pattern, ignored)


if __name__ == "__main__":
    unittest.main()
