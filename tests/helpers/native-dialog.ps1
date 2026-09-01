param(
  [Parameter(Mandatory=$true)][int]$OwnerProcessId,
  [ValidateSet('select', 'cancel')][string]$Action,
  [string]$FilePath
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class NativePdfDialog {
  [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern IntPtr SendMessageTimeout(IntPtr window, uint message, IntPtr wParam, string lParam, uint flags, uint timeout, out UIntPtr result);
  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool PostMessage(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
}
'@
$taskOwner = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty, $OwnerProcessId)
$taskClass = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, '#32770')
$taskCondition = New-Object System.Windows.Automation.AndCondition($taskOwner, $taskClass)
$taskDialog = $null
for ($taskAttempt = 0; $taskAttempt -lt 100; $taskAttempt++) {
  $taskDialog = [System.Windows.Automation.AutomationElement]::RootElement.FindFirst([System.Windows.Automation.TreeScope]::Children, $taskCondition)
  if ($null -eq $taskDialog) {
    $taskRoots = [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, $taskOwner)
    foreach ($taskRoot in $taskRoots) {
      $taskDialog = $taskRoot.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $taskClass)
      if ($null -ne $taskDialog) { break }
    }
  }
  if ($null -ne $taskDialog) { break }
  Start-Sleep -Milliseconds 100
}
if ($null -eq $taskDialog) {
  foreach ($taskRoot in $taskRoots) { Write-Output ($taskRoot.Current.Name + ' / ' + $taskRoot.Current.ClassName) }
  throw 'Native dialog for the test process was not found.'
}
if ($Action -eq 'select') {
  $taskFileBoxCondition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, '1148')
  $taskFileBox = $taskDialog.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $taskFileBoxCondition)
  if ($null -eq $taskFileBox) { throw 'Filename control was not found.' }
  $taskEditCondition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, 'Edit')
  $taskEdit = $null
  for ($taskAttempt = 0; $taskAttempt -lt 50; $taskAttempt++) {
    $taskEdit = $taskFileBox.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $taskEditCondition)
    if ($null -ne $taskEdit) { break }
    Start-Sleep -Milliseconds 100
  }
  if ($null -eq $taskEdit) {
    throw 'Editable filename control was not found.'
  }
  # Classic common-dialog controls may be exposed as UIA panes without ValuePattern.
  # Send messages only to handles discovered inside this test process's dialog.
  $taskEditHandle = [IntPtr]$taskEdit.Current.NativeWindowHandle
  if ($taskEditHandle -eq [IntPtr]::Zero) { throw 'Filename edit has no native handle.' }
  $taskMessageResult = [UIntPtr]::Zero
  $taskSent = [NativePdfDialog]::SendMessageTimeout($taskEditHandle, 0x000C, [IntPtr]::Zero, $FilePath, 2, 5000, [ref]$taskMessageResult)
  if ($taskSent -eq [IntPtr]::Zero) { throw 'Setting the filename failed.' }
  $taskButtonId = '1'
} else { $taskButtonId = '2' }
$taskButtonIdCondition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, $taskButtonId)
$taskButtonTypeCondition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, 'Button')
$taskButtonCondition = New-Object System.Windows.Automation.AndCondition($taskButtonIdCondition, $taskButtonTypeCondition)
$taskButton = $taskDialog.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $taskButtonCondition)
if ($null -eq $taskButton) { throw 'Dialog action button was not found.' }
$taskButtonHandle = [IntPtr]$taskButton.Current.NativeWindowHandle
if ($taskButtonHandle -eq [IntPtr]::Zero -or -not [NativePdfDialog]::PostMessage($taskButtonHandle, 0x00F5, [IntPtr]::Zero, [IntPtr]::Zero)) { throw 'Dialog button click failed.' }
Write-Output 'Native dialog action completed.'
