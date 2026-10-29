import {
  AnswerTopic,
  ApplicationMode,
  ApplicationRoute,
  ApprovalState,
  ContactKind,
  DocumentKind,
  LanguageProficiency,
  OpportunityType,
  OutcomeStatus,
  RequirementCheck,
  SponsorshipEvidence,
  SubmissionStatus,
  SubmissionWindowKind,
  TaskKind,
  TaskStatus,
  TimelineActor,
  TrackKind,
  WorkArrangement,
} from '@careerpilot/domain-ui-logic';
import {
  AnswerSource,
  type ApplicationRecord,
  type ApprovalDetail,
  type DocumentVersion,
  type OpportunityDetail,
  type Profile,
  type ProfileDocument,
  type ProfileEntry,
  type SavedAnswer,
  type UserSource,
  type Settings,
  type SignInEvent,
  type UserSummary,
} from '../types';
import { demoPhotoUri, demoSignatureUri } from './demo-media.seed';
import { samplePdfDataUri } from './sample-pdf';

const PDF_MEDIA_TYPE = 'application/pdf';

export interface DemoAccount {
  user: UserSummary;
  password: string;
  registered?: boolean;
}

export interface DemoState {
  accounts: DemoAccount[];
  opportunities: OpportunityDetail[];
  trackOpportunities: Record<string, string[]>;
  approvals: ApprovalDetail[];
  applications: ApplicationRecord[];
  profile: Profile;
  settings: Settings;
  signInEvents: SignInEvent[];
  lastCheckedAt: string;
  savedAnswers: SavedAnswer[];
  jobSources: UserSource[];
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export function buildDemoSeed(now: Date): DemoState {
  const at = (days: number, hours = 0) => new Date(now.getTime() + days * DAY_MS + hours * HOUR_MS).toISOString();

  const circular = (title: string, organization: string, body: string, url: string) => ({
    archivedAt: at(-2),
    originalUrl: url,
    text: `${title}\n${organization}\n\n${body}`,
  });

  const opportunities: OpportunityDetail[] = [
    {
      id: 'opp_remote_frontend',
      type: OpportunityType.Job,
      title: 'Senior Frontend Engineer',
      organization: 'Northwind Labs',
      location: 'Remote, worldwide',
      countryCode: 'US',
      workArrangement: WorkArrangement.Remote,
      matchScore: 92,
      deadline: at(9),
      compensation: { min: { amountMinor: 7_000_000, currency: 'USD' }, max: { amountMinor: 9_000_000, currency: 'USD' }, period: 'year' },
      hasHardFailure: false,
      missingSkills: ['GraphQL', 'Storybook'],
      description: 'Build the customer dashboard used by 40,000 teams. React, TypeScript, design systems, accessibility.',
      matchFactors: [
        { text: 'React and TypeScript match your 5 years of experience', positive: true },
        { text: 'Fully remote with no time-zone restriction', positive: true },
        { text: 'Salary above your minimum of $60,000', positive: true },
        { text: 'GraphQL experience preferred; not in your profile', positive: false },
      ],
      requirements: [
        { text: '5+ years of frontend development', check: RequirementCheck.Met, hard: true },
        { text: 'Fluent written English', check: RequirementCheck.Met, hard: true },
        { text: 'GraphQL in production', check: RequirementCheck.Unknown, hard: false },
      ],
      source: { name: 'Northwind Labs careers', url: 'https://careers.example.com/northwind/senior-frontend', checkedAt: at(0, -3) },
      circular: circular(
        'Senior Frontend Engineer',
        'Northwind Labs',
        'We are hiring a senior frontend engineer to lead our dashboard team. You will own the design system, mentor two engineers, and ship weekly.\n\nRequirements: 5+ years with React, strong TypeScript, accessibility knowledge.\nNice to have: GraphQL, data visualisation.\n\nApply by email with your CV and a short note.',
        'https://careers.example.com/northwind/senior-frontend',
      ),
      route: ApplicationRoute.Email,
      applicationEmail: 'careers@northwind.example.com',
    },
    {
      id: 'opp_remote_fullstack',
      type: OpportunityType.Job,
      title: 'Full-Stack Developer (React, Node.js)',
      organization: 'Kite Commerce',
      location: 'Remote, UTC+3 to UTC+8',
      countryCode: 'SG',
      workArrangement: WorkArrangement.Remote,
      matchScore: 86,
      deadline: at(4),
      compensation: { min: { amountMinor: 4_500_000, currency: 'USD' }, max: { amountMinor: 6_000_000, currency: 'USD' }, period: 'year' },
      hasHardFailure: false,
      missingSkills: [],
      description: 'Ship checkout and payments features for a fast-growing e-commerce platform in Asia.',
      matchFactors: [
        { text: 'Your time zone (UTC+6) is inside the required range', positive: true },
        { text: 'Node.js experience matches', positive: true },
      ],
      requirements: [
        { text: 'Work hours overlapping UTC+3 to UTC+8', check: RequirementCheck.Met, hard: true },
        { text: '3+ years with Node.js', check: RequirementCheck.Met, hard: false },
      ],
      source: { name: 'Remote job board', url: 'https://jobs.example.com/kite/fullstack', checkedAt: at(0, -5) },
      circular: circular('Full-Stack Developer', 'Kite Commerce', 'Join our checkout squad. React, Node.js, PostgreSQL. Apply through our applicant tracking system.', 'https://jobs.example.com/kite/fullstack'),
      route: ApplicationRoute.AtsPortal,
    },
    {
      id: 'opp_intl_oslo',
      type: OpportunityType.Job,
      title: 'Software Engineer II',
      organization: 'Nordlys Systems',
      location: 'Oslo, Norway',
      countryCode: 'NO',
      workArrangement: WorkArrangement.Onsite,
      matchScore: 84,
      deadline: at(14),
      compensation: { min: { amountMinor: 75_000_000, currency: 'NOK' }, max: { amountMinor: 90_000_000, currency: 'NOK' }, period: 'year' },
      sponsorship: SponsorshipEvidence.Stated,
      hasHardFailure: false,
      missingSkills: [],
      description: 'Energy-grid software team. Relocation package and work-permit sponsorship included.',
      matchFactors: [
        { text: 'Visa sponsorship stated in the circular', positive: true },
        { text: 'Relocation support offered', positive: true },
      ],
      requirements: [
        { text: "Bachelor's degree in computer science", check: RequirementCheck.Met, hard: true },
        { text: 'Willing to relocate to Oslo', check: RequirementCheck.Met, hard: true },
      ],
      source: { name: 'Nordlys careers', url: 'https://careers.example.com/nordlys/se2', checkedAt: at(0, -8) },
      circular: circular('Software Engineer II', 'Nordlys Systems', 'We sponsor skilled-worker permits and provide relocation. Apply on our employer portal.', 'https://careers.example.com/nordlys/se2'),
      route: ApplicationRoute.EmployerPortal,
    },
    {
      id: 'opp_intl_amsterdam',
      type: OpportunityType.Job,
      title: 'React Developer',
      organization: 'Harbourline',
      location: 'Amsterdam, Netherlands',
      countryCode: 'NL',
      workArrangement: WorkArrangement.Hybrid,
      matchScore: 71,
      deadline: at(2),
      sponsorship: SponsorshipEvidence.Unverified,
      hasHardFailure: false,
      missingSkills: [],
      description: 'Hybrid role in a logistics start-up. The posting mentions an international team but not sponsorship.',
      matchFactors: [
        { text: 'React matches', positive: true },
        { text: 'Sponsorship not confirmed by the employer', positive: false },
      ],
      requirements: [{ text: 'EU work authorisation or sponsorship', check: RequirementCheck.Unknown, hard: true }],
      source: { name: 'International job board', url: 'https://jobs.example.com/harbourline/react', checkedAt: at(0, -2) },
      circular: circular('React Developer', 'Harbourline', 'International team, hybrid in Amsterdam.', 'https://jobs.example.com/harbourline/react'),
      route: ApplicationRoute.Email,
      applicationEmail: 'jobs@harbourline.example.com',
    },
    {
      id: 'opp_bd_dhaka',
      type: OpportunityType.Job,
      title: 'Software Engineer',
      organization: 'Bay Digital Ltd',
      location: 'Gulshan, Dhaka',
      countryCode: 'BD',
      workArrangement: WorkArrangement.Onsite,
      matchScore: 88,
      deadline: at(6),
      compensation: { min: { amountMinor: 12_000_000, currency: 'BDT' }, max: { amountMinor: 16_000_000, currency: 'BDT' }, period: 'month' },
      hasHardFailure: false,
      missingSkills: [],
      description: 'Product engineering for fintech clients. Five days on-site in Gulshan.',
      matchFactors: [
        { text: 'Location within your preferred cities', positive: true },
        { text: 'Salary inside your range', positive: true },
      ],
      requirements: [{ text: '3+ years of professional experience', check: RequirementCheck.Met, hard: true }],
      source: { name: 'Bangladesh job portal', url: 'https://jobs.example.com/bd/bay-digital', checkedAt: at(0, -1) },
      circular: circular('Software Engineer', 'Bay Digital Ltd', 'Salary: BDT 120,000–160,000 per month. Apply by email to careers@baydigital.example.com.', 'https://jobs.example.com/bd/bay-digital'),
      route: ApplicationRoute.Email,
      applicationEmail: 'careers@baydigital.example.com',
    },
    {
      id: 'opp_bd_ctg',
      type: OpportunityType.Job,
      title: 'Lead QA Engineer',
      organization: 'Meghna Tech',
      location: 'Agrabad, Chattogram',
      countryCode: 'BD',
      workArrangement: WorkArrangement.Onsite,
      matchScore: 69,
      deadline: at(11),
      hasHardFailure: false,
      missingSkills: [],
      description: 'Lead a QA team of four for a logistics platform.',
      matchFactors: [{ text: 'Testing experience partially matches', positive: true }],
      requirements: [{ text: '2+ years leading a QA team', check: RequirementCheck.NotMet, hard: false }],
      source: { name: 'Bangladesh job portal', url: 'https://jobs.example.com/bd/meghna', checkedAt: at(0, -1) },
      circular: circular('Lead QA Engineer', 'Meghna Tech', 'Lead our QA practice in Chattogram.', 'https://jobs.example.com/bd/meghna'),
      route: ApplicationRoute.EmployerPortal,
    },
    {
      id: 'opp_gov_programmer',
      type: OpportunityType.GovernmentJob,
      title: 'Assistant Programmer (Grade 9)',
      organization: 'Digital Services Directorate',
      location: 'Dhaka',
      countryCode: 'BD',
      workArrangement: WorkArrangement.Onsite,
      matchScore: 80,
      deadline: at(18),
      hasHardFailure: true,
      missingSkills: [],
      description: 'Government post. Online application through the official recruitment portal with fee payment.',
      matchFactors: [{ text: 'CSE degree matches the required subject', positive: true }],
      requirements: [
        { text: 'BSc in CSE or equivalent', check: RequirementCheck.Met, hard: true },
        { text: 'Age 18–30 on the circular date', check: RequirementCheck.NotMet, hard: true },
      ],
      source: { name: 'Government recruitment notices', url: 'https://gov.example.com/circulars/assistant-programmer', checkedAt: at(0, -6) },
      circular: circular('Assistant Programmer (Grade 9)', 'Digital Services Directorate', 'Applications are invited from Bangladeshi citizens aged 18–30. Apply online at the official portal. Application fee BDT 223.', 'https://gov.example.com/circulars/assistant-programmer'),
      route: ApplicationRoute.GovernmentPortal,
    },
    {
      id: 'opp_masters_tum',
      type: OpportunityType.Masters,
      title: 'MSc Informatics (fully funded track)',
      organization: 'Alpine Technical University',
      location: 'Munich, Germany',
      countryCode: 'DE',
      workArrangement: WorkArrangement.Onsite,
      matchScore: 77,
      deadline: at(30),
      hasHardFailure: false,
      missingSkills: [],
      description: 'Two-year master’s programme taught in English with a tuition-free track and research assistantships.',
      matchFactors: [{ text: 'CGPA 3.6/4.0 meets the 3.0 minimum', positive: true }],
      requirements: [
        { text: 'IELTS 6.5 or equivalent', check: RequirementCheck.Met, hard: true },
        { text: 'GRE optional', check: RequirementCheck.Met, hard: false },
      ],
      source: { name: 'University admissions', url: 'https://uni.example.com/msc-informatics', checkedAt: at(0, -12) },
      circular: circular('MSc Informatics', 'Alpine Technical University', 'Winter intake. Apply through the university portal with transcripts, CV, and motivation letter.', 'https://uni.example.com/msc-informatics'),
      route: ApplicationRoute.GuidedManual,
    },
  ];

  const settings: Settings = {
    timeZone: 'Asia/Dhaka',
    excludedCountries: [],
    favoriteCompanies: [],
    homeCountry: 'BD',
    submissionWindow: { kind: SubmissionWindowKind.DailyWindow, start: '00:00', end: '01:00' },
    notifications: { digestEnabled: true, digestTime: '08:00' },
    tracks: [
      { id: 'trk_remote', kind: TrackKind.Remote, resultCount: 5, mode: ApplicationMode.ApproveEach, position: 1 },
      { id: 'trk_intl', kind: TrackKind.InternationalSponsored, resultCount: 5, mode: ApplicationMode.ApproveEach, position: 2 },
      { id: 'trk_bd', kind: TrackKind.BangladeshOnsite, resultCount: 5, mode: ApplicationMode.Automatic, position: 3 },
      { id: 'trk_gov', kind: TrackKind.BangladeshGovernment, resultCount: 5, mode: ApplicationMode.Off, position: 4 },
      { id: 'trk_study', kind: TrackKind.Custom, name: "Master's in Europe", resultCount: 3, mode: ApplicationMode.ApproveEach, position: 5 },
    ],
  };

  const trackOpportunities: Record<string, string[]> = {
    trk_remote: ['opp_remote_frontend', 'opp_remote_fullstack'],
    trk_intl: ['opp_intl_oslo', 'opp_intl_amsterdam'],
    trk_bd: ['opp_bd_dhaka', 'opp_bd_ctg'],
    trk_gov: ['opp_gov_programmer'],
    trk_study: ['opp_masters_tum'],
  };

  const summaryOf = (id: string) => {
    const found = opportunities.find((o) => o.id === id);
    if (!found) {
      throw new Error(`Unknown opportunity ${id}`);
    }
    const { description, matchFactors, requirements, source, circular: c, route, ...summary } = found;
    return summary;
  };

  const approvals: ApprovalDetail[] = [
    {
      id: 'apr_frontend',
      opportunity: summaryOf('opp_remote_frontend'),
      state: ApprovalState.Pending,
      createdAt: at(0, -2),
      expiresAt: at(3),
      route: ApplicationRoute.Email,
      materials: {
        cv: { name: 'Ayesha Rahman – Frontend CV', version: 3, documentId: 'doc_cv' },
        coverLetter:
          'Dear Northwind Labs hiring team,\n\nI am applying for the Senior Frontend Engineer role. I have spent five years building accessible React and TypeScript interfaces, most recently leading the design system at Lumen Health. Your dashboard team’s focus on accessibility and weekly releases matches how I like to work.\n\nI would welcome the chance to talk.\n\nAyesha Rahman',
        answers: [
          { id: 'q_notice', question: 'What is your notice period?', answer: '30 days', source: AnswerSource.Profile },
          { id: 'q_salary', question: 'What are your salary expectations (USD per year)?', answer: '80,000', source: AnswerSource.Profile },
          { id: 'q_why', question: 'Why do you want to join Northwind Labs?', answer: 'I want to work on a product used by thousands of teams every day, and your public accessibility commitments match my own work on design systems.', source: AnswerSource.Ai },
        ],
      },
    },
    {
      id: 'apr_oslo',
      opportunity: summaryOf('opp_intl_oslo'),
      state: ApprovalState.Pending,
      createdAt: at(0, -6),
      expiresAt: at(2),
      route: ApplicationRoute.EmployerPortal,
      materials: {
        cv: { name: 'Ayesha Rahman – International CV', version: 2, documentId: 'doc_cv_intl' },
        coverLetter: 'Dear Nordlys Systems team,\n\nI am excited by your energy-grid work and ready to relocate to Oslo.\n\nAyesha Rahman',
        answers: [
          { id: 'q_permit', question: 'Do you require visa sponsorship?', answer: 'Yes', source: AnswerSource.Profile },
          { id: 'q_start', question: 'Earliest start date', answer: 'Within 3 months of an offer', source: AnswerSource.User },
          { id: 'q_relocate', question: 'Are you willing to relocate to Oslo?', answer: '', source: AnswerSource.User },
        ],
      },
    },
  ];

  const record = (
    id: string,
    opportunityId: string,
    submissionStatus: SubmissionStatus,
    outcomeStatus: OutcomeStatus,
    appliedDaysAgo: number,
    route: ApplicationRoute,
    extra: Partial<ApplicationRecord> = {},
  ): ApplicationRecord => {
    const detail = opportunities.find((o) => o.id === opportunityId);
    if (!detail) {
      throw new Error(`Unknown opportunity ${opportunityId}`);
    }
    return {
      id,
      opportunity: summaryOf(opportunityId),
      submissionStatus,
      outcomeStatus,
      appliedAt: at(-appliedDaysAgo),
      updatedAt: at(-appliedDaysAgo, 2),
      route,
      timeline: [
        { at: at(-appliedDaysAgo, -1), actor: TimelineActor.System, text: 'Application package prepared', status: SubmissionStatus.Preparing },
        { at: at(-appliedDaysAgo, -0.5), actor: TimelineActor.User, text: 'You approved the application', status: SubmissionStatus.ApprovedQueued },
        { at: at(-appliedDaysAgo), actor: TimelineActor.System, text: 'Submitted at 12:04 a.m. inside your submission window', status: SubmissionStatus.SubmittedAwaitingConfirmation },
      ],
      questions: [{ id: `${id}_q1`, question: 'Notice period', answer: '30 days', source: AnswerSource.Profile }],
      emails: [],
      files: [{ name: 'Ayesha-Rahman-CV.pdf', version: 3, sizeBytes: 182_400 }],
      evidence: [],
      circular: detail.circular,
      tasks: [],
      ...extra,
    };
  };

  const applications: ApplicationRecord[] = [
    record('app_bay', 'opp_bd_dhaka', SubmissionStatus.Confirmed, OutcomeStatus.Interview, 6, ApplicationRoute.Email, {
      lastContactAt: at(-1),
      emails: [
        {
          subject: 'Application: Software Engineer – Ayesha Rahman',
          to: 'careers@baydigital.example.com',
          sentAt: at(-6),
          body: 'Dear Hiring Team,\n\nPlease find attached my CV for the Software Engineer position.\n\nKind regards,\nAyesha Rahman',
        },
      ],
      evidence: [{ text: 'Email delivered; no bounce received within 48 hours', at: at(-4) }],
      timeline: [
        { at: at(-6, -1), actor: TimelineActor.System, text: 'Email drafted from your template', status: SubmissionStatus.Preparing },
        { at: at(-6), actor: TimelineActor.System, text: 'Email sent to careers@baydigital.example.com', status: SubmissionStatus.SubmittedAwaitingConfirmation },
        { at: at(-4), actor: TimelineActor.System, text: 'No bounce received – confirmed', status: SubmissionStatus.Confirmed },
        { at: at(-1), actor: TimelineActor.Employer, text: 'Interview invitation received for next Tuesday' },
      ],
      tasks: [
        {
          id: 'task_bay_interview',
          kind: TaskKind.Interview,
          title: 'First interview with the engineering manager',
          dueAt: at(2, 4),
          location: 'Bay Digital office, Gulshan 2, Dhaka',
          notes: 'Bring a printed CV and two project examples.',
          status: TaskStatus.Open,
          createdAt: at(-1),
          updatedAt: at(-1),
        },
      ],
    }),
    record('app_kite', 'opp_remote_fullstack', SubmissionStatus.Confirmed, OutcomeStatus.UnderReview, 3, ApplicationRoute.AtsPortal, {
      evidence: [{ text: 'Confirmation page: reference KC-48213', at: at(-3) }],
    }),
    record('app_meghna', 'opp_bd_ctg', SubmissionStatus.OutcomeUnknown, OutcomeStatus.NoResponseYet, 2, ApplicationRoute.EmployerPortal, {
      timeline: [
        { at: at(-2, -1), actor: TimelineActor.System, text: 'Portal form filled', status: SubmissionStatus.Submitting },
        { at: at(-2), actor: TimelineActor.System, text: 'Portal timed out after submit; we will not resubmit. Please check your portal account.', status: SubmissionStatus.OutcomeUnknown },
      ],
    }),
    record('app_harbour', 'opp_intl_amsterdam', SubmissionStatus.ManualActionRequired, OutcomeStatus.NoResponseYet, 1, ApplicationRoute.Email, {
      appliedAt: undefined,
      timeline: [{ at: at(-1), actor: TimelineActor.System, text: 'The employer asks for a video introduction. Only you can record this.', status: SubmissionStatus.ManualActionRequired }],
    }),
  ];

  const pdf = (id: string, title: string, version: number, days: number, sizeBytes: number): DocumentVersion => ({
    fileName: `${id}-v${version}.pdf`,
    contentType: PDF_MEDIA_TYPE,
    sizeBytes,
    uploadedAt: at(days),
    url: samplePdfDataUri(`${title} (version ${version})`),
    version,
  });
  const document = (id: string, name: string, kind: DocumentKind, position: number, versions: DocumentVersion[]): ProfileDocument => ({
    id,
    name,
    kind,
    position,
    version: versions[0]?.version ?? 1,
    updatedAt: versions[0]?.uploadedAt ?? at(0),
    file: versions[0] as DocumentVersion,
    versions,
  });
  const entry = (id: string, position: number, values: ProfileEntry['values']): ProfileEntry => ({ id, position, values, updatedAt: at(-30) });

  const profile: Profile = {
    id: 'prf_demo',
    fullName: 'Ayesha Rahman',
    headline: 'Frontend engineer · 5 years · React, TypeScript, accessibility',
    location: 'Dhaka, Bangladesh',
    summary: 'Frontend engineer who builds accessible design systems and fast React apps. Looking for remote or sponsored roles abroad, or a funded master’s in Europe.',
    photoUrl: demoPhotoUri,
    signatureUrl: demoSignatureUri,
    completeness: 86,
    completenessItems: [],
    contacts: [
      { id: 'c_email_work', kind: ContactKind.Email, value: 'admin@sober.com', label: 'Work', isPrimary: true, verified: true, position: 1 },
      { id: 'c_phone_mobile', kind: ContactKind.Phone, value: '+8801712345678', label: 'Mobile', isPrimary: true, verified: true, position: 2 },
      { id: 'c_email_personal', kind: ContactKind.Email, value: 'ayesha.personal@example.com', label: 'Personal', isPrimary: false, verified: false, position: 3 },
      { id: 'c_phone_whatsapp', kind: ContactKind.Phone, value: '+8801812345678', label: 'WhatsApp', isPrimary: false, verified: true, position: 4 },
    ],
    skills: ['React', 'TypeScript', 'Next.js', 'React Native', 'Accessibility', 'Node.js', 'PostgreSQL', 'Design systems'],
    sections: {
      experience: [
        entry('ex_lumen', 1, { title: 'Frontend Engineer', organization: 'Lumen Health', location: 'Remote', start: '2022-03', current: true, summary: 'Led the design system used by six product teams; WCAG 2.2 AA audits.' }),
        entry('ex_bay', 2, { title: 'Software Engineer', organization: 'Riverstone Software', location: 'Dhaka', start: '2020-08', end: '2022-02', summary: 'Built React dashboards for logistics clients.' }),
      ],
      education: [
        entry('ed_bsc', 1, { degree: 'BSc in Computer Science and Engineering', institution: 'Eastern University of Technology', start_year: 2016, end_year: 2020, result: 'CGPA 3.60 / 4.00' }),
        entry('ed_hsc', 2, { degree: 'Higher Secondary Certificate (Science)', institution: 'City College, Dhaka', start_year: 2013, end_year: 2015, result: 'GPA 5.00 / 5.00' }),
      ],
      languages: [
        entry('lang_bn', 1, { language: 'Bangla', proficiency: LanguageProficiency.Native }),
        entry('lang_en', 2, { language: 'English', proficiency: LanguageProficiency.Fluent }),
      ],
      tests: [entry('test_ielts', 1, { test: 'IELTS Academic', score: '7.5', taken_on: '2025-06', expires_on: '2027-06' })],
      certifications: [entry('cert_aws', 1, { name: 'AWS Certified Developer – Associate', issuer: 'Amazon Web Services', issued_on: '2024-02', expires_on: '2027-02' })],
      links: [
        entry('link_github', 1, { label: 'GitHub', url: 'https://github.com/' }),
        entry('link_portfolio', 2, { label: 'Portfolio', url: 'https://example.com/' }),
      ],
    },
    documents: [
      document('doc_cv', 'Frontend CV', DocumentKind.Cv, 1, [pdf('doc-cv', 'Frontend CV', 3, -10, 182_400), pdf('doc-cv', 'Frontend CV', 2, -60, 176_100), pdf('doc-cv', 'Frontend CV', 1, -150, 171_300)]),
      document('doc_cv_intl', 'International CV', DocumentKind.Cv, 2, [pdf('doc-cv-intl', 'International CV', 2, -20, 190_200), pdf('doc-cv-intl', 'International CV', 1, -90, 188_000)]),
      document('doc_transcript', 'BSc transcript', DocumentKind.Transcript, 3, [pdf('doc-transcript', 'BSc transcript', 1, -200, 96_400)]),
    ],
  };

  const signInEvents: SignInEvent[] = [
    { id: 'si_1', at: at(0, -0.1), ip: '103.4.145.22', device: 'Pixel 8 · Android 16 · CareerPilot 1.0.0', approximateLocation: 'Dhaka, Bangladesh', success: true, current: true },
    { id: 'si_2', at: at(-1, -3), ip: '103.4.145.22', device: 'Chrome on Windows', approximateLocation: 'Dhaka, Bangladesh', success: true, current: false },
    { id: 'si_3', at: at(-3, -9), ip: '45.120.8.10', device: 'Unknown browser', approximateLocation: 'Singapore', success: false, current: false },
  ];

  return {
    accounts: [{ user: { id: 'usr_demo', fullName: profile.fullName, email: 'admin@sober.com' }, password: 'admin@sober.com' }],
    opportunities,
    trackOpportunities,
    approvals,
    applications,
    profile,
    settings,
    signInEvents,
    lastCheckedAt: at(0, -1),
    jobSources: [],
    savedAnswers: [
      {
        id: 'ans_notice',
        topic: AnswerTopic.NoticePeriod,
        question: 'What is your notice period?',
        answer: '30 days',
        createdAt: at(-20),
        updatedAt: at(-20),
      },
    ],
  };
}
