from careerpilot.candidate.models import ApplicationRecord, Evidence, TimelineEntry
from careerpilot.integrations.matching import ADDRESS_FULL
from careerpilot.integrations.models import MailMessage
from careerpilot.platform.clock import iso
from careerpilot.platform.config import BounceConfig
from careerpilot.platform.enums import SubmissionStatus, TimelineActor
from careerpilot.platform.messages import translate

BOUNCEABLE_STATUSES = frozenset({SubmissionStatus.SUBMITTED_AWAITING_CONFIRMATION, SubmissionStatus.CONFIRMED})


class BounceDetector:
    def __init__(self, config: BounceConfig) -> None:
        self._config = config

    def is_bounce(self, message: MailMessage) -> bool:
        sender = message.sender_address.lower()
        subject = message.subject.lower()
        from_daemon = any(term in sender for term in self._config.sender_terms)
        failure_subject = any(phrase in subject for phrase in self._config.subject_phrases)
        return from_daemon or failure_subject

    def failed_recipients(self, message: MailMessage) -> set[str]:
        return {address.lower() for address in ADDRESS_FULL.findall(f"{message.subject} {message.body}")}

    def match(self, message: MailMessage, applications: list[ApplicationRecord]) -> tuple[ApplicationRecord, str] | None:
        recipients = self.failed_recipients(message)
        found: list[tuple[ApplicationRecord, str]] = []
        for application in applications:
            if application.submission_status not in BOUNCEABLE_STATUSES:
                continue
            sent_to = [email.to for email in application.emails if email.to.lower() in recipients]
            if sent_to:
                found.append((application, sent_to[0]))
        return found[0] if len(found) == 1 else None

    @staticmethod
    def apply(application: ApplicationRecord, recipient: str, message: MailMessage, link: str, now_text: str) -> None:
        names = {"to": recipient}
        received = iso(message.received_at)
        application.evidence.append(Evidence(text=translate("integrations.bounce.evidence", names), at=received))
        application.submission_status = SubmissionStatus.FAILED
        application.updated_at = now_text
        application.timeline.append(
            TimelineEntry(
                at=received,
                actor=TimelineActor.SYSTEM,
                text=translate("integrations.bounce.timeline", names),
                status=SubmissionStatus.FAILED,
                link=link,
            )
        )
