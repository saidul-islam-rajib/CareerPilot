from datetime import timedelta

import pytest

from careerpilot.integrations.models import MailMessage
from careerpilot.platform.clock import FixedClock
from careerpilot.platform.config import load_settings
from careerpilot.platform.errors import DomainError
from careerpilot.portal.accounts import PortalAccounts, generate_password
from careerpilot.portal.adapters.in_memory import InMemoryPortalRecords
from careerpilot.portal.config import PortalsConfig
from careerpilot.portal.enums import AccountStatus, FieldKind, FieldSource, FieldStatus, HostPolicy, StopReason
from careerpilot.portal.hosts import HostPolicies, HostsContext, host_of
from careerpilot.portal.live import real_applications_enabled
from careerpilot.portal.mapping import FieldMapper, MappingContext
from careerpilot.portal.models import AccountInput, HostInput, Permissions
from careerpilot.portal.throttle import HostThrottle
from careerpilot.portal.verification import VerificationFetcher
from tests.unit.conftest import NOW
from tests.unit.portal.conftest import ACCOUNT_EMAIL, HOST, answers, facts, field


def mapper(config: PortalsConfig, permissions: Permissions | None = None, cover_letter: str = "", has_cv: bool = True) -> FieldMapper:
    context = MappingContext(config, facts(), answers(), permissions or Permissions(), cover_letter=cover_letter, has_cv=has_cv)
    return FieldMapper(context)


def test_every_default_value_comes_from_configuration(config: PortalsConfig) -> None:
    assert config.password.length >= 12
    assert config.limits.max_login_attempts == 1
    assert config.throttle.max_concurrent_per_host == 1
    assert all(entry.policy is HostPolicy.REVIEW for entry in config.hosts)
    assert {"easy_jobs", "greenhouse", "lever", "workable", "ashby", "smartrecruiters", "hrythmic"} <= {a.key for a in config.adapters}


def test_live_switch_fails_closed() -> None:
    config = load_settings("local").submission
    on = {config.real_applications_env: "true"}
    assert real_applications_enabled(config, on) is True
    assert real_applications_enabled(config, {}) is False
    assert real_applications_enabled(config, {config.real_applications_env: "maybe"}) is False
    assert real_applications_enabled(config, {config.real_applications_env: ""}) is False
    assert real_applications_enabled(config, {**on, "CI": "true"}) is False
    assert real_applications_enabled(config, {**on, "PYTEST_CURRENT_TEST": "x"}) is False
    assert real_applications_enabled(config, {**on, "APP_ENV": "test"}) is False


def test_live_switch_is_off_under_pytest() -> None:
    config = load_settings("local").submission
    assert real_applications_enabled(config) is False


def test_mapper_uses_facts_saved_answers_and_documents(config: PortalsConfig) -> None:
    plans = mapper(config).plan(
        [
            field("n", "Full name"),
            field("y", "Years of experience", FieldKind.NUMBER),
            field("s", "Do you require visa sponsorship?", FieldKind.RADIO, options=("Yes", "No")),
            field("cv", "Upload your CV", FieldKind.FILE),
        ]
    )
    assert [p.source for p in plans] == [FieldSource.PROFILE_FACT, FieldSource.SAVED_ANSWER, FieldSource.SAVED_ANSWER, FieldSource.DOCUMENT]
    assert plans[2].value == "No"


def test_mapper_never_guesses(config: PortalsConfig) -> None:
    plans = mapper(config, has_cv=False).plan(
        [
            field("a", "What is your favourite colour?"),
            field("b", "Expected salary"),
            field("cv", "Resume", FieldKind.FILE),
            field("x", "Upload your transcript", FieldKind.FILE),
        ]
    )
    assert [p.status for p in plans] == [FieldStatus.UNKNOWN, FieldStatus.UNKNOWN, FieldStatus.UNKNOWN, FieldStatus.UNSUPPORTED]
    assert all(p.stop is not None for p in plans)


def test_optional_unknown_fields_are_skipped_not_guessed(config: PortalsConfig) -> None:
    plans = mapper(config).plan([field("a", "Favourite colour", required=False), field("g", "Gender", FieldKind.SELECT, required=False)])
    assert all(p.status is FieldStatus.SKIPPED and p.stop is None for p in plans)


