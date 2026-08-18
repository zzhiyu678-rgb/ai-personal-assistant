import { Inject, Injectable } from '@nestjs/common';
import { eq, desc, and, sql } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';

import type { ChatAnalysisResult } from '@shared/api.interface';
import { AiService } from '../ai/ai.service';
import { MemoryService } from '../memory/memory.service';
import { FilesService } from '../files/files.service';
import {
  goalTable,
  dailyRecordTable,
  customerTable,
  customerFollowUpTable,
} from '@server/database/schema';

@Injectable()
export class ChatAnalysisService {
  constructor(
    private readonly aiService: AiService,
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly memoryService: MemoryService,
    private readonly filesService: FilesService,
  ) {}

  async analyze(chatText: string, userId: string): Promise<ChatAnalysisResult> {
    // 构建多源上下文
    const context = await this.buildContext(userId, chatText);

    // 将上下文与聊天内容合并后传给 AI
    const enrichedInput = `
===== 我的工作背景（分析时请参考） =====
${context}
===== 客户聊天记录（需要分析的内容） =====
${chatText}
=====
请基于以上背景信息和聊天记录，分析客户情况。`;

    return this.aiService.analyzeChat(enrichedInput);
  }

  private async buildContext(userId: string, query: string): Promise<string> {
    const [goals, records, customers, memories, knowledge] = await Promise.all([
      this.buildGoals(userId),
      this.buildWorkRecords(userId),
      this.buildCustomers(userId),
      this.buildMemory(userId),
      this.buildKnowledge(userId, query),
    ]);

    return [goals, records, customers, memories, knowledge]
      .filter(Boolean)
      .join('\n\n');
  }

  private async buildGoals(userId: string): Promise<string> {
    const goals = await this.db
      .select({
        title: goalTable.title,
        type: goalTable.type,
        status: goalTable.status,
        description: goalTable.description,
      })
      .from(goalTable)
      .where(eq(goalTable.createdBy, userId))
      .orderBy(desc(goalTable.createdAt))
      .limit(3);

    if (goals.length === 0) return '';
    return `【当前目标】\n${goals
      .map((g) => `- [${g.type}] ${g.title}（${g.status}）`)
      .join('\n')}`;
  }

  private async buildWorkRecords(userId: string): Promise<string> {
    const records = await this.db
      .select({
        recordDate: dailyRecordTable.recordDate,
        completed: dailyRecordTable.completed,
      })
      .from(dailyRecordTable)
      .where(eq(dailyRecordTable.createdBy, userId))
      .orderBy(desc(dailyRecordTable.recordDate))
      .limit(5);

    if (records.length === 0) return '';
    return `【近期工作】\n${records
      .map((r) => `- ${r.recordDate}: ${(r.completed || '').slice(0, 80)}`)
      .join('\n')}`;
  }

  private async buildCustomers(userId: string): Promise<string> {
    const customers = await this.db
      .select({
        company: customerTable.company,
        contactName: customerTable.contactName,
        stage: customerTable.stage,
        industry: customerTable.industry,
        notes: customerTable.notes,
      })
      .from(customerTable)
      .where(eq(customerTable.createdBy, userId))
      .orderBy(desc(customerTable.updatedAt))
      .limit(5);

    if (customers.length === 0) return '';
    return `【我的客户】\n${customers
      .map(
        (c) =>
          `- ${c.company}（${c.contactName}，${c.stage}${c.industry ? '，' + c.industry : ''}）${c.notes ? '\n  备注：' + c.notes.slice(0, 60) : ''}`,
      )
      .join('\n')}`;
  }

  private async buildMemory(userId: string): Promise<string> {
    const memories = await this.memoryService.getAllByUser(userId);
    if (memories.length === 0) return '';
    return `【我的偏好/习惯】\n${memories
      .map((m) => `- [${m.type}] ${m.content}`)
      .join('\n')}`;
  }

  private async buildKnowledge(userId: string, query: string): Promise<string> {
    try {
      const results = await this.filesService.searchKnowledge(userId, query, 2);
      if (results.length === 0) return '';
      return `【知识库相关资料】\n${results
        .map((r) => `- ${r.fileName}：${r.snippet.slice(0, 500)}`)
        .join('\n')}`;
    } catch {
      return '';
    }
  }
}
