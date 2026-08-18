import { Inject, Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { desc, count, eq, sql, and } from 'drizzle-orm';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';

import { memory } from '../../database/schema';
import type {
  Memory,
  MemoryListResponse,
  MemoryType,
  CreateMemoryRequest,
  UpdateMemoryRequest,
} from '@shared/api.interface';

function mapRowToMemory(row: typeof memory.$inferSelect): Memory {
  return {
    id: row.id,
    type: row.type as MemoryType,
    content: row.content,
    source: row.source as 'USER_EXPLICIT' | 'AI_EXTRACTED',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async list(
    userId: string,
    params: { page: number; pageSize: number; type?: MemoryType },
  ): Promise<MemoryListResponse> {
    const { page, pageSize, type } = params;
    const offset = (page - 1) * pageSize;

    const whereConditions: unknown[] = [
      sql`(${memory.createdBy}).user_id = ${userId}`,
    ];
    if (type) {
      whereConditions.push(eq(memory.type, type));
    }

    const whereClause = and(...(whereConditions as any[]));

    const [totalResult, rows] = await Promise.all([
      this.db.select({ count: count() }).from(memory).where(whereClause),
      this.db
        .select()
        .from(memory)
        .where(whereClause)
        .orderBy(desc(memory.createdAt))
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);
    const items = rows.map(mapRowToMemory);

    return { items, total };
  }

  async getAllByUser(userId: string): Promise<Memory[]> {
    const rows = await this.db
      .select()
      .from(memory)
      .where(sql`(${memory.createdBy}).user_id = ${userId}`)
      .orderBy(desc(memory.createdAt));
    return rows.map(mapRowToMemory);
  }

  async create(userId: string, dto: CreateMemoryRequest): Promise<Memory> {
    if (!dto.content?.trim()) {
      throw new BadRequestException('记忆内容不能为空');
    }
    const inserted = await this.db
      .insert(memory)
      .values({
        type: dto.type,
        content: dto.content.trim(),
        source: dto.source ?? 'USER_EXPLICIT',
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    if (inserted.length === 0) {
      throw new Error('创建记忆失败');
    }
    return mapRowToMemory(inserted[0]);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateMemoryRequest,
  ): Promise<Memory> {
    const patch: Partial<typeof memory.$inferInsert> = {};
    if (dto.type !== undefined) patch.type = dto.type;
    if (dto.content !== undefined) {
      if (!dto.content.trim()) {
        throw new BadRequestException('记忆内容不能为空');
      }
      patch.content = dto.content.trim();
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    const existing = await this.db
      .select()
      .from(memory)
      .where(
        sql`${memory.id} = ${id}::uuid AND (${memory.createdBy}).user_id = ${userId}`,
      )
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('记忆不存在');
    }

    const updated = await this.db
      .update(memory)
      .set({
        ...patch,
        updatedAt: sql`CURRENT_TIMESTAMP` as unknown as Date,
        updatedBy: sql`ROW(${userId})::user_profile` as unknown as string,
      })
      .where(eq(memory.id, existing[0].id))
      .returning();

    if (updated.length === 0) {
      throw new Error('更新记忆失败');
    }
    return mapRowToMemory(updated[0]);
  }

  async delete(userId: string, id: string): Promise<void> {
    const existing = await this.db
      .select()
      .from(memory)
      .where(
        sql`${memory.id} = ${id}::uuid AND (${memory.createdBy}).user_id = ${userId}`,
      )
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('记忆不存在');
    }

    await this.db.delete(memory).where(eq(memory.id, existing[0].id));
  }
}
