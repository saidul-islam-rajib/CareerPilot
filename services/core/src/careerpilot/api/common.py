from collections.abc import Awaitable, Callable, Sequence
from http import HTTPStatus

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.security import HTTPAuthorizationCredentials

from careerpilot.candidate.services.auth import ClientInfo
from careerpilot.platform.config import Settings
from careerpilot.platform.errors import DomainError, ErrorCode
from careerpilot.platform.messages import translate
from careerpilot.platform.model import CamelModel

FORWARDED_FOR = "x-forwarded-for"
USER_AGENT = "user-agent"
PROBLEM_JSON = "application/problem+json"


def ok(model: CamelModel | Sequence[CamelModel] | dict[str, object]) -> JSONResponse:
    if isinstance(model, CamelModel):
        return JSONResponse(model.to_json())
    if isinstance(model, list):
        return JSONResponse([m.to_json() for m in model])
    return JSONResponse(model)


def no_content() -> Response:
    return Response(status_code=HTTPStatus.NO_CONTENT)


def problem(status: HTTPStatus, code: ErrorCode, detail: str | None = None) -> JSONResponse:
    body: dict[str, object] = {"type": "about:blank", "title": status.phrase, "status": status.value, "code": code.value}
    if detail:
        body["detail"] = detail
    return JSONResponse(body, status_code=status, media_type=PROBLEM_JSON)


async def domain_error_handler(_: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, DomainError)
    return problem(error.http_status, error.code, error.detail)


async def validation_error_handler(_: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, RequestValidationError)
    return problem(HTTPStatus.UNPROCESSABLE_ENTITY, ErrorCode.VALIDATION)


def configure(app: FastAPI, settings: Settings) -> None:
    app.add_exception_handler(DomainError, domain_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.http.cors_origins,
        allow_methods=["GET", "POST", "PUT", "PATCH"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.middleware("http")
    async def security_headers(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = "no-store"
        return response


def bearer_token(credentials: HTTPAuthorizationCredentials | None) -> str:
    if credentials is None or not credentials.credentials:
        raise DomainError(ErrorCode.UNAUTHORIZED)
    return credentials.credentials


def client_info(request: Request, settings: Settings) -> ClientInfo:
    forwarded = [part.strip() for part in request.headers.get(FORWARDED_FOR, "").split(",") if part.strip()]
    hops = settings.http.trusted_proxy_hops
    ip = forwarded[-hops] if hops and len(forwarded) >= hops else (request.client.host if request.client else "")
    return ClientInfo(
        ip=ip,
        device=request.headers.get(USER_AGENT) or translate("activity.unknownDevice"),
        approximate_location=translate("activity.unknownLocation"),
    )
