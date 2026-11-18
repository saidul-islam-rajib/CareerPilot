import { useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { assistCopyItems, usePortalActions, useT } from '@careerpilot/client-core';
import type { FillPlan } from '@careerpilot/api-client';
import { Button, ButtonVariant, Card, Text, TextTone, TextVariant } from '@/ui';

export function AssistCopyPanel({ plan, applicationId, showLinkOnlyNote = false }: { plan: FillPlan; applicationId: string; showLinkOnlyNote?: boolean }) {
  const t = useT();
  const actions = usePortalActions();
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (id: string, value: string) => {
    await Clipboard.setStringAsync(value);
    setCopied(id);
  };
  const copyPassword = () =>
    actions.revealPassword.mutate(applicationId, { onSuccess: (secret) => void copy('password', secret.password) });
  return (
    <Card>
      <Text variant={TextVariant.Subheading}>{t('portal.assist.copyTitle')}</Text>
      {showLinkOnlyNote ? <Text tone={TextTone.Muted}>{t('portal.assist.linkOnly')}</Text> : null}
      <Button
        label={t('portal.assist.openOfficial')}
        variant={ButtonVariant.Outline}
        fullWidth
        onPress={() => void WebBrowser.openBrowserAsync(plan.officialUrl)}
        testID="assist-open-official"
      />
      {assistCopyItems(plan).map((item) => (
        <Button
          key={item.id}
          label={`${copied === item.id ? t('portal.assist.copied') : t('portal.assist.copy')}: ${item.labelKey ? t(item.labelKey) : item.label}`}
          variant={ButtonVariant.Outline}
          fullWidth
          onPress={() => void copy(item.id, item.value)}
          testID={`assist-copy-${item.id}`}
        />
      ))}
      {plan.hasPassword ? (
        <Button
          label={copied === 'password' ? t('portal.assist.copied') : t('portal.assist.copyPassword')}
          variant={ButtonVariant.Outline}
          fullWidth
          loading={actions.revealPassword.isPending}
          onPress={copyPassword}
          testID="assist-copy-password"
        />
      ) : null}
    </Card>
  );
}
