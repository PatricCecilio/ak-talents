from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import settings

RATE_LIMIT_MESSAGE = "Muitas tentativas. Aguarde alguns minutos e tente novamente."

# Per client IP. Counters live in memory: per instance, so on serverless (Vercel) the limit is looser
# across instances/cold starts. For a shared limit, point slowapi at Redis (e.g. Upstash) via storage_uri.
LOGIN_LIMIT = "5/minute;30/hour"
REGISTER_LIMIT = "10/hour"
# Generous on purpose: many mobile users share one public IP (carrier-grade NAT).
PUBLIC_APPLICATION_LIMIT = "10/hour;30/day"
# Screening tokens are 256-bit and unguessable; this only curbs abuse.
PUBLIC_SCREENING_LIMIT = "30/minute"

# Headers set by Vercel's edge. Vercel overwrites them (clients cannot spoof them), so they are only
# trusted when TRUST_PROXY_HEADERS is on, i.e. when the API actually runs behind Vercel.
PROXY_IP_HEADERS = ("x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for")


def client_ip(request: Request) -> str:
    """Rate-limit key: the real visitor IP. Without this, behind a proxy every visitor would share one
    key (the proxy's IP) and a few failed logins by anyone would lock everybody out."""
    if settings.TRUST_PROXY_HEADERS:
        for header in PROXY_IP_HEADERS:
            value = request.headers.get(header, "").split(",")[0].strip()
            if value:
                return value
    return get_remote_address(request)


limiter = Limiter(key_func=client_ip, enabled=settings.RATE_LIMIT_ENABLED)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(status_code=429, content={"detail": RATE_LIMIT_MESSAGE})
