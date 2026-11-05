from fastapi import APIRouter
from fastapi.responses import JSONResponse, Response

from careerpilot.api.common import no_content, ok
from careerpilot.api.dependencies import CurrentAdmin, CurrentUser, Services
from careerpilot.platform.enums import AdminArea, PermissionAction
from careerpilot.platform.model import CamelModel
from careerpilot.portal.models import AccountInput, AutopilotInput, HostInput, ReadinessRequest, ResumeInput

router = APIRouter(prefix="/v1/portal")
admin_router = APIRouter(prefix="/admin/v1/portals")
HOST_AUDIT = "portal.host."
READINESS_AUDIT = "portal.readiness"


class AdminReadinessRequest(CamelModel):
    url: str
    user_id: str | None = None


@router.get("/autopilot")
def autopilot(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.portal.service.autopilot(user.id))


@router.put("/autopilot")
def enable_autopilot(body: AutopilotInput, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.portal.service.enable(user.id, body))


@router.delete("/autopilot")
def disable_autopilot(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.portal.service.disable(user.id))


@router.get("/accounts")
def accounts(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.portal.service.accounts(user.id))


@router.post("/accounts")
def add_account(body: AccountInput, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.portal.service.add_account(user.id, body))


@router.get("/accounts/export")
def export_accounts(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.portal.service.export_accounts(user.id))


@router.get("/accounts/{account_id}/secret")
def reveal_account(account_id: str, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.portal.service.reveal_account(user.id, account_id))


@router.delete("/accounts/{account_id}")
def delete_account(account_id: str, user: CurrentUser, services: Services) -> Response:
    services.portal.service.delete_account(user.id, account_id)
    return no_content()


@router.get("/applications/{application_id}/attempt")
def attempt(application_id: str, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.portal.service.attempt(user.id, application_id))


@router.post("/applications/{application_id}/resume")
def resume(application_id: str, body: ResumeInput, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.portal.service.resume(user.id, application_id, body))


@router.post("/applications/{application_id}/complete")
def complete(application_id: str, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.portal.service.complete(user.id, application_id))


@router.post("/readiness")
def request_readiness(body: ReadinessRequest, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.portal.readiness.request(user.id, body.url))


@router.get("/readiness")
def readiness_reports(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.portal.readiness.recent(user.id))


@router.get("/readiness/{report_id}")
def readiness_report(report_id: str, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.portal.readiness.get(user.id, report_id))


@admin_router.get("/hosts")
def hosts(admin: CurrentAdmin, services: Services) -> JSONResponse:
    admin.require(AdminArea.SOURCES, PermissionAction.READ)
    return ok(services.portal.service.hosts())


@admin_router.put("/hosts/{host}")
def decide_host(host: str, body: HostInput, admin: CurrentAdmin, services: Services) -> JSONResponse:
    admin.require(AdminArea.SOURCES, PermissionAction.UPDATE)
    record = services.portal.service.decide_host(host, body)
    admin.record(f"{HOST_AUDIT}{body.policy.value}", record.host)
    return ok(record)


@admin_router.post("/readiness")
def admin_request_readiness(body: AdminReadinessRequest, admin: CurrentAdmin, services: Services) -> JSONResponse:
    admin.require(AdminArea.SOURCES, PermissionAction.READ)
    report = services.portal.readiness.request(body.user_id or admin.summary.id, body.url)
    admin.record(READINESS_AUDIT, report.host)
    return ok(report)


@admin_router.get("/readiness/{user_id}/{report_id}")
def admin_readiness_report(user_id: str, report_id: str, admin: CurrentAdmin, services: Services) -> JSONResponse:
    admin.require(AdminArea.SOURCES, PermissionAction.READ)
    return ok(services.portal.readiness.get(user_id, report_id))
