from dataclasses import dataclass

from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.services.auth import ClientInfo
from careerpilot.platform.clock import iso
from careerpilot.platform.errors import validation_error
from careerpilot.privacy.enums import ConsentKind, ConsentSource
from careerpilot.privacy.models import ConsentEntry, ConsentOverview, ConsentRecord
from careerpilot.privacy.ports import ConsentRepository


@dataclass(frozen=True)
class ConsentChange:
    kind: ConsentKind
    version: str
    granted: bool


@dataclass(frozen=True)
class ConsentContext:
    candidate: CandidateContext
    consents: ConsentRepository


class ConsentService:
    def __init__(self, context: ConsentContext) -> None:
        self._ctx = context
        self._candidate = context.candidate
        self._rules = context.candidate.settings.privacy.consent.kinds

    def registered(self, user_id: str, terms_version: str, privacy_version: str, client: ClientInfo) -> None:
        versions = {ConsentKind.TERMS: terms_version, ConsentKind.PRIVACY: privacy_version}
        for rule in self._rules:
            if rule.required:
                self._append(
                    user_id, ConsentChange(rule.kind, versions.get(rule.kind, privacy_version), True), client, ConsentSource.REGISTRATION
                )

    def overview(self, user_id: str) -> ConsentOverview:
        history = self._ctx.consents.for_user(user_id)
        latest = {record.kind: record for record in history}
        current = [self._entry(rule.kind, rule.required, latest.get(rule.kind)) for rule in self._rules]
        return ConsentOverview(current=current, history=list(reversed(history)))

    def update(self, user_id: str, kind: ConsentKind, granted: bool, client: ClientInfo) -> ConsentOverview:
        rule = next((r for r in self._rules if r.kind is kind), None)
        if rule is None or rule.required:
            raise validation_error("consent_kind")
        latest = [r for r in self._ctx.consents.for_user(user_id) if r.kind is kind]
        if (latest[-1].granted if latest else False) != granted:
            self._append(
                user_id, ConsentChange(kind, self._candidate.settings.legal.privacy_version, granted), client, ConsentSource.SETTINGS
            )
        return self.overview(user_id)

    def _append(self, user_id: str, change: ConsentChange, client: ClientInfo, source: ConsentSource) -> None:
        self._ctx.consents.add(
            ConsentRecord(
                id=self._candidate.ids.next("cns"),
                user_id=user_id,
                kind=change.kind,
                granted=change.granted,
                version=change.version,
                at=iso(self._candidate.clock.now()),
                ip=client.ip,
                device=client.device,
                source=source,
            )
        )

    @staticmethod
    def _entry(kind: ConsentKind, required: bool, record: ConsentRecord | None) -> ConsentEntry:
        return ConsentEntry(
            kind=kind,
            required=required,
            granted=bool(record and record.granted),
            version=record.version if record else None,
            at=record.at if record else None,
        )
