import {
  Injectable,
  Logger,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { and, eq, isNull, count } from 'drizzle-orm';

import type {
  Goal,
  GoalType,
  GoalStatus,
  GoalWithChildren,
  CreateGoalRequest,
  UpdateGoalRequest,
  DecomposedGoal,
} from '@shared/api.interface';
import { goal } from '../../database/schema';
import { AiService } from '../ai/ai.service';

type GoalRow = typeof goal.$inferSelect;

@Injectable()
export class GoalService {
  private readonly logger = new Logger(GoalService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly aiService: AiService,
  ) {}

  private mapStatusToProgress(status: GoalStatus): number {
    if (status === 'DONE') return 100;
    if (status === 'IN_PROGRESS') return 50;
    return 0;
  }

  private toGoal(row: GoalRow, progress: number): Goal {
    return {
      id: row.id,
      type: row.type as GoalType,
      title: row.title,
      description: row.description,
      startDate: row.startDate as string,
      endDate: row.endDate as string,
      status: row.status as GoalStatus,
      parentId: row.parentId ?? null,
      progress,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async list(
    userId: string,
    type?: GoalType,
    status?: GoalStatus,
  ): Promise<{ items: Goal[]; total: number }> {
    const conditions = [eq(goal.createdBy, userId)];
    if (type) conditions.push(eq(goal.type, type));
    if (status) conditions.push(eq(goal.status, status));

    const where = and(...conditions);
    const rows: GoalRow[] = await this.db
      .select()
      .from(goal)
      .where(where)
      .orderBy(goal.createdAt);

    const countResult = await this.db
      .select({ count: count() })
      .from(goal)
      .where(where);
    const total = Number(countResult[0]?.count ?? 0);

    const items = await Promise.all(
      rows.map(async (row: GoalRow) => {
        const progress = await this.computeProgress(row.id);
        return this.toGoal(row, progress);
      }),
    );

    return { items, total };
  }

  async getDetail(userId: string, id: string): Promise<GoalWithChildren> {
    const rows: GoalRow[] = await this.db
      .select()
      .from(goal)
      .where(and(eq(goal.id, id), eq(goal.createdBy, userId)));

    if (rows.length === 0) {
      throw new NotFoundException('目标不存在');
    }
    const row = rows[0];

    const childRows: GoalRow[] = await this.db
      .select()
      .from(goal)
      .where(and(eq(goal.parentId, id), eq(goal.createdBy, userId)))
      .orderBy(goal.startDate);

    const children = await Promise.all(
      childRows.map(async (child: GoalRow) => {
        const childProgress = await this.computeProgress(child.id);
        return this.toGoal(child, childProgress);
      }),
    );

    const progress =
      children.length > 0
        ? Math.round(
            (children.filter((c: Goal) => c.status === 'DONE').length /
              children.length) *
              100,
          )
        : this.mapStatusToProgress(row.status as GoalStatus);

    return {
      ...this.toGoal(row, progress),
      children,
    };
  }

  private async computeProgress(goalId: string): Promise<number> {
    const children = await this.db
      .select()
      .from(goal)
      .where(eq(goal.parentId, goalId));

    if (children.length === 0) {
      const parent = await this.db
        .select()
        .from(goal)
        .where(eq(goal.id, goalId));
      if (parent.length === 0) return 0;
      return this.mapStatusToProgress(parent[0].status as GoalStatus);
    }

    const doneCount = children.filter(
      (child: GoalRow) => child.status === 'DONE',
    ).length;
    return Math.round((doneCount / children.length) * 100);
  }

  async create(userId: string, dto: CreateGoalRequest): Promise<Goal> {
    const inserted = await this.db
      .insert(goal)
      .values({
        type: dto.type,
        title: dto.title,
        description: dto.description ?? '',
        startDate: dto.startDate,
        endDate: dto.endDate,
        status: dto.status,
        parentId: dto.parentId ?? null,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    const row = inserted[0];
    return this.toGoal(row, this.mapStatusToProgress(dto.status));
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateGoalRequest,
  ): Promise<Goal> {
    const existing = await this.db
      .select()
      .from(goal)
      .where(and(eq(goal.id, id), eq(goal.createdBy, userId)));
    if (existing.length === 0) {
      throw new NotFoundException('目标不存在');
    }

    const patch: Partial<typeof goal.$inferInsert> = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.startDate !== undefined) patch.startDate = dto.startDate;
    if (dto.endDate !== undefined) patch.endDate = dto.endDate;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.parentId !== undefined) patch.parentId = dto.parentId;

    if (Object.keys(patch).length === 0) {
      const progress = await this.computeProgress(id);
      return this.toGoal(existing[0], progress);
    }

    patch.updatedAt = new Date();
    patch.updatedBy = userId;

    const updated = await this.db
      .update(goal)
      .set(patch)
      .where(and(eq(goal.id, id), eq(goal.createdBy, userId)))
      .returning();

    const progress = await this.computeProgress(id);
    return this.toGoal(updated[0], progress);
  }

  async remove(userId: string, id: string): Promise<{ success: boolean }> {
    const existing = await this.db
      .select()
      .from(goal)
      .where(and(eq(goal.id, id), eq(goal.createdBy, userId)));
    if (existing.length === 0) {
      throw new NotFoundException('目标不存在');
    }

    await this.db
      .update(goal)
      .set({ parentId: null, updatedAt: new Date(), updatedBy: userId })
      .where(and(eq(goal.parentId, id), eq(goal.createdBy, userId)));

    await this.db
      .delete(goal)
      .where(and(eq(goal.id, id), eq(goal.createdBy, userId)));

    return { success: true };
  }

  async decompose(
    userId: string,
    id: string,
  ): Promise<{ suggestedGoals: DecomposedGoal[] }> {
    const rows = await this.db
      .select()
      .from(goal)
      .where(and(eq(goal.id, id), eq(goal.createdBy, userId)));
    if (rows.length === 0) {
      throw new NotFoundException('目标不存在');
    }
    const goalRow = rows[0];

    const historyRows = await this.db
      .select()
      .from(goal)
      .where(
        and(eq(goal.createdBy, userId), eq(goal.type, 'WEEK'), isNull(goal.parentId)),
      )
      .limit(10)
      .orderBy(goal.createdAt);

    const historySummary = historyRows
      .map((row: GoalRow) => `- ${row.title} (${row.startDate} ~ ${row.endDate}, ${row.status})`)
      .join('\n');

    const monthlyGoalInfo = [
      `月目标：${goalRow.title}`,
      `描述：${goalRow.description || '无'}`,
      `时间范围：${goalRow.startDate} 至 ${goalRow.endDate}`,
      `状态：${goalRow.status}`,
      '',
      '历史周目标参考：',
      historySummary || '暂无历史数据',
    ].join('\n');

    const suggestedGoals = await this.aiService.decomposeGoal(monthlyGoalInfo);
    return { suggestedGoals };
  }

  async confirmDecompose(
    userId: string,
    parentId: string,
    goals: DecomposedGoal[],
  ): Promise<{ createdCount: number; goals: { id: string; title: string }[] }> {
    const parentRows = await this.db
      .select()
      .from(goal)
      .where(and(eq(goal.id, parentId), eq(goal.createdBy, userId)));
    if (parentRows.length === 0) {
      throw new NotFoundException('父目标不存在');
    }

    if (!goals || goals.length === 0) {
      return { createdCount: 0, goals: [] };
    }

    const values = goals.map((g: DecomposedGoal) => ({
      type: 'WEEK' as GoalType,
      title: g.title,
      description: g.description ?? '',
      startDate: g.startDate,
      endDate: g.endDate,
      status: 'NOT_STARTED' as GoalStatus,
      parentId,
      createdBy: userId,
      updatedBy: userId,
    }));

    const inserted = await this.db.insert(goal).values(values).returning();
    return {
      createdCount: inserted.length,
      goals: inserted.map((row: GoalRow) => ({ id: row.id, title: row.title })),
    };
  }
}
