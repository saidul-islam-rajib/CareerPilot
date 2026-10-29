'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs } from 'radix-ui';
import { Archive, ExternalLink, MonitorSmartphone, Pencil, PlayCircle, RotateCcw, Undo2, XCircle } from 'lucide-react';
import type { AdminApplicationChange, AdminUserRecord, ApplicationRecord } from '@careerpilot/api-client';
import { trackTitle, useFormat, usePublicConfig, useT } from '@careerpilot/client-core';
import {
  AdminArea,
  ApplicationMode,
  ApprovalState,
  EnumKey,
  OpportunityDecision,
  OutcomeStatus,
  PermissionAction,
  StatusTone,
  SubmissionStatus,
  enumValues,
} from '@careerpilot/domain-ui-logic';
import { Badge, Button, Card, ConfirmDialog, EmptyState, EnumBadge, ErrorState, FormDialog, ListRow, LoadingState, Segmented, SelectField, Stepper, TextAreaField, TextField, cn } from '@careerpilot/ui-web';
import { adminKeys, useAdminMutation } from '@/core/admin-queries';
import { useAdminApi } from '@/core/admin-services';
import { useCan } from '@/core/admin-session';

const TAB = {
  Lists: 'lists',
  Applications: 'applications',
  Approvals: 'approvals',
  Profile: 'profile',
  Sources: 'sources',
  Activity: 'activity',
} as const;
type Tab = (typeof TAB)[keyof typeof TAB];
const KEEP = 'keep';

function useRecordActions(userId: string) {
  const api = useAdminApi();
  return {
    change: useAdminMutation(({ applicationId, change }: { applicationId: string; change: AdminApplicationChange }) => api.users.changeApplication(userId, applicationId, change)),
    archive: useAdminMutation(({ applicationId, archived }: { applicationId: string; archived: boolean }) => api.users.archiveApplication(userId, applicationId, archived)),
    decide: useAdminMutation(({ opportunityId, decision }: { opportunityId: string; decision: OpportunityDecision | null }) => api.users.setJobDecision(userId, opportunityId, decision)),
    track: useAdminMutation(({ trackId, resultCount, mode }: { trackId: string; resultCount?: number; mode?: ApplicationMode }) => api.users.updateTrack(userId, trackId, { resultCount, mode })),
    resume: useAdminMutation(() => api.users.resumeAutomation(userId)),
    profile: useAdminMutation((change: { fullName: string; headline: string; location: string; countryCode: string }) => api.users.updateProfile(userId, change)),
    reject: useAdminMutation((approvalId: string) => api.users.rejectApproval(userId, approvalId)),
  };
}

type Actions = ReturnType<typeof useRecordActions>;

