from collections.abc import Callable
from dataclasses import dataclass

from careerpilot.administration.sources import link_source_id
from careerpilot.candidate.models import OpportunityDetail
from careerpilot.candidate.services.opportunities import OpportunityService
from careerpilot.discovery.job_links import JobLinkReader
from careerpilot.discovery.resolver import normalized_link
from careerpilot.discovery.service import DiscoveryService
from careerpilot.matching.service import RecommendationService
from careerpilot.platform.errors import validation_error


@dataclass(frozen=True)
class JobLinkContext:
    check_address: Callable[[str], str | None]
    reader: JobLinkReader
    discovery: DiscoveryService
    recommendations: RecommendationService
    opportunities: OpportunityService


class JobLinkService:
    def __init__(self, context: JobLinkContext) -> None:
        self._ctx = context

    def add(self, user_id: str, link: str) -> OpportunityDetail:
        url = self._ctx.check_address(normalized_link(link))
        if url is None:
            raise validation_error("job_url")
        raw = self._ctx.reader.read(url)
        if raw is None:
            raise validation_error("job_not_found")
        listing = self._ctx.discovery.listing_for(link_source_id(user_id), raw)
        opportunity_id = self._ctx.recommendations.place(user_id, listing)
        return self._ctx.opportunities.detail(user_id, opportunity_id)
