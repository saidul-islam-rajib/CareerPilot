from typing import Annotated

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse, Response

from careerpilot.academic.enums import DraftKind, UserAction
from careerpilot.academic.models import (
    ActionBody,
    ConsentBody,
    CredentialInput,
    DraftBody,
    EvidenceBody,
    ExamInput,
    FromOpportunity,
    OutreachInput,
    OutreachSettings,
    ProgramInput,
    RecommendationInput,
    RefereeInput,
    ReplyBody,
    SentBody,
)
from careerpilot.api.common import no_content, ok
from careerpilot.api.dependencies import CurrentUser, Services

router = APIRouter(prefix="/v1/academic")
IDS_SEPARATOR = ","


@router.get("/reference")
def reference(_: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.reference)


@router.get("/overview")
def overview(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.overview.build(user.id))


@router.get("/programs")
def list_programs(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.programs.items(user.id))


@router.post("/programs")
def create_program(body: ProgramInput, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.programs.create(user.id, body))


@router.post("/programs/from-opportunity")
def program_from_opportunity(body: FromOpportunity, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.programs.from_opportunity(user.id, body.opportunity_id))


@router.get("/programs/{program_id}")
def get_program(program_id: str, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.programs.get(user.id, program_id))


@router.put("/programs/{program_id}")
def update_program(program_id: str, body: ProgramInput, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.programs.update(user.id, program_id, body))


@router.delete("/programs/{program_id}")
def delete_program(program_id: str, user: CurrentUser, services: Services) -> Response:
    services.academic.programs.remove(user.id, program_id)
    return no_content()


@router.get("/programs/{program_id}/plan")
def program_plan(program_id: str, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.programs.plan(user.id, program_id))


@router.post("/programs/{program_id}/decision/actions")
def decision_action(program_id: str, body: ActionBody, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.programs.record_action(user.id, program_id, body))


@router.get("/programs/{program_id}/decision/message")
def decision_message(program_id: str, action: UserAction, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.programs.message(user.id, program_id, action))


@router.post("/programs/{program_id}/checklist")
def generate_checklist(program_id: str, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.programs.generate_checklist(user.id, program_id))


@router.get("/offers/compare")
def compare_offers(user: CurrentUser, services: Services, ids: Annotated[str | None, Query()] = None) -> JSONResponse:
    wanted = [part for part in (ids or "").split(IDS_SEPARATOR) if part]
    return JSONResponse([row.to_json() for row in services.academic.programs.compare(user.id, wanted)])


@router.get("/tests")
def list_tests(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.exams.items(user.id))


@router.post("/tests")
def create_test(body: ExamInput, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.exams.create(user.id, body))


@router.put("/tests/{exam_id}")
def update_test(exam_id: str, body: ExamInput, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.exams.update(user.id, exam_id, body))


@router.delete("/tests/{exam_id}")
def delete_test(exam_id: str, user: CurrentUser, services: Services) -> Response:
    services.academic.exams.remove(user.id, exam_id)
    return no_content()


@router.get("/credentials")
def list_credentials(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.credentials.items(user.id))


@router.post("/credentials")
def create_credential(body: CredentialInput, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.credentials.create(user.id, body))


@router.put("/credentials/{credential_id}")
def update_credential(credential_id: str, body: CredentialInput, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.credentials.update(user.id, credential_id, body))


@router.delete("/credentials/{credential_id}")
def delete_credential(credential_id: str, user: CurrentUser, services: Services) -> Response:
    services.academic.credentials.remove(user.id, credential_id)
    return no_content()


@router.get("/referees")
def list_referees(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.referees.items(user.id))


@router.post("/referees")
def create_referee(body: RefereeInput, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.referees.create(user.id, body))


@router.put("/referees/{referee_id}")
def update_referee(referee_id: str, body: RefereeInput, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.referees.update(user.id, referee_id, body))


@router.put("/referees/{referee_id}/consent")
def set_consent(referee_id: str, body: ConsentBody, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.referees.set_consent(user.id, referee_id, body.confirmed))


@router.delete("/referees/{referee_id}")
def delete_referee(referee_id: str, user: CurrentUser, services: Services) -> Response:
    services.academic.referees.remove(user.id, referee_id)
    return no_content()


@router.get("/recommendations")
def list_recommendations(
    user: CurrentUser, services: Services, program_id: Annotated[str | None, Query(alias="programId")] = None
) -> JSONResponse:
    return ok(services.academic.referees.recommendations(user.id, program_id))


@router.post("/recommendations")
def create_recommendation(body: RecommendationInput, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.referees.add_recommendation(user.id, body))


@router.put("/recommendations/{recommendation_id}")
def update_recommendation(recommendation_id: str, body: RecommendationInput, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.referees.update_recommendation(user.id, recommendation_id, body))


@router.post("/recommendations/{recommendation_id}/status")
def recommendation_status(recommendation_id: str, body: EvidenceBody, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.referees.record_status(user.id, recommendation_id, body))


@router.get("/recommendations/{recommendation_id}/draft")
def recommendation_draft(
    recommendation_id: str, user: CurrentUser, services: Services, kind: DraftKind = DraftKind.REQUEST
) -> JSONResponse:
    return ok(services.academic.referees.draft(user.id, recommendation_id, kind))


@router.delete("/recommendations/{recommendation_id}")
def delete_recommendation(recommendation_id: str, user: CurrentUser, services: Services) -> Response:
    services.academic.referees.remove_recommendation(user.id, recommendation_id)
    return no_content()


@router.get("/settings")
def get_settings(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.outreach.settings(user.id))


@router.put("/settings")
def update_settings(body: OutreachSettings, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.outreach.update_settings(user.id, body))


@router.get("/outreach")
def list_outreach(user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.outreach.items(user.id))


@router.post("/outreach")
def draft_outreach(body: DraftBody, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.outreach.draft(user.id, body))


@router.put("/outreach/{outreach_id}")
def update_outreach(outreach_id: str, body: OutreachInput, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.outreach.update(user.id, outreach_id, body))


@router.post("/outreach/{outreach_id}/sent")
def outreach_sent(outreach_id: str, body: SentBody, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.outreach.mark_sent(user.id, outreach_id, body.on))


@router.post("/outreach/{outreach_id}/reply")
def outreach_reply(outreach_id: str, body: ReplyBody, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.academic.outreach.record_reply(user.id, outreach_id, body))


@router.delete("/outreach/{outreach_id}")
def delete_outreach(outreach_id: str, user: CurrentUser, services: Services) -> Response:
    services.academic.outreach.remove(user.id, outreach_id)
    return no_content()
