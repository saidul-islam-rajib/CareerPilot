from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime

from careerpilot.administration.models import PlatformSettings
from careerpilot.automation.enums import DeadlineAction, DryRunOutcome, SkipReason, SkipStage
from careerpilot.automation.models import (
    AutomationOverview,
    AutomationRule,
    DryRunItem,
    DryRunMaterials,
    DryRunResult,
    EffectiveSettings,
    RuleInput,
    SettingsInput,
    SkippedRecord,
)
from careerpilot.automation.policy import AutomationPolicy, Candidate, Situation, Verdict, rule_unusable
from careerpilot.automation.rules import RuleValidator, limits_of
from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.models import ApplicationRecord, OpportunityDetail, TimelineEntry, Track
from careerpilot.candidate.ports import CandidateWorkspace
from careerpilot.candidate.services.approvals import ApprovalService
from careerpilot.matching.service import acted_on_opportunities
from careerpilot.platform.clock import iso, parse_iso
from careerpilot.platform.enums import NotificationKind, NotificationTarget, SubmissionStatus, TimelineActor
from careerpilot.platform.errors import not_found, validation_error
from careerpilot.platform.messages import translate

NotifyOnce = Callable[[str, NotificationKind, str, str, tuple[NotificationTarget, str]], None]


@dataclass(frozen=True)
class AutomationContext:
    candidate: CandidateContext
    platform: Callable[[], PlatformSettings]
    policy: AutomationPolicy
    approvals: ApprovalService
    notify_once: NotifyOnce


@dataclass
class Plan:
    rule: AutomationRule | None
    holds: list[SkipReason]
    planned: int = 0
    planned_by_rule: dict[str, int] = field(default_factory=dict[str, int])


