# Machine Setup (installed by the user)

Claude never installs system-wide software or runs as administrator. When a task needs a tool that is missing on the development machine, the agent adds it here, marks the task `- [!]`, and keeps working on everything else. Install the items below later, then tick them.

| Tool | Needed for | Status |
|---|---|---|
| Python 3.11+ | Hooks, backend | Installed (3.11.9) |
| Claude Code CLI | Autopilot (`scripts/autopilot.ps1`) | Installed |
| Expo Go on a phone (https://expo.dev/go), or Android Studio (https://developer.android.com/studio) for an emulator | Running the mobile app natively (RUN-LOCALLY.md option B); Android and iOS bundles verified to build with Metro on Expo SDK 58 (2026-10-27) | Not installed |
| Expo account (EAS) | Cloud builds for Android/iOS | Not set up |
| uv (Python package manager) | Faster, locked Python installs (planned); until installed, `services/.venv` is created with `python -m venv` and pip | Optional |
| Docker Desktop | Local platform via Docker Compose | Installed and running |
