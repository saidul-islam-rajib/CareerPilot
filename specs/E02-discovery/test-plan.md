# E02 Discovery — Test plan

| Acceptance criterion | Test type | Test file | Status |
|---|---|---|---|
| Real check updates listings and source health | Unit | `services/core/tests/unit/discovery/test_discovery.py` | Passing |
| Unconfigured source refused | Unit | `test_discovery.py`, `tests/unit/administration/test_admin_services.py` | Passing |
| Failed and partial checks | Unit | `test_discovery.py::test_source_health_follows_check_outcomes` | Passing |
| No new opportunity on URL/format change; source links grouped | Unit | `test_discovery.py::test_same_opportunity_on_two_sources_is_grouped` | Passing |
| Content changes archived | Unit | `test_discovery.py::test_rerun_is_unchanged_and_content_changes_are_archived` | Passing |
| Warning signs with reasons | Unit | `test_discovery.py::test_warning_signs_are_specific` | Passing |
| Safe XML parsing | Unit | `test_discovery.py::test_rss_connector_rejects_unsafe_or_broken_xml` | Passing |
