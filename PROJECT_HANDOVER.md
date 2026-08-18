# AI Work Coach 项目交接文档

> 本文档基于实际源码生成，用于交接给下一位 AI 编程助手继续开发。
> 生成时间：2026-08-18
> 项目位置：`D:\ai work\project`

---

## 一、项目概览

| 项目 | 说明 |
|------|------|
| 项目名称 | AI Work Coach（AI 个人工作教练） |
| 定位 | 个人使用 + GitHub 开源 + 自部署网页版 AI 私人助理 |
| 核心价值 | 用户记录每日工作，AI 自动分析、生成日报、提供销售建议 |
| 技术栈 | NestJS 10 + React 19 + TypeScript + Drizzle ORM + PostgreSQL + Tailwind CSS + OpenAI API |
| 认证方式 | 飞书 SSO（平台模式）/ 本地开发模式（绕过认证，固定用户） |
| Node 要求 | >= 22（当前环境为 v20，openai 包有警告但可运行） |

---

## 二、技术架构

### 2.1 目录结构

```
project/
├── client/                    # React 前端
│   └── src/
│       ├── pages/             # 11 个页面
│       ├── components/        # Layout、ProtectedRoute、UI组件、business-ui
│       ├── api/               # 13 个 API 封装文件
│       ├── hooks/             # useAutoSave 等
│       ├── app.tsx            # 路由配置
│       └── index.tsx          # 入口（AppContainer 包裹）
├── server/
│   ├── modules/               # 15 个后端模块
│   ├── database/schema.ts     # Drizzle schema（自动生成，含自定义类型）
│   ├── local/                 # 本地开发模式（dev-database.module、init.sql）
│   ├── common/                # 全局异常过滤器、接口定义
│   ├── main.ts                # 入口（支持本地/平台双模式）
│   └── app.module.ts          # 根模块（条件导入数据库模块）
├── shared/                    # 前后端共享类型定义
├── uploads/                   # 本地上传文件目录（运行时生成）
├── .env                       # 环境变量（当前配置为本地开发模式）
├── package.json
├── vite.config.ts             # 使用 @lark-apaas/fullstack-vite-preset
└── 启动AI工作教练.bat/.ps1    # Windows 一键启动脚本
```

### 2.2 双模式运行机制

项目支持两种运行模式，通过 `.env` 中的 `LOCAL_DEV` 环境变量切换：

| 模式 | LOCAL_DEV | 认证 | 数据库 | AI |
|------|-----------|------|--------|-----|
| 本地开发 | true | 绕过，固定用户 `local-dev-user` | 本地 PostgreSQL | OpenAI API 直连 |
| 平台部署 | false | 飞书 SSO | 平台托管数据库 + RLS | 平台插件（可选） |

**关键切换点：**
- `server/main.ts`：本地模式跳过 `configureApp()`，注入模拟 `req.userContext`
- `server/app.module.ts`：本地模式用 `DevDatabaseModule` 替代 `PlatformModule.forRoot()`
- `server/modules/ai/ai.module.ts`：`AI_PROVIDER=openai` 时不加载 `PlatformAiProvider`
- 所有子模块已移除 `PlatformModule` 导入（`DRIZZLE_DATABASE` 由全局模块提供）
- `client/src/components/ProtectedRoute.tsx`：`VITE_LOCAL_DEV=true` 时跳过登录校验
- `client/src/components/Layout.tsx`：本地模式显示「本地用户」，退出登录禁用

---

## 三、数据库

### 3.1 数据库信息

- **类型**：PostgreSQL 17（已安装，服务名 `postgresql-x64-17`，自动启动）
- **数据库名**：`ai_work_coach`
- **连接**：`postgresql://postgres:postgres@localhost:5432/ai_work_coach`
- **初始化脚本**：`server/local/init.sql`

### 3.2 数据表（10 张，全部已创建）

| 表名 | 用途 | 关键字段 |
|------|------|----------|
| `goal` | 目标管理 | type(YEAR/MONTH/WEEK), title, status, parent_id(自关联) |
| `daily_record` | 每日工作记录 | record_date(唯一), plan, completed, problems, tomorrow_ideas, ai_analysis(jsonb) |
| `task` | 任务 | title, priority, status, goal_id, daily_record_id, is_ai_suggested |
| `customer` | CRM客户 | company, contact_name, stage, ai_analysis(jsonb) |
| `customer_follow_up` | 客户跟进 | customer_id, content, follow_type, ai_suggestion |
| `ai_conversation` | AI对话 | title |
| `ai_message` | AI消息 | conversation_id, role(user/assistant), content |
| `knowledge_file` | 知识库文件 | file_name, file_type, file_path, **extracted_text(始终为空)** |
| `report` | 日报 | report_date, type, content(jsonb), full_text |
| `memory` | AI长期记忆 | type(PROFILE/WORK_STYLE/SALES_STYLE/PREFERENCE), content, source |

