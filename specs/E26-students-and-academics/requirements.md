# E26 Students and academics — Requirements

**Requirement IDs:** REQ-9, REQ-33.1 to 33.8, REQ-40.2, REQ-40.3, REQ-27.3, REQ-20.2, REQ-38

## User stories

- As a student, I want to track programs and scholarships (taught and research master's, PhD, assistantships, fellowships, exchange, summer school, postdoc) with each requirement labelled explicit, not stated, unclear or conflicting, so that I never rely on an assumed waiver or guaranteed funding.
- As a student, I want separate deadlines (application, early decision, scholarship consideration, funding, referee, supervisor contact, acceptance, deposit) and a plan worked backwards from them, so that tests, documents, referees and the application finish in time.
- As a student, I want an application budget that shows which amounts are official and which are my estimates, so that I can plan the cost.
- As a student, I want my test registrations, dates, scores (as I entered them), score expiry and score reports sent per institution, so that I am warned when a score expires before a deadline or the start date.
- As a student, I want my grades kept in the original scale, and the credential needs of each program (evaluation, certified copy, translation, notarization, sealed transcript), so that conversions are never presented as official.
- As a student, I want referees recorded with my confirmation that each agreed to be listed, and a recommendation record per referee and program, so that no one is listed or invited without agreement and nothing is marked submitted without evidence.
- As a student, I want supervisor outreach drafted from my verified profile and the supervisor's real work, with limits and reply tracking, so that I never send the same generic email to many professors.
- As a student, I want each university portal application tracked as guided manual steps with blockers listed, so that I know what stops submission.
- As a student, I want decisions, conditions, acceptance and deposit deadlines, an offer comparison and an after-admission checklist, so that I can choose and prepare to travel.

## Acceptance criteria

- THE SYSTEM SHALL store every requirement with an evidence status (explicit, not stated, unclear, conflicting) and SHALL NOT treat a missing test requirement as a waiver or advertised funding as guaranteed.
- WHEN the user creates a program from a discovered opportunity of a study type THE SYSTEM SHALL copy its title, organisation, location, country and deadline and link it; the user completes the rest.
- WHEN a scholarship lists related programs THE SYSTEM SHALL keep it as a separate opportunity linked to those programs.
- WHEN a test score expires before a linked program's deadline or start date THE SYSTEM SHALL warn; it SHALL NEVER invent a score, and the expiry comes from the entered release date and the validity in configuration.
- WHEN official scores are recorded as sent to an institution THE SYSTEM SHALL store the date, institution code, fee and whether the institution confirmed; sending itself and any fee are user actions.
- THE SYSTEM SHALL store grades in the original scale and label any conversion as an estimate unless an official source is recorded.
- WHEN a referee has not been confirmed as agreed to be listed THE SYSTEM SHALL refuse to attach the referee to a program, draft a request, record an invitation, or share their details.
- WHEN the user marks a recommendation submitted or received THE SYSTEM SHALL require evidence (institution confirmation or the user's own statement with a note); otherwise it SHALL refuse.
- WHEN a referee reminder or request is prepared THE SYSTEM SHALL return a draft only; the user sends it.
- WHEN a supervisor email is drafted THE SYSTEM SHALL require the supervisor's real work as written by the user, use only profile facts, and refuse when the profile has no name.
- WHEN the user records an email as sent THE SYSTEM SHALL refuse when a daily, per-department or per-university limit is reached, when the supervisor declined or asked not to be contacted, or when the body does not mention the supervisor's work; follow-ups only when allowed and after the configured gap.
- WHEN a supervisor replies positively, asks for a call or asks for documents THE SYSTEM SHALL list it first in the overview as needing attention.
- THE SYSTEM SHALL never send email, submit a portal form, pay a fee or accept an offer; those are guided user steps (REQ-27.3).
- WHEN the user accepts an offer, pays a deposit or declines an offer THE SYSTEM SHALL require an explicit confirmation and only record it; a message draft may be prepared.
- WHEN a program has portal items missing THE SYSTEM SHALL list the blockers (sections, documents, referees without consent, fee due, items the institution must still receive).
- THE SYSTEM SHALL compare offers using stated values; computed totals are labelled estimated, and unknown values stay not stated.
- THE SYSTEM SHALL present after-admission steps with the user's official source link and date and a notice that they are information and not legal or immigration advice.
- THE SYSTEM SHALL keep all records per user with audit columns and soft delete, and keep portal passwords out of the product.
