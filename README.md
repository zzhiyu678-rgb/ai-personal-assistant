# AI私人助理 — AI Personal Assistant

> 基于 AI 的个人工作管理系统，帮助你规划目标、记录工作、生成日报、分析客户、沉淀知识。

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 🎯 目标管理 | 年/月/周三级目标体系，AI自动拆解目标，进度追踪与可视化完成度 |
| 📝 每日工作记录 | 简化输入框，一句话记录工作；日期选择器支持任意历史日期；每5秒自动保存草稿 |
| 🤖 AI私人顾问 | 基于你的工作数据智能回答，流式输出，支持图片识别和文件上传，自动生成对话标题，可手动修改标题 |
| 📊 工作日报 | AI自动生成六大板块（今日完成/数据统计/遇到问题/AI分析/改进建议/明日目标和计划），支持编辑、重新生成、复制、PDF导出 |
| 👥 CRM客户管理 | 企业信息管理（公司/法人/多电话/多邮箱/官网），Excel批量导入智能识别列名，完整分页，批量删除，客户跟进记录，AI客户意向分析 |
| 💬 客户聊天分析 | 粘贴客户聊天记录，AI分析客户真实需求、顾虑、成交概率，推荐下一步沟通话术 |
| 📚 AI知识库 | 支持 PDF/Word/PPT/Excel/TXT/MD，自动提取文本内容，AI回答时自动检索相关知识 |
| 🧠 AI记忆 | 记录你的工作风格、销售方式、个人偏好，AI回答时参考记忆内容 |
| 📈 数据分析 | 工作趋势、任务完成率、客户开发数量、沟通数量、成交率统计，AI工作总结报告 |
| ⚙️ 技术架构 | 飞书SSO登录（本地开发可绕过），RLS行级数据隔离，本地文件存储，支持自部署 |

## 🛠 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + TailwindCSS + shadcn/ui |
| 后端 | NestJS 10 + TypeScript |
| 数据库 | PostgreSQL 14+ + Drizzle ORM |
| AI | OpenAI API（用户自配 Key） / 飞书平台插件 |
| 认证 | 飞书 SSO |
| 文件存储 | 本地文件系统（自部署） / Dataloom（平台） |
| 构建 | Vite + Nest CLI |

## 📋 环境要求

- **Node.js** >= 22.0.0
- **PostgreSQL** >= 14
- **飞书企业应用**（用于 SSO 登录）
- **OpenAI API Key**（可选，不配置则使用平台插件）

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd ai-work-coach
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入以下必要配置：

- `DATABASE_URL` — PostgreSQL 数据库连接串
- `OPENAI_API_KEY` — OpenAI API Key（AI 功能必需）
- 飞书 SSO 相关配置（见下文）

### 4. 初始化数据库

```bash
npm run gen:db-schema
```

> 首次运行需要在数据库中执行建表 SQL。请参考数据库初始化文档。

### 5. 启动开发环境

```bash
npm run dev
```

访问 http://localhost:3000 即可使用。

## 🔧 环境变量说明

| 变量名 | 默认值 | 说明 | 必填 |
|--------|--------|------|------|
| `DATABASE_URL` | — | PostgreSQL 数据库连接串 | ✅ |
| `NODE_ENV` | `development` | 运行环境 | — |
| `PORT` | `3000` | 服务端口 | — |
| `AI_PROVIDER` | `openai` | AI 服务提供商：`openai` / `platform` | — |
| `OPENAI_API_KEY` | — | OpenAI API Key | AI_PROVIDER=openai 时必填 |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI API 基础地址（支持代理/兼容服务） | — |
| `OPENAI_MODEL` | `gpt-4o-mini` | 默认使用的 AI 模型 | — |
| `UPLOAD_DIR` | `./uploads` | 文件上传存储目录 | — |
| `MAX_FILE_SIZE` | `10485760` | 单文件大小上限（字节，默认 10MB） | — |

## 🤝 飞书 SSO 配置

本项目使用飞书 SSO 登录，需要在飞书开放平台创建应用：

1. 登录 [飞书开放平台](https://open.feishu.cn/)
2. 创建「企业自建应用」
3. 开启「网页应用」能力
4. 配置重定向 URL：`http://localhost:3000/api/auth/callback`（开发环境）或你的部署域名
5. 申请权限：获取用户基本信息
6. 将 App ID 和 App Secret 填入环境变量

> 详细配置步骤请参考飞书开放平台文档。

## 📁 项目结构

```
client/              # React 前端
  src/
    api/             # API 调用封装
    pages/           # 页面组件
    components/      # 可复用组件
    hooks/           # 自定义 Hooks
    utils/           # 工具函数
server/              # NestJS 后端
  modules/           # 业务模块
    ai/              # AI 能力模块
    files/           # 文件存储模块
    goal/            # 目标管理
    daily-record/    # 每日记录
    ai-conversation/ # AI 对话
    report/          # 日报
    task/            # 任务
    crm/             # 客户管理
    chat-analysis/   # 聊天分析
    knowledge/       # 知识库
    analytics/       # 数据分析
  database/          # 数据库 Schema
  common/            # 共享工具
shared/              # 前后端共享类型定义
```

## 🐳 Docker 部署

待补充。

## 📄 License

MIT License
