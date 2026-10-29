from collections import Counter
from collections.abc import Iterable

from careerpilot.platform.config import SkillGapConfig
from careerpilot.platform.phrases import PhraseHit, PhraseIndex, phrase_key


class SkillCatalog:
    def __init__(self, config: SkillGapConfig) -> None:
        self._config = config
        self._index = PhraseIndex(config.vocabulary)

    def find(self, text: str) -> list[PhraseHit]:
        return self._index.find(text)

    def known(self, skills: Iterable[str]) -> set[str]:
        owned: set[str] = set()
        for skill in skills:
            owned.add(phrase_key(skill))
            owned.update(hit.name for hit in self.find(skill))
        return owned

    def missing(self, skills: Iterable[str], title: str, description: str) -> list[str]:
        owned = self.known(skills)
        weights: Counter[str] = Counter()
        first_seen: dict[str, int] = {}
        for hit in self.find(title):
            weights[hit.name] += self._config.title_weight
            first_seen.setdefault(hit.name, -1)
        for hit in self.find(description):
            weights[hit.name] += 1
            first_seen.setdefault(hit.name, hit.position)
        absent = [name for name in weights if name not in owned and phrase_key(name) not in owned]
        absent.sort(key=lambda name: (-weights[name], first_seen[name]))
        return absent[: self._config.limit]
