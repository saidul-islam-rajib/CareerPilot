'use client';

import { useRef, useState } from 'react';
import { Camera, ChevronRight, MapPin, Pencil, Trash2, UserRound } from 'lucide-react';
import type { Profile } from '@careerpilot/api-client';
import { profileErrorKey, useProfileSettings, useRemovePhoto, useSetPhoto, useT, useUpdateBasics } from '@careerpilot/client-core';
import { Avatar, Button, Card, FormDialog, ImageViewer, OverflowMenu, ProgressRing, TextAreaField, TextField, checkFile } from '@careerpilot/ui-web';
import { sectionAnchor, uploadSource, useProfileFeedback, useUploadRules } from './profile-support';

const PERCENT = 100;

export const BasicsField = {
  FullName: 'fullName',
  Headline: 'headline',
  Location: 'location',
  Summary: 'summary',
} as const;
export type BasicsField = (typeof BasicsField)[keyof typeof BasicsField];

export function BasicsDialog({ profile, open, onOpenChange }: { profile: Profile; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const feedback = useProfileFeedback();
  const { settings } = useProfileSettings();
  const update = useUpdateBasics();
  const [values, setValues] = useState({ fullName: profile.fullName, headline: profile.headline, location: profile.location, summary: profile.summary });
  const [error, setError] = useState<string>();
  const set = (field: BasicsField, value: string) => setValues((current) => ({ ...current, [field]: value }));
  const submit = () => {
    if (!values.fullName.trim()) {
      setError('validation.required');
      return;
    }
    update.mutate(values, {
      onSuccess: () => {
        onOpenChange(false);
        feedback.saved();
      },
      onError: (failure) => setError(profileErrorKey(failure)),
    });
  };
  const limits = settings.limits;
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={t('profile.editBasics')} submitLabel={t('common.save')} submitting={update.isPending} error={error ? t(error) : undefined} onSubmit={submit}>
      <TextField label={t('profile.fullName')} autoComplete="name" value={values.fullName} onChange={(e) => set(BasicsField.FullName, e.target.value)} required />
      <TextField label={t('profile.headline')} hint={t('profile.headlineHint')} value={values.headline} maxLength={limits.headlineMaxLength} onChange={(e) => set(BasicsField.Headline, e.target.value)} />
      <TextField label={t('profile.location')} hint={t('profile.locationHint')} autoComplete="address-level2" value={values.location} maxLength={limits.locationMaxLength} onChange={(e) => set(BasicsField.Location, e.target.value)} />
      <TextAreaField label={t('profile.summary')} hint={t('profile.summaryHint')} value={values.summary} maxLength={limits.summaryMaxLength} rows={6} onChange={(e) => set(BasicsField.Summary, e.target.value)} />
    </FormDialog>
  );
}

function PhotoEditor({ profile }: { profile: Profile }) {
  const t = useT();
  const feedback = useProfileFeedback();
  const rules = useUploadRules();
  const setPhoto = useSetPhoto();
  const removePhoto = useRemovePhoto();
  const picker = useRef<HTMLInputElement>(null);

  const onFile = (file: File | undefined) => {
    if (!file) {
      return;
    }
    const rejection = checkFile(file, rules.photos.accept, rules.photos.maxBytes);
    if (rejection) {
      feedback.rejected(rules.rejectionKey(rejection), rules.photos.params);
      return;
    }
    setPhoto.mutate(uploadSource(file), { onSuccess: () => feedback.saved(t('profile.photoUpdated')), onError: (error) => feedback.failed(error, rules.photos.params) });
  };

  const avatar = <Avatar name={profile.fullName} src={profile.photoUrl} className="size-28 md:size-32" />;
  return (
    <div className="relative shrink-0">
      {profile.photoUrl ? (
        <ImageViewer
          src={profile.photoUrl}
          title={t('profile.photo')}
          trigger={
            <button type="button" aria-label={`${t('profile.photo')}. ${t('profile.tapToZoom')}`} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
              {avatar}
            </button>
          }
        />
      ) : (
        avatar
      )}
      <input ref={picker} type="file" accept={rules.photos.accept.join(',')} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => {
        onFile(e.target.files?.[0]);
        e.target.value = '';
      }} />
      <div className="absolute -bottom-1 -right-1">
        {profile.photoUrl ? (
          <OverflowMenu
            label={t('profile.changePhoto')}
            items={[
              { label: t('profile.changePhoto'), icon: Camera, onSelect: () => picker.current?.click() },
              { label: t('profile.removePhoto'), icon: Trash2, onSelect: () => removePhoto.mutate(undefined, { onError: (error) => feedback.failed(error) }), destructive: true },
            ]}
          />
        ) : (
          <Button variant="primary" size="icon" icon={Camera} loading={setPhoto.isPending} aria-label={t('profile.addPhoto')} onClick={() => picker.current?.click()} className="rounded-full" />
        )}
      </div>
    </div>
  );
}

