import pytest

from careerpilot.bootstrap import Container
from careerpilot.matching.skills import SkillCatalog, skill_tokens
from careerpilot.platform.config import load_settings
from tests.unit.conftest import DEMO_USER


@pytest.fixture
def catalog() -> SkillCatalog:
    return SkillCatalog(load_settings("local").matching.skill_gap)


def test_tokens_keep_symbols_that_belong_to_skill_names() -> None:
    assert skill_tokens("C++, C# and ASP.NET with Node.js.") == ["c++", "c#", "and", "asp.net", "with", "node.js"]


def test_the_longest_known_phrase_wins(catalog: SkillCatalog) -> None:
    names = [hit.name for hit in catalog.find("We build in React Native, React and ReactJS on k8s")]
    assert names == ["React Native", "React", "React", "Kubernetes"]


def test_everyday_words_are_not_mistaken_for_skills(catalog: SkillCatalog) -> None:
    assert catalog.find("You will go the extra mile and rest well; excel at teamwork") == []


def test_missing_skills_skip_what_the_profile_lists_under_any_spelling(catalog: SkillCatalog) -> None:
    missing = catalog.missing(
        ["reactjs", "TypeScript"],
        "Senior React Developer (GraphQL)",
        "Use React, TypeScript, Docker, AWS and Docker Compose. GraphQL and Kubernetes are a plus.",
    )
    assert missing == ["GraphQL", "Docker", "AWS"]


def test_no_more_than_the_configured_number_of_skills_are_suggested(catalog: SkillCatalog) -> None:
    missing = catalog.missing([], "Data engineer", "Python, SQL, Airflow, dbt, Snowflake, BigQuery, Spark")
    assert len(missing) == load_settings("local").matching.skill_gap.limit


def test_dashboard_jobs_show_skills_the_profile_does_not_list(container: Container) -> None:
    summaries = [o for digest in container.dashboard.get(DEMO_USER).tracks for o in digest.opportunities]
    skills = {skill.casefold() for skill in container.profile.get(DEMO_USER).skills}
    assert any(o.missing_skills for o in summaries)
    assert all(skill.casefold() not in skills for o in summaries for skill in o.missing_skills)
