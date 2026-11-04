'use client';

import { useState } from 'react';
import {
  academicErrorKey,
  useAcademicActions,
  useFormat,
  useApi,
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
import { Badge, Button, Card, Checkbox, Section, TextField } from '@careerpilot/ui-web';
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
  const format = useFormat();
  const label = useEnumLabel();
  const plan = useProgramPlan(programId);
  if (!plan.data) {
    return null;
  }
  const { steps, warnings, budget, blockers } = plan.data;
  return (
    <Section title={t('academic.program.plan')}>
      <Card className="gap-3">
        <p className="text-sm text-muted">{t('academic.program.planHint')}</p>
        {warnings.map((warning) => (
          <WarningLine key={`${warning.kind}-${warning.exam ?? ''}`} warning={warning} />
        ))}
        <ol className="flex flex-col gap-1">
          {steps.map((step) => (
            <li key={`${step.kind}-${step.deadlineKind}-${step.label}`} className="flex justify-between gap-2 text-sm">
              <span>
                {label('PlanStepKind', step.kind)}
                {step.label ? ` (${step.label})` : ''}
              </span>
              <span className="text-muted">{format.date(step.on)}</span>
            </li>
          ))}
        </ol>
        <p className="font-medium">{t('academic.program.budget')}</p>
        {budget.map((total) => (
          <p key={total.currency} className="text-sm">
            {total.currency}: {t('academic.program.budgetOfficial')} {total.official} · {t('academic.program.budgetEstimate')} {total.estimate} ·{' '}
            {t('academic.program.budgetTotal')} {total.total}
          </p>
        ))}
        <p className="font-medium">{t('academic.program.blockers')}</p>
        {blockers.length ? (
          <ul className="list-disc pl-5 text-sm">
            {blockers.map((blocker) => (
              <li key={blocker}>{label('PortalBlocker', blocker)}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t('academic.program.noBlockers')}</p>
        )}
      </Card>
    </Section>
  );
}

export function RequirementsSection({ program, save }: { program: Program; save: Save }) {
  const t = useT();
  const format = useFormat();
  const label = useEnumLabel();
  const options = useEnumOptions();
  const deadlineFields: FieldSpec[] = [
    { key: 'kind', label: t('academic.fields.deadlineKind'), type: FieldType.Select, options: options('DeadlineKind', Object.values(DeadlineKind)) },
    { key: 'on', label: t('academic.fields.deadlineOn'), type: FieldType.Date },
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
    { key: 'waiverDescribed', label: t('academic.enums.Need.not_required'), type: FieldType.Check },
  ];
  return (
    <Section title={t('academic.program.requirements')}>
      <Card className="gap-3">
        <p className="text-sm text-muted">{t('academic.program.requirementsHint')}</p>
        <p className="font-medium">{t('academic.program.deadlines')}</p>
        <ul className="text-sm">
          {program.deadlines.map((deadline, index) => (
            <li key={`${deadline.kind}-${deadline.on}`} className="flex justify-between gap-2">
              <span>
                {label('DeadlineKind', deadline.kind)}
                {deadline.note ? ` · ${deadline.note}` : ''}
              </span>
              <span className="flex items-center gap-2">
                {format.date(deadline.on)}
                <Button size="sm" variant="ghost" onClick={() => void save((d) => ({ ...d, deadlines: d.deadlines.filter((_, i) => i !== index) }))}>
                  {t('academic.common.remove')}
                </Button>
              </span>
            </li>
          ))}
        </ul>
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
        <p className="font-medium">{t('academic.program.tests')}</p>
        <ul className="flex flex-col gap-1 text-sm">
          {program.examRequirements.map((requirement, index) => (
            <li key={`${requirement.exam}-${index}`} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {label('ExamKind', requirement.exam)} · {label('NeedLevel', requirement.need)}
                {requirement.minOverall !== undefined ? ` ≥ ${requirement.minOverall}` : ''}
              </span>
              <span className="flex items-center gap-2">
                <Badge
                  label={label('EvidenceStatus', requirement.evidence)}
                  tone={requirement.evidence === EvidenceStatus.Explicit ? StatusTone.Success : StatusTone.Neutral}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void save((d) => ({ ...d, examRequirements: d.examRequirements.filter((_, i) => i !== index) }))}
                >
                  {t('academic.common.remove')}
                </Button>
              </span>
            </li>
          ))}
        </ul>
        <RecordForm
          fields={examFields}
          initial={{
            exam: ExamKind.Ielts,
            need: NeedLevel.NotStated,
            evidence: EvidenceStatus.NotStated,
            minOverall: '',
            policy: ScorePolicy.NotStated,
            waiverDescribed: false,
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
                  waiverDescribed: v.waiverDescribed === true,
                },
              ],
            }))
          }
        />
      </Card>
    </Section>
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

