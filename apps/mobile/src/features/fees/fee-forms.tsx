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
import { Button, ButtonVariant, Card, SelectField, SwitchRow, Text, TextField, TextTone } from '@/ui';

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
  const currency = state.currency || reference.data?.defaultCurrency || '';
  return (
    <>
      <SelectField
        label={t('fees.form.kind')}
        value={state.kind}
        placeholder={t('fees.form.kind')}
        options={Object.values(FeeKind).map((kind) => ({ value: kind, label: t(feeKindKey(kind)) }))}
        onChange={(value) => set('kind', value as FeeKind)}
      />
      <TextField label={t('fees.form.title')} value={state.title} error={errors.title} onChangeText={(value) => set('title', value)} />
      <TextField label={t('fees.form.payee')} value={state.payee} onChangeText={(value) => set('payee', value)} />
      <SwitchRow
        label={t('fees.form.payeeVerified')}
        description={t('fees.form.payeeVerifiedHint')}
        value={state.payeeVerified}
        onChange={(value) => set('payeeVerified', value)}
      />
      <TextField
        label={t('fees.form.amount')}
        keyboardType="number-pad"
        value={state.amount}
        error={errors.amount}
        onChangeText={(value) => set('amount', value)}
      />
      <SelectField
        label={t('fees.form.currency')}
        value={currency}
        placeholder={t('fees.form.currency')}
        options={(reference.data?.currencies ?? [currency]).map((code) => ({ value: code, label: code }))}
        onChange={(value) => set('currency', value)}
      />
      <TextField label={t('fees.form.purpose')} value={state.purpose} onChangeText={(value) => set('purpose', value)} />
      <TextField
        label={t('fees.form.deadline')}
        hint={t('fees.form.deadlineHint')}
        value={state.deadline}
        error={errors.deadline}
        onChangeText={(value) => set('deadline', value)}
      />
    </>
  );
}

function useSubmit(form: FormState, onDone: () => void) {
  const reference = useFeesReference();
  return (send: (state: FeeFormState, done: { onSuccess: () => void; onError: (error: unknown) => void }) => void) => {
    const errors = feeFormErrors(form.state);
    form.setErrors(errors);
    if (feeFormHasErrors(errors)) {
      return;
    }
    send(withCurrency(form.state, reference.data?.defaultCurrency), { onSuccess: onDone, onError: (error) => form.setFailure(feeErrorKey(error)) });
  };
}

function FormButtons({ form, busy, onSave, onCancel }: { form: FormState; busy: boolean; onSave: () => void; onCancel: () => void }) {
  const t = useT();
  return (
    <>
      {form.failure ? <Text tone={TextTone.Danger}>{t(form.failure)}</Text> : null}
      <Button label={t('fees.save')} onPress={onSave} loading={busy} fullWidth testID="fees-save" />
      <Button label={t('common.cancel')} variant={ButtonVariant.Outline} onPress={onCancel} fullWidth />
    </>
  );
}

export function RuleForm({ initial, onDone }: { initial?: RuleView; onDone: () => void }) {
  const t = useT();
  const actions = useFeeActions();
  const form = useFormState(initial ? feeFormOfRule(initial) : blankFeeForm(''));
  const submit = useSubmit(form, onDone);
  const save = () =>
    submit((state, done) => {
      if (initial) {
        actions.updateRule.mutate({ id: initial.rule.id, rule: feeRuleInput(state) }, done);
      } else {
        actions.createRule.mutate(feeRuleInput(state), done);
      }
    });
  return (
    <Card>
      <Text>{t('fees.form.ruleTitle')}</Text>
      <CommonFields form={form} />
      <TextField label={t('fees.form.organization')} value={form.state.organization} onChangeText={(value) => form.set('organization', value)} />
      <TextField label={t('fees.form.sourceUrl')} keyboardType="url" autoCapitalize="none" value={form.state.sourceUrl} onChangeText={(value) => form.set('sourceUrl', value)} />
      <TextField label={t('fees.form.waiverNote')} value={form.state.waiverNote} onChangeText={(value) => form.set('waiverNote', value)} />
      <TextField label={t('fees.form.note')} value={form.state.note} onChangeText={(value) => form.set('note', value)} />
      <FormButtons form={form} busy={actions.createRule.isPending || actions.updateRule.isPending} onSave={save} onCancel={onDone} />
    </Card>
  );
}

export function PaymentForm({ initial, onDone }: { initial?: Payment; onDone: () => void }) {
  const t = useT();
  const actions = useFeeActions();
  const form = useFormState(initial ? feeFormOfPayment(initial) : blankFeeForm(''));
  const submit = useSubmit(form, onDone);
  const save = () =>
    submit((state, done) => {
      if (initial) {
        actions.updatePayment.mutate({ id: initial.id, payment: feePaymentInput(state, initial) }, done);
      } else {
        actions.createPayment.mutate(feePaymentInput(state), done);
      }
    });
  return (
    <Card>
      <Text>{t('fees.form.paymentTitle')}</Text>
      <CommonFields form={form} />
      <SelectField
        label={t('fees.form.method')}
        value={form.state.method}
        placeholder={t('fees.form.method')}
        options={[
          { value: NO_METHOD, label: '' },
          ...Object.values(PaymentMethod).map((method) => ({ value: method, label: t(enumLabelKey('payment_method', method)) })),
        ]}
        onChange={(value) => form.set('method', value)}
      />
      <TextField
        label={t('fees.form.transactionId')}
        hint={t('fees.form.transactionHint')}
        value={form.state.transactionId}
        autoCapitalize="characters"
        onChangeText={(value) => form.set('transactionId', value)}
      />
      <TextField label={t('fees.form.note')} value={form.state.note} onChangeText={(value) => form.set('note', value)} />
      <FormButtons form={form} busy={actions.createPayment.isPending || actions.updatePayment.isPending} onSave={save} onCancel={onDone} />
    </Card>
  );
}
