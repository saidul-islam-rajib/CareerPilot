import pytest

from careerpilot.discovery.classification import ListingClassifier, Placement
from careerpilot.testing import sample_settings

UNKNOWN = Placement(work_arrangement="not_stated", country_code="")


@pytest.fixture
def classifier() -> ListingClassifier:
    return ListingClassifier(sample_settings().discovery.classification)


def test_stated_arrangements_and_countries_are_kept(classifier: ListingClassifier) -> None:
    stated = Placement(work_arrangement="remote", country_code="US")
    assert classifier.classify("Engineer", "Dhaka", "Office in Gulshan", stated) == stated


def test_remote_and_hybrid_wording_sorts_jobs(classifier: ListingClassifier) -> None:
    assert classifier.classify("Backend Engineer (Remote)", "", "", UNKNOWN).work_arrangement == "remote"
    assert classifier.classify("QA Engineer", "Dhaka, Bangladesh - Hybrid", "", UNKNOWN) == Placement("hybrid", "BD")
    assert classifier.classify("Designer", "", "You can work from home three days a week.", UNKNOWN).work_arrangement == "remote"


def test_a_job_in_a_known_place_without_remote_wording_is_on_site(classifier: ListingClassifier) -> None:
    assert classifier.classify("Help Desk Executive", "", "Our office in Mohakhali DOHS, Dhaka needs support.", UNKNOWN) == Placement(
        "onsite", "BD"
    )


def test_single_words_in_long_descriptions_do_not_decide_the_arrangement(classifier: ListingClassifier) -> None:
    assert classifier.classify("Analyst", "", "Experience with remote sensing data", UNKNOWN) == UNKNOWN
