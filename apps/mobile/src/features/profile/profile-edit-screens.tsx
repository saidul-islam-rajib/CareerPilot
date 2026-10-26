import { useState, type ReactElement } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { AlertCircle } from '@/ui/icons';
import type { Contact, Profile } from '@careerpilot/api-client';
import {
  profileErrorKey,
  useAddContact,
  useProfile,
  useProfileSettings,
  useRemoveContact,
  useRestoreContact,
  useSetPrimaryContact,
  useSetSkills,
  useT,
  useUpdateBasics,
  useUpdateContact,
} from '@careerpilot/client-core';
import { ContactKind, StatusTone } from '@careerpilot/domain-ui-logic';
import { cleanText, normalizeSkills } from '@careerpilot/dynamic-forms';
import { useTheme } from '@/core/theme/theme';
import { Banner, Button, ButtonVariant, ErrorState, LoadingState, Screen, Segmented, TagInput, Text, TextField, TextTone, TextVariant } from '@/ui';
import { useProfileFeedback, useRemoveWithUndo } from './profile-support';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const SUMMARY_LINES = 6;

export function useLoadedProfile(render: (profile: Profile) => ReactElement): ReactElement {
  const profile = useProfile();
  if (profile.isPending) {
    return <LoadingState />;
  }
  if (profile.isError) {
    return <ErrorState onRetry={() => void profile.refetch()} />;
  }
  return render(profile.data);
}

export function ServerError({ message }: { message?: string }) {
  const t = useT();
  return message ? <Banner tone={StatusTone.Danger} icon={AlertCircle} title={t(message)} /> : null;
}

function BasicsForm({ profile }: { profile: Profile }) {
  const t = useT();
  const router = useRouter();
  const feedback = useProfileFeedback();
  const { settings } = useProfileSettings();
  const update = useUpdateBasics();
  const [values, setValues] = useState({ fullName: profile.fullName, headline: profile.headline, location: profile.location, summary: profile.summary });
  const [error, setError] = useState<string>();
  const limits = settings.limits;
  const save = () => {
    if (!values.fullName.trim()) {
      setError('validation.required');
      return;
    }
    update.mutate(values, {
      onSuccess: () => {
        feedback.saved();
        router.back();
      },
      onError: (failure) => setError(profileErrorKey(failure)),
    });
  };
  return (
    <Screen footer={<Button label={t('common.save')} onPress={save} loading={update.isPending} fullWidth />} testID="edit-basics-screen">
      <ServerError message={error} />
      <TextField label={t('profile.fullName')} autoComplete="name" value={values.fullName} onChangeText={(fullName) => setValues((v) => ({ ...v, fullName }))} />
      <TextField label={t('profile.headline')} hint={t('profile.headlineHint')} maxLength={limits.headlineMaxLength} value={values.headline} onChangeText={(headline) => setValues((v) => ({ ...v, headline }))} />
      <TextField label={t('profile.location')} hint={t('profile.locationHint')} maxLength={limits.locationMaxLength} value={values.location} onChangeText={(location) => setValues((v) => ({ ...v, location }))} />
      <TextField
        label={t('profile.summary')}
        hint={t('profile.summaryHint')}
        maxLength={limits.summaryMaxLength}
        multiline
        numberOfLines={SUMMARY_LINES}
        textAlignVertical="top"
        value={values.summary}
        onChangeText={(summary) => setValues((v) => ({ ...v, summary }))}
      />
    </Screen>
  );
}

export function EditBasicsScreen() {
  return useLoadedProfile((profile) => <BasicsForm profile={profile} />);
}

