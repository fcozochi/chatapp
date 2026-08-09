@echo off
echo Starting ChatApp Pro...
echo.
echo Starting Server...
start "ChatApp Server" cmd /k "cd /d E:\ChatApp\server && npm run dev"
timeout /t 2 /nobreak >nul
echo Starting Client...
start "ChatApp Client" cmd /k "cd /d E:\ChatApp\client && npm run dev"
echo.
echo ChatApp Pro is starting!
echo Frontend: http://localhost:5173
echo Backend: http://localhost:3000
echo.
pause
