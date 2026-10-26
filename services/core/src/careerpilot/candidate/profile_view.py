from collections.abc import Callable

from careerpilot.candidate.models import (
    CompletenessItem,
    Contact,
    DocumentVersion,
    EntryValue,
    PhotoCrop,
    Profile,
    ProfileDocument,
    StoredFile,
)
from careerpilot.platform.enums import DocumentKind
from careerpilot.platform.model import CamelModel

LinkFactory = Callable[[str, str], str]


class FileView(CamelModel):
    file_name: str
    content_type: str
    size_bytes: int
    uploaded_at: str
    url: str


class DocumentVersionView(FileView):
    version: int


class ProfileDocumentView(CamelModel):
    id: str
    name: str
    kind: DocumentKind
    position: int
    version: int
    updated_at: str
    file: DocumentVersionView
    versions: list[DocumentVersionView]


class ProfileEntryView(CamelModel):
    id: str
    position: int
    values: dict[str, EntryValue]
    updated_at: str


class ProfileView(CamelModel):
    id: str
    full_name: str
    headline: str
    location: str
    summary: str
    photo_url: str | None = None
    photo_crop: PhotoCrop | None = None
    signature_url: str | None = None
    completeness: int
    completeness_items: list[CompletenessItem]
    contacts: list[Contact]
    skills: list[str]
    sections: dict[str, list[ProfileEntryView]]
    documents: list[ProfileDocumentView]


def _file(stored: StoredFile, link: LinkFactory) -> FileView:
    return FileView(
        file_name=stored.file_name,
        content_type=stored.content_type,
        size_bytes=stored.size_bytes,
        uploaded_at=stored.uploaded_at,
        url=link(stored.key, stored.file_name),
    )


def _version(version: DocumentVersion, link: LinkFactory) -> DocumentVersionView:
    return DocumentVersionView(**_file(version, link).model_dump(), version=version.version)


def _document(document: ProfileDocument, link: LinkFactory) -> ProfileDocumentView:
    versions = [_version(v, link) for v in reversed(document.versions)]
    return ProfileDocumentView(
        id=document.id,
        name=document.name,
        kind=document.kind,
        position=document.position,
        version=document.current.version,
        updated_at=document.updated_at,
        file=versions[0],
        versions=versions,
    )


def present_profile(profile: Profile, score: int, items: list[CompletenessItem], link: LinkFactory) -> ProfileView:
    return ProfileView(
        id=profile.id,
        full_name=profile.full_name,
        headline=profile.headline,
        location=profile.location,
        summary=profile.summary,
        photo_url=link(profile.photo.key, profile.photo.file_name) if profile.photo else profile.photo_url,
        photo_crop=profile.photo_crop if profile.has_photo() else None,
        signature_url=profile.signature_url,
        completeness=score,
        completeness_items=items,
        contacts=[c.model_copy(update={"deleted_at": None}) for c in profile.active_contacts()],
        skills=list(profile.skills),
        sections={
            key: [
                ProfileEntryView(id=e.id, position=e.position, values=e.values, updated_at=e.updated_at)
                for e in profile.active_entries(key)
            ]
            for key in profile.sections
        },
        documents=[_document(d, link) for d in profile.active_documents()],
    )
