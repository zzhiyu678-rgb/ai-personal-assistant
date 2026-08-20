@echo off
chcp 65001 >nul
title AI私人助理

echo ========================================
echo    AI私人助理 - 正在启动...
echo ========================================
echo.

cd /d "D:\ai work\project"

REM 设置环境变量
set LOCAL_DEV=true
set VITE_LOCAL_DEV=true

REM 使用node完整路径（豆包沙箱中的node）
set NODE_PATH=C:\Users\Yuuuu\AppData\Local\Doubao\User Data\sandbox_runtime\bases\08cf4f1e17b11ebb8f8367e5741f1eaf\node\node.exe

REM 检查node是否存在
if not exist "%NODE_PATH%" (
    echo [错误] 找不到node.exe: %NODE_PATH%
    echo 请检查豆包是否已安装。
    pause
    exit /b 1
)

REM 检查端口是否已被占用
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo [提示] 服务器已在运行，直接打开网页...
    timeout /t 1 /nobreak >nul
    start "" "http://localhost:3000"
    exit
)

echo [1/3] 启动服务器...
start "AI私人助理-服务器" /min "%NODE_PATH%" dist/server/main.js

echo [2/3] 等待服务器就绪（约8秒）...
timeout /t 8 /nobreak >nul

REM 检查服务器是否启动成功
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul
if %errorlevel% neq 0 (
    echo [警告] 服务器可能未启动成功，正在再等待5秒...
    timeout /t 5 /nobreak >nul
)

echo [3/3] 打开网页...
start "" "http://localhost:3000"

echo.
echo ========================================
echo    启动完成！网页已打开。
echo    服务器在后台运行（最小化窗口）。
echo    关闭服务器请在任务管理器结束 node.exe
echo ========================================
echo.
timeout /t 3 /nobreak >nul