### 3.3 数据隔离机制

- 所有表含 `_created_by` 字段（PostgreSQL 自定义类型 `user_profile`，结构 `(user_id text)`）
- 所有 Service 层查询使用 `(_created_by).user_id = userId` 过滤
- 写操作校验归属权，非本人数据返回 403
- **注意**：本地模式未启用 PostgreSQL RLS 行级安全策略，仅靠应用层过滤

### 3.4 自定义类型

```sql
CREATE TYPE user_profile AS (user_id text);
CREATE TYPE file_attachment AS (bucket_id text, file_path text);
```
Drizzle schema 中通过 `customType` 映射，`toDriver` 转为 `ROW(?)::user_profile`。

---

## 四、认证系统

### 4.1 当前状态

**没有自建用户体系**。两种模式：

| 模式 | 认证方式 | 用户标识 |
|------|----------|----------|
| 本地开发 | 中间件注入 `req.userContext = {userId: 'local-dev-user'}` | 固定用户 |
| 平台部署 | 飞书 SSO + `@NeedLogin()` 守卫 | 平台 userId |

### 4.2 关键文件

- `server/main.ts`：本地模式注入用户上下文
- `server/local/dev-database.module.ts`：本地数据库连接（`@Global()`，提供 `DRIZZLE_DATABASE` token）
- `client/src/components/ProtectedRoute.tsx`：前端路由守卫（条件跳过）
- `client/src/components/Layout.tsx`：用户信息展示（条件显示本地用户）

### 4.3 平台依赖残留

所有 Controller 仍使用 `@NeedLogin()` 装饰器（从 `@lark-apaas/fullstack-nestjs-core` 导入）。本地模式下该装饰器的守卫因 `req.userContext` 已被注入而放行。

---

## 五、AI 系统

### 5.1 AI 服务架构

```
AiService (统一入口，方法签名不变)
    ↓ 委托
AI_PROVIDER_TOKEN (工厂选择)
    ├── OpenAiService (默认，本地模式)
    └── PlatformAiProvider (平台插件，AI_PROVIDER=platform 时)
```

### 5.2 OpenAiService 已实现方法（10 个）

文件：`server/modules/ai/openai.service.ts`

| 方法 | 用途 | 输出方式 | 状态 |
|------|------|----------|------|
| `analyzeDailyWork()` | 工作记录分析 | JSON + zod校验 | ✅ 完成 |
| `decomposeGoal()` | 月目标拆解为周目标 | JSON + zod校验 | ✅ 完成 |
| `generateTomorrowPlan()` | 生成明日计划 | JSON + zod校验 | ✅ 完成 |
| `analyzeCustomer()` | 客户意向分析 | JSON + zod校验 | ✅ 完成 |
| `analyzeChat()` | 聊天分析 | JSON + zod校验 | ✅ 完成 |
| `streamDailyReport()` | 日报生成 | SSE 流式 | ✅ 完成 |
| `streamCoachChat()` | AI教练对话 | SSE 流式 | ✅ 完成 |
| `streamPeriodicSummary()` | 周期总结 | SSE 流式 | ✅ 完成 |
| `generateChatTitle()` | 对话标题 | 非流式 | ✅ 完成 |
| `generateDailySuggestion()` | 每日建议 | 非流式 | ✅ 完成 |

**JSON 输出**：使用 `response_format: {type: 'json_object'}` + zod schema 校验，失败重试 1 次。

### 5.3 AI 教练上下文（6 源聚合）

文件：`server/modules/ai-conversation/ai-conversation.service.ts` → `buildContext()`

| 上下文源 | 取数逻辑 | 限制 |
|----------|----------|------|
| 目标 | 最近 5 条 goal | 标题+状态+截止日期 |
| 工作记录 | 最近 7 天 daily_record | 完成内容+AI评分+亮点 |
| 客户 | 最近 5 个 customer | 公司+阶段+行业+成交概率 |
| 知识库 | 最近 5 个 knowledge_file | 文件名+类型+extractedText摘要 |
| 长期记忆 | 全部 memory | 按类型分组 |
| 跟进记录 | 最近 5 条 follow_up | 关联客户公司+内容 |

