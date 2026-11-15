@echo off
chcp 936 >nul
cd /d "%~dp0前端"
title 前端 Vite 5173

call npm run dev

echo.
echo 前端已退出。
pause