function ListsPanel({ record, actions, canEdit }: { record: AdminUserRecord; actions: Actions; canEdit: boolean }) {
  const t = useT();
  const { config } = usePublicConfig();
  const modes = enumValues(ApplicationMode).map((mode) => ({ value: mode, label: t(`enums.application_mode.${mode}`) }));
  const bounds = { min: config.validationPolicy.track.minResultCount, max: config.validationPolicy.track.maxResultCount };
  return (
    <div className="flex flex-col gap-4">
      {record.lists.map(({ track, jobs }) => (
        <Card key={track.id} className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">{trackTitle(track, t, record.preferences.homeCountry)}</h3>
            <EnumBadge enumKey={EnumKey.ApplicationMode} value={track.mode} />
          </div>
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-4">
              <Stepper name={t('settings.resultCount')} value={track.resultCount} min={bounds.min} max={bounds.max} onChange={(resultCount) => actions.track.mutate({ trackId: track.id, resultCount })} />
              <Segmented options={modes} value={track.mode} onChange={(mode) => actions.track.mutate({ trackId: track.id, mode })} label={t('settings.applicationMode')} />
            </div>
          ) : null}
          {jobs.length === 0 ? (
            <EmptyState body={t('admin.records.noJobs')} />
          ) : (
            <ul className="divide-y divide-border">
              {jobs.map((job) => (
                <li key={job.id} className="flex flex-col gap-2 py-2 md:flex-row md:items-center">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <a href={job.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-medium text-foreground hover:underline">
                      {job.title}
                      <ExternalLink className="size-3.5 shrink-0 text-muted" aria-hidden />
                    </a>
                    <span className="text-sm text-muted">
                      {job.organization} · {job.location || job.countryCode} · {job.sourceName}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge label={t('opportunity.match', { score: job.matchScore })} tone={StatusTone.Neutral} />
                    {job.applied ? <Badge label={t('admin.records.applied')} tone={StatusTone.Success} /> : null}
                    {job.decision ? <EnumBadge enumKey={EnumKey.OpportunityDecision} value={job.decision} /> : null}
                    {canEdit ? (
                      job.decision === OpportunityDecision.Dismissed ? (
                        <Button size="sm" variant="ghost" icon={Undo2} onClick={() => actions.decide.mutate({ opportunityId: job.id, decision: null })}>
                          {t('admin.records.restoreJob')}
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" icon={XCircle} onClick={() => actions.decide.mutate({ opportunityId: job.id, decision: OpportunityDecision.Dismissed })}>
                          {t('admin.records.removeJob')}
                        </Button>
                      )
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
    </div>
  );
}

function ChangeApplicationDialog({ application, actions, onClose }: { application: ApplicationRecord; actions: Actions; onClose: () => void }) {
  const t = useT();
  const [submission, setSubmission] = useState<string>(KEEP);
  const [outcome, setOutcome] = useState<string>(KEEP);
  const [note, setNote] = useState('');
  const keep = { value: KEEP, label: t('admin.records.keepAsIs') };
  const submit = () =>
    actions.change.mutate(
      {
        applicationId: application.id,
        change: {
          submissionStatus: submission === KEEP ? undefined : (submission as SubmissionStatus),
          outcomeStatus: outcome === KEEP ? undefined : (outcome as OutcomeStatus),
          note,
        },
      },
      { onSuccess: onClose },
    );
  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('admin.records.changeTitle', { title: application.opportunity.title })}
      description={t('admin.records.changeBody')}
      submitLabel={t('common.save')}
      submitting={actions.change.isPending}
      error={actions.change.error ? t('admin.records.changeFailed') : undefined}
      onSubmit={submit}
    >
      <SelectField
        label={t('admin.records.submissionStatus')}
        options={[keep, ...enumValues(SubmissionStatus).map((value) => ({ value, label: t(`enums.submission_status.${value}`) }))]}
        value={submission}
        onValueChange={setSubmission}
      />
      <SelectField
        label={t('admin.records.outcomeStatus')}
        options={[keep, ...enumValues(OutcomeStatus).map((value) => ({ value, label: t(`enums.outcome_status.${value}`) }))]}
        value={outcome}
        onValueChange={setOutcome}
      />
      <TextAreaField label={t('admin.records.note')} hint={t('admin.records.noteHint')} value={note} rows={3} onChange={(e) => setNote(e.target.value)} />
    </FormDialog>
  );
}

function ApplicationsPanel({ record, actions, canEdit }: { record: AdminUserRecord; actions: Actions; canEdit: boolean }) {
  const t = useT();
  const format = useFormat();
  const [editing, setEditing] = useState<ApplicationRecord>();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (record.applications.length === 0) {
    return <EmptyState body={t('admin.records.noApplications')} />;
  }
  return (
    <div className="flex flex-col gap-3">
      {record.applications.map((application) => (
        <Card key={application.id} className={cn('gap-3', application.archivedAt ? 'opacity-70' : undefined)}>
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 flex-col">
              <span className="font-semibold text-foreground">{application.opportunity.title}</span>
              <span className="text-sm text-muted">
                {application.opportunity.organization} · {t(`enums.application_route.${application.route}`)} · {t('admin.records.updated', { date: format.dateTime(application.updatedAt) })}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <EnumBadge enumKey={EnumKey.SubmissionStatus} value={application.submissionStatus} />
              <EnumBadge enumKey={EnumKey.OutcomeStatus} value={application.outcomeStatus} />
              {application.archivedAt ? <Badge label={t('admin.records.archived')} tone={StatusTone.Neutral} /> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" aria-expanded={open[application.id] === true} onClick={() => setOpen((current) => ({ ...current, [application.id]: !current[application.id] }))}>
              {open[application.id] ? t('admin.records.hideDetails') : t('admin.records.showDetails')}
            </Button>
            {canEdit ? (
              <>
                <Button size="sm" variant="outline" icon={Pencil} onClick={() => setEditing(application)}>
                  {t('admin.records.change')}
                </Button>
                {application.archivedAt ? (
                  <Button size="sm" variant="outline" icon={RotateCcw} onClick={() => actions.archive.mutate({ applicationId: application.id, archived: false })}>
                    {t('admin.records.restore')}
                  </Button>
                ) : (
                  <ConfirmDialog
                    title={t('admin.records.archiveTitle')}
                    body={t('admin.records.archiveBody')}
                    confirmLabel={t('admin.records.archive')}
                    destructive
                    onConfirm={() => actions.archive.mutate({ applicationId: application.id, archived: true })}
                    trigger={
                      <Button size="sm" variant="outline" icon={Archive}>
                        {t('admin.records.archive')}
                      </Button>
                    }
                  />
                )}
              </>
            ) : null}
          </div>
          {open[application.id] ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="flex flex-col gap-2">
                <h4 className="font-semibold">{t('applications.timeline')}</h4>
                <ol className="flex flex-col gap-2 text-sm">
                  {application.timeline.map((entry, index) => (
                    <li key={`${entry.at}-${index}`} className="flex flex-col rounded-control bg-surface p-2">
                      <span className="text-foreground">{entry.text}</span>
                      <span className="text-xs text-muted">
                        {format.dateTime(entry.at)} · {t(`admin.records.actors.${entry.actor}`)}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
              <section className="flex flex-col gap-2 text-sm">
                <h4 className="font-semibold">{t('admin.records.sent')}</h4>
                {application.emails.length === 0 && application.files.length === 0 ? <p className="text-muted">{t('admin.records.nothingSent')}</p> : null}
                {application.emails.map((email) => (
                  <p key={email.sentAt} className="text-foreground">
                    {email.subject} → {email.to} · {format.dateTime(email.sentAt)}
                  </p>
                ))}
                {application.files.map((file) => (
                  <p key={file.name} className="text-muted">
                    {file.name}
                  </p>
                ))}
                {application.evidence.map((item) => (
                  <p key={item.at} className="text-muted">
                    {item.text} · {format.dateTime(item.at)}
                  </p>
                ))}
              </section>
            </div>
          ) : null}
        </Card>
      ))}
      {editing ? <ChangeApplicationDialog key={editing.id} application={editing} actions={actions} onClose={() => setEditing(undefined)} /> : null}
    </div>
  );
}

function ApprovalsPanel({ record, actions, canEdit }: { record: AdminUserRecord; actions: Actions; canEdit: boolean }) {
  const t = useT();
  const format = useFormat();
  if (record.approvals.length === 0) {
    return <EmptyState body={t('admin.records.noApprovals')} />;
  }
  return (
    <Card>
      {record.approvals.map((approval) => (
        <ListRow
          key={approval.id}
          title={approval.opportunity.title}
          subtitle={`${approval.opportunity.organization} · ${t('admin.records.created', { date: format.dateTime(approval.createdAt) })}`}
          trailing={
            <span className="flex items-center gap-2">
              <EnumBadge enumKey={EnumKey.ApprovalState} value={approval.state} />
              {canEdit && approval.state === ApprovalState.Pending ? (
                <Button size="sm" variant="outline" onClick={() => actions.reject.mutate(approval.id)}>
                  {t('admin.records.reject')}
                </Button>
              ) : null}
            </span>
          }
        />
      ))}
      <p className="text-xs text-muted">{t('admin.records.approvalNote')}</p>
    </Card>
  );
}

function EditProfileDialog({ record, actions, onClose }: { record: AdminUserRecord; actions: Actions; onClose: () => void }) {
  const t = useT();
  const [values, setValues] = useState({
    fullName: record.profile.fullName,
    headline: record.profile.headline,
    location: record.profile.location,
    countryCode: record.profile.countryCode ?? '',
  });
  const set = (field: keyof typeof values, value: string) => setValues((current) => ({ ...current, [field]: value }));
  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('admin.records.editProfile')}
      submitLabel={t('common.save')}
      submitting={actions.profile.isPending}
      error={actions.profile.error ? t('admin.records.changeFailed') : undefined}
      onSubmit={() => actions.profile.mutate(values, { onSuccess: onClose })}
    >
      <TextField label={t('profile.fullName')} value={values.fullName} onChange={(e) => set('fullName', e.target.value)} />
      <TextField label={t('profile.headline')} value={values.headline} onChange={(e) => set('headline', e.target.value)} />
      <TextField label={t('profile.location')} value={values.location} onChange={(e) => set('location', e.target.value)} />
      <TextField label={t('profile.country')} value={values.countryCode} maxLength={2} onChange={(e) => set('countryCode', e.target.value.toUpperCase())} />
    </FormDialog>
  );
}

function ProfilePanel({ record, actions, canEdit }: { record: AdminUserRecord; actions: Actions; canEdit: boolean }) {
  const t = useT();
  const format = useFormat();
  const [editing, setEditing] = useState(0);
  const { profile, preferences } = record;
  const window = preferences.submissionWindow;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">{t('admin.records.profile')}</h3>
          {canEdit ? (
            <Button size="sm" variant="outline" icon={Pencil} onClick={() => setEditing((n) => n + 1)}>
              {t('common.edit')}
            </Button>
          ) : null}
        </div>
        <p className="font-medium">{profile.fullName}</p>
        <p className="text-sm text-muted">{profile.headline}</p>
        <p className="text-sm text-muted">
          {profile.location} · {preferences.homeCountry} · {t('admin.columns.completeness')}: {profile.completeness}%
        </p>
        {profile.summary ? <p className="whitespace-pre-wrap text-sm">{profile.summary}</p> : null}
        <p className="text-sm">
          <span className="font-medium">{t('profile.skills')}:</span> {profile.skills.join(', ') || '—'}
        </p>
        <p className="text-sm">
          <span className="font-medium">{t('profile.contacts')}:</span> {profile.contacts.map((c) => c.value).join(', ') || '—'}
        </p>
        <p className="text-sm">
          <span className="font-medium">{t('profile.documents')}:</span> {profile.documents.map((d) => d.name).join(', ') || '—'}
        </p>
      </Card>
      <Card className="gap-2">
        <h3 className="text-lg font-semibold">{t('admin.records.settings')}</h3>
        <p className="text-sm">
          {preferences.pause ? t('admin.records.paused', { until: preferences.pause.until ? format.date(preferences.pause.until) : t('settings.pauseUntilYouResume') }) : t('settings.pauseRunningTitle')}
        </p>
        {canEdit && preferences.pause ? (
          <Button size="sm" variant="outline" icon={PlayCircle} className="self-start" onClick={() => actions.resume.mutate(undefined)} loading={actions.resume.isPending}>
            {t('home.resume')}
          </Button>
        ) : null}
        <p className="text-sm">
          <span className="font-medium">{t('settings.submissionWindow')}:</span>{' '}
          {window.start && window.end ? t('settings.windowSummaryDaily', { start: window.start, end: window.end, zone: preferences.timeZone }) : t('settings.windowSummaryNow')}
        </p>
        <p className="text-sm">
          <span className="font-medium">{t('settings.countries')}:</span> {preferences.excludedCountries.join(', ') || '—'}
        </p>
        <p className="text-sm">
          <span className="font-medium">{t('admin.records.favorites')}:</span> {preferences.favoriteCompanies.join(', ') || '—'}
        </p>
        <p className="text-sm">
          <span className="font-medium">{t('settings.notifications')}:</span>{' '}
          {preferences.notifications.digestEnabled ? preferences.notifications.digestTime : t('admin.records.off')}
        </p>
      </Card>
      {editing > 0 ? <EditProfileDialog key={editing} record={record} actions={actions} onClose={() => setEditing(0)} /> : null}
    </div>
  );
}

function SourcesPanel({ record }: { record: AdminUserRecord }) {
  const t = useT();
  if (record.sources.length === 0) {
    return <EmptyState body={t('admin.records.noSources')} />;
  }
  return (
    <Card>
      {record.sources.map((source) => (
        <ListRow
          key={source.id}
          title={source.name}
          subtitle={`${source.siteUrl} · ${t('sources.jobsFound', { count: source.jobsFound })}`}
          trailing={
            <span className="flex gap-2">
              <EnumBadge enumKey={EnumKey.SourceReview} value={source.review} />
              <EnumBadge enumKey={EnumKey.SourceStatus} value={source.status} />
            </span>
          }
        />
      ))}
    </Card>
  );
}

function PresenceSummary({ record }: { record: AdminUserRecord }) {
  const t = useT();
  const format = useFormat();
  const presence = record.user.presence;
  const status = presence.online ? t('admin.presence.online') : presence.lastSeenAt ? t('admin.presence.lastSeen', { time: format.ago(presence.lastSeenAt) }) : t('admin.presence.never');
  const facts = [
    { label: t('admin.presence.timeInApp'), value: format.duration(presence.activeSeconds) },
    { label: t('admin.presence.sessions'), value: String(presence.sessionsCount) },
    { label: t('admin.presence.location'), value: presence.location || t('activity.unknownLocation') },
    { label: t('admin.presence.device'), value: presence.device || t('activity.unknownDevice') },
  ];
  return (
    <Card className="gap-4">
      <div className="flex items-center gap-3">
        <span aria-hidden className={cn('size-3 rounded-full', presence.online ? 'bg-success' : 'bg-border')} />
        <h3 className="text-lg font-semibold text-foreground">{status}</h3>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map((fact) => (
          <div key={fact.label} className="flex flex-col gap-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">{fact.label}</dt>
            <dd className="break-words font-semibold text-foreground">{fact.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted">{t('admin.presence.locationNote')}</p>
    </Card>
  );
}

function SessionsList({ record }: { record: AdminUserRecord }) {
  const t = useT();
  const format = useFormat();
  if (record.sessions.length === 0) {
    return <EmptyState body={t('admin.presence.sessionsEmpty')} />;
  }
  return (
    <Card>
      {record.sessions.map((session) => {
        const state = session.signedOutAt ? t('admin.presence.sessionEnded') : record.user.presence.online && session.lastSeenAt === record.user.presence.lastSeenAt ? t('admin.presence.sessionActive') : t('admin.presence.sessionIdle');
        return (
          <ListRow
            key={session.id}
            icon={MonitorSmartphone}
            title={`${session.device} · ${session.approximateLocation}`}
            subtitle={`${t('admin.presence.sessionDetail', { started: format.dateTime(session.startedAt), seen: format.ago(session.lastSeenAt), active: format.duration(session.activeSeconds) })} · ${session.ip}`}
            trailing={<Badge label={state} />}
          />
        );
      })}
    </Card>
  );
}

function SignInList({ record }: { record: AdminUserRecord }) {
  const t = useT();
  const format = useFormat();
  if (record.signIns.length === 0) {
    return <EmptyState body={t('common.emptyTitle')} />;
  }
  return (
    <Card>
      {record.signIns.map((event) => (
        <ListRow
          key={event.id}
          icon={MonitorSmartphone}
          title={event.device}
          subtitle={`${event.approximateLocation} · ${event.ip} · ${format.dateTime(event.at)}`}
          trailing={<span className={event.success ? 'text-sm text-success' : 'text-sm text-danger'}>{event.success ? t('activity.success') : t('activity.failed')}</span>}
        />
      ))}
    </Card>
  );
}

function ActivityPanel({ record }: { record: AdminUserRecord }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-6">
      <PresenceSummary record={record} />
      <section className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-foreground">{t('admin.presence.sessionsTitle')}</h3>
        <SessionsList record={record} />
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-foreground">{t('admin.presence.signInsTitle')}</h3>
        <SignInList record={record} />
      </section>
    </div>
  );
}

export function UserRecordTabs({ userId }: { userId: string }) {
  const t = useT();
  const api = useAdminApi();
  const canEditUser = useCan(AdminArea.Users, PermissionAction.Update);
  const canEditApplications = useCan(AdminArea.Applications, PermissionAction.Update);
  const record = useQuery({ queryKey: adminKeys.userRecord(userId), queryFn: () => api.users.getRecord(userId) });
  const actions = useRecordActions(userId);
  const [tab, setTab] = useState<Tab>(TAB.Applications);
  if (record.isPending) {
    return <LoadingState />;
  }
  if (record.isError) {
    return <ErrorState onRetry={() => void record.refetch()} />;
  }
  const data = record.data;
  const tabs: { value: Tab; label: string }[] = [
    { value: TAB.Applications, label: t('admin.records.tabs.applications', { count: data.applications.length }) },
    { value: TAB.Lists, label: t('admin.records.tabs.lists', { count: data.lists.reduce((sum, list) => sum + list.jobs.length, 0) }) },
    { value: TAB.Approvals, label: t('admin.records.tabs.approvals', { count: data.approvals.length }) },
    { value: TAB.Profile, label: t('admin.records.tabs.profile') },
    { value: TAB.Sources, label: t('admin.records.tabs.sources', { count: data.sources.length }) },
    { value: TAB.Activity, label: t('admin.records.tabs.activity') },
  ];
  return (
    <Tabs.Root value={tab} onValueChange={(value) => setTab(value as Tab)} className="flex flex-col gap-4">
      <Tabs.List aria-label={t('admin.records.title')} className="flex flex-wrap gap-2 border-b border-border pb-2">
        {tabs.map((item) => (
          <Tabs.Trigger
            key={item.value}
            value={item.value}
            className="min-h-11 rounded-control px-3 text-sm font-medium text-muted transition-colors hover:bg-surface data-[state=active]:bg-primary-subtle data-[state=active]:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            {item.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <Tabs.Content value={TAB.Applications}>
        <ApplicationsPanel record={data} actions={actions} canEdit={canEditApplications} />
      </Tabs.Content>
      <Tabs.Content value={TAB.Lists}>
        <ListsPanel record={data} actions={actions} canEdit={canEditUser} />
      </Tabs.Content>
      <Tabs.Content value={TAB.Approvals}>
        <ApprovalsPanel record={data} actions={actions} canEdit={canEditApplications} />
      </Tabs.Content>
      <Tabs.Content value={TAB.Profile}>
        <ProfilePanel record={data} actions={actions} canEdit={canEditUser} />
      </Tabs.Content>
      <Tabs.Content value={TAB.Sources}>
        <SourcesPanel record={data} />
      </Tabs.Content>
      <Tabs.Content value={TAB.Activity}>
        <ActivityPanel record={data} />
      </Tabs.Content>
    </Tabs.Root>
  );
}
