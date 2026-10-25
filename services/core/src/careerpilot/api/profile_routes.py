from dataclasses import dataclass
from typing import Annotated, Any
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse, Response

from careerpilot.api.common import ok
from careerpilot.api.dependencies import CurrentUser, Services
from careerpilot.bootstrap import Container
from careerpilot.candidate.models import Profile
from careerpilot.candidate.services.profile import BasicsChanges, ProfileService, Upload
from careerpilot.platform.enums import ContactKind, DocumentKind
from careerpilot.platform.errors import not_found
from careerpilot.platform.files import detect_content_type
from careerpilot.platform.model import CamelModel

PREFIX = "/v1"
OCTET_STREAM = "application/octet-stream"
CONTENT_DISPOSITION = "Content-Disposition"
OVERSIZE_MARGIN = 1
router = APIRouter(prefix=PREFIX)


class BasicsBody(CamelModel):
    full_name: str | None = None
    headline: str | None = None
    location: str | None = None
    summary: str | None = None


class ContactBody(CamelModel):
    kind: ContactKind
    value: str
    label: str = ""


class ContactUpdateBody(CamelModel):
    value: str | None = None
    label: str | None = None


class SkillsBody(CamelModel):
    skills: list[str]


class EntryBody(CamelModel):
    values: dict[str, Any]


class OrderBody(CamelModel):
    ordered_ids: list[str]


class DocumentUpdateBody(CamelModel):
    name: str | None = None
    kind: DocumentKind | None = None


UploadedFile = Annotated[UploadFile, File()]


def read_upload(file: UploadFile, max_bytes: int) -> Upload:
    return Upload(file_name=file.filename or "", data=file.file.read(max_bytes + OVERSIZE_MARGIN))


@dataclass(frozen=True)
class ProfileCaller:
    user_id: str
    base_url: str
    services: Container

    @property
    def profiles(self) -> ProfileService:
        return self.services.profile

    def respond(self, profile: Profile) -> JSONResponse:
        return ok(self.profiles.view(profile, self.base_url))


def profile_caller(user: CurrentUser, request: Request, services: Services) -> ProfileCaller:
    return ProfileCaller(user_id=user.id, base_url=str(request.base_url), services=services)


Caller = Annotated[ProfileCaller, Depends(profile_caller)]


@router.get("/profile")
def profile(caller: Caller) -> JSONResponse:
    return caller.respond(caller.profiles.get(caller.user_id))


@router.patch("/profile")
def update_basics(body: BasicsBody, caller: Caller) -> JSONResponse:
    changes = BasicsChanges(full_name=body.full_name, headline=body.headline, location=body.location, summary=body.summary)
    return caller.respond(caller.profiles.update_basics(caller.user_id, changes))


@router.put("/profile/photo")
def set_photo(file: UploadedFile, caller: Caller) -> JSONResponse:
    upload = read_upload(file, caller.services.settings.profile.uploads.max_photo_bytes)
    return caller.respond(caller.profiles.set_photo(caller.user_id, upload))


@router.delete("/profile/photo")
def remove_photo(caller: Caller) -> JSONResponse:
    return caller.respond(caller.profiles.remove_photo(caller.user_id))


@router.post("/profile/contacts")
def add_contact(body: ContactBody, caller: Caller) -> JSONResponse:
    return caller.respond(caller.profiles.add_contact(caller.user_id, body.kind, body.value, body.label))


@router.put("/profile/contacts/order")
def reorder_contacts(body: OrderBody, caller: Caller) -> JSONResponse:
    return caller.respond(caller.profiles.reorder_contacts(caller.user_id, body.ordered_ids))


@router.patch("/profile/contacts/{contact_id}")
def update_contact(contact_id: str, body: ContactUpdateBody, caller: Caller) -> JSONResponse:
    return caller.respond(caller.profiles.update_contact(caller.user_id, contact_id, body.value, body.label))


@router.delete("/profile/contacts/{contact_id}")
def remove_contact(contact_id: str, caller: Caller) -> JSONResponse:
    return caller.respond(caller.profiles.remove_contact(caller.user_id, contact_id))


