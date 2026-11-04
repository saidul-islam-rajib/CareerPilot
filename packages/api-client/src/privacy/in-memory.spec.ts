import { describe, expect, it } from 'vitest';
import { ConsentKind, DeletionStatus, ExportStatus, ExportFormat, ExportKind } from '@careerpilot/domain-ui-logic';
import { ApiError, ApiErrorCode } from '../errors';
import { createInMemoryPrivacy } from './in-memory';

const clock = { now: () => new Date('2026-11-01T06:00:00.000Z') };
const respond = <T>(value: T) => Promise.resolve(value);
const fail = (code: ApiErrorCode) => Promise.reject(new ApiError(code));
let counter = 0;
const ids = { next: (prefix: string) => `${prefix}_${++counter}` };

function create() {
  return createInMemoryPrivacy({ clock, ids, respond, fail, graceDays: 14, password: () => 'secret' });
}

describe('in-memory privacy', () => {
  it('creates exports that are ready with a link', async () => {
    const api = create();
    const view = await api.requestExport({ kind: ExportKind.Applications, format: ExportFormat.Csv });
    expect(view.status).toBe(ExportStatus.Ready);
    expect((await api.listExports())[0]?.id).toBe(view.id);
    expect((await api.getExport(view.id)).downloadUrl).toBeDefined();
  });

  it('needs the password to schedule deletion and can cancel it', async () => {
    const api = create();
    await expect(api.requestDeletion('wrong')).rejects.toMatchObject({ code: ApiErrorCode.InvalidCredentials });
    const view = await api.requestDeletion('secret');
    expect(view.status).toBe(DeletionStatus.Requested);
    expect(view.scheduledFor).toBe('2026-11-15T06:00:00.000Z');
    expect((await api.cancelDeletion()).status).toBeUndefined();
  });

  it('keeps required consents on and records optional changes', async () => {
    const api = create();
    await expect(api.updateConsent(ConsentKind.Terms, false)).rejects.toMatchObject({ code: ApiErrorCode.Validation });
    const overview = await api.updateConsent(ConsentKind.Marketing, true);
    expect(overview.current.find((c) => c.kind === ConsentKind.Marketing)?.granted).toBe(true);
    expect(overview.history[0]?.kind).toBe(ConsentKind.Marketing);
  });
});
