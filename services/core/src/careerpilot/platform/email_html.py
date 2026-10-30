from dataclasses import dataclass
from html import escape


@dataclass(frozen=True)
class EmailLink:
    label: str
    url: str


EmailBlock = str | EmailLink


def _block(block: EmailBlock) -> str:
    if isinstance(block, EmailLink):
        return f'<p><strong><a href="{escape(block.url, quote=True)}">{escape(block.label)}</a></strong></p>'
    return f"<p>{escape(block)}</p>"


def render_html(language: str, blocks: list[EmailBlock]) -> str:
    body = "".join(_block(block) for block in blocks if block)
    return f'<!doctype html><html lang="{escape(language, quote=True)}"><head><meta charset="utf-8"></head><body>{body}</body></html>'
