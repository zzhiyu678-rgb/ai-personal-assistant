import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, gte, lt, sql, count } from 'drizzle-orm';

import type {
  AnalyticsSummaryResponse,
  GenerateAnalyticsReportRequest,
  AnalyticsReportResponse,
  CustomerStage,
} from '@shared/api.interface';
import {
  task as taskTable,
  customer as customerTable,
  customerFollowUp as followUpTable,
  report as reportTable,
  goal as goalTable,
} from '../../database/schema';
import { AiService } from '../ai/ai.service';

const STAGE_LABELS: Record<CustomerStage, string> = {
  UNCONTACTED: '未联系',
  ADDED: '已添加',
  COMMUNICATING: '沟通中',
  INTERESTED: '意向',
  CLOSED: '成交',
};

interface DateCountRow {
  date: string;
  count: number;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly aiService: AiService,
  ) {}

  async getSummary(
    userId: string,
    days: number,
  ): Promise<AnalyticsSummaryResponse> {
    const { startDate, endDate } = this.getDateRange(days);

    const [
      totalTasks,
      completedTasks,
      totalCustomers,
      closedCustomers,
      workTrendRows,
      customerGrowthRows,
      communicationRows,
      stageRows,
      industryRows,
    ] = await Promise.all([
      this.getTaskCount(userId, startDate, endDate, null),
      this.getTaskCount(userId, startDate, endDate, 'DONE'),
      this.getCustomerCount(userId, null),
      this.getCustomerCount(userId, 'CLOSED'),
      this.getWorkTrend(userId, startDate, endDate),
      this.getCustomerGrowth(userId, startDate, endDate),
      this.getCommunicationStats(userId, startDate, endDate),
      this.getStageDistribution(userId, startDate, endDate),
      this.getIndustryDistribution(userId, startDate, endDate),
    ]);

    const taskCompletionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const dealRate =
      totalCustomers > 0
        ? Math.round((closedCustomers / totalCustomers) * 100)
        : 0;

    const dateArr = this.buildDateArray(startDate, endDate);
    const workTrend = this.fillDateArray(
      dateArr,
      workTrendRows.map((r) => ({ date: r.date, count: r.count })),
    ).map((item) => ({ date: item.date, completedCount: item.count }));

    const customerGrowth = this.fillDateArray(
      dateArr,
      customerGrowthRows.map((r) => ({ date: r.date, count: r.count })),
    ).map((item) => ({ date: item.date, newCount: item.count }));

    const communicationStats = this.fillDateArray(
      dateArr,
      communicationRows.map((r) => ({ date: r.date, count: r.count })),
    );

    const taskCompletionByPeriod = this.buildPeriodCompletion(
      dateArr,
      workTrend,
    );

    return {
      kpis: {
        taskCompletionRate,
        totalCustomers,
        closedCustomers,
        dealRate,
      },
      workTrend,
      taskCompletionByPeriod,
      customerGrowth,
      communicationStats,
      stageDistribution: stageRows,
      industryDistribution: industryRows,
    };
  }

  async generatePeriodicReport(
    userId: string,
    body: GenerateAnalyticsReportRequest,
  ): Promise<AnalyticsReportResponse> {
    const summaryType = body.type;
    const { startDate, endDate, reportDate, title } =
      this.getPeriodDateRange(body);

    const summary = await this.getSummary(
      userId,
      this.diffDays(startDate, endDate),
    );

    const goals = await this.db
      .select({
        id: goalTable.id,
        title: goalTable.title,
        status: goalTable.status,
        startDate: goalTable.startDate,
        endDate: goalTable.endDate,
      })
      .from(goalTable)
      .where(
        and(
          eq(goalTable.createdBy, userId),
          eq(goalTable.type, summaryType === 'WEEKLY' ? 'WEEK' : 'MONTH'),
        ),
      );

    const periodData = JSON.stringify(summary);
    const goalCompletion = JSON.stringify({
      goals: goals.map((g) => ({
        title: g.title,
        status: g.status,
      })),
    });

    const completedCount = summary.workTrend.reduce(
      (sum: number, item: { completedCount: number }) => sum + item.completedCount,
      0,
    );
    const strengths = completedCount > 0 ? ['任务执行稳定', '客户跟进积极'] : [];
    const weaknesses = summary.kpis.dealRate < 30 ? ['成交率有待提升'] : [];
    const strengthsWeaknesses = JSON.stringify({ strengths, weaknesses });

    let fullText = '';
    try {
      const stream = this.aiService.streamPeriodicSummary({
        summaryType,
        periodData,
        goalCompletion,
        strengthsWeaknesses,
      });
      for await (const chunk of stream) {
        fullText += chunk;
      }
    } catch (error) {
      this.logger.error(
        `Periodic summary generation failed: ${JSON.stringify(error)}`,
      );
      fullText = '报告生成失败，请稍后重试。';
    }

    const reportContent = {
      completed: [],
      statistics: [
        { label: '任务完成率', value: `${summary.kpis.taskCompletionRate}%` },
        { label: '客户总数', value: String(summary.kpis.totalCustomers) },
        { label: '成交客户数', value: String(summary.kpis.closedCustomers) },
        { label: '成交率', value: `${summary.kpis.dealRate}%` },
      ],
      problems: [],
      aiAnalysis: fullText,
      suggestions: [],
      tomorrowGoals: [],
    };

    const inserted = await this.db
      .insert(reportTable)
      .values({
        reportDate,
        type: summaryType,
        title,
        content: reportContent as unknown as Record<string, unknown>,
        fullText,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning({
        id: reportTable.id,
        title: reportTable.title,
        type: reportTable.type,
        reportDate: reportTable.reportDate,
        fullText: reportTable.fullText,
        createdAt: reportTable.createdAt,
      });

    const row = inserted[0];
    return {
      id: row.id,
      title: row.title,
      type: row.type,
      date: String(row.reportDate),
      content: fullText,
      fullText,
    };
  }

  private getDateRange(days: number): { startDate: string; endDate: string } {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days + 1);
    return {
      startDate: this.formatDate(start),
      endDate: this.formatDate(end),
    };
  }

  private getPeriodDateRange(body: GenerateAnalyticsReportRequest): {
    startDate: string;
    endDate: string;
    reportDate: string;
    title: string;
  } {
    const base = body.date ? new Date(body.date) : new Date();
    let startDate: string;
    let endDate: string;
    let reportDate: string;
    let title: string;

    if (body.type === 'WEEKLY') {
      const day = base.getDay() || 7;
      const monday = new Date(base);
      monday.setDate(base.getDate() - day + 1);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      startDate = this.formatDate(monday);
      endDate = this.formatDate(sunday);
      reportDate = this.formatDate(monday);
      title = `${startDate} 至 ${endDate} 周工作总结`;
    } else {
      const first = new Date(base.getFullYear(), base.getMonth(), 1);
      const last = new Date(base.getFullYear(), base.getMonth() + 1, 0);
      startDate = this.formatDate(first);
      endDate = this.formatDate(last);
      reportDate = this.formatDate(first);
      title = `${base.getFullYear()}年${base.getMonth() + 1}月 工作总结`;
    }

    return { startDate, endDate, reportDate, title };
  }

  private diffDays(start: string, end: string): number {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    return Math.max(1, Math.round((e - s) / 86400000) + 1);
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private buildDateArray(start: string, end: string): string[] {
    const dates: string[] = [];
    const curr = new Date(start);
    const last = new Date(end);
    while (curr <= last) {
      dates.push(this.formatDate(curr));
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  }

  private fillDateArray(
    dateArr: string[],
    rows: { date: string; count: number }[],
  ): { date: string; count: number }[] {
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.date, row.count);
    }
    return dateArr.map((d) => ({
      date: d,
      count: map.get(d) ?? 0,
    }));
  }

  private async getTaskCount(
    userId: string,
    startDate: string,
    endDate: string,
    status: string | null,
  ): Promise<number> {
    const conditions = [
      eq(taskTable.createdBy, userId),
      gte(taskTable.createdAt, new Date(`${startDate}T00:00:00.000Z`)),
      lt(taskTable.createdAt, new Date(`${endDate}T23:59:59.999Z`)),
    ];
    if (status) {
      conditions.push(eq(taskTable.status, status));
    }
    const result = await this.db
      .select({ count: count() })
      .from(taskTable)
      .where(and(...conditions));
    return Number(result[0]?.count ?? 0);
  }

  private async getCustomerCount(
    userId: string,
    stage: string | null,
  ): Promise<number> {
    const conditions = [eq(customerTable.createdBy, userId)];
    if (stage) {
      conditions.push(eq(customerTable.stage, stage));
    }
    const result = await this.db
      .select({ count: count() })
      .from(customerTable)
      .where(and(...conditions));
    return Number(result[0]?.count ?? 0);
  }

  private async getWorkTrend(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<DateCountRow[]> {
    const rows = await this.db
      .select({
        date: sql<string>`DATE(${taskTable.createdAt})::text`,
        count: count(),
      })
      .from(taskTable)
      .where(
        and(
          eq(taskTable.createdBy, userId),
          eq(taskTable.status, 'DONE'),
          gte(taskTable.createdAt, new Date(`${startDate}T00:00:00.000Z`)),
          lt(taskTable.createdAt, new Date(`${endDate}T23:59:59.999Z`)),
        ),
      )
      .groupBy(sql`DATE(${taskTable.createdAt})`)
      .orderBy(sql`DATE(${taskTable.createdAt})`);
    return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
  }

  private async getCustomerGrowth(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<DateCountRow[]> {
    const rows = await this.db
      .select({
        date: sql<string>`DATE(${customerTable.createdAt})::text`,
        count: count(),
      })
      .from(customerTable)
      .where(
        and(
          eq(customerTable.createdBy, userId),
          gte(customerTable.createdAt, new Date(`${startDate}T00:00:00.000Z`)),
          lt(customerTable.createdAt, new Date(`${endDate}T23:59:59.999Z`)),
        ),
      )
      .groupBy(sql`DATE(${customerTable.createdAt})`)
      .orderBy(sql`DATE(${customerTable.createdAt})`);
    return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
  }

  private async getCommunicationStats(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<DateCountRow[]> {
    const rows = await this.db
      .select({
        date: sql<string>`DATE(${followUpTable.createdAt})::text`,
        count: count(),
      })
      .from(followUpTable)
      .where(
        and(
          eq(followUpTable.createdBy, userId),
          gte(followUpTable.createdAt, new Date(`${startDate}T00:00:00.000Z`)),
          lt(followUpTable.createdAt, new Date(`${endDate}T23:59:59.999Z`)),
        ),
      )
      .groupBy(sql`DATE(${followUpTable.createdAt})`)
      .orderBy(sql`DATE(${followUpTable.createdAt})`);
    return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
  }

  private async getStageDistribution(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<Array<{ stage: string; count: number }>> {
    const stages: CustomerStage[] = [
      'UNCONTACTED',
      'ADDED',
      'COMMUNICATING',
      'INTERESTED',
      'CLOSED',
    ];
    const rows = await this.db
      .select({
        stage: customerTable.stage,
        count: count(),
      })
      .from(customerTable)
      .where(
        and(
          eq(customerTable.createdBy, userId),
          gte(customerTable.createdAt, new Date(`${startDate}T00:00:00.000Z`)),
          lt(customerTable.createdAt, new Date(`${endDate}T23:59:59.999Z`)),
        ),
      )
      .groupBy(customerTable.stage);

    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.stage, Number(row.count));
    }
    return stages.map((s) => ({
      stage: STAGE_LABELS[s],
      count: map.get(s) ?? 0,
    }));
  }

  private async getIndustryDistribution(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<Array<{ industry: string; count: number }>> {
    const rows = await this.db
      .select({
        industry: customerTable.industry,
        count: count(),
      })
      .from(customerTable)
      .where(
        and(
          eq(customerTable.createdBy, userId),
          gte(customerTable.createdAt, new Date(`${startDate}T00:00:00.000Z`)),
          lt(customerTable.createdAt, new Date(`${endDate}T23:59:59.999Z`)),
        ),
      )
      .groupBy(customerTable.industry)
      .orderBy(sql`count(*) DESC`)
      .limit(5);

    return rows.map((r) => ({
      industry: r.industry || '未分类',
      count: Number(r.count),
    }));
  }

  private buildPeriodCompletion(
    dateArr: string[],
    workTrend: Array<{ date: string; completedCount: number }>,
  ): Array<{ period: string; rate: number }> {
    const periods: Array<{ label: string; completed: number; total: number }> =
      [];
    const completedMap = new Map<string, number>();
    for (const item of workTrend) {
      completedMap.set(item.date, item.completedCount);
    }

    for (let i = 0; i < dateArr.length; i += 7) {
      const chunk = dateArr.slice(i, i + 7);
      const first = chunk[0];
      const last = chunk[chunk.length - 1];
      const label = `${first.slice(5)}~${last.slice(5)}`;
      let completed = 0;
      for (const d of chunk) {
        completed += completedMap.get(d) ?? 0;
      }
      periods.push({
        label,
        completed,
        total: chunk.length,
      });
    }

    return periods.map((p) => ({
      period: p.label,
      rate: p.total > 0 ? Math.round((p.completed / (p.total * 3)) * 100) : 0,
    }));
  }
}
