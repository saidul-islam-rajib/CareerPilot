from enum import StrEnum


class RecordKind(StrEnum):
    PROGRAM = "program"
    TEST = "test"
    CREDENTIAL = "credential"
    REFEREE = "referee"
    RECOMMENDATION = "recommendation"
    OUTREACH = "outreach"
    SETTINGS = "settings"


class StudyKind(StrEnum):
    TAUGHT_MASTERS = "taught_masters"
    RESEARCH_MASTERS = "research_masters"
    PHD = "phd"
    SCHOLARSHIP = "scholarship"
    FELLOWSHIP = "fellowship"
    RESEARCH_ASSISTANTSHIP = "research_assistantship"
    TEACHING_ASSISTANTSHIP = "teaching_assistantship"
    EXCHANGE = "exchange"
    SUMMER_SCHOOL = "summer_school"
    POSTDOC = "postdoc"
    INTERNSHIP = "internship"


class Term(StrEnum):
    FALL = "fall"
    SPRING = "spring"
    WINTER = "winter"
    SUMMER = "summer"


class Evidence(StrEnum):
    EXPLICIT = "explicit"
    NOT_STATED = "not_stated"
    UNCLEAR = "unclear"
    CONFLICTING = "conflicting"


class Need(StrEnum):
    REQUIRED = "required"
    OPTIONAL = "optional"
    NOT_REQUIRED = "not_required"
    NOT_STATED = "not_stated"


class ScorePolicy(StrEnum):
    OFFICIAL_ONLY = "official_only"
    SELF_REPORTED = "self_reported"
    ALTERNATIVE = "alternative"
    NOT_STATED = "not_stated"


class ExamKind(StrEnum):
    IELTS = "ielts"
    TOEFL = "toefl"
    PTE = "pte"
    DUOLINGO = "duolingo"
    GRE = "gre"
    GMAT = "gmat"
    SAT = "sat"
    ACT = "act"
    OTHER = "other"


class ExamStatus(StrEnum):
    PLANNED = "planned"
    REGISTERED = "registered"
    TAKEN = "taken"
    SCORES_RELEASED = "scores_released"
    CANCELLED = "cancelled"


class DeadlineKind(StrEnum):
    APPLICATION = "application"
    EARLY_DECISION = "early_decision"
    PRIORITY = "priority"
    SCHOLARSHIP_CONSIDERATION = "scholarship_consideration"
    FUNDING = "funding"
    REFEREE = "referee"
    SUPERVISOR_CONTACT = "supervisor_contact"
    DECISION_EXPECTED = "decision_expected"
    ACCEPTANCE = "acceptance"
    DEPOSIT = "deposit"
    TEST_REGISTRATION = "test_registration"
    TEST_DATE = "test_date"
    SCORE_EXPIRY = "score_expiry"
    CONDITION = "condition"
    CHECKLIST = "checklist"


class FundingStatus(StrEnum):
    STATED = "stated"
    NOT_STATED = "not_stated"
    UNCLEAR = "unclear"
    NONE = "none"


class AmountSource(StrEnum):
    OFFICIAL = "official"
    ESTIMATE = "estimate"


class BudgetKind(StrEnum):
    APPLICATION_FEE = "application_fee"
    TEST_FEE = "test_fee"
    SCORE_SENDING = "score_sending"
    EVALUATION = "evaluation"
    TRANSLATION = "translation"
    COURIER = "courier"
    VISA_FEE = "visa_fee"
    OTHER = "other"


class GradeScale(StrEnum):
    CGPA_4 = "cgpa_4"
    GPA_5 = "gpa_5"
    PERCENTAGE = "percentage"
    DIVISION = "division"
    OTHER = "other"


class CredentialKind(StrEnum):
    DEGREE_CERTIFICATE = "degree_certificate"
    TRANSCRIPT = "transcript"
    SECONDARY_CERTIFICATE = "secondary_certificate"
    OTHER = "other"


class CredentialNeed(StrEnum):
    EVALUATION = "evaluation"
    CERTIFIED_COPY = "certified_copy"
    TRANSLATION = "translation"
    NOTARIZATION = "notarization"
    SEALED_TRANSCRIPT = "sealed_transcript"


