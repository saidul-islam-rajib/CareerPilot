# E09 Saved answers and question bank — Requirements

**Requirement IDs:** §10.1 User control (reusable answers and answer rules), §10.3 (answer sources; common questions), §28.3 Question bank, §16 acceptance 15 (unresolved questions block automatic submission)

## User stories

- As a job seeker, I save answers to questions employers often ask (work authorization, sponsorship, notice period, start date, salary, relocation, experience, eligibility) once, and CareerPilot reuses them.
- As a job seeker, I see every question I have been asked, how often, how I answered, and which questions still need an answer.

## Acceptance criteria

- THE SYSTEM SHALL let the user add, edit, remove (with undo), and restore saved answers, each with a topic, the question, and the answer, within configured limits.
- THE SYSTEM SHALL group questions with the same meaning: questions matching the same configured topic keywords form one group; other questions group by normalised text.
- For each group THE SYSTEM SHALL show the question, how many times it was asked, the last answer and its source, and whether a saved answer exists.
- WHEN a pending approval has a question without an answer THE SYSTEM SHALL list it as "needs an answer"; approving SHALL be refused until every question has an answer, and a rule SHALL NOT approve it automatically.
- WHEN the user saves an answer THE SYSTEM SHALL fill blank questions of the same group in pending approvals with it and mark their source "saved answer"; it SHALL NOT change answers the user or profile already provided.
- WHEN the user answers a question in an approval and chooses "save for reuse" THE SYSTEM SHALL also store it as a saved answer.
- THE SYSTEM SHALL auto-answer only from the user's saved answers (explicitly approved for reuse), never invent answers.
