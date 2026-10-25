# E04 Profile editing — Requirements

**Requirement IDs:** §5 Profile (master profile, contacts, documents, ordering), §5.5 Ordering, §27.3 User-only steps, Planning/16-UX-Design.md §5a–5d

## User stories

- As a job seeker, I can update every part of my profile myself: name, headline, location, summary, photo, contacts, skills, every profile section, and my documents.
- As a job seeker, I can upload my CV and other documents as PDF files, replace them with new versions, rename them, view them, and remove them.
- As a job seeker, I can reorder contacts, entries, skills, and documents, and undo a removal.

## Acceptance criteria

- WHEN I edit my basics (name, headline, location, summary) THE SYSTEM SHALL validate them and save them immediately.
- WHEN I add, edit, or remove a contact THE SYSTEM SHALL validate its format (email or phone), keep exactly one primary contact per kind, and reset verification when the value changes.
- WHEN I add, edit, reorder, or remove an entry in any profile section (experience, education, languages, tests and scores, certifications, projects, links, awards, referees) THE SYSTEM SHALL validate it against that section's field definitions from configuration (required fields, lengths, formats, date order).
- WHEN I remove a contact, entry, or document THE SYSTEM SHALL keep it as deleted (never physically delete) and let me restore it.
- WHEN I upload a document THE SYSTEM SHALL accept only PDF files within the configured size (checked by content, not by name), store it privately, and keep earlier versions when I upload a new one.
- WHEN I upload a profile photo THE SYSTEM SHALL accept only JPEG, PNG, or WebP images within the configured size.
- THE SYSTEM SHALL serve files only through short-lived signed links.
- THE SYSTEM SHALL show profile completeness computed from configured weights, and the next most useful item to add.
- THE profile screens SHALL work from small phones to desktop, with drag and drop plus a keyboard and button alternative wherever order matters.
