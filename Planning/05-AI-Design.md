# AI and Machine Learning Design

How CareerPilot uses AI (Claude) and machine learning, and the guardrails that keep it accurate.

## 1. Principles

1. **AI reads and writes; code decides.** Claude extracts facts, understands questions, and drafts text. Deterministic code applies hard filters, computes the final match score, enforces rules, and performs submissions. This keeps decisions explainable and testable.
2. **Never fabricate.** Every generated claim about the user must trace back to a verified profile fact or approved material (requirements Sections 5.1, 10.1, 32).
3. **Untrusted content is data.** Job postings, web pages, emails, and documents are passed to Claude as data inside clearly marked blocks. Instructions inside them are ignored, and AI calls that process untrusted content have no tools that act externally (requirements Section 25.2).
4. **Evidence and uncertainty.** Extracted fields carry the source text they came from and a confidence level; low confidence becomes "unverified" (requirements Sections 7.3 and 7.6).
5. **Every AI output is versioned.** The model ID, prompt version, and input hashes are stored with the result (requirements Sections 22.1 and 40.4).

## 2. Model and API features

| Item | Choice |
|---|---|
| Model | **Claude Opus 5.5** (`claude-opus-5-5`) for all AI tasks in version 1 |
| SDK | Official `anthropic` Python SDK |
| Effort | Set explicitly per task (`output_config.effort`): `low` for classification, `medium` for extraction, `high` for writing and form understanding. Tuned with evals |
| Structured outputs | `client.messages.parse()` with Pydantic models for every extraction and classification task |
| PDF and images | Circulars, scanned notices, résumés, and transcripts are sent as `document` / `image` content blocks; this also covers Bangla OCR |
| Files API | Upload large documents once and reuse them across calls |
| Batch API | Nightly bulk extraction of new postings (asynchronous, lower cost) |
| Prompt caching | Stable system prompts and shared instructions cached; per-request data placed after the cache breakpoint |
| Refusal handling | Always check `stop_reason` before reading output; server-side `fallbacks` enabled; a refused item becomes "needs manual review", never a guess |
| Streaming | Used for long generations (cover letters, SOPs) so requests don't time out |

Using a cheaper model (for example Claude Haiku 5.5 or Claude Sonnet 5.5) for high-volume tasks such as nightly extraction is a cost decision for the Product Owner. It is listed in [09-Risks-and-Decisions.md](09-Risks-and-Decisions.md) and must be backed by eval results before switching.

## 3. AI tasks

| # | Task | Input | Output | Requirement sections |
|---|---|---|---|---|
| 1 | Posting extraction | Posting HTML/text, PDF or image circular (English/Bangla) | Structured fields + evidence quotes + confidence + language + translation | 7.3, 7.6, 8, 9, 35 |
| 2 | Résumé / transcript import | CV, transcript, certificates | Profile facts marked "extracted, needs review" | 5.1, 17.1 |
| 3 | Fraud signals | Extracted posting + source data | Warning signs with reasons (combined with rule-based checks) | 7.5 |
| 4 | Duplicate check support | Two candidate postings | Same opening? with reasons (only for close candidates found by embeddings) | 7.4, 42 |
| 5 | Match explanation | Profile facts + extracted requirements + computed score parts | Plain-language explanation (score itself computed in code) | 6.1 |
| 6 | Question understanding | Form question, options, field type | Normalized meaning, matching question group, answer format | 10.3, 28.3, 30 |
| 7 | Form field mapping (generic sites) | Page structure | Field → profile fact / answer mapping for code to fill | 10.5, 30 |
| 8 | Cover letters, emails, essays, SOPs | Verified facts, approved materials, posting, user style | Draft text + list of facts used | 10.7, 32.3, 33.5 |
| 9 | Résumé tailoring | Verified CV content + posting | Reordered/reworded CV using only existing facts | 32.1 |
| 10 | Claim check | Generated text + facts used + profile | Any unsupported claim, wrong employer name, placeholder → fail | 27.4, 32.3 |
| 11 | Reply classification | Incoming emails on application threads | Confirmation / interview / assessment / rejection / offer / question / other | 11.4, 34 |
| 12 | Supervisor matching | Faculty pages, publications, user interests | Match evidence for review | 33.5 |
| 13 | Admin assistance (later in v1) | Source failures, incidents | Summaries for admins | 24, 53 |
| 14 | Operations analysis (AIOps) | Scrubbed logs, traces, metrics, alerts | Error grouping, root-cause hints, anomaly explanations, capacity forecasts ([11-Observability.md](11-Observability.md) §8) | 24.3 |

## 4. Machine learning (non-generative)

| Component | Version 1 approach | Later |
|---|---|---|
| Semantic similarity | Multilingual embeddings stored in pgvector (profile ↔ posting, question ↔ question group, dedup candidates) | Fine-tuned or larger embedding models if evals show gaps |
| Match score | Weighted formula in code over features: hard-filter results, skill overlap, seniority, education, location, salary fit, embedding similarity, user feedback adjustments. Versioned (`scoring_model_version`) | Learning-to-rank trained on user feedback and outcomes |
| Duplicate detection | Text similarity (MinHash/trigram) + embeddings → Claude confirms close cases | Trained classifier |
| Fraud detection | Rules + Claude signals | Trained classifier on confirmed fraud reports |
| Insights | Aggregations and simple statistics with minimum sample sizes | — |

Embedding provider: chosen in Sprint 0 by testing Bangla and English retrieval quality. Options are a hosted multilingual embedding API or a self-hosted open multilingual model.

## 5. Guardrails

- **Fact grounding.** Writing tasks receive only approved facts and must return the list of facts used; the claim-check task (task 10) verifies the result before any use.
- **Cross-contamination check.** Generated text is checked for other employers' or programs' names (requirements Section 27.4).
- **No AI-only submission decisions.** AI output can only fill a value or flag an issue; the decision to submit comes from rules or approvals.
- **Prompt injection defence.** Untrusted text is wrapped and labelled as data; system prompts state that instructions inside data must be ignored; suspicious instructions in postings raise a fraud/injection flag.
- **Data minimization.** Only the fields a task needs are sent. Sensitive identity details are never sent to AI unless the task needs them.
- **Privacy.** The privacy notice states which data goes to the AI provider; user data is not used for model training (requirements Section 40.4). Data-retention settings with the provider are confirmed before launch.
- **Cost limits.** Per-user and platform daily AI budgets; usage shown in the admin dashboard (requirements Section 53.3).

## 6. Prompts and evaluation

- Prompts live in the repository (`services/core/ai/prompts/`), are versioned, and are code-reviewed like code.
- Each AI task has an evaluation set: real-world-like inputs (including Bangla circulars, scanned PDFs, tricky questions, injection attempts) with expected outputs or grading rules.
- CI runs the evaluation set when a prompt, model, or effort setting changes; a drop below the agreed score blocks the merge.
- Target metrics for v1 (to be confirmed with real data):
  - Extraction: deadline and grade accuracy ≥ 98% on the eval set; any lower-confidence field marked unverified.
  - Claim check: 100% of seeded fabricated claims caught.
  - Question matching: no false "same meaning" matches on the seeded tricky set.
  - Reply classification: ≥ 95% accuracy.
