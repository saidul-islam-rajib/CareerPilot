import { ApprovalState, BulkBlock } from '@careerpilot/domain-ui-logic';
import type { ApprovalDetail, BulkApprovalRow } from '../types';

const DEMO_ATTESTATION_PHRASES = ['i certify', 'i declare', 'true and correct'];

export function bulkToken(approval: ApprovalDetail): string {
  return JSON.stringify([approval.opportunity.id, approval.route, approval.materials]);
}

export function bulkBlocks(approval: ApprovalDetail): BulkBlock[] {
  const questions = approval.materials.answers.map((answer) => answer.question.toLowerCase()).join(' ');
  const checks: [boolean, BulkBlock][] = [
    [approval.opportunity.hasHardFailure, BulkBlock.HardFailure],
    [approval.materials.answers.some((answer) => !answer.answer.trim()), BulkBlock.UnansweredQuestions],
    [DEMO_ATTESTATION_PHRASES.some((phrase) => questions.includes(phrase)), BulkBlock.Attestation],
  ];
  return checks.filter(([found]) => found).map(([, block]) => block);
}

export function bulkRow(approval: ApprovalDetail): BulkApprovalRow {
  const warnings = bulkBlocks(approval);
  return {
    approvalId: approval.id,
    employer: approval.opportunity.organization,
    role: approval.opportunity.title,
    route: approval.route,
    cvName: approval.materials.cv.name,
    writingKinds: approval.materials.writing.map((draft) => draft.kind),
    warnings,
    eligible: warnings.length === 0,
    reviewToken: bulkToken(approval),
    expiresAt: approval.expiresAt,
  };
}

export function bulkRefusal(approval: ApprovalDetail | undefined, token: string): BulkBlock[] {
  if (!approval) {
    return [BulkBlock.UnknownApproval];
  }
  if (approval.state !== ApprovalState.Pending) {
    return [BulkBlock.NotPending];
  }
  return bulkToken(approval) === token ? bulkBlocks(approval) : [BulkBlock.Changed];
}
