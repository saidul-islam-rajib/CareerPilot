import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { useT } from '@careerpilot/client-core';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, CheckCircle2, X } from '@/ui/icons';
import { useTheme } from '@/core/theme/theme';
import { Icon, IconSize } from './icon';
import { Text, TextVariant } from './text';

export const SnackbarTone = {
  Success: 'success',
  Danger: 'danger',
} as const;
export type SnackbarTone = (typeof SnackbarTone)[keyof typeof SnackbarTone];

export interface SnackbarInput {
  message: string;
  tone?: SnackbarTone;
  actionLabel?: string;
  onAction?: () => void;
}

interface Snack extends SnackbarInput {
  id: number;
}

interface SnackbarApi {
  show: (input: SnackbarInput) => void;
}

const SnackbarContext = createContext<SnackbarApi | undefined>(undefined);

function SnackItem({ snack, onClose }: { snack: Snack; onClose: (id: number) => void }) {
  const theme = useTheme();
  const t = useT();
  useEffect(() => {
    const timer = setTimeout(() => onClose(snack.id), snack.onAction ? theme.feedback.undoToastMs : theme.feedback.toastMs);
    return () => clearTimeout(timer);
  }, [onClose, snack.id, snack.onAction, theme.feedback.toastMs, theme.feedback.undoToastMs]);
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.sm,
        borderRadius: theme.radius.card,
        backgroundColor: theme.colors.text,
        paddingLeft: theme.space.md,
        paddingRight: theme.space.xs,
        minHeight: theme.touchTarget,
      }}
    >
      <Icon icon={snack.tone === SnackbarTone.Danger ? AlertCircle : CheckCircle2} size={IconSize.Small} color={snack.tone === SnackbarTone.Danger ? theme.colors.dangerSubtle : theme.colors.successSubtle} />
      <Text variant={TextVariant.Label} style={{ flex: 1, color: theme.colors.background }}>
        {snack.message}
      </Text>
      {snack.actionLabel && snack.onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={snack.actionLabel}
          onPress={() => {
            snack.onAction?.();
            onClose(snack.id);
          }}
          style={{ minHeight: theme.touchTarget, justifyContent: 'center', paddingHorizontal: theme.space.sm }}
        >
          <Text variant={TextVariant.Label} style={{ color: theme.colors.background, textDecorationLine: 'underline' }}>
            {snack.actionLabel}
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        onPress={() => onClose(snack.id)}
        style={{ width: theme.touchTarget, height: theme.touchTarget, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon icon={X} size={IconSize.Small} color={theme.colors.background} />
      </Pressable>
    </View>
  );
}

export function SnackbarProvider({ children }: PropsWithChildren) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [snacks, setSnacks] = useState<Snack[]>([]);
  const nextId = useRef(0);
  const close = useCallback((id: number) => setSnacks((current) => current.filter((snack) => snack.id !== id)), []);
  const api = useMemo<SnackbarApi>(
    () => ({
      show: (input) => {
        nextId.current += 1;
        const id = nextId.current;
        setSnacks((current) => [...current, { ...input, id }].slice(-theme.feedback.maxToasts));
      },
    }),
    [theme.feedback.maxToasts],
  );
  return (
    <SnackbarContext.Provider value={api}>
      {children}
      {snacks.length > 0 ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: theme.space.lg,
            right: theme.space.lg,
            bottom: insets.bottom + theme.touchTarget + theme.space.xl,
            gap: theme.space.sm,
            alignItems: 'stretch',
          }}
        >
          {snacks.map((snack) => (
            <SnackItem key={snack.id} snack={snack} onClose={close} />
          ))}
        </View>
      ) : null}
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): SnackbarApi {
  const value = useContext(SnackbarContext);
  if (!value) {
    throw new Error('SnackbarProvider is missing');
  }
  return value;
}
