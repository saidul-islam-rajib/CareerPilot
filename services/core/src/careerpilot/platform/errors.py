from enum import StrEnum
from http import HTTPStatus


class ErrorCode(StrEnum):
    INVALID_CREDENTIALS = "invalid_credentials"
    EMAIL_TAKEN = "email_taken"
    UNAUTHORIZED = "unauthorized"
    FORBIDDEN = "forbidden"
    NOT_FOUND = "not_found"
    CONFLICT = "conflict"
    VALIDATION = "validation"
    TOO_MANY_ATTEMPTS = "too_many_attempts"
    SERVICE_UNAVAILABLE = "service_unavailable"


HTTP_STATUS_BY_CODE: dict[ErrorCode, HTTPStatus] = {
    ErrorCode.INVALID_CREDENTIALS: HTTPStatus.UNAUTHORIZED,
    ErrorCode.EMAIL_TAKEN: HTTPStatus.CONFLICT,
    ErrorCode.UNAUTHORIZED: HTTPStatus.UNAUTHORIZED,
    ErrorCode.FORBIDDEN: HTTPStatus.FORBIDDEN,
    ErrorCode.NOT_FOUND: HTTPStatus.NOT_FOUND,
    ErrorCode.CONFLICT: HTTPStatus.CONFLICT,
    ErrorCode.VALIDATION: HTTPStatus.UNPROCESSABLE_ENTITY,
    ErrorCode.TOO_MANY_ATTEMPTS: HTTPStatus.TOO_MANY_REQUESTS,
    ErrorCode.SERVICE_UNAVAILABLE: HTTPStatus.SERVICE_UNAVAILABLE,
}


class DomainError(Exception):
    def __init__(self, code: ErrorCode, detail: str | None = None) -> None:
        super().__init__(detail or code.value)
        self.code = code
        self.detail = detail

    @property
    def http_status(self) -> HTTPStatus:
        return HTTP_STATUS_BY_CODE[self.code]


def not_found(detail: str | None = None) -> DomainError:
    return DomainError(ErrorCode.NOT_FOUND, detail)


def conflict(detail: str | None = None) -> DomainError:
    return DomainError(ErrorCode.CONFLICT, detail)


def validation_error(detail: str | None = None) -> DomainError:
    return DomainError(ErrorCode.VALIDATION, detail)
