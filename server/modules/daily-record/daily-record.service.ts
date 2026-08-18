import { Inject, Injectable, Logger, BadRequestException } from '@nestjs/common';
import { desc, count, eq, sql } from 'drizzle-orm';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';

import { dailyRecord } from '../../database/schema';
import { AiService } from '../ai/ai.service';
import type {
  DailyRecord,
  DailyRecordListResponse,
  AiWorkAnalysis,
  SaveDailyRecordRequest,
} from '@shared/api.interface';

interface UpsertParams extends SaveDailyRecordRequest {
  date: string;
  userId: string;
}

function mapRowToRecord(row: typeof dailyRecord.$inferSelect): DailyRecord {
  const analysis = (row.aiAnalysis as AiWorkAnalysis | null) ?? null;
  return {
    id: row.id,
    date: row.recordDate,
    plan: row.plan,
    completed: row.completed,
    problems: row.problems,
    tomorrowIdeas: row.tomorrowIdeas,
    aiAnalysis: analysis,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class DailyRecordService {
  private readonly logger = new Logger(DailyRecordService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly aiService: AiService,
  ) {}

  async getByDate(date: string, userId: string): Promise<DailyRecord | null> {
    const rows = await this.db
      .select()
      .from(dailyRecord)
      .where(
        sql`${dailyRecord.recordDate} = ${date}::date AND (${dailyRecord.createdBy}).user_id = ${userId}`,
      )
      .limit(1);

    if (rows.length === 0) return null;
    return mapRowToRecord(rows[0]);
  }

  async upsert(params: UpsertParams): Promise<DailyRecord> {
    const { date, userId, plan, completed, problems, tomorrowIdeas } = params;

    const patch: Partial<typeof dailyRecord.$inferInsert> = {};
    if (plan !== undefined) patch.plan = plan;
    if (completed !== undefined) patch.completed = completed;
    if (problems !== undefined) patch.problems = problems;
    if (tomorrowIdeas !== undefined) patch.tomorrowIdeas = tomorrowIdeas;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    const existing = await this.db
      .select()
      .from(dailyRecord)
      .where(
        sql`${dailyRecord.recordDate} = ${date}::date AND (${dailyRecord.createdBy}).user_id = ${userId}`,
      )
      .limit(1);

    let row: typeof dailyRecord.$inferSelect;

    if (existing.length > 0) {
      const updated = await this.db
        .update(dailyRecord)
        .set({
          ...patch,
          updatedAt: sql`CURRENT_TIMESTAMP` as unknown as Date,
          updatedBy: sql`ROW(${userId})::user_profile` as unknown as string,
        })
        .where(eq(dailyRecord.id, existing[0].id))
        .returning();
      row = updated[0];
    } else {
      const inserted = await this.db
        .insert(dailyRecord)
        .values({
          recordDate: date,
          plan: plan ?? '',
          completed: completed ?? '',
          problems: problems ?? '',
          tomorrowIdeas: tomorrowIdeas ?? '',
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();
      row = inserted[0];
    }

    if (!row) {
      this.logger.error('保存工作记录失败，未返回记录');
      throw new Error('保存工作记录失败');
    }
    return mapRowToRecord(row);
  }

  async analyze(date: string, userId: string): Promise<AiWorkAnalysis> {
    const record = await this.getByDate(date, userId);
    if (!record) {
      throw new BadRequestException('当日工作记录不存在，请先保存');
    }

    const content = [
      `今日计划：${record.plan || '无'}`,
      `完成事项：${record.completed || '无'}`,
      `遇到的问题：${record.problems || '无'}`,
    ].join('\n');

    const analysis = await this.aiService.analyzeDailyWork(content);

    await this.db
      .update(dailyRecord)
      .set({
        aiAnalysis: analysis as unknown as Record<string, unknown>,
        updatedAt: sql`CURRENT_TIMESTAMP` as unknown as Date,
        updatedBy: sql`ROW(${userId})::user_profile` as unknown as string,
      })
      .where(
        sql`${dailyRecord.recordDate} = ${date}::date AND (${dailyRecord.createdBy}).user_id = ${userId}`,
      );

    return analysis;
  }

  async analyzeFromContent(
    date: string,
    userId: string,
    rawContent: string,
  ): Promise<AiWorkAnalysis> {
    const analysis = await this.aiService.analyzeDailyWork(rawContent);

    const existing = await this.db
      .select()
      .from(dailyRecord)
      .where(
        sql`${dailyRecord.recordDate} = ${date}::date AND (${dailyRecord.createdBy}).user_id = ${userId}`,
      )
      .limit(1);

    const completedText = analysis.highlights?.length > 0
      ? analysis.highlights.join('\n')
      : '';
    const problemsText = analysis.problems?.length > 0
      ? analysis.problems.join('\n')
      : '';
    const nextActionsText = analysis.nextActions?.length > 0
      ? analysis.nextActions.join('\n')
      : '';

    if (existing.length > 0) {
      await this.db
        .update(dailyRecord)
        .set({
          completed: existing[0].completed || completedText,
          problems: existing[0].problems || problemsText,
          tomorrowIdeas: existing[0].tomorrowIdeas || nextActionsText,
          aiAnalysis: analysis as unknown as Record<string, unknown>,
          updatedAt: sql`CURRENT_TIMESTAMP` as unknown as Date,
          updatedBy: sql`ROW(${userId})::user_profile` as unknown as string,
        })
        .where(eq(dailyRecord.id, existing[0].id));
    } else {
      await this.db.insert(dailyRecord).values({
        recordDate: date,
        plan: '',
        completed: completedText,
        problems: problemsText,
        tomorrowIdeas: nextActionsText,
        aiAnalysis: analysis as unknown as Record<string, unknown>,
        createdBy: userId,
        updatedBy: userId,
      });
    }

    return analysis;
  }

  async updateAnalysis(
    date: string,
    userId: string,
    analysis: AiWorkAnalysis,
  ): Promise<DailyRecord> {
    const existing = await this.db
      .select()
      .from(dailyRecord)
      .where(
        sql`${dailyRecord.recordDate} = ${date}::date AND (${dailyRecord.createdBy}).user_id = ${userId}`,
      )
      .limit(1);

    if (existing.length === 0) {
      throw new BadRequestException('当日工作记录不存在');
    }

    const updated = await this.db
      .update(dailyRecord)
      .set({
        aiAnalysis: analysis as unknown as Record<string, unknown>,
        updatedAt: sql`CURRENT_TIMESTAMP` as unknown as Date,
        updatedBy: sql`ROW(${userId})::user_profile` as unknown as string,
      })
      .where(eq(dailyRecord.id, existing[0].id))
      .returning();

    if (updated.length === 0) {
      throw new Error('更新分析结果失败');
    }
    return mapRowToRecord(updated[0]);
  }

  async list(
    userId: string,
    params: { page: number; pageSize: number },
  ): Promise<DailyRecordListResponse> {
    const { page, pageSize } = params;
    const offset = (page - 1) * pageSize;

    const whereClause = sql`(${dailyRecord.createdBy}).user_id = ${userId}`;

    const [totalResult, rows] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(dailyRecord)
        .where(whereClause),
      this.db
        .select({
          id: dailyRecord.id,
          recordDate: dailyRecord.recordDate,
          plan: dailyRecord.plan,
          aiAnalysis: dailyRecord.aiAnalysis,
        })
        .from(dailyRecord)
        .where(whereClause)
        .orderBy(desc(dailyRecord.recordDate))
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);
    const items = rows.map((row) => ({
      id: row.id,
      date: row.recordDate,
      plan:
        row.plan.length > 50 ? row.plan.slice(0, 50) + '...' : row.plan,
      hasAnalysis: Boolean(row.aiAnalysis),
    }));

    return { items, total };
  }
}