**AI 角色**：10 年 B2B 销售总监 + 私人工作教练，system prompt 已写入 `streamCoachChat()`。

### 5.4 AI 配置

```env
AI_PROVIDER=openai          # openai / platform
OPENAI_API_KEY=             # 必填，当前为空
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

**当前 OPENAI_API_KEY 为空，AI 功能会报错。**

---

## 六、功能模块状态

### 6.1 已完成（可正常使用）

| 模块 | 页面路由 | 后端 | 说明 |
|------|----------|------|------|
| Dashboard | `/` | ✅ | 今日状态卡片、AI一句话提醒、数据统计、快捷入口 |
| 目标管理 | `/goals` | ✅ | 年/月/周目标 CRUD、AI拆解、层级关联 |
| 今日记录 | `/work/today` | ✅ | 单输入框自然语言输入、AI分析三板块、历史记录、自动保存草稿 |
| AI顾问 | `/assistant` | ✅ | 流式对话、6源上下文、自动标题、对话管理 |
| 工作日报 | `/report` | ✅ | AI生成日报、复制、导出PDF |
| 明日计划 | `/plan/tomorrow` | ✅ | AI生成优先级任务 |
| CRM客户 | `/crm` | ✅ | 客户CRUD、阶段管理、跟进记录、AI意向分析 |
| 聊天分析 | `/chat-analysis` | ✅ | 粘贴聊天→AI分析需求/顾虑/成交概率/下一句建议 |
| 数据分析 | `/analytics` | ✅ | 图表展示、AI周期总结 |
| AI记忆 | `/memory` | ✅ | 4类记忆CRUD、AI对话上下文自动引用 |
| 文件上传 | 知识库内 | ✅ | 本地存储、类型校验(MIME+文件头)、归属校验 |

### 6.2 部分完成

| 模块 | 已完成 | 缺失 |
|------|--------|------|
| **知识库** | 文件上传/列表/删除/下载/预览 | **文本提取未实现**——`extracted_text` 始终为空字符串，AI无法读取知识库内容 |
| **自动保存** | localStorage 草稿恢复、30秒debounce | 后端草稿持久化未做 |
| **AI自动提取记忆** | 手动创建记忆、对话上下文引用 | 从工作记录中自动提取长期记忆的逻辑未实现 |

### 6.3 未完成

| 功能 | 说明 |
|------|------|
| 用户注册/登录 | 无自建用户表，仅飞书SSO或本地绕过 |
| 忘记密码 | 不存在 |
| PDF/Word/PPT 文本解析 | 知识库上传后不提取内容 |
| 语音转文字 | 接口预留，未实现 |
| Docker 部署 | 无 Dockerfile / docker-compose |
| 团队版/多用户 | 单用户设计 |
| 微信聊天记录导入 | 未开始 |

---

## 七、平台依赖清单

### 7.1 仍在代码中的平台依赖

| 包名 | 用途 | 可否移除 |
|------|------|----------|
| `@lark-apaas/fullstack-nestjs-core` | `@NeedLogin()` 装饰器、`DRIZZLE_DATABASE` token、`PostgresJsDatabase` 类型、`CapabilityService`(仅fallback) | 需自建守卫+数据库provider后可移除 |
| `@lark-apaas/client-toolkit` | `authClient`（ProtectedRoute 中条件动态导入）、`AppContainer`（index.tsx）、`axiosForBackend`（api层） | 需自建认证+请求层后可移除 |
| `@lark-apaas/fullstack-vite-preset` | Vite 构建配置 | 可替换为自写 vite.config |
| `@lark-apaas/fullstack-presets` | 配置预设（间接依赖） | 同上 |

### 7.2 已移除的平台依赖

| 原依赖 | 替换方案 |
|--------|----------|
| 平台 AI 插件 (CapabilityService) | OpenAiService 直连 |
| dataloom 文件存储 | 本地 multer + uploads/ 目录 |
| 子模块 PlatformModule 导入 | DevDatabaseModule 全局提供 |
| `postinstall: fullstack-cli` | 已从 package.json 移除 |

---

## 八、API 接口清单

### 认证相关
无（本地模式绕过，平台模式飞书SSO）

### 业务接口（均需 `@NeedLogin()`）

| 模块 | 方法 | 路径 | 说明 |
|------|------|------|------|
| dashboard | GET | `/api/dashboard/today` | 今日数据 |
| goal | GET/POST/PUT/DELETE | `/api/goals` | 目标CRUD |
| goal | POST | `/api/goals/:id/decompose` | AI拆解目标 |
| daily-record | GET | `/api/daily-records/:date` | 获取某日记录 |
| daily-record | PUT | `/api/daily-records/:date` | 保存记录 |
| daily-record | POST | `/api/daily-records/:date/analyze` | AI分析 |
| daily-record | POST | `/api/daily-records/:date/analyze-from-content` | 自然语言分析 |
| daily-record | PUT | `/api/daily-records/:date/analysis` | 更新分析结果 |
| daily-record | GET | `/api/daily-records` | 记录列表 |
| task | GET/POST/PUT/DELETE | `/api/tasks` | 任务CRUD |
| crm | GET/POST/PUT/DELETE | `/api/customers` | 客户CRUD |
| crm | GET | `/api/customers/:id/follow-ups` | 跟进列表 |
| crm | POST | `/api/customers/:id/follow-ups` | 新增跟进 |
| crm | POST | `/api/customers/:id/analyze` | AI客户分析 |
| chat-analysis | POST | `/api/chat-analysis` | 聊天分析 |
| report | GET/POST | `/api/reports` | 日报列表/生成 |
| report | GET | `/api/reports/:id` | 日报详情 |
| ai-conversation | GET/POST/DELETE | `/api/ai-conversations` | 对话管理 |
| ai-conversation | GET | `/api/ai-conversations/:id/messages` | 消息列表 |
| ai-conversation | POST | `/api/ai-conversations/:id/stream-chat` | 流式对话 |
| knowledge | GET/POST/DELETE | `/api/knowledge-files` | 知识库文件 |
| files | POST | `/api/files/upload` | 文件上传 |
| files | GET | `/api/files/:id` | 文件下载/预览 |
| files | DELETE | `/api/files/:id` | 删除文件 |
| memory | GET/POST/PUT/DELETE | `/api/memories` | 记忆CRUD |
| analytics | GET | `/api/analytics/summary` | 数据统计 |
| analytics | POST | `/api/analytics/generate-report` | AI总结 |

---

## 九、已知问题

### 🔴 高优先级

1. **知识库文本提取缺失**：`knowledge_file.extracted_text` 始终为空，AI 教练无法读取知识库内容。需要集成 pdf-parse、mammoth(docx)、xlsx 等解析库。
2. **OPENAI_API_KEY 未配置**：`.env` 中为空，所有 AI 功能会抛出 "OPENAI_API_KEY 未配置" 错误。
3. **.env 文件编码问题**：中文注释在 PowerShell 中显示乱码（UTF-8 BOM 问题），但应用读取正常。建议重写为英文注释或确保 UTF-8 无 BOM。

### 🟡 中优先级

4. **hello 模块残留**：`server/modules/hello/` 是模板遗留，无实际用途，可删除。
5. **FilesController 重复配置**：内联了 multer diskStorage 配置，同时导入了 `createMulterStorage` 但未使用。应统一。
6. **view.controller.ts 引用平台数据**：`req.__platform_data__` 在本地模式下为 undefined，返回 `{}` 不影响运行但不优雅。
7. **Node 版本不匹配**：当前 v20，项目要求 v22，openai@7.4.0 有 EBADENGINE 警告。
8. **无 RLS**：本地模式仅靠应用层过滤，数据库层未启用行级安全。
9. **AppContainer 平台依赖**：`client/src/index.tsx` 使用 `@lark-apaas/client-toolkit` 的 AppContainer 和 ErrorRender，未替换。

### 🟢 低优先级

10. **前端 axiosForBackend**：API 层仍使用平台封装的 axios，未替换为原生 axios。
11. **无测试**：package.json 有 jest 配置但无测试文件。
12. **server.log / server-error.log**：根目录有运行日志文件，应加入 .gitignore。

---

## 十、启动方式

### 本地开发（当前配置）

```bash
# 前置：PostgreSQL 17 已安装并运行，数据库已初始化
cd D:\ai work\project
npm install
npm run dev
# 访问 http://localhost:3000
```

或双击桌面快捷方式「AI工作教练」。

### 环境变量（.env）

```env
LOCAL_DEV=true
VITE_LOCAL_DEV=true
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_work_coach
DEV_USER_ID=local-dev-user
AI_PROVIDER=openai
OPENAI_API_KEY=sk-xxx          # 必须填写
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
PORT=3000
```

### 数据库初始化（如需要）

```bash
psql -U postgres -c "CREATE DATABASE ai_work_coach;"
psql -U postgres -d ai_work_coach -f server/local/init.sql
```

---

## 十一、未来需求（用户已提出但未实施）

1. **知识库文本提取**：上传 PDF/Word/PPT/Excel 后自动提取文本，供 AI 引用
2. **自建用户体系**：邮箱密码注册登录（用户曾要求但后来决定保留飞书SSO）
3. **Docker 部署**：Dockerfile + docker-compose（PostgreSQL + app）
4. **AI 自动提取记忆**：从每日工作记录中自动识别长期有效信息
5. **语音转文字**：工作记录支持语音输入
6. **微信聊天记录导入分析**
7. **GitHub 开源发布**：清理敏感信息、完善 README、选择 LICENSE（当前为 MIT）

---

## 十二、给下一个 AI 的启动提示词

```
你是一位资深全栈工程师，接手 AI Work Coach 项目的继续开发。

