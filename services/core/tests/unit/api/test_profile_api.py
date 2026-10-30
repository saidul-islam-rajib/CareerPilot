from datetime import timedelta
from urllib.parse import urlsplit

import pytest
from fastapi.testclient import TestClient

from careerpilot.api.user_app import create_user_app
from careerpilot.bootstrap import Container
from careerpilot.platform.clock import FixedClock
from careerpilot.platform.files import sample_pdf

PASSWORD = "admin@sober.com"
PDF_BYTES = sample_pdf("My CV")
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


@pytest.fixture
def client(container: Container) -> TestClient:
    return TestClient(create_user_app(container))


@pytest.fixture
def headers(client: TestClient) -> dict[str, str]:
    token = client.post("/v1/auth/sign-in", json={"email": "admin@sober.com", "password": PASSWORD}).json()["accessToken"]
    return {"Authorization": f"Bearer {token}"}


def relative(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.path}?{parts.query}"


def test_profile_is_returned_with_sections_and_signed_document_links(client: TestClient, headers: dict[str, str]) -> None:
    body = client.get("/v1/profile", headers=headers).json()
    assert {"experience", "education"} <= set(body["sections"])
    assert body["sections"]["experience"][0]["values"]["title"] == "Frontend Engineer"
    document = body["documents"][0]
    assert document["file"]["contentType"] == "application/pdf"
    assert "key" not in document["file"]
    download = client.get(relative(document["file"]["url"]))
    assert download.status_code == 200
    assert download.headers["content-type"] == "application/pdf"
    assert download.headers["content-disposition"].startswith("inline; filename*=UTF-8''")
    assert download.content.startswith(b"%PDF-")


def test_file_links_stay_the_same_between_refreshes_so_players_keep_playing(
    client: TestClient, headers: dict[str, str], clock: FixedClock, container: Container
) -> None:
    storage = container.settings.profile.storage
    reuse = storage.signed_url_reuse_seconds
    clock.advance(timedelta(seconds=reuse - (int(clock.now().timestamp()) + storage.signed_url_ttl_seconds) % reuse))
    first = client.get("/v1/profile", headers=headers).json()["documents"][0]["file"]["url"]
    clock.advance(timedelta(seconds=reuse - 1))
    assert client.get("/v1/profile", headers=headers).json()["documents"][0]["file"]["url"] == first
    clock.advance(timedelta(seconds=1))
    assert client.get("/v1/profile", headers=headers).json()["documents"][0]["file"]["url"] != first


def test_files_answer_byte_range_requests_for_audio_players(client: TestClient, headers: dict[str, str]) -> None:
    url = relative(client.get("/v1/profile", headers=headers).json()["documents"][0]["file"]["url"])
    whole = client.get(url)
    assert whole.headers["accept-ranges"] == "bytes"
    size = len(whole.content)
    first = client.get(url, headers={"Range": "bytes=0-1"})
    assert first.status_code == 206
    assert first.content == whole.content[:2]
    assert first.headers["content-range"] == f"bytes 0-1/{size}"
    rest = client.get(url, headers={"Range": "bytes=5-"})
    assert rest.content == whole.content[5:]
    tail = client.get(url, headers={"Range": "bytes=-3"})
    assert tail.content == whole.content[-3:]
    beyond = client.get(url, headers={"Range": f"bytes={size}-"})
    assert beyond.status_code == 416
    assert beyond.headers["content-range"] == f"bytes */{size}"
    assert client.get(url, headers={"Range": "lines=1-2"}).content == whole.content


def test_file_links_cannot_be_tampered_with_or_reused_after_expiry(
    client: TestClient, headers: dict[str, str], clock: FixedClock, container: Container
) -> None:
    url = relative(client.get("/v1/profile", headers=headers).json()["documents"][0]["file"]["url"])
    assert client.get(url.replace("signature=", "signature=0")).status_code == 404
    assert "doc-cv-v3" in url
    assert client.get(url.replace("doc-cv-v3", "doc-cv-v2")).status_code == 404
    storage = container.settings.profile.storage
    clock.advance(timedelta(seconds=storage.signed_url_ttl_seconds + storage.signed_url_reuse_seconds + 1))
    assert client.get(url).status_code == 404


def test_documents_upload_as_multipart_and_reject_other_types(client: TestClient, headers: dict[str, str]) -> None:
    created = client.post(
        "/v1/profile/documents",
        headers=headers,
        files={"file": ("Ayesha CV.pdf", PDF_BYTES, "application/pdf")},
        data={"name": "Remote CV", "kind": "cv"},
    )
    assert created.status_code == 200
    document = next(d for d in created.json()["documents"] if d["name"] == "Remote CV")
    assert (document["version"], document["kind"], document["file"]["sizeBytes"]) == (1, "cv", len(PDF_BYTES))

    versioned = client.post(f"/v1/profile/documents/{document['id']}/versions", headers=headers, files={"file": ("v2.pdf", PDF_BYTES)})
    assert [v["version"] for v in next(d for d in versioned.json()["documents"] if d["id"] == document["id"])["versions"]] == [2, 1]

    disguised = client.post(
        "/v1/profile/documents", headers=headers, files={"file": ("cv.pdf", b"<html>not a pdf</html>", "application/pdf")}
    )
    assert disguised.status_code == 422
    assert (disguised.json()["code"], disguised.json()["detail"]) == ("validation", "file_type")

    removed = client.delete(f"/v1/profile/documents/{document['id']}", headers=headers)
    assert document["id"] not in {d["id"] for d in removed.json()["documents"]}
    restored = client.post(f"/v1/profile/documents/{document['id']}/restore", headers=headers)
    assert document["id"] in {d["id"] for d in restored.json()["documents"]}


