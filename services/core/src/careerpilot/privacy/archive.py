import hashlib
import io
import json
import zipfile
from collections.abc import Callable
from dataclasses import dataclass

from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.models import StoredFile
from careerpilot.candidate.ports import CandidateWorkspace
from careerpilot.integrations.models import ConnectionView
from careerpilot.platform.clock import iso
from careerpilot.platform.files import FileStorage
from careerpilot.platform.model import CamelModel
from careerpilot.privacy.config import ExportsConfig
from careerpilot.privacy.enums import ArchiveSection
from careerpilot.privacy.models import ConsentRecord, DeletionRecord
from careerpilot.privacy.renderers import ZIP_TYPE, RenderedFile

JSON_INDENT = 2
MANIFEST = "manifest.json"
FILES_DIRECTORY = "files"
SECTION_SUFFIX = ".json"
UNSAFE_NAME = str.maketrans({"/": "_", "\\": "_", ":": "_"})
Json = dict[str, object] | list[dict[str, object]]


@dataclass(frozen=True)
class ArchiveSources:
    consents: Callable[[str], list[ConsentRecord]]
    deletions: Callable[[str], DeletionRecord | None]
    connections: Callable[[str], list[ConnectionView]]


def jsonable(items: list[CamelModel]) -> list[dict[str, object]]:
    return [item.to_json() for item in items]


def safe_name(name: str) -> str:
    return name.translate(UNSAFE_NAME)


class ArchiveBuilder:
    def __init__(self, context: CandidateContext, storage: FileStorage, config: ExportsConfig, sources: ArchiveSources) -> None:
        self._ctx = context
        self._storage = storage
        self._config = config
        self._sources = sources

    def build(self, user_id: str) -> RenderedFile:
        workspace = self._ctx.workspaces.get(user_id)
        sections = self._config.archive_sections
        buffer = io.BytesIO()
        listed: list[dict[str, str | int]] = []
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
            for section in sections:
                if section is ArchiveSection.FILES:
                    listed = self._write_files(archive, workspace)
                else:
                    self._write_json(archive, f"{section.value}{SECTION_SUFFIX}", self._section(section, user_id, workspace))
            self._write_json(archive, MANIFEST, self._manifest(user_id, listed))
        stamp = self._ctx.clock.now().strftime("%Y%m%d")
        return RenderedFile(f"careerpilot-data-{stamp}.zip", buffer.getvalue(), ZIP_TYPE)

    def _section(self, section: ArchiveSection, user_id: str, workspace: CandidateWorkspace) -> Json:
        builders: dict[ArchiveSection, Callable[[], Json]] = {
            ArchiveSection.PROFILE: lambda: self._profile(user_id, workspace),
            ArchiveSection.PREFERENCES: workspace.preferences.to_json,
            ArchiveSection.APPLICATIONS: lambda: jsonable(list(workspace.applications)),
            ArchiveSection.APPROVALS: lambda: jsonable(list(workspace.approvals)),
            ArchiveSection.SAVED_ANSWERS: lambda: jsonable(list(workspace.saved_answers)),
            ArchiveSection.SIGN_IN_ACTIVITY: lambda: jsonable(list(workspace.sign_in_events)),
            ArchiveSection.CONSENTS: lambda: jsonable(list(self._sources.consents(user_id))),
            ArchiveSection.CONNECTIONS: lambda: jsonable(list(self._sources.connections(user_id))),
            ArchiveSection.DELETION_HISTORY: lambda: self._deletions(user_id),
        }
        return builders[section]()

    def _profile(self, user_id: str, workspace: CandidateWorkspace) -> dict[str, object]:
        account = self._ctx.accounts.get(user_id)
        identity: dict[str, object] = {}
        if account is not None:
            identity = {
                "id": account.user.id,
                "fullName": account.user.full_name,
                "email": account.user.email,
                "status": account.status.value,
            }
        return {"account": identity, "profile": workspace.profile.to_json()}

    def _deletions(self, user_id: str) -> list[dict[str, object]]:
        record = self._sources.deletions(user_id)
        return [record.to_json()] if record else []

    def _stored_files(self, workspace: CandidateWorkspace) -> list[StoredFile]:
        files: list[StoredFile] = [version for document in workspace.profile.documents for version in document.versions]
        if workspace.profile.photo is not None:
            files.append(workspace.profile.photo)
        return files

    def _write_files(self, archive: zipfile.ZipFile, workspace: CandidateWorkspace) -> list[dict[str, str | int]]:
        listed: list[dict[str, str | int]] = []
        for number, stored in enumerate(self._stored_files(workspace), start=1):
            data = self._storage.get(stored.key)
            if data is None:
                continue
            path = f"{FILES_DIRECTORY}/{number:03d}-{safe_name(stored.file_name)}"
            archive.writestr(path, data)
            listed.append({"path": path, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
        return listed

    def _manifest(self, user_id: str, files: list[dict[str, str | int]]) -> dict[str, object]:
        return {
            "product": self._ctx.settings.branding.product_name,
            "userId": user_id,
            "generatedAt": iso(self._ctx.clock.now()),
            "sections": [section.value for section in self._config.archive_sections],
            "files": list(files),
        }

    @staticmethod
    def _write_json(archive: zipfile.ZipFile, name: str, content: Json) -> None:
        archive.writestr(name, json.dumps(content, indent=JSON_INDENT, ensure_ascii=False))
