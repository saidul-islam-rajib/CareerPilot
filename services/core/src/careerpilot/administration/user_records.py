from collections.abc import Callable
from dataclasses import dataclass

from careerpilot.administration.context import AdminActor, AdminContext
from careerpilot.administration.models import AdminApplicationRow, AdminUserRow, UserSource
from careerpilot.administration.user_sources import UserSourceService
from careerpilot.candidate.models import (
    ApplicationRecord,
    ApprovalDetail,
    Preferences,
    Profile,
    SignInEvent,
    TimelineEntry,
    Track,
)
from careerpilot.candidate.ports import Account, CandidateWorkspace, OpportunityRepository
from careerpilot.candidate.profile_rules import clean_multiline, require_length
from careerpilot.candidate.services.preferences import PreferencesService
from careerpilot.candidate.services.profile import BasicsChanges, ProfileService
from careerpilot.candidate.tracks import home_country
from careerpilot.platform.clock import iso
from careerpilot.platform.enums import (
    AdminArea,
    ApplicationMode,
    ApprovalState,
    OpportunityDecision,
    OutcomeStatus,
    PermissionAction,
    SubmissionStatus,
    TimelineActor,
)
from careerpilot.platform.errors import conflict, not_found
from careerpilot.platform.messages import translate
from careerpilot.platform.model import CamelModel

CLOSED_SUBMISSIONS = frozenset({SubmissionStatus.CANCELLED, SubmissionStatus.FAILED, SubmissionStatus.CONFIRMED})


class AdminListedJob(CamelModel):
    id: str
    title: str
    organization: str
    location: str
    country_code: str
    match_score: int
    decision: OpportunityDecision | None = None
    applied: bool
    source_name: str
    url: str


class AdminTrackList(CamelModel):
    track: Track
    jobs: list[AdminListedJob]


class AdminUserRecord(CamelModel):
    user: AdminUserRow
    profile: Profile
    preferences: Preferences
    lists: list[AdminTrackList]
    approvals: list[ApprovalDetail]
    applications: list[ApplicationRecord]
    sources: list[UserSource]
    sign_ins: list[SignInEvent]


class AdminApplicationChange(CamelModel):
    submission_status: SubmissionStatus | None = None
    outcome_status: OutcomeStatus | None = None
    note: str = ""


class AdminProfileChange(CamelModel):
    full_name: str | None = None
    headline: str | None = None
    location: str | None = None
    country_code: str | None = None
    summary: str | None = None


def last_sign_in(workspace: CandidateWorkspace) -> str | None:
    successful = [event.at for event in workspace.sign_in_events if event.success]
    return max(successful) if successful else None


def user_row(account: Account, workspace: CandidateWorkspace, default_country: str) -> AdminUserRow:
    return AdminUserRow(
        id=account.user.id,
        full_name=account.user.full_name,
        email=account.user.email,
        status=account.status,
        country=home_country(workspace, default_country),
        created_at=account.consent_at or "",
        last_sign_in_at=last_sign_in(workspace),
        applications_count=len(workspace.applications),
        automatic_enabled=any(track.mode is ApplicationMode.AUTOMATIC for track in workspace.preferences.tracks),
        profile_completeness=workspace.profile.completeness,
    )


def application_row(application: ApplicationRecord, user_name: str, workspace: CandidateWorkspace) -> AdminApplicationRow:
    automatic = any(track.mode is ApplicationMode.AUTOMATIC for track in workspace.preferences.tracks)
    return AdminApplicationRow(
        id=application.id,
        user_name=user_name,
        opportunity_title=application.opportunity.title,
        organization=application.opportunity.organization,
        submission_status=application.submission_status,
        outcome_status=application.outcome_status,
        route=application.route,
        mode=ApplicationMode.AUTOMATIC if automatic else ApplicationMode.APPROVE_EACH,
        updated_at=application.updated_at,
    )


@dataclass(frozen=True)
class UserRecordsContext:
    admin: AdminContext
    preferences: PreferencesService
    profile: ProfileService
    user_sources: UserSourceService
    opportunities: OpportunityRepository