def test_photo_upload_returns_a_signed_photo_link(client: TestClient, headers: dict[str, str]) -> None:
    body = client.put("/v1/profile/photo", headers=headers, files={"file": ("me.png", PNG_BYTES, "image/png")}).json()
    assert "/v1/files/photos/" in body["photoUrl"]
    image = client.get(relative(body["photoUrl"]))
    assert (image.status_code, image.headers["content-type"]) == (200, "image/png")
    assert client.delete("/v1/profile/photo", headers=headers).json().get("photoUrl") is None


def test_photo_crop_chooses_what_the_avatar_shows(client: TestClient, headers: dict[str, str]) -> None:
    face = {"x": 0.25, "y": 0.05, "width": 0.5, "height": 0.3333333}
    assert (
        client.put("/v1/profile/photo", headers=headers, files={"file": ("me.png", PNG_BYTES, "image/png")}).json().get("photoCrop") is None
    )
    framed = client.put("/v1/profile/photo/crop", headers=headers, json=face).json()
    assert framed["photoCrop"] == {"x": 0.25, "y": 0.05, "width": 0.5, "height": 0.333333}
    rounding = client.put("/v1/profile/photo/crop", headers=headers, json={"x": 0.5000001, "y": 0, "width": 0.5, "height": 1})
    assert rounding.json()["photoCrop"]["width"] == pytest.approx(0.5)
    for outside in (
        {"x": 0.6, "y": 0, "width": 0.5, "height": 0.5},
        {"x": -0.1, "y": 0, "width": 0.5, "height": 0.5},
        {"x": 0, "y": 0, "width": 0, "height": 0.5},
    ):
        assert client.put("/v1/profile/photo/crop", headers=headers, json=outside).status_code == 422
    replaced = client.put("/v1/profile/photo", headers=headers, files={"file": ("new.png", PNG_BYTES, "image/png")}).json()
    assert replaced.get("photoCrop") is None
    client.delete("/v1/profile/photo", headers=headers)
    assert client.put("/v1/profile/photo/crop", headers=headers, json=face).status_code == 404


def test_basics_contacts_skills_and_sections_round_trip(client: TestClient, headers: dict[str, str]) -> None:
    basics = client.patch("/v1/profile", headers=headers, json={"headline": "Senior frontend engineer", "location": "Dhaka, Bangladesh"})
    assert (basics.json()["headline"], basics.json()["location"]) == ("Senior frontend engineer", "Dhaka, Bangladesh")

    contact = client.post("/v1/profile/contacts", headers=headers, json={"kind": "phone", "value": "+8801700000000", "label": "Office"})
    added = contact.json()["contacts"][-1]
    assert (added["value"], added["isPrimary"], added["verified"]) == ("+8801700000000", False, False)
    edited = client.patch(f"/v1/profile/contacts/{added['id']}", headers=headers, json={"label": "Desk"})
    assert edited.json()["contacts"][-1]["label"] == "Desk"
    assert added["id"] not in {c["id"] for c in client.delete(f"/v1/profile/contacts/{added['id']}", headers=headers).json()["contacts"]}

    skills = client.put("/v1/profile/skills", headers=headers, json={"skills": ["Go", "go", "Rust"]})
    assert skills.json()["skills"] == ["Go", "Rust"]

    entry = client.post(
        "/v1/profile/sections/languages", headers=headers, json={"values": {"language": "English", "proficiency": "fluent"}}
    )
    language = entry.json()["sections"]["languages"][-1]
    assert language["values"] == {"language": "English", "proficiency": "fluent"}
    invalid = client.post("/v1/profile/sections/languages", headers=headers, json={"values": {"language": ""}})
    assert (invalid.status_code, invalid.json()["detail"]) == (422, "languages.language")
    assert client.post("/v1/profile/sections/nope", headers=headers, json={"values": {}}).status_code == 404
    gone = client.delete(f"/v1/profile/sections/languages/{language['id']}", headers=headers)
    assert language["id"] not in {e["id"] for e in gone.json()["sections"]["languages"]}


def test_password_change_endpoint(client: TestClient, headers: dict[str, str]) -> None:
    wrong = client.post("/v1/account/password", headers=headers, json={"currentPassword": "nope", "newPassword": "N3w!Password99"})
    assert wrong.status_code == 401
    changed = client.post("/v1/account/password", headers=headers, json={"currentPassword": PASSWORD, "newPassword": "N3w!Password99"})
    assert changed.status_code == 204
    assert client.post("/v1/auth/sign-in", json={"email": "admin@sober.com", "password": "N3w!Password99"}).status_code == 200


def test_cors_allows_deletes_and_config_exposes_profile_definitions(client: TestClient) -> None:
    preflight = client.options(
        "/v1/profile/photo",
        headers={"Origin": "http://localhost:4320", "Access-Control-Request-Method": "DELETE"},
    )
    assert "DELETE" in preflight.headers.get("access-control-allow-methods", "")
    profile = client.get("/v1/config").json()["profile"]
    assert profile["sections"][0]["fields"][0] == {"key": "title", "type": "text", "required": True, "maxLength": 120}
    assert profile["uploads"]["documentTypes"] == ["application/pdf"]
