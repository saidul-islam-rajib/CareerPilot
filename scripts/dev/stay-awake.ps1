param(
    [int]$RefreshSeconds = 60
)

$signature = '[DllImport("kernel32.dll", SetLastError = true)] public static extern uint SetThreadExecutionState(uint esFlags);'
$power = Add-Type -MemberDefinition $signature -Name 'CareerPilotPower' -Namespace 'CareerPilot' -PassThru
$continuous = [uint32]'0x80000000'
$systemRequired = [uint32]'0x00000001'

Write-Output "Keeping this PC awake for CareerPilot work. Stop this window (or the task) to allow sleep again."
try {
    while ($true) {
        [void]$power::SetThreadExecutionState($continuous -bor $systemRequired)
        Start-Sleep -Seconds $RefreshSeconds
    }
}
finally {
    [void]$power::SetThreadExecutionState($continuous)
}
