import re
from collections.abc import Mapping, Sequence

from careerpilot.candidate.models import QuestionAnswer, SavedAnswer
from careerpilot.candidate.ports import CandidateWorkspace
from careerpilot.platform.enums import AnswerSource, AnswerTopic, ApprovalState

NON_WORD = re.compile(r"[^\w\s]+")
SPACES = re.compile(r"\s+")
TopicKeywords = Mapping[AnswerTopic, Sequence[str]]


def normalise(question: str) -> str:
    return SPACES.sub(" ", NON_WORD.sub(" ", question.lower())).strip()


def detect_topic(question: str, keywords: TopicKeywords) -> AnswerTopic:
    text = normalise(question)
    for topic, words in keywords.items():
        if any(normalise(word) in text for word in words):
            return topic
    return AnswerTopic.OTHER


def group_key(topic: AnswerTopic, question: str) -> str:
    return topic.value if topic is not AnswerTopic.OTHER else f"{topic.value}:{normalise(question)}"


def saved_key(answer: SavedAnswer) -> str:
    return group_key(answer.topic, answer.question)


def active_saved(workspace: CandidateWorkspace) -> list[SavedAnswer]:
    return [a for a in workspace.saved_answers if a.deleted_at is None]


def question_key(item: QuestionAnswer, keywords: TopicKeywords) -> str:
    return group_key(detect_topic(item.question, keywords), item.question)


def fill_blank_answers(workspace: CandidateWorkspace, keywords: TopicKeywords) -> int:
    saved = {saved_key(a): a for a in active_saved(workspace)}
    filled = 0
    for approval in workspace.approvals:
        if approval.state is not ApprovalState.PENDING:
            continue
        for item in approval.materials.answers:
            match = saved.get(question_key(item, keywords))
            if not item.answer.strip() and match is not None:
                item.answer = match.answer
                item.source = AnswerSource.SAVED
                filled += 1
    return filled


def has_blank_answers(answers: Sequence[QuestionAnswer]) -> bool:
    return any(not item.answer.strip() for item in answers)
