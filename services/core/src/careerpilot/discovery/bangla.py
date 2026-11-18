from careerpilot.platform.config import BangladeshConfig


def latin_digits(text: str, config: BangladeshConfig) -> str:
    table = {ord(bangla): ord(str(value)) for value, bangla in enumerate(config.bangla_digits)}
    return text.translate(table)
