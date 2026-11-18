'use client';

import { ThumbsDown, ThumbsUp } from 'lucide-react';
import type { MatchFeedback as MatchFeedbackValue } from '@careerpilot/api-client';
import { useMatchFeedback, useT } from '@careerpilot/client-core';
import { FeedbackReason, FeedbackVerdict } from '@careerpilot/domain-ui-logic';
import { Button, Card, Section } from '@careerpilot/ui-web';

export function MatchFeedback({ opportunityId, current }: { opportunityId: string; current?: MatchFeedbackValue }) {
  const t = useT();
  const feedback = useMatchFeedback(opportunityId, current);
  return (
    <Section title={t('feedback.title')}>
      <Card className="gap-3">
        <p className="text-muted">{t('feedback.body')}</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('feedback.reasons')}>
          {Object.values(FeedbackReason).map((reason) => (
            <Button
              key={reason}
              variant={feedback.reasons.includes(reason) ? 'primary' : 'outline'}
              aria-pressed={feedback.reasons.includes(reason)}
              onClick={() => feedback.toggle(reason)}
            >
              {t(`feedback.reason.${reason}`)}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            icon={ThumbsUp}
            variant={feedback.verdict === FeedbackVerdict.GoodMatch ? 'primary' : 'outline'}
            disabled={feedback.saving}
            onClick={() => feedback.give(FeedbackVerdict.GoodMatch)}
          >
            {t('feedback.good')}
          </Button>
          <Button
            icon={ThumbsDown}
            variant={feedback.verdict === FeedbackVerdict.NotForMe ? 'primary' : 'outline'}
            disabled={feedback.saving}
            onClick={() => feedback.give(FeedbackVerdict.NotForMe)}
          >
            {t('feedback.notForMe')}
          </Button>
          {feedback.verdict ? (
            <Button variant="ghost" disabled={feedback.saving} onClick={feedback.clear}>
              {t('feedback.clear')}
            </Button>
          ) : null}
        </div>
        {feedback.failed ? <p role="alert">{t('feedback.failed')}</p> : null}
      </Card>
    </Section>
  );
}
