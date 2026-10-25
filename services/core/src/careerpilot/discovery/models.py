from dataclasses import dataclass, field
from enum import StrEnum

from careerpilot.platform.enums import OpportunityStatus
from careerpilot.platform.model import CamelModel


class CheckOutcome(StrEnum):
    SUCCEEDED = "succeeded"
    PARTIAL = "partial"
    FAILED = "failed"


class ListingChange(StrEnum):
    NEW = "new"
    UPDATED = "updated"
    UNCHANGED = "unchanged"


class WarningSign(StrEnum):
    UPFRONT_FEE = "upfront_fee"
    GUARANTEED_OFFER = "guaranteed_offer"
    SENSITIVE_DATA_REQUEST = "sensitive_data_request"
    PERSONAL_EMAIL_CONTACT = "personal_email_contact"


@dataclass(frozen=True)
class RawListing:
    url: str
    title: str
    organization: str
    location: str
    country_code: str
    work_arrangement: str
    type: str
    description: str
    published_at: str | None = None
    deadline: str | None = None


@dataclass(frozen=True)
class ParsedFeed:
    listings: list[RawListing]
    skipped: int = 0


class ListingSource(CamelModel):
    source_id: str
    url: str
    first_seen_at: str
    last_seen_at: str
    published_at: str | None = None


class CircularVersion(CamelModel):
    observed_at: str
    content_hash: str
    text: str


class Listing(CamelModel):
    id: str
    fingerprint: str
    type: str
    title: str
    organization: str
    location: str
    country_code: str
    work_arrangement: str
    deadline: str | None = None
    description: str
    status: OpportunityStatus
    warnings: list[WarningSign]
    sources: list[ListingSource]
    versions: list[CircularVersion]
    discovered_at: str
    last_checked_at: str

    @property
    def content_hash(self) -> str:
        return self.versions[-1].content_hash


@dataclass(frozen=True)
class SourceCheck:
    source_id: str
    outcome: CheckOutcome
    checked_at: str
    found: int
    changes: dict[ListingChange, list[Listing]] = field(default_factory=dict[ListingChange, list[Listing]])
    error: str | None = None

    def listings(self, change: ListingChange) -> list[Listing]:
        return self.changes.get(change, [])
