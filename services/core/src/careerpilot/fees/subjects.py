from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class OpportunityFeeSubject:
    opportunity_type: str
    title: str
    organization: str
    description: str
    source_url: str
    deadline: datetime | None


@dataclass(frozen=True)
class ProgramFeeSubject:
    title: str
    university: str
    amount: float | None
    currency: str
    waiver_note: str
    source_url: str
    deadline: datetime | None


OpportunityLookup = Callable[[str, str], OpportunityFeeSubject | None]
ProgramLookup = Callable[[str, str], ProgramFeeSubject | None]
