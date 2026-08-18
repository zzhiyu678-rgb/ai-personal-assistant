import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { and, desc, eq, gte, lt, count, sql } from 'drizzle-orm';

import { report, dailyRecord, task, goal } from '@server/database/schema';
import type {
  Report,
  ReportContent,
  ReportType,
  ReportListResponse,
} from '@shared/api.interface';
import { AiService } from '../ai/ai.service';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly aiService: AiService,
  ) {}

  async generateReport(
    date: string,
    type: ReportType,
    userId: string,
  ): Promise<Report> {
    const userFilter = sql`(${dailyRecord.createdBy}).user_id = ${userId}`;

    // 1. 当日 daily_record
    const records = await this.db
      .select()
      .from(dailyRecord)
      .where(and(userFilter, eq(dailyRecord.recordDate, date)));

    const record = records[0];
    const workRecords = record
      ? `计划：${record.plan}\n完成：${record.completed}\n问题：${record.problems}\n明日想法：${record.tomorrowIdeas}`
      : '今日暂无工作记录';

    // 2. 当日任务完成统计
    const taskUserFilter = sql`(${task.createdBy}).user_id = ${userId}`;
    const dayTasks = await this.db
      .select({ status: task.status, priority: task.priority })
      .from(task)
      .where(and(taskUserFilter, eq(task.dueDate, date)));
    const totalTasks = dayTasks.length;
    const doneTasks = dayTasks.filter(
      (t: { status: string }) => t.status === 'DONE',
    ).length;
    const highPriorityCount = dayTasks.filter(
      (t: { priority: string }) => t.priority === 'HIGH',
    ).length;

    const dataStatistics = `今日任务总数：${totalTasks}，完成任务数：${doneTasks}，高优先级任务数：${highPriorityCount}`;

    // 3. 本月目标进度
    const thisMonth = date.slice(0, 7);
    const monthStart = `${thisMonth}-01`;
    const nextMonthStart = this.getNextMonthStart(date);
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
    const totalGoals = monthlyGoals.length;
    const doneGoals = monthlyGoals.filter(
      (g: { status: string }) => g.status === 'DONE',
    ).length;
    const goalProgressText = monthlyGoals.length > 0
      ? monthlyGoals
          .map((g: { title: string; status: string }) => `- ${g.title}（${g.status}）`)
          .join('\n')
      : '本月暂无目标';
    const goalProgress = `本月目标总数：${totalGoals}，已完成：${doneGoals}\n${goalProgressText}`;

    // 4. 调用 AI 生成（非流式，聚合全文）
    let fullText = '';
    try {
      const stream = this.aiService.streamDailyReport({
        workRecords,
        goalProgress,
        dataStatistics,
      });
      for await (const chunk of stream) {
        fullText += chunk;
      }
    } catch (error) {
      this.logger.error(`AI daily report generation failed: ${JSON.stringify(error)}`);
      throw new BadRequestException('AI服务暂时不可用，请稍后重试');
    }

    // 5. 组装结构化 content
    const content = this.parseReportContent(fullText, {
      completed: record?.completed,
      problems: record?.problems,
      doneTasks,
      totalTasks,
      highPriorityCount,
    });

    // 6. 保存到 report 表
    const titleMap: Record<ReportType, string> = {
      DAILY: '今日工作汇报',
      WEEKLY: '本周工作汇报',
      MONTHLY: '本月工作汇报',
    };

    const inserted = await this.db
      .insert(report)
      .values({
        reportDate: date,
        type,
        title: `${titleMap[type]} - ${date}`,
        content: content as unknown as Record<string, unknown>,
        fullText,
        createdBy: userId,
      })
      .returning();

    return this.mapReport(inserted[0]);
  }

  async getList(
    type: ReportType | undefined,
    page: number,
    pageSize: number,
    userId: string,
  ): Promise<ReportListResponse> {
    const userFilter = sql`(${report.createdBy}).user_id = ${userId}`;
    const conditions = [userFilter];
    if (type) conditions.push(eq(report.type, type));

    const whereClause = and(...conditions);

    const [countResult, items] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(report)
        .where(whereClause),
      this.db
        .select({
          id: report.id,
          title: report.title,
          reportDate: report.reportDate,
          type: report.type,
          createdAt: report.createdAt,
        })
        .from(report)
        .where(whereClause)
        .orderBy(desc(report.reportDate), desc(report.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return {
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        date: item.reportDate,
        type: item.type as ReportType,
        createdAt: item.createdAt.toISOString(),
      })),
      total,
    };
  }

  async getDetail(id: string, userId: string): Promise<Report> {
    const userFilter = sql`(${report.createdBy}).user_id = ${userId}`;
    const results = await this.db
      .select()
      .from(report)
      .where(and(userFilter, eq(report.id, id)));

    if (results.length === 0) {
      throw new NotFoundException('报告不存在或无权查看');
    }

    return this.mapReport(results[0]);
  }

  private parseReportContent(
    fullText: string,
    meta: {
      completed: string | undefined;
      problems: string | undefined;
      doneTasks: number;
      totalTasks: number;
      highPriorityCount: number;
    },
  ): ReportContent {
    const completedList = meta.completed
      ? meta.completed.split('\n').filter((s: string) => s.trim().length > 0)
      : [];

    const problemsList = meta.problems
      ? meta.problems.split('\n').filter((s: string) => s.trim().length > 0)
      : [];

    const statistics = [
      { label: '完成任务数', value: `${meta.doneTasks} / ${meta.totalTasks}` },
      { label: '高优先级任务', value: String(meta.highPriorityCount) },
      {
        label: '完成率',
        value: meta.totalTasks > 0
          ? `${Math.round((meta.doneTasks / meta.totalTasks) * 100)}%`
          : '0%',
      },
    ];

    // 从全文中粗提取各板块
    const aiAnalysis = this.extractSection(fullText, ['AI分析', '工作分析', '分析总结']);
    const suggestions = this.extractListSection(fullText, ['改进建议', '建议', '优化建议']);
    const tomorrowGoals = this.extractListSection(fullText, ['明日目标和计划', '明日目标', '明日计划', '明天安排']);

    return {
      completed: completedList,
      statistics,
      problems: problemsList,
      aiAnalysis: aiAnalysis || '基于今日工作记录的AI分析内容。',
      suggestions: suggestions.length > 0 ? suggestions : ['持续保持当前工作节奏。'],
      tomorrowGoals: tomorrowGoals.length > 0 ? tomorrowGoals : ['继续推进当前重点任务。'],
    };
  }

  private extractSection(text: string, keywords: string[]): string {
    for (const keyword of keywords) {
      const regex = new RegExp(
        `(?:^|\\n)[\\s]*[一二三四五六七八九十]*[、\\.]?\\s*${keyword}[：:]*\\s*\\n?([\\s\\S]*?)(?=\\n[\\s]*[一二三四五六七八九十]*[、\\.]?\\s*[\\u4e00-\\u9fa5]{2,}[：:]|$)`,
      );
      const match = text.match(regex);
      if (match && match[1] && match[1].trim().length > 20) {
        return match[1].trim();
      }
    }
    return '';
  }

  private extractListSection(text: string, keywords: string[]): string[] {
    const section = this.extractSection(text, keywords);
    if (!section) return [];
    return section
      .split('\n')
      .map((line: string) => line.replace(/^[-•*·\d、.）)]+\s*/, '').trim())
      .filter((s: string) => s.length > 0);
  }

  private mapReport(raw: typeof report.$inferSelect): Report {
    const content = (raw.content ?? {}) as unknown as ReportContent;
    return {
      id: raw.id,
      title: raw.title,
      type: raw.type as ReportType,
      date: raw.reportDate,
      content,
      fullText: raw.fullText ?? '',
      createdAt: raw.createdAt.toISOString(),
    };
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
