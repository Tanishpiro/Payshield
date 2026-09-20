$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$adbPath = 'C:\Android\android-sdk\platform-tools\adb.exe'
if (Test-Path $adbPath) {
    & $adbPath reverse tcp:3010 tcp:3010
    if ($LASTEXITCODE -ne 0) { Write-Host 'Connect and authorize an Android phone for USB testing. Browser testing still works.' }
}
Write-Host 'Browser: http://localhost:3010/pay'
Write-Host 'Android Voice settings URL: http://localhost:3010'
Write-Host 'Use PAYSHIELD_VOICE_ACCESS_TOKEN from .env.local as the access code, NOT the ElevenLabs API key.'
npm run dev -- --hostname 127.0.0.1 --port 3010
