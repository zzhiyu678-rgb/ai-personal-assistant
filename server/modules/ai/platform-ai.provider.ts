import { Injectable, Logger } from '@nestjs/common';
import { CapabilityService } from '@lark-apaas/fullstack-nestjs-core';

import type {
  AiWorkAnalysis,
  DecomposedGoal,
  TomorrowPlanTask,
  AiCustomerAnalysis,
  ChatAnalysisResult,
} from '@shared/api.interface';
import type { AiProvider } from './ai.provider.interface';
import { PLUGIN_INSTANCE_IDS, PLUGIN_ACTIONS } from './ai.constants';

interface StreamChunk {
  content?: string;
  response?: string;
}

@Injectable()
export class PlatformAiProvider implements AiProvider {
  private readonly logger = new Logger(PlatformAiProvider.name);

  constructor(private readonly capabilityService: CapabilityService) {}

  async analyzeDailyWork(
    workRecordContent: string,
  ): Promise<AiWorkAnalysis> {
    try {
      const result = (await this.capabilityService
        .load(PLUGIN_INSTANCE_IDS.WORK_RECORD_ANALYSIS)
        .call(PLUGIN_ACTIONS.TEXT_TO_JSON, {
          work_record_content: workRecordContent,
        })) as Record<string, unknown>;

      return {
        qualityScore: Number(result.qualityScore) || 0,
        highlights: Array.isArray(result.highlights)
          ? (result.highlights as string[])
          : [],
        problems: Array.isArray(result.problems)
          ? (result.problems as string[])
          : [],
        suggestions: Array.isArray(result.suggestions)
          ? (result.suggestions as string[])
          : [],
        nextActions: Array.isArray(result.nextActions)
          ? (result.nextActions as string[])
          : [],
      };
    } catch (error) {
      this.logger.error(
        `Work record analysis failed: ${JSON.stringify(error)}`,
      );
      throw error;
    }
  }

