from careerpilot.integrations.models import Classification
from careerpilot.platform.config import ReplyClassificationConfig, ReplyKindConfig
from careerpilot.platform.enums import ReplyKind


def phrase_score(config: ReplyKindConfig, subject: str, body: str, boost: float) -> float:
    total = 0.0
    for phrase in config.phrases:
        text = phrase.text.lower()
        if text in subject:
            total += phrase.weight * boost
        elif text in body:
            total += phrase.weight
    return total


class RuleBasedClassifier:
    def __init__(self, config: ReplyClassificationConfig) -> None:
        self._config = config

    def classify(self, subject: str, body: str) -> Classification:
        lowered_subject, lowered_body = subject.lower(), body.lower()
        best: Classification | None = None
        best_score = 0.0
        for kind in self._config.kinds:
            score = phrase_score(kind, lowered_subject, lowered_body, self._config.subject_boost)
            if score > best_score:
                best_score = score
                best = Classification(kind.kind, min(1.0, score / self._config.full_score))
        if best is None:
            return Classification(ReplyKind.OTHER_REPLY, self._config.unclassified_confidence)
        return best
