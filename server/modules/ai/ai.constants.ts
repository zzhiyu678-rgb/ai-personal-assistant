export const PLUGIN_INSTANCE_IDS = {
  WORK_RECORD_ANALYSIS: 'work_record_analysis_to_json_1',
  GOAL_DECOMPOSE: 'monthly_goal_breakdown_to_weekly_1',
  TOMORROW_PLAN: 'generate_tomorrow_plan_1',
  CUSTOMER_ANALYSIS: 'ai_customer_intention_analysis_1',
  CHAT_ANALYSIS: 'chat_analysis_demand_deal_prob_1',
  DAILY_REPORT: 'daily_report_generate_1',
  WORK_COACH_CHAT: 'work_coach_ai_chat_1',
  PERIODIC_SUMMARY: 'periodic_work_summary_generator_1',
  CHAT_TITLE: 'ai_chat_title_generate_1',
} as const;

export const PLUGIN_ACTIONS = {
  TEXT_TO_JSON: 'textToJson',
  TEXT_GENERATE: 'textGenerate',
} as const;