function NextStep({ profile }: { profile: Profile }) {
  const t = useT();
  const next = [...profile.completenessItems].filter((item) => !item.done).sort((a, b) => b.weight - a.weight)[0];
  if (!next) {
    return <p className="text-sm text-muted">{t('profile.completenessDone')}</p>;
  }
  return (
    <a href={`#${sectionAnchor(next.key)}`} className="flex items-center gap-2 rounded-control bg-primary-subtle px-3 py-2 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
      <span className="min-w-0 flex-1">{t('profile.completenessNext', { item: t(`profile.completenessItems.${next.key}`) })}</span>
      <span className="font-semibold">{t('profile.completenessGain', { weight: next.weight })}</span>
      <ChevronRight className="size-4" aria-hidden />
    </a>
  );
}

export function ProfileHeader({ profile }: { profile: Profile }) {
  const t = useT();
  const [editing, setEditing] = useState(0);
  return (
    <Card className="gap-5 p-5 md:flex-row md:items-center md:gap-8 md:p-6">
      <div className="flex min-w-0 flex-1 flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
        <PhotoEditor profile={profile} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">{profile.fullName || t('profile.fullName')}</h1>
          <p className={profile.headline ? 'text-foreground' : 'text-muted'}>{profile.headline || t('profile.noHeadline')}</p>
          {profile.location ? (
            <p className="flex items-center justify-center gap-1 text-sm text-muted sm:justify-start">
              <MapPin className="size-4" aria-hidden />
              {profile.location}
            </p>
          ) : null}
          <div className="mt-2 flex justify-center sm:justify-start">
            <Button variant="outline" size="sm" icon={Pencil} onClick={() => setEditing((n) => n + 1)}>
              {t('profile.editBasics')}
            </Button>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center gap-3 md:w-72">
        <ProgressRing value={profile.completeness / PERCENT} label={t('profile.completeness', { percent: profile.completeness })} caption={`${profile.completeness}%`} />
        <p className="text-sm font-medium text-muted">{t('profile.completeness', { percent: profile.completeness })}</p>
        <div className="w-full">
          <NextStep profile={profile} />
        </div>
      </div>
      {editing > 0 ? <BasicsDialog key={editing} profile={profile} open onOpenChange={(open) => !open && setEditing(0)} /> : null}
    </Card>
  );
}

export function AboutSection({ profile }: { profile: Profile }) {
  const t = useT();
  const [editing, setEditing] = useState(0);
  return (
    <section id={sectionAnchor('about')} aria-labelledby="profile-about-title" className="scroll-mt-24">
      <Card className="gap-3">
        <div className="flex items-center gap-3">
          <UserRound className="size-5 shrink-0 text-primary" aria-hidden />
          <h2 id="profile-about-title" className="min-w-0 flex-1 text-lg font-semibold">
            {t('profile.about')}
          </h2>
          <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditing((n) => n + 1)}>
            {t('common.edit')}
          </Button>
        </div>
        {profile.summary ? <p className="whitespace-pre-line text-foreground">{profile.summary}</p> : <p className="text-sm text-muted">{t('profile.aboutEmpty')}</p>}
      </Card>
      {editing > 0 ? <BasicsDialog key={editing} profile={profile} open onOpenChange={(open) => !open && setEditing(0)} /> : null}
    </section>
  );
}
