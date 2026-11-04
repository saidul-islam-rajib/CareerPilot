import { useState } from 'react';
import { View } from 'react-native';
import {
  academicErrorKey,
  useAcademicActions,
  useApi,
  useFormat,
  useProgramPlan,
  useRecommendations,
  useReferees,
  useT,
} from '@careerpilot/client-core';
import {
  AgreementStatus,
  AmountSource,
  BudgetKind,
  DeadlineKind,
  DecisionKind,
  EvidenceStatus,
  ExamKind,
  FundingStatus,
  ItemProgress,
  NeedLevel,
  PortalFee,
  PortalSubmission,
  ReceiptEvidence,
  RecommendationStatus,
  ScorePolicy,
  StatusTone,
  SubmissionMethod,
  UserAction,
} from '@careerpilot/domain-ui-logic';
import { emptyDecision, emptyRecommendationInput, emptyStudyExamRequirement, type Program, type ProgramInput } from '@careerpilot/api-client';
import { useTheme } from '@/core/theme/theme';
import { Badge, Button, ButtonVariant, Card, Checkbox, SelectField, Section, Text, TextField, TextTone, TextVariant } from '@/ui';
import { useEnumLabel, useEnumOptions, WarningLine } from './academic-parts';
import { dayOrUndefined, FieldType, numberOrUndefined, RecordForm, textOf, type FieldSpec, type FormValues } from './record-form';

export type Save = (change: (draft: ProgramInput) => ProgramInput) => Promise<unknown>;

export function useSave(program: Program): Save {
  const actions = useAcademicActions();
  const { id, ...input } = program;
  return (change) => actions.updateProgram.mutateAsync({ id, input: change(structuredClone(input)) });
}

export function PlanSection({ programId }: { programId: string }) {
  const t = useT();
  const theme = useTheme();
  const format = useFormat();
  const label = useEnumLabel();
  const plan = useProgramPlan(programId);
  if (!plan.data) {
    return null;
  }
  const { steps, warnings, budget, blockers } = plan.data;
  return (
    <Section title={t('academic.program.plan')}>
      <Card>
        <View style={{ gap: theme.space.sm }}>
          <Text tone={TextTone.Muted}>{t('academic.program.planHint')}</Text>
          {warnings.map((warning) => (
            <WarningLine key={`${warning.kind}-${warning.exam ?? ''}`} warning={warning} />
          ))}
          {steps.map((step) => (
            <Text key={`${step.kind}-${step.deadlineKind}-${step.label}`}>
              {format.date(step.on)} · {label('PlanStepKind', step.kind)}
              {step.label ? ` (${step.label})` : ''}
            </Text>
          ))}
          <Text variant={TextVariant.Subheading}>{t('academic.program.budget')}</Text>
          {budget.map((total) => (
            <Text key={total.currency}>
              {total.currency}: {t('academic.program.budgetOfficial')} {total.official} · {t('academic.program.budgetEstimate')} {total.estimate} ·{' '}
              {t('academic.program.budgetTotal')} {total.total}
            </Text>
          ))}
          <Text variant={TextVariant.Subheading}>{t('academic.program.blockers')}</Text>
          {blockers.length ? (
            blockers.map((blocker) => <Text key={blocker}>• {label('PortalBlocker', blocker)}</Text>)
          ) : (
            <Text tone={TextTone.Muted}>{t('academic.program.noBlockers')}</Text>
          )}
        </View>
      </Card>
    </Section>
  );
}

