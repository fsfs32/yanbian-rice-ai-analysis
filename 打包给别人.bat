@echo off
chcp 936 >nul
setlocal
cd /d "%~dp0"
title 打包给别人

set "SRC=%~dp0."
set "OUT=%USERPROFILE%\Desktop\比赛项目-交付.zip"
set "TMP=%TEMP%\matchpack"

echo ============================================
echo   生成可交付的压缩包
echo ============================================
echo.
echo 排除内容：.env（密钥）、.venv、node_modules、缓存、构建产物、.git、logs
echo.

if exist "%TMP%" rmdir /s /q "%TMP%"
mkdir "%TMP%"

echo [1/3] 复制项目文件...
robocopy "%SRC%" "%TMP%" /E /XD .venv venv node_modules __pycache__ .pytest_cache dist .git .screenshots .workbuddy logs /XF .env *.pyc >nul
if errorlevel 8 (
    echo [错误] 复制失败，请检查是否有文件被占用
    pause
    exit /b 1
)

echo [2/3] 检查敏感文件...
if exist "%TMP%\后端\.env" (
    echo [警告] 检测到 .env 混入，已删除
    del /f /q "%TMP%\后端\.env"
)

echo [3/3] 压缩...
if exist "%OUT%" del /f /q "%OUT%"
powershell -NoProfile -Command "Compress-Archive -Path '%TMP%\*' -DestinationPath '%OUT%' -Force"
if errorlevel 1 (
    echo [错误] 压缩失败
    rmdir /s /q "%TMP%"
    pause
    exit /b 1
)

rmdir /s /q "%TMP%"

echo.
echo ============================================
echo   完成：%OUT%
echo.
echo   对方解压后双击「一键启动.bat」即可运行
echo   未填 API Key 会以演示模式启动，界面完整可用
echo ============================================
timeout /t 4 /nobreak >nul
exit /b 0
