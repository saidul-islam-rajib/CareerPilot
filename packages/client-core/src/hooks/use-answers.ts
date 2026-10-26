import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QuestionBank, SavedAnswer, SavedAnswerInput } from '@careerpilot/api-client';
import { AnswerTopic } from '@careerpilot/domain-ui-logic';
import { ValidationMessage, type FieldErrors } from '@careerpilot/validation';
import { usePublicConfig } from '../config/public-config';
import { useT } from '../i18n/i18n';
import { queryKeys } from '../query/query-keys';
import { useApi } from '../services/app-services';
import { profileErrorKey } from './use-profile';

export function useQuestionBank() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.questionBank, queryFn: () => api.answers.getQuestionBank() });
}

export function useAnswerActions() {
  const api = useApi();
  const client = useQueryClient();
  const onSuccess = async (bank: QuestionBank) => {
    client.setQueryData(queryKeys.questionBank, bank);
    await client.invalidateQueries({ queryKey: queryKeys.approvals });
    await client.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'approval' });
  };
  return {
    add: useMutation({ mutationFn: (input: SavedAnswerInput) => api.answers.addAnswer(input), onSuccess }),
    edit: useMutation({ mutationFn: ({ id, input }: { id: string; input: SavedAnswerInput }) => api.answers.editAnswer(id, input), onSuccess }),
    remove: useMutation({ mutationFn: (id: string) => api.answers.removeAnswer(id), onSuccess }),
    restore: useMutation({ mutationFn: (id: string) => api.answers.restoreAnswer(id), onSuccess }),
  };
}

export function topicQuestion(topic: AnswerTopic, translate: (key: string) => string): string {
  return topic === AnswerTopic.Other ? '' : translate(`answers.topicQuestions.${topic}`);
}

export function useSavedAnswerForm({ answer, defaults, onSaved }: { answer?: SavedAnswer; defaults?: Partial<SavedAnswerInput>; onSaved?: () => void } = {}) {
  const t = useT();
  const { config } = usePublicConfig();
  const actions = useAnswerActions();
  const initialTopic = answer?.topic ?? defaults?.topic ?? AnswerTopic.Other;
  const [values, setValues] = useState<SavedAnswerInput>({
    topic: initialTopic,
    question: answer?.question ?? defaults?.question ?? topicQuestion(initialTopic, t),
    answer: answer?.answer ?? defaults?.answer ?? '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const mutation = answer ? actions.edit : actions.add;

  const setTopic = (topic: AnswerTopic) =>
    setValues((current) => {
      const untouched = !current.question.trim() || current.question === topicQuestion(current.topic, t);
      return { ...current, topic, question: untouched ? topicQuestion(topic, t) : current.question };
    });

  const submit = () => {
    const found: FieldErrors = {};
    if (!values.question.trim()) {
      found.question = ValidationMessage.Required;
    }
    if (!values.answer.trim()) {
      found.answer = ValidationMessage.Required;
    }
    setErrors(found);
    if (Object.keys(found).length > 0) {
      return;
    }
    const done = { onSuccess: () => onSaved?.() };
    if (answer) {
      actions.edit.mutate({ id: answer.id, input: values }, done);
    } else {
      actions.add.mutate(values, done);
    }
  };

  return {
    values,
    errors,
    limits: config.answers,
    answerMaxLength: config.validationPolicy.answer.maxLength,
    setTopic,
    setField: (field: 'question' | 'answer', value: string) => {
      setValues((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
    },
    submit,
    saving: mutation.isPending,
    formError: mutation.error ? profileErrorKey(mutation.error) : undefined,
  };
}
