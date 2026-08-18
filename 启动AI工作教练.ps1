# AI Work Coach 一键启动脚本
$ErrorActionPreference = "Continue"
$ProjectDir = "D:\ai work\project"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AI Work Coach 启动中..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. 确保 PostgreSQL 服务运行
Write-Host "`n[1/3] 检查 PostgreSQL 服务..." -ForegroundColor Yellow
$pgService = Get-Service -Name "postgresql-x64-17" -ErrorAction SilentlyContinue
if ($pgService) {
    if ($pgService.Status -ne "Running") {
        Write-Host "  启动 PostgreSQL..." -ForegroundColor Gray
        Start-Service $pgService.Name
        Start-Sleep -Seconds 2
    }
    Write-Host "  PostgreSQL 运行中" -ForegroundColor Green
} else {
    Write-Host "  警告: 未找到 PostgreSQL 服务" -ForegroundColor Red
}

# 2. 进入项目目录
Set-Location $ProjectDir

# 3. 检查前端是否已构建
Write-Host "`n[2/3] 检查前端构建..." -ForegroundColor Yellow
if (-not (Test-Path "dist\client\index.html")) {
    Write-Host "  前端未构建，正在构建..." -ForegroundColor Gray
    npm run build:client
}
Write-Host "  前端已就绪" -ForegroundColor Green

# 4. 启动服务器并打开浏览器
Write-Host "`n[3/3] 启动应用服务器..." -ForegroundColor Yellow
Write-Host "  本地开发模式，跳过飞书 SSO 认证" -ForegroundColor Gray

$env:LOCAL_DEV = "true"
$env:VITE_LOCAL_DEV = "true"

# 打开浏览器
Start-Sleep -Seconds 2
Start-Process "http://localhost:3000"

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  启动完成！访问: http://localhost:3000" -ForegroundColor Green
Write-Host "  按 Ctrl+C 停止服务" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Green
Write-Host "`n"

# 启动服务器（前台运行）
node dist/server/main.js
