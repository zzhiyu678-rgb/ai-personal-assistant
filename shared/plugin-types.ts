// ---- plugin:ai_chat_title_generate_1 ----
// ============================================================
// 插件 ai_chat_title_generate_1 (AI对话标题生成) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface AiChatTitleGenerateOneInput {
  /** 用户发送的第一条消息内容 */
  first_message: string;
}

/**
 * capabilityClient.load('ai_chat_title_generate_1').callStream<AiChatTitleGenerateOneOutput>('textGenerate', input)
 * 每个 chunk 就是下面这个扁平对象，字段名与 AiChatTitleGenerateOneOutput 一致，外面没有 data / choices / message 包装：
 *   {"content":"示例文本","response":"示例文本"}
 * 返回值可能是 AsyncIterable<chunk>，也可能是 { output: AsyncIterable<chunk> }，取流前先归一化。
 * 逐段累加：
 *   for await (const chunk of stream) { result += chunk.content ?? ''; }
 */
export interface AiChatTitleGenerateOneOutput {
  /** [object Object] */
  content: string;
  /** [object Object] */
  response?: string;
}
// ---- end:ai_chat_title_generate_1 ----

// ---- plugin:monthly_goal_breakdown_to_weekly_1 ----
// ============================================================
// 插件 monthly_goal_breakdown_to_weekly_1 (月度目标拆解为周目标) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface MonthlyGoalBreakdownToWeeklyOneInput {
  /** 月度目标信息及相关历史数据摘要 */
  monthly_goal_info: string;
}

/**
 * capabilityClient.load('monthly_goal_breakdown_to_weekly_1').call<MonthlyGoalBreakdownToWeeklyOneOutput>('textToJson', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { goals } = result;
 * 返回值形如：
 *   {"goals":[]}
 */
export interface MonthlyGoalBreakdownToWeeklyOneOutput {
  /** 周目标列表，items schema: {title: string(周目标名称), description: string(目标描述), startDate: string(开始日期，格式YYYY-MM-DD), endDate: string(结束日期，格式YYYY-MM-DD)} */
  goals: unknown[];
}
// ---- end:monthly_goal_breakdown_to_weekly_1 ----

// ---- plugin:chat_analysis_demand_deal_prob_1 ----
// ============================================================
// 插件 chat_analysis_demand_deal_prob_1 (客户聊天内容分析插件) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface ChatAnalysisDemandDealProbOneInput {
  /** 客户聊天记录文本 */
  chat_text: string;
}

/**
 * capabilityClient.load('chat_analysis_demand_deal_prob_1').call<ChatAnalysisDemandDealProbOneOutput>('textToJson', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { concerns, dealProbability, nextReply, ... } = result;
 * 返回值形如：
 *   {"concerns":[],"dealProbability":0,"nextReply":"示例文本","needs":[]}
 */
export interface ChatAnalysisDemandDealProbOneOutput {
  /** 客户顾虑列表，items schema: {string(顾虑内容)} */
  concerns: unknown[];
  /** 成交概率，0-100的整数 */
  dealProbability: number;
  /** 下一句话回复建议 */
  nextReply: string;
  /** 客户真实需求列表，items schema: {string(需求内容)} */
  needs: unknown[];
}
// ---- end:chat_analysis_demand_deal_prob_1 ----

// ---- plugin:generate_tomorrow_plan_1 ----
// ============================================================
// 插件 generate_tomorrow_plan_1 (AI明日计划生成) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface GenerateTomorrowPlanOneInput {
  /** 今日工作记录+目标进度+历史数据摘要的合并文本 */
  input_text: string;
}

/**
 * capabilityClient.load('generate_tomorrow_plan_1').call<GenerateTomorrowPlanOneOutput>('textToJson', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { tasks } = result;
 * 返回值形如：
 *   {"tasks":[]}
 */
export interface GenerateTomorrowPlanOneOutput {
  /** 明日任务列表，items schema: {title: string(任务标题), priority: string(优先级，可选值为HIGH/MEDIUM/LOW), estimatedTime: number(预计时间，单位分钟), reason: string(AI建议理由)} */
  tasks: unknown[];
}
// ---- end:generate_tomorrow_plan_1 ----

// ---- plugin:work_record_analysis_to_json_1 ----
// ============================================================
// 插件 work_record_analysis_to_json_1 (每日工作记录结构化分析) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface WorkRecordAnalysisToJsonOneInput {
  /** 工作记录内容，包含当日工作内容、目标完成情况摘要、历史工作记录摘要的完整文本 */
  work_record_content: string;
}

/**
 * capabilityClient.load('work_record_analysis_to_json_1').call<WorkRecordAnalysisToJsonOneOutput>('textToJson', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { problems, suggestions, nextActions, ... } = result;
 * 返回值形如：
 *   {"problems":[],"suggestions":[],"nextActions":[],"qualityScore":0,"highlights":[]}
 */
export interface WorkRecordAnalysisToJsonOneOutput {
  /** 存在的问题列表，items schema: {string(具体问题描述)} */
  problems: unknown[];
  /** 改进建议列表，items schema: {string(具体建议内容)} */
  suggestions: unknown[];
  /** 下一步行动列表，items schema: {string(具体行动内容)} */
  nextActions: unknown[];
  /** 完成质量评分，0-100的整数 */
  qualityScore: number;
  /** 亮点总结列表，items schema: {string(具体亮点描述)} */
  highlights: unknown[];
}
// ---- end:work_record_analysis_to_json_1 ----

