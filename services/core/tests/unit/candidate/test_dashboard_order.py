import pytest

from careerpilot.bootstrap import Container
from careerpilot.candidate.services.profile import BasicsChanges
from careerpilot.platform.enums import ApplicationFilter
from careerpilot.platform.errors import DomainError
from tests.unit.conftest import DEMO_USER

HOME_KIND = "bangladesh_onsite"


def test_home_country_on_site_jobs_come_first_on_the_dashboard_and_in_settings(container: Container) -> None:
    dashboard = container.dashboard.get(DEMO_USER)
    assert dashboard.tracks[0].track.kind == HOME_KIND
    assert dashboard.home_country == container.settings.account.default_country_code
    tracks = container.preferences.get(DEMO_USER).tracks
    assert tracks[0].kind == HOME_KIND
    assert [track.position for track in tracks] == list(range(1, len(tracks) + 1))


def test_the_home_country_follows_the_profile(container: Container) -> None:
    container.profile.update_basics(DEMO_USER, BasicsChanges(country_code="sg"))
    assert container.dashboard.get(DEMO_USER).home_country == "SG"
    assert container.preferences.get(DEMO_USER).home_country == "SG"
    with pytest.raises(DomainError) as raised:
        container.profile.update_basics(DEMO_USER, BasicsChanges(country_code="Singapore"))
    assert raised.value.detail == "country_code"


def test_favorite_companies_are_listed_first(container: Container) -> None:
    digest = next(d for d in container.dashboard.get(DEMO_USER).tracks if len({o.organization for o in d.opportunities}) > 1)
    last = digest.opportunities[-1]
    saved = container.preferences.update_favorite_companies(DEMO_USER, [last.organization, last.organization.upper()])
    assert saved.favorite_companies == [last.organization]
    reordered = next(d for d in container.dashboard.get(DEMO_USER).tracks if d.track.id == digest.track.id)
    assert reordered.opportunities[0].organization == last.organization
    assert container.dashboard.get(DEMO_USER).favorite_companies == [last.organization]


def test_favorite_companies_have_a_limit(container: Container) -> None:
    limit = container.settings.account.max_favorite_companies
    with pytest.raises(DomainError) as raised:
        container.preferences.update_favorite_companies(DEMO_USER, [f"Company {index}" for index in range(limit + 1)])
    assert raised.value.detail == "favorite_limit"


def test_jobs_already_applied_to_are_not_shown_again_on_today(container: Container) -> None:
    applied = {application.opportunity.id for application in container.applications.list(DEMO_USER, ApplicationFilter.ALL)}
    shown = {o.id for digest in container.dashboard.get(DEMO_USER).tracks for o in digest.opportunities}
    assert applied
    assert not applied & shown
