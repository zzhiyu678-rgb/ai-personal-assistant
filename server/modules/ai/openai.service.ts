import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { z } from 'zod';

import type {
  AiWorkAnalysis,
  DecomposedGoal,
  TomorrowPlanTask,
  AiCustomerAnalysis,
  ChatAnalysisResult,
} from '@shared/api.interface';

const workAnalysisSchema = z.object({
  qualityScore: z.number(),
  highlights: z.array(z.string()),
  problems: z.array(z.string()),
  suggestions: z.array(z.string()),
  nextActions: z.array(z.string()),
});

const goalsSchema = z.object({
  goals: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      startDate: z.string(),
      endDate: z.string(),
    }),
  ),
});

const tasksSchema = z.object({
  tasks: z.array(
    z.object({
      title: z.string(),
      priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
      estimatedTime: z.number(),
      reason: z.string(),
    }),
  ),
});

const customerAnalysisSchema = z.object({
  intentionLevel: z.string(),
  dealProbability: z.number(),
  concerns: z.array(z.string()),
  suggestions: z.array(z.string()),
  nextStep: z.string(),
});

const chatAnalysisSchema = z.object({
  needs: z.array(z.string()),
  concerns: z.array(z.string()),
  dealProbability: z.number(),
  nextReply: z.string(),
});

