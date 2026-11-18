from pathlib import Path

import pytest

from careerpilot.discovery.bangla import latin_digits
from careerpilot.discovery.connectors.bd_notice import BdNoticeConnector
from careerpilot.discovery.pdf_text import PdfReadError, pdf_text
from careerpilot.discovery.requirements import RuleRequirementExtractor
from careerpilot.platform.config import ListingDefaults, SourceDefinition
from careerpilot.testing import sample_settings

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures" / "bangladesh"
DISCOVERY = sample_settings().discovery
BANGLADESH = DISCOVERY.bangladesh
EXPECTED_POSTS = 12
EXPECTED_AGE = 30
EXPECTED_EXPERIENCE = 3
EXPECTED_FEE = 1100
EXPECTED_DEADLINE = "2026-12-24T18:00:00.000Z"


def _read(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


def _source() -> SourceDefinition:
    defaults = ListingDefaults(type="government", work_arrangement="not_stated", country_code="", organization="")
    return SourceDefinition(connector="bd_notice", url="https://ministry.example.gov/notices", defaults=defaults)


@pytest.mark.parametrize("name", ["circular.txt", "circular_bn.txt"])
def test_rules_extract_english_and_bangla(name: str) -> None:
    found = RuleRequirementExtractor(DISCOVERY).extract(_read(name))
    assert found.posts == EXPECTED_POSTS
    assert found.age_max == EXPECTED_AGE
    assert found.experience_years == EXPECTED_EXPERIENCE
    assert found.fee_amount == EXPECTED_FEE
    assert found.deadline == EXPECTED_DEADLINE
    assert found.education


def test_rules_never_invent_missing_facts() -> None:
    found = RuleRequirementExtractor(DISCOVERY).extract("A general announcement without details.")
    assert found.age_max is None
    assert found.fee_amount is None
    assert found.deadline is None
    assert found.education == []


def test_bangla_digits_become_latin() -> None:
    assert latin_digits("২৫/১২/২০২৬", BANGLADESH) == "25/12/2026"


def test_connector_lists_notices_and_pdf_links_once() -> None:
    connector = BdNoticeConnector(BANGLADESH, RuleRequirementExtractor(DISCOVERY))
    feed = connector.parse(_read("notice_list.html"), _source())
    titles = [listing.title for listing in feed.listings]
    assert titles == ["Recruitment circular for Assistant Director", "নিয়োগ বিজ্ঞপ্তি: সহকারী পরিচালক"]
    assert {listing.country_code for listing in feed.listings} == {BANGLADESH.default_country_code}
    assert feed.listings[0].organization == "Ministry Example"


def test_pdf_text_reads_fixture() -> None:
    text = pdf_text((FIXTURES / "circular.pdf").read_bytes(), BANGLADESH)
    assert "Age limit 30 years" in text


def test_pdf_text_rejects_garbage() -> None:
    with pytest.raises(PdfReadError):
        pdf_text(b"not a pdf", BANGLADESH)
