from importlib.metadata import version

from fastapi import APIRouter, FastAPI, Request
from fastapi.responses import JSONResponse, Response
from pydantic import StrictInt

from careerpilot.administration.models import NewSource, SourceDecision
from careerpilot.administration.user_records import AdminApplicationChange, AdminProfileChange
from careerpilot.api import admin_messaging_routes
from careerpilot.api.common import client_info, configure, no_content, ok
from careerpilot.api.dependencies import CurrentAdmin, Paging, Services
from careerpilot.api.instrumentation import instrument
from careerpilot.bootstrap import Container
from careerpilot.platform.enums import (
    AdminRole,
    ApplicationMode,
    EmergencyStopScope,
    OpportunityDecision,
    OpportunityStatus,
    ThemeKey,
    UserAccountStatus,
)
from careerpilot.platform.messages import translate
from careerpilot.platform.model import CamelModel

PREFIX = "/admin/v1"
PACKAGE = "careerpilot-core"
router = APIRouter(prefix=PREFIX)


class SignInBody(CamelModel):
    email: str
    password: str


class EmailBody(CamelModel):
    email: str


class LinkTokenBody(CamelModel):
    token: str


class CompleteLinkBody(CamelModel):
    token: str
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
    account_link_ttl_minutes: StrictInt | None = None
    max_sources_per_user: StrictInt | None = None


class EmergencyStopBody(CamelModel):
    scope: EmergencyStopScope
    target: str | None = None
    reason: str


class ArchiveBody(CamelModel):
    archived: bool


class JobDecisionBody(CamelModel):
    decision: OpportunityDecision | None = None


class TrackChangeBody(CamelModel):
    result_count: int | None = None
    mode: ApplicationMode | None = None


class AdminUpdateBody(CamelModel):
    role: AdminRole | None = None
    suspended: bool | None = None


@router.post("/auth/sign-in")
def sign_in(body: SignInBody, request: Request, services: Services) -> JSONResponse:
    return ok(services.admin_auth.sign_in(body.email, body.password, client_info(request, services.settings).ip))


@router.post("/auth/password-link")
def password_link(body: EmailBody, request: Request, services: Services) -> Response:
    services.admin_auth.request_password_link(body.email, client_info(request, services.settings).ip)
    return no_content()


@router.post("/auth/account-links/inspect")
def inspect_link(body: LinkTokenBody, request: Request, services: Services) -> JSONResponse:
    return ok(services.admin_auth.inspect_link(body.token, client_info(request, services.settings).ip))


@router.post("/auth/account-links/complete")
def complete_link(body: CompleteLinkBody, request: Request, services: Services) -> JSONResponse:
    return ok(services.admin_auth.complete_link(body.token, body.password, client_info(request, services.settings).ip))


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


@router.get("/users/{user_id}/record")
def user_record(user_id: str, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.user_records.record(admin, user_id))


@router.patch("/users/{user_id}/applications/{application_id}")
def change_user_application(
    user_id: str, application_id: str, body: AdminApplicationChange, admin: CurrentAdmin, services: Services
) -> JSONResponse:
    return ok(services.user_records.change_application(admin, user_id, application_id, body))


@router.post("/users/{user_id}/applications/{application_id}/archive")
def archive_user_application(user_id: str, application_id: str, body: ArchiveBody, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.user_records.archive_application(admin, user_id, application_id, body.archived))


@router.put("/users/{user_id}/jobs/{opportunity_id}/decision")
def user_job_decision(user_id: str, opportunity_id: str, body: JobDecisionBody, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.user_records.set_job_decision(admin, user_id, opportunity_id, body.decision))


@router.patch("/users/{user_id}/tracks/{track_id}")
def user_track(user_id: str, track_id: str, body: TrackChangeBody, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.user_records.update_track(admin, user_id, track_id, body.result_count, body.mode))


@router.post("/users/{user_id}/resume-automation")
def resume_automation(user_id: str, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.user_records.resume(admin, user_id))


@router.patch("/users/{user_id}/profile")
def user_profile(user_id: str, body: AdminProfileChange, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.user_records.update_profile(admin, user_id, body))


@router.post("/users/{user_id}/approvals/{approval_id}/reject")
def reject_user_approval(user_id: str, approval_id: str, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.user_records.reject_approval(admin, user_id, approval_id))


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


@router.get("/sources/suggestions")
def source_suggestions(admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.admin_catalog.suggested_sources(admin))


@router.get("/sources/requests")
def source_requests(admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.admin_catalog.source_requests(admin))


@router.post("/sources/{source_id}/review")
def review_source(source_id: str, body: SourceDecision, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.admin_catalog.review_source(admin, source_id, body))


@router.post("/sources")
def add_source(body: NewSource, admin: CurrentAdmin, services: Services) -> JSONResponse:
    return ok(services.admin_catalog.add_source(admin, body))


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
    app.include_router(admin_messaging_routes.router)
    app.include_router(admin_messaging_routes.files)
    instrument(app, container, container.settings.observability.admin_api_service)
    return app
