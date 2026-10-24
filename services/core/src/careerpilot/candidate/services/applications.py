from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.models import ApplicationRecord, ApplicationSummary
from careerpilot.platform.enums import ApplicationFilter, SubmissionStatus
from careerpilot.platform.errors import not_found

STATUS_GROUPS: dict[ApplicationFilter, frozenset[SubmissionStatus]] = {
    ApplicationFilter.ACTIVE: frozenset(
        {
            SubmissionStatus.NOT_STARTED,
            SubmissionStatus.PREPARING,
            SubmissionStatus.AWAITING_APPROVAL,
            SubmissionStatus.APPROVED_QUEUED,
            SubmissionStatus.SUBMITTING,
        }
    ),
    ApplicationFilter.SUBMITTED: frozenset({SubmissionStatus.SUBMITTED_AWAITING_CONFIRMATION, SubmissionStatus.CONFIRMED}),
    ApplicationFilter.ATTENTION: frozenset(
        {
            SubmissionStatus.AWAITING_USER_INFORMATION,
            SubmissionStatus.MANUAL_ACTION_REQUIRED,
            SubmissionStatus.OUTCOME_UNKNOWN,
            SubmissionStatus.FAILED,
        }
    ),
}


def matches_filter(status: SubmissionStatus, application_filter: ApplicationFilter) -> bool:
    return application_filter is ApplicationFilter.ALL or status in STATUS_GROUPS[application_filter]


class ApplicationService:
    def __init__(self, context: CandidateContext) -> None:
        self._ctx = context

    def list(self, user_id: str, application_filter: ApplicationFilter) -> list[ApplicationSummary]:
        applications = [
            a for a in self._ctx.workspaces.get(user_id).applications if matches_filter(a.submission_status, application_filter)
        ]
        return [a.summary() for a in sorted(applications, key=lambda a: a.updated_at, reverse=True)]

    def get(self, user_id: str, application_id: str) -> ApplicationRecord:
        record = next((a for a in self._ctx.workspaces.get(user_id).applications if a.id == application_id), None)
        if record is None:
            raise not_found("application")
        return record
