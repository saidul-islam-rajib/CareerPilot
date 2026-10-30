import re
from collections.abc import Callable
from dataclasses import dataclass

from careerpilot.candidate.models import ApplicationRecord
from careerpilot.integrations.models import MailMessage, Targets
from careerpilot.platform.config import MailMatchingConfig

NON_ALPHANUMERIC = re.compile(r"[^a-z0-9]")
ADDRESS_FULL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
AT = "@"


def compact(value: str) -> str:
    return NON_ALPHANUMERIC.sub("", value.lower())


def domain_of(address: str) -> str:
    return address.rpartition(AT)[2].lower()


def in_family(domain: str, known: str) -> bool:
    return domain == known or domain.endswith(f".{known}")


@dataclass(frozen=True)
class Match:
    application_id: str
    strength: int


OpportunityEmail = Callable[[str], str | None]


class ApplicationMatcher:
    def __init__(self, config: MailMatchingConfig, free_mail_domains: frozenset[str]) -> None:
        self._config = config
        self._free = free_mail_domains

    def targets(self, application: ApplicationRecord, opportunity_email: OpportunityEmail) -> Targets:
        found = Targets(organization=compact(application.opportunity.organization))
        addresses = [email.to for email in application.emails]
        contact = opportunity_email(application.opportunity.id)
        if contact:
            addresses.append(contact)
        for text in addresses:
            for address in ADDRESS_FULL.findall(text):
                found.addresses.add(address.lower())
                domain = domain_of(address)
                if domain not in self._free:
                    found.domains.add(domain)
        return found

    def strength(self, message: MailMessage, targets: Targets) -> int:
        address = message.sender_address.lower()
        if address in targets.addresses:
            return self._config.address_strength
        domain = domain_of(address)
        if domain not in self._free and any(in_family(domain, known) for known in targets.domains):
            return self._config.domain_strength
        if self._names_organization(message, targets) and self._has_keyword(message.subject):
            return self._config.organization_strength
        return 0

    def best(self, message: MailMessage, targets: dict[str, Targets]) -> Match | None:
        scored = sorted(
            (Match(application_id, self.strength(message, found)) for application_id, found in targets.items()),
            key=lambda match: match.strength,
            reverse=True,
        )
        if not scored or scored[0].strength == 0:
            return None
        if len(scored) > 1 and scored[1].strength == scored[0].strength:
            return None
        return scored[0]

    def _names_organization(self, message: MailMessage, targets: Targets) -> bool:
        if len(targets.organization) < self._config.min_organization_length:
            return False
        sender = compact(f"{message.sender_name} {domain_of(message.sender_address)}")
        return targets.organization in sender

    def _has_keyword(self, subject: str) -> bool:
        lowered = subject.lower()
        return any(keyword in lowered for keyword in self._config.subject_keywords)

    def sender_terms(self, all_targets: dict[str, Targets]) -> list[str]:
        terms: set[str] = set()
        for found in all_targets.values():
            terms.update(found.addresses)
            terms.update(found.domains)
        return sorted(terms)
