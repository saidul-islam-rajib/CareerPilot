import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { useT } from '@careerpilot/client-core';
import { Check, ChevronDown, X } from '@/ui/icons';
import { useTheme } from '@/core/theme/theme';
import { Icon } from './icon';
import { Text, TextTone, TextVariant } from './text';
import { TextField } from './text-field';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps {
  label: string;
  value: string;
  options: SelectOption[];
  placeholder: string;
  onChange: (value: string) => void;
  error?: string;
  errorParams?: Record<string, string | number>;
  testID?: string;
}

export function SelectField({ label, value, options, placeholder, onChange, error, errorParams, testID }: SelectFieldProps) {
  const t = useT();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const chosen = options.find((option) => option.value === value);
  const matches = useMemo(() => {
    const typed = query.trim().toLocaleLowerCase();
    return typed ? options.filter((option) => option.label.toLocaleLowerCase().includes(typed)) : options;
  }, [options, query]);
  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const pick = (next: string) => {
    onChange(next);
    close();
  };
  return (
    <View style={{ gap: theme.space.xs }}>
      <Text variant={TextVariant.Label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${chosen?.label ?? placeholder}`}
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: theme.touchTarget,
          borderWidth: error ? theme.borderWidth.focus : theme.borderWidth.hairline,
          borderColor: error ? theme.colors.danger : theme.colors.input,
          borderRadius: theme.radius.control,
          backgroundColor: theme.colors.background,
          paddingHorizontal: theme.space.md,
          gap: theme.space.sm,
        }}
        testID={testID}
      >
        <Text tone={chosen ? TextTone.Default : TextTone.Muted} style={{ flex: 1 }}>
          {chosen?.label ?? placeholder}
        </Text>
        <Icon icon={ChevronDown} color={theme.colors.textMuted} />
      </Pressable>
      {error ? (
        <Text variant={TextVariant.Caption} tone={TextTone.Danger}>
          {t(error, errorParams)}
        </Text>
      ) : null}
      <Modal visible={open} animationType="slide" onRequestClose={close}>
        <View style={{ flex: 1, backgroundColor: theme.colors.background, padding: theme.space.lg, gap: theme.space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
            <Text variant={TextVariant.Subheading} accessibilityRole="header" style={{ flex: 1 }}>
              {label}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={close} hitSlop={theme.space.sm}>
              <Icon icon={X} color={theme.colors.text} />
            </Pressable>
          </View>
          <TextField label={t('select.search')} value={query} onChangeText={setQuery} autoFocus autoCorrect={false} testID={testID ? `${testID}-search` : undefined} />
          <FlatList
            data={matches}
            keyExtractor={(option) => option.value}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text tone={TextTone.Muted}>{t('select.noMatches')}</Text>}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: item.value === value }}
                accessibilityLabel={item.label}
                onPress={() => pick(item.value)}
                style={{ flexDirection: 'row', alignItems: 'center', minHeight: theme.touchTarget, gap: theme.space.sm, borderBottomWidth: theme.borderWidth.hairline, borderColor: theme.colors.border }}
                testID={testID ? `${testID}-${item.value}` : undefined}
              >
                <Text style={{ flex: 1 }}>{item.label}</Text>
                {item.value === value ? <Icon icon={Check} color={theme.colors.primary} /> : null}
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}
