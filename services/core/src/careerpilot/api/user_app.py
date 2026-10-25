from importlib.metadata import version
from typing import Annotated

from fastapi import APIRouter, FastAPI, Query, Request
from fastapi.responses import JSONResponse, Response

from careerpilot.api.common import client_info, configure, no_content, ok
from careerpilot.api.dependencies import CurrentUser, Services
from careerpilot.api.instrumentation import instrument
from careerpilot.bootstrap import Container
from careerpilot.candidate.models import SubmissionWindow
from careerpilot.candidate.services.auth import Registration
from careerpilot.platform.enums import ApplicationFilter, ApplicationMode, OpportunityDecision, PauseDuration
from careerpilot.platform.messages import translate
from careerpilot.platform.model import CamelModel

PREFIX = "/v1"
PACKAGE = "careerpilot-core"
router = APIRouter(prefix=PREFIX)


class SignInBody(CamelModel):
    email: str
    password: str


class ConsentDocuments(CamelModel):
    terms: str
    privacy: str


class RegisterBody(CamelModel):
    full_name: str
    email: str
    password: str
    consent: bool
    consent_documents: ConsentDocuments


class EmailBody(CamelModel):
    email: str


class DecisionBody(CamelModel):
    decision: OpportunityDecision


class AnswerBody(CamelModel):
    answer: str


class ContactOrderBody(CamelModel):
    ordered_ids: list[str]


class TrackUpdateBody(CamelModel):
    result_count: int | None = None
    mode: ApplicationMode | None = None


class PauseBody(CamelModel):
    duration: PauseDuration
    amount: int | None = None


@router.post("/auth/sign-in")
def sign_in(body: SignInBody, request: Request, services: Services) -> JSONResponse:
    return ok(services.auth.sign_in(body.email, body.password, client_info(request, services.settings)))


@router.post("/auth/register")
def register(body: RegisterBody, request: Request, services: Services) -> JSONResponse:
    registration = Registration(
        full_name=body.full_name,
        email=body.email,
        password=body.password,
        consent=body.consent,
        terms_version=body.consent_documents.terms,
        privacy_version=body.consent_documents.privacy,
    )
    return ok(services.auth.register(registration, client_info(request, services.settings)))


@router.post("/auth/password-reset")
def password_reset(body: EmailBody, services: Services) -> Response:
    services.auth.request_password_reset(body.email)
    return no_content()


@router.post("/auth/sign-out")
def sign_out(_: CurrentUser) -> Response:
    return no_content()


@router.get("/config")
def public_config(services: Services) -> JSONResponse:
    return ok(services.public_config.get())


@router.get("/dashboard")
def dashboard(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.dashboard.get(user.id))


@router.get("/opportunities/{opportunity_id}")
def opportunity(opportunity_id: str, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.opportunities.detail(user.id, opportunity_id))


@router.put("/opportunities/{opportunity_id}/decision")
def decide(opportunity_id: str, body: DecisionBody, user: CurrentUser, services: Services) -> Response:
    services.opportunities.decide(user.id, opportunity_id, body.decision)
    return no_content()


@router.post("/opportunities/{opportunity_id}/applications")
def prepare(opportunity_id: str, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.approvals.prepare(user.id, opportunity_id))


@router.get("/approvals")
def approvals(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.approvals.list_pending(user.id))


@router.get("/approvals/{approval_id}")
def approval(approval_id: str, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.approvals.get(user.id, approval_id))


@router.put("/approvals/{approval_id}/answers/{answer_id}")
def update_answer(approval_id: str, answer_id: str, body: AnswerBody, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.approvals.update_answer(user.id, approval_id, answer_id, body.answer))


@router.post("/approvals/{approval_id}/approve")
def approve(approval_id: str, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.approvals.approve(user.id, approval_id))


@router.post("/approvals/{approval_id}/reject")
def reject(approval_id: str, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.approvals.reject(user.id, approval_id))


@router.get("/applications")
def applications(
    user: CurrentUser, services: Services, application_filter: Annotated[ApplicationFilter, Query(alias="filter")] = ApplicationFilter.ALL
) -> JSONResponse:
    return ok(services.applications.list(user.id, application_filter))


@router.get("/applications/{application_id}")
def application(application_id: str, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.applications.get(user.id, application_id))


@router.get("/profile")
def profile(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.profile.get(user.id))


@router.put("/profile/contacts/order")
def reorder_contacts(body: ContactOrderBody, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.profile.reorder_contacts(user.id, body.ordered_ids))


@router.post("/profile/contacts/{contact_id}/primary")
def primary_contact(contact_id: str, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.profile.set_primary_contact(user.id, contact_id))


@router.get("/settings")
def settings(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.preferences.get(user.id))


@router.patch("/settings/tracks/{track_id}")
def update_track(track_id: str, body: TrackUpdateBody, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.preferences.update_track(user.id, track_id, body.result_count, body.mode))


@router.post("/settings/pause")
def pause(body: PauseBody, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.preferences.pause(user.id, body.duration, body.amount))


@router.post("/settings/resume")
def resume(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.preferences.resume(user.id))


@router.put("/settings/submission-window")
def submission_window(body: SubmissionWindow, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.preferences.update_submission_window(user.id, body))


@router.get("/account/sign-in-activity")
def sign_in_activity(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.preferences.sign_in_activity(user.id))


@router.post("/account/deletion")
def deletion(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.preferences.request_account_deletion(user.id))


def create_user_app(container: Container) -> FastAPI:
    app = FastAPI(title=translate("app.name"), version=version(PACKAGE), openapi_url=f"{PREFIX}/openapi.json")
    app.state.container = container
    configure(app, container.settings)
    app.include_router(router)
    instrument(app, container, container.settings.observability.user_api_service)
    return app
