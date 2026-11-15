@echo off
chcp 936 >nul
title 停止服务

echo 正在关闭占用 8000 和 5173 端口的进程...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do taskkill /f /t /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do taskkill /f /t /pid %%a >nul 2>&1

echo 已停止。
timeout /t 1 /nobreak >nul
