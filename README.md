# AI私人助理 — AI Personal Assistant

> 基于 AI 的个人工作管理系统，帮助你规划目标、记录工作、生成日报、分析客户、沉淀知识。

## ✨ 功能特性

### 🎯 目标管理
- 年/月/周三级目标体系，层层拆解
- AI 自动将月度目标拆解为周目标
- 进度追踪，可视化完成度

### 📝 每日工作记录
- 结构化记录：计划/完成/问题/明日想法
- AI 质量分析：评分、亮点、问题、建议、下一步行动
- 历史记录检索与回顾

### 🤖 AI 教练对话
- 基于你的工作数据的智能助手
- 流式输出，实时回复
- 自动生成对话标题
- 支持多轮对话历史

### 📊 日报生成
- AI 自动生成每日工作日报
- 整合工作记录、目标进度、数据统计
- Markdown 格式，一键复制

### 📋 明日计划
- AI 根据今日工作自动生成明日任务列表
- 智能优先级分配
- 预估耗时 + 生成理由

### 👥 CRM 客户管理
- 客户信息管理（公司、联系人、行业、阶段）
- 跟进记录时间线
- AI 客户意向分析（意向等级、成交概率、跟进建议）

### 💬 聊天分析
- 粘贴聊天记录，AI 自动分析
- 提取客户需求点、顾虑异议
- 预估成交概率
- 生成下一句回复话术

### 📚 AI 知识库
- 上传 PDF/Word/PPT/Excel 等资料
- 文件本地存储，数据完全可控
- AI 回答时自动参考知识库内容

### 📈 数据分析
- 周/月/季度工作统计
- 完成率、趋势图、分布可视化
- AI 周期总结与改进建议

### ⚙️ 技术架构
- 飞书 SSO 一键登录
- RLS 行级数据隔离，多用户数据互不干扰
- 本地文件存储，支持自部署

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
