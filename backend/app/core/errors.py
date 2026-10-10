from fastapi import FastAPI, Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.messages import translate_default_detail, translate_validation_error


async def validation_error_in_portuguese(request: Request, exc: RequestValidationError) -> JSONResponse:
    # Same shape as FastAPI's default (a list in "detail"), with the message in Portuguese and without echoing the
    # submitted value back ("input" could be a password).
    errors = [
        {"type": error.get("type"), "loc": list(error.get("loc", ())), "msg": translate_validation_error(error)}
        for error in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": errors})


async def http_error_in_portuguese(request: Request, exc: StarletteHTTPException):
    # FastAPI/Starlette defaults ("Not authenticated", "Not Found"...) would otherwise reach the screen in English.
    exc.detail = translate_default_detail(exc.detail)
    return await http_exception_handler(request, exc)


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(RequestValidationError, validation_error_in_portuguese)
    app.add_exception_handler(StarletteHTTPException, http_error_in_portuguese)
