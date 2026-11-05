import pytest

from careerpilot.portal.accounts import PortalAccounts
from careerpilot.portal.config import PortalsConfig
from careerpilot.portal.enums import AccountStatus, FieldKind, FlowOutcome, PageKind, RunMode, StopReason, WallKind
from careerpilot.portal.models import Permissions
from careerpilot.portal.testing import FakePage
from careerpilot.portal.verification import VerificationHit
from tests.unit.portal.conftest import ACCOUNT_EMAIL, HOST, application_site, field, job_input, run_flow

CODE = VerificationHit(code="482913")


def test_full_flow_creates_account_verifies_fills_and_confirms(config: PortalsConfig, accounts: PortalAccounts) -> None:
    driver = application_site()
    submitted: list[bool] = []
    result = run_flow(driver, config, accounts, job_input(), CODE, lambda: submitted.append(True))
    assert result.outcome is FlowOutcome.CONFIRMED
    assert submitted == [True]
    assert result.submit_clicked
    assert "Thank you for applying" in result.confirmation_text
    assert driver.filled["e"] == ACCOUNT_EMAIL
    assert driver.filled["v"] == "482913"
    assert driver.filled["n"] == "Rahim Uddin"
    assert driver.filled["y"] == "5"
    assert driver.chosen["s"] == "No"
    assert driver.checked["t"] and driver.checked["k"]
    assert driver.uploads["cv"] == "cv.pdf"
    assert result.screenshot == b"png"


def test_the_generated_password_is_sealed_and_never_in_the_plans(config: PortalsConfig, accounts: PortalAccounts) -> None:
    driver = application_site()
    result = run_flow(driver, config, accounts, job_input(), CODE)
    account = accounts.find("usr_1", HOST)
    assert account is not None
    password = accounts.password_of(account)
    assert driver.filled["p"] == password and driver.filled["c"] == password
    assert len(password) >= config.password.length
    assert password not in account.sealed_password
    assert all(password not in plan.value for plan in result.plans)
    assert result.account_id == account.id


def test_a_captcha_on_the_job_page_stops_before_anything_is_created(config: PortalsConfig, accounts: PortalAccounts) -> None:
    driver = application_site()
    driver.pages["job"] = FakePage(text="Apply here", present=frozenset(config.captcha_selectors[:1]), buttons={"Apply now": "register"})
    result = run_flow(driver, config, accounts, job_input())
    assert result.stop is StopReason.CAPTCHA and result.captcha_seen
    assert accounts.find("usr_1", HOST) is None
    assert driver.filled == {}


def test_a_captcha_on_the_register_page_creates_no_account(config: PortalsConfig, accounts: PortalAccounts) -> None:
    driver = application_site()
    driver.pages["register"].present = frozenset(config.captcha_selectors[:1])
    result = run_flow(driver, config, accounts, job_input())
    assert result.stop is StopReason.CAPTCHA
    assert accounts.find("usr_1", HOST) is None


def test_closed_and_already_applied_pages_stop(config: PortalsConfig, accounts: PortalAccounts) -> None:
    closed = application_site()
    closed.pages["job"] = FakePage(text="We are no longer accepting applications.")
    assert run_flow(closed, config, accounts, job_input()).stop is StopReason.CLOSED
    applied = application_site()
    applied.pages["job"] = FakePage(text="You have already applied for this job.")
    assert run_flow(applied, config, accounts, job_input()).stop is StopReason.ALREADY_APPLIED


def test_account_creation_needs_the_rule_to_allow_it(config: PortalsConfig, accounts: PortalAccounts) -> None:
    driver = application_site()
    result = run_flow(driver, config, accounts, job_input(permissions=Permissions(accept_terms=True)))
    assert result.stop is StopReason.ACCOUNT_CREATION_NOT_ALLOWED
    assert driver.filled == {}


def test_verification_without_consent_asks_the_user(config: PortalsConfig, accounts: PortalAccounts) -> None:
    permissions = Permissions(allow_account_creation=True, account_email=ACCOUNT_EMAIL, accept_terms=True, accept_privacy=True)
    result = run_flow(application_site(), config, accounts, job_input(permissions=permissions), CODE)
    assert result.stop is StopReason.VERIFICATION_NEEDED


def test_no_verification_mail_found_asks_the_user(config: PortalsConfig, accounts: PortalAccounts) -> None:
    assert run_flow(application_site(), config, accounts, job_input(), None).stop is StopReason.VERIFICATION_NEEDED


def test_an_unknown_required_question_stops_with_prepared_answers(config: PortalsConfig, accounts: PortalAccounts) -> None:
    driver = application_site()
    driver.pages["step2"].fields.append(field("q", "Why do you want to work here?"))
    result = run_flow(driver, config, accounts, job_input(), CODE)
    assert result.stop is StopReason.UNKNOWN_QUESTION
    assert [p.label for p in result.pending] == ["Why do you want to work here?"]
    assert any(p.label == "Full name" for p in result.prepared)
    assert not result.submit_clicked


def test_a_choice_without_an_exact_match_stops(config: PortalsConfig, accounts: PortalAccounts) -> None:
    driver = application_site()
    driver.pages["step2"].fields[1] = field("s", "Do you require visa sponsorship?", FieldKind.SELECT, options=("Maybe", "Later"))
    assert run_flow(driver, config, accounts, job_input(), CODE).stop is StopReason.NO_EXACT_CHOICE


def test_demographic_questions_need_an_explicit_answer(config: PortalsConfig, accounts: PortalAccounts) -> None:
    driver = application_site()
    driver.pages["step2"].fields.append(field("g", "Gender", FieldKind.SELECT, options=("Female", "Male")))
    assert run_flow(driver, config, accounts, job_input(), CODE).stop is StopReason.DEMOGRAPHIC


