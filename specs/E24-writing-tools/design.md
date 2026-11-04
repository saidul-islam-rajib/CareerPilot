# E24 Writing tools — Design

## Decisions (recorded per CLAUDE.md "make the recommended choice")

- **Module:** `services/core/src/careerpilot/writing/` — `enums`, `config`, `models`, `facts`, `claims`, `contamination`, `checks`, `service`, `assembly`, `ports`, `adapters/` (template, Anthropic, in-memory and SQL repositories). Routes in `api/writing_routes.py`; config in `config/defaults/writing.yaml`; prompt in `config/prompts/writing-v1.md`; all user-facing and template text in the `writing.*` catalog.
- **Swappable writer:** `DraftGenerator` port (`model`, `supports(kind)`, `generate(request)`). `AnthropicWriter` is built only when `ANTHROPIC_API_KEY` is set and `writing.mode` is `auto`; `TemplateWriter` is always built. Tests inject a fake through `ContainerOverrides.ai_writer` and never reach the network.
- **Models (Planning/05 cost guidance):** drafting defaults to `claude-sonnet-5-5` for all four kinds, set per kind in config (Opus and Haiku IDs are valid values). Sonnet and Opus 5.x use `thinking: {type: "adaptive"}` (`adaptive_thinking` per kind), never `budget_tokens`. Output is streamed (`messages.stream`, final message read once). `effort`, `max_tokens` and word limits are config.
- **Refusal and errors:** `stop_reason == "refusal"` becomes `GenerationRefusedError`; rate limit, status, connection errors and empty output become `GenerationUnavailableError`. The service falls back to the template when the kind supports it.
- **Facts:** `build_facts(profile)` returns name, headline, summary, location, one fact per skill and one per active profile entry (contacts are never sent). Each fact has anchors (its short values) used to report "facts used" for any text, including text the user edited. The writer only receives facts, so it cannot see other data.
- **Claim check (deterministic, both writers):** per sentence, unsupported terms are numbers not in the facts (a number from the posting is accepted only in a sentence without first-person words), capitalized words mid-sentence that are in neither the facts, the opportunity, the heading words nor `neutral_words`, skills from the skill vocabulary (`matching.skill_gap`) that the facts do not contain, and `claim_terms` (degrees, awards, "led", "managed", and so on) absent from the facts. This is conservative on purpose: a false flag costs one edit, a missed claim breaks the "never fabricate" rule. A later AI claim check can be added behind the same `WritingChecker`.
- **Cross-contamination:** names and application addresses of every other opportunity in the catalogue, minus the target and minus any name that is in the user's own facts (a former employer is legitimate), matched on word boundaries. Government circulars are in the same catalogue.
- **Other checks:** placeholders (regexes in config), missing target mention (`require_target_mention` per kind), word limit (`max_words` per kind, also the ATS length target for CVs; headings are the standard ones from the catalog).
- **Status:** `ready` (no issues) or `needs_fixes`. Attaching re-runs the checks first so a draft cannot go stale.
- **Versions:** one row per version in `writing_drafts` (`id`, `user_id`, `opportunity_id`, `kind`, `drafted_at`, `document` JSON, standard audit columns and soft delete). Version numbers count per (user, opportunity, kind); edits keep `parent_id`. "Per application" is the opportunity: a member has one pending approval per opportunity.
- **Approval package:** `ApprovalMaterials.writing` (a list of `ApprovalWriting`: kind, draft id, version, source, text) is a snapshot of what was attached; a cover letter also replaces `materials.cover_letter`, so submission code is unchanged. Detaching a cover letter regenerates the default letter.
- **Tone and length:** `professional`, `friendly`, `concise` (catalog templates per tone); the requested word limit is clamped to the kind's maximum. The template writer drops optional paragraphs to fit.
- **Not built (recorded):** employer AI-use policy blocking (REQ-10.7) needs a policy field on opportunities, which does not exist yet; automatic attachment under a rule (REQ-27) stays with the rules work.

## API (`/v1/writing`, signed-in user)

| Method and path | Purpose |
|---|---|
| `GET /status` | provider (`template` or `ai`), `aiConfigured`, model, per-kind availability and limits, tones |
| `GET /drafts?opportunityId&kind` | all versions, newest first |
| `POST /drafts` `{kind, opportunityId, tone?, maxWords?, instructions?}` | write a new draft |
| `GET /drafts/{id}` | one draft |
| `PUT /drafts/{id}` `{text}` | save an edit as a new version |
| `DELETE /drafts/{id}` | detach and soft delete |
| `POST /drafts/{id}/check` | run the checks again |
| `POST /drafts/{id}/strip-flagged` | new version without the flagged sentences |
| `POST /drafts/{id}/attach` `{approvalId}` and `/detach` | add to or remove from a pending approval |

Error details (catalog `writing.errors.*`): `ai_not_configured`, `ai_unavailable`, `ai_refused`, `has_issues`, `approval_closed`, `opportunity_mismatch`, `version_limit`, `nothing_to_write`, `text`, `instructions`.

## Apps

- Web `/writing/{opportunityId}`: status note, kind tabs, tone, word limit and instructions, draft editor with checks and facts used, version list, add to or remove from the application; the approval screen links here and lists attached writing.
- Mobile `writing/{opportunityId}`: the same flow in Expo with theme tokens.
- Admin: no screen needed (REQ-53 has no writing requirement).
