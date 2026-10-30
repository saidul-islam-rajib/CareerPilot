from dataclasses import dataclass
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse, Response

from careerpilot.api.common import no_content, ok
from careerpilot.api.dependencies import CurrentUser, Services
from careerpilot.api.profile_routes import read_upload
from careerpilot.bootstrap import Container
from careerpilot.candidate.models import UserSummary
from careerpilot.messaging.service import LinkFactory, NewAttachment, Sender
from careerpilot.platform.enums import DevicePlatform, MemberType, MessageKind
from careerpilot.platform.errors import validation_error
from careerpilot.platform.model import CamelModel

PREFIX = "/v1"
router = APIRouter(prefix=PREFIX)
UploadedFile = Annotated[UploadFile, File()]


class ReadBody(CamelModel):
    ids: list[str] | None = None


class StartBody(CamelModel):
    member_id: str


class TextBody(CamelModel):
    text: str


class ToggleBody(CamelModel):
    value: bool


class PushDeviceBody(CamelModel):
    token: str
    platform: DevicePlatform


class PushTokenBody(CamelModel):
    token: str


@dataclass(frozen=True)
class AttachmentForm:
    file: UploadFile
    kind: MessageKind
    text: str
    duration_seconds: int | None


def attachment_form(
    file: UploadedFile,
    kind: Annotated[MessageKind, Form()],
    text: Annotated[str, Form()] = "",
    duration_seconds: Annotated[int | None, Form(alias="durationSeconds")] = None,
) -> AttachmentForm:
    return AttachmentForm(file=file, kind=kind, text=text, duration_seconds=duration_seconds)


AttachmentFields = Annotated[AttachmentForm, Depends(attachment_form)]


def new_attachment(form: AttachmentForm, services: Container) -> NewAttachment:
    rule = services.settings.messaging.attachments.get(form.kind.value)
    if rule is None:
        raise validation_error("file_type")
    return NewAttachment(kind=form.kind, upload=read_upload(form.file, rule.max_bytes), duration_seconds=form.duration_seconds)


@dataclass(frozen=True)
class Chat:
    user: UserSummary
    services: Container
    link: LinkFactory

    @property
    def sender(self) -> Sender:
        return Sender(id=self.user.id, type=MemberType.USER, name=self.user.full_name)


def chat(user: CurrentUser, request: Request, services: Services) -> Chat:
    base_url = str(request.base_url)
    return Chat(user=user, services=services, link=lambda key, name: services.file_links.link(base_url, key, name))


Chatting = Annotated[Chat, Depends(chat)]


@router.get("/inbox")
def inbox(caller: Chatting) -> JSONResponse:
    return ok(caller.services.notifications.inbox(caller.user.id))


@router.get("/notifications")
def notifications(caller: Chatting) -> JSONResponse:
    return ok(caller.services.notifications.recent(caller.user.id))


@router.post("/notifications/read")
def read_notifications(body: ReadBody, caller: Chatting) -> Response:
    caller.services.notifications.read(caller.user.id, body.ids)
    return no_content()


@router.put("/push-devices")
def register_push_device(body: PushDeviceBody, caller: Chatting) -> Response:
    caller.services.notifications.register_device(caller.user.id, body.token, body.platform)
    return no_content()


@router.post("/push-devices/remove")
def unregister_push_device(body: PushTokenBody, caller: Chatting) -> Response:
    caller.services.notifications.unregister_device(caller.user.id, body.token)
    return no_content()


@router.get("/members")
def members(caller: Chatting, query: str = "") -> JSONResponse:
    return ok(caller.services.messaging.directory(caller.user.id, query, caller.link))


@router.get("/members/{member_id}")
def member(member_id: str, caller: Chatting) -> JSONResponse:
    return ok(caller.services.messaging.card(member_id, caller.link))


@router.put("/members/{member_id}/block")
def block(member_id: str, body: ToggleBody, caller: Chatting) -> Response:
    caller.services.messaging.block(caller.user.id, member_id, body.value)
    return no_content()


@router.put("/settings/discoverable")
def discoverable(body: ToggleBody, caller: Chatting) -> Response:
    caller.services.messaging.set_discoverable(caller.user.id, body.value)
    return no_content()


@router.get("/conversations")
def conversations(caller: Chatting) -> JSONResponse:
    return ok(caller.services.messaging.conversations(caller.user.id, caller.link))


@router.post("/conversations")
def start(body: StartBody, caller: Chatting) -> JSONResponse:
    return ok(caller.services.messaging.start(caller.user.id, body.member_id, caller.link))


@router.post("/conversations/team")
def team(caller: Chatting) -> JSONResponse:
    conversation = caller.services.messaging.team(caller.user.id)
    return ok(caller.services.messaging.messages(caller.user.id, conversation.id, None, caller.link).conversation)


@router.get("/conversations/{conversation_id}/messages")
def messages(conversation_id: str, caller: Chatting, before: str | None = None) -> JSONResponse:
    return ok(caller.services.messaging.messages(caller.user.id, conversation_id, before, caller.link))


@router.post("/conversations/{conversation_id}/messages")
def send_text(conversation_id: str, body: TextBody, caller: Chatting) -> JSONResponse:
    return ok(caller.services.messaging.send(caller.sender, conversation_id, body.text, None, caller.link))


@router.post("/conversations/{conversation_id}/attachments")
def send_file(conversation_id: str, form: AttachmentFields, caller: Chatting) -> JSONResponse:
    attachment = new_attachment(form, caller.services)
    return ok(caller.services.messaging.send(caller.sender, conversation_id, form.text, attachment, caller.link))


@router.post("/conversations/{conversation_id}/read")
def read(conversation_id: str, caller: Chatting) -> Response:
    caller.services.messaging.read(caller.user.id, conversation_id)
    return no_content()


@router.put("/conversations/{conversation_id}/mute")
def mute(conversation_id: str, body: ToggleBody, caller: Chatting) -> Response:
    caller.services.messaging.mute(caller.user.id, conversation_id, body.value)
    return no_content()


@router.post("/applications/{application_id}/submitted")
def record_submitted(application_id: str, caller: Chatting) -> JSONResponse:
    return ok(caller.services.applications.record_submitted(caller.user.id, application_id))
