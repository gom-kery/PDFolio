param([ValidateRange(1, 10)][int]$Repeats = 3)

$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$taskNode = (Get-Command node.exe -ErrorAction Stop).Source
& $taskNode (Join-Path $taskRoot 'scripts/check-runtime.js')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$taskPackaged = Join-Path $taskRoot 'release/local-pdf-cbt-win32-x64/local-pdf-cbt.exe'
if ($env:LOCAL_PDF_CBT_PACKAGE_PATH) { $taskPackaged = $env:LOCAL_PDF_CBT_PACKAGE_PATH }
if (-not (Test-Path -LiteralPath $taskPackaged -PathType Leaf)) { throw 'Prepare a Windows package matching the current source first.' }
if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) { throw 'Close the development app to free port 5173 first.' }
$taskEvidence = Join-Path $taskRoot ('work/shutdown-tests/' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $taskEvidence -Force | Out-Null
$taskResults = @()

foreach ($taskRound in 1..$Repeats) {
  foreach ($taskMode in @('dev', 'packaged')) {
    foreach ($taskDelay in @(0, 250, 1500)) {
      $taskLabel = "$taskRound-$taskMode-$taskDelay"
      $taskStdout = Join-Path $taskEvidence "$taskLabel-stdout.log"
      $taskStderr = Join-Path $taskEvidence "$taskLabel-stderr.log"
      $taskWindow = $null
      $taskRunner = $null
      $taskResult = [ordered]@{ Mode = $taskMode; Round = $taskRound; DelayMs = $taskDelay; Passed = $false }
      try {
        if ($taskMode -eq 'dev') {
          $taskRunner = Start-Process -FilePath $taskNode -ArgumentList 'scripts/dev.js' -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $taskStdout -RedirectStandardError $taskStderr
        } else {
          $taskProfile = Join-Path $taskEvidence "$taskLabel-profile"
          # This is the visible GUI under test, not a background helper.
          $taskRunner = Start-Process -FilePath $taskPackaged -ArgumentList ('--user-data-dir="' + $taskProfile + '"') -PassThru -RedirectStandardOutput $taskStdout -RedirectStandardError $taskStderr
        }
        # Cache the handle before exit so Windows PowerShell 5.1 retains ExitCode.
        $null = $taskRunner.Handle
        for ($taskIndex = 0; $taskIndex -lt 150; $taskIndex++) {
          if ($taskMode -eq 'dev') {
            $taskChildren = Get-CimInstance Win32_Process -Filter "ParentProcessId = $($taskRunner.Id)"
            foreach ($taskChild in $taskChildren) {
              $taskCandidate = Get-Process -Id $taskChild.ProcessId -ErrorAction SilentlyContinue
              if ($taskCandidate.MainWindowTitle -eq 'Local PDF CBT') { $taskWindow = $taskCandidate; break }
            }
          } else {
            $taskRunner.Refresh()
            if ($taskRunner.MainWindowTitle -eq 'Local PDF CBT') { $taskWindow = $taskRunner }
          }
          if ($null -ne $taskWindow) { break }
          Start-Sleep -Milliseconds 50
        }
        if ($null -eq $taskWindow) { throw 'The app window did not appear.' }
        if ($taskDelay -gt 0) { Start-Sleep -Milliseconds $taskDelay }
        $taskResult.StderrBeforeClose = [string](Get-Content -LiteralPath $taskStderr -Raw)
        $taskResult.CloseRequestedAt = (Get-Date).ToString('o')
        $taskResult.WindowClosed = $taskWindow.CloseMainWindow()
        if (-not $taskRunner.WaitForExit(10000)) { throw 'The app did not terminate after closing the window.' }
        $taskRunner.Refresh()
        $taskResult.ExitCode = $taskRunner.ExitCode
        $taskResult.PortReleased = -not [bool](Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue)
        $taskResult.Stderr = [string](Get-Content -LiteralPath $taskStderr -Raw)
        $taskResult.Passed = $taskResult.WindowClosed -and $taskResult.ExitCode -eq 0 -and $taskResult.PortReleased -and [string]::IsNullOrWhiteSpace($taskResult.Stderr)
      } catch {
        $taskResult.Failure = $_.Exception.Message
      } finally {
        # Only terminate processes started by this test if a check timed out.
        if ($null -ne $taskWindow) {
          $taskWindow.Refresh()
          if (-not $taskWindow.HasExited) { Stop-Process -Id $taskWindow.Id -Force -ErrorAction SilentlyContinue }
        }
        if ($null -ne $taskRunner) {
          $taskRunner.Refresh()
          if (-not $taskRunner.HasExited) { Stop-Process -Id $taskRunner.Id -Force -ErrorAction SilentlyContinue }
        }
        $taskResults += [pscustomobject]$taskResult
        $taskResults | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $taskEvidence 'result.json') -Encoding utf8
        [pscustomobject]$taskResult | ConvertTo-Json -Compress
      }
    }
  }
}
Write-Host "Shutdown test results: $taskEvidence"
if ($taskResults.Passed -contains $false) { exit 1 }
