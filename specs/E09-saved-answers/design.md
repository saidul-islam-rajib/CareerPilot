# E09 Saved answers and question bank — Design

- Enums: `AnswerTopic` (work_authorization, sponsorship, notice_period, start_date, salary_expectation, relocation, experience, eligibility, other); `AnswerSource.SAVED`. Metadata rows in `enum-values.seed.ts`.
- Config `config/defaults/answers.yaml`: `question_max_length`, `max_saved_answers`, ordered `topic_keywords`.
- `candidate.answer_rules`: `normalise`, `detect_topic`, `group_key`, `upsert_saved_answer`, `fill_blank_answers`.
- Model: `SavedAnswer` in `CandidateWorkspace.saved_answers` (soft delete); views `QuestionGroup`, `QuestionBank(saved, groups)`.
- `AnswerService`: `bank`, `save`, `remove`, `restore`. `ApprovalService.update_answer(..., save_for_reuse)`; `approve` refuses blank answers (`unanswered_questions`); `approve_by_rule` leaves such approvals pending.
- API: `GET/POST /v1/answers`, `PUT/DELETE /v1/answers/{id}`, `POST /v1/answers/{id}/restore`; approval answer body gains `saveForReuse`.
- Clients: `AnswersApi`; hooks `useQuestionBank`, `useSavedAnswerForm`; web page `/settings/answers`, mobile screens `settings/answers` and `settings/answer`; approval answer editors get a "save for reuse" checkbox.