class AutomationService:
    def __init__(self, context: AutomationContext) -> None:
        self._ctx = context
        self._candidate = context.candidate
        self._config = context.candidate.settings.automation
        self._policy = context.policy
        self._validator = RuleValidator(context.candidate.settings)

    def overview(self, user_id: str) -> AutomationOverview:
        situation = self._situation(user_id)
        automation = situation.workspace.preferences.automation
        today, week, _ = self._policy.counts(situation, None)
        return AutomationOverview(
            rules=automation.active_rules(),
            settings=self._policy.settings_of(situation),
            holds=self._policy.account_holds(situation),
            submitted_today=today,
            submitted_this_week=week,
            skipped=automation.skipped,
            user_only_steps=self._config.user_only_steps,
            limits=limits_of(self._config),
        )

    def create_rule(self, user_id: str, body: RuleInput) -> AutomationRule:
        workspace = self._candidate.workspaces.get(user_id)
        automation = workspace.preferences.automation
        active = automation.active_rules()
        if len(active) >= self._config.max_rules:
            raise validation_error("rule_limit")
        now = iso(self._candidate.clock.now())
        draft = self._validator.validated(workspace, body)
        rule = draft.model_copy(
            update={"id": self._candidate.ids.next("rul"), "position": len(active), "created_at": now, "updated_at": now}
        )
        automation.rules.append(rule)
        self._candidate.workspaces.save(user_id, workspace)
        return rule

    def update_rule(self, user_id: str, rule_id: str, body: RuleInput) -> AutomationRule:
        workspace = self._candidate.workspaces.get(user_id)
        current = self._find(workspace, rule_id)
        draft = self._validator.validated(workspace, body)
        keep = {"id": current.id, "position": current.position, "created_at": current.created_at}
        updated = draft.model_copy(update={**keep, "updated_at": iso(self._candidate.clock.now())})
        rules = workspace.preferences.automation.rules
        rules[rules.index(current)] = updated
        self._candidate.workspaces.save(user_id, workspace)
        return updated

    def delete_rule(self, user_id: str, rule_id: str) -> None:
        workspace = self._candidate.workspaces.get(user_id)
        rule = self._find(workspace, rule_id)
        now = iso(self._candidate.clock.now())
        rule.deleted_at = now
        rule.updated_at = now
        self._candidate.workspaces.save(user_id, workspace)

    def reorder(self, user_id: str, rule_ids: list[str]) -> list[AutomationRule]:
        workspace = self._candidate.workspaces.get(user_id)
        active = workspace.preferences.automation.active_rules()
        if sorted(rule_ids) != sorted(r.id for r in active):
            raise validation_error("rule_order")
        by_id = {r.id: r for r in active}
        for position, rule_id in enumerate(rule_ids):
            by_id[rule_id].position = position
        self._candidate.workspaces.save(user_id, workspace)
        return workspace.preferences.automation.active_rules()

    def update_settings(self, user_id: str, body: SettingsInput) -> EffectiveSettings:
        self._validator.check_settings(body)
        workspace = self._candidate.workspaces.get(user_id)
        automation = workspace.preferences.automation
        automation.deadline_buffer_hours = body.deadline_buffer_hours
        automation.deadline_action = body.deadline_action
        automation.weekly_cap = body.weekly_cap
        automation.inactivity_days = body.inactivity_days
        self._candidate.workspaces.save(user_id, workspace)
        return self._policy.effective(automation, self._ctx.platform())

    def dry_run(self, user_id: str, rule_id: str | None = None) -> DryRunResult:
        situation = self._situation(user_id)
        rule = self._find(situation.workspace, rule_id) if rule_id else None
        plan = Plan(rule, self._policy.account_holds(situation))
        items = self._simulate(user_id, situation, plan)
        count = {outcome: sum(1 for i in items if i.outcome is outcome) for outcome in DryRunOutcome}
        return DryRunResult(
            ran_at=iso(situation.now),
            rule_id=rule_id,
            holds=plan.holds,
            items=items,
            would_apply=count[DryRunOutcome.WOULD_APPLY],
            deferred=count[DryRunOutcome.DEFERRED],
            skipped=count[DryRunOutcome.SKIPPED],
        )

    def apply(self, user_id: str, opportunity_id: str) -> None:
        situation = self._situation(user_id)
        workspace = situation.workspace
        opportunity = self._candidate.opportunities.get(opportunity_id)
        match = workspace.matches.get(opportunity_id)
        track = self._track_of(workspace, opportunity_id)
        if opportunity is None or match is None or track is None or self._policy.account_holds(situation, opportunity.route):
            return
        verdict = self._policy.verdict(situation, Candidate(opportunity, match, track))
        if not verdict.accepted:
            self._record(user_id, situation, opportunity, verdict)
            return
        cv_id = verdict.rule.materials.cv_document_id if verdict.rule else None
        if self._policy.timing_risk(situation, verdict.rule, opportunity.deadline):
            action = self._policy.action(situation)
            if action is DeadlineAction.NOTIFY_AND_ASK:
                self._ctx.approvals.prepare(user_id, opportunity_id, cv_id)
                return
            if action is DeadlineAction.SKIP:
                self._record(user_id, situation, opportunity, Verdict(verdict.rule, [SkipReason.DEADLINE_AT_RISK], SkipStage.SCHEDULE))
                return
        self._ctx.approvals.approve_by_rule(user_id, opportunity_id, verdict.rule)

    def reconcile(self) -> int:
        changed = 0
        for user_id in self._candidate.accounts.active_ids():
            situation = self._situation(user_id)
            applications = situation.workspace.applications
            cancelled = [a for a in applications if self._reconcile_application(user_id, situation, a)]
            if cancelled:
                self._candidate.workspaces.save(user_id, situation.workspace)
            changed += len(cancelled) + self._notify_inactive(user_id, situation)
        return changed

    def _situation(self, user_id: str) -> Situation:
        return Situation(self._candidate.workspaces.get(user_id), self._ctx.platform(), self._candidate.clock.now())

    def _reconcile_application(self, user_id: str, situation: Situation, application: ApplicationRecord) -> bool:
        if not application.automatic or application.submission_status is not SubmissionStatus.APPROVED_QUEUED:
            return False
        rule = self._policy.rule_of(situation.workspace, application)
        if application.rule_id is not None and rule_unusable(rule, situation):
            return self._cancel(application, "timeline.cancelledRuleInactive", situation.now)
        opportunity = self._candidate.opportunities.get(application.opportunity.id)
        deadline = opportunity.deadline if opportunity else None
        if deadline and parse_iso(deadline) <= situation.now:
            return self._cancel(application, "timeline.cancelledDeadlinePassed", situation.now)
        if self._policy.schedule_open(situation, rule) or not self._policy.timing_risk(situation, rule, deadline):
            return False
        action = self._policy.action(situation)
        if action is DeadlineAction.SKIP:
            return self._cancel(application, "timeline.cancelledDeadlineWindow", situation.now)
        if action is DeadlineAction.NOTIFY_AND_ASK:
            self._ask(user_id, application)
        return False

    def _ask(self, user_id: str, application: ApplicationRecord) -> None:
        names = {"title": application.opportunity.title, "organization": application.opportunity.organization}
        self._ctx.notify_once(
            user_id,
            NotificationKind.AUTOMATION_ATTENTION,
            translate("automation.notifications.deadlineTitle"),
            translate("automation.notifications.deadlineBody", names),
            (NotificationTarget.APPLICATION, application.id),
        )

    def _notify_inactive(self, user_id: str, situation: Situation) -> int:
        if SkipReason.INACTIVE not in self._policy.account_holds(situation) or not self._uses_automation(situation.workspace):
            return 0
        days = self._policy.settings_of(situation).inactivity_days
        self._ctx.notify_once(
            user_id,
            NotificationKind.AUTOMATION_ATTENTION,
            translate("automation.notifications.inactiveTitle"),
            translate("automation.notifications.inactiveBody", {"days": days}),
            (NotificationTarget.AUTOMATION, user_id),
        )
        return 1

    @staticmethod
    def _uses_automation(workspace: CandidateWorkspace) -> bool:
        queued = any(a.automatic and a.submission_status is SubmissionStatus.APPROVED_QUEUED for a in workspace.applications)
        return queued or any(r.enabled for r in workspace.preferences.automation.active_rules())

    @staticmethod
    def _cancel(application: ApplicationRecord, text_key: str, now: datetime) -> bool:
        stamp = iso(now)
        application.submission_status = SubmissionStatus.CANCELLED
        application.updated_at = stamp
        entry = TimelineEntry(at=stamp, actor=TimelineActor.SYSTEM, text=translate(text_key), status=SubmissionStatus.CANCELLED)
        application.timeline.append(entry)
        return True

    def _simulate(self, user_id: str, situation: Situation, plan: Plan) -> list[DryRunItem]:
        workspace = situation.workspace
        rule = plan.rule
        handled = acted_on_opportunities(workspace)
        seen: set[str] = set()
        items: list[DryRunItem] = []
        for track in sorted(workspace.preferences.tracks, key=lambda t: t.position):
            if rule is not None and rule.track_ids and track.id not in rule.track_ids:
                continue
            for opportunity_id in workspace.track_opportunities.get(track.id, []):
                opportunity = self._candidate.opportunities.get(opportunity_id)
                match = workspace.matches.get(opportunity_id)
                if opportunity_id in handled or opportunity_id in seen or opportunity is None or match is None:
                    continue
                if len(items) >= self._config.dry_run_limit:
                    return items
                seen.add(opportunity_id)
                item = self._judge(user_id, situation, Candidate(opportunity, match, track), plan)
                items.append(item)
                if item.outcome is DryRunOutcome.WOULD_APPLY:
                    plan.planned += 1
                    if item.rule_id:
                        plan.planned_by_rule[item.rule_id] = plan.planned_by_rule.get(item.rule_id, 0) + 1
        return items

    def _judge(self, user_id: str, situation: Situation, candidate: Candidate, plan: Plan) -> DryRunItem:
        opportunity = candidate.opportunity
        only = plan.rule.id if plan.rule else None
        verdict = self._policy.verdict(situation, candidate, only)
        base = DryRunItem(
            opportunity_id=opportunity.id,
            title=opportunity.title,
            organization=opportunity.organization,
            track_id=candidate.track.id,
            match_score=candidate.match.score,
            outcome=DryRunOutcome.SKIPPED,
            reasons=verdict.reasons,
            route=opportunity.route,
        )
        if not verdict.accepted:
            return base
        rule = verdict.rule
        named = base.model_copy(update={"rule_id": rule.id if rule else None, "rule_name": rule.name if rule else None})
        if plan.holds:
            return named.model_copy(update={"outcome": DryRunOutcome.DEFERRED, "reasons": plan.holds})
        risk = self._policy.timing_risk(situation, rule, opportunity.deadline)
        if risk and self._policy.action(situation) is not DeadlineAction.SUBMIT_EARLIEST:
            return named.model_copy(update={"reasons": [SkipReason.DEADLINE_AT_RISK]})
        rule_planned = plan.planned_by_rule.get(rule.id, 0) if rule else 0
        cap = self._policy.cap_reason(situation, rule, plan.planned, rule_planned)
        if cap is not None:
            return named.model_copy(update={"outcome": DryRunOutcome.DEFERRED, "reasons": [cap]})
        return self._would_apply(user_id, situation, named, risk)

    def _would_apply(self, user_id: str, situation: Situation, item: DryRunItem, risk: bool) -> DryRunItem:
        rule = next((r for r in situation.workspace.preferences.automation.rules if r.id == item.rule_id), None)
        earliest = self._policy.earliest(situation, rule)
        waits = earliest is None or earliest > situation.now
        materials = self._ctx.approvals.preview(user_id, item.opportunity_id, rule.materials.cv_document_id if rule else None)
        return item.model_copy(
            update={
                "outcome": DryRunOutcome.WOULD_APPLY,
                "reasons": self._notes(item.route, waits),
                "earliest_at": iso(earliest) if earliest else None,
                "bypasses_window": risk and waits,
                "materials": DryRunMaterials(
                    cv_name=materials.cv.name,
                    cv_version=materials.cv.version,
                    cover_letter=materials.cover_letter,
                    answers=[a.question for a in materials.answers],
                ),
            }
        )

    def _notes(self, route: str, waits: bool) -> list[SkipReason]:
        notes = [SkipReason.USER_ONLY_STEP] if self._policy.user_only(route) else []
        return [*notes, SkipReason.OUTSIDE_WINDOW] if waits else notes

    def _record(self, user_id: str, situation: Situation, opportunity: OpportunityDetail, verdict: Verdict) -> None:
        automation = situation.workspace.preferences.automation
        rule_id = verdict.rule.id if verdict.rule else None
        existing = next((s for s in automation.skipped if s.opportunity_id == opportunity.id), None)
        if existing is not None and existing.reasons == verdict.reasons and existing.rule_id == rule_id:
            return
        record = SkippedRecord(
            opportunity_id=opportunity.id,
            title=opportunity.title,
            organization=opportunity.organization,
            stage=verdict.stage,
            reasons=verdict.reasons,
            rule_id=rule_id,
            at=iso(situation.now),
        )
        kept = [s for s in automation.skipped if s.opportunity_id != opportunity.id]
        automation.skipped = [record, *kept][: self._config.max_skip_records]
        self._candidate.workspaces.save(user_id, situation.workspace)

    @staticmethod
    def _track_of(workspace: CandidateWorkspace, opportunity_id: str) -> Track | None:
        tracks = sorted(workspace.preferences.tracks, key=lambda t: t.position)
        return next((t for t in tracks if opportunity_id in workspace.track_opportunities.get(t.id, [])), None)

    @staticmethod
    def _find(workspace: CandidateWorkspace, rule_id: str) -> AutomationRule:
        rule = next((r for r in workspace.preferences.automation.rules if r.id == rule_id and r.deleted_at is None), None)
        if rule is None:
            raise not_found("rule")
        return rule
