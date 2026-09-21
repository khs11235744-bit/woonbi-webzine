@echo off
setlocal
where gh >nul 2>nul || (echo GH_NOT_FOUND & pause & exit /b 1)
gh auth status >nul 2>nul || (echo GH_NOT_LOGGED_IN & pause & exit /b 1)
set "BRIDGE=%USERPROFILE%\KHS_REMOTE_BRIDGE"
if not exist "%BRIDGE%\.git" (
  if exist "%BRIDGE%" rmdir /s /q "%BRIDGE%"
  gh repo clone khs11235744-bit/- "%BRIDGE%" || (echo CLONE_FAILED & pause & exit /b 1)
) else (
  cd /d "%BRIDGE%"
  git fetch origin main
  git reset --hard origin/main
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%BRIDGE%\KHS_REMOTE\local_bridge.ps1"
