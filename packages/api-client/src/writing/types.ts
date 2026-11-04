import type { DraftSource, DraftStatus, IssueKind, WritingKind, WritingProvider, WritingTone } from '@careerpilot/domain-ui-logic';

export interface FactRef {
  id: string;
  label: string;
}

export interface CheckIssue {
  kind: IssueKind;
  text?: string;
  terms?: string[];
}

export interface WritingDraft {
  id: string;
  kind: WritingKind;
  opportunityId: string;
  organization: string;
  title: string;
  version: number;
  text: string;
  source: DraftSource;
  model?: string;
  promptVersion?: string;
  tone: WritingTone;
  instructions: string;
  status: DraftStatus;
  issues: CheckIssue[];
  factsUsed: FactRef[];
  wordCount: number;
  createdAt: string;
  attachedApprovalIds: string[];
  parentId?: string;
}

export interface KindStatus {
  kind: WritingKind;
  available: boolean;
  aiOnly: boolean;
  defaultWords: number;
  maxWords: number;
}

export interface WritingStatus {
  provider: WritingProvider;
  aiConfigured: boolean;
  model?: string;
  kinds: KindStatus[];
  tones: WritingTone[];
  defaultTone: WritingTone;
  maxInstructionChars: number;
}

export interface GenerateInput {
  kind: WritingKind;
  opportunityId: string;
  tone?: WritingTone;
  maxWords?: number;
  instructions?: string;
}

export interface DraftFilter {
  opportunityId?: string;
  kind?: WritingKind;
}

export interface ApprovalWriting {
  kind: WritingKind;
  draftId: string;
  version: number;
  source: DraftSource;
  text: string;
}
