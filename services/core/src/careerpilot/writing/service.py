import re
from dataclasses import dataclass

from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.models import ApprovalDetail, ApprovalWriting, OpportunityDetail
from careerpilot.candidate.ports import CandidateWorkspace
from careerpilot.candidate.services.approvals import cover_letter
from careerpilot.candidate.services.opportunities import OpportunityService
from careerpilot.platform.clock import iso
from careerpilot.platform.enums import ApprovalState
from careerpilot.platform.errors import DomainError, ErrorCode, conflict, not_found, validation_error
from careerpilot.writing.checks import WritingChecker, word_count
from careerpilot.writing.contamination import other_employer_names
from careerpilot.writing.enums import (
    DraftSource,
    DraftStatus,
    IssueKind,
    WritingFailure,
    WritingKind,
    WritingProvider,
    WritingTone,
)
from careerpilot.writing.facts import build_facts
from careerpilot.writing.models import (
    CheckReport,
    CheckSubject,
    Fact,
    Generated,
    KindStatus,
    WritingDraft,
    WritingRequest,
    WritingStatus,
)
from careerpilot.writing.ports import DraftGenerator, GenerationRefusedError, GenerationUnavailableError, WritingRepository

NO_VERSION = 0
STRIPPED_ISSUES = (IssueKind.UNSUPPORTED_CLAIM, IssueKind.OTHER_EMPLOYER)
BLANK_RUNS = re.compile(r"\n{3,}")
SPACE_RUNS = re.compile(r"[ \t]{2,}")
PARAGRAPH = "\n\n"
DRAFT_ID_PREFIX = "wrt"


@dataclass(frozen=True)
class WritingContext:
    candidate: CandidateContext
    drafts: WritingRepository
    opportunities: OpportunityService
    template: DraftGenerator
    checker: WritingChecker
    ai: DraftGenerator | None = None


@dataclass(frozen=True)
class GenerateInput:
    kind: WritingKind
    opportunity_id: str
    tone: WritingTone | None = None
    max_words: int | None = None
    instructions: str = ""


@dataclass(frozen=True)
class Origin:
    kind: WritingKind
    opportunity: OpportunityDetail
    tone: WritingTone
    instructions: str
    parent_id: str | None


