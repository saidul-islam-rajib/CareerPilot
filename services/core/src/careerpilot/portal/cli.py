import argparse
import json
import sys

from careerpilot.bootstrap import build_container
from careerpilot.portal.enums import ReadinessState

COMMAND_READINESS = "readiness"
EXIT_OK = 0
EXIT_FAILED = 1


def parse(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="careerpilot-portal")
    commands = parser.add_subparsers(dest="command", required=True)
    readiness = commands.add_parser(COMMAND_READINESS, help="read-only readiness check of a job link")
    readiness.add_argument("url")
    readiness.add_argument("--email", default="", help="CareerPilot account email whose profile is used for field mapping")
    return parser.parse_args(argv)


def run(argv: list[str]) -> int:
    args = parse(argv)
    container = build_container()
    user_id = ""
    if args.email:
        user_id = container.portal.user_lookup(args.email.strip().lower()) or ""
    checker = container.portal.readiness
    pending = checker.request(user_id or "cli", args.url)
    report = checker.check(user_id or None, pending)
    sys.stdout.write(json.dumps(report.to_json(), indent=2, ensure_ascii=False) + "\n")
    return EXIT_OK if report.state is ReadinessState.DONE else EXIT_FAILED


def main() -> None:
    sys.exit(run(sys.argv[1:]))


if __name__ == "__main__":
    main()
