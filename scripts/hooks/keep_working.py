"""Claude Code Stop hook: keep working until the job is done.

Claude may stop only when no spec task is open ("- [ ]" in specs/*/tasks.md,
the template excluded). Tasks that need the Product Owner (a checkpoint, a
manual install, a missing decision) are marked "- [!]" and do not keep Claude
working. Pause the autopilot by creating the file .claude/autopilot-off.

Loop guard: if Claude tries to stop three times in a row with the task files
unchanged, it is allowed to stop (it is stuck and needs a person).

Also usable from scripts: `python keep_working.py --open-count` prints the
number of open tasks.
"""
import hashlib
import json
import os
import re
import sys
from pathlib import Path

OPEN_TASK = re.compile(r"^\s*[-*]\s+\[ \]\s+(.+)$")
MAX_STOPS_WITHOUT_PROGRESS = 3


def project_dir(data: dict) -> Path:
    return Path(os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd())


def task_files(root: Path) -> list[Path]:
    return sorted(p for p in (root / "specs").glob("*/tasks.md") if p.parent.name != "_template")


def open_tasks(root: Path) -> list[tuple[Path, str]]:
    found = []
    for path in task_files(root):
        for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            match = OPEN_TASK.match(line)
            if match:
                found.append((path, match.group(1).strip()))
    return found


def fingerprint(root: Path) -> str:
    digest = hashlib.sha256()
    for path in task_files(root):
        digest.update(path.read_bytes())
    return digest.hexdigest()


def stuck(root: Path) -> bool:
    """Count stops with unchanged task files; True once the limit is reached."""
    state_file = root / ".claude" / "autopilot-state.json"
    try:
        state = json.loads(state_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        state = {}
    current = fingerprint(root)
    count = state.get("count", 0) + 1 if state.get("fingerprint") == current else 1
    try:
        state_file.write_text(json.dumps({"fingerprint": current, "count": count}), encoding="utf-8")
    except OSError:
        pass
    return count >= MAX_STOPS_WITHOUT_PROGRESS


def main() -> None:
    if "--open-count" in sys.argv:
        print(len(open_tasks(project_dir({}))))
        return
    try:
        data = json.load(sys.stdin)
    except json.JSONDecodeError:
        data = {}
    root = project_dir(data)
    if (root / ".claude" / "autopilot-off").exists():
        return
    tasks = open_tasks(root)
    if not tasks:
        return
    if stuck(root):
        print(json.dumps({"systemMessage": "Autopilot: no progress on spec tasks after several attempts; stopping for review."}))
        return
    path, task = tasks[0]
    print(json.dumps({
        "decision": "block",
        "reason": (
            f"{len(tasks)} spec task(s) are still open. Next: \"{task}\" in "
            f"{path.relative_to(root).as_posix()}. Continue working without asking the user: "
            "follow CLAUDE.md, tick each task when done, and commit in small portions with tests passing. "
            "If a task truly needs the Product Owner (checkpoint, manual install, missing decision), "
            "mark it '- [!]' with the reason, note it in the commit, and move on to the next task."
        ),
    }))


if __name__ == "__main__":
    main()