class WritingService:
    def __init__(self, context: WritingContext) -> None:
        self._ctx = context
        self._candidate = context.candidate
        self._config = context.candidate.settings.writing

    def status(self) -> WritingStatus:
        ai = self._ctx.ai
        writer = ai or self._ctx.template
        return WritingStatus(
            provider=WritingProvider.AI if ai else WritingProvider.TEMPLATE,
            ai_configured=ai is not None,
            model=ai.model if ai else None,
            kinds=[
                KindStatus(
                    kind=rule.kind,
                    available=writer.supports(rule.kind),
                    ai_only=rule.ai_only,
                    default_words=rule.default_words,
                    max_words=rule.max_words,
                )
                for rule in self._config.kinds
            ],
            tones=list(WritingTone),
            default_tone=self._config.default_tone,
            max_instruction_chars=self._config.max_instruction_chars,
        )

    def drafts(self, user_id: str, opportunity_id: str | None = None, kind: WritingKind | None = None) -> list[WritingDraft]:
        return self._ctx.drafts.for_user(user_id, opportunity_id, kind)

    def get(self, user_id: str, draft_id: str) -> WritingDraft:
        return self._find(user_id, draft_id)

    def generate(self, user_id: str, request: GenerateInput) -> WritingDraft:
        rule = self._config.kind_rule(request.kind)
        instructions = request.instructions.strip()
        if len(instructions) > self._config.max_instruction_chars:
            raise validation_error(WritingFailure.INSTRUCTIONS.value)
        workspace = self._candidate.workspaces.get(user_id)
        opportunity = self._ctx.opportunities.detail(user_id, request.opportunity_id)
        facts = build_facts(workspace.profile)
        if len(facts) <= 1:
            raise validation_error(WritingFailure.NOTHING_TO_WRITE.value)
        tone = request.tone or self._config.default_tone
        limit = max(1, min(request.max_words or rule.default_words, rule.max_words))
        generated = self._write(WritingRequest(request.kind, tone, limit, workspace.profile, facts, opportunity, instructions))
        origin = Origin(request.kind, opportunity, tone, instructions, None)
        return self._store(user_id, origin, generated, facts)

    def edit(self, user_id: str, draft_id: str, text: str) -> WritingDraft:
        previous = self._find(user_id, draft_id)
        cleaned = text.strip()
        if not cleaned or len(cleaned) > self._config.max_text_chars:
            raise validation_error(WritingFailure.TEXT.value)
        return self._new_version(user_id, previous, cleaned)

    def strip_flagged(self, user_id: str, draft_id: str) -> WritingDraft:
        previous = self._find(user_id, draft_id)
        text = previous.text
        for issue in previous.issues:
            if issue.kind in STRIPPED_ISSUES and issue.text:
                text = text.replace(issue.text, "")
        tidy = BLANK_RUNS.sub(PARAGRAPH, SPACE_RUNS.sub(" ", text)).strip()
        if not tidy:
            raise validation_error(WritingFailure.TEXT.value)
        return self._new_version(user_id, previous, tidy)

    def recheck(self, user_id: str, draft_id: str) -> WritingDraft:
        draft = self._find(user_id, draft_id)
        refreshed = self._with_report(draft, self._report(user_id, draft.kind, draft.opportunity_id, draft.text))
        self._ctx.drafts.save(refreshed)
        return refreshed

    def remove(self, user_id: str, draft_id: str) -> None:
        draft = self._find(user_id, draft_id)
        open_ids = {a.id for a in self._candidate.workspaces.get(user_id).approvals if a.state is ApprovalState.PENDING}
        for approval_id in draft.attached_approval_ids:
            if approval_id in open_ids:
                self.detach(user_id, draft_id, approval_id)
        self._ctx.drafts.remove(user_id, draft_id)

    def attach(self, user_id: str, draft_id: str, approval_id: str) -> WritingDraft:
        draft = self.recheck(user_id, draft_id)
        workspace = self._candidate.workspaces.get(user_id)
        approval = self._pending(workspace, approval_id)
        if approval.opportunity.id != draft.opportunity_id:
            raise conflict(WritingFailure.OPPORTUNITY_MISMATCH.value)
        if draft.status is not DraftStatus.READY:
            raise validation_error(WritingFailure.HAS_ISSUES.value)
        self._release_siblings(user_id, draft, approval_id)
        materials = approval.materials
        materials.writing = [w for w in materials.writing if w.kind is not draft.kind]
        materials.writing.append(
            ApprovalWriting(kind=draft.kind, draft_id=draft.id, version=draft.version, source=draft.source, text=draft.text)
        )
        if draft.kind is WritingKind.COVER_LETTER:
            materials.cover_letter = draft.text
        self._candidate.workspaces.save(user_id, workspace)
        attached = draft.model_copy(update={"attached_approval_ids": [*draft.attached_approval_ids, approval_id]})
        self._ctx.drafts.save(attached)
        return attached

    def detach(self, user_id: str, draft_id: str, approval_id: str) -> WritingDraft:
        draft = self._find(user_id, draft_id)
        workspace = self._candidate.workspaces.get(user_id)
        approval = self._pending(workspace, approval_id)
        materials = approval.materials
        materials.writing = [w for w in materials.writing if w.draft_id != draft.id]
        if draft.kind is WritingKind.COVER_LETTER:
            detail = self._ctx.opportunities.detail(user_id, draft.opportunity_id)
            materials.cover_letter = cover_letter(workspace.profile, detail, self._candidate.settings.submission.cover_letter_skills)
        self._candidate.workspaces.save(user_id, workspace)
        released = draft.model_copy(update={"attached_approval_ids": [a for a in draft.attached_approval_ids if a != approval_id]})
        self._ctx.drafts.save(released)
        return released

    def _write(self, request: WritingRequest) -> Generated:
        ai, template = self._ctx.ai, self._ctx.template
        if ai is not None and ai.supports(request.kind):
            try:
                return ai.generate(request)
            except GenerationRefusedError as error:
                raise conflict(WritingFailure.AI_REFUSED.value) from error
            except GenerationUnavailableError as error:
                if not template.supports(request.kind):
                    raise DomainError(ErrorCode.SERVICE_UNAVAILABLE, WritingFailure.AI_UNAVAILABLE.value) from error
                return template.generate(request)
        if template.supports(request.kind):
            return template.generate(request)
        raise DomainError(ErrorCode.SERVICE_UNAVAILABLE, WritingFailure.AI_NOT_CONFIGURED.value)

    def _store(self, user_id: str, origin: Origin, generated: Generated, facts: list[Fact]) -> WritingDraft:
        existing = self._ctx.drafts.for_user(user_id, origin.opportunity.id, origin.kind)
        if len(existing) >= self._config.max_versions_per_document:
            raise conflict(WritingFailure.VERSION_LIMIT.value)
        report = self._report_for(user_id, origin.kind, origin.opportunity, generated.text, facts)
        draft = WritingDraft(
            id=self._candidate.ids.next(DRAFT_ID_PREFIX),
            user_id=user_id,
            kind=origin.kind,
            opportunity_id=origin.opportunity.id,
            organization=origin.opportunity.organization,
            title=origin.opportunity.title,
            version=max((d.version for d in existing), default=NO_VERSION) + 1,
            text=generated.text,
            source=generated.source,
            model=generated.model,
            prompt_version=self._config.prompt_version if generated.source is DraftSource.AI else None,
            tone=origin.tone,
            instructions=origin.instructions,
            status=DraftStatus.READY,
            word_count=word_count(generated.text),
            created_at=iso(self._candidate.clock.now()),
            parent_id=origin.parent_id,
        )
        stored = self._with_report(draft, report)
        self._ctx.drafts.add(stored)
        return stored

    def _new_version(self, user_id: str, previous: WritingDraft, text: str) -> WritingDraft:
        opportunity = self._ctx.opportunities.detail(user_id, previous.opportunity_id)
        facts = build_facts(self._candidate.workspaces.get(user_id).profile)
        origin = Origin(previous.kind, opportunity, previous.tone, previous.instructions, previous.id)
        return self._store(user_id, origin, Generated(text=text, source=DraftSource.USER), facts)

    def _with_report(self, draft: WritingDraft, report: CheckReport) -> WritingDraft:
        return draft.model_copy(
            update={
                "issues": report.issues,
                "facts_used": report.facts_used,
                "status": DraftStatus.READY if report.passed else DraftStatus.NEEDS_FIXES,
                "word_count": word_count(draft.text),
            }
        )

    def _report(self, user_id: str, kind: WritingKind, opportunity_id: str, text: str) -> CheckReport:
        opportunity = self._ctx.opportunities.detail(user_id, opportunity_id)
        profile = self._candidate.workspaces.get(user_id).profile
        return self._report_for(user_id, kind, opportunity, text, build_facts(profile))

    def _report_for(self, user_id: str, kind: WritingKind, opportunity: OpportunityDetail, text: str, facts: list[Fact]) -> CheckReport:
        others = [o for o in self._candidate.opportunities.list_all() if o.id != opportunity.id]
        subject = CheckSubject(
            kind=kind,
            text=text,
            facts=facts,
            opportunity=opportunity,
            other_employers=other_employer_names(opportunity, others, facts),
        )
        return self._ctx.checker.check(subject)

    def _release_siblings(self, user_id: str, draft: WritingDraft, approval_id: str) -> None:
        for other in self._ctx.drafts.for_user(user_id, draft.opportunity_id, draft.kind):
            if other.id != draft.id and approval_id in other.attached_approval_ids:
                remaining = [a for a in other.attached_approval_ids if a != approval_id]
                self._ctx.drafts.save(other.model_copy(update={"attached_approval_ids": remaining}))

    def _find(self, user_id: str, draft_id: str) -> WritingDraft:
        draft = self._ctx.drafts.get(user_id, draft_id)
        if draft is None:
            raise not_found("writing_draft")
        return draft

    def _pending(self, workspace: CandidateWorkspace, approval_id: str) -> ApprovalDetail:
        approval = next((a for a in workspace.approvals if a.id == approval_id), None)
        if approval is None:
            raise not_found("approval")
        if approval.state is not ApprovalState.PENDING:
            raise conflict(WritingFailure.APPROVAL_CLOSED.value)
        return approval
