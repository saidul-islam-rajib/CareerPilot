from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Generic, TypeVar

from careerpilot.platform.phrases import phrase_tokens

T = TypeVar("T")
GRAM = 3
PAD = "$"


def compact(text: str, ignored: frozenset[str] = frozenset()) -> str:
    return "".join(token for token in phrase_tokens(text) if token not in ignored)


def trigrams(text: str) -> frozenset[str]:
    padded = f"{PAD}{text}{PAD}"
    return frozenset(padded[index : index + GRAM] for index in range(max(1, len(padded) - GRAM + 1)))


def dice(first: frozenset[str], second: frozenset[str]) -> float:
    total = len(first) + len(second)
    return 2 * len(first & second) / total if total else 0.0


def similarity(first: str, second: str, ignored: frozenset[str] = frozenset()) -> float:
    left, right = compact(first, ignored), compact(second, ignored)
    if not left or not right:
        return 0.0
    return 1.0 if left == right else dice(trigrams(left), trigrams(right))


@dataclass(frozen=True)
class Ranked(Generic[T]):
    item: T
    score: float


class TrigramIndex(Generic[T]):
    def __init__(self, entries: Iterable[tuple[str, T]], ignored: frozenset[str] = frozenset()) -> None:
        self._ignored = ignored
        self._grams: list[frozenset[str]] = []
        self._items: list[T] = []
        self._postings: dict[str, list[int]] = {}
        for text, item in entries:
            key = compact(text, ignored)
            if not key:
                continue
            grams = trigrams(key)
            position = len(self._items)
            self._items.append(item)
            self._grams.append(grams)
            for gram in grams:
                self._postings.setdefault(gram, []).append(position)

    def search(self, query: str, threshold: float) -> list[Ranked[T]]:
        key = compact(query, self._ignored)
        if not key:
            return []
        grams = trigrams(key)
        shared: Counter[int] = Counter()
        for gram in grams:
            shared.update(self._postings.get(gram, []))
        ranked = [
            Ranked(self._items[position], 2 * count / (len(grams) + len(self._grams[position]))) for position, count in shared.items()
        ]
        return sorted((entry for entry in ranked if entry.score >= threshold), key=lambda entry: entry.score, reverse=True)

    def best(self, query: str, threshold: float) -> Ranked[T] | None:
        found = self.search(query, threshold)
        return found[0] if found else None
