from careerpilot.candidate.models import Profile
from careerpilot.platform.enums import ContactKind
from careerpilot.portal.enums import Fact


def contact_value(profile: Profile, kind: ContactKind) -> str:
    contacts = [c for c in profile.active_contacts() if c.kind is kind]
    primary = next((c.value for c in contacts if c.is_primary), None)
    return primary or (contacts[0].value if contacts else "")


def profile_facts(profile: Profile) -> dict[Fact, str]:
    parts = profile.full_name.split()
    candidates = {
        Fact.FULL_NAME: profile.full_name.strip(),
        Fact.FIRST_NAME: parts[0] if parts else "",
        Fact.LAST_NAME: parts[-1] if len(parts) > 1 else "",
        Fact.EMAIL: contact_value(profile, ContactKind.EMAIL),
        Fact.PHONE: contact_value(profile, ContactKind.PHONE),
        Fact.LOCATION: profile.location.strip(),
        Fact.COUNTRY: profile.country_code.strip(),
        Fact.HEADLINE: profile.headline.strip(),
        Fact.SUMMARY: profile.summary.strip(),
    }
    return {fact: value for fact, value in candidates.items() if value}
