'use client';

import { useState } from 'react';
import type { AgeRelaxation, Circular, CircularContent, ExamRequirement, GovPost, Quota } from '@careerpilot/api-client';
import { emptyCircularContent, emptyPost, isApiError } from '@careerpilot/api-client';
import { enumLabelKey, useT } from '@careerpilot/client-core';
import { BdExam, CircularStatus, DistrictBasis, QuotaKind, ResultScale, SpecialStatus, StatusTone } from '@careerpilot/domain-ui-logic';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, LoadingState, PageHeader, Section, SelectField, TextField, useToast } from '@careerpilot/ui-web';
import { useAdminCirculars, useAdminGovernmentReference, useAdminHolidays, useCircularActions } from './use-government-admin';

const LINES = /\r?\n/;
const COMMA = ',';
const NONE = '';

function list(value: string, separator: string | RegExp): string[] {
  return value.split(separator).map((part) => part.trim()).filter(Boolean);
}

function numberOrUndefined(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value);
}

function enumOptions(enumKey: string, values: readonly string[], t: (key: string) => string) {
  return values.map((value) => ({ value, label: t(enumLabelKey(enumKey, value)) }));
}

function PostEditor({ post, onChange, onRemove }: { post: GovPost; onChange: (next: GovPost) => void; onRemove: () => void }) {
  const t = useT();
  const exam = (index: number, change: Partial<ExamRequirement>) =>
    onChange({ ...post, education: post.education.map((item, at) => (at === index ? { ...item, ...change } : item)) });
  const relaxation = (index: number, change: Partial<AgeRelaxation>) =>
    onChange({ ...post, age: { ...post.age, relaxations: post.age.relaxations.map((item, at) => (at === index ? { ...item, ...change } : item)) } });
  return (
    <Card className="gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <TextField label={t('government.admin.postTitle')} value={post.title} onChange={(event) => onChange({ ...post, title: event.target.value })} />
        <TextField label={t('government.admin.grade')} type="number" value={post.grade ?? ''} onChange={(event) => onChange({ ...post, grade: numberOrUndefined(event.target.value) })} />
        <TextField label={t('government.admin.vacancies')} type="number" value={post.vacancies ?? ''} onChange={(event) => onChange({ ...post, vacancies: numberOrUndefined(event.target.value) })} />
        <TextField label={t('government.admin.location')} value={post.location} onChange={(event) => onChange({ ...post, location: event.target.value })} />
        <TextField label={t('government.admin.minAge')} type="number" value={post.age.minYears ?? ''} onChange={(event) => onChange({ ...post, age: { ...post.age, minYears: numberOrUndefined(event.target.value) } })} />
        <TextField label={t('government.admin.maxAge')} type="number" value={post.age.maxYears ?? ''} onChange={(event) => onChange({ ...post, age: { ...post.age, maxYears: numberOrUndefined(event.target.value) } })} />
      </div>
      <p className="font-medium">{t('government.admin.relaxations')}</p>
      {post.age.relaxations.map((item, index) => (
        <div key={`${item.status}-${index}`} className="grid gap-3 md:grid-cols-2">
          <SelectField label={t('government.admin.relaxationStatus')} value={item.status} options={enumOptions('special_status', Object.values(SpecialStatus), t)} onValueChange={(value) => relaxation(index, { status: value as SpecialStatus })} />
          <TextField label={t('government.admin.maxAge')} type="number" value={item.maxYears} onChange={(event) => relaxation(index, { maxYears: Number(event.target.value) })} />
        </div>
      ))}
      <div>
        <Button variant="outline" onClick={() => onChange({ ...post, age: { ...post.age, relaxations: [...post.age.relaxations, { status: SpecialStatus.FreedomFighterChild, maxYears: post.age.maxYears ?? 0 }] } })}>
          {t('government.admin.addRelaxation')}
        </Button>
      </div>
      <p className="font-medium">{t('government.admin.education')}</p>
      {post.education.map((item, index) => (
        <div key={`${item.exam}-${index}`} className="grid gap-3 md:grid-cols-2">
          <SelectField label={t('government.admin.exam')} value={item.exam} options={enumOptions('bd_exam', Object.values(BdExam), t)} onValueChange={(value) => exam(index, { exam: value as BdExam })} />
          <SelectField label={t('government.admin.scale')} value={item.scale ?? NONE} options={[{ value: NONE, label: '' }, ...enumOptions('result_scale', Object.values(ResultScale), t)]} onValueChange={(value) => exam(index, { scale: value ? (value as ResultScale) : undefined })} />
          <TextField label={t('government.admin.minResult')} value={item.minResult ?? ''} onChange={(event) => exam(index, { minResult: event.target.value || undefined })} />
          <TextField label={t('government.admin.subjects')} value={item.subjectKeywords.join(', ')} onChange={(event) => exam(index, { subjectKeywords: list(event.target.value, COMMA) })} />
        </div>
      ))}
      <div>
        <Button variant="outline" onClick={() => onChange({ ...post, education: [...post.education, { exam: BdExam.Hsc, subjectKeywords: [] }] })}>
          {t('government.admin.addExam')}
        </Button>
      </div>
      <p className="font-medium">{t('government.admin.quotas')}</p>
      {post.quotas.map((item: Quota, index) => (
        <div key={`${item.kind}-${index}`} className="grid gap-3 md:grid-cols-2">
          <SelectField label={t('government.admin.quotas')} value={item.kind} options={enumOptions('quota_kind', Object.values(QuotaKind), t)} onValueChange={(value) => onChange({ ...post, quotas: post.quotas.map((q, at) => (at === index ? { ...q, kind: value as QuotaKind } : q)) })} />
          <TextField label={t('government.admin.vacancies')} type="number" value={item.vacancies ?? ''} onChange={(event) => onChange({ ...post, quotas: post.quotas.map((q, at) => (at === index ? { ...q, vacancies: numberOrUndefined(event.target.value) } : q)) })} />
        </div>
      ))}
      <div>
        <Button variant="outline" onClick={() => onChange({ ...post, quotas: [...post.quotas, { kind: QuotaKind.General }] })}>
          {t('government.admin.addQuota')}
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <TextField label={t('government.admin.districts')} value={post.districts.join(', ')} onChange={(event) => onChange({ ...post, districts: list(event.target.value, COMMA) })} />
        <SelectField
          label={t('government.admin.districtBasis')}
          value={post.districtBasis}
          options={[
            { value: DistrictBasis.HomeDistrict, label: t('government.admin.homeDistrict') },
            { value: DistrictBasis.PermanentAddress, label: t('government.admin.permanentAddress') },
            { value: DistrictBasis.PresentAddress, label: t('government.admin.presentAddress') },
          ]}
          onValueChange={(value) => onChange({ ...post, districtBasis: value as DistrictBasis })}
        />
      </div>
      <div>
        <Button variant="ghost" onClick={onRemove}>
          {t('government.admin.remove')}
        </Button>
      </div>
    </Card>
  );
}

