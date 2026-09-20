@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)
echo.
echo PayShield starting on http://localhost:3000
echo   Dashboard : http://localhost:3000
echo   Pay app   : http://localhost:3000/pay
echo.
call npm run dev
pause
