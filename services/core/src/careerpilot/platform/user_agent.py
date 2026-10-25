from careerpilot.platform.messages import translate

BROWSERS: list[tuple[str, str]] = [
    ("Edg/", "Edge"),
    ("OPR/", "Opera"),
    ("SamsungBrowser/", "Samsung Internet"),
    ("Firefox/", "Firefox"),
    ("Chrome/", "Chrome"),
    ("Safari/", "Safari"),
    ("CareerPilot", "CareerPilot app"),
    ("okhttp", "CareerPilot app"),
    ("Expo", "CareerPilot app"),
]

SYSTEMS: list[tuple[str, str]] = [
    ("Windows", "Windows"),
    ("Android", "Android"),
    ("iPhone", "iOS"),
    ("iPad", "iPadOS"),
    ("Mac OS X", "macOS"),
    ("CrOS", "ChromeOS"),
    ("Linux", "Linux"),
]


def _first_match(user_agent: str, table: list[tuple[str, str]]) -> str | None:
    return next((name for marker, name in table if marker in user_agent), None)


def describe_device(user_agent: str | None) -> str:
    if not user_agent:
        return translate("activity.unknownDevice")
    browser = _first_match(user_agent, BROWSERS)
    system = _first_match(user_agent, SYSTEMS)
    if browser and system:
        return translate("activity.deviceOn", {"browser": browser, "system": system})
    return browser or system or translate("activity.unknownDevice")