## 项目位置
D:\ai work\project

## 项目现状
这是一个基于 NestJS + React + PostgreSQL + OpenAI API 的个人 AI 工作教练应用。
当前运行在本地开发模式（LOCAL_DEV=true），绕过飞书 SSO，使用本地 PostgreSQL。

## 你必须先做的事
1. 阅读 PROJECT_HANDOVER.md（本文件）了解完整架构
2. 确认 .env 中 OPENAI_API_KEY 已填写（当前为空，AI 功能不可用）
3. 运行 npm install && npm run dev 确认项目可启动
4. 访问 http://localhost:3000 验证基础功能

## 最高优先级待办
1. 【知识库文本提取】knowledge_file.extracted_text 始终为空，需要集成 pdf-parse/mammoth/xlsx
   等解析库，在文件上传后自动提取文本并存入数据库。AI 教练的 buildKnowledgeSummary()
   已经在读取 extracted_text，只需填充数据即可生效。
2. 【配置 OpenAI API Key】在 .env 中填写 OPENAI_API_KEY，否则所有 AI 功能报错。

## 关键约束
- 不要修改 _created_by 数据隔离体系
- 不要移除本地开发模式（LOCAL_DEV 双模式机制）
- 所有新 API 必须加 @NeedLogin() 并在 Service 层用 userId 过滤
- AI 功能统一走 AiService → OpenAiService，不要在业务模块直接调用 OpenAI
- 前端页面在 client/src/pages/，路由在 client/src/app.tsx
- 数据库 schema 在 server/database/schema.ts（自动生成，修改表结构需同步 init.sql）

