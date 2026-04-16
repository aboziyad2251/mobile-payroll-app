@echo off
echo ================================
echo   PayrollPro - Starting System
echo ================================
echo.

:: Install backend dependencies if needed
if not exist "backend\node_modules" (
  echo [1/4] Installing backend dependencies...
  cd backend
  npm install
  cd ..
) else (
  echo [1/4] Backend dependencies OK
)

:: Install frontend dependencies if needed
if not exist "frontend\node_modules" (
  echo [2/4] Installing frontend dependencies...
  cd frontend
  npm install
  cd ..
) else (
  echo [2/4] Frontend dependencies OK
)

echo [3/4] Starting backend server on http://localhost:3001
start "PayrollPro - Backend" cmd /k "cd /d %~dp0backend && node server.js"

timeout /t 2 /nobreak > nul

echo [4/4] Starting frontend on http://localhost:3000
start "PayrollPro - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ================================
echo   PayrollPro is starting up!
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:3001
echo ================================
echo.
pause
