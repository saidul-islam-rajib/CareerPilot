from collections import Counter
from dataclasses import dataclass

from careerpilot.platform.config import ClassificationConfig
from careerpilot.platform.enums import WorkArrangement
from careerpilot.platform.phrases import PhraseHit, PhraseIndex

SINGLE_WORD = 1
ARRANGEMENT_ORDER = (WorkArrangement.HYBRID, WorkArrangement.REMOTE, WorkArrangement.ONSITE)


@dataclass(frozen=True)
class Placement:
    work_arrangement: str
    country_code: str


class ListingClassifier:
    def __init__(self, config: ClassificationConfig) -> None:
        self._scan_chars = config.scan_chars
        self._arrangements = PhraseIndex({kind.value: config.arrangements.get(kind.value, []) for kind in ARRANGEMENT_ORDER})
        self._places = PhraseIndex(config.places)

    def classify(self, title: str, location: str, description: str, known: Placement) -> Placement:
        headline = f"{title} . {location}"
        body = description[: self._scan_chars]
        country = known.country_code or self._country(location, f"{title} {body}")
        arrangement = known.work_arrangement
        if arrangement == WorkArrangement.NOT_STATED.value:
            arrangement = self._arrangement(headline, body) or (WorkArrangement.ONSITE.value if country else arrangement)
        return Placement(work_arrangement=arrangement, country_code=country)

    def _arrangement(self, headline: str, body: str) -> str:
        named = {hit.name for hit in self._arrangements.find(headline)}
        named = named or {hit.name for hit in self._arrangements.find(body) if hit.width > SINGLE_WORD}
        return next((kind.value for kind in ARRANGEMENT_ORDER if kind.value in named), "")

    def _country(self, location: str, text: str) -> str:
        placed = self._places.find(location)
        if placed:
            return placed[0].name
        return most_mentioned(self._places.find(text))


def most_mentioned(hits: list[PhraseHit]) -> str:
    counts = Counter(hit.name for hit in hits)
    return counts.most_common(1)[0][0] if counts else ""
