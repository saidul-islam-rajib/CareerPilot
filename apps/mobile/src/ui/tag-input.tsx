import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Plus, X } from '@/ui/icons';
import { useTheme } from '@/core/theme/theme';
import { Button, ButtonVariant } from './button';
import { Icon, IconSize } from './icon';
import { Text, TextTone, TextVariant } from './text';
import { useInputFocus } from './input-focus';

const SEPARATOR = ',';

export function splitTags(raw: string): string[] {
  return raw
    .split(SEPARATOR)
    .map((part) => part.trim())
    .filter(Boolean);
}

export interface TagInputProps {
  label: string;
  values: string[];
  placeholder?: string;
  hint?: string;
  error?: string;
  addLabel: string;
  removeLabel: (value: string) => string;
  onAdd: (values: string[]) => void;
  onRemove: (value: string) => void;
}

export function TagInput({ label, values, placeholder, hint, error, addLabel, removeLabel, onAdd, onRemove }: TagInputProps) {
  const focus = useInputFocus();
  const theme = useTheme();
  const [draft, setDraft] = useState('');
  const commit = () => {
    const tags = splitTags(draft);
    if (tags.length > 0) {
      onAdd(tags);
      setDraft('');
    }
  };
  return (
    <View style={{ gap: theme.space.sm }}>
      <Text variant={TextVariant.Label}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: theme.space.sm, alignItems: 'center' }}>
        <TextInput
          accessibilityLabel={label}
          value={draft}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          onChangeText={setDraft}
          onSubmitEditing={commit}
          onFocus={focus.onFocus}
          onBlur={focus.onBlur}
          returnKeyType="done"
          blurOnSubmit={false}
          style={{
            flex: 1,
            minHeight: theme.touchTarget,
            borderWidth: error || focus.focused ? theme.borderWidth.focus : theme.borderWidth.hairline,
            borderColor: error ? theme.colors.danger : focus.focused ? theme.colors.primary : theme.colors.input,
            borderRadius: theme.radius.control,
            backgroundColor: theme.colors.background,
            color: theme.colors.text,
            fontSize: theme.fontSize.md,
            paddingHorizontal: theme.space.md,
          }}
        />
        <Button label={addLabel} icon={Plus} variant={ButtonVariant.Secondary} onPress={commit} disabled={!draft.trim()} />
      </View>
      {error || hint ? (
        <Text variant={TextVariant.Caption} tone={error ? TextTone.Danger : TextTone.Muted}>
          {error ?? hint}
        </Text>
      ) : null}
      {values.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
          {values.map((value) => (
            <View
              key={value}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.space.xxs,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.primarySubtle,
                paddingLeft: theme.space.md,
              }}
            >
              <Text variant={TextVariant.Label} style={{ color: theme.colors.primary }}>
                {value}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={removeLabel(value)}
                onPress={() => onRemove(value)}
                style={{ width: theme.touchTarget, height: theme.touchTarget, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon icon={X} size={IconSize.Small} color={theme.colors.primary} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
