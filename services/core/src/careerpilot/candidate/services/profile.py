from collections.abc import Callable, Mapping
from dataclasses import dataclass
from pathlib import PurePath

from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.models import (
    CompletenessItem,
    Contact,
    DocumentVersion,
    Profile,
    ProfileDocument,
    ProfileEntry,
    StoredFile,
    UserSummary,
)
from careerpilot.candidate.ports import CandidateWorkspace
from careerpilot.candidate.profile_rules import FieldRules, as_mapping, clean_multiline, clean_text, normalize_skills, require_length
from careerpilot.candidate.profile_view import ProfileView, present_profile
from careerpilot.platform.clock import iso
from careerpilot.platform.config import ProfileConfig, ProfileSectionConfig
from careerpilot.platform.enums import CompletenessKind, ContactKind, DocumentKind
from careerpilot.platform.errors import conflict, not_found, validation_error
from careerpilot.platform.files import EXTENSIONS, FileLinkSigner, FileStorage, detect_content_type
from careerpilot.platform.messages import translate
from careerpilot.platform.validation import require_email, require_name

PERCENT = 100
FIRST_VERSION = 1
FIRST_POSITION = 1
FILE_NAME_FALLBACK = "document"
ACCOUNT_EMAIL_LABEL = "profile.accountEmailLabel"


@dataclass(frozen=True)
class Upload:
    file_name: str
    data: bytes


@dataclass(frozen=True)
class BasicsChanges:
    full_name: str | None = None
    headline: str | None = None
    location: str | None = None
    summary: str | None = None


def start_profile(profile: Profile, user: UserSummary, contact_id: str) -> None:
    profile.full_name = user.full_name
    profile.contacts = [
        Contact(
            id=contact_id,
            kind=ContactKind.EMAIL,
            value=user.email,
            label=translate(ACCOUNT_EMAIL_LABEL),
            is_primary=True,
            verified=False,
            position=FIRST_POSITION,
        )
    ]


def display_file_name(file_name: str, max_length: int) -> str:
    name = clean_text(PurePath(file_name.replace("\\", "/")).name)
    return name[:max_length] or FILE_NAME_FALLBACK


def completeness(profile: Profile, config: ProfileConfig) -> tuple[int, list[CompletenessItem]]:
    checks: dict[CompletenessKind, Callable[[], bool]] = {
        CompletenessKind.BASICS: lambda: bool(profile.full_name and profile.headline),
        CompletenessKind.PHOTO: lambda: profile.photo is not None or profile.photo_url is not None,
        CompletenessKind.CONTACTS: lambda: {c.kind for c in profile.active_contacts()} >= set(ContactKind),
        CompletenessKind.SKILLS: lambda: len(profile.skills) >= config.limits.min_skills_for_completeness,
        CompletenessKind.DOCUMENTS: lambda: any(d.kind is DocumentKind.CV for d in profile.active_documents()),
    }
    items = [
        CompletenessItem(
            key=rule.key,
            weight=rule.weight,
            done=bool(profile.active_entries(rule.section or "")) if rule.kind is CompletenessKind.SECTION else checks[rule.kind](),
        )
        for rule in config.completeness
    ]
    total = sum(i.weight for i in items) or PERCENT
    return round(PERCENT * sum(i.weight for i in items if i.done) / total), items


