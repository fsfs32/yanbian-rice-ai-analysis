@echo off
chcp 936 >nul
cd /d "%~dp0后端"
title 后端 FastAPI 8000

if exist "%~dp0后端\.venv\Scripts\python.exe" (
    "%~dp0后端\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
) else (
    echo 未找到虚拟环境，回退到系统 python
    python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
)

echo.
echo 后端已退出。
pause
