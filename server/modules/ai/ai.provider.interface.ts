import type {
  AiWorkAnalysis,
  DecomposedGoal,
  TomorrowPlanTask,
  AiCustomerAnalysis,
  ChatAnalysisResult,
} from '@shared/api.interface';

export interface AiProvider {
  analyzeDailyWork(workRecordContent: string): Promise<AiWorkAnalysis>;
  decomposeGoal(monthlyGoalInfo: string): Promise<DecomposedGoal[]>;
  generateTomorrowPlan(inputText: string): Promise<TomorrowPlanTask[]>;
  analyzeCustomer(
    customerFollowRecords: string,
  ): Promise<AiCustomerAnalysis>;
  analyzeChat(chatText: string): Promise<ChatAnalysisResult>;
  streamDailyReport(params: {
    workRecords: string;
    goalProgress: string;
    dataStatistics?: string;
    aiAnalysisSummary?: string;
  }): AsyncGenerator<string>;
  streamCoachChat(params: {
    userMessage: string;
    goalSummary?: string;
    workRecordSummary?: string;
    customerDataSummary?: string;
    knowledgeBaseSummary?: string;
    memorySummary?: string;
    recentFollowUps?: string;
  }): AsyncGenerator<string>;
  streamPeriodicSummary(params: {
    summaryType: string;
    periodData: string;
    goalCompletion: string;
    strengthsWeaknesses: string;
  }): AsyncGenerator<string>;
  generateChatTitle(firstMessage: string): Promise<string>;
  generateDailySuggestion(context: string): Promise<string>;
  analyzeImage(imageDataUrl: string, userQuestion?: string): Promise<string>;
}

export const AI_PROVIDER_TOKEN = 'AI_PROVIDER';
