import { ApprovalState, DraftSource, DraftStatus, IssueKind, WritingKind, WritingProvider, WritingTone } from '@careerpilot/domain-ui-logic';
import { ApiErrorCode, ApiErrorDetail } from '../errors';
import type { Clock, IdGenerator } from '../ports';
import type { ApprovalDetail, OpportunityDetail, Profile } from '../types';
import type { WritingApi } from './ports';
import type { CheckIssue, FactRef, WritingDraft, WritingStatus } from './types';

const MAX_INSTRUCTION_CHARS = 1000;
const MAX_VERSIONS = 20;
const DEFAULT_WORDS: Record<WritingKind, number> = {
  [WritingKind.CoverLetter]: 300,
  [WritingKind.TailoredCv]: 600,
  [WritingKind.Essay]: 400,
  [WritingKind.Statement]: 600,
};
const MAX_WORDS: Record<WritingKind, number> = {
  [WritingKind.CoverLetter]: 450,
  [WritingKind.TailoredCv]: 900,
  [WritingKind.Essay]: 800,
  [WritingKind.Statement]: 1000,
};
const AI_ONLY: readonly WritingKind[] = [WritingKind.Essay, WritingKind.Statement];
const PLACEHOLDER = /\[[^\]\n]{1,80}\]|\{[^}\n]{1,80}\}|\b(todo|tbd|xxx)\b/gi;
const SENTENCE_BREAK = /(?<=[.!?])\s+|\n+/;
const PARAGRAPH = '\n\n';

export interface InMemoryWritingOptions {
  clock: Clock;
  ids: IdGenerator;
  respond: <T>(value: T) => Promise<T>;
  fail: (code: ApiErrorCode, detail?: string) => Promise<never>;
  profile: () => Profile;
  approvals: () => ApprovalDetail[];
  opportunity: (id: string) => OpportunityDetail | undefined;
  opportunities: () => OpportunityDetail[];
  defaultCoverLetter: (approval: ApprovalDetail) => string;
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

interface Facts {
  refs: Array<FactRef & { anchors: string[] }>;
  text: string;
}

function factsOf(profile: Profile): Facts {
  const refs: Facts['refs'] = [{ id: 'name', label: 'name', anchors: [profile.fullName] }];
  const parts = [profile.fullName, profile.headline, profile.summary, profile.location, ...profile.skills];
  for (const [section, entries] of Object.entries(profile.sections)) {
    for (const entry of entries) {
      const values = Object.values(entry.values).map(String);
      refs.push({ id: entry.id, label: section, anchors: values.filter((v) => v.length >= 3 && v.length <= 80 && !/^[\d\W]+$/.test(v)) });
      parts.push(...values);
    }
  }
  return { refs, text: parts.join('\n') };
}

function sentencesOf(text: string): string[] {
  return text
    .split(SENTENCE_BREAK)
    .map((s) => s.trim())
    .filter(Boolean);
}

function wordsOf(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/\w+/g) ?? []);
}

function unsupportedTerms(sentence: string, known: Set<string>): string[] {
  const body = sentence.replace(/^\W*\w+/, '');
  const numbers = sentence.match(/\d+(?:[.,]\d+)*/g) ?? [];
  const names = body.match(/\b[A-Z][A-Za-z]+\b/g) ?? [];
  return [...numbers, ...names].filter((term) => !known.has(term.toLowerCase()));
}