class ProfileService:
    def __init__(self, context: CandidateContext, storage: FileStorage, links: FileLinkSigner) -> None:
        self._ctx = context
        self._storage = storage
        self._links = links
        self._config = context.settings.profile

    def get(self, user_id: str) -> Profile:
        workspace = self._ctx.workspaces.get(user_id)
        account = self._ctx.accounts.get(user_id)
        if account is not None and not workspace.profile.full_name and not workspace.profile.contacts:
            start_profile(workspace.profile, account.user, self._ctx.ids.next("c"))
            workspace.profile.completeness = completeness(workspace.profile, self._config)[0]
            self._ctx.workspaces.save(user_id, workspace)
        return workspace.profile

    def view(self, profile: Profile, base_url: str) -> ProfileView:
        score, items = completeness(profile, self._config)
        return present_profile(profile, score, items, lambda key, name: self._links.link(base_url, key, name))

    def update_basics(self, user_id: str, changes: BasicsChanges) -> Profile:
        return self._mutate(user_id, lambda w: self._apply_basics(user_id, w, changes))

    def set_photo(self, user_id: str, upload: Upload) -> Profile:
        stored = self._store(upload, "photos", self._config.uploads.photo_types, self._config.uploads.max_photo_bytes)
        return self._mutate(user_id, lambda w: setattr(w.profile, "photo", stored))

    def remove_photo(self, user_id: str) -> Profile:
        def clear(workspace: CandidateWorkspace) -> None:
            workspace.profile.photo = None
            workspace.profile.photo_url = None

        return self._mutate(user_id, clear)

    def add_contact(self, user_id: str, kind: ContactKind, value: str, label: str) -> Profile:
        def add(workspace: CandidateWorkspace) -> None:
            profile = workspace.profile
            active = profile.active_contacts()
            if len(active) >= self._config.limits.max_contacts:
                raise validation_error("contacts")
            cleaned = self._contact_value(kind, value)
            if any(c.kind is kind and c.value == cleaned for c in active):
                raise conflict("contact_exists")
            profile.contacts.append(
                Contact(
                    id=self._ctx.ids.next("c"),
                    kind=kind,
                    value=cleaned,
                    label=self._label(label),
                    is_primary=not any(c.kind is kind for c in active),
                    verified=False,
                    position=self._next_position([c.position for c in active]),
                )
            )

        return self._mutate(user_id, add)

    def update_contact(self, user_id: str, contact_id: str, value: str | None, label: str | None) -> Profile:
        def update(workspace: CandidateWorkspace) -> None:
            contact = self._active_contact(workspace.profile, contact_id)
            changes: dict[str, object] = {}
            if value is not None:
                cleaned = self._contact_value(contact.kind, value)
                if cleaned != contact.value:
                    changes |= {"value": cleaned, "verified": False}
            if label is not None:
                changes["label"] = self._label(label)
            self._replace_contact(workspace.profile, contact.model_copy(update=changes))

        return self._mutate(user_id, update)

    def remove_contact(self, user_id: str, contact_id: str) -> Profile:
        def remove(workspace: CandidateWorkspace) -> None:
            contact = self._active_contact(workspace.profile, contact_id)
            self._replace_contact(workspace.profile, contact.model_copy(update={"deleted_at": self._now(), "is_primary": False}))
            self._ensure_primary(workspace.profile, contact.kind)

        return self._mutate(user_id, remove)

    def restore_contact(self, user_id: str, contact_id: str) -> Profile:
        def restore(workspace: CandidateWorkspace) -> None:
            profile = workspace.profile
            contact = next((c for c in profile.contacts if c.id == contact_id and c.deleted_at is not None), None)
            if contact is None:
                raise not_found("contact")
            position = self._next_position([c.position for c in profile.active_contacts()])
            self._replace_contact(profile, contact.model_copy(update={"deleted_at": None, "position": position}))
            self._ensure_primary(profile, contact.kind)

        return self._mutate(user_id, restore)

    def reorder_contacts(self, user_id: str, ordered_ids: list[str]) -> Profile:
        def reorder(workspace: CandidateWorkspace) -> None:
            profile = workspace.profile
            positions = self._positions([c.id for c in profile.active_contacts()], ordered_ids, "contact_order")
            profile.contacts = [c.model_copy(update={"position": positions[c.id]}) if c.id in positions else c for c in profile.contacts]

        return self._mutate(user_id, reorder)

    def set_primary_contact(self, user_id: str, contact_id: str) -> Profile:
        def make_primary(workspace: CandidateWorkspace) -> None:
            profile = workspace.profile
            target = self._active_contact(profile, contact_id)
            profile.contacts = [
                c.model_copy(update={"is_primary": c.id == contact_id}) if c.kind is target.kind and c.deleted_at is None else c
                for c in profile.contacts
            ]

        return self._mutate(user_id, make_primary)

    def set_skills(self, user_id: str, skills: list[str]) -> Profile:
        normalized = normalize_skills(skills, self._config.limits)
        return self._mutate(user_id, lambda w: setattr(w.profile, "skills", normalized))

    def add_entry(self, user_id: str, section_key: str, values: object) -> Profile:
        section = self._section(section_key)

        def add(workspace: CandidateWorkspace) -> None:
            active = workspace.profile.active_entries(section.key)
            if len(active) >= self._config.limits.max_entries_per_section:
                raise validation_error(section.key)
            entry = ProfileEntry(
                id=self._ctx.ids.next("pe"),
                position=self._next_position([e.position for e in active]),
                values=self._rules().section_values(section, as_mapping(values)),
                updated_at=self._now(),
            )
            workspace.profile.sections.setdefault(section.key, []).append(entry)

        return self._mutate(user_id, add)

    def update_entry(self, user_id: str, section_key: str, entry_id: str, values: object) -> Profile:
        section = self._section(section_key)

        def update(workspace: CandidateWorkspace) -> None:
            entry = self._active_entry(workspace.profile, section.key, entry_id)
            parsed = self._rules().section_values(section, as_mapping(values))
            self._replace_entry(workspace.profile, section.key, entry.model_copy(update={"values": parsed, "updated_at": self._now()}))

        return self._mutate(user_id, update)

    def remove_entry(self, user_id: str, section_key: str, entry_id: str) -> Profile:
        section = self._section(section_key)

        def remove(workspace: CandidateWorkspace) -> None:
            entry = self._active_entry(workspace.profile, section.key, entry_id)
            self._replace_entry(workspace.profile, section.key, entry.model_copy(update={"deleted_at": self._now()}))

        return self._mutate(user_id, remove)

    def restore_entry(self, user_id: str, section_key: str, entry_id: str) -> Profile:
        section = self._section(section_key)

        def restore(workspace: CandidateWorkspace) -> None:
            profile = workspace.profile
            entry = next((e for e in profile.sections.get(section.key, []) if e.id == entry_id and e.deleted_at is not None), None)
            if entry is None:
                raise not_found("entry")
            position = self._next_position([e.position for e in profile.active_entries(section.key)])
            self._replace_entry(profile, section.key, entry.model_copy(update={"deleted_at": None, "position": position}))

        return self._mutate(user_id, restore)

    def reorder_entries(self, user_id: str, section_key: str, ordered_ids: list[str]) -> Profile:
        section = self._section(section_key)

        def reorder(workspace: CandidateWorkspace) -> None:
            profile = workspace.profile
            positions = self._positions([e.id for e in profile.active_entries(section.key)], ordered_ids, "entry_order")
            profile.sections[section.key] = [
                e.model_copy(update={"position": positions[e.id]}) if e.id in positions else e
                for e in profile.sections.get(section.key, [])
            ]

        return self._mutate(user_id, reorder)

    def add_document(self, user_id: str, upload: Upload, name: str | None, kind: DocumentKind) -> Profile:
        stored = self._store_document(upload)

        def add(workspace: CandidateWorkspace) -> None:
            active = workspace.profile.active_documents()
            if len(active) >= self._config.limits.max_documents:
                raise validation_error("documents")
            workspace.profile.documents.append(
                ProfileDocument(
                    id=self._ctx.ids.next("doc"),
                    name=self._document_name(name or PurePath(stored.file_name).stem),
                    kind=kind,
                    position=self._next_position([d.position for d in active]),
                    versions=[DocumentVersion(**stored.model_dump(), version=FIRST_VERSION)],
                    updated_at=stored.uploaded_at,
                )
            )

        return self._mutate(user_id, add)

    def add_document_version(self, user_id: str, document_id: str, upload: Upload) -> Profile:
        stored = self._store_document(upload)

        def add_version(workspace: CandidateWorkspace) -> None:
            document = self._active_document(workspace.profile, document_id)
            version = DocumentVersion(**stored.model_dump(), version=document.current.version + 1)
            updated = document.model_copy(update={"versions": [*document.versions, version], "updated_at": stored.uploaded_at})
            self._replace_document(workspace.profile, updated)

        return self._mutate(user_id, add_version)

    def update_document(self, user_id: str, document_id: str, name: str | None, kind: DocumentKind | None) -> Profile:
        def update(workspace: CandidateWorkspace) -> None:
            document = self._active_document(workspace.profile, document_id)
            changes: dict[str, object] = {"updated_at": self._now()}
            if name is not None:
                changes["name"] = self._document_name(name)
            if kind is not None:
                changes["kind"] = kind
            self._replace_document(workspace.profile, document.model_copy(update=changes))

        return self._mutate(user_id, update)

    def remove_document(self, user_id: str, document_id: str) -> Profile:
        def remove(workspace: CandidateWorkspace) -> None:
            document = self._active_document(workspace.profile, document_id)
            self._replace_document(workspace.profile, document.model_copy(update={"deleted_at": self._now()}))

        return self._mutate(user_id, remove)

    def restore_document(self, user_id: str, document_id: str) -> Profile:
        def restore(workspace: CandidateWorkspace) -> None:
            profile = workspace.profile
            document = next((d for d in profile.documents if d.id == document_id and d.deleted_at is not None), None)
            if document is None:
                raise not_found("document")
            position = self._next_position([d.position for d in profile.active_documents()])
            self._replace_document(profile, document.model_copy(update={"deleted_at": None, "position": position}))

        return self._mutate(user_id, restore)

    def reorder_documents(self, user_id: str, ordered_ids: list[str]) -> Profile:
        def reorder(workspace: CandidateWorkspace) -> None:
            profile = workspace.profile
            positions = self._positions([d.id for d in profile.active_documents()], ordered_ids, "document_order")
            profile.documents = [d.model_copy(update={"position": positions[d.id]}) if d.id in positions else d for d in profile.documents]

        return self._mutate(user_id, reorder)

    def _mutate(self, user_id: str, change: Callable[[CandidateWorkspace], object]) -> Profile:
        workspace = self._ctx.workspaces.get(user_id)
        change(workspace)
        workspace.profile.completeness = completeness(workspace.profile, self._config)[0]
        self._ctx.workspaces.save(user_id, workspace)
        return workspace.profile

    def _apply_basics(self, user_id: str, workspace: CandidateWorkspace, changes: BasicsChanges) -> None:
        profile = workspace.profile
        limits = self._config.limits
        if changes.full_name is not None:
            profile.full_name = require_name(changes.full_name, self._ctx.settings.validation.name)
            self._sync_account_name(user_id, profile.full_name)
        if changes.headline is not None:
            profile.headline = require_length(clean_text(changes.headline), limits.headline_max_length, "headline")
        if changes.location is not None:
            profile.location = require_length(clean_text(changes.location), limits.location_max_length, "location")
        if changes.summary is not None:
            profile.summary = require_length(clean_multiline(changes.summary), limits.summary_max_length, "summary")

    def _sync_account_name(self, user_id: str, full_name: str) -> None:
        account = self._ctx.accounts.get(user_id)
        if account is not None and account.user.full_name != full_name:
            account.user = account.user.model_copy(update={"full_name": full_name})
            self._ctx.accounts.save(account)

    def _store_document(self, upload: Upload) -> StoredFile:
        return self._store(upload, "documents", self._config.uploads.document_types, self._config.uploads.max_document_bytes)

    def _store(self, upload: Upload, folder: str, accepted: list[str], max_bytes: int) -> StoredFile:
        if not upload.data:
            raise validation_error("file_empty")
        if len(upload.data) > max_bytes:
            raise validation_error("file_too_large")
        content_type = detect_content_type(upload.data)
        if content_type is None or content_type not in accepted:
            raise validation_error("file_type")
        key = f"{folder}/{self._ctx.ids.next('f').lower()}.{EXTENSIONS[content_type]}"
        self._storage.put(key, upload.data)
        return StoredFile(
            key=key,
            file_name=display_file_name(upload.file_name, self._config.limits.document_name_max_length),
            content_type=content_type,
            size_bytes=len(upload.data),
            uploaded_at=self._now(),
        )

    def _rules(self) -> FieldRules:
        return FieldRules(self._config.limits, self._ctx.settings.validation, self._ctx.clock.now())

    def _section(self, key: str) -> ProfileSectionConfig:
        section = self._config.section(key)
        if section is None:
            raise not_found("section")
        return section

    def _contact_value(self, kind: ContactKind, value: str) -> str:
        if kind is ContactKind.EMAIL:
            return require_email(value, self._ctx.settings.validation.email)
        return self._rules().phone(value, "phone")

    def _label(self, label: str) -> str:
        return require_length(clean_text(label), self._config.limits.contact_label_max_length, "label")

    def _document_name(self, name: str) -> str:
        cleaned = clean_text(name)
        if not cleaned:
            raise validation_error("name")
        return require_length(cleaned, self._config.limits.document_name_max_length, "name")

    def _now(self) -> str:
        return iso(self._ctx.clock.now())

    @staticmethod
    def _next_position(positions: list[int]) -> int:
        return max(positions, default=FIRST_POSITION - 1) + 1

    @staticmethod
    def _positions(active_ids: list[str], ordered_ids: list[str], detail: str) -> Mapping[str, int]:
        if sorted(active_ids) != sorted(ordered_ids):
            raise validation_error(detail)
        return {item_id: index + FIRST_POSITION for index, item_id in enumerate(ordered_ids)}

    @staticmethod
    def _active_contact(profile: Profile, contact_id: str) -> Contact:
        contact = next((c for c in profile.active_contacts() if c.id == contact_id), None)
        if contact is None:
            raise not_found("contact")
        return contact

    @staticmethod
    def _replace_contact(profile: Profile, contact: Contact) -> None:
        profile.contacts = [contact if c.id == contact.id else c for c in profile.contacts]

    @staticmethod
    def _ensure_primary(profile: Profile, kind: ContactKind) -> None:
        same_kind = [c for c in profile.active_contacts() if c.kind is kind]
        if same_kind and not any(c.is_primary for c in same_kind):
            first = same_kind[0].id
            profile.contacts = [c.model_copy(update={"is_primary": True}) if c.id == first else c for c in profile.contacts]

    @staticmethod
    def _active_entry(profile: Profile, section: str, entry_id: str) -> ProfileEntry:
        entry = next((e for e in profile.active_entries(section) if e.id == entry_id), None)
        if entry is None:
            raise not_found("entry")
        return entry

    @staticmethod
    def _replace_entry(profile: Profile, section: str, entry: ProfileEntry) -> None:
        profile.sections[section] = [entry if e.id == entry.id else e for e in profile.sections.get(section, [])]

    @staticmethod
    def _active_document(profile: Profile, document_id: str) -> ProfileDocument:
        document = next((d for d in profile.active_documents() if d.id == document_id), None)
        if document is None:
            raise not_found("document")
        return document

    @staticmethod
    def _replace_document(profile: Profile, document: ProfileDocument) -> None:
        profile.documents = [document if d.id == document.id else d for d in profile.documents]
