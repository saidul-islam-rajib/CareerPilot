import { describe, expect, it } from 'vitest';
import { AnswerTopic } from '@careerpilot/domain-ui-logic';
import { isApiError } from '../errors';
import { createTestApi } from '../test-support';
import { AnswerSource } from '../types';

async function detail(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e);
  return isApiError(error) ? error.detail : undefined;
}

describe('in-memory saved answers', () => {
  it('groups questions by meaning and highlights the ones that block an approval', async () => {
    const api = createTestApi();
    const bank = await api.answers.getQuestionBank();
    const notice = bank.groups.find((g) => g.key === AnswerTopic.NoticePeriod);
    expect(notice).toMatchObject({ count: 5, lastAnswer: '30 days', savedAnswerId: 'ans_notice' });
    expect(bank.groups[0]).toMatchObject({ topic: AnswerTopic.Relocation, needsAnswer: true });
    expect(await detail(api.approvals.approve('apr_oslo'))).toBe('unanswered_questions');
  });

  it('fills blank questions when an answer is saved and supports undo', async () => {
    const api = createTestApi();
    const bank = await api.answers.addAnswer({ topic: AnswerTopic.Relocation, question: 'Are you willing to relocate?', answer: 'Yes, within Europe' });
    expect(bank.groups.find((g) => g.topic === AnswerTopic.Relocation)?.needsAnswer).toBe(false);
    const oslo = await api.approvals.getApproval('apr_oslo');
    expect(oslo.materials.answers.find((a) => a.id === 'q_relocate')).toMatchObject({ answer: 'Yes, within Europe', source: AnswerSource.Saved });
    expect(oslo.materials.answers.find((a) => a.id === 'q_start')?.source).toBe(AnswerSource.User);
    const saved = bank.saved.find((a) => a.topic === AnswerTopic.Relocation);
    const removed = await api.answers.removeAnswer(saved?.id ?? '');
    expect(removed.saved.map((a) => a.id)).not.toContain(saved?.id);
    expect((await api.answers.restoreAnswer(saved?.id ?? '')).saved.map((a) => a.id)).toContain(saved?.id);
    expect(await detail(api.answers.addAnswer({ topic: AnswerTopic.Other, question: ' ', answer: 'x' }))).toBe('question');
    expect((await api.approvals.approve('apr_oslo')).state).toBe('approved');
  });

  it('saves an approval answer for reuse', async () => {
    const api = createTestApi();
    await api.approvals.updateAnswer('apr_oslo', 'q_relocate', 'Yes', true);
    const bank = await api.answers.getQuestionBank();
    expect(bank.saved.find((a) => a.topic === AnswerTopic.Relocation)).toMatchObject({ question: 'Are you willing to relocate to Oslo?', answer: 'Yes' });
    expect(await detail(api.answers.removeAnswer('ans_missing'))).toBe('answer');
  });
});
