# Machine Setup (installed by the user)

Claude never installs system-wide software or runs as administrator. When a task needs a tool that is missing on the development machine, the agent adds it here, marks the task `- [!]`, and keeps working on everything else. Install the items below later, then tick them.

| Tool | Needed for | Status |
|---|---|---|
| Python 3.11+ | Hooks, backend | Installed (3.11.9) |
| Claude Code CLI | Autopilot (`scripts/autopilot.ps1`) | Installed |
