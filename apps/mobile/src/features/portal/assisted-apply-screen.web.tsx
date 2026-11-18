import { useLocalSearchParams } from 'expo-router';
import { usePortalFillPlan, useT } from '@careerpilot/client-core';
import { ErrorState, LoadingState, Screen } from '@/ui';
import { AssistCopyPanel } from './assist-copy-panel';

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
  return (
    <Screen testID="assisted-apply-screen">
      <AssistCopyPanel plan={plan.data} applicationId={id} showLinkOnlyNote />
    </Screen>
  );
}