def test_prefilled_resume_values_are_checked_against_the_profile(config: PortalsConfig) -> None:
    plans = mapper(config).plan(
        [field("n", "Full name", value="R. Uddin"), field("m", "Email", FieldKind.EMAIL, value="rahim@example.com")]
    )
    assert plans[0].status is FieldStatus.CORRECTED and plans[0].value == "Rahim Uddin"
    assert plans[1].status is FieldStatus.MAPPED


def test_a_saved_answer_is_not_reused_for_a_different_question(config: PortalsConfig) -> None:
    plans = mapper(config).plan([field("a", "Years of management experience")])
    assert plans[0].status is FieldStatus.UNKNOWN


def test_consent_follows_the_rule(config: PortalsConfig) -> None:
    allowed = mapper(config, Permissions(accept_terms=True, accept_privacy=True)).plan(
        [field("c", "I accept the Terms and Privacy Policy", FieldKind.CHECKBOX)]
    )
    only_terms = mapper(config, Permissions(accept_terms=True)).plan(
        [field("c", "I accept the Terms and Privacy Policy", FieldKind.CHECKBOX)]
    )
    assert allowed[0].source is FieldSource.CONSENT_RULE and allowed[0].status is FieldStatus.MAPPED
    assert only_terms[0].stop is StopReason.TERMS_NOT_ALLOWED


def test_cover_letter_is_used_only_when_one_is_approved(config: PortalsConfig) -> None:
    with_letter = mapper(config, cover_letter="Dear team").plan([field("l", "Cover letter", FieldKind.TEXTAREA)])
    without = mapper(config).plan([field("l", "Cover letter", FieldKind.TEXTAREA)])
    assert with_letter[0].source is FieldSource.COVER_LETTER
    assert without[0].stop is StopReason.UNKNOWN_QUESTION


def test_generated_passwords_are_strong_and_unique(config: PortalsConfig) -> None:
    policy = config.password
    passwords = {generate_password(policy) for _ in range(50)}
    assert len(passwords) == 50
    sample = next(iter(passwords))
    assert len(sample) == policy.length
    assert any(c in policy.lowercase for c in sample) and any(c in policy.uppercase for c in sample)
    assert any(c in policy.digits for c in sample) and any(c in policy.symbols for c in sample)


def test_accounts_seal_export_and_delete(accounts: PortalAccounts, records: InMemoryPortalRecords) -> None:
    account, password = accounts.create("usr_1", HOST, "Acme", ACCOUNT_EMAIL, "https://x")
    assert password not in str(records._items.values())  # pyright: ignore[reportPrivateUsage]
    view = accounts.views("usr_1")[0]
    assert (view.host, view.employer, view.email, view.status) == (HOST, "Acme", ACCOUNT_EMAIL, AccountStatus.ACTIVE)
    assert not hasattr(view, "sealed_password") and not hasattr(view, "password")
    assert accounts.reveal("usr_1", account.id).password == password
    assert [s.password for s in accounts.export("usr_1")] == [password]
    accounts.remove("usr_1", account.id)
    assert accounts.views("usr_1") == []
    with pytest.raises(DomainError):
        accounts.reveal("usr_1", account.id)


def test_accounts_are_private_per_user(accounts: PortalAccounts) -> None:
    account, _ = accounts.create("usr_1", HOST, "Acme", ACCOUNT_EMAIL, "")
    assert accounts.views("usr_2") == []
    with pytest.raises(DomainError):
        accounts.reveal("usr_2", account.id)


def test_importing_credentials_replaces_the_saved_sign_in(accounts: PortalAccounts) -> None:
    accounts.import_credential("usr_1", AccountInput(host=HOST, email="a@example.com", password="Old-pass-1"))
    accounts.import_credential("usr_1", AccountInput(host=HOST, email="b@example.com", password="New-pass-2"))
    assert [a.email for a in accounts.views("usr_1")] == ["b@example.com"]
    found = accounts.find("usr_1", HOST)
    assert found is not None and accounts.password_of(found) == "New-pass-2"


def test_logins_are_limited_to_one_attempt(accounts: PortalAccounts) -> None:
    account, _ = accounts.create("usr_1", HOST, "Acme", ACCOUNT_EMAIL, "")
    assert accounts.login_allowed(account)
    tried = accounts.record_login_attempt("usr_1", account)
    assert not accounts.login_allowed(tried)
    accounts.mark_signed_in("usr_1", tried)
    refreshed = accounts.find("usr_1", HOST)
    assert refreshed is not None and accounts.login_allowed(refreshed)
    accounts.mark_needs_attention("usr_1", refreshed)
    flagged = accounts.find("usr_1", HOST)
    assert flagged is not None and not accounts.login_allowed(flagged)


