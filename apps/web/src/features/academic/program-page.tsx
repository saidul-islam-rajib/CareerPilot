'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAcademicActions, useProgram, useT } from '@careerpilot/client-core';
import { Button, ErrorState, LoadingState, PageHeader } from '@careerpilot/ui-web';
import { Routes } from '@/core/routes';
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
import type { Program } from '@careerpilot/api-client';

function ProgramBody({ program }: { program: Program }) {
  const t = useT();
  const router = useRouter();
  const label = useEnumLabel();
  const actions = useAcademicActions();
  const save = useSave(program);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={program.title}
        description={`${program.university} · ${label('StudyKind', program.kind)}`}
        actions={
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (window.confirm(t('academic.program.removeConfirm'))) {
                void actions.removeProgram.mutateAsync(program.id).then(() => router.push(Routes.students));
              }
            }}
          >
            {t('academic.common.remove')}
          </Button>
        }
      />
      <Link href={Routes.students} className="text-sm text-primary hover:underline">
        {t('academic.common.back')}
      </Link>
      <Notices />
      <PlanSection programId={program.id} />
      <RequirementsSection program={program} save={save} />
      <FundingSection program={program} save={save} />
      <PortalSection program={program} save={save} />
      <RecommendationsSection program={program} />
      <DecisionSection program={program} save={save} />
      <ChecklistSection program={program} save={save} />
    </div>
  );
}

export function ProgramPage() {
  const { id } = useParams<{ id: string }>();
  const program = useProgram(id);
  if (program.isLoading) {
    return <LoadingState />;
  }
  if (program.isError || !program.data) {
    return <ErrorState onRetry={() => void program.refetch()} />;
  }
  return <ProgramBody program={program.data} />;
}
