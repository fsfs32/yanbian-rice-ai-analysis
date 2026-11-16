@echo off
chcp 936 >nul
setlocal EnableExtensions
cd /d "%~dp0"
title 延边大米 · 长势与产量 AI 数据分析平台

set "ROOT=%~dp0"
set "BACKEND=%ROOT%后端"
set "FRONTEND=%ROOT%前端"
set "VENV=%BACKEND%\.venv"
set "PYEXE=%VENV%\Scripts\python.exe"
set "PIPMIRROR=https://mirrors.aliyun.com/pypi/simple/"
set "LOGDIR=%ROOT%logs"
set "URL=http://localhost:5173"

if /i "%~1"=="stop" goto :stop
if /i "%~1"=="pack" goto :pack

echo.
echo ============================================================
echo    延边大米 · 长势与产量 AI 数据分析平台
echo ============================================================
echo.

if not exist "%BACKEND%\app\main.py" (
    echo [错误] 找不到 后端\app\main.py
    echo        请把本脚本放在项目根目录后再双击。
    echo.
    pause
    exit /b 1
)

rem ---------- 1. 是否已在运行 ----------
set "BE_RUN="
set "FE_RUN="
netstat -ano | findstr ":8000" | findstr "LISTENING" >nul 2>&1 && set "BE_RUN=1"
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul 2>&1 && set "FE_RUN=1"

if defined BE_RUN if defined FE_RUN (
    echo 服务已在运行，直接打开浏览器。
    start "" "%URL%"
    ping -n 3 127.0.0.1 >nul
    exit /b 0
)

rem ---------- 2. 环境检查 ----------
if not exist "%BACKEND%\.env" if exist "%BACKEND%\.env.example" copy /y "%BACKEND%\.env.example" "%BACKEND%\.env" >nul

findstr /r /c:"^LLM_API_KEY=." "%BACKEND%\.env" >nul 2>&1
if errorlevel 1 (
    echo 提示：当前为「演示模式」（未配置 LLM_API_KEY）。
    echo       界面、图表、交互全部可用，回答由内置数据与知识库生成。
    echo       接入真实大模型：把 Key 填进 后端\.env，再双击本脚本。
    echo.
)

rem ---------- 3. 依赖 ----------
if not exist "%PYEXE%" (
    echo [1/3] 首次运行，安装后端依赖（约 1 分钟）...
    python -m venv "%VENV%"
    if errorlevel 1 goto :fail
    "%PYEXE%" -m pip install -q --upgrade pip
    "%PYEXE%" -m pip install -q -r "%BACKEND%\requirements.txt" -i %PIPMIRROR%
    if errorlevel 1 goto :fail
) else (
    "%PYEXE%" -c "import fastapi,uvicorn,httpx,pydantic_settings" >nul 2>&1
    if errorlevel 1 (
        echo [1/3] 补齐后端依赖...
        "%PYEXE%" -m pip install -q -r "%BACKEND%\requirements.txt" -i %PIPMIRROR%
        if errorlevel 1 goto :fail
    ) else (
        echo [1/3] 后端依赖就绪
    )
)

if not exist "%FRONTEND%\node_modules" (
    echo [2/3] 首次运行，安装前端依赖（1-2 分钟）...
    pushd "%FRONTEND%"
    call npm install
    popd
    if errorlevel 1 goto :fail
) else (
    echo [2/3] 前端依赖就绪
)

rem ---------- 4. 后台启动 ----------
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
echo [3/3] 后台启动服务...

if not defined BE_RUN (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%PYEXE%' -ArgumentList '-m uvicorn app.main:app --host 127.0.0.1 --port 8000' -WorkingDirectory '%BACKEND%' -WindowStyle Hidden -RedirectStandardOutput '%LOGDIR%\backend.log' -RedirectStandardError '%LOGDIR%\backend.err.log'"
)
if not defined FE_RUN (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'npm.cmd' -ArgumentList 'run dev' -WorkingDirectory '%FRONTEND%' -WindowStyle Hidden -RedirectStandardOutput '%LOGDIR%\frontend.log' -RedirectStandardError '%LOGDIR%\frontend.err.log'"
)

rem ---------- 5. 等待前端就绪 ----------
set /a TRY=0
:wait
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul 2>&1 && goto :ready
set /a TRY+=1
if %TRY% GEQ 30 goto :ready
ping -n 3 127.0.0.1 >nul
goto :wait

:ready
start "" "%URL%"
echo.
echo ============================================================
echo   启动完成：%URL%
echo   停止服务：在命令行执行  一键启动.bat stop
echo   打包交付：在命令行执行  一键启动.bat pack
echo   运行日志：logs\backend.log 、 logs\frontend.log
echo ============================================================
echo.
ping -n 5 127.0.0.1 >nul
exit /b 0

:fail
echo.
echo [失败] 依赖安装出错，请把上面的报错截图反馈。
echo.
pause
exit /b 1

rem ============================================================
rem  停止：一键启动.bat stop
rem ============================================================
:stop
echo 正在停止服务...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do taskkill /f /pid %%p >nul 2>&1
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do taskkill /f /pid %%p >nul 2>&1
echo 已停止（8000 / 5173）。
ping -n 3 127.0.0.1 >nul
exit /b 0

rem ============================================================
rem  打包：一键启动.bat pack
rem ============================================================
:pack
set "OUT=%USERPROFILE%\Desktop\延边大米种植长势与产量 AI 数据分析可视化平台-交付.zip"
set "TMP=%TEMP%\yanbian_rice_pack"
echo 正在打包（排除 .env、.venv、node_modules、日志、Git 历史）...
if exist "%TMP%" rmdir /s /q "%TMP%"
mkdir "%TMP%"

robocopy "%ROOT%." "%TMP%" /E /XD .venv node_modules __pycache__ .pytest_cache dist .git logs .screenshots .workbuddy 1 /XF .env *.pyc *.log >nul
if errorlevel 8 (
    echo [失败] 复制文件时出错，请检查是否有文件被占用。
    rmdir /s /q "%TMP%"
    pause
    exit /b 1
)
if exist "%TMP%\后端\.env" del /f /q "%TMP%\后端\.env"

if exist "%OUT%" del /f /q "%OUT%"
powershell -NoProfile -Command "Compress-Archive -Path '%TMP%\*' -DestinationPath '%OUT%' -Force"
if errorlevel 1 (
    echo [失败] 压缩失败。
    rmdir /s /q "%TMP%"
    pause
    exit /b 1
)

rmdir /s /q "%TMP%"
echo.
echo 完成：%OUT%
echo 对方解压后双击「一键启动.bat」即可运行；未填 Key 会以演示模式启动。
ping -n 5 127.0.0.1 >nul
exit /b 0
