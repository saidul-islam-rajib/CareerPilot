import { describe, expect, it } from 'vitest';
import { catalogs, createTranslator } from '@careerpilot/i18n';
import {
  FeeGuidance,
  FeeKind,
  FeeReminderKind,
  FeeUrgency,
  FeeWarning,
  PaymentAction,
  PaymentStatus,
  ReceiptKind,
} from '@careerpilot/domain-ui-logic';
import {
  actionNeedsNote,
  availableActions,
  dateOfDeadline,
  deadlineFromDate,
  feeActionKey,
  feeGuidanceKey,
  feeKindKey,
  feeReceiptKey,
  feeReminderKey,
  feeStatusKey,
  feeUrgencyKey,
  feeWarningKey,
  isOpenStatus,
} from './use-fees';

const t = createTranslator(catalogs.en);

function expectText(key: string) {
  expect(t(key)).not.toBe(key);
}

describe('fee helpers', () => {
  it('has catalog text for every status, kind, action, guidance, warning, reminder and receipt kind', () => {
    Object.values(PaymentStatus).forEach((value) => expectText(feeStatusKey(value)));
    Object.values(FeeKind).forEach((value) => expectText(feeKindKey(value)));
    Object.values(PaymentAction).forEach((value) => expectText(feeActionKey(value)));
    Object.values(FeeGuidance).forEach((value) => expectText(feeGuidanceKey(value)));
    Object.values(FeeWarning).forEach((value) => expectText(feeWarningKey(value)));
    Object.values(FeeReminderKind).forEach((value) => expectText(feeReminderKey(value)));
    Object.values(ReceiptKind).forEach((value) => expectText(feeReceiptKey(value)));
    expect(feeUrgencyKey(FeeUrgency.None)).toBeUndefined();
    expectText(feeUrgencyKey(FeeUrgency.Overdue) ?? '');
  });

  it('offers only actions that are allowed from a status', () => {
    expect(availableActions(PaymentStatus.Uncertain)).toContain(PaymentAction.ConfirmNotPaid);
    expect(availableActions(PaymentStatus.Due)).not.toContain(PaymentAction.ConfirmNotPaid);
    expect(availableActions(PaymentStatus.Refunded)).toEqual([]);
    expect(actionNeedsNote(PaymentAction.MarkRefunded)).toBe(true);
    expect(isOpenStatus(PaymentStatus.Uncertain)).toBe(true);
    expect(isOpenStatus(PaymentStatus.Paid)).toBe(false);
  });

  it('turns a typed date into a deadline and back', () => {
    expect(deadlineFromDate('')).toBeUndefined();
    expect(deadlineFromDate('soon')).toBeNull();
    const deadline = deadlineFromDate('2026-11-12');
    expect(deadline).toEqual(expect.any(String));
    expect(dateOfDeadline(deadline ?? undefined)).toBe('2026-11-12');
    expect(dateOfDeadline(undefined)).toBe('');
  });
});
