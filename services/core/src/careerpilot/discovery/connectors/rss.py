from xml.etree.ElementTree import Element

from defusedxml import DefusedXmlException
from defusedxml.ElementTree import ParseError, fromstring

from careerpilot.discovery.models import ParsedFeed, RawListing
from careerpilot.discovery.ports import CONNECTOR_INTERFACE_VERSION, FetchError
from careerpilot.discovery.text import plain_text, rfc822_to_iso
from careerpilot.platform.config import SourceDefinition

ORGANIZATION_SEPARATOR = ": "
ATOM = "{http://www.w3.org/2005/Atom}"


def _text(item: Element, *tags: str) -> str:
    for tag in tags:
        found = item.find(tag)
        if found is not None and found.text:
            return found.text.strip()
    return ""


def _atom_link(item: Element) -> str:
    link = item.find(f"{ATOM}link")
    return link.get("href", "") if link is not None else ""


class RssConnector:
    key = "rss"
    version = "1.0.0"
    interface_version = CONNECTOR_INTERFACE_VERSION

    def parse(self, body: str, definition: SourceDefinition) -> ParsedFeed:
        try:
            root = fromstring(body)
        except (ParseError, DefusedXmlException) as error:
            raise FetchError("invalid_feed") from error
        items = [*root.iter("item"), *root.iter(f"{ATOM}entry")]
        listings = [listing for listing in (self._listing(item, definition) for item in items) if listing is not None]
        return ParsedFeed(listings=listings, skipped=len(items) - len(listings))

    @staticmethod
    def _listing(item: Element, definition: SourceDefinition) -> RawListing | None:
        heading = _text(item, "title", f"{ATOM}title")
        url = _text(item, "link") or _atom_link(item)
        if not heading or not url:
            return None
        defaults = definition.defaults
        organization, title = defaults.organization, heading
        if not organization and ORGANIZATION_SEPARATOR in heading:
            organization, title = (part.strip() for part in heading.split(ORGANIZATION_SEPARATOR, 1))
        if not organization:
            return None
        return RawListing(
            url=url,
            title=title,
            organization=organization,
            location=defaults.location,
            country_code=defaults.country_code,
            work_arrangement=defaults.work_arrangement,
            type=defaults.type,
            description=plain_text(_text(item, "description", f"{ATOM}summary", f"{ATOM}content")),
            published_at=rfc822_to_iso(_text(item, "pubDate")) or None,
        )
