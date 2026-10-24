import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Protocol


class Clock(Protocol):
    def now(self) -> datetime: ...


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(UTC)


@dataclass
class FixedClock:
    current: datetime

    def now(self) -> datetime:
        return self.current

    def advance(self, delta: timedelta) -> None:
        self.current = self.current + delta


class IdGenerator(Protocol):
    def next(self, prefix: str) -> str: ...


class UuidIdGenerator:
    def next(self, prefix: str) -> str:
        return f"{prefix}_{uuid.uuid4().hex}"


@dataclass
class SequentialIdGenerator:
    counter: int = field(default=0)

    def next(self, prefix: str) -> str:
        self.counter += 1
        return f"{prefix}_{self.counter}"


def iso(moment: datetime) -> str:
    return moment.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))
