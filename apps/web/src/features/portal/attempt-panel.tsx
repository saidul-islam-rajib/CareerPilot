'use client';

import { useState } from 'react';
import type { AttemptView } from '@careerpilot/api-client';
import {
  attemptCanResume,
  attemptHasProof,
  attemptStateKey,
  attemptStateTone,
  stopReasonKey,
  usePortalActions,
  usePortalAttempt,
  useT,
} from '@careerpilot/client-core';
import { Badge, Button, Card, TextField, useToast } from '@careerpilot/ui-web';

function Proof({ attempt }: { attempt: AttemptView }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="font-medium">{t('portal.attempt.proof')}</p>
      {attempt.confirmationText ? (
        <p>
          {t('portal.attempt.confirmationText')}: {attempt.confirmationText}
        </p>
      ) : null}
      {attempt.finalUrl ? (
        <p className="break-all">
          {t('portal.attempt.finalUrl')}: {attempt.finalUrl}
        </p>
      ) : null}
      {attempt.evidenceKey ? <p>{t('portal.attempt.screenshot')}</p> : null}
    </div>
  );
}

function PreparedList({ attempt }: { attempt: AttemptView }) {
  const t = useT();
  if (!attempt.prepared.length) {
    return null;
  }
  return (
    <div>
      <p className="font-medium">{t('portal.attempt.prepared')}</p>
      <ul className="list-disc pl-5 text-sm">
        {attempt.prepared.map((item) => (
          <li key={item.label}>
            {item.label}: {item.value}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AttemptPanel({ applicationId, enabled }: { applicationId: string; enabled: boolean }) {
  const t = useT();
  const toast = useToast();
  const query = usePortalAttempt(applicationId, enabled);
  const actions = usePortalActions();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const attempt = query.data;
  if (!attempt) {
    return null;
  }
  const failed = () => toast.show({ message: t('portal.attempt.failed') });
  const canResume = attemptCanResume(attempt);
  const typed = attempt.pending.filter((q) => answers[q.label]?.trim()).map((q) => ({ label: q.label, answer: answers[q.label].trim() }));
  return (
    <Card className="gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{t('portal.attempt.status')}</h3>
        <Badge tone={attemptStateTone(attempt.state)} label={t(attemptStateKey(attempt.state))} />
      </div>
      {attempt.stop ? (
        <p>
          {t('portal.attempt.reason')}: {t(stopReasonKey(attempt.stop))}
        </p>
      ) : null}
      {attemptHasProof(attempt) ? <Proof attempt={attempt} /> : null}
      {attempt.officialUrl ? (
        <a className="text-sm font-semibold text-primary underline-offset-2 hover:underline" href={attempt.officialUrl} target="_blank" rel="noreferrer">{t('portal.attempt.openOfficial')}</a>
      ) : null}
      <PreparedList attempt={attempt} />
      {attempt.submitClicked ? <p className="text-sm text-muted">{t('portal.attempt.alreadySent')}</p> : null}
      {canResume && attempt.pending.length ? (
        <div className="flex flex-col gap-2">
          <p className="font-medium">{t('portal.attempt.pending')}</p>
          {attempt.pending.map((question) => (
            <TextField
              key={question.label}
              label={question.label}
              value={answers[question.label] ?? ''}
              onChange={(event) => setAnswers({ ...answers, [question.label]: event.target.value })}
            />
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {canResume ? (
          <Button onClick={() => actions.resume.mutate({ applicationId, body: { answers: typed } }, { onError: failed })} loading={actions.resume.isPending}>
            {attempt.pending.length ? t('portal.attempt.resume') : t('portal.attempt.resumeOnly')}
          </Button>
        ) : null}
        {!attempt.submitClicked ? (
          <Button variant="outline" onClick={() => actions.complete.mutate(applicationId, { onError: failed })} loading={actions.complete.isPending}>
            {t('portal.attempt.markDone')}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
