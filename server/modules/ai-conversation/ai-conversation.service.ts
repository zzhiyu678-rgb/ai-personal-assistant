import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, desc, asc, count, and, sql } from 'drizzle-orm';

import type {
  AiConversation,
  AiMessage,
  AiConversationListResponse,
  AiMessageListResponse,
} from '@shared/api.interface';
import { AiService } from '../ai/ai.service';
import { MemoryService } from '../memory/memory.service';
import { FilesService } from '../files/files.service';
import {
  aiConversationTable,
  aiMessageTable,
  goalTable,
  dailyRecordTable,
  customerTable,
  customerFollowUpTable,
  knowledgeFileTable,
} from '@server/database/schema';

interface ConversationContext {
  goalSummary: string;
  workRecordSummary: string;
  customerDataSummary: string;
  knowledgeBaseSummary: string;
  memorySummary: string;
  recentFollowUps: string;
}

@Injectable()
export class AiConversationService {
  private readonly logger = new Logger(AiConversationService.name);

  // 上下文缓存：key=userId, value={context, timestamp}
  // 30秒内复用，避免每次消息都查询6个表
  private contextCache = new Map<string, { context: ConversationContext; timestamp: number }>();
  private readonly CONTEXT_CACHE_TTL = 30 * 1000;

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly aiService: AiService,
    private readonly memoryService: MemoryService,
    private readonly filesService: FilesService,
  ) {}

  async getConversations(userId: string): Promise<AiConversationListResponse> {
    const conversations = await this.db
      .select()
      .from(aiConversationTable)
      .where(eq(aiConversationTable.createdBy, userId))
      .orderBy(desc(aiConversationTable.createdAt));

    const [countResult] = await this.db
      .select({ count: count() })
      .from(aiConversationTable)
      .where(eq(aiConversationTable.createdBy, userId));

    const items: AiConversation[] = [];
    for (const conv of conversations) {
      const lastMsg = await this.db
        .select({ content: aiMessageTable.content })
        .from(aiMessageTable)
        .where(eq(aiMessageTable.conversationId, conv.id))
        .orderBy(desc(aiMessageTable.createdAt))
        .limit(1);

      items.push({
        id: conv.id,
        title: conv.title,
        createdAt: conv.createdAt.toISOString(),
        lastMessage: lastMsg[0]?.content ?? '',
      });
    }

    return {
      items,
      total: Number(countResult?.count ?? 0),
    };
  }

  async createConversation(
    userId: string,
    title?: string,
  ): Promise<AiConversation> {
    const [created] = await this.db
      .insert(aiConversationTable)
      .values({
        title: title?.trim() || '新对话',
        createdBy: userId,
      })
      .returning();

    return {
      id: created.id,
      title: created.title,
      createdAt: created.createdAt.toISOString(),
      lastMessage: '',
    };
  }

  async deleteConversation(
    id: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    const conv = await this.verifyOwnership(id, userId);
    if (!conv) {
      throw new NotFoundException('对话不存在');
    }

    await this.db
      .delete(aiMessageTable)
      .where(eq(aiMessageTable.conversationId, id));
    await this.db
      .delete(aiConversationTable)
      .where(eq(aiConversationTable.id, id));

    return { success: true };
  }

  async getMessages(
    conversationId: string,
    userId: string,
  ): Promise<AiMessageListResponse> {
    await this.verifyOwnership(conversationId, userId);

    const messages = await this.db
      .select()
      .from(aiMessageTable)
      .where(eq(aiMessageTable.conversationId, conversationId))
      .orderBy(asc(aiMessageTable.createdAt));

    return {
      items: messages.map((msg) => ({
        id: msg.id,
        conversationId: msg.conversationId,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        createdAt: msg.createdAt.toISOString(),
      })),
    };
  }

  async saveUserMessage(
    conversationId: string,
    content: string,
    userId: string,
  ): Promise<AiMessage> {
    const [created] = await this.db
      .insert(aiMessageTable)
      .values({
        conversationId,
        role: 'user',
        content,
        createdBy: userId,
      })
      .returning();

    return {
      id: created.id,
      conversationId: created.conversationId,
      role: created.role as 'user' | 'assistant',
      content: created.content,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async saveAssistantMessage(
    conversationId: string,
    content: string,
    userId: string,
  ): Promise<void> {
    await this.db.insert(aiMessageTable).values({
      conversationId,
      role: 'assistant',
      content,
      createdBy: userId,
    });
  }

  async isFirstMessage(conversationId: string): Promise<boolean> {
    const [result] = await this.db
      .select({ count: count() })
      .from(aiMessageTable)
      .where(eq(aiMessageTable.conversationId, conversationId));
    return Number(result?.count ?? 0) === 0;
  }

  /**
   * 获取当前对话中"尚未得到AI回复"的用户消息。
   * 即：最后一条 assistant 消息之后的所有 user 消息。
   * 如果没有 assistant 消息，则返回所有 user 消息。
   * 用于连续消息合并：将这些消息作为一次完整表达发送给AI。
   */
  async getPendingUserMessages(
    conversationId: string,
    userId: string,
  ): Promise<AiMessage[]> {
    await this.verifyOwnership(conversationId, userId);

    // 找到最后一条 assistant 消息的时间
    const lastAssistant = await this.db
      .select({ createdAt: aiMessageTable.createdAt })
      .from(aiMessageTable)
      .where(
        and(
          eq(aiMessageTable.conversationId, conversationId),
          eq(aiMessageTable.role, 'assistant'),
        ),
      )
      .orderBy(desc(aiMessageTable.createdAt))
      .limit(1);

    let userMessages;
    if (lastAssistant.length > 0) {
      // 取最后一条assistant之后的所有user消息
      userMessages = await this.db
        .select()
        .from(aiMessageTable)
        .where(
          and(
            eq(aiMessageTable.conversationId, conversationId),
            eq(aiMessageTable.role, 'user'),
            sql`${aiMessageTable.createdAt} > ${lastAssistant[0].createdAt}`,
          ),
        )
        .orderBy(asc(aiMessageTable.createdAt));
    } else {
      // 没有assistant消息，取所有user消息
      userMessages = await this.db
        .select()
        .from(aiMessageTable)
        .where(
          and(
            eq(aiMessageTable.conversationId, conversationId),
            eq(aiMessageTable.role, 'user'),
          ),
        )
        .orderBy(asc(aiMessageTable.createdAt));
    }

    return userMessages.map((msg) => ({
      id: msg.id,
      conversationId: msg.conversationId,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      createdAt: msg.createdAt.toISOString(),
    }));
  }

  async updateConversationTitle(
    conversationId: string,
    title: string,
    userId: string,
  ): Promise<{ id: string; title: string } | null> {
    // 验证对话属于当前用户
    const [existing] = await this.db
      .select({ id: aiConversationTable.id })
      .from(aiConversationTable)
      .where(
        and(
          eq(aiConversationTable.id, conversationId),
          sql`(${aiConversationTable.createdBy}).user_id = ${userId}`,
        ),
      )
      .limit(1);

    if (!existing) return null;

    const safeTitle = title.slice(0, 50).trim() || '新对话';
    await this.db
      .update(aiConversationTable)
      .set({ title: safeTitle, updatedAt: new Date(), updatedBy: userId })
      .where(eq(aiConversationTable.id, conversationId));

    return { id: conversationId, title: safeTitle };
  }

  async generateTitle(firstMessage: string): Promise<string> {
    try {
      return await this.aiService.generateChatTitle(firstMessage);
    } catch (error) {
      this.logger.error(`Generate chat title failed: ${JSON.stringify(error)}`);
      return '新对话';
    }
  }

  async *streamCoachChat(params: {
    userMessage: string;
    goalSummary: string;
    workRecordSummary: string;
    customerDataSummary: string;
    knowledgeBaseSummary: string;
    memorySummary: string;
    recentFollowUps: string;
  }): AsyncGenerator<string> {
    const iter = this.aiService.streamCoachChat(params);
    for await (const chunk of iter) {
      yield chunk;
    }
  }

  async analyzeImage(imageDataUrl: string, userQuestion?: string): Promise<string> {
    return this.aiService.analyzeImage(imageDataUrl, userQuestion);
  }

  async buildContext(userId: string, query?: string): Promise<ConversationContext> {
    // 检查缓存（30秒内复用，避免每次消息都查6个表）
    const cached = this.contextCache.get(userId);
    const now = Date.now();
    if (cached && now - cached.timestamp < this.CONTEXT_CACHE_TTL) {
      return cached.context;
    }

    const [
      goalSummary,
      workRecordSummary,
      customerDataSummary,
      knowledgeBaseSummary,
      memorySummary,
      recentFollowUps,
    ] = await Promise.all([
      this.buildGoalSummary(userId),
      this.buildWorkRecordSummary(userId),
      this.buildCustomerSummary(userId),
      this.buildKnowledgeSummary(userId, query),
      this.buildMemorySummary(userId),
      this.buildRecentFollowUpsSummary(userId),
    ]);

    const context: ConversationContext = {
      goalSummary,
      workRecordSummary,
      customerDataSummary,
      knowledgeBaseSummary,
      memorySummary,
      recentFollowUps,
    };

    // 写入缓存
    this.contextCache.set(userId, { context, timestamp: now });
    return context;
  }

  /** 主动失效上下文缓存（数据变更时调用） */
  invalidateContextCache(userId: string) {
    this.contextCache.delete(userId);
  }

  async buildUserContext(userId: string, query?: string): Promise<ConversationContext> {
    return this.buildContext(userId, query);
  }

  async verifyOwnership(
    conversationId: string,
    userId: string,
  ): Promise<{ id: string } | null> {
    const rows = await this.db
      .select({ id: aiConversationTable.id })
      .from(aiConversationTable)
      .where(
        and(
          eq(aiConversationTable.id, conversationId),
          eq(aiConversationTable.createdBy, userId),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      const exists = await this.db
        .select({ id: aiConversationTable.id })
        .from(aiConversationTable)
        .where(eq(aiConversationTable.id, conversationId))
        .limit(1);
      if (exists.length === 0) {
        throw new NotFoundException('对话不存在');
      }
      throw new ForbiddenException('无权访问此对话');
    }
    return rows[0] ?? null;
  }

  private async buildGoalSummary(userId: string): Promise<string> {
    const goals = await this.db
      .select({
        title: goalTable.title,
        status: goalTable.status,
        type: goalTable.type,
        description: goalTable.description,
        endDate: goalTable.endDate,
      })
      .from(goalTable)
      .where(eq(goalTable.createdBy, userId))
      .orderBy(desc(goalTable.createdAt))
      .limit(5);

    if (goals.length === 0) return '暂无目标记录';

    return goals
      .map(
        (g) =>
          `- [${g.type}] ${g.title}（状态：${g.status}，截止：${g.endDate}）${g.description ? `\n  描述：${g.description.slice(0, 60)}` : ''}`,
      )
      .join('\n');
  }

  private async buildWorkRecordSummary(userId: string): Promise<string> {
    const records = await this.db
      .select({
        recordDate: dailyRecordTable.recordDate,
        completed: dailyRecordTable.completed,
        aiAnalysis: dailyRecordTable.aiAnalysis,
      })
      .from(dailyRecordTable)
      .where(eq(dailyRecordTable.createdBy, userId))
      .orderBy(desc(dailyRecordTable.recordDate))
      .limit(7);

    if (records.length === 0) return '暂无工作记录';

    return records
      .map((r) => {
        const analysis = r.aiAnalysis as { qualityScore?: number; highlights?: string[] } | null;
        const score = analysis?.qualityScore ? `评分：${analysis.qualityScore}` : '';
        const highlights = analysis?.highlights?.slice(0, 2).join('；') ?? '';
        const completedBrief = (r.completed || '').slice(0, 100);
        return `【${r.recordDate}】${score}${completedBrief ? `\n  完成：${completedBrief}` : ''}${highlights ? `\n  亮点：${highlights}` : ''}`;
      })
      .join('\n\n');
  }

  private async buildCustomerSummary(userId: string): Promise<string> {
    const customers = await this.db
      .select({
        id: customerTable.id,
        company: customerTable.company,
        contactName: customerTable.contactName,
        stage: customerTable.stage,
        industry: customerTable.industry,
        aiAnalysis: customerTable.aiAnalysis,
      })
      .from(customerTable)
      .where(eq(customerTable.createdBy, userId))
      .orderBy(desc(customerTable.updatedAt))
      .limit(5);

    if (customers.length === 0) return '暂无客户数据';

    return customers
      .map((c) => {
        const analysis = c.aiAnalysis as { dealProbability?: number; intentionLevel?: string } | null;
        const prob = analysis?.dealProbability ? `，成交概率：${analysis.dealProbability}%` : '';
        return `- ${c.company}（联系人：${c.contactName}，阶段：${c.stage}${c.industry ? `，行业：${c.industry}` : ''}${prob}）`;
      })
      .join('\n');
  }

  private async buildKnowledgeSummary(userId: string, query?: string): Promise<string> {
    // 只有问题可能涉及知识库时才搜索，普通闲聊/工作安排跳过
    const kbKeywords = ['知识库', '上传', '文件', '资料', '话术', '产品', '介绍', '根据我', '参考', '案例', '方案', '报价', '价格', '功能', '说明书', 'pdf', 'word', 'excel', 'ppt'];
    const queryLower = (query || '').toLowerCase();
    const needsKnowledge = queryLower && kbKeywords.some((kw) => queryLower.includes(kw.toLowerCase()));

    if (!needsKnowledge) {
      return '（当前问题无需参考知识库）';
    }

    // 有关键词，使用关键词搜索相关内容
    if (query && query.trim().length > 0) {
      try {
        const results = await this.filesService.searchKnowledge(userId, query, 3);
        if (results.length > 0) {
          return results
            .map(
              (r) =>
                `【${r.fileName}】\n${r.snippet}`,
            )
            .join('\n\n');
        }
      } catch (error) {
        this.logger.warn(`知识库搜索失败: ${JSON.stringify(error)}`);
      }
    }

    // 搜索无结果时，返回最近的已处理文件（最多2个，每个800字）
    const files = await this.db
      .select({
        fileName: knowledgeFileTable.fileName,
        fileType: knowledgeFileTable.fileType,
        extractedText: knowledgeFileTable.extractedText,
        extractStatus: (knowledgeFileTable as any).extractStatus,
      })
      .from(knowledgeFileTable)
      .where(eq(knowledgeFileTable.createdBy, userId))
      .orderBy(desc(knowledgeFileTable.createdAt))
      .limit(2);

    const readyFiles = files.filter((f) => f.extractStatus === 'READY' && f.extractedText);
    if (readyFiles.length === 0) return '暂无知识库内容（或文件正在处理中）';

    return readyFiles
      .map((f) => {
        const textBrief = (f.extractedText || '').slice(0, 800);
        return `- ${f.fileName}（${f.fileType}）\n  内容摘要：${textBrief}`;
      })
      .join('\n\n');
  }

  private async buildMemorySummary(userId: string): Promise<string> {
    const allMemories = await this.memoryService.getAllByUser(userId);
    // 只取最近20条记忆，避免Prompt过大
    const memories = allMemories.slice(0, 20);

    if (memories.length === 0) return '暂无记忆记录';

    const typeLabels: Record<string, string> = {
      PROFILE: '个人档案',
      WORK_STYLE: '工作风格',
      SALES_STYLE: '销售风格',
      PREFERENCE: '偏好设置',
    };

    const byType = new Map<string, string[]>();
    for (const m of memories) {
      const arr = byType.get(m.type) ?? [];
      arr.push(m.content);
      byType.set(m.type, arr);
    }

    const parts: string[] = [];
    for (const [type, contents] of byType) {
      const label = typeLabels[type] ?? type;
      parts.push(`【${label}】\n${contents.map((c) => `- ${c}`).join('\n')}`);
    }

    return parts.join('\n\n');
  }

  private async buildRecentFollowUpsSummary(userId: string): Promise<string> {
    const followUps = await this.db
      .select({
        id: customerFollowUpTable.id,
        content: customerFollowUpTable.content,
        followType: customerFollowUpTable.followType,
        createdAt: customerFollowUpTable.createdAt,
        customerId: customerFollowUpTable.customerId,
      })
      .from(customerFollowUpTable)
      .innerJoin(
        customerTable,
        eq(customerFollowUpTable.customerId, customerTable.id),
      )
      .where(
        sql`(${customerTable.createdBy}).user_id = ${userId}`,
      )
      .orderBy(desc(customerFollowUpTable.createdAt))
      .limit(5);

    if (followUps.length === 0) return '暂无跟进记录';

    const customerIds = [...new Set(followUps.map((f) => f.customerId))];
    const customers = await this.db
      .select({ id: customerTable.id, company: customerTable.company })
      .from(customerTable)
      .where(
        sql`${customerTable.id} = ANY(ARRAY[${sql.join(
          customerIds.map((id) => sql`${id}`),
          sql`, `,
        )}]::uuid[])`,
      );
    const customerMap = new Map(customers.map((c) => [c.id, c.company]));

    return followUps
      .map((f) => {
        const company = customerMap.get(f.customerId) ?? '未知客户';
        const date = new Date(f.createdAt).toISOString().slice(0, 10);
        const contentBrief = f.content.slice(0, 120);
        return `【${date}】${company}（${f.followType}）\n  ${contentBrief}`;
      })
      .join('\n\n');
  }
}
