# Machine Setup (installed by the user)

Claude never installs system-wide software or runs as administrator. When a task needs a tool that is missing on the development machine, the agent adds it here, marks the task `- [!]`, and keeps working on everything else. Install the items below later, then tick them.

| Tool | Needed for | Status |
|---|---|---|
| Python 3.11+ | Hooks, backend | Installed (3.11.9) |
| Claude Code CLI | Autopilot (`scripts/autopilot.ps1`) | Installed |
| Android Studio (SDK + emulator) or a phone with Expo Go | Running the mobile app natively; until then it is validated on the web build | Not installed |
| Expo account (EAS) | Cloud builds for Android/iOS | Not set up |
