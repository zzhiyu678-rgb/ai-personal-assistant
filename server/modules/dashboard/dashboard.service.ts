import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { and, eq, gte, lt, sql, desc } from 'drizzle-orm';

import { goal, task, dailyRecord, customer, customerFollowUp } from '@server/database/schema';
import type {
  DashboardTodayResponse,
  Task,
  TaskPriority,
  TaskStatus,
} from '@shared/api.interface';
import { AiService } from '../ai/ai.service';
import { MemoryService } from '../memory/memory.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly aiService: AiService,
    private readonly memoryService: MemoryService,
  ) {}

  async getTodayData(userId: string): Promise<DashboardTodayResponse> {
    const today = this.getTodayDate();
    const thisMonth = today.slice(0, 7); // YYYY-MM
    const monthStart = `${thisMonth}-01`;
    const nextMonthStart = this.getNextMonthStart(today);

    const userFilter = sql`(${task.createdBy}).user_id = ${userId}`;
    const goalUserFilter = sql`(${goal.createdBy}).user_id = ${userId}`;

    // 并行执行所有数据库查询
    const [todayTasksRaw, monthlyGoals, streakDays] = await Promise.all([
      // Today tasks
      this.db
        .select({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
        })
        .from(task)
        .where(and(userFilter, eq(task.dueDate, today)))
        .orderBy(desc(task.createdAt)),
      // Monthly goal progress
      this.db
        .select({ status: goal.status })
        .from(goal)
        .where(
          and(
            goalUserFilter,
            gte(goal.endDate, monthStart),
            lt(goal.startDate, nextMonthStart),
          ),
        ),
      // Streak days
      this.calculateStreak(userId, today),
    ]);

    const todayTaskCount = todayTasksRaw.length;
    const doneCount = todayTasksRaw.filter(
      (t: { status: string }) => t.status === 'DONE',
    ).length;
    const completionRate = todayTaskCount > 0
      ? Math.round((doneCount / todayTaskCount) * 100)
      : 0;

    const totalMonthlyGoals = monthlyGoals.length;
    const doneGoals = monthlyGoals.filter(
      (g: { status: string }) => g.status === 'DONE',
    ).length;
    const monthlyGoalProgress = totalMonthlyGoals > 0
      ? Math.round((doneGoals / totalMonthlyGoals) * 100)
      : 0;

    const todayTasks = todayTasksRaw.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
    }));

    // 核心数据不包含AI建议，AI建议由独立接口加载
    return {
      todayDate: today,
      completionRate,
      todayTaskCount,
      monthlyGoalProgress,
      streakDays,
      todayTasks,
      aiSuggestion: null,
    };
  }

  /**
   * 独立获取AI今日建议，不阻塞Dashboard核心数据
   */
  async getAiSuggestion(userId: string): Promise<string | null> {
    const today = this.getTodayDate();
    try {
      const suggestionContext = await this.buildSuggestionContext(userId, today);
      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('AI suggestion timeout')), 5000),
      );
      return await Promise.race([
        this.aiService.generateDailySuggestion(suggestionContext),
        timeoutPromise,
      ]);
    } catch (error) {
      this.logger.error(`Generate daily suggestion failed: ${JSON.stringify(error)}`);
      return null;
    }
  }

  async getTodayTasks(userId: string): Promise<Task[]> {
    const today = this.getTodayDate();
    const userFilter = sql`(${task.createdBy}).user_id = ${userId}`;

    const tasks = await this.db
      .select()
      .from(task)
      .where(and(userFilter, eq(task.dueDate, today)))
      .orderBy(desc(task.createdAt));

    return tasks.map((t) => this.mapTask(t));
  }

  async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    userId: string,
  ): Promise<Task> {
    const userFilter = sql`(${task.createdBy}).user_id = ${userId}`;
    const patch: Partial<typeof task.$inferInsert> = {
      status,
      updatedAt: new Date(),
      updatedBy: userId,
    };

    const updated = await this.db
      .update(task)
      .set(patch)
      .where(and(userFilter, eq(task.id, taskId)))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('任务不存在或无权操作');
    }

    return this.mapTask(updated[0]);
  }

  async createQuickTask(
    title: string,
    priority: TaskPriority = 'MEDIUM',
    userId: string,
  ): Promise<Task> {
    const today = this.getTodayDate();
    const inserted = await this.db
      .insert(task)
      .values({
        title,
        priority,
        status: 'TODO',
        dueDate: today,
        isAiSuggested: false,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    return this.mapTask(inserted[0]);
  }

  private async buildSuggestionContext(
    userId: string,
    today: string,
  ): Promise<string> {
    const userFilter = sql`(${task.createdBy}).user_id = ${userId}`;
    const goalFilter = sql`(${goal.createdBy}).user_id = ${userId}`;
    const customerFilter = sql`(${customer.createdBy}).user_id = ${userId}`;

    const [
      todayTasksRaw,
      monthlyGoals,
      customerCount,
      recentFollowUps,
      recentWorkRecord,
      memories,
    ] = await Promise.all([
      this.db
        .select({ title: task.title, status: task.status, priority: task.priority })
        .from(task)
        .where(and(userFilter, eq(task.dueDate, today)))
        .limit(5),
      this.db
        .select({ title: goal.title, status: goal.status })
        .from(goal)
        .where(goalFilter)
        .orderBy(desc(goal.createdAt))
        .limit(3),
      this.db
        .select({ count: sql`count(*)` })
        .from(customer)
        .where(customerFilter),
      this.db
        .select({
          content: customerFollowUp.content,
          followType: customerFollowUp.followType,
        })
        .from(customerFollowUp)
        .innerJoin(customer, eq(customerFollowUp.customerId, customer.id))
        .where(customerFilter)
        .orderBy(desc(customerFollowUp.createdAt))
        .limit(3),
      this.db
        .select({ completed: dailyRecord.completed, aiAnalysis: dailyRecord.aiAnalysis })
        .from(dailyRecord)
        .where(sql`(${dailyRecord.createdBy}).user_id = ${userId}`)
        .orderBy(desc(dailyRecord.recordDate))
        .limit(1),
      this.memoryService.getAllByUser(userId),
    ]);

    const taskList = todayTasksRaw.map((t) => `- [${t.priority}] ${t.title} (${t.status})`).join('\n') || '暂无';
    const goalList = monthlyGoals.map((g) => `- ${g.title} (${g.status})`).join('\n') || '暂无';
    const totalCustomers = Number(customerCount[0]?.count ?? 0);
    const followUpList = recentFollowUps
      .map((f) => `- [${f.followType}] ${f.content.slice(0, 60)}`)
      .join('\n') || '暂无';

    const lastRecord = recentWorkRecord[0];
    let workRecordBrief = '暂无工作记录';
    if (lastRecord) {
      const analysis = lastRecord.aiAnalysis as { qualityScore?: number; highlights?: string[] } | null;
      const highlights = analysis?.highlights?.slice(0, 2).join('；') ?? '';
      workRecordBrief = `${(lastRecord.completed || '').slice(0, 80)}${highlights ? `\n亮点：${highlights}` : ''}`;
    }

    const memoryList = memories.length > 0
      ? memories.map((m) => `- [${m.type}] ${m.content.slice(0, 50)}`).join('\n')
      : '暂无';

    return `今日日期：${today}

【今日任务】
${taskList}

【月度目标】
${goalList}

【客户数据】
总客户数：${totalCustomers}
最近跟进：
${followUpList}

【最近工作记录】
${workRecordBrief}

【用户记忆/偏好】
${memoryList}`;
  }

  private async calculateStreak(userId: string, today: string): Promise<number> {
    const userFilter = sql`(${dailyRecord.createdBy}).user_id = ${userId}`;
    const records = await this.db
      .select({ recordDate: dailyRecord.recordDate })
      .from(dailyRecord)
      .where(userFilter)
      .orderBy(desc(dailyRecord.recordDate))
      .limit(365);

    if (records.length === 0) return 0;

    const dateSet = new Set(
      records.map((r: { recordDate: string }) => r.recordDate),
    );

    let streak = 0;
    let current = new Date(today);

    // Include today if there is a record; otherwise start from yesterday
    if (!dateSet.has(today)) {
      current.setDate(current.getDate() - 1);
    }

    while (dateSet.has(this.formatDate(current))) {
      streak += 1;
      current.setDate(current.getDate() - 1);
    }

    return streak;
  }

  private getTodayDate(): string {
    const now = new Date();
    return this.formatDate(now);
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

  async deleteTask(taskId: string, userId: string): Promise<{ success: boolean }> {
    const userFilter = sql`(${task.createdBy}).user_id = ${userId}`;
    const deleted = await this.db
      .delete(task)
      .where(and(userFilter, eq(task.id, taskId)))
      .returning({ id: task.id });

    if (deleted.length === 0) {
      throw new NotFoundException('任务不存在或无权操作');
    }
    return { success: true };
  }
}