const IMPORT_ERROR_KEYS: Readonly<Record<string, string>> = {
  host_not_allowed: 'government.admin.importErrors.host_not_allowed',
  no_content: 'government.admin.importErrors.no_content',
  unreachable: 'government.admin.importErrors.unreachable',
};

export function importErrorKey(error: unknown): string {
  return (isApiError(error) && IMPORT_ERROR_KEYS[error.detail ?? '']) || 'government.admin.importFailed';
}

function CircularForm({ initial, id, onDone }: { initial: CircularContent; id?: string; onDone: () => void }) {
  const t = useT();
  const toast = useToast();
  const actions = useCircularActions();
  const [content, setContent] = useState<CircularContent>(initial);
  const set = <K extends keyof CircularContent>(key: K, value: CircularContent[K]) => setContent((current) => ({ ...current, [key]: value }));
  const text = (key: 'authority' | 'ministry' | 'title' | 'sourceName' | 'noticeUrl' | 'applyUrl' | 'closesTime', label: string) => (
    <TextField label={label} value={content[key] ?? ''} onChange={(event) => set(key, event.target.value)} />
  );
  const date = (key: 'closesOn' | 'opensOn' | 'publishedOn' | 'ageCutoffOn', label: string) => (
    <TextField label={label} type="date" value={content[key] ?? ''} onChange={(event) => set(key, event.target.value || undefined)} />
  );
  const save = () => {
    const done = { onSuccess: () => { toast.show({ message: t('government.admin.saved') }); onDone(); } };
    if (id) {
      actions.update.mutate({ id, content }, done);
    } else {
      actions.create.mutate(content, done);
    }
  };
  return (
    <Card className="gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        {text('authority', t('government.admin.authority'))}
        {text('ministry', t('government.admin.ministry'))}
        {text('title', t('government.admin.titleField'))}
        {text('sourceName', t('government.admin.sourceName'))}
        {text('noticeUrl', t('government.admin.noticeUrl'))}
        {text('applyUrl', t('government.admin.applyUrl'))}
        {date('publishedOn', t('government.admin.publishedOn'))}
        {date('opensOn', t('government.admin.opensOn'))}
        {date('closesOn', t('government.admin.closesOn'))}
        {text('closesTime', t('government.admin.closesTime'))}
        {date('ageCutoffOn', t('government.admin.cutoffOn'))}
        <TextField label={t('government.admin.feeAmount')} type="number" value={content.fee?.amount ?? ''} onChange={(event) => set('fee', { ...content.fee, amount: numberOrUndefined(event.target.value) })} />
        <TextField label={t('government.admin.feeWindow')} type="number" value={content.fee?.windowHours ?? ''} onChange={(event) => set('fee', { ...content.fee, windowHours: numberOrUndefined(event.target.value) })} />
        <TextField label={t('government.admin.documents')} value={content.requiredDocuments.join('; ')} onChange={(event) => set('requiredDocuments', list(event.target.value, ';'))} />
      </div>
      <Section title={t('government.admin.posts')}>
        {content.posts.map((post, index) => (
          <PostEditor
            key={post.id || index}
            post={post}
            onChange={(next) => set('posts', content.posts.map((item, at) => (at === index ? next : item)))}
            onRemove={() => set('posts', content.posts.filter((_, at) => at !== index))}
          />
        ))}
        <div>
          <Button variant="outline" onClick={() => set('posts', [...content.posts, emptyPost()])}>
            {t('government.admin.addPost')}
          </Button>
        </div>
      </Section>
      <div className="flex gap-2">
        <Button onClick={save} loading={actions.create.isPending || actions.update.isPending}>
          {t('government.application.save')}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
      </div>
    </Card>
  );
}

