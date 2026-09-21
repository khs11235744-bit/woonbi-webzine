@echo off
setlocal
where gh >nul 2>nul || (echo GH_NOT_FOUND & pause & exit /b 1)
gh auth status >nul 2>nul || (echo GH_NOT_LOGGED_IN & pause & exit /b 1)

set "BRIDGE=%USERPROFILE%\KHS_REMOTE_BRIDGE"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\KHS_REMOTE_BRIDGE_AUTO.cmd"

if not exist "%BRIDGE%\.git" (
  if exist "%BRIDGE%" rmdir /s /q "%BRIDGE%"
  gh repo clone khs11235744-bit/- "%BRIDGE%" || (echo CLONE_FAILED & pause & exit /b 1)
) else (
  cd /d "%BRIDGE%"
  git fetch origin main
  git reset --hard origin/main
)

if not exist "%STARTUP%" (
  >"%STARTUP%" echo @echo off
  >>"%STARTUP%" echo start "" cmd.exe /c ""%BRIDGE%\KHS_REMOTE\START_LOCAL_BRIDGE.cmd""
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%BRIDGE%\KHS_REMOTE\local_bridge.ps1"