export function RequirementsSection({ program, save }: { program: Program; save: Save }) {
  const t = useT();
  const theme = useTheme();
  const format = useFormat();
  const label = useEnumLabel();
  const options = useEnumOptions();
  const deadlineFields: FieldSpec[] = [
    { key: 'kind', label: t('academic.fields.deadlineKind'), type: FieldType.Select, options: options('DeadlineKind', Object.values(DeadlineKind)) },
    { key: 'on', label: t('academic.fields.deadlineOn'), type: FieldType.Date, hint: 'YYYY-MM-DD' },
    { key: 'note', label: t('academic.common.note'), type: FieldType.Text },
  ];
  const examFields: FieldSpec[] = [
    { key: 'exam', label: t('academic.fields.exam'), type: FieldType.Select, options: options('ExamKind', Object.values(ExamKind)) },
    { key: 'need', label: t('academic.fields.need'), type: FieldType.Select, options: options('NeedLevel', Object.values(NeedLevel)) },
    {
      key: 'evidence',
      label: t('academic.fields.evidence'),
      type: FieldType.Select,
      options: options('EvidenceStatus', Object.values(EvidenceStatus)),
    },
    { key: 'minOverall', label: t('academic.fields.minOverall'), type: FieldType.Number },
    { key: 'policy', label: t('academic.fields.policy'), type: FieldType.Select, options: options('ScorePolicy', Object.values(ScorePolicy)) },
  ];
  return (
    <Section title={t('academic.program.requirements')}>
      <Card>
        <View style={{ gap: theme.space.md }}>
          <Text tone={TextTone.Muted}>{t('academic.program.requirementsHint')}</Text>
          <Text variant={TextVariant.Subheading}>{t('academic.program.deadlines')}</Text>
          {program.deadlines.map((deadline, index) => (
            <View key={`${deadline.kind}-${deadline.on}`} style={{ gap: theme.space.xs }}>
              <Text>
                {label('DeadlineKind', deadline.kind)} · {format.date(deadline.on)}
                {deadline.note ? ` · ${deadline.note}` : ''}
              </Text>
              <Button
                label={t('academic.common.remove')}
                variant={ButtonVariant.Ghost}
                onPress={() => void save((d) => ({ ...d, deadlines: d.deadlines.filter((_, i) => i !== index) }))}
              />
            </View>
          ))}
          <RecordForm
            fields={deadlineFields}
            initial={{ kind: DeadlineKind.Application, on: '', note: '' }}
            submitLabel={t('academic.program.addDeadline')}
            onSubmit={(v) =>
              save((d) => ({
                ...d,
                deadlines: [...d.deadlines, { kind: v.kind as DeadlineKind, on: textOf(v.on), note: textOf(v.note), sourceUrl: '' }],
              }))
            }
          />
          <Text variant={TextVariant.Subheading}>{t('academic.program.tests')}</Text>
          {program.examRequirements.map((requirement, index) => (
            <View key={`${requirement.exam}-${index}`} style={{ gap: theme.space.xs }}>
              <Text>
                {label('ExamKind', requirement.exam)} · {label('NeedLevel', requirement.need)}
                {requirement.minOverall !== undefined ? ` ≥ ${requirement.minOverall}` : ''}
              </Text>
              <Badge
                label={label('EvidenceStatus', requirement.evidence)}
                tone={requirement.evidence === EvidenceStatus.Explicit ? StatusTone.Success : StatusTone.Neutral}
              />
              <Button
                label={t('academic.common.remove')}
                variant={ButtonVariant.Ghost}
                onPress={() => void save((d) => ({ ...d, examRequirements: d.examRequirements.filter((_, i) => i !== index) }))}
              />
            </View>
          ))}
          <RecordForm
            fields={examFields}
            initial={{
              exam: ExamKind.Ielts,
              need: NeedLevel.NotStated,
              evidence: EvidenceStatus.NotStated,
              minOverall: '',
              policy: ScorePolicy.NotStated,
            }}
            submitLabel={t('academic.program.addTest')}
            onSubmit={(v) =>
              save((d) => ({
                ...d,
                examRequirements: [
                  ...d.examRequirements,
                  {
                    ...emptyStudyExamRequirement(v.exam as ExamKind),
                    need: v.need as NeedLevel,
                    evidence: v.evidence as EvidenceStatus,
                    minOverall: numberOrUndefined(v.minOverall),
                    policy: v.policy as ScorePolicy,
                  },
                ],
              }))
            }
          />
        </View>
      </Card>
    </Section>
  );
}

