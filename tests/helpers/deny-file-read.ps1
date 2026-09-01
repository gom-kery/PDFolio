param([Parameter(Mandatory=$true)][string]$FilePath)
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../work/electron-tests')).Path
$taskFile = (Resolve-Path -LiteralPath $FilePath).Path
if (-not $taskFile.StartsWith($taskRoot + '\', [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $taskFile -PathType Leaf)) { throw 'Only generated Electron test files may be changed.' }
if ((Get-Item -LiteralPath $taskFile).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Reparse points are not permitted.' }
# Use the Windows PowerShell/.NET file API, independent of inherited module paths.
$taskOriginalAcl = [IO.File]::GetAccessControl($taskFile)
$taskOriginalDacl = $taskOriginalAcl.GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access)
$taskDeniedAcl = [IO.File]::GetAccessControl($taskFile)
$taskIdentity = [Security.Principal.WindowsIdentity]::GetCurrent().User
$taskRule = New-Object Security.AccessControl.FileSystemAccessRule($taskIdentity, [Security.AccessControl.FileSystemRights]::ReadData, [Security.AccessControl.AccessControlType]::Deny)
$taskDeniedAcl.AddAccessRule($taskRule)
try {
  [IO.File]::SetAccessControl($taskFile, $taskDeniedAcl)
  [Console]::WriteLine('READY')
  [Console]::Out.Flush()
  [Console]::ReadLine() | Out-Null
} finally {
  # Mark Access as modified; persisting the untouched original object is a no-op.
  $taskRestored = New-Object Security.AccessControl.FileSecurity
  $taskRestored.SetSecurityDescriptorSddlForm($taskOriginalDacl, [Security.AccessControl.AccessControlSections]::Access)
  [IO.File]::SetAccessControl($taskFile, $taskRestored)
}
