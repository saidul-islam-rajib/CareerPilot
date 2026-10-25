from typing import Protocol

from careerpilot.candidate.models import OpportunityMatch, Profile, Track
from careerpilot.discovery.models import Listing


class Matcher(Protocol):
    def assess(self, profile: Profile, track: Track, listing: Listing) -> OpportunityMatch: ...
