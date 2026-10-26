from datetime import timedelta
from urllib.parse import parse_qs, urlsplit

import pytest

from careerpilot.bootstrap import Container
from careerpilot.candidate.services.auth import Registration
from careerpilot.candidate.services.profile import BasicsChanges, Upload
from careerpilot.platform.clock import FixedClock
from careerpilot.platform.email_delivery import InMemoryEmailSender
from careerpilot.platform.enums import ContactKind, DocumentKind
from careerpilot.platform.errors import DomainError, ErrorCode
from careerpilot.platform.files import sample_pdf
from tests.unit.conftest import CLIENT, DEMO_USER, register_and_activate

PDF_BYTES = sample_pdf("Curriculum vitae")
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
BASE_URL = "http://api.test/"


def detail_of(error: pytest.ExceptionInfo[DomainError]) -> str | None:
    return error.value.detail


def experience(**changes: object) -> dict[str, object]:
    return {"title": "Staff Engineer", "organization": "Kite Commerce", "start": "2024-01", "current": True, **changes}


def test_basics_are_validated_and_synced_to_the_account(container: Container) -> None:
    changes = BasicsChanges(
        full_name="  Ayesha  R. Rahman ", headline="Lead  frontend engineer", location="Dhaka", summary="Line one  \nLine two"
    )
    profile = container.profile.update_basics(DEMO_USER, changes)
    assert (profile.full_name, profile.headline, profile.location, profile.summary) == (
        "Ayesha  R. Rahman",
        "Lead frontend engineer",
        "Dhaka",
        "Line one\nLine two",
    )
    assert container.auth.sign_in("admin@sober.com", "admin@sober.com", CLIENT).user.full_name == "Ayesha  R. Rahman"
    with pytest.raises(DomainError) as short:
        container.profile.update_basics(DEMO_USER, BasicsChanges(full_name="A"))
    assert detail_of(short) == "name"
    with pytest.raises(DomainError):
        container.profile.update_basics(DEMO_USER, BasicsChanges(headline="x" * 161))


def test_contacts_keep_one_primary_per_kind_and_reset_verification(container: Container) -> None:
    profile = container.profile.add_contact(DEMO_USER, ContactKind.EMAIL, " Jobs@Example.com ", "Job hunting")
    added = profile.active_contacts()[-1]
    assert (added.value, added.is_primary, added.verified, added.position) == ("jobs@example.com", False, False, 5)
    with pytest.raises(DomainError) as duplicate:
        container.profile.add_contact(DEMO_USER, ContactKind.EMAIL, "jobs@example.com", "Again")
    assert duplicate.value.code is ErrorCode.CONFLICT
    with pytest.raises(DomainError) as phone:
        container.profile.add_contact(DEMO_USER, ContactKind.PHONE, "call me", "Mobile")
    assert detail_of(phone) == "phone"

    edited = container.profile.update_contact(DEMO_USER, "c_phone_mobile", "+880 1999 000111", "Main")
    phone_contact = next(c for c in edited.active_contacts() if c.id == "c_phone_mobile")
    assert (phone_contact.value, phone_contact.label, phone_contact.verified) == ("+880 1999 000111", "Main", False)

    after_removal = container.profile.remove_contact(DEMO_USER, "c_email_work")
    emails = [c for c in after_removal.active_contacts() if c.kind is ContactKind.EMAIL]
    assert "c_email_work" not in {c.id for c in emails}
    assert [c.id for c in emails if c.is_primary] == ["c_email_personal"]
    assert any(c.id == "c_email_work" and c.deleted_at for c in after_removal.contacts)

    restored = container.profile.restore_contact(DEMO_USER, "c_email_work").active_contacts()
    assert restored[-1].id == "c_email_work"
    assert [c.id for c in restored if c.kind is ContactKind.EMAIL and c.is_primary] == ["c_email_personal"]


def test_skills_are_cleaned_deduplicated_and_limited(container: Container) -> None:
    assert container.profile.set_skills(DEMO_USER, [" React ", "react", "Type  Script", "", "Go"]).skills == ["React", "Type Script", "Go"]
    with pytest.raises(DomainError) as too_many:
        container.profile.set_skills(DEMO_USER, [f"Skill {n}" for n in range(61)])
    assert detail_of(too_many) == "skills"