function ContactForm({ contact }: { contact?: Contact }) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const feedback = useProfileFeedback();
  const removeWithUndo = useRemoveWithUndo();
  const { settings } = useProfileSettings();
  const add = useAddContact();
  const update = useUpdateContact();
  const remove = useRemoveContact();
  const restore = useRestoreContact();
  const makePrimary = useSetPrimaryContact();
  const [kind, setKind] = useState<ContactKind>(contact?.kind ?? ContactKind.Email);
  const [value, setValue] = useState(contact?.value ?? '');
  const [label, setLabel] = useState(contact?.label ?? '');
  const [error, setError] = useState<string>();
  const [serverError, setServerError] = useState<string>();
  const isEmail = kind === ContactKind.Email;

  const save = () => {
    const valid = isEmail ? EMAIL.test(value.trim()) : new RegExp(settings.limits.phonePattern).test(cleanText(value));
    setError(valid ? undefined : isEmail ? 'validation.email' : 'validation.phone');
    if (!valid) {
      return;
    }
    const done = {
      onSuccess: () => {
        feedback.saved();
        router.back();
      },
      onError: (failure: unknown) => setServerError(profileErrorKey(failure)),
    };
    if (contact) {
      update.mutate({ id: contact.id, changes: { value, label } }, done);
    } else {
      add.mutate({ kind, value, label }, done);
    }
  };

  const removeContact = () => {
    if (!contact) {
      return;
    }
    removeWithUndo(() => remove.mutateAsync(contact.id), () => restore.mutateAsync(contact.id), contact.value, () => router.back());
  };

  return (
    <Screen footer={<Button label={t('common.save')} onPress={save} loading={add.isPending || update.isPending} fullWidth />} testID="edit-contact-screen">
      <ServerError message={serverError} />
      {contact ? null : (
        <View style={{ gap: theme.space.xs }}>
          <Text variant={TextVariant.Label}>{t('profile.contactKind')}</Text>
          <Segmented
            accessibilityLabel={t('profile.contactKind')}
            value={kind}
            onChange={setKind}
            options={[
              { value: ContactKind.Email, label: t('enums.contact_kind.email') },
              { value: ContactKind.Phone, label: t('enums.contact_kind.phone') },
            ]}
          />
        </View>
      )}
      <TextField
        label={t(isEmail ? 'profile.contactEmail' : 'profile.contactPhone')}
        keyboardType={isEmail ? 'email-address' : 'phone-pad'}
        autoCapitalize="none"
        autoComplete={isEmail ? 'email' : 'tel'}
        value={value}
        error={error}
        onChangeText={setValue}
      />
      <TextField label={t('profile.contactLabel')} hint={t('profile.contactLabelHint')} maxLength={settings.limits.contactLabelMaxLength} value={label} onChangeText={setLabel} />
      {contact ? (
        <View style={{ gap: theme.space.sm }}>
          {contact.isPrimary ? null : (
            <Button label={t('common.makePrimary')} variant={ButtonVariant.Outline} onPress={() => makePrimary.mutate(contact.id, { onSuccess: () => feedback.saved() })} />
          )}
          <Button label={t('common.remove')} variant={ButtonVariant.Destructive} onPress={removeContact} loading={remove.isPending} />
        </View>
      ) : null}
    </Screen>
  );
}

export function EditContactScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return useLoadedProfile((profile) => {
    const contact = id ? profile.contacts.find((c) => c.id === id) : undefined;
    return id && !contact ? <ErrorState /> : <ContactForm contact={contact} />;
  });
}

function SkillsForm({ profile }: { profile: Profile }) {
  const t = useT();
  const feedback = useProfileFeedback();
  const { settings } = useProfileSettings();
  const save = useSetSkills();
  const [error, setError] = useState<string>();
  const limits = settings.limits;
  const commit = (next: string[], onSaved?: () => void) => {
    const normalized = normalizeSkills(next, limits.maxSkillLength);
    if (normalized.tooLong.length > 0) {
      setError(t('validation.skillTooLong', { max: limits.maxSkillLength, skills: normalized.tooLong.join(t('common.listSeparator')) }));
      return;
    }
    if (normalized.skills.length > limits.maxSkills) {
      setError(t('validation.skillLimit', { max: limits.maxSkills }));
      return;
    }
    setError(undefined);
    save.mutate(normalized.skills, { onSuccess: onSaved, onError: (failure) => feedback.failed(failure) });
  };
  const removeSkill = (skill: string) => {
    const previous = profile.skills;
    commit(
      profile.skills.filter((s) => s !== skill),
      () => feedback.removed(skill, () => commit(previous)),
    );
  };
  return (
    <Screen testID="edit-skills-screen">
      {profile.skills.length === 0 ? <Text tone={TextTone.Muted}>{t('profile.skillsEmpty')}</Text> : null}
      <TagInput
        label={t('profile.addSkill')}
        values={profile.skills}
        placeholder={t('profile.skillPlaceholder')}
        hint={t('profile.skillsHint')}
        error={error}
        addLabel={t('common.add')}
        removeLabel={(skill) => t('profile.removeSkill', { skill })}
        onAdd={(tags) => commit([...profile.skills, ...tags])}
        onRemove={removeSkill}
      />
    </Screen>
  );
}

export function EditSkillsScreen() {
  return useLoadedProfile((profile) => <SkillsForm profile={profile} />);
}