export function createInMemoryWriting(options: InMemoryWritingOptions): WritingApi {
  const { clock, ids, respond, fail } = options;
  const drafts: WritingDraft[] = [];

  const status = (): WritingStatus => ({
    provider: WritingProvider.Template,
    aiConfigured: false,
    kinds: Object.values(WritingKind).map((kind) => ({
      kind,
      available: !AI_ONLY.includes(kind),
      aiOnly: AI_ONLY.includes(kind),
      defaultWords: DEFAULT_WORDS[kind],
      maxWords: MAX_WORDS[kind],
    })),
    tones: Object.values(WritingTone),
    defaultTone: WritingTone.Professional,
    maxInstructionChars: MAX_INSTRUCTION_CHARS,
  });

  const find = (id: string) => drafts.find((d) => d.id === id);
  const missing = () => fail(ApiErrorCode.NotFound);

  const check = (kind: WritingKind, text: string, opportunity: OpportunityDetail): { issues: CheckIssue[]; factsUsed: FactRef[] } => {
    const profile = options.profile();
    const facts = factsOf(profile);
    const known = new Set([...wordsOf(facts.text), ...wordsOf(`${opportunity.title} ${opportunity.organization} ${opportunity.description}`)]);
    const issues: CheckIssue[] = [];
    const placeholders = text.match(PLACEHOLDER);
    if (placeholders) {
      issues.push({ kind: IssueKind.Placeholder, terms: [...new Set(placeholders)] });
    }
    const lowered = text.toLowerCase();
    const own = facts.text.toLowerCase();
    for (const other of options.opportunities()) {
      const name = other.organization.toLowerCase();
      if (other.id !== opportunity.id && !opportunity.organization.toLowerCase().includes(name) && !own.includes(name) && lowered.includes(name)) {
        const where = sentencesOf(text).find((s) => s.toLowerCase().includes(name)) ?? '';
        issues.push({ kind: IssueKind.OtherEmployer, text: where, terms: [other.organization] });
      }
    }
    for (const sentence of sentencesOf(text)) {
      const terms = unsupportedTerms(sentence, known);
      if (terms.length) {
        issues.push({ kind: IssueKind.UnsupportedClaim, text: sentence, terms });
      }
    }
    if (kind === WritingKind.CoverLetter && !lowered.includes(opportunity.organization.toLowerCase())) {
      issues.push({ kind: IssueKind.MissingTarget, terms: [opportunity.organization] });
    }
    const count = wordCount(text);
    if (count > MAX_WORDS[kind]) {
      issues.push({ kind: IssueKind.OverLimit, terms: [String(count), String(MAX_WORDS[kind])] });
    }
    const factsUsed = facts.refs
      .filter((ref) => ref.anchors.some((anchor) => lowered.includes(anchor.toLowerCase())))
      .map(({ id: refId, label }) => ({ id: refId, label }));
    return { issues, factsUsed };
  };

  const template = (kind: WritingKind, opportunity: OpportunityDetail): string => {
    const profile = options.profile();
    const skills = profile.skills.slice(0, 6).join(', ');
    if (kind === WritingKind.TailoredCv) {
      return [profile.fullName, profile.headline, `Summary\n${profile.summary}`, `Skills\n${skills}`].filter(Boolean).join(PARAGRAPH);
    }
    return [
      `Dear ${opportunity.organization} hiring team,`,
      `I am writing to apply for the ${opportunity.title} position at ${opportunity.organization}.`,
      profile.skills.length ? `My skills include ${skills}.` : '',
      `I would welcome the chance to discuss my application for the ${opportunity.title} role at ${opportunity.organization}.`,
      `Sincerely,\n${profile.fullName}`,
    ]
      .filter(Boolean)
      .join(PARAGRAPH);
  };

  const store = (base: Omit<WritingDraft, 'id' | 'version' | 'status' | 'issues' | 'factsUsed' | 'wordCount' | 'createdAt' | 'attachedApprovalIds'>, opportunity: OpportunityDetail) => {
    const siblings = drafts.filter((d) => d.opportunityId === base.opportunityId && d.kind === base.kind);
    const report = check(base.kind, base.text, opportunity);
    const draft: WritingDraft = {
      ...base,
      id: ids.next('wrt'),
      version: Math.max(0, ...siblings.map((d) => d.version)) + 1,
      status: report.issues.length ? DraftStatus.NeedsFixes : DraftStatus.Ready,
      issues: report.issues,
      factsUsed: report.factsUsed,
      wordCount: wordCount(base.text),
      createdAt: clock.now().toISOString(),
      attachedApprovalIds: [],
    };
    drafts.unshift(draft);
    return draft;
  };

  const revise = async (id: string, text: string) => {
    const previous = find(id) ?? (await missing());
    const opportunity = options.opportunity(previous.opportunityId) ?? (await missing());
    const { kind, opportunityId, organization, title, tone, instructions } = previous;
    return respond(
      store({ kind, opportunityId, organization, title, tone, instructions, text, source: DraftSource.User, parentId: previous.id }, opportunity),
    );
  };

  const pending = (approvalId: string) => options.approvals().find((a) => a.id === approvalId && a.state === ApprovalState.Pending);

  return {
    status: () => respond(status()),
    listDrafts: (filter = {}) =>
      respond(
        drafts.filter((d) => (!filter.opportunityId || d.opportunityId === filter.opportunityId) && (!filter.kind || d.kind === filter.kind)),
      ),
    async generate(input) {
      if (AI_ONLY.includes(input.kind)) {
        return fail(ApiErrorCode.ServiceUnavailable, ApiErrorDetail.AiNotConfigured);
      }
      if ((input.instructions ?? '').length > MAX_INSTRUCTION_CHARS) {
        return fail(ApiErrorCode.Validation, ApiErrorDetail.WritingInstructions);
      }
      const opportunity = options.opportunity(input.opportunityId) ?? (await missing());
      if (drafts.filter((d) => d.opportunityId === input.opportunityId && d.kind === input.kind).length >= MAX_VERSIONS) {
        return fail(ApiErrorCode.Conflict, ApiErrorDetail.VersionLimit);
      }
      return respond(
        store(
          {
            kind: input.kind,
            opportunityId: opportunity.id,
            organization: opportunity.organization,
            title: opportunity.title,
            text: template(input.kind, opportunity),
            source: DraftSource.Template,
            tone: input.tone ?? WritingTone.Professional,
            instructions: input.instructions ?? '',
          },
          opportunity,
        ),
      );
    },
    getDraft: async (id) => respond(find(id) ?? (await missing())),
    async editDraft(id, text) {
      if (!text.trim() || text.length > 20000) {
        return fail(ApiErrorCode.Validation, ApiErrorDetail.WritingText);
      }
      return revise(id, text.trim());
    },
    async removeDraft(id) {
      const draft = find(id) ?? (await missing());
      drafts.splice(drafts.indexOf(draft), 1);
      for (const approval of options.approvals()) {
        approval.materials.writing = approval.materials.writing.filter((w) => w.draftId !== id);
      }
      return respond(undefined);
    },
    async recheck(id) {
      const draft = find(id) ?? (await missing());
      const opportunity = options.opportunity(draft.opportunityId) ?? (await missing());
      const report = check(draft.kind, draft.text, opportunity);
      Object.assign(draft, { issues: report.issues, factsUsed: report.factsUsed, status: report.issues.length ? DraftStatus.NeedsFixes : DraftStatus.Ready });
      return respond(draft);
    },
    async stripFlagged(id) {
      const draft = find(id) ?? (await missing());
      let text = draft.text;
      for (const issue of draft.issues) {
        if (issue.text) {
          text = text.replace(issue.text, '');
        }
      }
      const tidy = text.replace(/\n{3,}/g, PARAGRAPH).replace(/[ \t]{2,}/g, ' ').trim();
      return tidy ? revise(id, tidy) : fail(ApiErrorCode.Validation, ApiErrorDetail.WritingText);
    },
    async attach(id, approvalId) {
      const draft = find(id) ?? (await missing());
      const approval = pending(approvalId);
      if (!approval) {
        return fail(ApiErrorCode.Conflict, ApiErrorDetail.ApprovalClosed);
      }
      if (approval.opportunity.id !== draft.opportunityId) {
        return fail(ApiErrorCode.Conflict, ApiErrorDetail.OpportunityMismatch);
      }
      const opportunity = options.opportunity(draft.opportunityId) ?? (await missing());
      const report = check(draft.kind, draft.text, opportunity);
      Object.assign(draft, { issues: report.issues, factsUsed: report.factsUsed, status: report.issues.length ? DraftStatus.NeedsFixes : DraftStatus.Ready });
      if (report.issues.length) {
        return fail(ApiErrorCode.Validation, ApiErrorDetail.HasIssues);
      }
      for (const sibling of drafts) {
        if (sibling.id !== id && sibling.kind === draft.kind) {
          sibling.attachedApprovalIds = sibling.attachedApprovalIds.filter((a) => a !== approvalId);
        }
      }
      approval.materials.writing = [
        ...approval.materials.writing.filter((w) => w.kind !== draft.kind),
        { kind: draft.kind, draftId: draft.id, version: draft.version, source: draft.source, text: draft.text },
      ];
      if (draft.kind === WritingKind.CoverLetter) {
        approval.materials.coverLetter = draft.text;
      }
      draft.attachedApprovalIds = [...draft.attachedApprovalIds, approvalId];
      return respond(draft);
    },
    async detach(id, approvalId) {
      const draft = find(id) ?? (await missing());
      const approval = pending(approvalId);
      if (!approval) {
        return fail(ApiErrorCode.Conflict, ApiErrorDetail.ApprovalClosed);
      }
      approval.materials.writing = approval.materials.writing.filter((w) => w.draftId !== id);
      if (draft.kind === WritingKind.CoverLetter) {
        approval.materials.coverLetter = options.defaultCoverLetter(approval);
      }
      draft.attachedApprovalIds = draft.attachedApprovalIds.filter((a) => a !== approvalId);
      return respond(draft);
    },
  };
}
