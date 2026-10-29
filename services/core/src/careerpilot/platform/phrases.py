import re
import unicodedata
from collections.abc import Iterable, Mapping
from dataclasses import dataclass

PHRASE_TOKEN = re.compile(r"\.?[\w][\w+#.]*[\w+#]|\.?[\w]")

Phrase = tuple[str, ...]


def phrase_tokens(text: str) -> list[str]:
    folded = unicodedata.normalize("NFKC", text).casefold()
    return [token.rstrip(".") for token in PHRASE_TOKEN.findall(folded)]


def phrase_key(text: str) -> str:
    return " ".join(phrase_tokens(text))


@dataclass(frozen=True)
class PhraseHit:
    name: str
    position: int
    width: int


class PhraseIndex:
    def __init__(self, vocabulary: Mapping[str, Iterable[str]]) -> None:
        self._index: dict[Phrase, str] = {}
        for name, spellings in vocabulary.items():
            for spelling in (name, *spellings):
                phrase = tuple(phrase_tokens(spelling))
                if phrase:
                    self._index.setdefault(phrase, name)
        self._longest = max((len(phrase) for phrase in self._index), default=0)

    def find(self, text: str) -> list[PhraseHit]:
        tokens = phrase_tokens(text)
        hits: list[PhraseHit] = []
        start = 0
        while start < len(tokens):
            width = self._longest_match(tokens, start)
            if width:
                hits.append(PhraseHit(name=self._index[tuple(tokens[start : start + width])], position=start, width=width))
                start += width
            else:
                start += 1
        return hits

    def _longest_match(self, tokens: list[str], start: int) -> int:
        for width in range(min(self._longest, len(tokens) - start), 0, -1):
            if tuple(tokens[start : start + width]) in self._index:
                return width
        return 0