function BudgetForm({ save }: { save: Save }) {
  const t = useT();
  const options = useEnumOptions();
  const fields: FieldSpec[] = [
    { key: 'kind', label: t('academic.fields.budgetKind'), type: FieldType.Select, options: options('BudgetKind', Object.values(BudgetKind)) },
    { key: 'amount', label: t('academic.fields.amount'), type: FieldType.Number },
    { key: 'currency', label: t('academic.fields.currency'), type: FieldType.Text },
    { key: 'source', label: t('academic.fields.feeSource'), type: FieldType.Select, options: options('AmountSource', Object.values(AmountSource)) },
  ];
  return (
    <Card>
      <RecordForm
        fields={fields}
        initial={{ kind: BudgetKind.TestFee, amount: '', currency: '', source: AmountSource.Estimate }}
        submitLabel={t('academic.program.addBudget')}
        onSubmit={(v) =>
          save((d) => ({
            ...d,
            budget: [
              ...d.budget,
              {
                id: '',
                kind: v.kind as BudgetKind,
                amount: numberOrUndefined(v.amount) ?? 0,
                currency: textOf(v.currency) || '-',
                source: v.source as AmountSource,
                note: '',
              },
            ],
          }))
        }
      />
    </Card>
  );
}

export function FundingSection({ program, save }: { program: Program; save: Save }) {
  const t = useT();
  const options = useEnumOptions();
  const { funding, fee } = program;
  const fields: FieldSpec[] = [
    {
      key: 'status',
      label: t('academic.fields.fundingStatus'),
      type: FieldType.Select,
      options: options('FundingStatus', Object.values(FundingStatus)),
    },
    { key: 'tuition', label: t('academic.fields.tuitionPerYear'), type: FieldType.Number },
    { key: 'living', label: t('academic.fields.livingCostPerYear'), type: FieldType.Number },
    { key: 'support', label: t('academic.fields.fundingPerYear'), type: FieldType.Number },
    { key: 'months', label: t('academic.fields.durationMonths'), type: FieldType.Number },
    { key: 'currency', label: t('academic.fields.currency'), type: FieldType.Text },
    { key: 'feeAmount', label: t('academic.fields.feeAmount'), type: FieldType.Number },
    {
      key: 'feeSource',
      label: t('academic.fields.feeSource'),
      type: FieldType.Select,
      options: options('AmountSource', Object.values(AmountSource)),
    },
    { key: 'waiver', label: t('academic.fields.waiverNote'), type: FieldType.Text },
  ];
  const initial: FormValues = {
    status: funding.status,
    tuition: funding.tuitionPerYear?.toString() ?? '',
    living: funding.livingCostPerYear?.toString() ?? '',
    support: funding.fundingPerYear?.toString() ?? '',
    months: funding.durationMonths?.toString() ?? '',
    currency: funding.currency,
    feeAmount: fee.amount?.toString() ?? '',
    feeSource: fee.source,
    waiver: fee.waiverNote,
  };
  return (
    <Section title={t('academic.program.funding')}>
      <Card>
        <RecordForm
          fields={fields}
          initial={initial}
          submitLabel={t('academic.program.saveChanges')}
          onSubmit={(v) =>
            save((d) => ({
              ...d,
              funding: {
                ...d.funding,
                status: v.status as FundingStatus,
                tuitionPerYear: numberOrUndefined(v.tuition),
                livingCostPerYear: numberOrUndefined(v.living),
                fundingPerYear: numberOrUndefined(v.support),
                durationMonths: numberOrUndefined(v.months),
                currency: textOf(v.currency),
              },
              fee: {
                ...d.fee,
                amount: numberOrUndefined(v.feeAmount),
                currency: textOf(v.currency),
                source: v.feeSource as AmountSource,
                waiverNote: textOf(v.waiver),
              },
            }))
          }
        />
      </Card>
      <BudgetForm save={save} />
    </Section>
  );
}