def test_attestations_stop(config: PortalsConfig, accounts: PortalAccounts) -> None:
    driver = application_site()
    driver.pages["step2"].fields.append(field("d", "I certify that the information provided is true and correct", FieldKind.CHECKBOX))
    assert run_flow(driver, config, accounts, job_input(), CODE).stop is StopReason.ATTESTATION


def test_terms_without_permission_stop_and_create_no_account(config: PortalsConfig, accounts: PortalAccounts) -> None:
    permissions = Permissions(allow_account_creation=True, account_email=ACCOUNT_EMAIL, allow_email_verification=True)
    result = run_flow(application_site(), config, accounts, job_input(permissions=permissions), CODE)
    assert result.stop is StopReason.TERMS_NOT_ALLOWED
    assert accounts.find("usr_1", HOST) is None


@pytest.mark.parametrize(
    ("text", "reason"),
    [
        ("Please take the assessment before continuing", StopReason.ASSESSMENT),
        ("Record a video introduction", StopReason.VIDEO),
        ("Pay the application fee to proceed", StopReason.PAYMENT),
        ("Enter the code sent to your phone, two-factor authentication", StopReason.MFA),
    ],
)
def test_user_only_pages_stop(config: PortalsConfig, accounts: PortalAccounts, text: str, reason: StopReason) -> None:
    driver = application_site()
    driver.pages["step1"].text = text
    assert run_flow(driver, config, accounts, job_input(), CODE).stop is reason


def test_an_error_after_submit_is_uncertain_and_never_resubmitted(config: PortalsConfig, accounts: PortalAccounts) -> None:
    driver = application_site()
    driver.fail_after_click = "Submit application"
    result = run_flow(driver, config, accounts, job_input(), CODE)
    assert result.outcome is FlowOutcome.UNCERTAIN
    assert driver.clicks.count("Submit application") == 1


def test_submit_without_a_confirmation_is_uncertain(config: PortalsConfig, accounts: PortalAccounts) -> None:
    driver = application_site()
    driver.pages["done"] = FakePage(text="Something went wrong. Try again later.")
    result = run_flow(driver, config, accounts, job_input(), CODE)
    assert result.outcome is FlowOutcome.UNCERTAIN
    assert result.confirmation_text == ""


def sign_in_page(failed: bool = False) -> FakePage:
    return FakePage(
        text="Invalid email or password" if failed else "Sign in to apply",
        fields=[field("e", "Email address", FieldKind.EMAIL), field("p", "Password", FieldKind.PASSWORD)],
        buttons={"Sign in": "bad"},
    )


def test_an_existing_account_signs_in_once_and_failure_needs_attention(config: PortalsConfig, accounts: PortalAccounts) -> None:
    accounts.create("usr_1", HOST, "Acme", ACCOUNT_EMAIL, "https://x")
    driver = application_site()
    driver.pages["job"] = sign_in_page()
    driver.pages["bad"] = sign_in_page(failed=True)
    result = run_flow(driver, config, accounts, job_input())
    assert result.stop is StopReason.LOGIN_FAILED
    assert driver.clicks.count("Sign in") == 1
    account = accounts.find("usr_1", HOST)
    assert account is not None and account.status is AccountStatus.NEEDS_ATTENTION
    second = application_site()
    second.pages["job"] = sign_in_page()
    assert run_flow(second, config, accounts, job_input()).stop is StopReason.ACCOUNT_NEEDS_ATTENTION
    assert second.clicks == []


def test_a_successful_sign_in_continues_to_the_form(config: PortalsConfig, accounts: PortalAccounts) -> None:
    accounts.create("usr_1", HOST, "Acme", ACCOUNT_EMAIL, "https://x")
    driver = application_site()
    driver.pages["job"] = sign_in_page()
    driver.pages["bad"] = application_site().pages["step1"]
    result = run_flow(driver, config, accounts, job_input())
    assert result.outcome is FlowOutcome.CONFIRMED
    account = accounts.find("usr_1", HOST)
    assert account is not None and account.status is AccountStatus.ACTIVE and account.login_attempts == 0


def test_readiness_mode_never_writes(config: PortalsConfig, accounts: PortalAccounts) -> None:
    driver = application_site()
    driver.pages["job"] = FakePage(text="Software Engineer", buttons={"Apply now": "step1"})
    result = run_flow(driver, config, accounts, job_input(RunMode.READINESS))
    assert result.outcome is FlowOutcome.READY
    assert driver.filled == {} and driver.chosen == {} and driver.checked == {} and driver.uploads == {}
    assert driver.clicks == ["Apply now"]
    assert PageKind.FORM in result.pages
    assert all(plan.stop is None for plan in result.plans)


def test_readiness_stops_at_a_wall_without_creating_accounts(config: PortalsConfig, accounts: PortalAccounts) -> None:
    driver = application_site()
    result = run_flow(driver, config, accounts, job_input(RunMode.READINESS))
    assert result.wall is WallKind.REGISTER
    assert result.stop is StopReason.WALL_UNVERIFIED
    assert driver.filled == {} and accounts.find("usr_1", HOST) is None


def test_the_page_budget_stops_endless_forms(config: PortalsConfig, accounts: PortalAccounts) -> None:
    driver = application_site()
    driver.pages["step1"].buttons = {"Next": "step1"}
    driver.pages["step1"].fields = [driver.pages["step1"].fields[0]]
    assert run_flow(driver, config, accounts, job_input(), CODE).stop is StopReason.PAGE_LIMIT
