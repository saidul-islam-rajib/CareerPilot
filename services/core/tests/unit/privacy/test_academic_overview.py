from careerpilot.academic.enums import RecordKind
from careerpilot.bootstrap import Container
from tests.unit.administration.test_admin_visibility import admin
from tests.unit.conftest import DEMO_USER
from tests.unit.privacy.conftest import RepositoryTap


def test_admin_overview_counts_academic_records_per_kind(container: Container, tap: RepositoryTap) -> None:
    tap.repos.academic_records.save(DEMO_USER, RecordKind.PROGRAM, "prg_1", {"name": "A"})
    tap.repos.academic_records.save(DEMO_USER, RecordKind.PROGRAM, "prg_2", {"name": "B"})
    overview = container.admin_overview.get(admin(container), DEMO_USER)
    assert [(item.kind, item.count) for item in overview.academic_records] == [(RecordKind.PROGRAM, 2)]
