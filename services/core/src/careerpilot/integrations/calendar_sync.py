import hashlib
from dataclasses import dataclass
from datetime import timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from careerpilot.candidate.models import ApplicationRecord, FollowUpTask
from careerpilot.candidate.ports import WorkspaceRepository
from careerpilot.integrations.models import CalendarEventDraft, CalendarEventRecord
from careerpilot.integrations.ports import CalendarEventRepository, GoogleGateway
from careerpilot.platform.clock import IdGenerator, parse_iso
from careerpilot.platform.config import CalendarSyncConfig
from careerpilot.platform.enums import CalendarEventState, TaskKind, TaskStatus
from careerpilot.platform.messages import translate

EVENT_RECORD_PREFIX = "cev"
FALLBACK_ZONE = "UTC"
APPLICATION_PATH = "/applications/"
FINGERPRINT_SEPARATOR = "|"


@dataclass(frozen=True)
class CalendarContext:
    config: CalendarSyncConfig
    web_base_url: str
    ids: IdGenerator
    workspaces: WorkspaceRepository
    events: CalendarEventRepository
    gateway: GoogleGateway


def zone_for(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(name)
    except ZoneInfoNotFoundError:
        return ZoneInfo(FALLBACK_ZONE)


class CalendarSync:
    def __init__(self, context: CalendarContext) -> None:
        self._ctx = context

    def sync(self, user_id: str, access_token: str) -> int:
        workspace = self._ctx.workspaces.get(user_id)
        zone = zone_for(workspace.preferences.time_zone)
        changed = 0
        for application in workspace.applications:
            if application.archived_at is not None:
                continue
            for task in application.tasks:
                if task.kind is TaskKind.INTERVIEW:
                    changed += self._task(user_id, access_token, application, task, zone)
        return changed

    def event_id(self, user_id: str, task_id: str) -> str:
        digest = hashlib.sha256(f"{user_id}{FINGERPRINT_SEPARATOR}{task_id}".encode()).hexdigest()
        return f"{self._ctx.config.event_id_prefix}{digest}"[: self._ctx.config.event_id_length]

    def _task(self, user_id: str, token: str, application: ApplicationRecord, task: FollowUpTask, zone: ZoneInfo) -> int:
        existing = self._ctx.events.get(user_id, task.id)
        if task.status is TaskStatus.DISMISSED:
            return self._cancel(token, existing)
        if task.status is not TaskStatus.OPEN or task.due_at is None:
            return 0
        fingerprint = self._fingerprint(application, task, zone)
        if existing and existing.state is CalendarEventState.SYNCED and existing.fingerprint == fingerprint:
            return 0
        event_id = existing.event_id if existing else self.event_id(user_id, task.id)
        self._ctx.gateway.save_event(token, event_id, self._draft(application, task, zone))
        self._ctx.events.save(
            CalendarEventRecord(
                id=existing.id if existing else self._ctx.ids.next(EVENT_RECORD_PREFIX),
                user_id=user_id,
                task_id=task.id,
                application_id=application.id,
                event_id=event_id,
                state=CalendarEventState.SYNCED,
                fingerprint=fingerprint,
            )
        )
        return 1

    def _cancel(self, token: str, existing: CalendarEventRecord | None) -> int:
        if existing is None or existing.state is CalendarEventState.CANCELLED:
            return 0
        self._ctx.gateway.cancel_event(token, existing.event_id)
        self._ctx.events.save(existing.model_copy(update={"state": CalendarEventState.CANCELLED}))
        return 1

    def _draft(self, application: ApplicationRecord, task: FollowUpTask, zone: ZoneInfo) -> CalendarEventDraft:
        assert task.due_at is not None
        start = parse_iso(task.due_at).astimezone(zone)
        names = {"title": task.title, "organization": application.opportunity.organization, "role": application.opportunity.title}
        link = f"{self._ctx.web_base_url}{APPLICATION_PATH}{application.id}"
        description = translate("integrations.calendar.description", {**names, "notes": task.notes, "link": link})
        return CalendarEventDraft(
            title=translate("integrations.calendar.title", names),
            description=description.strip(),
            location=task.location,
            start=start,
            end=start + timedelta(minutes=self._ctx.config.default_duration_minutes),
            time_zone=zone.key,
            reminder_minutes=self._ctx.config.reminder_minutes,
        )

    @staticmethod
    def _fingerprint(application: ApplicationRecord, task: FollowUpTask, zone: ZoneInfo) -> str:
        parts = (task.title, task.due_at or "", task.location, task.notes, zone.key, application.opportunity.organization)
        return hashlib.sha256(FINGERPRINT_SEPARATOR.join(parts).encode()).hexdigest()
