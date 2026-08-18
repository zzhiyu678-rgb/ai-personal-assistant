# AI Work Coach 本地开发指南

## 前置要求

1. **Node.js >= 20**（推荐 22+）
2. **PostgreSQL >= 14**
3. **OpenAI API Key**（可选，不配置则 AI 功能不可用）

## 第一步：安装 PostgreSQL

### Windows
1. 下载 PostgreSQL: https://www.postgresql.org/download/windows/
2. 安装时记住密码（默认用户 postgres）
3. 安装完成后打开 SQL Shell (psql)，执行：

```sql
CREATE DATABASE ai_work_coach;
```

### 验证
```bash
psql -U postgres -c "SELECT version();"
```

## 第二步：初始化数据库

在项目根目录执行：

```bash
psql -U postgres -d ai_work_coach -f server/local/init.sql
```

应看到 `Database initialized successfully!`

## 第三步：配置环境变量

编辑 `.env` 文件，确认以下配置：

```env
LOCAL_DEV=true
VITE_LOCAL_DEV=true
DATABASE_URL=postgresql://postgres:你的密码@localhost:5432/ai_work_coach
AI_PROVIDER=openai
OPENAI_API_KEY=sk-你的key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

> 如果使用国内代理，将 `OPENAI_BASE_URL` 改为代理地址。

## 第四步：安装依赖

```bash
npm install
```

## 第五步：启动开发服务器

```bash
npm run dev
```

启动后访问：http://localhost:3000

后端 API: http://localhost:3000/api

## 本地开发模式说明

本地模式下：
- **跳过飞书 SSO 认证**，自动以「本地用户」身份登录
- **使用本地 PostgreSQL**，不依赖平台数据库
- **AI 直连 OpenAI**，不依赖平台插件
- **文件存储在本地 `uploads/` 目录**

用户 ID 固定为 `local-dev-user`，所有数据归属此用户。

## 常见问题

### 1. `password authentication failed`
检查 `.env` 中 `DATABASE_URL` 的密码是否正确。

### 2. `type "user_profile" does not exist`
数据库初始化脚本未执行。重新执行第二步。

### 3. AI 功能无响应
检查 `OPENAI_API_KEY` 是否配置正确，网络是否能访问 OpenAI（或代理地址）。

### 4. 端口被占用
修改 `.env` 中的 `PORT` 为其他端口。

### 5. Node 版本警告
项目要求 Node 22+，Node 20 大部分功能可运行，但建议升级。

## 切换回平台模式

将 `.env` 中 `LOCAL_DEV` 和 `VITE_LOCAL_DEV` 改为 `false`，即恢复飞书 SSO + 平台数据库模式。