def test_section_entries_follow_their_definitions(container: Container) -> None:
    profile = container.profile.add_entry(DEMO_USER, "experience", experience(end="2023-01", summary=" Led   things "))
    entry = profile.active_entries("experience")[-1]
    assert entry.values == {
        "title": "Staff Engineer",
        "organization": "Kite Commerce",
        "start": "2024-01",
        "current": True,
        "summary": "Led   things",
    }

    cases = {
        "experience.title": experience(title="  "),
        "experience.end": experience(current=False, end="2023-12"),
        "experience.start": experience(start="2024-13"),
        "experience.bonus": experience(bonus="yes"),
    }
    for expected, values in cases.items():
        with pytest.raises(DomainError) as invalid:
            container.profile.add_entry(DEMO_USER, "experience", values)
        assert detail_of(invalid) == expected

    with pytest.raises(DomainError) as unknown:
        container.profile.add_entry(DEMO_USER, "hobbies", {"name": "Chess"})
    assert unknown.value.code is ErrorCode.NOT_FOUND

    languages = container.profile.add_entry(DEMO_USER, "languages", {"language": "Bangla", "proficiency": "native"})
    assert languages.active_entries("languages")[-1].values == {"language": "Bangla", "proficiency": "native"}
    with pytest.raises(DomainError):
        container.profile.add_entry(DEMO_USER, "languages", {"language": "English", "proficiency": "excellent"})
    with pytest.raises(DomainError):
        container.profile.add_entry(DEMO_USER, "links", {"label": "Site", "url": "javascript:alert(1)"})
    links = container.profile.add_entry(DEMO_USER, "links", {"label": "GitHub", "url": "https://github.com/ayesha"})
    assert links.active_entries("links")[-1].text("url") == "https://github.com/ayesha"


def test_entries_can_be_edited_removed_restored_and_reordered(container: Container) -> None:
    education = container.profile.get(DEMO_USER).active_entries("education")
    first, second = education[0].id, education[1].id
    updated = container.profile.update_entry(
        DEMO_USER, "education", first, {"degree": "BSc in CSE", "institution": "EUT", "start_year": "2016", "end_year": 2020}
    )
    assert updated.active_entries("education")[0].values == {
        "degree": "BSc in CSE",
        "institution": "EUT",
        "start_year": 2016,
        "end_year": 2020,
    }
    with pytest.raises(DomainError) as order:
        container.profile.update_entry(
            DEMO_USER, "education", first, {"degree": "BSc", "institution": "EUT", "start_year": 2021, "end_year": 2020}
        )
    assert detail_of(order) == "education.end_year"

    reordered = container.profile.reorder_entries(DEMO_USER, "education", [second, first]).active_entries("education")
    assert [e.id for e in reordered] == [second, first]
    removed = container.profile.remove_entry(DEMO_USER, "education", second)
    assert [e.id for e in removed.active_entries("education")] == [first]
    with pytest.raises(DomainError):
        container.profile.reorder_entries(DEMO_USER, "education", [first, second])
    restored = container.profile.restore_entry(DEMO_USER, "education", second)
    assert [e.id for e in restored.active_entries("education")] == [first, second]


def test_documents_accept_only_pdfs_and_keep_versions(container: Container) -> None:
    profile = container.profile.add_document(DEMO_USER, Upload("C:\\Users\\me\\Ayesha CV.pdf", PDF_BYTES), None, DocumentKind.CV)
    added = profile.active_documents()[-1]
    assert (added.name, added.kind, added.current.version, added.current.file_name) == ("Ayesha CV", DocumentKind.CV, 1, "Ayesha CV.pdf")
    assert container.files.get(added.current.key) == PDF_BYTES

    for upload, detail in [
        (Upload("cv.pdf", b"MZ\x90\x00 not a pdf"), "file_type"),
        (Upload("photo.png", PNG_BYTES), "file_type"),
        (Upload("empty.pdf", b""), "file_empty"),
        (Upload("huge.pdf", PDF_BYTES + b"0" * container.settings.profile.uploads.max_document_bytes), "file_too_large"),
    ]:
        with pytest.raises(DomainError) as rejected:
            container.profile.add_document(DEMO_USER, upload, "Bad", DocumentKind.OTHER)
        assert detail_of(rejected) == detail

    versioned = container.profile.add_document_version(DEMO_USER, added.id, Upload("Ayesha CV v2.pdf", PDF_BYTES))
    document = next(d for d in versioned.active_documents() if d.id == added.id)
    assert [v.version for v in document.versions] == [1, 2]
    renamed = container.profile.update_document(DEMO_USER, added.id, "CV for remote roles", DocumentKind.COVER_LETTER)
    assert next(d for d in renamed.active_documents() if d.id == added.id).name == "CV for remote roles"

    ids = [d.id for d in renamed.active_documents()]
    assert [d.id for d in container.profile.reorder_documents(DEMO_USER, ids[::-1]).active_documents()] == ids[::-1]
    removed = container.profile.remove_document(DEMO_USER, added.id)
    assert added.id not in {d.id for d in removed.active_documents()}
    assert added.id in {d.id for d in container.profile.restore_document(DEMO_USER, added.id).active_documents()}


