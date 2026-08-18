import { Inject, Injectable, Logger } from '@nestjs/common';

import type {
  AiWorkAnalysis,
  DecomposedGoal,
  TomorrowPlanTask,
  AiCustomerAnalysis,
  ChatAnalysisResult,
} from '@shared/api.interface';
import type { AiProvider } from './ai.provider.interface';
import { AI_PROVIDER_TOKEN } from './ai.provider.interface';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Inject(AI_PROVIDER_TOKEN) private readonly aiProvider: AiProvider,
  ) {}

  async analyzeDailyWork(
    workRecordContent: string,
  ): Promise<AiWorkAnalysis> {
    return this.aiProvider.analyzeDailyWork(workRecordContent);
  }

  async decomposeGoal(monthlyGoalInfo: string): Promise<DecomposedGoal[]> {
    return this.aiProvider.decomposeGoal(monthlyGoalInfo);
  }

  async generateTomorrowPlan(
    inputText: string,
  ): Promise<TomorrowPlanTask[]> {
    return this.aiProvider.generateTomorrowPlan(inputText);
  }

  async analyzeCustomer(
    customerFollowRecords: string,
  ): Promise<AiCustomerAnalysis> {
    return this.aiProvider.analyzeCustomer(customerFollowRecords);
  }

  async analyzeChat(chatText: string): Promise<ChatAnalysisResult> {
    return this.aiProvider.analyzeChat(chatText);
  }

  async generateDailySuggestion(context: string): Promise<string> {
    return this.aiProvider.generateDailySuggestion(context);
  }

  async analyzeImage(imageDataUrl: string, userQuestion?: string): Promise<string> {
    return this.aiProvider.analyzeImage(imageDataUrl, userQuestion);
  }

  async *streamDailyReport(params: {
    workRecords: string;
    goalProgress: string;
    dataStatistics?: string;
    aiAnalysisSummary?: string;
  }): AsyncGenerator<string> {
    yield* this.aiProvider.streamDailyReport(params);
  }

  async *streamCoachChat(params: {
    userMessage: string;
    goalSummary?: string;
    workRecordSummary?: string;
    customerDataSummary?: string;
    knowledgeBaseSummary?: string;
    memorySummary?: string;
    recentFollowUps?: string;
  }): AsyncGenerator<string> {
    yield* this.aiProvider.streamCoachChat(params);
  }

  async *streamPeriodicSummary(params: {
    summaryType: string;
    periodData: string;
    goalCompletion: string;
    strengthsWeaknesses: string;
  }): AsyncGenerator<string> {
    yield* this.aiProvider.streamPeriodicSummary(params);
  }

  async generateChatTitle(firstMessage: string): Promise<string> {
    return this.aiProvider.generateChatTitle(firstMessage);
  }
}
