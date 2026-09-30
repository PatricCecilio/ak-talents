import hashlib
import secrets


def generate_public_token() -> str:
    return secrets.token_urlsafe(32)


def hash_public_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_appintelli_reference() -> str:
    return secrets.token_urlsafe(32)
