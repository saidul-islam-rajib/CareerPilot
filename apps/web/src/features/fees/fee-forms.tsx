'use client';

import { useState } from 'react';
import type { Payment, RuleView } from '@careerpilot/api-client';
import {
  NO_METHOD,
  blankFeeForm,
  enumLabelKey,
  feeErrorKey,
  feeFormErrors,
  feeFormHasErrors,
  feeFormOfPayment,
  feeFormOfRule,
  feeKindKey,
  feePaymentInput,
  feeRuleInput,
  useFeeActions,
  useFeesReference,
  useT,
  withCurrency,
  type FeeFormErrors,
  type FeeFormState,
} from '@careerpilot/client-core';
import { FeeKind, PaymentMethod } from '@careerpilot/domain-ui-logic';
import { FormDialog, SelectField, SwitchField, TextField } from '@careerpilot/ui-web';

function useFormState(initial: FeeFormState) {
  const [state, setState] = useState(initial);
  const [errors, setErrors] = useState<FeeFormErrors>({});
  const [failure, setFailure] = useState<string | undefined>();
  const set = <K extends keyof FeeFormState>(key: K, value: FeeFormState[K]) => setState((current) => ({ ...current, [key]: value }));
  return { state, set, errors, setErrors, failure, setFailure };
}

type FormState = ReturnType<typeof useFormState>;

function CommonFields({ form }: { form: FormState }) {
  const t = useT();
  const reference = useFeesReference();
  const { state, set, errors } = form;
  return (
    <>
      <SelectField
        label={t('fees.form.kind')}
        value={state.kind}
        options={Object.values(FeeKind).map((kind) => ({ value: kind, label: t(feeKindKey(kind)) }))}
        onValueChange={(value) => set('kind', value as FeeKind)}
      />
      <TextField label={t('fees.form.title')} value={state.title} error={errors.title} onChange={(event) => set('title', event.target.value)} />
      <TextField label={t('fees.form.payee')} value={state.payee} onChange={(event) => set('payee', event.target.value)} />
      <SwitchField
        checked={state.payeeVerified}
        onChange={(value) => set('payeeVerified', value)}
        label={t('fees.form.payeeVerified')}
        description={t('fees.form.payeeVerifiedHint')}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label={t('fees.form.amount')}
          inputMode="numeric"
          value={state.amount}
          error={errors.amount}
          onChange={(event) => set('amount', event.target.value)}
        />
        <SelectField
          label={t('fees.form.currency')}
          value={state.currency || reference.data?.defaultCurrency || ''}
          options={(reference.data?.currencies ?? [state.currency]).map((code) => ({ value: code, label: code }))}
          onValueChange={(value) => set('currency', value)}
        />
      </div>
      <TextField label={t('fees.form.purpose')} value={state.purpose} onChange={(event) => set('purpose', event.target.value)} />
      <TextField
        label={t('fees.form.deadline')}
        placeholder={t('fees.form.deadlineHint')}
        value={state.deadline}
        error={errors.deadline}
        onChange={(event) => set('deadline', event.target.value)}
      />
    </>
  );
}

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function useSubmit(form: FormState, onOpenChange: (open: boolean) => void) {
  const reference = useFeesReference();
  return (send: (state: FeeFormState, done: { onSuccess: () => void; onError: (error: unknown) => void }) => void) => {
    const errors = feeFormErrors(form.state);
    form.setErrors(errors);
    if (feeFormHasErrors(errors)) {
      return;
    }
    send(withCurrency(form.state, reference.data?.defaultCurrency), {
      onSuccess: () => onOpenChange(false),
      onError: (error) => form.setFailure(feeErrorKey(error)),
    });
  };
}

export function RuleFormDialog({ open, onOpenChange, initial }: DialogProps & { initial?: RuleView }) {
  const t = useT();
  const actions = useFeeActions();
  const form = useFormState(initial ? feeFormOfRule(initial) : blankFeeForm(''));
  const submit = useSubmit(form, onOpenChange);
  const save = () =>
    submit((state, done) => {
      if (initial) {
        actions.updateRule.mutate({ id: initial.rule.id, rule: feeRuleInput(state) }, done);
      } else {
        actions.createRule.mutate(feeRuleInput(state), done);
      }
    });
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('fees.form.ruleTitle')}
      submitLabel={t('fees.save')}
      submitting={actions.createRule.isPending || actions.updateRule.isPending}
      error={form.failure ? t(form.failure) : undefined}
      onSubmit={save}
    >
      <CommonFields form={form} />
      <TextField label={t('fees.form.organization')} value={form.state.organization} onChange={(event) => form.set('organization', event.target.value)} />
      <TextField label={t('fees.form.sourceUrl')} inputMode="url" value={form.state.sourceUrl} onChange={(event) => form.set('sourceUrl', event.target.value)} />
      <TextField label={t('fees.form.waiverNote')} value={form.state.waiverNote} onChange={(event) => form.set('waiverNote', event.target.value)} />
      <TextField label={t('fees.form.note')} value={form.state.note} onChange={(event) => form.set('note', event.target.value)} />
    </FormDialog>
  );
}

export function PaymentFormDialog({ open, onOpenChange, initial }: DialogProps & { initial?: Payment }) {
  const t = useT();
  const actions = useFeeActions();
  const form = useFormState(initial ? feeFormOfPayment(initial) : blankFeeForm(''));
  const submit = useSubmit(form, onOpenChange);
  const save = () =>
    submit((state, done) => {
      if (initial) {
        actions.updatePayment.mutate({ id: initial.id, payment: feePaymentInput(state, initial) }, done);
      } else {
        actions.createPayment.mutate(feePaymentInput(state), done);
      }
    });
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('fees.form.paymentTitle')}
      submitLabel={t('fees.save')}
      submitting={actions.createPayment.isPending || actions.updatePayment.isPending}
      error={form.failure ? t(form.failure) : undefined}
      onSubmit={save}
    >
      <CommonFields form={form} />
      <SelectField
        label={t('fees.form.method')}
        value={form.state.method}
        options={[
          { value: NO_METHOD, label: '' },
          ...Object.values(PaymentMethod).map((method) => ({ value: method, label: t(enumLabelKey('payment_method', method)) })),
        ]}
        onValueChange={(value) => form.set('method', value)}
      />
      <TextField
        label={t('fees.form.transactionId')}
        hint={t('fees.form.transactionHint')}
        value={form.state.transactionId}
        onChange={(event) => form.set('transactionId', event.target.value)}
      />
      <TextField label={t('fees.form.note')} value={form.state.note} onChange={(event) => form.set('note', event.target.value)} />
    </FormDialog>
  );
}