export function PortalSection({ program, save }: { program: Program; save: Save }) {
  const t = useT();
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
      <Card className="gap-3">
        <p className="text-sm text-muted">{t('academic.program.portalHint')}</p>
        <p className="font-medium">{t('academic.program.sections')}</p>
        {portal.sections.map((section, index) => (
          <Checkbox key={section.name} checked={section.done} onChange={(flag) => void toggle('sections', index, flag)}>
            {section.name}
          </Checkbox>
        ))}
        <p className="font-medium">{t('academic.program.documents')}</p>
        {portal.documents.map((document, index) => (
          <Checkbox key={document.name} checked={document.uploaded} onChange={(flag) => void toggle('documents', index, flag)}>
            {document.name}
          </Checkbox>
        ))}
        <p className="font-medium">{t('academic.program.pending')}</p>
        {portal.pendingItems.map((item, index) => (
          <Checkbox
            key={item.id}
            checked={item.received}
            onChange={(flag) =>
              void save((d) => ({
                ...d,
                portal: { ...d.portal, pendingItems: d.portal.pendingItems.map((p, i) => (i === index ? { ...p, received: flag } : p)) },
              }))
            }
          >
            {item.name}
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
      </Card>
    </Section>
  );
}

export function RecommendationsSection({ program }: { program: Program }) {
  const t = useT();
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
      <Card className="gap-3">
        <p className="text-sm text-muted">{t('academic.referees.evidenceHint')}</p>
        <TextField label={t('academic.fields.evidenceNote')} value={note} onChange={(event) => setNote(event.target.value)} />
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {t(error)}
          </p>
        ) : null}
        {recommendations.data?.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              {name(item.refereeId)} · {label('RecommendationStatus', item.status)}
            </span>
            <span className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  actions.setRecommendationStatus.mutate(
                    { id: item.id, change: { status: RecommendationStatus.Submitted, evidence: ReceiptEvidence.UserStatement, evidenceNote: note } },
                    { onError: fail },
                  )
                }
              >
                {t('academic.referees.markSubmitted')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  actions.setRecommendationStatus.mutate(
                    {
                      id: item.id,
                      change: { status: RecommendationStatus.Confirmed, evidence: ReceiptEvidence.InstitutionConfirmation, evidenceNote: note },
                    },
                    { onError: fail },
                  )
                }
              >
                {t('academic.referees.markConfirmed')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => actions.removeRecommendation.mutate(item.id)}>
                {t('academic.common.remove')}
              </Button>
            </span>
          </div>
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
            { key: 'deadline', label: t('academic.fields.refereeDeadline'), type: FieldType.Date },
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
        <p className="text-xs text-muted">{t('academic.referees.consentHint')}</p>
      </Card>
    </Section>
  );
}

