from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from careerpilot.api.common import client_info, ok
from careerpilot.api.dependencies import CurrentAdmin, CurrentUser, Services
from careerpilot.platform.model import CamelModel
from careerpilot.privacy.enums import ConsentKind, ExportFormat, ExportKind, ReportPeriod
from careerpilot.privacy.exports import ExportSpec

router = APIRouter(prefix="/v1")
admin_router = APIRouter(prefix="/admin/v1")


class ExportBody(CamelModel):
    kind: ExportKind
    format: ExportFormat
    period: ReportPeriod | None = None
    date: str | None = None
    application_id: str | None = None
    password: str | None = None

    def spec(self) -> ExportSpec:
        return ExportSpec(self.kind, self.format, self.period, self.date, self.application_id, self.password)


class PasswordConfirmation(CamelModel):
    password: str


class ConsentBody(CamelModel):
    granted: bool


@router.get("/reports/{period}")
def report(period: ReportPeriod, user: CurrentUser, services: Services, date: str | None = None) -> JSONResponse:
    return ok(services.privacy.reports.build(user.id, period, date))


@router.post("/exports")
def request_export(body: ExportBody, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.privacy.exports.request(user.id, body.spec()))


@router.get("/exports")
def list_exports(user: CurrentUser, request: Request, services: Services) -> JSONResponse:
    return JSONResponse([view.to_json() for view in services.privacy.exports.history(user.id, str(request.base_url))])


@router.get("/exports/{export_id}")
def get_export(export_id: str, user: CurrentUser, request: Request, services: Services) -> JSONResponse:
    return ok(services.privacy.exports.get(user.id, export_id, str(request.base_url)))


@router.get("/account/deletion")
def deletion_status(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.privacy.deletion.view(user.id))


@router.post("/account/deletion")
def request_deletion(body: PasswordConfirmation, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.privacy.deletion.request(user.id, body.password))


@router.post("/account/deletion/cancel")
def cancel_deletion(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.privacy.deletion.cancel(user.id))


@router.get("/account/consents")
def consents(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.privacy.consents.overview(user.id))


@router.put("/account/consents/{kind}")
def update_consent(kind: ConsentKind, body: ConsentBody, user: CurrentUser, request: Request, services: Services) -> JSONResponse:
    return ok(services.privacy.consents.update(user.id, kind, body.granted, client_info(request, services.settings)))


@admin_router.get("/privacy/exports")
def admin_exports(admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.privacy.admin.exports(admin))


@admin_router.get("/privacy/deletions")
def admin_deletions(admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.privacy.admin.deletions(admin))


@admin_router.get("/users/{user_id}/consents")
def admin_consents(user_id: str, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.privacy.admin.consents(admin, user_id))