@router.post("/profile/contacts/{contact_id}/restore")
def restore_contact(contact_id: str, caller: Caller) -> JSONResponse:
    return caller.respond(caller.profiles.restore_contact(caller.user_id, contact_id))


@router.post("/profile/contacts/{contact_id}/primary")
def primary_contact(contact_id: str, caller: Caller) -> JSONResponse:
    return caller.respond(caller.profiles.set_primary_contact(caller.user_id, contact_id))


@router.put("/profile/skills")
def set_skills(body: SkillsBody, caller: Caller) -> JSONResponse:
    return caller.respond(caller.profiles.set_skills(caller.user_id, body.skills))


@router.post("/profile/sections/{section}")
def add_entry(section: str, body: EntryBody, caller: Caller) -> JSONResponse:
    return caller.respond(caller.profiles.add_entry(caller.user_id, section, body.values))


@router.put("/profile/sections/{section}/order")
def reorder_entries(section: str, body: OrderBody, caller: Caller) -> JSONResponse:
    return caller.respond(caller.profiles.reorder_entries(caller.user_id, section, body.ordered_ids))


@router.patch("/profile/sections/{section}/{entry_id}")
def update_entry(section: str, entry_id: str, body: EntryBody, caller: Caller) -> JSONResponse:
    return caller.respond(caller.profiles.update_entry(caller.user_id, section, entry_id, body.values))


@router.delete("/profile/sections/{section}/{entry_id}")
def remove_entry(section: str, entry_id: str, caller: Caller) -> JSONResponse:
    return caller.respond(caller.profiles.remove_entry(caller.user_id, section, entry_id))


@router.post("/profile/sections/{section}/{entry_id}/restore")
def restore_entry(section: str, entry_id: str, caller: Caller) -> JSONResponse:
    return caller.respond(caller.profiles.restore_entry(caller.user_id, section, entry_id))


@router.post("/profile/documents")
def add_document(
    file: UploadedFile,
    caller: Caller,
    name: Annotated[str | None, Form()] = None,
    kind: Annotated[DocumentKind, Form()] = DocumentKind.CV,
) -> JSONResponse:
    upload = read_upload(file, caller.services.settings.profile.uploads.max_document_bytes)
    return caller.respond(caller.profiles.add_document(caller.user_id, upload, name, kind))


@router.put("/profile/documents/order")
def reorder_documents(body: OrderBody, caller: Caller) -> JSONResponse:
    return caller.respond(caller.profiles.reorder_documents(caller.user_id, body.ordered_ids))


@router.post("/profile/documents/{document_id}/versions")
def add_document_version(document_id: str, file: UploadedFile, caller: Caller) -> JSONResponse:
    upload = read_upload(file, caller.services.settings.profile.uploads.max_document_bytes)
    return caller.respond(caller.profiles.add_document_version(caller.user_id, document_id, upload))


@router.patch("/profile/documents/{document_id}")
def update_document(document_id: str, body: DocumentUpdateBody, caller: Caller) -> JSONResponse:
    return caller.respond(caller.profiles.update_document(caller.user_id, document_id, body.name, body.kind))


@router.delete("/profile/documents/{document_id}")
def remove_document(document_id: str, caller: Caller) -> JSONResponse:
    return caller.respond(caller.profiles.remove_document(caller.user_id, document_id))


@router.post("/profile/documents/{document_id}/restore")
def restore_document(document_id: str, caller: Caller) -> JSONResponse:
    return caller.respond(caller.profiles.restore_document(caller.user_id, document_id))


@router.get("/files/{key:path}")
def download(key: str, expires: int, name: str, signature: str, services: Services) -> Response:
    if services.file_links.verify(key, expires, name, signature) is None:
        raise not_found("file")
    data = services.files.get(key)
    if data is None:
        raise not_found("file")
    disposition = f"inline; filename*=UTF-8''{quote(name)}"
    return Response(content=data, media_type=detect_content_type(data) or OCTET_STREAM, headers={CONTENT_DISPOSITION: disposition})
