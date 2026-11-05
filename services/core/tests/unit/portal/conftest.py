import pytest

from careerpilot.candidate.models import SavedAnswer
from careerpilot.integrations.vault import FernetCipher
from careerpilot.platform.clock import FixedClock, SequentialIdGenerator
from careerpilot.platform.config import load_settings
from careerpilot.platform.enums import AnswerTopic
from careerpilot.portal.accounts import AccountsContext, PortalAccounts
from careerpilot.portal.adapters.in_memory import InMemoryPortalRecords
from careerpilot.portal.config import PortalsConfig
from careerpilot.portal.driver import FormField
from careerpilot.portal.enums import Fact, FieldKind, RunMode
from careerpilot.portal.flow import CvFile, FlowDeps, FlowInput, FlowResult, PortalFlow
from careerpilot.portal.models import Permissions
from careerpilot.portal.testing import FakeDriver, FakePage
from careerpilot.portal.verification import VerificationHit
from tests.unit.conftest import NOW

HOST = "jobs.acme.test"
JOB_URL = f"https://{HOST}/jobs/1"
ACCOUNT_EMAIL = "member+portal@example.com"
NOOP = lambda: None  # noqa: E731


@pytest.fixture
def config() -> PortalsConfig:
    return load_settings("local").portals


@pytest.fixture
def records() -> InMemoryPortalRecords:
    return InMemoryPortalRecords()


@pytest.fixture
def accounts(config: PortalsConfig, records: InMemoryPortalRecords) -> PortalAccounts:
    cipher = FernetCipher("secret-for-tests-only", config.vault_context)
    return PortalAccounts(AccountsContext(config, FixedClock(NOW), SequentialIdGenerator(), records, cipher))


def field(handle: str, label: str, kind: FieldKind = FieldKind.TEXT, **changes: object) -> FormField:
    values: dict[str, object] = {"handle": handle, "kind": kind, "label": label, "required": True, **changes}
    return FormField(**values)  # type: ignore[arg-type]


def facts() -> dict[Fact, str]:
    return {Fact.FULL_NAME: "Rahim Uddin", Fact.EMAIL: "rahim@example.com", Fact.PHONE: "+8801700000000"}


def answers() -> list[SavedAnswer]:
    stamp = NOW.isoformat()
    return [
        SavedAnswer(id="a1", topic=AnswerTopic.EXPERIENCE, question="Years of experience", answer="5", created_at=stamp, updated_at=stamp),
        SavedAnswer(
            id="a2",
            topic=AnswerTopic.SPONSORSHIP,
            question="Do you require visa sponsorship?",
            answer="No",
            created_at=stamp,
            updated_at=stamp,
        ),
    ]


def full_permissions() -> Permissions:
    return Permissions(
        allow_account_creation=True,
        account_email=ACCOUNT_EMAIL,
        accept_terms=True,
        accept_privacy=True,
        allow_email_verification=True,
    )


def job_input(mode: RunMode = RunMode.LIVE, permissions: Permissions | None = None) -> FlowInput:
    return FlowInput(
        user_id="usr_1",
        job_url=JOB_URL,
        host=HOST,
        employer="Acme Ltd",
        mode=mode,
        facts=facts(),
        saved_answers=answers(),
        permissions=permissions or full_permissions(),
        cover_letter="Dear team",
        cv=CvFile("cv.pdf", b"%PDF-1.4"),
    )


def application_site() -> FakeDriver:
    pages = {
        "job": FakePage(text="Software Engineer at Acme Ltd", buttons={"Apply now": "register"}),
        "register": FakePage(
            text="Create your account to apply",
            fields=[
                field("e", "Email address", FieldKind.EMAIL, autocomplete="email"),
                field("p", "Password", FieldKind.PASSWORD),
                field("c", "Confirm password", FieldKind.PASSWORD),
                field("t", "I accept the Terms and Privacy Policy", FieldKind.CHECKBOX),
            ],
            buttons={"Create account": "verify"},
        ),
        "verify": FakePage(
            text="Verify your email. Check your inbox for a verification code.",
            fields=[field("v", "Verification code")],
            buttons={"Verify": "step1"},
        ),
        "step1": FakePage(
            text="Your details",
            fields=[
                field("n", "Full name", autocomplete="name"),
                field("m", "Email", FieldKind.EMAIL, autocomplete="email"),
                field("ph", "Phone number", FieldKind.TEL, autocomplete="tel"),
                field("cv", "Resume", FieldKind.FILE),
            ],
            buttons={"Next": "step2"},
        ),
        "step2": FakePage(
            text="Questions",
            fields=[
                field("y", "Years of experience", FieldKind.NUMBER),
                field("s", "Do you require visa sponsorship?", FieldKind.SELECT, options=("Yes", "No")),
                field("k", "I agree to the privacy policy", FieldKind.CHECKBOX),
            ],
            buttons={"Submit application": "done"},
        ),
        "done": FakePage(text="Thank you for applying. Your application was received. Reference APP-1"),
    }
    return FakeDriver(pages=pages, start="job")


def run_flow(
    driver: FakeDriver,
    config: PortalsConfig,
    accounts: PortalAccounts,
    job: FlowInput,
    hit: VerificationHit | None = None,
    *,
    before_submit: object = NOOP,
) -> FlowResult:
    deps = FlowDeps(
        driver=driver,
        config=config,
        adapter=config.adapter_for(HOST),
        accounts=accounts,
        fetch_verification=lambda: hit,
        before_submit=before_submit,  # type: ignore[arg-type]
        sleep=lambda _seconds: None,
    )
    return PortalFlow(deps, job).run()
