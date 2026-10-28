from collections.abc import Callable

from careerpilot.discovery.connectors.html import HtmlConnector
from careerpilot.discovery.models import RawListing
from careerpilot.discovery.pages import TITLE_SEPARATORS, PageScan, scan_page
from careerpilot.discovery.ports import FetchError
from careerpilot.discovery.resolver import listing_defaults
from careerpilot.platform.config import SourceDefinition

PageFetcher = Callable[[str], tuple[str, str]]
HTML = "html"


def page_heading(page: PageScan) -> str:
    title = page.title.strip()
    for separator in TITLE_SEPARATORS:
        if separator in title:
            return title.split(separator, 1)[0].strip()
    return title


class JobLinkReader:
    def __init__(self, fetch_page: PageFetcher) -> None:
        self._fetch_page = fetch_page
        self._html = HtmlConnector()

    def read(self, url: str) -> RawListing | None:
        try:
            final_url, body = self._fetch_page(url)
        except FetchError:
            return None
        page = scan_page(final_url, body)
        organization = page.organization()
        definition = SourceDefinition(connector=HTML, url=final_url, defaults=listing_defaults(organization))
        postings = page.job_postings()
        posted = self._html.from_posting(postings[0], definition, final_url, page) if postings else None
        if posted is not None:
            return posted
        title = page_heading(page)
        if not title:
            return None
        defaults = definition.defaults
        return RawListing(
            url=final_url,
            title=title,
            organization=organization,
            location=defaults.location,
            country_code=defaults.country_code,
            work_arrangement=defaults.work_arrangement,
            type=defaults.type,
            description=page.body_text(),
        )
