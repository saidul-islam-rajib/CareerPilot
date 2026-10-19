# Runs CareerPilot development unattended with Claude Code.
# Resumes the latest session again and again; when a usage limit is hit (for example the
# 5-hour limit) it waits and retries until the limit resets. Stops when no spec task is
# open, when Claude makes no progress, or when .claude/autopilot-off exists.
#
# Usage (from the project folder):  powershell -ExecutionPolicy Bypass -File scripts\autopilot.ps1
param(
    [int]$WaitMinutes = 20,
    [string]$Prompt = "Continue CareerPilot development: pick up the next open task in specs/*/tasks.md, follow CLAUDE.md, and keep going until all tasks are done."
)

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Get-OpenTasks { [int](python scripts/hooks/keep_working.py --open-count) }
function Get-Head { git rev-parse HEAD }

while ($true) {
    if (Test-Path ".claude/autopilot-off") { Write-Host "Autopilot paused (.claude/autopilot-off exists)."; break }
    if ((Get-OpenTasks) -eq 0) { Write-Host "No open spec tasks. Done."; break }

    $before = Get-Head
    Write-Host "$(Get-Date -Format s)  Resuming Claude Code..."
    $output = (& claude --continue -p $Prompt | Out-String)
    $exit = $LASTEXITCODE
    Write-Host $output

    if ($exit -ne 0 -or $output -match "(?i)usage limit|rate limit|limit reached|resets? at") {
        Write-Host "$(Get-Date -Format s)  Limit or error; retrying in $WaitMinutes minutes."
        Start-Sleep -Seconds ($WaitMinutes * 60)
        continue
    }
    if ((Get-Head) -eq $before) {
        Write-Host "No new commits in this run; stopping so a person can review open or blocked ([!]) tasks."
        break
    }
}
