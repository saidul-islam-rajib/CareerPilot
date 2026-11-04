import type { DraftFilter, GenerateInput, WritingDraft, WritingStatus } from './types';

export interface WritingApi {
  status(): Promise<WritingStatus>;
  listDrafts(filter?: DraftFilter): Promise<WritingDraft[]>;
  generate(input: GenerateInput): Promise<WritingDraft>;
  getDraft(id: string): Promise<WritingDraft>;
  editDraft(id: string, text: string): Promise<WritingDraft>;
  removeDraft(id: string): Promise<void>;
  recheck(id: string): Promise<WritingDraft>;
  stripFlagged(id: string): Promise<WritingDraft>;
  attach(id: string, approvalId: string): Promise<WritingDraft>;
  detach(id: string, approvalId: string): Promise<WritingDraft>;
}
