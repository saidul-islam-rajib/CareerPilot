from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse, Response

from careerpilot.api.common import no_content, ok
from careerpilot.api.dependencies import CurrentUser, Services, current_user
from careerpilot.platform.model import CamelModel
from careerpilot.writing.enums import WritingKind, WritingTone
from careerpilot.writing.service import GenerateInput

router = APIRouter(prefix="/v1/writing")


class GenerateBody(CamelModel):
    kind: WritingKind
    opportunity_id: str
    tone: WritingTone | None = None
    max_words: int | None = None
    instructions: str = ""

    def to_input(self) -> GenerateInput:
        return GenerateInput(self.kind, self.opportunity_id, self.tone, self.max_words, self.instructions)


class EditBody(CamelModel):
    text: str


class ApprovalBody(CamelModel):
    approval_id: str


@router.get("/status", dependencies=[Depends(current_user)])
def status(services: Services) -> JSONResponse:
    return ok(services.writing.status())


@router.get("/drafts")
def list_drafts(
    user: CurrentUser,
    services: Services,
    opportunity_id: Annotated[str | None, Query(alias="opportunityId")] = None,
    kind: WritingKind | None = None,
) -> JSONResponse:
    return ok(services.writing.drafts(user.id, opportunity_id, kind))


@router.post("/drafts")
def generate(body: GenerateBody, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.writing.generate(user.id, body.to_input()))


@router.get("/drafts/{draft_id}")
def get_draft(draft_id: str, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.writing.get(user.id, draft_id))


@router.put("/drafts/{draft_id}")
def edit_draft(draft_id: str, body: EditBody, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.writing.edit(user.id, draft_id, body.text))


@router.delete("/drafts/{draft_id}")
def remove_draft(draft_id: str, user: CurrentUser, services: Services) -> Response:
    services.writing.remove(user.id, draft_id)
    return no_content()


@router.post("/drafts/{draft_id}/check")
def recheck(draft_id: str, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.writing.recheck(user.id, draft_id))


@router.post("/drafts/{draft_id}/strip-flagged")
def strip_flagged(draft_id: str, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.writing.strip_flagged(user.id, draft_id))


@router.post("/drafts/{draft_id}/attach")
def attach(draft_id: str, body: ApprovalBody, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.writing.attach(user.id, draft_id, body.approval_id))


@router.post("/drafts/{draft_id}/detach")
def detach(draft_id: str, body: ApprovalBody, user: CurrentUser, services: Services) -> JSONResponse:
    return ok(services.writing.detach(user.id, draft_id, body.approval_id))
