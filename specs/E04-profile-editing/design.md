# E04 Profile editing — Design

## Data

- `Profile`: id, full_name, headline, location, summary, photo (file reference, served as signed `photoUrl`), completeness, completeness_items, contacts, skills, sections, documents.
- `Contact` gains `deleted_at`.
- `ProfileEntry` (generic, metadata-driven): id, position, values, updated_at, deleted_at. Experience and education became sections; legacy documents are upgraded on read.
- `ProfileDocument`: id, name, kind (`DocumentKind`), position, current version (file name, content type, size, uploaded_at), versions history, deleted_at; served with a signed `url`.

## Configuration (`config/defaults/profile.yaml`, read by backend and apps)

- `profile.sections[]`: key, icon, title/subtitle/body/period fields, fields[] (key, type `ProfileFieldType`, required, max_length, min/max, options = enum key).
- `profile.limits`, `profile.uploads` (max bytes, accepted types), `profile.completeness[]` (kind `CompletenessKind`, optional section, weight), `profile.storage` (root, signed URL TTL).

## API (user API, every mutation returns the full profile)

| Method | Path | Purpose |
|---|---|---|
| PATCH | /v1/profile | basics |
| PUT / DELETE | /v1/profile/photo | upload (multipart) / remove photo |
| POST | /v1/profile/contacts | add contact |
| PATCH / DELETE | /v1/profile/contacts/{id} | edit / remove |
| POST | /v1/profile/contacts/{id}/restore | undo removal |
| PUT | /v1/profile/skills | replace ordered skills |
| POST | /v1/profile/sections/{section} | add entry |
| PATCH / DELETE | /v1/profile/sections/{section}/{id} | edit / remove entry |
| POST | /v1/profile/sections/{section}/{id}/restore | undo removal |
| PUT | /v1/profile/sections/{section}/order | reorder |
| POST | /v1/profile/documents | upload new document (multipart: file, name, kind) |
| POST | /v1/profile/documents/{id}/versions | upload new version |
| PATCH / DELETE | /v1/profile/documents/{id} | rename or change kind / remove |
| POST | /v1/profile/documents/{id}/restore | undo removal |
| PUT | /v1/profile/documents/order | reorder |
| GET | /v1/files/{key}?expires&signature | signed file download |

## Files

`FileStorage` port (`LocalFileStorage` now; S3/MinIO adapter later). Keys are random; content type is detected from magic bytes; links are HMAC-signed with an expiry.

## UI

- Web: header card (photo editor, completeness ring, next best item), sticky section index (chips on phones, column on desktop), generic entry cards with drag handle and Move up/down, form dialog that becomes a bottom sheet on phones, skills chip editor, document list with drop zone, viewer, versions, and undo toasts.
- Mobile: same sections; edit screens per section rendered from the same definitions; document picker and image picker.
