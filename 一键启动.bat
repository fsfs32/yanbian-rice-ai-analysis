@echo off
chcp 936 >nul
setlocal
cd /d "%~dp0"
title 延边大米 AI 分析

set "BACKEND=%~dp0后端"
set "FRONTEND=%~dp0前端"
set "VENV=%BACKEND%\.venv"
set "PYEXE=%VENV%\Scripts\python.exe"
set "PIPMIRROR=https://mirrors.aliyun.com/pypi/simple/"
set "LOGDIR=%~dp0logs"

if not exist "%BACKEND%\app\main.py" (
    echo [错误] 找不到 后端\app\main.py
    echo        请把本脚本放在「比赛项目」根目录再双击
    echo.
    pause
    exit /b 1
)

REM ---------- 0. 服务是否已在运行 ----------
set "BE_RUN="
set "FE_RUN="
netstat -ano | findstr ":8000" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 set "BE_RUN=1"
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 set "FE_RUN=1"

if defined BE_RUN if defined FE_RUN (
    echo 服务已经在运行，直接打开浏览器。
    start "" "http://localhost:5173"
    timeout /t 2 /nobreak >nul
    exit /b 0
)

echo ============================================
echo   延边大米 · 长势与产量 AI 数据分析平台
echo ============================================
echo.

REM ---------- 1. 配置检查 ----------
if not exist "%BACKEND%\.env" (
    if exist "%BACKEND%\.env.example" copy "%BACKEND%\.env.example" "%BACKEND%\.env" >nul 2>&1
)
findstr /r /c:"^LLM_API_KEY=." "%BACKEND%\.env" >nul 2>&1
if errorlevel 1 (
    echo ================================================
    echo   注意：当前是「演示模式」
    echo ================================================
    echo.
    echo   没有检测到 LLM_API_KEY。界面、图表、交互全部可用，
    echo   但回答由内置数据与知识库按问题类型生成，页面上会标注「演示模式」。
    echo   这不是系统故障，是有意的降级设计。
    echo   要看到真实的 AI 回答：把 LLM_API_KEY 填进 后端 的 .env 文件，
    echo   然后关掉服务重新双击本脚本。
    echo.
)

REM ---------- 2. 后端依赖 ----------
if not exist "%PYEXE%" (
    echo [1/3] 首次运行，正在安装后端依赖，约 1 分钟...
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

REM ---------- 3. 前端依赖 ----------
if not exist "%FRONTEND%\node_modules" (
    echo [2/3] 首次运行，正在安装前端依赖，约 1-2 分钟...
    pushd "%FRONTEND%"
    call npm install
    popd
    if errorlevel 1 goto :fail
) else (
    echo [2/3] 前端依赖就绪
)

REM ---------- 4. 隐藏启动缺的那一半 ----------
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
echo [3/3] 正在后台启动服务...
if not defined BE_RUN wscript //nologo "%~dp0_hidden.vbs" "%~dp0_backend.bat" "%LOGDIR%\后端.log"
if not defined FE_RUN wscript //nologo "%~dp0_hidden.vbs" "%~dp0_frontend.bat" "%LOGDIR%\前端.log"

set /a TRY=0
:WAITVITE
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 goto :READY
set /a TRY+=1
if %TRY% geq 30 goto :READY_FORCE
timeout /t 2 /nobreak >nul
goto :WAITVITE

:READY_FORCE
echo       前端启动较慢，先打开浏览器，稍等几秒刷新即可。
:READY
start "" "http://localhost:5173"

echo.
echo ============================================
echo   启动完成，浏览器已打开：http://localhost:5173
echo   服务在后台运行，没有命令行窗口
echo   停止：双击「停止服务.bat」    日志：logs 文件夹
echo   本窗口 3 秒后自动关闭
echo ============================================
timeout /t 3 /nobreak >nul
exit /b 0

:fail
echo.
echo [失败] 安装依赖时出错，请把上面的报错截图发出。
echo.
pause
exit /b 1
