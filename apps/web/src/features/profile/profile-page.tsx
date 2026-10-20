'use client';

import { BadgeCheck, FileText, GraduationCap, Mail, Phone, Star } from 'lucide-react';
import type { Contact } from '@careerpilot/api-client';
import { sortContacts, useFormat, useProfile, useReorderContacts, useSetPrimaryContact, useT } from '@careerpilot/client-core';
import { ContactKind, StatusTone } from '@careerpilot/domain-ui-logic';
import { Avatar, Badge, Button, Card, ErrorState, ImageViewer, ListRow, LoadingState, ProgressBar, Section, SortableList } from '@careerpilot/ui-web';

const PERCENT = 100;

function ContactRow({ contact, onMakePrimary }: { contact: Contact; onMakePrimary: () => void }) {
  const t = useT();
  const Glyph = contact.kind === ContactKind.Email ? Mail : Phone;
  return (
    <div className="flex items-center gap-3 py-1">
      <Glyph className="size-5 shrink-0 text-primary" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">{contact.value}</span>
        <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {contact.label}
          {contact.verified ? <BadgeCheck className="size-4 text-success" aria-hidden /> : null}
          {contact.isPrimary ? <Badge label={t('common.primary')} tone={StatusTone.Primary} /> : null}
        </span>
      </div>
      {contact.isPrimary ? null : <Button variant="ghost" size="icon" icon={Star} aria-label={`${t('common.makePrimary')}: ${contact.value}`} onClick={onMakePrimary} />}
    </div>
  );
}

export function ProfilePage() {
  const t = useT();
  const format = useFormat();
  const profile = useProfile();
  const reorder = useReorderContacts();
  const setPrimary = useSetPrimaryContact();

  if (profile.isPending) {
    return <LoadingState />;
  }
  if (profile.isError) {
    return <ErrorState onRetry={() => void profile.refetch()} />;
  }
  const p = profile.data;

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
      <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <Card className="items-center text-center">
          {p.photoUrl ? (
            <ImageViewer
              src={p.photoUrl}
              title={t('profile.photo')}
              trigger={
                <button type="button" aria-label={`${t('profile.photo')}. ${t('profile.tapToZoom')}`} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                  <Avatar name={p.fullName} src={p.photoUrl} className="size-32" />
                </button>
              }
            />
          ) : (
            <Avatar name={p.fullName} className="size-32" />
          )}
          <h1 className="text-2xl font-bold">{p.fullName}</h1>
          <p className="text-muted">{p.headline}</p>
          <div className="w-full text-left">
            <ProgressBar value={p.completeness / PERCENT} label={t('profile.completeness', { percent: p.completeness })} />
          </div>
        </Card>
        {p.signatureUrl ? (
          <Card>
            <h2 className="font-semibold">{t('profile.signature')}</h2>
            <ImageViewer
              src={p.signatureUrl}
              title={t('profile.signature')}
              trigger={
                <button type="button" aria-label={`${t('profile.signature')}. ${t('profile.tapToZoom')}`} className="rounded-control bg-surface p-2">
                  <img src={p.signatureUrl} alt="" className="w-full" />
                </button>
              }
            />
            <p className="text-xs text-muted">{t('profile.tapToZoom')}</p>
          </Card>
        ) : null}
      </aside>

      <div className="flex flex-col gap-6">
        <Section title={t('profile.contacts')}>
          <Card>
            <p className="text-xs text-muted">{t('common.dragToReorder')}</p>
            <SortableList
              items={sortContacts(p.contacts)}
              keyOf={(c) => c.id}
              labelOf={(c) => c.value}
              onReorder={reorder.move}
              renderItem={(contact) => <ContactRow contact={contact} onMakePrimary={() => setPrimary.mutate(contact.id)} />}
            />
          </Card>
        </Section>
        <Section title={t('profile.experience')}>
          <Card className="divide-y divide-border">
            {p.experience.map((item) => (
              <div key={item.id} className="flex flex-col gap-1 py-2">
                <p className="font-semibold">{item.title}</p>
                <p className="text-sm text-muted">
                  {item.organization} · {format.date(item.start)} – {item.end ? format.date(item.end) : t('profile.present')}
                </p>
                <p>{item.summary}</p>
              </div>
            ))}
          </Card>
        </Section>
        <Section title={t('profile.education')}>
          <Card>
            {p.education.map((item) => (
              <ListRow
                key={item.id}
                icon={GraduationCap}
                title={item.degree}
                subtitle={[item.institution, `${item.startYear}–${item.endYear ?? t('profile.present')}`, item.result].filter(Boolean).join(' · ')}
              />
            ))}
          </Card>
        </Section>
        <Section title={t('profile.skills')}>
          <div className="flex flex-wrap gap-2">
            {p.skills.map((skill) => (
              <Badge key={skill} label={skill} tone={StatusTone.Primary} />
            ))}
          </div>
        </Section>
        <Section title={t('profile.documents')}>
          <Card>
            {p.documents.map((doc) => (
              <ListRow key={doc.id} icon={FileText} title={doc.name} subtitle={`${t('profile.version', { version: doc.version })} · ${t('common.updatedAt', { date: format.date(doc.updatedAt) })}`} />
            ))}
          </Card>
        </Section>
      </div>
    </div>
  );
}