function ImportCard({ onDraft }: { onDraft: (content: CircularContent) => void }) {
  const t = useT();
  const toast = useToast();
  const actions = useCircularActions();
  const [url, setUrl] = useState('');
  return (
    <Card className="gap-3">
      <p className="font-medium">{t('government.admin.import')}</p>
      <p className="text-sm text-muted">{t('government.admin.importHint')}</p>
      <TextField label={t('government.admin.importUrl')} hint={t('government.admin.importHost')} value={url} onChange={(event) => setUrl(event.target.value)} />
      <div>
        <Button
          variant="outline"
          loading={actions.importLink.isPending}
          onClick={() =>
            actions.importLink.mutate(url, {
              onSuccess: (draft) => {
                toast.show({ message: t('government.admin.draftReady') });
                onDraft({ ...emptyCircularContent(), ...draft.content });
              },
              onError: (error) => toast.show({ message: t(importErrorKey(error)) }),
            })
          }
        >
          {t('government.admin.importAction')}
        </Button>
      </div>
    </Card>
  );
}

function CircularRow({ circular, onEdit }: { circular: Circular; onEdit: () => void }) {
  const t = useT();
  const actions = useCircularActions();
  const published = circular.status === CircularStatus.Published;
  return (
    <Card className="gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">{circular.title}</p>
          <p className="text-sm text-muted">
            {circular.authority} · {t('government.circular.version', { version: circular.version })}
          </p>
        </div>
        <Badge label={t(enumLabelKey('circular_status', circular.status))} tone={published ? StatusTone.Success : StatusTone.Neutral} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onEdit}>
          {t('government.admin.edit')}
        </Button>
        {published ? (
          <Button variant="outline" onClick={() => actions.withdraw.mutate(circular.id)}>
            {t('government.admin.withdraw')}
          </Button>
        ) : (
          <Button onClick={() => actions.publish.mutate(circular.id)} loading={actions.publish.isPending} disabled={!circular.posts.length}>
            {t('government.admin.publish')}
          </Button>
        )}
        <Button variant="outline" onClick={() => actions.liveRemoved.mutate({ id: circular.id, removed: !circular.liveRemoved })}>
          {t('government.admin.liveRemoved')}: {circular.liveRemoved ? '✓' : '–'}
        </Button>
        <ConfirmDialog
          title={t('government.admin.remove')}
          body={t('government.admin.confirmDelete')}
          confirmLabel={t('government.admin.remove')}
          destructive
          onConfirm={() => actions.remove.mutate(circular.id)}
          trigger={<Button variant="ghost">{t('government.admin.remove')}</Button>}
        />
      </div>
      {!circular.posts.length ? <p className="text-sm text-warning">{t('government.admin.needsPosts')}</p> : null}
    </Card>
  );
}

