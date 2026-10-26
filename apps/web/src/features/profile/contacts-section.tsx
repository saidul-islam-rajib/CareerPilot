'use client';

import { useState } from 'react';
import { BadgeCheck, Mail, Pencil, Phone, Plus, RotateCw, Star, Trash2 } from 'lucide-react';
import type { Contact } from '@careerpilot/api-client';
import {
  profileErrorKey,
  sortContacts,
  useAddContact,
  useProfileSettings,
  useRemoveContact,
  useReorderContacts,
  useRestoreContact,
  useSetPrimaryContact,
  useContactVerification,
  usePublicConfig,
  useT,
  useUpdateContact,
} from '@careerpilot/client-core';
import { ContactKind, StatusTone } from '@careerpilot/domain-ui-logic';
import { cleanText } from '@careerpilot/dynamic-forms';
import { Badge, Button, Card, FormDialog, OverflowMenu, Segmented, SortableList, TextField } from '@careerpilot/ui-web';
import { sectionAnchor, useProfileFeedback, useRemoveWithUndo } from './profile-support';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function ContactDialog({ contact, open, onOpenChange }: { contact?: Contact; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const feedback = useProfileFeedback();
  const { settings } = useProfileSettings();
  const add = useAddContact();
  const update = useUpdateContact();
  const [kind, setKind] = useState<ContactKind>(contact?.kind ?? ContactKind.Email);
  const [value, setValue] = useState(contact?.value ?? '');
  const [label, setLabel] = useState(contact?.label ?? '');
  const [error, setError] = useState<string>();
  const [serverError, setServerError] = useState<string>();

  const validate = (): string | undefined => {
    if (kind === ContactKind.Email) {
      return EMAIL.test(value.trim()) ? undefined : 'validation.email';
    }
    return new RegExp(settings.limits.phonePattern).test(cleanText(value)) ? undefined : 'validation.phone';
  };

  const submit = () => {
    const problem = validate();
    setError(problem);
    setServerError(undefined);
    if (problem) {
      return;
    }
    const done = {
      onSuccess: () => {
        onOpenChange(false);
        feedback.saved();
      },
      onError: (failure: unknown) => setServerError(t(profileErrorKey(failure))),
    };
    if (contact) {
      update.mutate({ id: contact.id, changes: { value, label } }, done);
    } else {
      add.mutate({ kind, value, label }, done);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(contact ? 'profile.editContact' : 'profile.addContact')}
      submitLabel={t('common.save')}
      submitting={add.isPending || update.isPending}
      error={serverError}
      onSubmit={submit}
    >
      {contact ? null : (
        <Segmented
          label={t('profile.contactKind')}
          value={kind}
          onChange={setKind}
          options={[
            { value: ContactKind.Email, label: t('enums.contact_kind.email') },
            { value: ContactKind.Phone, label: t('enums.contact_kind.phone') },
          ]}
        />
      )}
      <TextField
        label={t(kind === ContactKind.Email ? 'profile.contactEmail' : 'profile.contactPhone')}
        type={kind === ContactKind.Email ? 'email' : 'tel'}
        autoComplete={kind === ContactKind.Email ? 'email' : 'tel'}
        value={value}
        error={error}
        onChange={(event) => setValue(event.target.value)}
        required
      />
      <TextField
        label={t('profile.contactLabel')}
        hint={t('profile.contactLabelHint')}
        value={label}
        maxLength={settings.limits.contactLabelMaxLength}
        onChange={(event) => setLabel(event.target.value)}
      />
    </FormDialog>
  );
}

function VerifyDialog({ contact, onOpenChange }: { contact: Contact; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const feedback = useProfileFeedback();
  const verification = useContactVerification(contact.id, {
    onVerified: () => {
      onOpenChange(false);
      feedback.saved(t('verification.verified'));
    },
  });
  const sent = verification.challenge !== undefined;
  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title={t('verification.title')}
      submitLabel={sent ? t('verification.submit') : t('verification.sendCode')}
      submitting={sent ? verification.confirming : verification.sending}
      error={verification.error && !sent ? t(verification.error) : undefined}
      onSubmit={sent ? verification.submit : verification.send}
    >
      {sent ? (
        <>
          <p className="text-sm text-foreground">
            {t('verification.sentTo', { length: verification.codeLength, destination: verification.challenge?.destination ?? '' })}{' '}
            {t('verification.expires', { minutes: verification.expiresInMinutes })}
          </p>
          <TextField
            label={t('verification.code')}
            value={verification.code}
            onChange={(event) => verification.setCode(event.target.value)}
            error={verification.error}
            errorParams={{ length: verification.codeLength }}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={verification.codeLength}
            autoFocus
            className="text-center text-xl font-semibold tracking-[0.4em]"
          />
          <Button type="button" variant="ghost" size="sm" icon={RotateCw} className="self-start" disabled={verification.resendIn > 0} loading={verification.sending} onClick={verification.send}>
            {verification.resendIn > 0 ? t('verification.resendIn', { seconds: verification.resendIn }) : t('verification.resend')}
          </Button>
        </>
      ) : (
        <p className="text-sm text-foreground">{t('verification.willSend', { length: verification.codeLength, destination: contact.value })}</p>
      )}
    </FormDialog>
  );
}

function ContactRow({ contact, index, count, onEdit, onVerify }: { contact: Contact; index: number; count: number; onEdit: () => void; onVerify: () => void }) {
  const t = useT();
  const { config } = usePublicConfig();
  const canVerify = !contact.verified && (contact.kind === ContactKind.Email || config.verification.smsEnabled);
  const setPrimary = useSetPrimaryContact();
  const remove = useRemoveContact();
  const restore = useRestoreContact();
  const reorder = useReorderContacts();
  const Glyph = contact.kind === ContactKind.Email ? Mail : Phone;
  const removeWithUndo = useRemoveWithUndo();
  const removeContact = () => removeWithUndo(() => remove.mutateAsync(contact.id), () => restore.mutateAsync(contact.id), contact.value);
  return (
    <div className="flex items-center gap-3 py-1">
      <Glyph className="size-5 shrink-0 text-primary" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">{contact.value}</span>
        <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {contact.label}
          {contact.verified ? (
            <span className="inline-flex items-center gap-1 text-success">
              <BadgeCheck className="size-4" aria-hidden />
              {t('profile.verified')}
            </span>
          ) : (
            <span>{t('profile.notVerified')}</span>
          )}
          {canVerify ? (
            <button
              type="button"
              onClick={onVerify}
              aria-label={t('verification.verifyContact', { value: contact.value })}
              className="font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {t('verification.verify')}
            </button>
          ) : null}
          {contact.isPrimary ? <Badge label={t('common.primary')} tone={StatusTone.Primary} /> : null}
        </span>
      </div>
      <OverflowMenu
        label={t('common.moreActions', { item: contact.value })}
        items={[
          { label: t('common.edit'), icon: Pencil, onSelect: onEdit },
          { label: t('common.makePrimary'), icon: Star, onSelect: () => setPrimary.mutate(contact.id), disabled: contact.isPrimary },
          { label: t('common.moveUp'), onSelect: () => reorder.move(index, index - 1), disabled: index === 0 },
          { label: t('common.moveDown'), onSelect: () => reorder.move(index, index + 1), disabled: index === count - 1 },
          { label: t('common.remove'), icon: Trash2, onSelect: removeContact, destructive: true },
        ]}
      />
    </div>
  );
}

export function ContactsSection({ contacts }: { contacts: Contact[] }) {
  const t = useT();
  const reorder = useReorderContacts();
  const [dialog, setDialog] = useState<{ open: boolean; contact?: Contact; version: number }>({ open: false, version: 0 });
  const [verifying, setVerifying] = useState<{ contact: Contact; version: number }>();
  const sorted = sortContacts(contacts);
  const open = (contact?: Contact) => setDialog((current) => ({ open: true, contact, version: current.version + 1 }));
  return (
    <section id={sectionAnchor('contacts')} aria-labelledby="profile-contacts-title" className="scroll-mt-24">
      <Card className="gap-3">
        <div className="flex items-center gap-3">
          <Mail className="size-5 shrink-0 text-primary" aria-hidden />
          <h2 id="profile-contacts-title" className="min-w-0 flex-1 text-lg font-semibold">
            {t('profile.contacts')}
          </h2>
          <Button variant="secondary" size="sm" icon={Plus} onClick={() => open()}>
            {t('common.add')}
          </Button>
        </div>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted">{t('profile.contactsEmpty')}</p>
        ) : (
          <>
            <p className="text-xs text-muted">{t('common.dragToReorder')}</p>
            <SortableList
              items={sorted}
              keyOf={(c) => c.id}
              labelOf={(c) => c.value}
              onReorder={reorder.move}
              moveButtons={false}
              renderItem={(contact) => (
                <ContactRow
                  contact={contact}
                  index={sorted.indexOf(contact)}
                  count={sorted.length}
                  onEdit={() => open(contact)}
                  onVerify={() => setVerifying((current) => ({ contact, version: (current?.version ?? 0) + 1 }))}
                />
              )}
            />
          </>
        )}
      </Card>
      {verifying ? <VerifyDialog key={verifying.version} contact={verifying.contact} onOpenChange={(value) => !value && setVerifying(undefined)} /> : null}
      {dialog.open ? (
        <ContactDialog key={dialog.version} contact={dialog.contact} open={dialog.open} onOpenChange={(value) => setDialog((current) => ({ ...current, open: value }))} />
      ) : null}
    </section>
  );
}
