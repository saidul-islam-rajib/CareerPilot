import pytest

from careerpilot.automation.models import RuleInput
from careerpilot.bootstrap import Container, ContainerOverrides, build_container
from careerpilot.candidate.models import OpportunityMatch, SubmissionWindow
from careerpilot.candidate.ports import CandidateWorkspace
from careerpilot.platform.clock import FixedClock, SequentialIdGenerator
from careerpilot.platform.email_delivery import InMemoryEmailSender
from careerpilot.platform.enums import ApplicationMode, PauseDuration, SubmissionWindowKind
from careerpilot.platform.files import InMemoryFileStorage
from careerpilot.testing import load_sample_data, sample_repositories, sample_settings
from tests.unit.conftest import DEMO_USER, TEST_SECRET, FakeHasher

USER = DEMO_USER
REMOTE_TRACK = "trk_remote"
SOURCE_OPPORTUNITY = "opp_1"
EMAIL_OPPORTUNITY = "opp_6"


@pytest.fixture
def sender() -> InMemoryEmailSender:
    return InMemoryEmailSender()


@pytest.fixture
def service(clock: FixedClock, sender: InMemoryEmailSender) -> Container:
    overrides = ContainerOverrides(
        settings=sample_settings(),
        repositories=sample_repositories(load_sample_data(clock.now())),
        clock=clock,
        ids=SequentialIdGenerator(),
        hasher=FakeHasher(),
        token_secret=TEST_SECRET,
        file_storage=InMemoryFileStorage(),
        email_sender=sender,
    )
    container = build_container(overrides)
    container.preferences.update_submission_window(USER, SubmissionWindow(kind=SubmissionWindowKind.AS_SOON_AS_READY))
    return container


def workspace_of(container: Container) -> CandidateWorkspace:
    return container.preferences._ctx.workspaces.get(USER)  # pyright: ignore[reportPrivateUsage]


def save(container: Container, workspace: CandidateWorkspace) -> None:
    container.preferences._ctx.workspaces.save(USER, workspace)  # pyright: ignore[reportPrivateUsage]


def make_remote_automatic(container: Container) -> None:
    container.preferences.pause(USER, PauseDuration.DAYS, 7)
    container.preferences.update_track(USER, REMOTE_TRACK, None, ApplicationMode.AUTOMATIC)
    container.preferences.resume(USER)


def add_candidate(container: Container, opportunity_id: str, score: int = 80, **changes: object) -> None:
    repository = container.preferences._ctx.opportunities  # pyright: ignore[reportPrivateUsage]
    source = repository.get(SOURCE_OPPORTUNITY)
    assert source is not None
    repository.save(source.model_copy(update={"id": opportunity_id, "title": f"Role {opportunity_id}", "match_score": score, **changes}))
    workspace = workspace_of(container)
    workspace.track_opportunities[REMOTE_TRACK].append(opportunity_id)
    template = workspace.matches[SOURCE_OPPORTUNITY]
    workspace.matches[opportunity_id] = OpportunityMatch.model_validate({**template.model_dump(), "score": score})
    save(container, workspace)


def rule(name: str = "Main rule", **fields: object) -> RuleInput:
    return RuleInput.model_validate({"name": name, **fields})
