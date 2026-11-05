from dataclasses import dataclass
from urllib.parse import urlsplit

from careerpilot.platform.clock import Clock, iso
from careerpilot.platform.errors import validation_error
from careerpilot.portal.config import PortalsConfig, host_matches
from careerpilot.portal.enums import Failure, HostPolicy, RecordKind
from careerpilot.portal.models import HostInput, HostRecord
from careerpilot.portal.ports import PortalRecordRepository
from careerpilot.portal.store import SYSTEM_OWNER, RecordStore

SCHEMES = frozenset({"http", "https"})


def host_of(url: str) -> str:
    parts = urlsplit(url.strip())
    if parts.scheme not in SCHEMES or not parts.hostname:
        raise validation_error(Failure.INVALID_URL.value)
    return parts.hostname.lower()


@dataclass(frozen=True)
class HostsContext:
    config: PortalsConfig
    clock: Clock
    records: PortalRecordRepository
    trusted_hosts: frozenset[str] = frozenset()


class HostPolicies:
    def __init__(self, context: HostsContext) -> None:
        self._ctx = context
        self._store = RecordStore(context.records, RecordKind.HOST, HostRecord)

    def policy_of(self, host: str) -> HostPolicy:
        return self.record_of(host).policy

    def record_of(self, host: str) -> HostRecord:
        stored = self._stored(host)
        if stored is not None:
            return stored
        configured = self._ctx.config.configured_policy(host)
        if configured is not None:
            return HostRecord(host=configured.host, policy=configured.policy, note=configured.note, configured=True)
        return HostRecord(host=host, policy=HostPolicy.REVIEW)

    def observe(self, host: str) -> HostRecord:
        record = self.record_of(host)
        if self._stored(host) is None and not record.configured:
            self._store.save(SYSTEM_OWNER, host, record)
        return record

    def decide(self, host: str, body: HostInput) -> HostRecord:
        clean = host.strip().lower()
        if not clean or "/" in clean:
            raise validation_error(Failure.INVALID_HOST.value)
        record = HostRecord(
            host=clean, policy=body.policy, note=body.note, configured=False, decided_at=iso(self._ctx.clock.now())
        )
        return self._store.save(SYSTEM_OWNER, clean, record)

    def records(self) -> list[HostRecord]:
        stored = {r.host: r for r in self._store.all(SYSTEM_OWNER)}
        configured = {e.host: self.record_of(e.host) for e in self._ctx.config.hosts}
        return sorted({**configured, **stored}.values(), key=lambda r: r.host)

    def _stored(self, host: str) -> HostRecord | None:
        exact = self._store.get(SYSTEM_OWNER, host)
        if exact is not None:
            return exact
        suffix = [r for r in self._store.all(SYSTEM_OWNER) if host_matches(host, r.host)]
        return max(suffix, key=lambda r: len(r.host), default=None)
