import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AssistCvState,
  AssistLeftKind,
  assistUsesWebView,
  buildAssistScript,
  cvCommand,
  parseAssistMessage,
  passwordCommand,
  toBase64,
  usePortalActions,
  usePortalFillPlan,
  useT,
  type AssistStatus,
} from '@careerpilot/client-core';
import type { FillPlan } from '@careerpilot/api-client';
import { useTheme } from '@/core/theme/theme';
import { Button, ButtonVariant, Card, ErrorState, LoadingState, Screen, SnackbarTone, Text, TextTone, TextVariant, useSnackbar } from '@/ui';
import { AssistCopyPanel } from './assist-copy-panel';

const EMPTY_STATUS: AssistStatus = { filled: 0, left: [], cv: AssistCvState.None, confirmation: '', url: '' };
const WEB_ORIGINS = ['https://*', 'http://*'];

interface CvPayload {
  name: string;
  type: string;
  data: string;
}

async function loadCv(plan: FillPlan): Promise<CvPayload | null> {
  if (!plan.cv) {
    return null;
  }
  try {
    const response = await fetch(plan.cv.url);
    const buffer = await response.arrayBuffer();
    return { name: plan.cv.name, type: response.headers.get('content-type') ?? '', data: toBase64(new Uint8Array(buffer)) };
  } catch {
    return null;
  }
}

function AssistBar({ plan, status, applicationId, onUsePassword, passwordLoading }: { plan: FillPlan; status: AssistStatus; applicationId: string; onUsePassword: () => void; passwordLoading: boolean }) {
  const t = useT();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const snackbar = useSnackbar();
  const actions = usePortalActions();
  const [showLeft, setShowLeft] = useState(false);
  const done = () => {
    snackbar.show({ message: t('portal.assist.recorded'), tone: SnackbarTone.Success });
    router.back();
  };
  const failed = () => snackbar.show({ message: t('portal.assist.failed'), tone: SnackbarTone.Danger });
  const record = () =>
    actions.complete.mutate(
      { applicationId, body: { finalUrl: status.url, confirmationText: status.confirmation } },
      { onSuccess: done, onError: failed },
    );
  const markComplete = () => actions.complete.mutate({ applicationId, body: { finalUrl: status.url } }, { onSuccess: done, onError: failed });
  return (
    <View style={{ padding: theme.space.md, paddingBottom: theme.space.md + insets.bottom, gap: theme.space.sm, backgroundColor: theme.colors.card, borderTopWidth: theme.borderWidth.hairline, borderTopColor: theme.colors.border }} testID="assist-bar">
      <Text>
        {t('portal.assist.barFilled', { count: status.filled })} · {t('portal.assist.barLeft', { count: status.left.length })}
      </Text>
      <Text tone={TextTone.Muted}>{t('portal.assist.barNote')}</Text>
      {status.cv === AssistCvState.Attached ? <Text tone={TextTone.Muted}>{t('portal.assist.cvAttached')}</Text> : null}
      {status.cv === AssistCvState.Pick ? <Text>{t('portal.assist.cvPick', { name: plan.cv?.name ?? '' })}</Text> : null}
      {showLeft
        ? status.left.map((item) => (
            <Text key={item.label} tone={TextTone.Muted}>
              • {item.label} ({item.kind === AssistLeftKind.Protected ? t('portal.assist.kindProtected') : t('portal.assist.kindOther')})
            </Text>
          ))
        : null}
      <View style={{ flexDirection: 'row', gap: theme.space.sm, flexWrap: 'wrap' }}>
        {status.left.length ? <Button label={t('portal.assist.leftTitle')} variant={ButtonVariant.Outline} onPress={() => setShowLeft(!showLeft)} testID="assist-left" /> : null}
        {plan.hasPassword ? <Button label={t('portal.assist.usePassword')} variant={ButtonVariant.Outline} loading={passwordLoading} onPress={onUsePassword} testID="assist-use-password" /> : null}
        {status.confirmation ? (
          <Button label={t('portal.assist.recordSubmitted')} onPress={record} loading={actions.complete.isPending} testID="assist-record" />
        ) : (
          <Button label={t('portal.assist.markComplete')} variant={ButtonVariant.Outline} onPress={markComplete} loading={actions.complete.isPending} testID="assist-mark-complete" />
        )}
      </View>
    </View>
  );
}

function AssistWebView({ plan, applicationId }: { plan: FillPlan; applicationId: string }) {
  const t = useT();
  const snackbar = useSnackbar();
  const actions = usePortalActions();
  const ref = useRef<WebView<unknown>>(null);
  const passwordRef = useRef<string | null>(null);
  const cvRef = useRef<CvPayload | null>(null);
  const [status, setStatus] = useState<AssistStatus>(EMPTY_STATUS);
  const inject = useCallback((script: string) => ref.current?.injectJavaScript(script), []);
  const pushSecrets = useCallback(() => {
    if (cvRef.current) {
      inject(cvCommand(cvRef.current.name, cvRef.current.type, cvRef.current.data));
    }
    if (passwordRef.current) {
      inject(passwordCommand(passwordRef.current));
    }
  }, [inject]);
  useEffect(() => {
    void loadCv(plan).then((cv) => {
      cvRef.current = cv;
      pushSecrets();
    });
  }, [plan, pushSecrets]);
  const onMessage = (event: WebViewMessageEvent) => {
    const parsed = parseAssistMessage(event.nativeEvent.data);
    if (parsed) {
      setStatus(parsed);
    }
  };
  const applySavedPassword = () =>
    actions.revealPassword.mutate(applicationId, {
      onSuccess: (secret) => {
        passwordRef.current = secret.password;
        inject(passwordCommand(secret.password));
      },
      onError: () => snackbar.show({ message: t('portal.assist.passwordFailed'), tone: SnackbarTone.Danger }),
    });
  return (
    <View style={{ flex: 1 }}>
      <WebView<unknown>
        ref={ref}
        source={{ uri: plan.officialUrl }}
        originWhitelist={WEB_ORIGINS}
        injectedJavaScript={buildAssistScript(plan)}
        injectedJavaScriptForMainFrameOnly={false}
        onMessage={onMessage}
        onLoadEnd={pushSecrets}
        javaScriptEnabled
        domStorageEnabled
        testID="assist-webview"
      />
      <AssistBar plan={plan} status={status} applicationId={applicationId} onUsePassword={applySavedPassword} passwordLoading={actions.revealPassword.isPending} />
    </View>
  );
}

export function AssistedApplyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const plan = usePortalFillPlan(id);
  if (plan.isPending) {
    return <LoadingState />;
  }
  if (plan.isError) {
    return <ErrorState body={t('portal.assist.unavailable')} onRetry={() => void plan.refetch()} />;
  }
  if (!assistUsesWebView(plan.data)) {
    return (
      <Screen testID="assisted-apply-screen">
        <Card>
          <Text variant={TextVariant.Subheading}>{t('portal.assist.title')}</Text>
        </Card>
        <AssistCopyPanel plan={plan.data} applicationId={id} showLinkOnlyNote />
      </Screen>
    );
  }
  return <AssistWebView plan={plan.data} applicationId={id} />;
}
