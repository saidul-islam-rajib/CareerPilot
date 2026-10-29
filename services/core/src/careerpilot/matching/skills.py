import re
import unicodedata
from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass

from careerpilot.platform.config import SkillGapConfig

SKILL_TOKEN = re.compile(r"\.?[\w][\w+#.]*[\w+#]|\.?[\w]")

Phrase = tuple[str, ...]


def skill_tokens(text: str) -> list[str]:
    folded = unicodedata.normalize("NFKC", text).casefold()
    return [token.rstrip(".") for token in SKILL_TOKEN.findall(folded)]


@dataclass(frozen=True)
class SkillHit:
    name: str
    position: int


class SkillCatalog:
    def __init__(self, config: SkillGapConfig) -> None:
        self._config = config
        self._index: dict[Phrase, str] = {}
        for name, spellings in config.vocabulary.items():
            for spelling in (name, *spellings):
                phrase = tuple(skill_tokens(spelling))
                if phrase:
                    self._index.setdefault(phrase, name)
        self._longest = max((len(phrase) for phrase in self._index), default=0)

    def find(self, text: str) -> list[SkillHit]:
        tokens = skill_tokens(text)
        hits: list[SkillHit] = []
        start = 0
        while start < len(tokens):
            width = self._longest_match(tokens, start)
            if width:
                hits.append(SkillHit(name=self._index[tuple(tokens[start : start + width])], position=start))
                start += width
            else:
                start += 1
        return hits

    def _longest_match(self, tokens: list[str], start: int) -> int:
        for width in range(min(self._longest, len(tokens) - start), 0, -1):
            if tuple(tokens[start : start + width]) in self._index:
                return width
        return 0

    def known(self, skills: Iterable[str]) -> set[str]:
        owned: set[str] = set()
        for skill in skills:
            owned.add(" ".join(skill_tokens(skill)))
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
        absent = [name for name in weights if name not in owned and " ".join(skill_tokens(name)) not in owned]
        absent.sort(key=lambda name: (-weights[name], first_seen[name]))
        return absent[: self._config.limit]
