import {
  AgreementStatus,
  AmountSource,
  CredentialKind,
  EvidenceStatus,
  ExamKind,
  ExamStatus,
  FundingStatus,
  GradeScale,
  NeedLevel,
  PortalFee,
  PortalSubmission,
  ProgramStatus,
  ScorePolicy,
  StudyKind,
  SubmissionMethod,
  DecisionKind,
} from '@careerpilot/domain-ui-logic';
import type {
  CredentialInput,
  Decision,
  ExamInput,
  StudyExamRequirement,
  OutreachDraftInput,
  ProgramInput,
  RecommendationInput,
  RefereeInput,
} from './types';

export function emptyProgramInput(): ProgramInput {
  return {
    kind: StudyKind.TaughtMasters,
    title: '',
    university: '',
    department: '',
    degree: '',
    field: '',
    countryCode: '',
    campus: '',
    supervisor: '',
    researchArea: '',
    studyMode: '',
    sourceUrl: '',
    portalUrl: '',
    notes: '',
    status: ProgramStatus.Saved,
    linkedProgramIds: [],
    deadlines: [],
    examRequirements: [],
    credentialRequirements: [],
    equivalence: { evidence: EvidenceStatus.NotStated, note: '' },
    funding: { status: FundingStatus.NotStated, currency: '', conditions: '' },
    fee: {
      currency: '',
      source: AmountSource.Estimate,
      waiverNote: '',
      waiverConditions: '',
    },
    workInfo: { note: '', sourceUrl: '' },
    budget: [],
    portal: {
      accountLabel: '',
      sections: [],
      documents: [],
      invites: [],
      fee: PortalFee.NotRequired,
      feeEvidence: '',
      submission: PortalSubmission.NotStarted,
      privacyNoticeUrl: '',
      pendingItems: [],
    },
    checklist: [],
  };
}

export function emptyStudyExamRequirement(exam: ExamKind = ExamKind.Ielts): StudyExamRequirement {
  return {
    exam,
    need: NeedLevel.NotStated,
    evidence: EvidenceStatus.NotStated,
    sectionMinimums: {},
    policy: ScorePolicy.NotStated,
    policyEvidence: EvidenceStatus.NotStated,
    waiverDescribed: false,
    note: '',
  };
}

export function emptyDecision(): Decision {
  return {
    kind: DecisionKind.Pending,
    conditions: [],
    depositCurrency: '',
    deferralNote: '',
    scholarshipNote: '',
    actions: [],
  };
}

export function emptyExamInput(): ExamInput {
  return {
    exam: ExamKind.Ielts,
    status: ExamStatus.Planned,
    feeCurrency: '',
    feeSource: AmountSource.Estimate,
    reports: [],
    note: '',
  };
}

export function emptyCredentialInput(): CredentialInput {
  return {
    kind: CredentialKind.Transcript,
    institution: '',
    title: '',
    scale: GradeScale.Cgpa4,
    value: '',
    outOf: '',
    convertedValue: '',
    documentName: '',
    note: '',
  };
}

export function emptyRefereeInput(): RefereeInput {
  return {
    name: '',
    email: '',
    phone: '',
    title: '',
    institution: '',
    relationship: '',
  };
}

export function emptyRecommendationInput(refereeId: string, programId: string): RecommendationInput {
  return {
    refereeId,
    programId,
    agreement: AgreementStatus.NotAsked,
    method: SubmissionMethod.NotStated,
    inviteAuthorized: false,
    remindersSent: [],
    note: '',
  };
}

export function emptyOutreachDraft(): OutreachDraftInput {
  return {
    supervisorName: '',
    supervisorEmail: '',
    university: '',
    department: '',
    researchReference: '',
    sourceUrl: '',
  };
}
