import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, ApiErrorCode } from '@careerpilot/api-client';
import { ReportKind } from '@careerpilot/domain-ui-logic';
import { queryKeys } from '../query/query-keys';
import { useApi } from '../services/app-services';

export const REPORT_DUPLICATE = 'listingReports.duplicate';
export const REPORT_FAILED = 'listingReports.failed';

export function reportErrorKey(error: unknown): string {
  return error instanceof ApiError && error.code === ApiErrorCode.Conflict ? REPORT_DUPLICATE : REPORT_FAILED;
}

export function useOpportunityReport(opportunityId: string) {
  const api = useApi();
  const client = useQueryClient();
  const [kind, setKind] = useState<ReportKind>(ReportKind.DeadLink);
  const [note, setNote] = useState('');
  const send = useMutation({
    mutationFn: () => api.opportunities.reportOpportunity(opportunityId, { kind, note }),
    onSuccess: async () => {
      setNote('');
      await client.invalidateQueries({ queryKey: queryKeys.myReports });
    },
  });
  return {
    kind,
    note,
    setKind,
    setNote,
    submit: () => send.mutate(),
    sending: send.isPending,
    sent: send.isSuccess,
    errorKey: send.isError ? reportErrorKey(send.error) : undefined,
  };
}
