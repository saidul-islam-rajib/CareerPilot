from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.ports import CandidateWorkspace
from careerpilot.platform.clock import parse_iso
from careerpilot.platform.email_delivery import DeliveryError, DeliveryUncertainError, EmailSender, OutgoingEmail
from careerpilot.platform.enums import ApprovalState, ContactKind, OpportunityDecision, SubmissionStatus
from careerpilot.platform.messages import translate

DATE_FORMAT = "%d %b %Y"
TIME_SEPARATOR = ":"
LINE = "\n"
BULLET = "• "
LOOKBACK = timedelta(days=1)
ATTENTION = frozenset(
    {
        SubmissionStatus.AWAITING_USER_INFORMATION,
        SubmissionStatus.MANUAL_ACTION_REQUIRED,
        SubmissionStatus.OUTCOME_UNKNOWN,
        SubmissionStatus.FAILED,
    }
)


@dataclass(frozen=True)
class DigestSection:
    title_key: str
    lines: list[str]
    total: int


@dataclass(frozen=True)
class DigestContext:
    candidate: CandidateContext
    sender: EmailSender


def local_now(workspace: CandidateWorkspace, now: datetime) -> datetime:
    return now.astimezone(ZoneInfo(workspace.preferences.time_zone))


class DigestService:
    def __init__(self, context: DigestContext) -> None:
        self._ctx = context
        self._candidate = context.candidate
        self._config = context.candidate.settings.notifications

    def due_users(self) -> list[str]:
        now = self._candidate.clock.now()
        return [user_id for user_id in self._candidate.accounts.active_ids() if self._is_due(self._candidate.workspaces.get(user_id), now)]

    def send_due(self) -> int:
        return sum(1 for user_id in self.due_users() if self.send(user_id))

    def sections(self, user_id: str) -> list[DigestSection]:
        workspace = self._candidate.workspaces.get(user_id)
        now = self._candidate.clock.now()
        since = self._since(workspace, now)
        builders = [self._matches, self._approvals, self._sent, self._attention, self._closing_soon]
        return [section for build in builders if (section := build(workspace, since, now)).lines]

    def send(self, user_id: str) -> bool:
        workspace = self._candidate.workspaces.get(user_id)
        now = self._candidate.clock.now()
        sections = self.sections(user_id)
        recipient = self._recipient(user_id, workspace)
        workspace.last_digest_on = local_now(workspace, now).date().isoformat()
        self._candidate.workspaces.save(user_id, workspace)
        if not sections or not recipient:
            return False
        today = local_now(workspace, now).strftime(DATE_FORMAT)
        branding = self._candidate.settings.branding
        email = OutgoingEmail(
            sender_name=branding.product_name,
            sender_address=self._candidate.settings.submission.sender_address,
            reply_to=self._candidate.settings.submission.sender_address,
            to=recipient,
            subject=translate("digest.subject", {"date": today}),
            body=self._body(workspace.profile.full_name, sections),
        )
        try:
            self._ctx.sender.send(email)
        except (DeliveryError, DeliveryUncertainError):
            return False
        return True

    def _is_due(self, workspace: CandidateWorkspace, now: datetime) -> bool:
        preferences = workspace.preferences.notifications
        if not preferences.digest_enabled:
            return False
        local = local_now(workspace, now)
        hours, minutes = (preferences.digest_time or self._config.default_digest_time).split(TIME_SEPARATOR, 1)
        sent_today = workspace.last_digest_on == local.date().isoformat()
        return not sent_today and (local.hour, local.minute) >= (int(hours), int(minutes))

    @staticmethod
    def _since(workspace: CandidateWorkspace, now: datetime) -> datetime:
        if workspace.last_digest_on is None:
            return now - LOOKBACK
        start = date.fromisoformat(workspace.last_digest_on)
        return datetime.combine(start, datetime.min.time(), tzinfo=ZoneInfo(workspace.preferences.time_zone)) + LOOKBACK

    def _recipient(self, user_id: str, workspace: CandidateWorkspace) -> str | None:
        emails = [c for c in workspace.profile.active_contacts() if c.kind is ContactKind.EMAIL]
        primary = next((c.value for c in emails if c.is_primary), None)
        account = self._candidate.accounts.get(user_id)
        return primary or (emails[0].value if emails else None) or (account.user.email if account else None)

    def _limited(self, title_key: str, lines: list[str]) -> DigestSection:
        limit = self._config.max_items_per_section
        extra = [translate("digest.more", {"count": len(lines) - limit})] if len(lines) > limit else []
        return DigestSection(title_key, [*lines[:limit], *extra], len(lines))

    def _matches(self, workspace: CandidateWorkspace, since: datetime, now: datetime) -> DigestSection:
        lines: list[str] = []
        for track_ids in workspace.track_opportunities.values():
            for opportunity_id in track_ids:
                match = workspace.matches.get(opportunity_id)
                opportunity = self._candidate.opportunities.get(opportunity_id)
                dismissed = workspace.decisions.get(opportunity_id) is OpportunityDecision.DISMISSED
                if match and opportunity and not dismissed and parse_iso(match.matched_at) >= since:
                    params: dict[str, str | int] = {
                        "title": opportunity.title,
                        "organization": opportunity.organization,
                        "score": match.score,
                    }
                    lines.append(translate("digest.matchLine", params))
        return self._limited("digest.newMatches", list(dict.fromkeys(lines)))

    def _approvals(self, workspace: CandidateWorkspace, since: datetime, now: datetime) -> DigestSection:
        pending = sorted((a for a in workspace.approvals if a.state is ApprovalState.PENDING), key=lambda a: a.expires_at)
        lines = [
            translate(
                "digest.approvalLine",
                {
                    "title": a.opportunity.title,
                    "organization": a.opportunity.organization,
                    "date": local_now(workspace, parse_iso(a.expires_at)).strftime(DATE_FORMAT),
                },
            )
            for a in pending
        ]
        return self._limited("digest.approvals", lines)

    def _application_lines(self, workspace: CandidateWorkspace, applications: list[str]) -> list[str]:
        by_id = {a.id: a for a in workspace.applications}
        return [
            translate(
                "digest.applicationLine",
                {
                    "title": by_id[i].opportunity.title,
                    "organization": by_id[i].opportunity.organization,
                    "status": translate(f"enums.submission_status.{by_id[i].submission_status.value}"),
                },
            )
            for i in applications
        ]

    def _sent(self, workspace: CandidateWorkspace, since: datetime, now: datetime) -> DigestSection:
        sent = [a.id for a in workspace.applications if a.applied_at and parse_iso(a.applied_at) >= since]
        return self._limited("digest.sent", self._application_lines(workspace, sent))

    def _attention(self, workspace: CandidateWorkspace, since: datetime, now: datetime) -> DigestSection:
        flagged = [a.id for a in workspace.applications if a.submission_status in ATTENTION and parse_iso(a.updated_at) >= since]
        return self._limited("digest.attention", self._application_lines(workspace, flagged))

    def _closing_soon(self, workspace: CandidateWorkspace, since: datetime, now: datetime) -> DigestSection:
        horizon = now + timedelta(days=self._candidate.settings.display.urgent_deadline_days)
        applied = {a.opportunity.id for a in workspace.applications}
        lines: list[str] = []
        for opportunity_id in dict.fromkeys(i for ids in workspace.track_opportunities.values() for i in ids):
            opportunity = self._candidate.opportunities.get(opportunity_id)
            if opportunity and opportunity.deadline and opportunity_id not in applied and now <= parse_iso(opportunity.deadline) <= horizon:
                when = local_now(workspace, parse_iso(opportunity.deadline)).strftime(DATE_FORMAT)
                lines.append(
                    translate("digest.deadlineLine", {"title": opportunity.title, "organization": opportunity.organization, "date": when})
                )
        return self._limited("digest.closingSoon", lines)

    def _body(self, name: str, sections: list[DigestSection]) -> str:
        parts = [translate("digest.greeting", {"name": name}), ""]
        for section in sections:
            parts.append(translate(section.title_key, {"count": section.total}))
            parts.extend(f"{BULLET}{line}" for line in section.lines)
            parts.append("")
        branding = self._candidate.settings.branding
        parts.append(translate("digest.openApp", {"url": self._config.web_base_url}))
        parts.append(translate("digest.footer"))
        parts.append(translate("digest.credit", {"url": str(branding.developer_url)}))
        return LINE.join(parts)
