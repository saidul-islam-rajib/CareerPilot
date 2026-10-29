from importlib.metadata import version
from typing import Annotated

from fastapi import APIRouter, FastAPI, Query, Request
from fastapi.responses import JSONResponse, Response

from careerpilot.administration.models import NewUserSource
from careerpilot.api import profile_routes
from careerpilot.api.common import client_info, configure, no_content, ok
from careerpilot.api.dependencies import CurrentUser, Services
from careerpilot.api.instrumentation import instrument
from careerpilot.bootstrap import Container
from careerpilot.candidate.models import SubmissionWindow
from careerpilot.candidate.services.answers import AnswerDraft
from careerpilot.candidate.services.applications import TaskDraft
from careerpilot.candidate.services.auth import Registration
from careerpilot.platform.enums import (
    AnswerTopic,
    ApplicationFilter,
    ApplicationMode,
    OpportunityDecision,
    OutcomeStatus,
    PauseDuration,
    TaskKind,
    TaskStatus,
)
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
    consent: bool
    consent_documents: ConsentDocuments


class EmailBody(CamelModel):
    email: str


class AccountLinkBody(CamelModel):
    token: str


class CompleteLinkBody(CamelModel):
    token: str
    password: str


class FavoriteCompaniesBody(CamelModel):
    companies: list[str]


class ExcludedCountriesBody(CamelModel):
    countries: list[str]


class JobLinkBody(CamelModel):
    url: str


class DecisionBody(CamelModel):
    decision: OpportunityDecision


class AnswerBody(CamelModel):
    answer: str
    save_for_reuse: bool = False


class SavedAnswerBody(CamelModel):
    topic: AnswerTopic
    question: str
    answer: str

    def draft(self) -> AnswerDraft:
        return AnswerDraft(topic=self.topic, question=self.question, answer=self.answer)


class OutcomeBody(CamelModel):
    outcome: OutcomeStatus
    note: str | None = None


class TaskBody(CamelModel):
    kind: TaskKind
    title: str
    due_at: str | None = None
    location: str = ""
    notes: str = ""

    def draft(self) -> TaskDraft:
        return TaskDraft(kind=self.kind, title=self.title, due_at=self.due_at, location=self.location, notes=self.notes)


class TaskStatusBody(CamelModel):
    status: TaskStatus


class NotificationsBody(CamelModel):
    digest_enabled: bool | None = None
    digest_time: str | None = None


class PasswordBody(CamelModel):
    current_password: str
    new_password: str


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
def register(body: RegisterBody, request: Request, services: Services) -> Response:
    registration = Registration(
        full_name=body.full_name,
        email=body.email,
        consent=body.consent,
        terms_version=body.consent_documents.terms,
        privacy_version=body.consent_documents.privacy,
    )
    services.auth.register(registration, client_info(request, services.settings))
    return no_content()


@router.post("/auth/password-reset")
def password_reset(body: EmailBody, request: Request, services: Services) -> Response:
    services.auth.request_password_reset(body.email, client_info(request, services.settings))
    return no_content()


@router.post("/auth/account-links/inspect")
def inspect_account_link(body: AccountLinkBody, request: Request, services: Services) -> JSONResponse:
    return ok(services.auth.inspect_link(body.token, client_info(request, services.settings)))


@router.post("/auth/account-links/complete")
def complete_account_link(body: CompleteLinkBody, request: Request, services: Services) -> JSONResponse:
    return ok(services.auth.complete_link(body.token, body.password, client_info(request, services.settings)))


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


@router.post("/opportunities/by-link")
def add_job_by_link(body: JobLinkBody, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.job_links.add(user.id, body.url))


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
    return ok(services.approvals.update_answer(user.id, approval_id, answer_id, body.answer, body.save_for_reuse))


@router.get("/answers")
def question_bank(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.answers.bank(user.id))


@router.post("/answers")
def add_saved_answer(body: SavedAnswerBody, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.answers.save(user.id, body.draft()))


@router.put("/answers/{answer_id}")
def edit_saved_answer(answer_id: str, body: SavedAnswerBody, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.answers.save(user.id, body.draft(), answer_id))


@router.delete("/answers/{answer_id}")
def remove_saved_answer(answer_id: str, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.answers.remove(user.id, answer_id))


@router.post("/answers/{answer_id}/restore")
def restore_saved_answer(answer_id: str, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.answers.restore(user.id, answer_id))


@router.get("/sources")
def my_sources(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.user_sources.mine(user.id))


@router.post("/sources")
def add_my_source(body: NewUserSource, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.user_sources.add(user.id, body))


@router.get("/sources/{source_id}/jobs")
def my_source_jobs(source_id: str, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.user_sources.jobs(user.id, source_id))


@router.post("/sources/{source_id}/jobs/{listing_id}")
def save_my_source_job(source_id: str, listing_id: str, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.user_sources.save_job(user.id, source_id, listing_id))


@router.delete("/sources/{source_id}")
def remove_my_source(source_id: str, user: CurrentUser, services: Services) -> Response:
    services.user_sources.remove(user.id, source_id)
    return no_content()


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


@router.put("/applications/{application_id}/outcome")
def update_outcome(application_id: str, body: OutcomeBody, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.applications.update_outcome(user.id, application_id, body.outcome, body.note))


@router.post("/applications/{application_id}/tasks")
def add_task(application_id: str, body: TaskBody, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.applications.add_task(user.id, application_id, body.draft()))


@router.put("/applications/{application_id}/tasks/{task_id}")
def edit_task(application_id: str, task_id: str, body: TaskBody, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.applications.edit_task(user.id, application_id, task_id, body.draft()))


@router.put("/applications/{application_id}/tasks/{task_id}/status")
def set_task_status(application_id: str, task_id: str, body: TaskStatusBody, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.applications.set_task_status(user.id, application_id, task_id, body.status))


@router.get("/applications/{application_id}")
def application(application_id: str, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.applications.get(user.id, application_id))


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


@router.patch("/settings/notifications")
def update_notifications(body: NotificationsBody, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.preferences.update_notifications(user.id, body.digest_enabled, body.digest_time))


@router.put("/settings/submission-window")
def submission_window(body: SubmissionWindow, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.preferences.update_submission_window(user.id, body))


@router.put("/settings/favorite-companies")
def favorite_companies(body: FavoriteCompaniesBody, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.preferences.update_favorite_companies(user.id, body.companies))


@router.put("/settings/excluded-countries")
def excluded_countries(body: ExcludedCountriesBody, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.preferences.update_excluded_countries(user.id, body.countries))


@router.get("/account/sign-in-activity")
def sign_in_activity(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.preferences.sign_in_activity(user.id))


@router.post("/account/password")
def change_password(body: PasswordBody, user: CurrentUser, services: Services) -> Response:
    services.auth.change_password(user.id, body.current_password, body.new_password)
    return no_content()


@router.post("/account/deletion")
def deletion(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.preferences.request_account_deletion(user.id))


def create_user_app(container: Container) -> FastAPI:
    app = FastAPI(title=translate("app.name"), version=version(PACKAGE), openapi_url=f"{PREFIX}/openapi.json")
    app.state.container = container
    configure(app, container.settings)
    app.include_router(router)
    app.include_router(profile_routes.router)
    instrument(app, container, container.settings.observability.user_api_service)
    return app
