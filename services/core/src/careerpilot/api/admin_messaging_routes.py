from typing import Annotated

from fastapi import APIRouter, File, Request, UploadFile
from fastapi.responses import JSONResponse, Response

from careerpilot.api.common import ok
from careerpilot.api.dependencies import CurrentAdmin, Services
from careerpilot.api.messaging_routes import AttachmentFields, TextBody, new_attachment
from careerpilot.api.profile_routes import SignedQuery, download
from careerpilot.bootstrap import Container
from careerpilot.messaging.service import LinkFactory

router = APIRouter(prefix="/admin/v1")
files = APIRouter(prefix="/v1")
UploadedFile = Annotated[UploadFile, File()]


def links(request: Request, services: Container) -> LinkFactory:
    base_url = str(request.base_url)
    return lambda key, name: services.file_links.link(base_url, key, name)


@router.get("/users/{user_id}/messages")
def team_messages(user_id: str, admin: CurrentAdmin, request: Request, services: Services, before: str | None = None) -> JSONResponse:
    return ok(services.admin_messages.team_page(admin, user_id, before, links(request, services)))


@router.post("/users/{user_id}/messages")
def send_team_message(user_id: str, body: TextBody, admin: CurrentAdmin, request: Request, services: Services) -> JSONResponse:
    return ok(services.admin_messages.send(admin, user_id, body.text, None, links(request, services)))


@router.post("/users/{user_id}/attachments")
def send_team_attachment(user_id: str, form: AttachmentFields, admin: CurrentAdmin, request: Request, services: Services) -> JSONResponse:
    attachment = new_attachment(form, services)
    return ok(services.admin_messages.send(admin, user_id, form.text, attachment, links(request, services)))


@router.get("/users/{user_id}/connections")
def connections(user_id: str, admin: CurrentAdmin, request: Request, services: Services) -> JSONResponse:
    return ok(services.admin_messages.connections(admin, user_id, links(request, services)))


@router.get("/users/{user_id}/files")
def user_files(user_id: str, admin: CurrentAdmin, request: Request, services: Services) -> JSONResponse:
    return ok(services.admin_messages.files(admin, user_id, links(request, services)))


@router.get("/conversations/{conversation_id}/messages")
def conversation(
    conversation_id: str, admin: CurrentAdmin, request: Request, services: Services, before: str | None = None
) -> JSONResponse:
    return ok(services.admin_messages.conversation(admin, conversation_id, before, links(request, services)))


@files.get("/files/{key:path}")
def signed_file(query: SignedQuery, request: Request, services: Services) -> Response:
    return download(query, request, services)
