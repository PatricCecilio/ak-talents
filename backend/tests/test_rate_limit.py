import unittest
from unittest import mock

from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi.errors import RateLimitExceeded
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes import auth, jobs, public
from app.core.rate_limit import RATE_LIMIT_MESSAGE, limiter, rate_limit_exceeded_handler
from app.database.base import Base
from app.database.session import get_db

PUBLIC_APPLICATION = {
    "full_name": "Maria Souza",
    "email": "maria@example.com",
    "phone": "(41) 99999-0000",
    "city": "Curitiba",
    "neighborhood": "Centro",
    "privacy_accepted": True,
}


class FakeClientIPMiddleware:
    """Sets the client IP from a test header, as uvicorn --proxy-headers does from X-Forwarded-For."""

    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] == "http":
            for name, value in scope["headers"]:
                if name == b"x-test-client-ip":
                    scope["client"] = (value.decode(), 50000)
        await self.app(scope, receive, send)


class RateLimitTestCase(unittest.TestCase):
    def setUp(self) -> None:
        limiter.reset()
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=engine)
        SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

        def override_get_db():
            with SessionLocal() as db:
                yield db

        app = FastAPI()
        app.state.limiter = limiter
        app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
        app.include_router(auth.router, prefix="/auth")
        app.include_router(jobs.router, prefix="/jobs")
        app.include_router(public.router, prefix="/public")
        app.add_middleware(FakeClientIPMiddleware)
        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self) -> None:
        limiter.reset()

    def assert_limited_after(self, allowed: int, send) -> None:
        for attempt in range(allowed):
            self.assertNotEqual(send().status_code, 429, f"attempt {attempt + 1} should not be limited")
        response = send()
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json(), {"detail": RATE_LIMIT_MESSAGE})

    def test_login_is_limited_to_5_per_minute(self) -> None:
        self.assert_limited_after(
            5, lambda: self.client.post("/auth/login", json={"email": "x@example.com", "password": "errada123"})
        )

    def test_register_is_limited_to_10_per_hour(self) -> None:
        counter = iter(range(100))
        self.assert_limited_after(
            10,
            lambda: self.client.post(
                "/auth/register",
                json={"name": "Pessoa", "email": f"p{next(counter)}@example.com", "password": "senha-forte-1", "role": "candidate", "privacy_accepted": True},
            ),
        )

    def test_public_application_is_limited_to_10_per_hour(self) -> None:
        self.assert_limited_after(10, lambda: self.client.post("/jobs/vaga-inexistente/applications", json=PUBLIC_APPLICATION))

    def test_public_screening_is_limited_to_30_per_minute(self) -> None:
        self.assert_limited_after(30, lambda: self.client.get("/public/applications/token-invalido/screening"))

    def test_limits_are_per_client_ip(self) -> None:
        for _ in range(5):
            self.client.post("/auth/login", json={"email": "x@example.com", "password": "errada123"})
        self.assertEqual(
            self.client.post("/auth/login", json={"email": "x@example.com", "password": "errada123"}).status_code, 429
        )
        response = self.client.post(
            "/auth/login",
            json={"email": "x@example.com", "password": "errada123"},
            headers={"x-test-client-ip": "203.0.113.9"},
        )
        self.assertEqual(response.status_code, 401)

    def test_disabled_limiter_never_blocks(self) -> None:
        with mock.patch.object(limiter, "enabled", False):
            for _ in range(8):
                response = self.client.post("/auth/login", json={"email": "x@example.com", "password": "errada123"})
                self.assertEqual(response.status_code, 401)


if __name__ == "__main__":
    unittest.main()