export function PortalSection({ program, save }: { program: Program; save: Save }) {
  const t = useT();
  const theme = useTheme();
  const options = useEnumOptions();
  const portal = program.portal;
  const toggle = (list: 'sections' | 'documents', index: number, flag: boolean) =>
    save((d) => {
      const copy = structuredClone(d);
      const item = copy.portal[list][index];
      if (item) {
        Object.assign(item, list === 'sections' ? { done: flag } : { uploaded: flag });
      }
      return copy;
    });
  return (
    <Section title={t('academic.program.portal')}>
      <Card>
        <View style={{ gap: theme.space.md }}>
          <Text tone={TextTone.Muted}>{t('academic.program.portalHint')}</Text>
          <Text variant={TextVariant.Subheading}>{t('academic.program.sections')}</Text>
          {portal.sections.map((section, index) => (
            <Checkbox
              key={section.name}
              checked={section.done}
              onChange={(flag) => void toggle('sections', index, flag)}
              accessibilityLabel={section.name}
            >
              <Text>{section.name}</Text>
            </Checkbox>
          ))}
          <Text variant={TextVariant.Subheading}>{t('academic.program.documents')}</Text>
          {portal.documents.map((document, index) => (
            <Checkbox
              key={document.name}
              checked={document.uploaded}
              onChange={(flag) => void toggle('documents', index, flag)}
              accessibilityLabel={document.name}
            >
              <Text>{document.name}</Text>
            </Checkbox>
          ))}
          <Text variant={TextVariant.Subheading}>{t('academic.program.pending')}</Text>
          {portal.pendingItems.map((item, index) => (
            <Checkbox
              key={item.id}
              checked={item.received}
              accessibilityLabel={item.name}
              onChange={(flag) =>
                void save((d) => ({
                  ...d,
                  portal: { ...d.portal, pendingItems: d.portal.pendingItems.map((p, i) => (i === index ? { ...p, received: flag } : p)) },
                }))
              }
            >
              <Text>{item.name}</Text>
            </Checkbox>
          ))}
          <RecordForm
            fields={[
              { key: 'section', label: t('academic.fields.sectionName'), type: FieldType.Text },
              { key: 'document', label: t('academic.fields.documentName'), type: FieldType.Text },
              { key: 'pending', label: t('academic.fields.pendingName'), type: FieldType.Text },
              { key: 'fee', label: t('academic.program.fee'), type: FieldType.Select, options: options('PortalFee', Object.values(PortalFee)) },
              {
                key: 'submission',
                label: t('academic.program.submission'),
                type: FieldType.Select,
                options: options('PortalSubmission', Object.values(PortalSubmission)),
              },
              { key: 'account', label: t('academic.fields.accountLabel'), type: FieldType.Text },
            ]}
            initial={{ section: '', document: '', pending: '', fee: portal.fee, submission: portal.submission, account: portal.accountLabel }}
            submitLabel={t('academic.common.save')}
            onSubmit={(v) =>
              save((d) => {
                const add = <T,>(items: T[], name: string, make: (name: string) => T) => (name ? [...items, make(name)] : items);
                return {
                  ...d,
                  portal: {
                    ...d.portal,
                    fee: v.fee as PortalFee,
                    submission: v.submission as PortalSubmission,
                    accountLabel: textOf(v.account),
                    sections: add(d.portal.sections, textOf(v.section), (name) => ({ name, done: false })),
                    documents: add(d.portal.documents, textOf(v.document), (name) => ({ name, uploaded: false })),
                    pendingItems: add(d.portal.pendingItems, textOf(v.pending), (name) => ({ id: '', name, received: false })),
                  },
                };
              })
            }
          />
        </View>
      </Card>
    </Section>
  );
}