def test_photo_accepts_images_only(container: Container) -> None:
    profile = container.profile.set_photo(DEMO_USER, Upload("me.png", PNG_BYTES))
    assert profile.photo is not None and profile.photo.content_type == "image/png"
    with pytest.raises(DomainError) as wrong:
        container.profile.set_photo(DEMO_USER, Upload("me.pdf", PDF_BYTES))
    assert detail_of(wrong) == "file_type"
    cleared = container.profile.remove_photo(DEMO_USER)
    assert (cleared.photo, cleared.photo_url) == (None, None)


def test_view_hides_removed_items_and_signs_file_links(container: Container, clock: FixedClock) -> None:
    container.profile.remove_contact(DEMO_USER, "c_phone_whatsapp")
    profile = container.profile.set_photo(DEMO_USER, Upload("me.png", PNG_BYTES))
    view = container.profile.view(profile, BASE_URL)
    assert "c_phone_whatsapp" not in {c.id for c in view.contacts}
    assert view.photo_url is not None and view.photo_url.startswith(f"{BASE_URL}v1/files/photos/")
    assert {item.key for item in view.completeness_items} >= {"basics", "experience", "documents"}
    assert 0 < view.completeness <= 100

    document = view.documents[0]
    assert (document.version, document.file.content_type) == (3, "application/pdf")
    parts = urlsplit(document.file.url)
    query = {k: v[0] for k, v in parse_qs(parts.query).items()}
    key = parts.path.removeprefix("/v1/files/")
    assert container.file_links.verify(key, int(query["expires"]), query["name"], query["signature"]) is not None
    assert container.file_links.verify(key, int(query["expires"]), "other.pdf", query["signature"]) is None
    assert (container.files.get(key) or b"").startswith(b"%PDF-")
    clock.advance(timedelta(seconds=container.settings.profile.storage.signed_url_ttl_seconds + 1))
    assert container.file_links.verify(key, int(query["expires"]), query["name"], query["signature"]) is None


def test_completeness_rises_as_the_profile_fills_in(container: Container, outbox: InMemoryEmailSender) -> None:
    registration = Registration("Nadia Islam", "nadia@example.com", True, "1.0", "1.0")
    user_id = register_and_activate(container, outbox, registration).user.id
    fresh = container.profile.get(user_id)
    assert fresh.full_name == "Nadia Islam"
    assert [(c.kind, c.value, c.is_primary) for c in fresh.active_contacts()] == [(ContactKind.EMAIL, "nadia@example.com", True)]
    before = container.profile.view(fresh, BASE_URL).completeness
    container.profile.add_entry(user_id, "experience", experience())
    after = container.profile.view(container.profile.get(user_id), BASE_URL).completeness
    assert after - before == 20


def test_password_change_requires_the_current_password(container: Container) -> None:
    with pytest.raises(DomainError) as wrong:
        container.auth.change_password(DEMO_USER, "not-it", "N3w!Password99")
    assert wrong.value.code is ErrorCode.INVALID_CREDENTIALS
    with pytest.raises(DomainError) as weak:
        container.auth.change_password(DEMO_USER, "admin@sober.com", "short")
    assert detail_of(weak) == "password"
    container.auth.change_password(DEMO_USER, "admin@sober.com", "N3w!Password99")
    assert container.auth.sign_in("admin@sober.com", "N3w!Password99", CLIENT).access_token


def test_profiles_created_before_registration_filled_them_are_started_on_read(container: Container, outbox: InMemoryEmailSender) -> None:
    registration = Registration("Rafiq Karim", "rafiq@example.com", True, "1.0", "1.0")
    user_id = register_and_activate(container, outbox, registration).user.id
    workspace = container.profile._ctx.workspaces.get(user_id)
    workspace.profile.full_name = ""
    workspace.profile.contacts = []
    container.profile._ctx.workspaces.save(user_id, workspace)
    started = container.profile.get(user_id)
    assert started.full_name == "Rafiq Karim"
    assert [(c.value, c.is_primary) for c in started.active_contacts()] == [("rafiq@example.com", True)]