  async decomposeGoal(monthlyGoalInfo: string): Promise<DecomposedGoal[]> {
    try {
      const result = (await this.capabilityService
        .load(PLUGIN_INSTANCE_IDS.GOAL_DECOMPOSE)
        .call(PLUGIN_ACTIONS.TEXT_TO_JSON, {
          monthly_goal_info: monthlyGoalInfo,
        })) as Record<string, unknown>;

      return Array.isArray(result.goals)
        ? (result.goals as DecomposedGoal[])
        : [];
    } catch (error) {
      this.logger.error(`Goal decomposition failed: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  async generateTomorrowPlan(
    inputText: string,
  ): Promise<TomorrowPlanTask[]> {
    try {
      const result = (await this.capabilityService
        .load(PLUGIN_INSTANCE_IDS.TOMORROW_PLAN)
        .call(PLUGIN_ACTIONS.TEXT_TO_JSON, {
          input_text: inputText,
        })) as Record<string, unknown>;

      return Array.isArray(result.tasks)
        ? (result.tasks as TomorrowPlanTask[])
        : [];
    } catch (error) {
      this.logger.error(
        `Tomorrow plan generation failed: ${JSON.stringify(error)}`,
      );
      throw error;
    }
  }

  async analyzeCustomer(
    customerFollowRecords: string,
  ): Promise<AiCustomerAnalysis> {
    try {
      const result = (await this.capabilityService
        .load(PLUGIN_INSTANCE_IDS.CUSTOMER_ANALYSIS)
        .call(PLUGIN_ACTIONS.TEXT_TO_JSON, {
          customer_follow_records: customerFollowRecords,
        })) as Record<string, unknown>;

      return {
        intentionLevel: String(result.intentionLevel || '中'),
        dealProbability: Number(result.dealProbability) || 0,
        concerns: Array.isArray(result.concerns)
          ? (result.concerns as string[])
          : [],
        suggestions: Array.isArray(result.suggestions)
          ? (result.suggestions as string[])
          : [],
        nextStep: String(result.nextStep || ''),
      };
    } catch (error) {
      this.logger.error(
        `Customer analysis failed: ${JSON.stringify(error)}`,
      );
      throw error;
    }
  }

  async analyzeChat(chatText: string): Promise<ChatAnalysisResult> {
    try {
      const result = (await this.capabilityService
        .load(PLUGIN_INSTANCE_IDS.CHAT_ANALYSIS)
        .call(PLUGIN_ACTIONS.TEXT_TO_JSON, {
          chat_text: chatText,
        })) as Record<string, unknown>;

      return {
        needs: Array.isArray(result.needs)
          ? (result.needs as string[])
          : [],
        concerns: Array.isArray(result.concerns)
          ? (result.concerns as string[])
          : [],
        dealProbability: Number(result.dealProbability) || 0,
        nextReply: String(result.nextReply || ''),
      };
    } catch (error) {
      this.logger.error(`Chat analysis failed: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  async *streamDailyReport(params: {
    workRecords: string;
    goalProgress: string;
    dataStatistics?: string;
    aiAnalysisSummary?: string;
  }): AsyncGenerator<string> {
    const raw = await this.capabilityService
      .load(PLUGIN_INSTANCE_IDS.DAILY_REPORT)
      .callStream(PLUGIN_ACTIONS.TEXT_GENERATE, {
        work_records: params.workRecords,
        goal_progress: params.goalProgress,
        data_statistics: params.dataStatistics ?? '',
        ai_analysis_summary: params.aiAnalysisSummary ?? '',
      });

    const iter = this.normalizeStream(raw);
    for await (const chunk of iter) {
      yield chunk.content ?? '';
    }
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
    const raw = await this.capabilityService
      .load(PLUGIN_INSTANCE_IDS.WORK_COACH_CHAT)
      .callStream(PLUGIN_ACTIONS.TEXT_GENERATE, {
        user_message: params.userMessage,
        goal_summary: params.goalSummary ?? '',
        work_record_summary: params.workRecordSummary ?? '',
        customer_data_summary: params.customerDataSummary ?? '',
        knowledge_base_summary: params.knowledgeBaseSummary ?? '',
      });

    const iter = this.normalizeStream(raw);
    for await (const chunk of iter) {
      yield chunk.content ?? '';
    }
  }

  async *streamPeriodicSummary(params: {
    summaryType: string;
    periodData: string;
    goalCompletion: string;
    strengthsWeaknesses: string;
  }): AsyncGenerator<string> {
    const raw = await this.capabilityService
      .load(PLUGIN_INSTANCE_IDS.PERIODIC_SUMMARY)
      .callStream(PLUGIN_ACTIONS.TEXT_GENERATE, {
        summary_type: params.summaryType,
        period_data: params.periodData,
        goal_completion: params.goalCompletion,
        strengths_weaknesses: params.strengthsWeaknesses,
      });

    const iter = this.normalizeStream(raw);
    for await (const chunk of iter) {
      yield chunk.content ?? '';
    }
  }

  async generateChatTitle(firstMessage: string): Promise<string> {
    let title = '';
    const raw = await this.capabilityService
      .load(PLUGIN_INSTANCE_IDS.CHAT_TITLE)
      .callStream(PLUGIN_ACTIONS.TEXT_GENERATE, {
        first_message: firstMessage,
      });

    const iter = this.normalizeStream(raw);
    for await (const chunk of iter) {
      title += chunk.content ?? '';
    }

    return title.trim().slice(0, 30) || '新对话';
  }

  async generateDailySuggestion(context: string): Promise<string> {
    let suggestion = '';
    const raw = await this.capabilityService
      .load(PLUGIN_INSTANCE_IDS.WORK_COACH_CHAT)
      .callStream(PLUGIN_ACTIONS.TEXT_GENERATE, {
        user_message: `请基于以下工作情况，给我1-2条今天最重要的工作建议，每条不超过50字，直接给出建议不要多余寒暄：\n${context}`,
        goal_summary: '',
        work_record_summary: '',
        customer_data_summary: '',
        knowledge_base_summary: '',
      });

    const iter = this.normalizeStream(raw);
    for await (const chunk of iter) {
      suggestion += chunk.content ?? '';
    }

    return suggestion.trim();
  }

  private normalizeStream(
    raw: unknown,
  ): AsyncIterable<StreamChunk> {
    const obj = raw as Record<string, unknown>;
    if (obj.output && typeof obj.output === 'object') {
      return obj.output as AsyncIterable<StreamChunk>;
    }
    return raw as AsyncIterable<StreamChunk>;
  }

  async analyzeImage(imageDataUrl: string, userQuestion?: string): Promise<string> {
    throw new Error('PlatformAiProvider does not support image analysis. Please use OpenAI provider.');
  }
}