export function RecommendationsSection({ program }: { program: Program }) {
  const t = useT();
  const theme = useTheme();
  const label = useEnumLabel();
  const options = useEnumOptions();
  const recommendations = useRecommendations(program.id);
  const referees = useReferees();
  const actions = useAcademicActions();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>();
  const fail = (failure: unknown) => setError(academicErrorKey(failure));
  const consented = (referees.data ?? []).filter((r) => r.consentConfirmedOn);
  const name = (id: string) => referees.data?.find((r) => r.id === id)?.name ?? id;
  return (
    <Section title={t('academic.program.recommendations')}>
      <Card>
        <View style={{ gap: theme.space.md }}>
          <Text tone={TextTone.Muted}>{t('academic.referees.evidenceHint')}</Text>
          <TextField label={t('academic.fields.evidenceNote')} value={note} onChangeText={setNote} />
          {error ? <Text tone={TextTone.Danger}>{t(error)}</Text> : null}
          {recommendations.data?.map((item) => (
            <View key={item.id} style={{ gap: theme.space.xs }}>
              <Text>
                {name(item.refereeId)} · {label('RecommendationStatus', item.status)}
              </Text>
              <Button
                label={t('academic.referees.markSubmitted')}
                variant={ButtonVariant.Outline}
                onPress={() =>
                  actions.setRecommendationStatus.mutate(
                    { id: item.id, change: { status: RecommendationStatus.Submitted, evidence: ReceiptEvidence.UserStatement, evidenceNote: note } },
                    { onError: fail },
                  )
                }
              />
              <Button
                label={t('academic.referees.markConfirmed')}
                variant={ButtonVariant.Outline}
                onPress={() =>
                  actions.setRecommendationStatus.mutate(
                    {
                      id: item.id,
                      change: { status: RecommendationStatus.Confirmed, evidence: ReceiptEvidence.InstitutionConfirmation, evidenceNote: note },
                    },
                    { onError: fail },
                  )
                }
              />
              <Button
                label={t('academic.common.remove')}
                variant={ButtonVariant.Ghost}
                onPress={() => actions.removeRecommendation.mutate(item.id)}
              />
            </View>
          ))}
          <RecordForm
            fields={[
              {
                key: 'referee',
                label: t('academic.fields.referee'),
                type: FieldType.Select,
                options: consented.map((r) => ({ value: r.id, label: r.name })),
              },
              {
                key: 'method',
                label: t('academic.fields.method'),
                type: FieldType.Select,
                options: options('SubmissionMethod', Object.values(SubmissionMethod)),
              },
              { key: 'deadline', label: t('academic.fields.refereeDeadline'), type: FieldType.Date, hint: 'YYYY-MM-DD' },
              {
                key: 'agreement',
                label: t('academic.fields.agreement'),
                type: FieldType.Select,
                options: options('AgreementStatus', Object.values(AgreementStatus)),
              },
            ]}
            initial={{ referee: consented[0]?.id ?? '', method: SubmissionMethod.NotStated, deadline: '', agreement: AgreementStatus.NotAsked }}
            submitLabel={t('academic.program.addRecommendation')}
            onSubmit={(v) =>
              actions.createRecommendation.mutateAsync({
                ...emptyRecommendationInput(textOf(v.referee), program.id),
                method: v.method as SubmissionMethod,
                refereeDeadline: dayOrUndefined(v.deadline),
                agreement: v.agreement as AgreementStatus,
              })
            }
          />
          <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
            {t('academic.referees.consentHint')}
          </Text>
        </View>
      </Card>
    </Section>
  );
}

export function DecisionSection({ program, save }: { program: Program; save: Save }) {
  const t = useT();
  const theme = useTheme();
  const format = useFormat();
  const label = useEnumLabel();
  const options = useEnumOptions();
  const actions = useAcademicActions();
  const api = useApi();
  const decision = program.decision ?? emptyDecision();
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const offer = decision.kind === DecisionKind.Accepted || decision.kind === DecisionKind.ConditionallyAccepted;
  const run = (action: UserAction) =>
    actions.recordAction.mutate(
      { id: program.id, action },
      { onError: (failure) => setError(academicErrorKey(failure)), onSuccess: () => setConfirmed(false) },
    );
  return (
    <Section title={t('academic.program.decision')}>
      <Card>
        <View style={{ gap: theme.space.md }}>
          <RecordForm
            fields={[
              {
                key: 'kind',
                label: t('academic.fields.decisionKind'),
                type: FieldType.Select,
                options: options('DecisionKind', Object.values(DecisionKind)),
              },
              { key: 'acceptance', label: t('academic.fields.acceptanceDeadline'), type: FieldType.Date, hint: 'YYYY-MM-DD' },
              { key: 'deposit', label: t('academic.fields.depositAmount'), type: FieldType.Number },
              { key: 'depositDeadline', label: t('academic.fields.depositDeadline'), type: FieldType.Date, hint: 'YYYY-MM-DD' },
              { key: 'condition', label: t('academic.fields.conditionText'), type: FieldType.Text },
            ]}
            initial={{
              kind: decision.kind,
              acceptance: decision.acceptanceDeadline ?? '',
              deposit: decision.depositAmount?.toString() ?? '',
              depositDeadline: decision.depositDeadline ?? '',
              condition: '',
            }}
            submitLabel={t('academic.common.save')}
            onSubmit={(v) =>
              save((d) => {
                const base = d.decision ?? emptyDecision();
                const condition = textOf(v.condition);
                return {
                  ...d,
                  decision: {
                    ...base,
                    kind: v.kind as DecisionKind,
                    acceptanceDeadline: dayOrUndefined(v.acceptance),
                    depositAmount: numberOrUndefined(v.deposit),
                    depositDeadline: dayOrUndefined(v.depositDeadline),
                    conditions: condition ? [...base.conditions, { id: '', text: condition, met: false }] : base.conditions,
                  },
                };
              })
            }
          />
          <Text variant={TextVariant.Subheading}>{t('academic.program.conditions')}</Text>
          {decision.conditions.map((condition, index) => (
            <Checkbox
              key={condition.id}
              checked={condition.met}
              accessibilityLabel={condition.text}
              onChange={(met) =>
                void save((d) => ({
                  ...d,
                  decision: {
                    ...(d.decision ?? emptyDecision()),
                    conditions: (d.decision?.conditions ?? []).map((c, i) => (i === index ? { ...c, met } : c)),
                  },
                }))
              }
            >
              <Text>
                {condition.text}
                {condition.due ? ` · ${format.date(condition.due)}` : ''}
              </Text>
            </Checkbox>
          ))}
          <Text variant={TextVariant.Subheading}>{t('academic.program.userSteps')}</Text>
          <Text tone={TextTone.Muted}>{t('academic.program.userStepsHint')}</Text>
          {decision.actions.map((record) => (
            <Text key={`${record.action}-${record.confirmedOn}`}>
              {t('academic.program.actionDone', { action: label('UserAction', record.action), date: format.date(record.confirmedOn) })}
            </Text>
          ))}
          {error ? <Text tone={TextTone.Danger}>{t(error)}</Text> : null}
          {offer ? (
            <>
              <Checkbox checked={confirmed} onChange={setConfirmed} accessibilityLabel={t('academic.common.confirm')}>
                <Text>{t('academic.common.confirm')}</Text>
              </Checkbox>
              {Object.values(UserAction).map((action) => (
                <View key={action} style={{ gap: theme.space.xs }}>
                  <Button label={label('UserAction', action)} disabled={!confirmed} onPress={() => run(action)} />
                  <Button
                    label={t('academic.program.prepareMessage')}
                    variant={ButtonVariant.Ghost}
                    onPress={() =>
                      void api.academic.decisionMessage(program.id, action).then((draft) => setMessage(`${draft.subject}\n\n${draft.body}`))
                    }
                  />
                </View>
              ))}
              {message ? <Text>{message}</Text> : null}
            </>
          ) : null}
        </View>
      </Card>
    </Section>
  );
}

