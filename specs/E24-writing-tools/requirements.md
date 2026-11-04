# E24 Writing tools — Requirements

**Requirement IDs:** REQ-10.7, REQ-27.4, REQ-32.1, REQ-32.3, REQ-33.5, REQ-25.2; backlog row E12 (`Planning/06-Product-Backlog.md`)

## User stories

- As a job seeker, I want a cover letter or a tailored CV for one opportunity, written only from the facts in my profile, so that I save time without saying anything untrue.
- As a student, I want an essay answer or a statement of purpose drafted from my own background, so that I start from a solid first version.
- As a job seeker, I want every sentence checked against my profile and against my other applications, so that an invented claim or another employer's name never reaches an employer.
- As a job seeker, I want to edit a draft, keep every version, and choose exactly which version goes into the application I approve.
- As a job seeker, I want to know whether a draft was written by AI or from a template, and to be told plainly when AI is not configured.

## Acceptance criteria

- WHEN a signed-in user asks for a cover letter, tailored CV, essay answer or statement for an opportunity THE SYSTEM SHALL create a new draft version from the user's profile facts (name, headline, summary, location, skills, and every active profile entry) and the opportunity's title, organization and description only, honouring the chosen tone, the word limit (never above the kind's configured maximum) and optional instructions.
- THE SYSTEM SHALL write drafts through a swappable writer: Claude (the `anthropic` SDK, models and limits from `config/defaults/writing.yaml`, streamed, adaptive thinking) when `ANTHROPIC_API_KEY` is set and `writing.mode` is `auto`; otherwise a deterministic catalog-template writer that assembles text only from profile facts. Cover letters and tailored CVs are available on both; essays and statements need AI.
- THE SYSTEM SHALL label every draft with its source (template, AI with the model name, or the user) and expose `GET /v1/writing/status` so the apps can show "AI is not configured" and mark AI-only kinds as unavailable.
- WHEN AI is not configured and the user asks for an AI-only kind THE SYSTEM SHALL answer with the `ai_not_configured` code and create nothing; WHEN the AI service is unavailable THE SYSTEM SHALL fall back to the template for cover letters and CVs and answer `ai_unavailable` for the rest; WHEN the AI service refuses THE SYSTEM SHALL answer `ai_refused` and store nothing.
- THE SYSTEM SHALL check every new or edited text, whichever writer produced it, for: unsupported claims (numbers, proper nouns, skills and claim words such as degrees, awards, "led" or "managed" that do not appear in the profile facts), another employer's name or application address (cross-contamination), leftover placeholders, a missing mention of the target organization (kinds that require it), and the word limit.
- WHEN a check finds an issue THE SYSTEM SHALL keep the draft but mark it "needs fixes" with each issue and the exact sentence, SHALL NOT silently remove or rewrite anything, and SHALL refuse to add it to an application until it passes; the user may fix the text, or remove the flagged sentences in one step, which creates a new version.
- THE SYSTEM SHALL keep every draft as a numbered version per member, opportunity and kind; editing, removing flagged sentences or regenerating creates a new version and never overwrites an older one; at most the configured number of versions exist per document.
- WHEN a user adds a passing draft to a pending approval for the same opportunity THE SYSTEM SHALL re-run the checks, copy exactly that text and version into the approval package (the cover letter text for a cover letter; a labelled entry for a CV, essay or statement), and replace an earlier version of the same kind.
- WHEN a user removes a draft from an approval THE SYSTEM SHALL take it out of the package and, for a cover letter, restore the default letter; removing a draft does the same and then soft deletes it.
- THE SYSTEM SHALL show attached writing, with kind, version and source, on the approval screen so the user approves exactly what is shown.
- THE SYSTEM SHALL treat the opportunity text and the user's instructions as untrusted data in AI prompts, send only profile facts (never contact details) and the opportunity, and never log or return the API key.

## Out of scope in version 1

- Language other than English, user-provided templates, automatic attachment without review (rules), export of drafts to DOCX/PDF, and employer AI-use policies (no field holds them yet).
