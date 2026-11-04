'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Eraser, FilePlus2, Link2Off, PenLine, RefreshCw, Save, Sparkles, Trash2 } from 'lucide-react';
import {
  issueMessage,
  KIND_ORDER,
  sourceLabel,
  useApprovals,
  useDrafts,
  useFormat,
  useOpportunity,
  useT,
  useWritingActions,
  useWritingStatus,
  versionsOf,
  writingErrorKey,
} from '@careerpilot/client-core';
import type { WritingDraft } from '@careerpilot/api-client';
import { DraftStatus, IssueKind, StatusTone, WritingKind, WritingTone } from '@careerpilot/domain-ui-logic';
import {
  Badge,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  LoadingState,
  PageHeader,
  Section,
  SelectField,
  Segmented,
  TextAreaField,
  TextField,
} from '@careerpilot/ui-web';

const FLAGGED_KINDS: readonly IssueKind[] = [IssueKind.UnsupportedClaim, IssueKind.OtherEmployer];

function DraftEditor({ draft, approvalId, opportunityId, onSelect }: { draft: WritingDraft; approvalId?: string; opportunityId: string; onSelect: (id: string) => void }) {
  const t = useT();
  const format = useFormat();
  const actions = useWritingActions(opportunityId);
  const [text, setText] = useState(draft.text);
  const changed = text.trim() !== draft.text.trim();
  const attached = approvalId ? draft.attachedApprovalIds.includes(approvalId) : false;
  const failure = [actions.edit, actions.attach, actions.detach, actions.recheck, actions.stripFlagged, actions.remove].find((m) => m.isError)?.error;
  const flagged = draft.issues.some((issue) => FLAGGED_KINDS.includes(issue.kind));
  return (
    <Card className="gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold">{t('writing.version', { version: draft.version })}</h3>
        <Badge label={sourceLabel(t, draft)} tone={StatusTone.Info} />
        <Badge label={t('writing.wordCount', { count: draft.wordCount })} />
        {attached ? <Badge label={t('writing.attached')} tone={StatusTone.Success} /> : null}
        <span className="text-sm text-muted">{format.dateTime(draft.createdAt)}</span>
      </div>
      {failure ? <Banner tone={StatusTone.Danger} icon={AlertTriangle} title={t(writingErrorKey(failure))} /> : null}
      <TextAreaField label={t('writing.textLabel')} value={text} onChange={(event) => setText(event.target.value)} rows={14} />
      <div className="flex flex-wrap gap-2">
        <Button icon={Save} variant="secondary" disabled={!changed} loading={actions.edit.isPending} onClick={() => actions.edit.mutate({ id: draft.id, text }, { onSuccess: (next) => onSelect(next.id) })}>
          {actions.edit.isPending ? t('writing.saving') : t('writing.saveVersion')}
        </Button>
        {approvalId && !attached ? (
          <Button icon={FilePlus2} disabled={changed || draft.status !== DraftStatus.Ready} loading={actions.attach.isPending} onClick={() => actions.attach.mutate({ id: draft.id, approvalId })}>
            {t('writing.attach')}
          </Button>
        ) : null}
        {approvalId && attached ? (
          <Button icon={Link2Off} variant="outline" loading={actions.detach.isPending} onClick={() => actions.detach.mutate({ id: draft.id, approvalId })}>
            {t('writing.detach')}
          </Button>
        ) : null}
        <Button icon={RefreshCw} variant="outline" loading={actions.recheck.isPending} onClick={() => actions.recheck.mutate(draft.id)}>
          {t('writing.recheck')}
        </Button>
        <ConfirmDialog
          title={t('writing.remove')}
          body={t('writing.removeConfirm')}
          confirmLabel={t('common.delete')}
          destructive
          onConfirm={() => actions.remove.mutate(draft.id)}
          trigger={
            <Button icon={Trash2} variant="outline">
              {t('writing.remove')}
            </Button>
          }
        />
      </div>
      <Section title={t('writing.checksHeading')}>
        {draft.issues.length === 0 ? (
          <Banner tone={StatusTone.Success} icon={CheckCircle2} title={t('writing.checksPassed')} />
        ) : (
          <div className="flex flex-col gap-3">
            <Banner tone={StatusTone.Warning} icon={AlertTriangle} title={t('writing.checksFailed')} />
            <ul className="flex flex-col gap-2">
              {draft.issues.map((issue, index) => (
                <li key={`${issue.kind}-${index}`} className="rounded-control border border-warning p-3 text-sm whitespace-pre-wrap">
                  {issueMessage(t, issue)}
                </li>
              ))}
            </ul>
            {flagged ? (
              <Button icon={Eraser} variant="secondary" loading={actions.stripFlagged.isPending} onClick={() => actions.stripFlagged.mutate(draft.id, { onSuccess: (next) => onSelect(next.id) })}>
                {t('writing.removeFlagged')}
              </Button>
            ) : null}
          </div>
        )}
      </Section>
      <Section title={t('writing.factsHeading')}>
        {draft.factsUsed.length === 0 ? (
          <p className="text-sm text-muted">{t('writing.noFacts')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {draft.factsUsed.map((fact) => (
              <Badge key={fact.id} label={fact.label} />
            ))}
          </div>
        )}
      </Section>
    </Card>
  );
}

export function WritingPage() {
  const { opportunityId } = useParams<{ opportunityId: string }>();
  const t = useT();
  const format = useFormat();
  const opportunity = useOpportunity(opportunityId);
  const status = useWritingStatus();
  const drafts = useDrafts(opportunityId);
  const approvals = useApprovals();
  const actions = useWritingActions(opportunityId);
  const [kind, setKind] = useState<WritingKind>(WritingKind.CoverLetter);
  const [tone, setTone] = useState<WritingTone>(WritingTone.Professional);
  const [words, setWords] = useState('');
  const [instructions, setInstructions] = useState('');
  const [selected, setSelected] = useState<string | undefined>(undefined);

  if (opportunity.isPending || status.isPending || drafts.isPending) {
    return <LoadingState />;
  }
  if (opportunity.isError || status.isError || drafts.isError) {
    return <ErrorState onRetry={() => void Promise.all([opportunity.refetch(), status.refetch(), drafts.refetch()])} />;
  }
  const o = opportunity.data;
  const rule = status.data.kinds.find((item) => item.kind === kind);
  const versions = versionsOf(drafts.data, kind);
  const current = versions.find((draft) => draft.id === selected) ?? versions[0];
  const approvalId = approvals.data?.find((approval) => approval.opportunity.id === opportunityId)?.id;
  const requestedWords = Number(words);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('writing.title')} description={t('writing.opportunityHeading', { title: o.title, organization: o.organization })} />
      {status.data.aiConfigured ? (
        <Banner tone={StatusTone.Info} icon={Sparkles} title={t('writing.aiConfigured', { model: status.data.model ?? '' })} />
      ) : (
        <Banner tone={StatusTone.Warning} icon={AlertTriangle} title={t('writing.aiNotConfigured')} />
      )}
      {approvals.isSuccess && !approvalId ? <Banner tone={StatusTone.Neutral} icon={AlertTriangle} title={t('writing.noPendingApplication')} /> : null}
      <Segmented
        label={t('writing.kindLabel')}
        value={kind}
        onChange={(next) => {
          setKind(next);
          setSelected(undefined);
          setWords('');
        }}
        options={KIND_ORDER.map((value) => {
          const item = status.data.kinds.find((k) => k.kind === value);
          return { value, label: item && !item.available ? `${t(`writing.kinds.${value}`)} · ${t('writing.needsAi')}` : t(`writing.kinds.${value}`) };
        })}
      />
      <Card className="gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            label={t('writing.toneLabel')}
            value={tone}
            onValueChange={(value) => setTone(value as WritingTone)}
            options={status.data.tones.map((value) => ({ value, label: t(`writing.tones.${value}`) }))}
          />
          <TextField
            label={t('writing.wordsLabel')}
            type="number"
            inputMode="numeric"
            min={1}
            max={rule?.maxWords}
            placeholder={rule ? String(rule.defaultWords) : undefined}
            value={words}
            onChange={(event) => setWords(event.target.value)}
          />
        </div>
        <TextAreaField
          label={t('writing.instructionsLabel')}
          hint={t('writing.instructionsHint')}
          value={instructions}
          maxLength={status.data.maxInstructionChars}
          onChange={(event) => setInstructions(event.target.value)}
        />
        {rule && !rule.available ? <Banner tone={StatusTone.Warning} icon={AlertTriangle} title={t('writing.aiOnlyUnavailable')} /> : null}
        {actions.generate.isError ? <Banner tone={StatusTone.Danger} icon={AlertTriangle} title={t(writingErrorKey(actions.generate.error))} /> : null}
        <div>
          <Button
            icon={PenLine}
            disabled={!rule?.available}
            loading={actions.generate.isPending}
            onClick={() =>
              actions.generate.mutate(
                { kind, tone, maxWords: requestedWords > 0 ? requestedWords : undefined, instructions: instructions.trim() || undefined },
                { onSuccess: (draft) => setSelected(draft.id) },
              )
            }
          >
            {actions.generate.isPending ? t('writing.generating') : t('writing.generate')}
          </Button>
        </div>
      </Card>
      <Section title={t('writing.draftsHeading')}>
        {versions.length === 0 ? (
          <p className="text-muted">{t('writing.noDrafts')}</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
            <nav aria-label={t('writing.versionsHeading')} className="flex flex-col gap-2">
              {versions.map((draft) => (
                <Button
                  key={draft.id}
                  variant={draft.id === current?.id ? 'secondary' : 'outline'}
                  aria-current={draft.id === current?.id ? 'true' : undefined}
                  onClick={() => setSelected(draft.id)}
                  className="justify-between"
                >
                  <span>{t('writing.version', { version: draft.version })}</span>
                  <span className="text-xs text-muted">{format.dateTime(draft.createdAt)}</span>
                </Button>
              ))}
            </nav>
            {current ? <DraftEditor key={current.id} draft={current} approvalId={approvalId} opportunityId={opportunityId} onSelect={setSelected} /> : null}
          </div>
        )}
      </Section>
    </div>
  );
}
