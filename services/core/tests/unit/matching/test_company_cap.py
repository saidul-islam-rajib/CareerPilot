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

SAME_COMPANY = "Same Company Ltd"
STRONG_SCORE = 90
LIST_SIZE = 20
EXTRA_JOBS = 8
REMOTE = "remote"
REMOTE_TRACK = "trk_remote"


class EveryJobFits:
    def __init__(self, clock: FixedClock) -> None:
        self._clock = clock

    def assess(self, profile: Profile, track: Track, listing: Listing) -> OpportunityMatch:
        return OpportunityMatch(
            score=STRONG_SCORE, factors=[], requirements=[], has_hard_failure=False, matcher="all", matched_at=iso(self._clock.now())
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
        matcher=EveryJobFits(clock),
    )
    return build_container(overrides)


def cap(app: Container) -> int:
    return app.recommendations._ctx.config.max_jobs_per_company  # pyright: ignore[reportPrivateUsage]


def open_listings_per_company(app: Container) -> Counter[str]:
    workspace = app.recommendations._ctx.workspaces.get(DEMO_USER)  # pyright: ignore[reportPrivateUsage]
    acted_on = {*workspace.decisions, *(a.opportunity.id for a in workspace.applications), *(a.opportunity.id for a in workspace.approvals)}
    organization = {item.id: item.organization for item in app.discovery.listings()}
    return Counter(
        organization[oid] for ids in workspace.track_opportunities.values() for oid in ids if oid in organization and oid not in acted_on
    )


def add_company_jobs(app: Container) -> list[str]:
    catalog = app.discovery._catalog  # pyright: ignore[reportPrivateUsage]
    template = next(item for item in app.discovery.listings() if item.work_arrangement == REMOTE)
    ids = [f"opp_same_{index}" for index in range(EXTRA_JOBS)]
    for index, listing_id in enumerate(ids):
        catalog.save(
            template.model_copy(
                update={"id": listing_id, "fingerprint": listing_id, "organization": SAME_COMPANY, "title": f"Engineer {index}"}
            )
        )
    return ids


def widen_every_track(app: Container) -> None:
    for track in app.preferences.get(DEMO_USER).tracks:
        app.preferences.update_track(DEMO_USER, track.id, LIST_SIZE, None)


def test_one_company_fills_at_most_three_places_across_all_lists(app: Container) -> None:
    add_company_jobs(app)
    widen_every_track(app)
    assert open_listings_per_company(app)[SAME_COMPANY] == cap(app)
    shown = [o for digest in app.dashboard.get(DEMO_USER).tracks for o in digest.opportunities if o.organization == SAME_COMPANY]
    assert len(shown) == cap(app)


def test_a_refresh_trims_companies_that_already_had_too_many_jobs_listed(app: Container) -> None:
    ids = add_company_jobs(app)
    workspaces = app.recommendations._ctx.workspaces  # pyright: ignore[reportPrivateUsage]
    workspace = workspaces.get(DEMO_USER)
    workspace.track_opportunities[REMOTE_TRACK] = [*workspace.track_opportunities[REMOTE_TRACK], *ids]
    workspaces.save(DEMO_USER, workspace)
    assert open_listings_per_company(app)[SAME_COMPANY] == EXTRA_JOBS
    app.recommendations.refresh(DEMO_USER)
    assert open_listings_per_company(app)[SAME_COMPANY] == cap(app)
