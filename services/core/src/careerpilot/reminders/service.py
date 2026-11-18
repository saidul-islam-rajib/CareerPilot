from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from careerpilot.academic.models import Outreach
from careerpilot.academic.outreach import NEEDS_ATTENTION
from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.ports import CandidateWorkspace
from careerpilot.fees.enums import LineSource
from careerpilot.fees.models import Reminder
from careerpilot.government.models import UpcomingItem
from careerpilot.messaging.notifications import NotificationService
from careerpilot.platform.clock import iso, parse_iso
from careerpilot.platform.enums import ApprovalState, NotificationKind, NotificationTarget
from careerpilot.platform.messages import translate
from careerpilot.reminders.enums import ReminderStage
from careerpilot.reminders.models import ReminderItem

SECONDS_PER_HOUR = 3600
DATE_FORMAT = "%d %b %Y"
NO_STAGE = ""


@dataclass(frozen=True)
class ReminderSources:
    government_upcoming: Callable[[str], list[UpcomingItem]]
    fee_reminders: Callable[[str], list[Reminder]]
    supervisor_replies: Callable[[str], list[Outreach]]
    freshness_days: Callable[[CandidateWorkspace], int]


@dataclass(frozen=True)
class ReminderContext:
    candidate: CandidateContext
    notifications: NotificationService
    sources: ReminderSources


def nearest_stage(remaining: float, thresholds: list[int]) -> int | None:
    reached = [threshold for threshold in thresholds if remaining <= threshold]
    return min(reached) if reached else None


class ReminderService:
    def __init__(self, context: ReminderContext) -> None:
        self._ctx = context
        self._candidate = context.candidate
        self._config = context.candidate.settings.reminders

    def run_due(self) -> int:
        return sum(self.run_for(user_id) for user_id in self._candidate.accounts.active_ids())

    def run_for(self, user_id: str) -> int:
        workspace = self._candidate.workspaces.get(user_id)
        now = self._candidate.clock.now()
        self._start_freshness_clock(user_id, workspace, now)
        sent = 0
        for item in self._items(user_id, workspace, now):
            if item.key in workspace.reminders_sent:
                continue
            workspace.reminders_sent.append(item.key)
            self._candidate.workspaces.save(user_id, workspace)
            title = translate(item.title_key, item.params)
            self._ctx.notifications.notify(user_id, item.kind, title, translate(item.body_key, item.params), item.target)
            sent += 1
        return sent + self._ctx.notifications.release_held(user_id)

    def confirm_profile(self, user_id: str) -> None:
        workspace = self._candidate.workspaces.get(user_id)
        workspace.profile_confirmed_at = iso(self._candidate.clock.now())
        self._candidate.workspaces.save(user_id, workspace)

    def _start_freshness_clock(self, user_id: str, workspace: CandidateWorkspace, now: datetime) -> None:
        if workspace.profile_confirmed_at is None:
            workspace.profile_confirmed_at = iso(now)
            self._candidate.workspaces.save(user_id, workspace)

    def _items(self, user_id: str, workspace: CandidateWorkspace, now: datetime) -> list[ReminderItem]:
        return [
            *self._approvals(workspace, now),
            *self._government(user_id, workspace, now),
            *self._fees(user_id),
            *self._supervisors(user_id),
            *self._profile(workspace, now),
        ]

    def _approvals(self, workspace: CandidateWorkspace, now: datetime) -> list[ReminderItem]:
        items: list[ReminderItem] = []
        for approval in workspace.approvals:
            remaining = (parse_iso(approval.expires_at) - now).total_seconds() / SECONDS_PER_HOUR
            lead = nearest_stage(remaining, self._config.approval_lead_hours)
            if approval.state is not ApprovalState.PENDING or remaining <= 0 or lead is None:
                continue
            params: dict[str, str | int] = {"title": approval.opportunity.title, "organization": approval.opportunity.organization}
            items.append(
                ReminderItem(
                    ReminderStage.APPROVAL,
                    (approval.id, str(lead)),
                    NotificationKind.APPROVAL_EXPIRING,
                    "reminders.approval.title",
                    "reminders.approval.body",
                    params,
                    (NotificationTarget.APPROVAL, approval.id),
                )
            )
        return items

    def _government(self, user_id: str, workspace: CandidateWorkspace, now: datetime) -> list[ReminderItem]:
        today = now.astimezone(ZoneInfo(workspace.preferences.time_zone)).date()
        items: list[ReminderItem] = []
        for upcoming in self._ctx.sources.government_upcoming(user_id):
            lead = nearest_stage((upcoming.on - today).days, self._config.government_lead_days)
            if lead is None:
                continue
            params: dict[str, str | int] = {"title": upcoming.circular_title, "date": upcoming.on.strftime(DATE_FORMAT)}
            stage = upcoming.stage.value if upcoming.stage else NO_STAGE
            items.append(
                ReminderItem(
                    ReminderStage.GOVERNMENT,
                    (upcoming.application_id, upcoming.subject.value, stage, str(lead)),
                    NotificationKind.GOVERNMENT_DEADLINE,
                    "reminders.government.title",
                    "reminders.government.body",
                    params,
                    (NotificationTarget.GOVERNMENT_APPLICATION, upcoming.application_id),
                )
            )
        return items

    def _fees(self, user_id: str) -> list[ReminderItem]:
        items: list[ReminderItem] = []
        for reminder in self._ctx.sources.fee_reminders(user_id):
            kind = reminder.kind.value
            government = reminder.source is LineSource.GOVERNMENT
            target = NotificationTarget.GOVERNMENT_APPLICATION if government else NotificationTarget.FEE
            items.append(
                ReminderItem(
                    ReminderStage.FEE,
                    (reminder.source.value, reminder.id, kind),
                    NotificationKind.FEE_DEADLINE,
                    f"reminders.fee.{kind}.title",
                    f"reminders.fee.{kind}.body",
                    {"title": reminder.title},
                    (target, reminder.id),
                )
            )
        return items

    def _supervisors(self, user_id: str) -> list[ReminderItem]:
        return [
            ReminderItem(
                ReminderStage.SUPERVISOR,
                (outreach.id, outreach.status.value),
                NotificationKind.SUPERVISOR_REPLY,
                "reminders.supervisor.title",
                "reminders.supervisor.body",
                {"name": outreach.supervisor_name},
                (NotificationTarget.PROGRAM, outreach.program_id or outreach.id),
            )
            for outreach in self._ctx.sources.supervisor_replies(user_id)
            if outreach.status in NEEDS_ATTENTION
        ]

    def _profile(self, workspace: CandidateWorkspace, now: datetime) -> list[ReminderItem]:
        confirmed = workspace.profile_confirmed_at
        days = self._ctx.sources.freshness_days(workspace)
        if confirmed is None or now - parse_iso(confirmed) <= timedelta(days=days):
            return []
        return [
            ReminderItem(
                ReminderStage.PROFILE,
                (confirmed,),
                NotificationKind.PROFILE_CONFIRMATION,
                "reminders.profile.title",
                "reminders.profile.body",
                {"days": days},
                (NotificationTarget.PROFILE, workspace.profile.id),
            )
        ]