export function DecisionSection({ program, save }: { program: Program; save: Save }) {
  const t = useT();
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
      <Card className="gap-3">
        <RecordForm
          fields={[
            {
              key: 'kind',
              label: t('academic.fields.decisionKind'),
              type: FieldType.Select,
              options: options('DecisionKind', Object.values(DecisionKind)),
            },
            { key: 'acceptance', label: t('academic.fields.acceptanceDeadline'), type: FieldType.Date },
            { key: 'deposit', label: t('academic.fields.depositAmount'), type: FieldType.Number },
            { key: 'depositDeadline', label: t('academic.fields.depositDeadline'), type: FieldType.Date },
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
        <p className="font-medium">{t('academic.program.conditions')}</p>
        {decision.conditions.map((condition, index) => (
          <Checkbox
            key={condition.id}
            checked={condition.met}
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
            {condition.text}
            {condition.due ? ` · ${format.date(condition.due)}` : ''}
          </Checkbox>
        ))}
        <p className="font-medium">{t('academic.program.userSteps')}</p>
        <p className="text-sm text-muted">{t('academic.program.userStepsHint')}</p>
        {decision.actions.map((record) => (
          <p key={`${record.action}-${record.confirmedOn}`} className="text-sm">
            {t('academic.program.actionDone', { action: label('UserAction', record.action), date: format.date(record.confirmedOn) })}
          </p>
        ))}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {t(error)}
          </p>
        ) : null}
        {offer ? (
          <>
            <Checkbox checked={confirmed} onChange={setConfirmed}>
              {t('academic.common.confirm')}
            </Checkbox>
            <div className="flex flex-wrap gap-2">
              {Object.values(UserAction).map((action) => (
                <span key={action} className="flex gap-1">
                  <Button size="sm" disabled={!confirmed} onClick={() => run(action)}>
                    {label('UserAction', action)}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void api.academic.decisionMessage(program.id, action).then((draft) => setMessage(`${draft.subject}\n\n${draft.body}`))
                    }
                  >
                    {t('academic.program.prepareMessage')}
                  </Button>
                </span>
              ))}
            </div>
            {message ? <pre className="whitespace-pre-wrap rounded-control bg-surface p-3 text-sm">{message}</pre> : null}
          </>
        ) : null}
      </Card>
    </Section>
  );
}

export function ChecklistSection({ program, save }: { program: Program; save: Save }) {
  const t = useT();
  const format = useFormat();
  const label = useEnumLabel();
  const options = useEnumOptions();
  const actions = useAcademicActions();
  const offer = program.decision?.kind === DecisionKind.Accepted || program.decision?.kind === DecisionKind.ConditionallyAccepted;
  const update = (index: number, patch: Partial<Program['checklist'][number]>) =>
    save((d) => ({ ...d, checklist: d.checklist.map((item, i) => (i === index ? { ...item, ...patch } : item)) }));
  return (
    <Section title={t('academic.program.checklist')}>
      <Card className="gap-3">
        <p className="text-sm text-muted">{t('academic.notAdvice')}</p>
        {offer ? (
          <Button size="sm" variant="secondary" onClick={() => actions.generateChecklist.mutate(program.id)}>
            {t('academic.program.generateChecklist')}
          </Button>
        ) : (
          <p className="text-sm text-muted">{t('academic.program.checklistNeedsOffer')}</p>
        )}
        {program.checklist.map((item, index) => (
          <div key={item.id} className="grid gap-2 border-b border-border pb-2 md:grid-cols-3">
            <p className="font-medium">
              {label('ChecklistStep', item.step)}
              {item.dueOn ? ` · ${format.date(item.dueOn)}` : ''}
            </p>
            <select
              aria-label={`${label('ChecklistStep', item.step)} ${t('academic.common.status')}`}
              className="rounded-control border border-input bg-background px-2 py-2"
              value={item.status}
              onChange={(event) => void update(index, { status: event.target.value as ItemProgress })}
            >
              {options('ItemProgress', Object.values(ItemProgress)).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <TextField
              label={t('academic.fields.checklistSource')}
              defaultValue={item.sourceUrl}
              onBlur={(event) => event.target.value !== item.sourceUrl && void update(index, { sourceUrl: event.target.value.trim() })}
            />
          </div>
        ))}
      </Card>
    </Section>
  );
}
