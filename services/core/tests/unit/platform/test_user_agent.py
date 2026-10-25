from careerpilot.platform.user_agent import describe_device

EDGE = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0"
SAFARI_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
CHROME_ANDROID = "Mozilla/5.0 (Linux; Android 16; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36"


def test_known_browsers_and_systems() -> None:
    assert describe_device(EDGE) == "Edge on Windows"
    assert describe_device(SAFARI_IOS) == "Safari on iOS"
    assert describe_device(CHROME_ANDROID) == "Chrome on Android"


def test_unknown_or_missing_agents() -> None:
    assert describe_device(None) == "Unknown device"
    assert describe_device("curl/8.0") == "Unknown device"
    assert describe_device("Firefox/130.0") == "Firefox"
