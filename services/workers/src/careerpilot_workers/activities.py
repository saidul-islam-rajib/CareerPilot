from temporalio import activity

from careerpilot.bootstrap import Container
from careerpilot.discovery.models import ListingChange
from careerpilot.platform.errors import DomainError
from careerpilot_workers.workflows import (
    CHECK_SOURCE,
    CONFIRM_SENT,
    DUE_APPLICATIONS,
    DUE_SOURCES,
    SUBMIT_APPLICATION,
    QueuedItem,
    SourceCheckResult,
    SubmissionReport,
)


class DiscoveryActivities:
    def __init__(self, container: Container) -> None:
        self._container = container

    @activity.defn(name=DUE_SOURCES)
    def due_sources(self) -> list[str]:
        return self._container.source_checks.due_sources()

    @activity.defn(name=CHECK_SOURCE)
    def check_source(self, source_id: str) -> SourceCheckResult:
        try:
            _, check = self._container.source_checks.check(source_id)
        except DomainError as error:
            return SourceCheckResult(source_id=source_id, outcome=None, new_listings=0, error=error.detail or error.code.value)
        return SourceCheckResult(
            source_id=source_id,
            outcome=check.outcome.value,
            new_listings=len(check.listings(ListingChange.NEW)),
            error=check.error,
        )


class SubmissionActivities:
    def __init__(self, container: Container) -> None:
        self._container = container

    @activity.defn(name=DUE_APPLICATIONS)
    def due_applications(self) -> list[QueuedItem]:
        return [QueuedItem(user_id=q.user_id, application_id=q.application_id) for q in self._container.submissions.due()]

    @activity.defn(name=SUBMIT_APPLICATION)
    def submit_application(self, item: QueuedItem) -> SubmissionReport:
        result = self._container.submissions.submit(item.user_id, item.application_id)
        return SubmissionReport(
            application_id=item.application_id, status=result.status.value, hold=result.hold.value if result.hold else None
        )

    @activity.defn(name=CONFIRM_SENT)
    def confirm_sent(self) -> int:
        return self._container.submissions.confirm_sent()
