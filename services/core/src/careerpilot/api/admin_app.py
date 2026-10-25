from importlib.metadata import version

from fastapi import APIRouter, FastAPI
from fastapi.responses import JSONResponse, Response

from careerpilot.api.common import configure, no_content, ok
from careerpilot.api.dependencies import CurrentAdmin, Paging, Services
from careerpilot.api.instrumentation import instrument
from careerpilot.bootstrap import Container
from careerpilot.platform.enums import AdminRole, EmergencyStopScope, OpportunityStatus, ThemeKey, UserAccountStatus
from careerpilot.platform.messages import translate
from careerpilot.platform.model import CamelModel

PREFIX = "/admin/v1"
PACKAGE = "careerpilot-core"
router = APIRouter(prefix=PREFIX)


class SignInBody(CamelModel):
    email: str
    password: str


class ReasonBody(CamelModel):
    reason: str = ""


class SourceUpdateBody(CamelModel):
    enabled: bool


class SettingsUpdateBody(CamelModel):
    active_theme: ThemeKey | None = None
    daily_application_cap: int | None = None
    approval_validity_days: int | None = None
    deletion_grace_days: int | None = None


class EmergencyStopBody(CamelModel):
    scope: EmergencyStopScope
    target: str | None = None
    reason: str


class AdminUpdateBody(CamelModel):
    role: AdminRole | None = None
    suspended: bool | None = None


@router.post("/auth/sign-in")
def sign_in(body: SignInBody, services: Services) -> JSONResponse:
    return ok(services.admin_auth.sign_in(body.email, body.password))


@router.post("/auth/sign-out")
def sign_out(_: CurrentAdmin) -> Response:
    return no_content()


@router.get("/dashboard")
def dashboard(admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.admin_dashboard.get(admin))


@router.get("/users")
def users(admin: CurrentAdmin, paging: Paging, services: Services) -> JSONResponse:
    return ok(services.admin_users.list(admin, paging))


@router.get("/users/{user_id}")
def user(user_id: str, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.admin_users.get(admin, user_id))


@router.post("/users/{user_id}/suspend")
def suspend(user_id: str, _: ReasonBody, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.admin_users.set_status(admin, user_id, UserAccountStatus.SUSPENDED, "user.suspended"))


@router.post("/users/{user_id}/reactivate")
def reactivate(user_id: str, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.admin_users.set_status(admin, user_id, UserAccountStatus.ACTIVE, "user.reactivated"))


@router.post("/users/{user_id}/pause-automation")
def pause_automation(user_id: str, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.admin_users.set_status(admin, user_id, UserAccountStatus.PAUSED, "user.automation_paused"))


@router.get("/opportunities")
def opportunities(admin: CurrentAdmin, paging: Paging, services: Services) -> JSONResponse:
    return ok(services.admin_catalog.opportunities(admin, paging))


@router.post("/opportunities/{opportunity_id}/flag")
def flag(opportunity_id: str, _: ReasonBody, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.admin_catalog.set_opportunity_status(admin, opportunity_id, OpportunityStatus.FLAGGED, "opportunity.flagged"))


@router.post("/opportunities/{opportunity_id}/expire")
def expire(opportunity_id: str, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.admin_catalog.set_opportunity_status(admin, opportunity_id, OpportunityStatus.EXPIRED, "opportunity.expired"))


@router.get("/sources")
def sources(admin: CurrentAdmin, paging: Paging, services: Services) -> JSONResponse:
    return ok(services.admin_catalog.sources(admin, paging))


@router.patch("/sources/{source_id}")
def update_source(source_id: str, body: SourceUpdateBody, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.admin_catalog.set_source_enabled(admin, source_id, body.enabled))


@router.post("/sources/{source_id}/check")
def check_source(source_id: str, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.admin_catalog.run_source_check(admin, source_id))


@router.get("/applications")
def applications(admin: CurrentAdmin, paging: Paging, services: Services) -> JSONResponse:
    return ok(services.admin_catalog.applications(admin, paging))


@router.post("/applications/{application_id}/cancel")
def cancel(application_id: str, _: ReasonBody, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.admin_catalog.cancel_application(admin, application_id))


@router.get("/settings")
def settings(admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.admin_settings.get(admin))


@router.patch("/settings")
def update_settings(body: SettingsUpdateBody, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.admin_settings.update(admin, body.model_dump(exclude_none=True)))


@router.post("/emergency-stop")
def start_stop(body: EmergencyStopBody, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.admin_settings.start_emergency_stop(admin, body.scope, body.reason, body.target))


@router.post("/emergency-stop/end")
def end_stop(admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.admin_settings.end_emergency_stop(admin))


@router.get("/audit")
def audit(admin: CurrentAdmin, paging: Paging, services: Services) -> JSONResponse:
    return ok(services.admin_audit.list(admin, paging))


@router.get("/admins")
def admins(admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.admin_accounts.list(admin))


@router.patch("/admins/{admin_id}")
def update_admin(admin_id: str, body: AdminUpdateBody, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.admin_accounts.update(admin, admin_id, body.role, body.suspended))


def create_admin_app(container: Container) -> FastAPI:
    app = FastAPI(title=translate("admin.appName"), version=version(PACKAGE), openapi_url=f"{PREFIX}/openapi.json")
    app.state.container = container
    configure(app, container.settings)
    app.include_router(router)
    instrument(app, container, container.settings.observability.admin_api_service)
    return app
