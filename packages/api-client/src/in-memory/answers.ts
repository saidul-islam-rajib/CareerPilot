import { AnswerTopic, ApprovalState } from '@careerpilot/domain-ui-logic';
import { ApiError, ApiErrorCode } from '../errors';
import type { Clock, IdGenerator } from '../ports';
import { AnswerSource, type ApplicationRecord, type ApprovalDetail, type PublicConfig, type QuestionAnswer, type QuestionBank, type QuestionGroup, type SavedAnswer, type SavedAnswerInput, type TopicKeywords } from '../types';

const NON_WORD = /[^\p{L}\p{N}\s]+/gu;
const SPACES = /\s+/g;

export interface StoredAnswer extends SavedAnswer {
  deletedAt?: string;
}

export interface AnswerOptions {
  saved: StoredAnswer[];
  approvals: ApprovalDetail[];
  applications: ApplicationRecord[];
  config: PublicConfig;
  clock: Clock;
  ids: IdGenerator;
  respond: <T>(value: T) => Promise<T>;
  reject: (code: ApiErrorCode, detail?: string) => Promise<never>;
}

export function normalise(question: string): string {
  return question.toLowerCase().replace(NON_WORD, ' ').replace(SPACES, ' ').trim();
}

export function detectTopic(question: string, keywords: TopicKeywords[]): AnswerTopic {
  const text = normalise(question);
  return keywords.find((entry) => entry.keywords.some((word) => text.includes(normalise(word))))?.topic ?? AnswerTopic.Other;
}

export function groupKey(topic: AnswerTopic, question: string): string {
  return topic === AnswerTopic.Other ? `${topic}:${normalise(question)}` : topic;
}

export function hasBlankAnswers(answers: QuestionAnswer[]): boolean {
  return answers.some((item) => !item.answer.trim());
}

function invalid(detail: string): never {
  throw new ApiError(ApiErrorCode.Validation, 422, detail);
}

function missing(detail: string): never {
  throw new ApiError(ApiErrorCode.NotFound, 404, detail);
}

export function createAnswers(options: AnswerOptions) {
  const { saved, approvals, applications, config, clock, ids } = options;
  const settings = config.answers;
  const keywords = settings.topicKeywords;
  const active = () => saved.filter((a) => a.deletedAt === undefined);
  const keyOf = (question: string) => groupKey(detectTopic(question, keywords), question);
  const nowIso = () => clock.now().toISOString();

  function fillBlanks(): void {
    const byKey = new Map(active().map((a) => [groupKey(a.topic, a.question), a]));
    for (const approval of approvals.filter((a) => a.state === ApprovalState.Pending)) {
      for (const item of approval.materials.answers) {
        const match = byKey.get(keyOf(item.question));
        if (!item.answer.trim() && match) {
          item.answer = match.answer;
          item.source = AnswerSource.Saved;
        }
      }
    }
  }

  function upsert(input: SavedAnswerInput): void {
    const now = nowIso();
    const key = groupKey(input.topic, input.question);
    const existing = active().find((a) => groupKey(a.topic, a.question) === key);
    if (existing) {
      Object.assign(existing, { question: input.question, answer: input.answer, updatedAt: now });
      return;
    }
    if (active().length >= settings.maxSavedAnswers) {
      invalid('saved_answers');
    }
    saved.push({ id: ids.next('ans'), ...input, createdAt: now, updatedAt: now });
  }

  function checked(input: SavedAnswerInput): SavedAnswerInput {
    const question = input.question.replace(SPACES, ' ').trim();
    const answer = input.answer.trim();
    if (!question || question.length > settings.questionMaxLength) {
      invalid('question');
    }
    if (!answer || answer.length > config.validationPolicy.answer.maxLength) {
      invalid('answer');
    }
    return { topic: input.topic, question, answer };
  }

  function bank(): QuestionBank {
    const groups = new Map<string, QuestionGroup>();
    const asked: Array<[QuestionAnswer, boolean]> = [
      ...[...approvals].reverse().flatMap((approval) => approval.materials.answers.map((item): [QuestionAnswer, boolean] => [item, approval.state === ApprovalState.Pending])),
      ...[...applications].reverse().flatMap((record) => record.questions.map((item): [QuestionAnswer, boolean] => [item, false])),
    ];
    for (const [item, pending] of asked) {
      const key = keyOf(item.question);
      const group = groups.get(key) ?? { key, topic: detectTopic(item.question, keywords), question: item.question, count: 0, lastAnswer: '', needsAnswer: false };
      group.count += 1;
      if (item.answer.trim()) {
        group.lastAnswer = item.answer;
        group.lastSource = item.source;
      }
      group.needsAnswer = group.needsAnswer || (pending && !item.answer.trim());
      groups.set(key, group);
    }
    const savedIds = new Map(active().map((a) => [groupKey(a.topic, a.question), a.id]));
    const views = [...groups.values()].map((group) => {
      const savedAnswerId = savedIds.get(group.key);
      return savedAnswerId ? { ...group, savedAnswerId } : group;
    });
    views.sort((a, b) => Number(a.needsAnswer === false) - Number(b.needsAnswer === false) || b.count - a.count || a.question.localeCompare(b.question));
    return {
      saved: active()
        .map(({ deletedAt, ...answer }) => answer)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      groups: views,
    };
  }

  async function change(apply: () => void): Promise<QuestionBank> {
    try {
      apply();
      fillBlanks();
      return options.respond(bank());
    } catch (error) {
      if (error instanceof ApiError) {
        return options.reject(error.code, error.detail);
      }
      throw error;
    }
  }

  const find = (id: string) => active().find((a) => a.id === id) ?? missing('answer');

  return {
    api: {
      getQuestionBank: () => options.respond(bank()),
      addAnswer: (input: SavedAnswerInput) => change(() => upsert(checked(input))),
      editAnswer: (id: string, input: SavedAnswerInput) =>
        change(() => {
          Object.assign(find(id), checked(input), { updatedAt: nowIso() });
        }),
      removeAnswer: (id: string) =>
        change(() => {
          find(id).deletedAt = nowIso();
        }),
      restoreAnswer: (id: string) =>
        change(() => {
          const removed = saved.find((a) => a.id === id && a.deletedAt !== undefined) ?? missing('answer');
          delete removed.deletedAt;
        }),
    },
    saveFromApproval(question: string, answer: string): void {
      upsert({ topic: detectTopic(question, keywords), question, answer });
      fillBlanks();
    },
    fillBlanks,
  };
}
