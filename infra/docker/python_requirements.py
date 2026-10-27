import sys
import tomllib
from pathlib import Path

LOCAL_PACKAGE_PREFIX = "careerpilot"


def requirements(pyproject_paths: list[str]) -> list[str]:
    found: set[str] = set()
    for path in pyproject_paths:
        document = tomllib.loads(Path(path).read_text(encoding="utf-8"))
        found.update(document.get("build-system", {}).get("requires", []))
        found.update(d for d in document["project"].get("dependencies", []) if not d.startswith(LOCAL_PACKAGE_PREFIX))
    return sorted(found)


if __name__ == "__main__":
    print("\n".join(requirements(sys.argv[1:])))
