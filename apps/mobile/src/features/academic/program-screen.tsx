import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAcademicActions, useProgram, useT } from '@careerpilot/client-core';
import type { Program } from '@careerpilot/api-client';
import { Routes } from '@/core/navigation/routes';
import { useTheme } from '@/core/theme/theme';
import { Button, ButtonVariant, ErrorState, LoadingState, Screen, Text, TextTone, TextVariant } from '@/ui';
import { Notices, useEnumLabel } from './academic-parts';
import {
  ChecklistSection,
  DecisionSection,
  FundingSection,
  PlanSection,
  PortalSection,
  RecommendationsSection,
  RequirementsSection,
  useSave,
} from './program-parts';

function ProgramBody({ program }: { program: Program }) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const label = useEnumLabel();
  const actions = useAcademicActions();
  const save = useSave(program);
  return (
    <Screen testID="program-screen">
      <View style={{ gap: theme.space.xs }}>
        <Text variant={TextVariant.Heading}>{program.title}</Text>
        <Text tone={TextTone.Muted}>
          {program.university} · {label('StudyKind', program.kind)}
        </Text>
      </View>
      <Notices />
      <PlanSection programId={program.id} />
      <RequirementsSection program={program} save={save} />
      <FundingSection program={program} save={save} />
      <PortalSection program={program} save={save} />
      <RecommendationsSection program={program} />
      <DecisionSection program={program} save={save} />
      <ChecklistSection program={program} save={save} />
      <Button
        label={t('academic.common.remove')}
        variant={ButtonVariant.Destructive}
        onPress={() => void actions.removeProgram.mutateAsync(program.id).then(() => router.replace(Routes.students))}
      />
    </Screen>
  );
}

export function ProgramScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const program = useProgram(id);
  if (program.isPending) {
    return <LoadingState />;
  }
  if (program.isError) {
    return <ErrorState onRetry={() => void program.refetch()} />;
  }
  return <ProgramBody program={program.data} />;
}
