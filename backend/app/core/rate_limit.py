from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import settings

RATE_LIMIT_MESSAGE = "Muitas tentativas. Aguarde alguns minutos e tente novamente."

# Per client IP. Behind Render's proxy the real IP only reaches request.client when uvicorn runs
# with --proxy-headers (see render.yaml). Counters live in memory: fine for a single instance;
# a multi-instance deploy would need a shared storage_uri (e.g. Redis).
LOGIN_LIMIT = "5/minute;30/hour"
REGISTER_LIMIT = "10/hour"
# Generous on purpose: many mobile users share one public IP (carrier-grade NAT).
PUBLIC_APPLICATION_LIMIT = "10/hour;30/day"
# Screening tokens are 256-bit and unguessable; this only curbs abuse.
PUBLIC_SCREENING_LIMIT = "30/minute"

limiter = Limiter(key_func=get_remote_address, enabled=settings.RATE_LIMIT_ENABLED)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(status_code=429, content={"detail": RATE_LIMIT_MESSAGE})
