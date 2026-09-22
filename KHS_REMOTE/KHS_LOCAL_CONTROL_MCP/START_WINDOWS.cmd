@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies...
  call npm.cmd install
  if errorlevel 1 exit /b 1
)
if not exist .env (
  copy /Y .env.example .env >nul
  echo.
  echo Created .env. Edit WORKSPACE_ROOT and generate LOCAL_CONTROL_TOKEN before enabling write/control.
  notepad .env
  exit /b 0
)
call npm.cmd start
