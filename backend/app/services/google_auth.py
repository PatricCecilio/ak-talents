"""Verification of Google Identity Services ID tokens ("Sign in with Google").

The browser gets an ID token from Google's own button; the API checks it here and only then issues its own JWT.
No client secret is involved: the ID token flow needs only the public Client ID (the token's audience).
"""

from dataclasses import dataclass

from fastapi import HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.core import messages
from app.core.config import settings

GOOGLE_ISSUERS = ("accounts.google.com", "https://accounts.google.com")


@dataclass(frozen=True)
class GoogleIdentity:
    sub: str
    email: str
    name: str


# One transport per process: it keeps a session and google-auth caches Google's public certificates.
_transport = google_requests.Request()


def verify_google_credential(credential: str) -> GoogleIdentity:
    client_id = settings.GOOGLE_CLIENT_ID.strip()
    if not client_id:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=messages.GOOGLE_LOGIN_UNAVAILABLE)

    try:
        # Signature (Google's public keys), audience = our Client ID, expiry.
        claims = id_token.verify_oauth2_token(credential, _transport, audience=client_id)
    except Exception as exc:  # malformed, tampered, expired, wrong audience, keys unavailable...
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=messages.GOOGLE_TOKEN_INVALID) from exc

    if claims.get("iss") not in GOOGLE_ISSUERS:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=messages.GOOGLE_TOKEN_INVALID)
    if claims.get("email_verified") is not True:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=messages.GOOGLE_EMAIL_NOT_VERIFIED)

    sub = str(claims.get("sub") or "").strip()
    email = str(claims.get("email") or "").strip().lower()
    if not sub or not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=messages.GOOGLE_TOKEN_INVALID)

    name = str(claims.get("name") or "").strip() or email.split("@")[0]
    return GoogleIdentity(sub=sub, email=email, name=name)