class AdminUserRecords:
    def __init__(self, context: UserRecordsContext) -> None:
        self._records = context
        self._ctx = context.admin

    def rows(self) -> list[AdminUserRow]:
        default = self._ctx.settings.account.default_country_code
        real: list[AdminUserRow] = []
        for user_id in self._ctx.accounts.all_ids():
            account = self._ctx.accounts.get(user_id)
            if account is not None:
                real.append(user_row(account, self._ctx.workspaces.get(user_id), default))
        known = {row.id for row in real}
        return real + [row for row in self._ctx.directory.users() if row.id not in known]

    def application_rows(self) -> list[AdminApplicationRow]:
        rows: list[AdminApplicationRow] = []
        for user_id in self._ctx.accounts.all_ids():
            account = self._ctx.accounts.get(user_id)
            if account is None:
                continue
            workspace = self._ctx.workspaces.get(user_id)
            rows.extend(application_row(application, account.user.full_name, workspace) for application in workspace.applications)
        known = {row.id for row in rows}
        return rows + [row for row in self._ctx.directory.applications() if row.id not in known]

    def owner_of(self, application_id: str) -> str | None:
        for user_id in self._ctx.accounts.all_ids():
            if any(a.id == application_id for a in self._ctx.workspaces.get(user_id).applications):
                return user_id
        return None

    def record(self, actor: AdminActor, user_id: str) -> AdminUserRecord:
        actor.require(AdminArea.USERS, PermissionAction.READ)
        account = self._account(user_id)
        workspace = self._ctx.workspaces.get(user_id)
        actor.record("user.record_viewed", account.user.full_name)
        return self._build(account, workspace)

    def change_application(self, actor: AdminActor, user_id: str, application_id: str, change: AdminApplicationChange) -> AdminUserRecord:
        actor.require(AdminArea.APPLICATIONS, PermissionAction.UPDATE)
        note = require_length(clean_multiline(change.note), self._ctx.settings.tracking.outcome_note_max_length, "note")

        def apply(application: ApplicationRecord, now: str) -> str:
            parts: list[str] = []
            if change.submission_status is not None and change.submission_status is not application.submission_status:
                application.submission_status = change.submission_status
                parts.append(translate(f"enums.submission_status.{change.submission_status.value}"))
            if change.outcome_status is not None and change.outcome_status is not application.outcome_status:
                application.outcome_status = change.outcome_status
                parts.append(translate(f"enums.outcome_status.{change.outcome_status.value}"))
            text = translate("timeline.adminChanged", {"changes": ", ".join(parts) or translate("timeline.adminNote")})
            application.timeline.append(
                TimelineEntry(at=now, actor=TimelineActor.ADMIN, text=f"{text} {note}".strip(), status=change.submission_status)
            )
            return ", ".join(parts)

        return self._edit_application(actor, user_id, application_id, apply, "application.changed")

    def archive_application(self, actor: AdminActor, user_id: str, application_id: str, archived: bool) -> AdminUserRecord:
        actor.require(AdminArea.APPLICATIONS, PermissionAction.DELETE if archived else PermissionAction.UPDATE)

        def apply(application: ApplicationRecord, now: str) -> str:
            application.archived_at = now if archived else None
            if archived and application.submission_status not in CLOSED_SUBMISSIONS:
                application.submission_status = SubmissionStatus.CANCELLED
            key = "timeline.adminArchived" if archived else "timeline.adminRestored"
            application.timeline.append(TimelineEntry(at=now, actor=TimelineActor.ADMIN, text=translate(key)))
            return application.opportunity.title

        return self._edit_application(actor, user_id, application_id, apply, "application.archived" if archived else "application.restored")

    def set_job_decision(
        self, actor: AdminActor, user_id: str, opportunity_id: str, decision: OpportunityDecision | None
    ) -> AdminUserRecord:
        actor.require(AdminArea.USERS, PermissionAction.UPDATE)
        account = self._account(user_id)
        workspace = self._ctx.workspaces.get(user_id)
        if decision is None:
            workspace.decisions.pop(opportunity_id, None)
        else:
            workspace.decisions[opportunity_id] = decision
        self._ctx.workspaces.save(user_id, workspace)
        actor.record("user.job_decision", f"{account.user.full_name} · {opportunity_id} · {decision.value if decision else '-'}")
        return self._build(account, self._ctx.workspaces.get(user_id))

    def update_track(
        self, actor: AdminActor, user_id: str, track_id: str, result_count: int | None, mode: ApplicationMode | None
    ) -> AdminUserRecord:
        actor.require(AdminArea.USERS, PermissionAction.UPDATE)
        account = self._account(user_id)
        self._records.preferences.update_track(user_id, track_id, result_count, mode)
        actor.record("user.track_updated", f"{account.user.full_name} · {track_id}")
        return self._build(account, self._ctx.workspaces.get(user_id))

    def resume(self, actor: AdminActor, user_id: str) -> AdminUserRecord:
        actor.require(AdminArea.USERS, PermissionAction.UPDATE)
        account = self._account(user_id)
        self._records.preferences.resume(user_id)
        actor.record("user.resumed", account.user.full_name)
        return self._build(account, self._ctx.workspaces.get(user_id))

    def update_profile(self, actor: AdminActor, user_id: str, change: AdminProfileChange) -> AdminUserRecord:
        actor.require(AdminArea.USERS, PermissionAction.UPDATE)
        account = self._account(user_id)
        changes = BasicsChanges(
            full_name=change.full_name,
            headline=change.headline,
            location=change.location,
            country_code=change.country_code,
            summary=change.summary,
        )
        self._records.profile.update_basics(user_id, changes)
        actor.record("user.profile_updated", account.user.full_name)
        return self._build(self._account(user_id), self._ctx.workspaces.get(user_id))

    def reject_approval(self, actor: AdminActor, user_id: str, approval_id: str) -> AdminUserRecord:
        actor.require(AdminArea.APPLICATIONS, PermissionAction.UPDATE)
        account = self._account(user_id)
        workspace = self._ctx.workspaces.get(user_id)
        approval = next((a for a in workspace.approvals if a.id == approval_id), None)
        if approval is None:
            raise not_found("approval")
        if approval.state is not ApprovalState.PENDING:
            raise conflict("approval_not_pending")
        approval.state = ApprovalState.REJECTED
        self._ctx.workspaces.save(user_id, workspace)
        actor.record("approval.rejected_by_admin", f"{account.user.full_name} · {approval.opportunity.title}")
        return self._build(account, self._ctx.workspaces.get(user_id))

    def _edit_application(
        self, actor: AdminActor, user_id: str, application_id: str, apply: Callable[[ApplicationRecord, str], str], action: str
    ) -> AdminUserRecord:
        account = self._account(user_id)
        workspace = self._ctx.workspaces.get(user_id)
        application = next((a for a in workspace.applications if a.id == application_id), None)
        if application is None:
            raise not_found("application")
        now = iso(self._ctx.clock.now())
        summary = apply(application, now)
        application.updated_at = now
        self._ctx.workspaces.save(user_id, workspace)
        actor.record(action, f"{account.user.full_name} · {application.opportunity.title} · {summary}")
        return self._build(account, self._ctx.workspaces.get(user_id))

    def _account(self, user_id: str) -> Account:
        account = self._ctx.accounts.get(user_id)
        if account is None:
            raise not_found("user")
        return account

    def _build(self, account: Account, workspace: CandidateWorkspace) -> AdminUserRecord:
        settings = self._ctx.settings
        applied = {application.opportunity.id for application in workspace.applications}
        lists = [
            AdminTrackList(
                track=track,
                jobs=[job for oid in workspace.track_opportunities.get(track.id, []) if (job := self._job(workspace, oid, applied))],
            )
            for track in self._records.preferences.get(account.user.id).tracks
        ]
        return AdminUserRecord(
            user=user_row(account, workspace, settings.account.default_country_code),
            profile=workspace.profile,
            preferences=self._records.preferences.get(account.user.id),
            lists=lists,
            approvals=sorted(workspace.approvals, key=lambda a: a.created_at, reverse=True),
            applications=sorted(workspace.applications, key=lambda a: a.updated_at, reverse=True),
            sources=self._records.user_sources.mine(account.user.id),
            sign_ins=sorted(workspace.sign_in_events, key=lambda e: e.at, reverse=True),
        )

    def _job(self, workspace: CandidateWorkspace, opportunity_id: str, applied: set[str]) -> AdminListedJob | None:
        opportunity = self._records.opportunities.get(opportunity_id)
        if opportunity is None:
            return None
        match = workspace.matches.get(opportunity_id)
        return AdminListedJob(
            id=opportunity.id,
            title=opportunity.title,
            organization=opportunity.organization,
            location=opportunity.location,
            country_code=opportunity.country_code,
            match_score=match.score if match else opportunity.match_score,
            decision=workspace.decisions.get(opportunity_id),
            applied=opportunity_id in applied,
            source_name=opportunity.source.name,
            url=opportunity.source.url,
        )
