"""Claude Code PostToolUse hook.

When the requirements document is edited, remind the agent to update every
affected planning, design, spec, seed, and README document in the same change.
"""
import json
import sys

REQUIREMENTS = "requirement analysis/requirements.md"

MESSAGE = (
    "The requirements document was just changed. Before finishing this task, "
    "update every document affected by this change so they stay consistent: "
    "Planning/*.md, Planning/Design/*.md, specs/, seeds plan, README.md, and CLAUDE.md "
    "(check acceptance criteria, test scenarios, decisions, and cross-references too). "
    "Follow requirements Section 45 consistency rules and commit the updates in small portions."
)


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except json.JSONDecodeError:
        return
    path = str((data.get("tool_input") or {}).get("file_path", ""))
    if path.replace("\\", "/").lower().endswith(REQUIREMENTS):
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": MESSAGE,
            }
        }))


if __name__ == "__main__":
    main()