class ItemStatus(StrEnum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"


class ConversionSource(StrEnum):
    OFFICIAL = "official"
    ESTIMATE = "estimate"


class AgreementStatus(StrEnum):
    NOT_ASKED = "not_asked"
    ASKED = "asked"
    AGREED = "agreed"
    DECLINED = "declined"


class SubmissionMethod(StrEnum):
    PORTAL_INVITE = "portal_invite"
    EMAIL = "email"
    POSTAL = "postal"
    INSTITUTION_FORM = "institution_form"
    NOT_STATED = "not_stated"


class RecommendationStatus(StrEnum):
    PLANNED = "planned"
    REQUESTED = "requested"
    SUBMITTED = "submitted"
    CONFIRMED = "confirmed"


class ReceiptEvidence(StrEnum):
    INSTITUTION_CONFIRMATION = "institution_confirmation"
    USER_STATEMENT = "user_statement"


class DraftKind(StrEnum):
    REQUEST = "request"
    REMINDER = "reminder"


class OutreachStatus(StrEnum):
    DRAFT = "draft"
    SENT = "sent"
    REPLIED_POSITIVE = "replied_positive"
    CALL_REQUESTED = "call_requested"
    DOCUMENTS_REQUESTED = "documents_requested"
    REPLIED_NEUTRAL = "replied_neutral"
    DECLINED = "declined"
    STOPPED = "stopped"


class ReplyOutcome(StrEnum):
    POSITIVE = "positive"
    CALL_REQUESTED = "call_requested"
    DOCUMENTS_REQUESTED = "documents_requested"
    NEUTRAL = "neutral"
    DECLINED = "declined"
    DO_NOT_CONTACT = "do_not_contact"


class ProgramStatus(StrEnum):
    SAVED = "saved"
    PREPARING = "preparing"
    SUBMITTED = "submitted"
    DECIDED = "decided"
    WITHDRAWN = "withdrawn"


class PortalSubmission(StrEnum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    SUBMITTED_BY_USER = "submitted_by_user"
    CONFIRMED_BY_INSTITUTION = "confirmed_by_institution"


class PortalFee(StrEnum):
    NOT_REQUIRED = "not_required"
    DUE = "due"
    PAID_BY_USER = "paid_by_user"


class DecisionKind(StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    CONDITIONALLY_ACCEPTED = "conditionally_accepted"
    WAITLISTED = "waitlisted"
    INTERVIEW_INVITED = "interview_invited"
    REJECTED = "rejected"
    DEFERRED = "deferred"


class UserAction(StrEnum):
    ACCEPT_OFFER = "accept_offer"
    PAY_DEPOSIT = "pay_deposit"
    DECLINE_OFFER = "decline_offer"


class ChecklistStep(StrEnum):
    ADMISSION_DOCUMENT = "admission_document"
    PROOF_OF_FUNDS = "proof_of_funds"
    VISA = "visa"
    HEALTH_INSURANCE = "health_insurance"
    ACCOMMODATION = "accommodation"
    TUITION_PAYMENT = "tuition_payment"
    TRAVEL = "travel"
    ARRIVAL_REGISTRATION = "arrival_registration"


class PlanStepKind(StrEnum):
    TEST_REGISTRATION = "test_registration"
    TAKE_TEST = "take_test"
    SEND_SCORES = "send_scores"
    PREPARE_DOCUMENTS = "prepare_documents"
    REQUEST_REFEREES = "request_referees"
    CONTACT_SUPERVISOR = "contact_supervisor"
    SUBMIT_APPLICATION = "submit_application"


class WarningKind(StrEnum):
    SCORE_EXPIRES_BEFORE_DEADLINE = "score_expires_before_deadline"
    SCORE_EXPIRES_BEFORE_START = "score_expires_before_start"
    NO_VALID_SCORE = "no_valid_score"
    REFEREE_WITHOUT_CONSENT = "referee_without_consent"


class AttentionKind(StrEnum):
    OUTREACH_REPLY = "outreach_reply"
    DEADLINE_SOON = "deadline_soon"
    SCORE_WARNING = "score_warning"
    PORTAL_BLOCKED = "portal_blocked"


class Blocker(StrEnum):
    SECTION_INCOMPLETE = "section_incomplete"
    DOCUMENT_MISSING = "document_missing"
    REFEREE_NOT_CONSENTED = "referee_not_consented"
    REFEREE_NOT_INVITED = "referee_not_invited"
    FEE_DUE = "fee_due"
    INSTITUTION_ITEM_PENDING = "institution_item_pending"
    CREDENTIAL_PENDING = "credential_pending"


class Failure(StrEnum):
    REFEREE_CONSENT_REQUIRED = "referee_consent_required"
    EVIDENCE_REQUIRED = "evidence_required"
    RESEARCH_REFERENCE_REQUIRED = "research_reference_required"
    PROFILE_NAME_REQUIRED = "profile_name_required"
    OUTREACH_LIMIT = "outreach_limit"
    OUTREACH_STOPPED = "outreach_stopped"
    OUTREACH_GENERIC = "outreach_generic"
    FOLLOW_UP_NOT_ALLOWED = "follow_up_not_allowed"
    FOLLOW_UP_TOO_SOON = "follow_up_too_soon"
    CONFIRMATION_REQUIRED = "confirmation_required"
    NOT_AN_OFFER = "not_an_offer"
    UNKNOWN_PROGRAM = "unknown_program"
    NOT_A_STUDY_OPPORTUNITY = "not_a_study_opportunity"
    ALREADY_SENT = "already_sent"
    NOT_SENT = "not_sent"
    UNKNOWN_SECTION = "unknown_section"
    TOO_MANY_ITEMS = "too_many_items"
    LIMIT_ABOVE_MAXIMUM = "limit_above_maximum"
    DUPLICATE = "duplicate"
