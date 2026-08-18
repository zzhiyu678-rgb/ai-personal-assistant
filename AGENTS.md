# UI 设计指南

> **设计类型**: App 设计（应用架构设计）
> **确认检查**: 本指南适用于可交互的应用/网站/工具。

> ℹ️ Section 1 为设计意图与决策上下文。Code agent 实现时以 Section 2 及之后的具体参数为准。

## 1. Design Archetype (设计原型)

### 1.1 内容理解

- **目标用户**: 个人销售/知识工作者，高频使用（日均3-5次），期望获得掌控感与成长反馈
- **核心目的**: 引导行动 + 建立信任（AI教练人设需专业可信，非冷冰冰工具）
- **情绪基调**: 专注、安心 / 避免焦虑、信息过载

### 1.2 设计方向

- **Design Style**: Soft Blocks 柔色块 — AI教练需亲和力，柔和阴影+低饱和底色营造"陪伴感"而非"监控感"
- **Application Type**: Admin/SaaS（个人工作管理系统）— 左侧边栏+顶栏布局，高视口利用率
- **Aesthetic Direction**: 克制的蓝灰基调+AI专属渐变签名，让"教练反馈"成为视觉锚点而非装饰噪音

## 2. Color System (色彩系统)

**色彩关系**: 钢蓝主色(hsl(217,78%,51%)) + 冷灰底(hsl(220,20%,97%)) + 深墨文字(hsl(222,47%,11%))
**配色设计理由**: 蓝灰传递专业信任感，避免纯蓝的廉价SaaS感；冷灰底减少长时间使用的视觉疲劳
**主色推导**: Primary 对应"教练行动指令"（保存分析/生成日报/AI拆解），收敛于关键CTA按钮与AI建议卡片边框
**使用比例**: 60% 中性底色 / 30% 卡片白 / 10% Primary 强调；AI建议卡片用 primary 10% 透明度背景作视觉焦点

### 2.1 主题颜色

| Token                | HSL 值              | 说明                                  |
| -------------------- | ------------------- | ------------------------------------- |
| `background`         | hsl(220, 20%, 97%)  | 页面底色，冷灰调减少疲劳              |
| `card`               | hsl(0, 0%, 100%)    | 卡片/容器背景                         |
| `foreground`         | hsl(222, 47%, 11%)  | 主文字                                |
| `muted-foreground`   | hsl(220, 9%, 46%)   | 次要文字                              |
| `primary`            | hsl(217, 78%, 51%)  | 主交互色（教练行动指令）              |
| `primary-foreground` | hsl(0, 0%, 100%)    | 主交互文字/图标                       |
| `accent`             | hsl(217, 60%, 95%)  | 次级交互反馈（hover/focus/骨架屏）    |
| `accent-foreground`  | hsl(217, 78%, 40%)  | accent 上的文字/图标                  |
| `border`             | hsl(220, 13%, 91%)  | 边框                                  |

### 2.2 导航区配色

- **基调关系**: 侧边栏复用 `background` 底色，通过右侧 1px `border` 与内容区分隔；激活项用 `accent` 背景+`primary` 文字
- **关键状态**: 默认 `muted-foreground` → Hover `foreground` → Active `primary` + `accent` 背景；对比度 ≥ 4.5:1
- **边界与背景**: 非透明背景；右侧细线分隔；移动端折叠后保持相同配色逻辑

### 2.3 语义颜色

| 用途     | HSL 值             | 衍生说明                          |
| -------- | ------------------ | --------------------------------- |
| 成功/完成 | hsl(152, 60%, 40%) | 边框中饱和，背景 hsl(152,60%,96%) |
| 警告/问题 | hsl(38, 90%, 45%)  | 大字号文字用此值，小字号用深色变体 |
| 错误/高优 | hsl(0, 72%, 50%)   | 明日计划高优先级左边界、删除操作  |

## 3. Typography (字体排版)

- **Heading**: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif
- **Body**: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif
- **字体策略**: Inter 兼顾西文数字对齐与中文混排可读性；标题 font-bold/extrabold vs 正文 font-normal 形成层级；数据指标用 tabular-nums 确保等宽对齐

## 4. Layout Strategy (布局策略)

- **导航意图**: 应用概要设计已声明左侧边栏+顶栏；至多一套全局导航；侧边栏含10个入口（仪表盘/目标/今日记录/AI助手/日报/明日计划/CRM/聊天分析/知识库/数据分析），顶栏含用户头像与设置
- **页面架构**: 经典 SaaS Shell 布局；内容区 `max-w-[1400px]` 居中，左右留白呼吸
- **响应式**: 桌面端侧边栏常驻；移动端侧边栏收纳为汉堡菜单，内容区全宽；AI助手对话页移动端隐藏历史列表仅保留当前会话

## 5. Visual Language (视觉语言)

- **形态参数**: 圆角 `rounded-lg (0.5rem)` · 阴影 `shadow-sm` for cards · 间距基调 `standard (gap-4/p-6)`
- **识别签名**: AI建议卡片左侧 4px primary 竖线+微发光渐变背景；客户阶段标签从灰到绿渐变色阶；成交概率环形进度条动画
- **装饰策略**: 仅AI相关区块使用 primary 渐变/发光；其余区域零装饰，靠留白与层级建立节奏
- **动效原则**: 快速响应 150-200ms；AI分析结果逐条上浮淡入；图表切换平滑过渡
- **可及性**: 对比度 ≥ 4.5:1；AI建议卡片渐变背景上文字加 text-shadow；交互元素 focus-visible ring-2 ring-primary/50

## 6. Component Principles (组件原则)

- **状态完整性**: Button/Input/Card/Tab 覆盖 Default/Hover/Focus/Active/Disabled；Primary 按钮 hover 亮度+5%，focus ring-2 offset-2
- **层级清晰**: Primary 填充蓝底白字；Secondary/Ghost 用 accent 背景+foreground 文字；表单 Focus border-primary ring-1；Error border-destructive + 红色提示文字
- **一致性**: 所有卡片统一 rounded-lg shadow-sm p-6；状态标签统一 pill 形状+语义色背景；颜色只用 Color System token

## 7. Image Direction (图片与视觉资产，按需)

- **Image Role**: 无强制图片需求，优先通过排版、色彩和局部图形建立视觉记忆点
- **Image Art Direction**: 无
- **Image Prompt Keywords**: 无
- **Image Avoidance**: 禁止通用AI机器人插画、商务握手素材、抽象科技粒子背景；AI教练身份通过UI组件（头像占位符+蓝色竖线+渐变卡片）表达，不依赖外部图片

## 8. 应避免 (Anti-patterns)

- 避免大面积高饱和蓝色铺底——易造成视觉疲劳，削弱AI建议卡片的焦点作用
- 避免在CRM/数据分析页添加装饰性插图——数据密集场景需克制，让图表本身成为视觉重心
- 避免AI分析结果使用纯文本堆砌——必须结构化分板块+图标+左侧色条，强化"教练反馈"仪式感