export function ChecklistSection({ program, save }: { program: Program; save: Save }) {
  const t = useT();
  const theme = useTheme();
  const format = useFormat();
  const label = useEnumLabel();
  const options = useEnumOptions();
  const actions = useAcademicActions();
  const offer = program.decision?.kind === DecisionKind.Accepted || program.decision?.kind === DecisionKind.ConditionallyAccepted;
  const update = (index: number, patch: Partial<Program['checklist'][number]>) =>
    save((d) => ({ ...d, checklist: d.checklist.map((item, i) => (i === index ? { ...item, ...patch } : item)) }));
  return (
    <Section title={t('academic.program.checklist')}>
      <Card>
        <View style={{ gap: theme.space.md }}>
          <Text tone={TextTone.Muted}>{t('academic.notAdvice')}</Text>
          {offer ? (
            <Button
              label={t('academic.program.generateChecklist')}
              variant={ButtonVariant.Secondary}
              onPress={() => actions.generateChecklist.mutate(program.id)}
            />
          ) : (
            <Text tone={TextTone.Muted}>{t('academic.program.checklistNeedsOffer')}</Text>
          )}
          {program.checklist.map((item, index) => (
            <View key={item.id} style={{ gap: theme.space.sm }}>
              <Text variant={TextVariant.Subheading}>
                {label('ChecklistStep', item.step)}
                {item.dueOn ? ` · ${format.date(item.dueOn)}` : ''}
              </Text>
              <SelectField
                label={t('academic.common.status')}
                value={item.status}
                options={options('ItemProgress', Object.values(ItemProgress))}
                placeholder="-"
                onChange={(status) => void update(index, { status: status as ItemProgress })}
              />
              <TextField
                label={t('academic.fields.checklistSource')}
                defaultValue={item.sourceUrl}
                autoCapitalize="none"
                onEndEditing={(event) =>
                  event.nativeEvent.text !== item.sourceUrl && void update(index, { sourceUrl: event.nativeEvent.text.trim() })
                }
              />
            </View>
          ))}
        </View>
      </Card>
    </Section>
  );
}