type WorkAnalysisOutput = z.infer<typeof workAnalysisSchema>;
type GoalsOutput = z.infer<typeof goalsSchema>;
type TasksOutput = z.infer<typeof tasksSchema>;
type CustomerAnalysisOutput = z.infer<typeof customerAnalysisSchema>;
type ChatAnalysisOutput = z.infer<typeof chatAnalysisSchema>;

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  private client: OpenAI | null = null;
  private readonly model: string;
  private readonly apiKey?: string;
  private readonly baseURL: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('DOUBAO_API_KEY') || this.configService.get<string>('OPENAI_API_KEY');
    this.baseURL = this.configService.get<string>('DOUBAO_BASE_URL') ||
      this.configService.get<string>('OPENAI_BASE_URL') ||
      'https://api.openai.com/v1';
    this.model = this.configService.get<string>('DOUBAO_MODEL') ||
      this.configService.get<string>('OPENAI_MODEL') ||
      'gpt-4o-mini';
  }

  private getClient(): OpenAI {
    if (!this.client) {
      if (!this.apiKey) {
        throw new BadRequestException(
          '请先配置豆包 AI API Key。在项目根目录 .env 文件中设置 DOUBAO_API_KEY=your_key，然后重启服务。',
        );
      }
      this.client = new OpenAI({ apiKey: this.apiKey, baseURL: this.baseURL });
    }
    return this.client;
  }

  async analyzeDailyWork(
    workRecordContent: string,
  ): Promise<AiWorkAnalysis> {
    const prompt = `你是一位专业的工作效率教练。请分析以下工作记录，给出质量评估和改进建议。

工作记录：
${workRecordContent}

请以JSON格式输出，包含以下字段：
- qualityScore: 0-100的数字，工作质量评分
- highlights: 字符串数组，做得好的地方
- problems: 字符串数组，存在的问题
- suggestions: 字符串数组，改进建议
- nextActions: 字符串数组，下一步行动项

直接返回JSON对象，不要包含markdown代码块标记。`;

    const result = await this.jsonRequest<WorkAnalysisOutput>(
      prompt,
      workAnalysisSchema,
      'daily work analysis',
    );
    return result as AiWorkAnalysis;
  }

  async decomposeGoal(monthlyGoalInfo: string): Promise<DecomposedGoal[]> {
    const prompt = `你是一位目标管理专家。请将以下月度目标拆解为具体的周目标。

月度目标信息：
${monthlyGoalInfo}

请以JSON格式输出，包含一个goals数组，每个目标包含：
- title: 周目标标题
- description: 周目标详细描述
- startDate: 开始日期（YYYY-MM-DD格式）
- endDate: 结束日期（YYYY-MM-DD格式）

确保周目标合理分布，每个周目标具体可执行。直接返回JSON对象。`;

    const result = await this.jsonRequest<GoalsOutput>(
      prompt,
      goalsSchema,
      'goal decomposition',
    );
    return result.goals as DecomposedGoal[];
  }

  async generateTomorrowPlan(
    inputText: string,
  ): Promise<TomorrowPlanTask[]> {
    const prompt = `你是一位任务规划专家。请基于以下信息，生成明日的工作计划任务列表。

输入信息：
${inputText}

请以JSON格式输出，包含一个tasks数组，每个任务包含：
- title: 任务标题
- priority: 优先级，只能是 HIGH、MEDIUM、LOW 之一
- estimatedTime: 预估耗时（分钟）
- reason: 生成这个任务的理由

确保任务具体、可执行、优先级合理。直接返回JSON对象。`;

    const result = await this.jsonRequest<TasksOutput>(
      prompt,
      tasksSchema,
      'tomorrow plan',
    );
    return result.tasks as TomorrowPlanTask[];
  }

  async analyzeCustomer(
    customerFollowRecords: string,
  ): Promise<AiCustomerAnalysis> {
    const prompt = `你是一位资深销售顾问。请分析以下客户跟进记录，评估客户意向并给出建议。

客户跟进记录：
${customerFollowRecords}

请以JSON格式输出，包含以下字段：
- intentionLevel: 意向等级（高/中/低）
- dealProbability: 成交概率（0-100的数字）
- concerns: 字符串数组，客户的顾虑点
- suggestions: 字符串数组，跟进建议
- nextStep: 下一步具体行动

直接返回JSON对象。`;

    const result = await this.jsonRequest<CustomerAnalysisOutput>(
      prompt,
      customerAnalysisSchema,
      'customer analysis',
    );
    return result as AiCustomerAnalysis;
  }

  async analyzeChat(chatText: string): Promise<ChatAnalysisResult> {
    const prompt = `你是一位销售对话分析专家。请分析以下聊天记录，提取客户需求和成交概率。

聊天记录：
${chatText}

请以JSON格式输出，包含以下字段：
- needs: 字符串数组，客户需求点
- concerns: 字符串数组，客户顾虑/异议
- dealProbability: 成交概率（0-100的数字）
- nextReply: 建议的下一句回复话术

直接返回JSON对象。`;

    const result = await this.jsonRequest<ChatAnalysisOutput>(
      prompt,
      chatAnalysisSchema,
      'chat analysis',
    );
    return result as ChatAnalysisResult;
  }

  async *streamDailyReport(params: {
    workRecords: string;
    goalProgress: string;
    dataStatistics?: string;
    aiAnalysisSummary?: string;
  }): AsyncGenerator<string> {
    const prompt = `你是一位专业的日报撰写助手。请根据以下信息生成一份高质量的工作日报，使用Markdown格式。

工作记录：
${params.workRecords}

目标进度：
${params.goalProgress}

数据统计：
${params.dataStatistics ?? '暂无'}

AI分析摘要：
${params.aiAnalysisSummary ?? '暂无'}

要求：
1. 必须严格按照以下六个板块输出，每个板块用"一、二、三、四、五、六、"编号
2. 一、今日完成：列出今天实际完成的工作事项和成果
3. 二、数据统计：用数据展示今天的工作量和结果（如客户触达数、回复数、成交数等），没有数据则写"暂无数据"
4. 三、遇到的问题：列出今天遇到的阻碍、不足和风险
5. 四、AI分析：分析今天工作的整体表现，指出亮点和不足
6. 五、改进建议：给出具体可执行的改进方向
7. 六、明日目标和计划：这是最重要的板块，必须包含以下内容：
   - 重要任务：列出明天最重要的2-3个任务
   - 预计时间：每个任务预计花费的时间
   - 优先级：每个任务标注高/中/低
   - 具体行动：每个任务的具体执行步骤
8. 语言专业但自然，避免空话套话
9. 用数据和事实说话，不要编造数据
10. Markdown格式，合理使用标题、列表、加粗等

请直接输出日报内容。`;

    yield* this.streamRequest(prompt, 'daily report');
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
    const systemPrompt = `你是一名拥有10年以上B2B销售经验的销售总监，同时也是用户的私人销售顾问和工作教练。你的名字叫Sales Coach。

你的核心能力：
1. 销售策略：客户开发、需求挖掘、异议处理、成交推动、跟进节奏
2. 工作管理：目标拆解、时间管理、优先级排序、复盘改进
3. 客户心理：客户决策路径、购买动机分析、沟通话术优化

回答原则：
1. 给出具体、可执行的建议，而非空泛的道理
2. 结合用户的实际情况和数据，不要泛泛而谈
3. 提供话术模板时要自然，避免生硬
4. 鼓励为主，但也要指出问题和改进方向
5. 语气专业、真诚、有洞察力，像一位经验丰富的导师

回答长度要求（非常重要）：
1. 默认回答控制在300～600字，不要长篇大论
2. 普通问题优先给结论，用3～6条重点回答即可
3. 销售话术类问题直接给可复制的话术，不要过多铺垫
4. 不要重复用户已经说过的信息
5. 不要主动把历史工作记录全部复述一遍
6. 只有用户明确要求"详细分析"时才展开
7. 简单问题（如"你好""怎么办"）用100～300字简短回答

===== 用户背景信息（回答时优先参考） =====

【当前目标】
${params.goalSummary ?? '暂无目标记录'}

【近期工作记录】
${params.workRecordSummary ?? '暂无工作记录'}

【客户数据】
${params.customerDataSummary ?? '暂无客户数据'}

【最近跟进记录】
${params.recentFollowUps ?? '暂无跟进记录'}

【知识库】
${params.knowledgeBaseSummary ?? '暂无知识库内容'}

【长期记忆（用户偏好/风格/习惯）】
${params.memorySummary ?? '暂无记忆记录'}

=====

请基于以上背景信息回答用户的问题。如果信息不足，请先了解情况再给出建议。回答要有结构，重点突出。`;

    yield* this.streamRequest(
      params.userMessage,
      'coach chat',
      systemPrompt,
    );
  }

  async *streamPeriodicSummary(params: {
    summaryType: string;
    periodData: string;
    goalCompletion: string;
    strengthsWeaknesses: string;
  }): AsyncGenerator<string> {
    const prompt = `你是一位专业的工作总结顾问。请根据以下数据生成一份${params.summaryType}工作总结，使用Markdown格式。

周期数据：
${params.periodData}

目标完成情况：
${params.goalCompletion}

优势与不足：
${params.strengthsWeaknesses}

要求：
1. 结构清晰，包含工作回顾、目标达成分析、亮点与不足、下周期计划
2. 数据驱动，用具体数字说话
3. 分析有深度，不只罗列事实
4. Markdown格式

请直接输出总结内容。`;

    yield* this.streamRequest(prompt, 'periodic summary');
  }

  async generateChatTitle(firstMessage: string): Promise<string> {
    try {
      const response = await this.getClient().chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              '你是一个对话标题生成器。根据用户的第一条消息，生成一个简洁的对话标题，不超过15个字，直接返回标题文本，不要加引号或其他标记。',
          },
          { role: 'user', content: firstMessage },
        ],
        temperature: 0.7,
        max_tokens: 30,
      });

      const title = response.choices[0]?.message?.content?.trim() || '新对话';
      return title.slice(0, 30) || '新对话';
    } catch (error) {
      this.logger.error(
        `Chat title generation failed: ${JSON.stringify(error)}`,
      );
      throw error;
    }
  }

  async generateDailySuggestion(context: string): Promise<string> {
    try {
      const response = await this.getClient().chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              '你是一位工作效率教练。根据用户的工作情况，给出1-2条今天最重要的工作建议，每条不超过50字。直接给出建议，不要多余寒暄和前缀。',
          },
          { role: 'user', content: context },
        ],
        temperature: 0.7,
        max_tokens: 150,
      });

      return response.choices[0]?.message?.content?.trim() || '';
    } catch (error) {
      this.logger.error(
        `Daily suggestion generation failed: ${JSON.stringify(error)}`,
      );
      throw error;
    }
  }

  /**
   * 使用 OpenAI Vision 分析图片内容
   * @param imageDataUrl base64 data URL (e.g. data:image/png;base64,...)
   * @param userQuestion 用户的问题/提示
   */
  async analyzeImage(imageDataUrl: string, userQuestion?: string): Promise<string> {
    const prompt = userQuestion || '请详细描述这张图片的内容，包括文字信息、图表数据、关键细节等。如果是聊天截图，请逐句还原对话内容。';
    try {
      const response = await this.getClient().chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageDataUrl } },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      });
      return response.choices[0]?.message?.content?.trim() || '无法识别图片内容';
    } catch (error) {
      this.logger.error(`Image analysis failed: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  private async jsonRequest<T>(
    userPrompt: string,
    schema: z.ZodSchema<T>,
    context: string,
  ): Promise<T> {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await this.getClient().chat.completions.create({
          model: this.model,
          messages: [{ role: 'user', content: userPrompt }],
          response_format: { type: 'json_object' },
          temperature: 0.7,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response from OpenAI');
        }

        const parsed = JSON.parse(content);
        const result = schema.safeParse(parsed);

        if (result.success) {
          return result.data;
        }

        this.logger.warn(
          `${context} JSON validation failed on attempt ${attempt}: ${result.error.message}`,
        );

        if (attempt === 1) {
          continue;
        }

        throw new Error(
          `JSON validation failed after retry: ${result.error.message}`,
        );
      } catch (error) {
        if (attempt === 1) {
          this.logger.warn(
            `${context} attempt ${attempt} failed, retrying...`,
          );
          continue;
        }
        this.logger.error(
          `${context} failed after retry: ${JSON.stringify(error)}`,
        );
        throw error;
      }
    }

    throw new Error(`${context} failed: unreachable`);
  }

  private async *streamRequest(
    userPrompt: string,
    context: string,
    systemPrompt?: string,
  ): AsyncGenerator<string> {
    try {
      const messages: Array<{ role: 'system' | 'user'; content: string }> =
        [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: userPrompt });

      const stream = await this.getClient().chat.completions.create({
        model: this.model,
        messages,
        stream: true,
        temperature: 0.7,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield delta;
        }
      }
    } catch (error) {
      this.logger.error(
        `${context} stream failed: ${JSON.stringify(error)}`,
      );
      throw error;
    }
  }
}
