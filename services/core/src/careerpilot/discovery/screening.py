import re

from careerpilot.discovery.models import RawListing, WarningSign
from careerpilot.discovery.text import normalized
from careerpilot.platform.config import WarningSignConfig

EMAIL = re.compile(r"[\w.+-]+@([\w-]+\.[\w.-]+)")


class WarningSignScreen:
    def __init__(self, config: WarningSignConfig) -> None:
        self._phrases = {
            WarningSign.UPFRONT_FEE: [normalized(p) for p in config.upfront_fee],
            WarningSign.GUARANTEED_OFFER: [normalized(p) for p in config.guaranteed_offer],
            WarningSign.SENSITIVE_DATA_REQUEST: [normalized(p) for p in config.sensitive_data_request],
        }
        self._free_mail = frozenset(d.casefold() for d in config.free_mail_domains)

    def screen(self, listing: RawListing) -> list[WarningSign]:
        text = normalized(f"{listing.title} {listing.description}")
        signs = [sign for sign, phrases in self._phrases.items() if any(phrase in text for phrase in phrases)]
        if any(domain.casefold() in self._free_mail for domain in EMAIL.findall(listing.description)):
            signs.append(WarningSign.PERSONAL_EMAIL_CONTACT)
        return signs
