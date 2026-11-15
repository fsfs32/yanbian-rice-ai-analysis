@echo off
chcp 936 >nul
cd /d "%~dp0后端"
title 后端 FastAPI 8000

if exist "%~dp0后端\.venv\Scripts\python.exe" (
    "%~dp0后端\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
) else (
    python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
)
