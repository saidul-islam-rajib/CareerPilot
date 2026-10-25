import re
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime

from careerpilot.candidate.models import ApplicationRecord, OpportunityDetail, Profile
from careerpilot.platform.clock import parse_iso
from careerpilot.platform.enums import CheckFailure, ContactKind, SubmissionStatus
from careerpilot.platform.files import PDF, detect_content_type
from careerpilot.platform.validation import EMAIL_PATTERN

PLACEHOLDER = re.compile(r"\{[^{}]*\}|\[[^\[\]]*\]|<[^<>]*>|lorem ipsum", re.IGNORECASE)
SUBMITTED_STATUSES = frozenset(
    {
        SubmissionStatus.SUBMITTING,
        SubmissionStatus.SUBMITTED_AWAITING_CONFIRMATION,
        SubmissionStatus.CONFIRMED,
        SubmissionStatus.OUTCOME_UNKNOWN,
    }
)

FAILURE_STATUS: dict[CheckFailure, SubmissionStatus] = {
    CheckFailure.MISSING_DOCUMENT: SubmissionStatus.AWAITING_USER_INFORMATION,
    CheckFailure.UNREADABLE_DOCUMENT: SubmissionStatus.AWAITING_USER_INFORMATION,
    CheckFailure.MISSING_CONTACT: SubmissionStatus.AWAITING_USER_INFORMATION,
    CheckFailure.MISSING_RECIPIENT: SubmissionStatus.MANUAL_ACTION_REQUIRED,
    CheckFailure.INVALID_RECIPIENT: SubmissionStatus.MANUAL_ACTION_REQUIRED,
    CheckFailure.PLACEHOLDER_TEXT: SubmissionStatus.AWAITING_USER_INFORMATION,
    CheckFailure.WRONG_TARGET: SubmissionStatus.AWAITING_USER_INFORMATION,
    CheckFailure.OTHER_EMPLOYER_TEXT: SubmissionStatus.AWAITING_USER_INFORMATION,
    CheckFailure.DEADLINE_PASSED: SubmissionStatus.FAILED,
    CheckFailure.ALREADY_APPLIED: SubmissionStatus.FAILED,
}


@dataclass(frozen=True)
class SubmissionCase:
    profile: Profile
    application: ApplicationRecord
    opportunity: OpportunityDetail
    other_applications: list[ApplicationRecord]
    cv: bytes | None
    max_document_bytes: int
    now: datetime

    @property
    def cover_letter(self) -> str:
        return self.application.materials.cover_letter if self.application.materials else ""

    @property
    def answers(self) -> list[str]:
        return [a.answer for a in self.application.materials.answers] if self.application.materials else []


SubmissionCheck = Callable[[SubmissionCase], CheckFailure | None]


def contains(text: str, phrase: str) -> bool:
    return phrase.casefold() in text.casefold()


def check_document(case: SubmissionCase) -> CheckFailure | None:
    if case.cv is None:
        return CheckFailure.MISSING_DOCUMENT
    if detect_content_type(case.cv) != PDF or len(case.cv) > case.max_document_bytes:
        return CheckFailure.UNREADABLE_DOCUMENT
    return None


def check_recipient(case: SubmissionCase) -> CheckFailure | None:
    recipient = case.opportunity.application_email
    if not recipient:
        return CheckFailure.MISSING_RECIPIENT
    return None if EMAIL_PATTERN.match(recipient) else CheckFailure.INVALID_RECIPIENT


def check_reply_contact(case: SubmissionCase) -> CheckFailure | None:
    has_email = any(c.kind is ContactKind.EMAIL for c in case.profile.active_contacts())
    return None if has_email else CheckFailure.MISSING_CONTACT


def check_placeholders(case: SubmissionCase) -> CheckFailure | None:
    texts = [case.cover_letter, *case.answers]
    if not case.cover_letter.strip() or any(not text.strip() or PLACEHOLDER.search(text) for text in texts):
        return CheckFailure.PLACEHOLDER_TEXT
    return None


def check_target(case: SubmissionCase) -> CheckFailure | None:
    letter = case.cover_letter
    if not contains(letter, case.opportunity.organization) or not contains(letter, case.opportunity.title):
        return CheckFailure.WRONG_TARGET
    return None


def check_other_employers(case: SubmissionCase) -> CheckFailure | None:
    own = case.opportunity.organization.casefold()
    others = {a.opportunity.organization for a in case.other_applications if a.opportunity.organization.casefold() != own}
    texts = [case.cover_letter, *case.answers]
    return CheckFailure.OTHER_EMPLOYER_TEXT if any(contains(text, other) for other in others for text in texts) else None


def check_deadline(case: SubmissionCase) -> CheckFailure | None:
    deadline = case.opportunity.deadline
    return CheckFailure.DEADLINE_PASSED if deadline and parse_iso(deadline) <= case.now else None


def check_duplicates(case: SubmissionCase) -> CheckFailure | None:
    target = case.opportunity.id
    already = any(a.opportunity.id == target and a.submission_status in SUBMITTED_STATUSES for a in case.other_applications)
    return CheckFailure.ALREADY_APPLIED if already else None


EMAIL_CHECKS: list[SubmissionCheck] = [
    check_duplicates,
    check_deadline,
    check_document,
    check_recipient,
    check_reply_contact,
    check_placeholders,
    check_target,
    check_other_employers,
]


def first_failure(case: SubmissionCase, checks: list[SubmissionCheck]) -> CheckFailure | None:
    return next((failure for check in checks if (failure := check(case)) is not None), None)
