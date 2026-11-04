from collections.abc import Callable

from careerpilot.administration.models import PlatformSettings
from careerpilot.automation.policy import AutomationPolicy
from careerpilot.automation.service import AutomationContext, AutomationService, NotifyOnce
from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.services.approvals import ApprovalService
from careerpilot.platform.config import Settings


def automation_policy(settings: Settings) -> AutomationPolicy:
    return AutomationPolicy(settings.automation, [route.value for route in settings.submission.automatable_routes])


def automation_service(
    candidate: CandidateContext, platform: Callable[[], PlatformSettings], approvals: ApprovalService, notify_once: NotifyOnce
) -> AutomationService:
    return AutomationService(AutomationContext(candidate, platform, automation_policy(candidate.settings), approvals, notify_once))
