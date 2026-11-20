import { useState } from 'react';
import { View } from 'react-native';
import type { ProfileEntry } from '@careerpilot/api-client';
import { useRevealField, useT } from '@careerpilot/client-core';
import type { SectionDefinition } from '@careerpilot/dynamic-forms';
import { useTheme } from '@/core/theme/theme';
import { Eye, EyeOff } from '@/ui/icons';
import { Button, ButtonVariant, Text, TextTone, TextVariant } from '@/ui';
import { useProfileFeedback } from './profile-support';

function SensitiveValue({ section, entry, field }: { section: string; entry: ProfileEntry; field: string }) {
  const t = useT();
  const theme = useTheme();
  const feedback = useProfileFeedback();
  const reveal = useRevealField(section);
  const [shown, setShown] = useState<string | null>(null);
  const label = t(`profile.fields.${section}.${field}`);
  const show = () => reveal.mutate({ id: entry.id, field }, { onSuccess: setShown, onError: (error) => feedback.failed(error) });
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: theme.space.sm }}>
      <Text variant={TextVariant.Label} tone={TextTone.Muted}>
        {label}
      </Text>
      <Text>{shown ?? String(entry.values[field])}</Text>
      {shown === null ? (
        <Button label={t('profile.sensitive.showAction')} accessibilityLabel={t('profile.sensitive.reveal', { field: label })} variant={ButtonVariant.Ghost} icon={Eye} loading={reveal.isPending} onPress={show} />
      ) : (
        <Button label={t('profile.sensitive.hideAction')} accessibilityLabel={t('profile.sensitive.hide', { field: label })} variant={ButtonVariant.Ghost} icon={EyeOff} onPress={() => setShown(null)} />
      )}
    </View>
  );
}

export function SensitiveValues({ section, entry }: { section: SectionDefinition; entry: ProfileEntry }) {
  const fields = section.fields.filter((f) => f.sensitive && entry.values[f.key]);
  return (
    <>
      {fields.map((f) => (
        <SensitiveValue key={f.key} section={section.key} entry={entry} field={f.key} />
      ))}
    </>
  );
}