// ---- plugin:work_coach_ai_chat_1 ----
// ============================================================
// 插件 work_coach_ai_chat_1 (工作教练AI对话助手) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface WorkCoachAiChatOneInput {
  /** 用户当前发送的消息内容 */
  user_message: string;
  /** 用户的工作目标摘要信息 */
  goal_summary?: string;
  /** 用户的历史工作记录摘要 */
  work_record_summary?: string;
  /** 相关客户数据摘要信息 */
  customer_data_summary?: string;
  /** 相关知识库内容摘要 */
  knowledge_base_summary?: string;
}

/**
 * capabilityClient.load('work_coach_ai_chat_1').callStream<WorkCoachAiChatOneOutput>('textGenerate', input)
 * 每个 chunk 就是下面这个扁平对象，字段名与 WorkCoachAiChatOneOutput 一致，外面没有 data / choices / message 包装：
 *   {"response":"示例文本","content":"示例文本"}
 * 返回值可能是 AsyncIterable<chunk>，也可能是 { output: AsyncIterable<chunk> }，取流前先归一化。
 * 逐段累加：
 *   for await (const chunk of stream) { result += chunk.response ?? ''; }
 */
export interface WorkCoachAiChatOneOutput {
  /** [object Object] */
  response?: string;
  /** [object Object] */
  content: string;
}
// ---- end:work_coach_ai_chat_1 ----

// ---- plugin:daily_report_generate_1 ----
// ============================================================
// 插件 daily_report_generate_1 (AI日报生成插件) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface DailyReportGenerateOneInput {
  /** 今日完成的工作记录明细 */
  work_records: string;
  /** 今日工作相关的数据统计结果 */
  data_statistics?: string;
  /** 当前阶段目标的完成进度情况 */
  goal_progress: string;
  /** AI对今日工作的初步分析摘要 */
  ai_analysis_summary?: string;
}

/**
 * capabilityClient.load('daily_report_generate_1').callStream<DailyReportGenerateOneOutput>('textGenerate', input)
 * 每个 chunk 就是下面这个扁平对象，字段名与 DailyReportGenerateOneOutput 一致，外面没有 data / choices / message 包装：
 *   {"content":"示例文本","response":"示例文本"}
 * 返回值可能是 AsyncIterable<chunk>，也可能是 { output: AsyncIterable<chunk> }，取流前先归一化。
 * 逐段累加：
 *   for await (const chunk of stream) { result += chunk.content ?? ''; }
 */
export interface DailyReportGenerateOneOutput {
  /** [object Object] */
  content: string;
  /** [object Object] */
  response?: string;
}
// ---- end:daily_report_generate_1 ----

// ---- plugin:periodic_work_summary_generator_1 ----
// ============================================================
// 插件 periodic_work_summary_generator_1 (AI周期工作总结生成) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface PeriodicWorkSummaryGeneratorOneInput {
  /** 总结类型，可选值：周总结、月总结 */
  summary_type: string;
  /** 周期内数据汇总 */
  period_data: string;
  /** 目标完成情况说明 */
  goal_completion: string;
  /** 亮点与不足分析 */
  strengths_weaknesses: string;
}

/**
 * capabilityClient.load('periodic_work_summary_generator_1').callStream<PeriodicWorkSummaryGeneratorOneOutput>('textGenerate', input)
 * 每个 chunk 就是下面这个扁平对象，字段名与 PeriodicWorkSummaryGeneratorOneOutput 一致，外面没有 data / choices / message 包装：
 *   {"response":"示例文本","content":"示例文本"}
 * 返回值可能是 AsyncIterable<chunk>，也可能是 { output: AsyncIterable<chunk> }，取流前先归一化。
 * 逐段累加：
 *   for await (const chunk of stream) { result += chunk.response ?? ''; }
 */
export interface PeriodicWorkSummaryGeneratorOneOutput {
  /** [object Object] */
  response?: string;
  /** [object Object] */
  content: string;
}
// ---- end:periodic_work_summary_generator_1 ----

// ---- plugin:ai_customer_intention_analysis_1 ----
// ============================================================
// 插件 ai_customer_intention_analysis_1 (AI客户意向分析) 的类型定义
// 由 get_plugin_ai_json 自动生成
// ============================================================

export interface AiCustomerIntentionAnalysisOneInput {
  /** 客户资料及全部跟进记录内容 */
  customer_follow_records: string;
}

/**
 * capabilityClient.load('ai_customer_intention_analysis_1').call<AiCustomerIntentionAnalysisOneOutput>('textToJson', input)
 * 直接返回此类型，无 .data 包装，直接解构使用：
 * const { intentionLevel, dealProbability, concerns, ... } = result;
 * 返回值形如：
 *   {"intentionLevel":"示例文本","dealProbability":0,"concerns":[],"suggestions":[],"nextStep":"示例文本"}
 */
export interface AiCustomerIntentionAnalysisOneOutput {
  /** 客户意向等级，可选值：高、中、低 */
  intentionLevel: string;
  /** 成交概率，0-100之间的整数 */
  dealProbability: number;
  /** 客户顾虑列表，items schema: {string(客户顾虑内容)} */
  concerns: unknown[];
  /** 沟通建议列表，items schema: {string(具体沟通建议内容)} */
  suggestions: unknown[];
  /** 下一步具体行动建议 */
  nextStep: string;
}
// ---- end:ai_customer_intention_analysis_1 ----