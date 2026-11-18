import type { MatchFeedback as MatchFeedbackValue } from '@careerpilot/api-client';
import { useMatchFeedback, useT } from '@careerpilot/client-core';
import { FeedbackReason, FeedbackVerdict } from '@careerpilot/domain-ui-logic';
import { ThumbsDown, ThumbsUp } from '@/ui/icons';
import { Button, ButtonVariant, Card, Row, Section, Text, TextTone } from '@/ui';

export function MatchFeedback({ opportunityId, current }: { opportunityId: string; current?: MatchFeedbackValue }) {
  const t = useT();
  const feedback = useMatchFeedback(opportunityId, current);
  return (
    <Section title={t('feedback.title')}>
      <Card>
        <Text tone={TextTone.Muted}>{t('feedback.body')}</Text>
        <Row wrap>
          {Object.values(FeedbackReason).map((reason) => (
            <Button
              key={reason}
              label={t(`feedback.reason.${reason}`)}
              variant={feedback.reasons.includes(reason) ? ButtonVariant.Primary : ButtonVariant.Outline}
              onPress={() => feedback.toggle(reason)}
              testID={`feedback-reason-${reason}`}
            />
          ))}
        </Row>
        <Row wrap>
          <Button
            icon={ThumbsUp}
            label={t('feedback.good')}
            variant={feedback.verdict === FeedbackVerdict.GoodMatch ? ButtonVariant.Primary : ButtonVariant.Outline}
            disabled={feedback.saving}
            onPress={() => feedback.give(FeedbackVerdict.GoodMatch)}
            testID="feedback-good"
          />
          <Button
            icon={ThumbsDown}
            label={t('feedback.notForMe')}
            variant={feedback.verdict === FeedbackVerdict.NotForMe ? ButtonVariant.Primary : ButtonVariant.Outline}
            disabled={feedback.saving}
            onPress={() => feedback.give(FeedbackVerdict.NotForMe)}
            testID="feedback-not-for-me"
          />
        </Row>
        {feedback.verdict ? (
          <Button label={t('feedback.clear')} variant={ButtonVariant.Ghost} disabled={feedback.saving} onPress={feedback.clear} testID="feedback-clear" />
        ) : null}
        {feedback.failed ? <Text tone={TextTone.Danger}>{t('feedback.failed')}</Text> : null}
      </Card>
    </Section>
  );
}
