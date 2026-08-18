import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { and, desc, eq, gte, lt, count, sql } from 'drizzle-orm';

import { task, dailyRecord, goal } from '@server/database/schema';
import type {
  Task,
  TaskPriority,
  TaskStatus,
  TaskListResponse,
  BatchCreateTasksRequest,
  BatchCreateTasksResponse,
  UpdateTaskRequest,
  TomorrowPlanTask,
} from '@shared/api.interface';
import { AiService } from '../ai/ai.service';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly aiService: AiService,
  ) {}

  async getList(
    dueDate: string | undefined,
    status: TaskStatus | undefined,
    page: number,
    pageSize: number,
    userId: string,
  ): Promise<TaskListResponse> {
    const userFilter = sql`(${task.createdBy}).user_id = ${userId}`;
    const conditions = [userFilter];
    if (dueDate) conditions.push(eq(task.dueDate, dueDate));
    if (status) conditions.push(eq(task.status, status));
    const whereClause = and(...conditions);

    const [countResult, items] = await Promise.all([
      this.db.select({ count: count() }).from(task).where(whereClause),
      this.db
        .select()
        .from(task)
        .where(whereClause)
        .orderBy(desc(task.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return {
      items: items.map((item) => this.mapTask(item)),
      total,
    };
  }

  async batchCreate(
    dto: BatchCreateTasksRequest,
    userId: string,
  ): Promise<BatchCreateTasksResponse> {
    if (!dto.tasks || dto.tasks.length === 0) {
      throw new BadRequestException('任务列表不能为空');
    }

    const values = dto.tasks.map((t) => ({
      title: t.title,
      priority: t.priority,
      estimatedTime: t.estimatedTime ?? null,
      dueDate: t.dueDate,
      status: 'TODO' as const,
      isAiSuggested: t.isAiSuggested ?? false,
      createdBy: userId,
    }));

    const inserted = await this.db
      .insert(task)
      .values(values)
      .returning();

    return {
      createdCount: inserted.length,
      items: inserted.map((item) => ({
        id: item.id,
        title: item.title,
      })),
    };
  }

  async update(
    id: string,
    dto: UpdateTaskRequest,
    userId: string,
  ): Promise<Task> {
    const userFilter = sql`(${task.createdBy}).user_id = ${userId}`;
    const patch: Partial<typeof task.$inferInsert> = {};

    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.priority !== undefined) patch.priority = dto.priority;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    patch.updatedAt = new Date();
    patch.updatedBy = userId;

    const updated = await this.db
      .update(task)
      .set(patch)
      .where(and(userFilter, eq(task.id, id)))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('任务不存在或无权操作');
    }

    return this.mapTask(updated[0]);
  }

  async remove(id: string, userId: string): Promise<{ success: boolean }> {
    const userFilter = sql`(${task.createdBy}).user_id = ${userId}`;
    const deleted = await this.db
      .delete(task)
      .where(and(userFilter, eq(task.id, id)))
      .returning({ id: task.id });

    if (deleted.length === 0) {
      throw new NotFoundException('任务不存在或无权操作');
    }

    return { success: true };
  }

  async generateTomorrowPlan(
    userId: string,
  ): Promise<{ tasks: TomorrowPlanTask[] }> {
    const today = this.getTodayDate();
    const userFilter = sql`(${dailyRecord.createdBy}).user_id = ${userId}`;

    // 1. 今日工作记录
    const todayRecords = await this.db
      .select()
      .from(dailyRecord)
      .where(and(userFilter, eq(dailyRecord.recordDate, today)));
    const todayRecord = todayRecords[0];
    const todayText = todayRecord
      ? `今日计划：${todayRecord.plan}\n今日完成：${todayRecord.completed}\n今日问题：${todayRecord.problems}\n明日想法：${todayRecord.tomorrowIdeas}`
      : '今日暂无工作记录';

    // 2. 最近 3 天记录摘要
    const threeDaysAgo = this.getDateOffset(today, -3);
    const recentRecords = await this.db
      .select({
        recordDate: dailyRecord.recordDate,
        completed: dailyRecord.completed,
        plan: dailyRecord.plan,
      })
      .from(dailyRecord)
      .where(
        and(
          userFilter,
          gte(dailyRecord.recordDate, threeDaysAgo),
          lt(dailyRecord.recordDate, today),
        ),
      )
      .orderBy(desc(dailyRecord.recordDate))
      .limit(3);

    const recentText = recentRecords.length > 0
      ? recentRecords
          .map(
            (r: { recordDate: string; completed: string; plan: string }) =>
              `${r.recordDate}：${r.completed}`,
          )
          .join('\n')
      : '最近3天暂无工作记录';

    // 3. 本月目标进度
    const thisMonth = today.slice(0, 7);
    const monthStart = `${thisMonth}-01`;
    const nextMonthStart = this.getNextMonthStart(today);
    const goalUserFilter = sql`(${goal.createdBy}).user_id = ${userId}`;
    const monthlyGoals = await this.db
      .select({ title: goal.title, status: goal.status })
      .from(goal)
      .where(
        and(
          goalUserFilter,
          gte(goal.endDate, monthStart),
          lt(goal.startDate, nextMonthStart),
        ),
      );
    const goalText = monthlyGoals.length > 0
      ? monthlyGoals
          .map((g: { title: string; status: string }) => `- ${g.title}（${g.status}）`)
          .join('\n')
      : '本月暂无目标';

    const inputText = `【今日工作记录】\n${todayText}\n\n【最近3天完成摘要】\n${recentText}\n\n【本月目标进度】\n${goalText}`;

    // 4. 调用 AI 生成明日计划
    try {
      const tasks = await this.aiService.generateTomorrowPlan(inputText);
      return { tasks };
    } catch (error) {
      this.logger.error(
        `AI tomorrow plan generation failed: ${JSON.stringify(error)}`,
      );
      throw new BadRequestException('AI服务暂时不可用，请稍后重试');
    }
  }

  private mapTask(raw: typeof task.$inferSelect): Task {
    return {
      id: raw.id,
      goalId: raw.goalId ?? null,
      dailyRecordId: raw.dailyRecordId ?? null,
      title: raw.title,
      priority: raw.priority as TaskPriority,
      estimatedTime: raw.estimatedTime ?? null,
      status: raw.status as TaskStatus,
      dueDate: raw.dueDate ?? null,
      isAiSuggested: raw.isAiSuggested,
      aiReason: raw.aiReason ?? undefined,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString(),
    };
  }

  private getTodayDate(): string {
    const now = new Date();
    return this.formatDate(now);
  }

  private getDateOffset(dateStr: string, offsetDays: number): string {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + offsetDays);
    return this.formatDate(d);
  }

  private formatDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getNextMonthStart(dateStr: string): string {
    const [yearStr, monthStr] = dateStr.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (month === 12) {
      return `${year + 1}-01-01`;
    }
    return `${year}-${String(month + 1).padStart(2, '0')}-01`;
  }
}
