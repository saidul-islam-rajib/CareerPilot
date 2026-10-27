from collections import Counter

import pytest

from careerpilot.bootstrap import Container, ContainerOverrides, build_container
from careerpilot.candidate.models import OpportunityMatch, Profile, Track
from careerpilot.discovery.models import Listing
from careerpilot.platform.clock import FixedClock, SequentialIdGenerator, iso
from careerpilot.platform.email_delivery import InMemoryEmailSender
from careerpilot.platform.files import InMemoryFileStorage
from careerpilot.testing import load_sample_data, sample_repositories, sample_settings
from tests.unit.conftest import DEMO_USER, TEST_SECRET, FakeHasher

MISS_SCORE = 40
HIT_SCORE = 30
REMOTE_TRACK = "trk_remote"
PYTHON_LISTING = "opp_1"
ACTED_ON_REMOTE = ["opp_remote_frontend", "opp_remote_fullstack"]


class SkillMatcher:
    def __init__(self, clock: FixedClock) -> None:
        self._clock = clock

    def assess(self, profile: Profile, track: Track, listing: Listing) -> OpportunityMatch:
        hits = sum(1 for skill in profile.skills if skill.lower() in listing.title.lower())
        return OpportunityMatch(
            score=min(100, MISS_SCORE + HIT_SCORE * hits),
            factors=[],
            requirements=[],
            has_hard_failure=False,
            matcher="skills",
            matched_at=iso(self._clock.now()),
        )


@pytest.fixture
def app(clock: FixedClock, outbox: InMemoryEmailSender) -> Container:
    overrides = ContainerOverrides(
        settings=sample_settings(),
        repositories=sample_repositories(load_sample_data(clock.now())),
        clock=clock,
        ids=SequentialIdGenerator(),
        hasher=FakeHasher(),
        token_secret=TEST_SECRET,
        file_storage=InMemoryFileStorage(),
        email_sender=outbox,
        matcher=SkillMatcher(clock),
    )
    return build_container(overrides)


def placements(app: Container) -> dict[str, list[str]]:
    return {digest.track.id: [o.id for o in digest.opportunities] for digest in app.dashboard.get(DEMO_USER).tracks}


def add_skill(app: Container, skill: str) -> None:
    app.profile.set_skills(DEMO_USER, [*app.profile.get(DEMO_USER).skills, skill])


def test_a_profile_change_rescores_and_places_new_best_matches(app: Container) -> None:
    assert PYTHON_LISTING not in placements(app)[REMOTE_TRACK]
    add_skill(app, "Python")
    remote = placements(app)[REMOTE_TRACK]
    assert PYTHON_LISTING in remote
    assert set(ACTED_ON_REMOTE) <= set(remote)
    assert app.opportunities.detail(DEMO_USER, PYTHON_LISTING).match_score == MISS_SCORE + HIT_SCORE


def test_matches_that_no_longer_fit_leave_but_acted_on_jobs_stay(app: Container) -> None:
    add_skill(app, "Python")
    app.profile.set_skills(DEMO_USER, [s for s in app.profile.get(DEMO_USER).skills if s != "Python"])
    remote = placements(app)[REMOTE_TRACK]
    assert PYTHON_LISTING not in remote
    assert set(ACTED_ON_REMOTE) <= set(remote)


def test_tracks_list_best_matches_first_and_never_share_a_job(app: Container) -> None:
    add_skill(app, "Python")
    add_skill(app, "QA")
    for digest in app.dashboard.get(DEMO_USER).tracks:
        scores = [o.match_score for o in digest.opportunities]
        assert scores == sorted(scores, reverse=True)
    counts = Counter(oid for ids in placements(app).values() for oid in ids)
    assert all(count == 1 for count in counts.values())


def test_changing_a_track_rematches_within_its_new_size(app: Container) -> None:
    add_skill(app, "Python")
    app.preferences.update_track(DEMO_USER, REMOTE_TRACK, len(ACTED_ON_REMOTE), None)
    assert placements(app)[REMOTE_TRACK] == ACTED_ON_REMOTE
