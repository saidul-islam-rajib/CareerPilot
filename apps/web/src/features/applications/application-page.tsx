'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Archive, FileText, Mail, Pencil, ShieldCheck } from 'lucide-react';
import { useApplication, useFormat, useT } from '@careerpilot/client-core';
import { EnumKey, TimelineActor } from '@careerpilot/domain-ui-logic';
import { Button, Card, EnumBadge, ErrorState, ListRow, LoadingState, PageHeader, Section, cn } from '@careerpilot/ui-web';
import { Routes } from '@/core/routes';
import { FollowUpsSection, OutcomeDialog } from './follow-ups';

const KILOBYTE = 1024;
const DOT_CLASSES: Record<TimelineActor, string> = {
  system: 'bg-primary',
  user: 'bg-accent',
  employer: 'bg-success',
  admin: 'bg-neutral',
};

export function ApplicationPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const format = useFormat();
  const application = useApplication(id);
  const [editingOutcome, setEditingOutcome] = useState(0);

  if (application.isPending) {
    return <LoadingState />;
  }
  if (application.isError) {
    return <ErrorState onRetry={() => void application.refetch()} />;
  }
  const a = application.data;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <PageHeader title={a.opportunity.title} description={`${a.opportunity.organization} · ${a.opportunity.location}`} />
        <FollowUpsSection application={a} />
        <Section title={t('applications.timeline')}>
          <Card>
            <ol className="flex flex-col">
              {a.timeline.map((entry, index) => (
                <li key={`${entry.at}-${index}`} className="flex gap-3">
                  <span className="flex flex-col items-center">
                    <span className={cn('mt-1.5 size-3 rounded-full', DOT_CLASSES[entry.actor])} />
                    {index < a.timeline.length - 1 ? <span className="w-0.5 flex-1 bg-border" /> : null}
                  </span>
                  <span className="flex flex-1 flex-col gap-1 pb-4">
                    <span>{entry.text}</span>
                    <span className="text-xs text-muted">{format.dateTime(entry.at)}</span>
                    {entry.status ? <EnumBadge enumKey={EnumKey.SubmissionStatus} value={entry.status} /> : null}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </Section>
        {a.questions.length > 0 ? (
          <Section title={t('applications.questions')}>
            <Card className="divide-y divide-border">
              {a.questions.map((qa) => (
                <div key={qa.id} className="flex flex-col gap-1 py-2">
                  <p className="font-semibold">{qa.question}</p>
                  <p className="whitespace-pre-wrap">{qa.answer}</p>
                </div>
              ))}
            </Card>
          </Section>
        ) : null}
        {a.emails.length > 0 ? (
          <Section title={t('applications.emails')}>
            {a.emails.map((email) => (
              <Card key={email.sentAt}>
                <ListRow icon={Mail} title={email.subject} subtitle={`${email.to} · ${format.dateTime(email.sentAt)}`} />
                <p className="whitespace-pre-wrap text-muted">{email.body}</p>
              </Card>
            ))}
          </Section>
        ) : null}
      </div>
      <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <Card>
          <ListRow title={t('applications.submission')} trailing={<EnumBadge enumKey={EnumKey.SubmissionStatus} value={a.submissionStatus} />} />
          <ListRow title={t('applications.outcome')} trailing={<EnumBadge enumKey={EnumKey.OutcomeStatus} value={a.outcomeStatus} />} />
          {a.lastContactAt ? <p className="text-sm text-muted">{t('applications.lastContact', { date: format.date(a.lastContactAt) })}</p> : null}
          <Button variant="outline" size="sm" icon={Pencil} onClick={() => setEditingOutcome((n) => n + 1)}>
            {t('applications.updateOutcome')}
          </Button>
          <ListRow title={t('opportunity.route')} trailing={<EnumBadge enumKey={EnumKey.ApplicationRoute} value={a.route} />} />
          {a.appliedAt ? <p className="text-sm text-muted">{t('applications.appliedOn', { date: format.dateTime(a.appliedAt) })}</p> : null}
        </Card>
        <Card>
          <h2 className="font-semibold">{t('applications.evidence')}</h2>
          {a.evidence.length === 0 ? <p className="text-sm text-muted">{t('applications.noEvidence')}</p> : null}
          {a.evidence.map((item) => (
            <ListRow key={item.at} icon={ShieldCheck} title={item.text} subtitle={format.dateTime(item.at)} />
          ))}
        </Card>
        <Card>
          <h2 className="font-semibold">{t('applications.files')}</h2>
          {a.files.map((file) => (
            <ListRow
              key={file.name}
              icon={FileText}
              title={file.name}
              subtitle={`${t('profile.version', { version: file.version })}${file.sizeBytes > 0 ? ` · ${t('common.kilobytes', { value: Math.round(file.sizeBytes / KILOBYTE) })}` : ''}`}
            />
          ))}
        </Card>
        <Card>
          <ListRow icon={Archive} title={t('applications.circular')} subtitle={t('opportunity.circularArchived', { date: format.date(a.circular.archivedAt) })} href={Routes.circular(a.opportunity.id)} />
        </Card>
      </aside>
      {editingOutcome > 0 ? <OutcomeDialog key={editingOutcome} application={a} onClose={() => setEditingOutcome(0)} /> : null}
    </div>
  );
}
