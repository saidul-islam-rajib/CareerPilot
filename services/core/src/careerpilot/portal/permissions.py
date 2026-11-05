from careerpilot.automation.models import AutomationRule
from careerpilot.portal.models import Permissions, PortalSettings


def effective_permissions(settings: PortalSettings, rule: AutomationRule | None) -> Permissions:
    base = settings.permissions
    if rule is None:
        return base
    override = rule.portal
    return base.model_copy(
        update={
            "allow_account_creation": base.allow_account_creation if override.allow_account_creation is None else override.allow_account_creation,
            "account_email": override.account_email or base.account_email,
            "accept_terms": base.accept_terms if override.accept_terms is None else override.accept_terms,
            "accept_privacy": base.accept_privacy if override.accept_privacy is None else override.accept_privacy,
        }
    )