def hosts_service(config: PortalsConfig, records: InMemoryPortalRecords) -> HostPolicies:
    return HostPolicies(HostsContext(config, FixedClock(NOW), records))


def test_new_hosts_are_review_until_an_admin_decides(config: PortalsConfig, records: InMemoryPortalRecords) -> None:
    hosts = hosts_service(config, records)
    assert hosts.policy_of("careers.new-employer.test") is HostPolicy.REVIEW
    hosts.observe("careers.new-employer.test")
    assert "careers.new-employer.test" in [r.host for r in hosts.records()]
    hosts.decide("careers.new-employer.test", HostInput(policy=HostPolicy.ALLOWED, note="terms read"))
    assert hosts.policy_of("careers.new-employer.test") is HostPolicy.ALLOWED
    assert hosts.policy_of("sub.careers.new-employer.test") is HostPolicy.ALLOWED
    assert hosts.policy_of("easy.jobs") is HostPolicy.REVIEW
    hosts.decide("easy.jobs", HostInput(policy=HostPolicy.BLOCKED))
    assert hosts.policy_of("brainstation-23.easy.jobs") is HostPolicy.BLOCKED


def test_host_of_rejects_non_web_links() -> None:
    assert host_of("https://Jobs.Acme.test/a?b=1") == "jobs.acme.test"
    for bad in ("javascript:alert(1)", "file:///etc/passwd", "not a url"):
        with pytest.raises(DomainError):
            host_of(bad)


def test_throttle_spaces_requests_to_the_same_host(config: PortalsConfig) -> None:
    now = [0.0]
    waits: list[float] = []

    def sleep(seconds: float) -> None:
        waits.append(seconds)
        now[0] += seconds

    throttle = HostThrottle(config.throttle, clock=lambda: now[0], sleep=sleep)
    with throttle.slot("a.test"):
        now[0] += 1
    with throttle.slot("a.test"):
        pass
    with throttle.slot("b.test"):
        pass
    assert waits == [config.throttle.min_interval_seconds]


class StubMail:
    def __init__(self, messages: list[MailMessage] | None) -> None:
        self.messages = messages
        self.queries: list[str] = []

    def recent_mail(self, user_id: str, query: str, limit: int) -> list[MailMessage] | None:
        self.queries.append(query)
        return self.messages


def mail(sender: str, body: str, age_minutes: int = 1) -> MailMessage:
    return MailMessage("m1", sender, "Portal", "Verify your email", body, NOW - timedelta(minutes=age_minutes))


def fetcher(config: PortalsConfig, messages: list[MailMessage] | None) -> tuple[VerificationFetcher, StubMail]:
    stub = StubMail(messages)
    return VerificationFetcher(config.verification, FixedClock(NOW), stub, sleep=lambda _s: None), stub


def test_verification_link_needs_the_portal_domain_and_a_recent_message(config: PortalsConfig) -> None:
    body = "Click https://jobs.acme.test/verify?token=abc to confirm, or see https://evil.test/verify?x=1"
    found, stub = fetcher(config, [mail("no-reply@acme.test", body)])
    hit = found.wait_for("usr_1", HOST, None)
    assert hit is not None and hit.link == "https://jobs.acme.test/verify?token=abc"
    assert "from:acme.test" in stub.queries[0]


def test_verification_code_is_taken_from_a_matching_sender(config: PortalsConfig) -> None:
    found, _ = fetcher(config, [mail("no-reply@acme.test", "Your code is 482913")])
    hit = found.wait_for("usr_1", HOST, None)
    assert hit is not None and hit.code == "482913"


def test_verification_ignores_other_senders_old_mail_and_other_sites_links(config: PortalsConfig) -> None:
    for message in (
        mail("no-reply@other.test", "code 111111"),
        mail("no-reply@acme.test", "code 222222", age_minutes=config.verification.recent_minutes + 5),
        mail("no-reply@acme.test", "Go to https://evil.test/verify?x=1"),
    ):
        found, stub = fetcher(config, [message])
        hit = found.wait_for("usr_1", HOST, None)
        assert hit is None
        assert len(stub.queries) == config.verification.max_polls


def test_verification_without_mail_access_returns_nothing(config: PortalsConfig) -> None:
    found, _ = fetcher(config, None)
    assert found.wait_for("usr_1", HOST, None) is None