function HolidaysCard() {
  const t = useT();
  const holidays = useAdminHolidays();
  const reference = useAdminGovernmentReference();
  const actions = useCircularActions();
  const [on, setOn] = useState('');
  const [name, setName] = useState('');
  return (
    <Section title={t('government.admin.holidays')}>
      <Card className="gap-3">
        <p className="text-sm text-muted">{t('government.admin.holidaysBody')}</p>
        {reference.data?.recurringHolidays.map((item) => (
          <p key={`${item.month}-${item.day}`} className="text-sm">
            {String(item.day).padStart(2, '0')}/{String(item.month).padStart(2, '0')} · {item.name}
          </p>
        ))}
        {holidays.data?.length ? (
          holidays.data.map((holiday) => (
            <div key={holiday.id} className="flex items-center justify-between gap-2">
              <span>
                {holiday.on} · {holiday.name}
              </span>
              <Button variant="ghost" onClick={() => actions.removeHoliday.mutate(holiday.id)}>
                {t('government.admin.remove')}
              </Button>
            </div>
          ))
        ) : (
          <EmptyState title={t('government.admin.none')} />
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label={t('government.admin.holidayDate')} type="date" value={on} onChange={(event) => setOn(event.target.value)} />
          <TextField label={t('government.admin.holidayName')} value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <Button
            onClick={() =>
              actions.addHoliday.mutate(
                { on, name },
                {
                  onSuccess: () => {
                    setOn('');
                    setName('');
                  },
                },
              )
            }
            loading={actions.addHoliday.isPending}
            disabled={!on || !name.trim()}
          >
            {t('government.admin.addHoliday')}
          </Button>
        </div>
      </Card>
    </Section>
  );
}

type Editing = { id?: string; content: CircularContent } | undefined;

export function GovernmentAdminPage() {
  const t = useT();
  const circulars = useAdminCirculars();
  const [editing, setEditing] = useState<Editing>();
  return (
    <>
      <PageHeader
        title={t('government.admin.title')}
        actions={!editing ? <Button onClick={() => setEditing({ content: emptyCircularContent() })}>{t('government.admin.newCircular')}</Button> : undefined}
      />
      {editing ? (
        <CircularForm key={editing.id ?? editing.content.title} initial={editing.content} id={editing.id} onDone={() => setEditing(undefined)} />
      ) : (
        <>
          <ImportCard onDraft={(content) => setEditing({ content })} />
          <Section title={t('government.admin.circulars')}>
            {circulars.isPending ? <LoadingState /> : null}
            {circulars.isError ? <ErrorState onRetry={() => void circulars.refetch()} /> : null}
            {circulars.data?.length === 0 ? <EmptyState title={t('government.admin.none')} /> : null}
            {circulars.data?.map((circular) => <CircularRow key={circular.id} circular={circular} onEdit={() => setEditing({ id: circular.id, content: circular })} />)}
          </Section>
        </>
      )}
      <HolidaysCard />
    </>
  );
}