## 代码风格
- 后端：NestJS 模块化，Controller → Service → Drizzle 查询
- 前端：React 函数组件 + Tailwind CSS + shadcn/ui 组件
- 共享类型在 shared/api.interface.ts

## 完成标准
每个功能完成后：
1. 后端 tsc --noEmit 通过
2. 前端 tsc --noEmit 通过
3. 手动测试对应页面功能正常
4. 更新 PROJECT_HANDOVER.md 中的状态
```

---

## 附录：关键文件速查

| 需求 | 文件路径 |
|------|----------|
| AI 核心逻辑 | `server/modules/ai/openai.service.ts` |
| AI 对话上下文 | `server/modules/ai-conversation/ai-conversation.service.ts` |
| 数据库 Schema | `server/database/schema.ts` |
| 本地数据库初始化 | `server/local/init.sql` |
| 本地模式入口 | `server/main.ts`、`server/app.module.ts` |
| 前端路由 | `client/src/app.tsx` |
| 前端布局/导航 | `client/src/components/Layout.tsx` |
| 今日记录页面 | `client/src/pages/work/WorkTodayPage.tsx` |
| AI 顾问页面 | `client/src/pages/assistant/AssistantPage.tsx` |
| 文件上传 | `server/modules/files/files.controller.ts` |
| 知识库 | `server/modules/knowledge/knowledge.service.ts` |
| 共享类型 | `shared/api.interface.ts` |
| 环境变量 | `.env` |
| 启动脚本 | `启动AI工作教练.bat` |
