from careerpilot.matching.service import application_email
from careerpilot.testing import sample_settings

CONFIG = sample_settings().matching.application_email


def test_an_email_counts_only_when_the_posting_asks_to_apply_there() -> None:
    assert application_email("Interested candidates please send your CV to hr@acme.example.org.", CONFIG) == "hr@acme.example.org"
    assert application_email("Questions about the company? Write to hello@acme.example.org", CONFIG) is None


def test_accommodation_and_privacy_contacts_are_never_used_to_apply() -> None:
    text = "If you need an accommodation, email accommodation@acme.example.org. Send your resume to jobs@acme.example.org"
    assert application_email(text, CONFIG) == "jobs@acme.example.org"
    assert application_email("Send your CV to privacy@acme.example.org", CONFIG) is None
