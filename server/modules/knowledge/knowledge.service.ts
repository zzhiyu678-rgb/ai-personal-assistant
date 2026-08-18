import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { eq, and, ilike, desc, count } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { Logger } from '@nestjs/common';

import { knowledgeFile } from '../../database/schema';
import type { KnowledgeFile, KnowledgeFileListResponse } from '@shared/api.interface';

interface CreateKnowledgeFileParams {
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  userId: string;
}

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async list(
    userId: string,
    params: { search?: string; page: number; pageSize: number },
  ): Promise<KnowledgeFileListResponse> {
    const { search, page, pageSize } = params;
    const offset = (page - 1) * pageSize;

    const whereConditions = [eq(knowledgeFile.createdBy, userId)];
    if (search) {
      whereConditions.push(ilike(knowledgeFile.fileName, `%${search}%`));
    }
    const whereClause = and(...whereConditions);

    const [totalResult, rows] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(knowledgeFile)
        .where(whereClause),
      this.db
        .select()
        .from(knowledgeFile)
        .where(whereClause)
        .orderBy(desc(knowledgeFile.createdAt))
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);
    const items: KnowledgeFile[] = rows.map((row) => ({
      id: row.id,
      fileName: row.fileName,
      fileType: row.fileType,
      fileSize: row.fileSize,
      uploadedAt: row.createdAt.toISOString(),
      hasExtractedText: Boolean(row.extractedText && row.extractedText.length > 0),
      extractStatus: (row as any).extractStatus || 'PENDING',
      extractError: (row as any).extractError || null,
    }));

    return { items, total };
  }

  async create(params: CreateKnowledgeFileParams) {
    const { fileName, fileType, fileSize, filePath, userId } = params;
    const rows = await this.db
      .insert(knowledgeFile)
      .values({
        fileName,
        fileType,
        fileSize,
        filePath,
        extractedText: '',
        createdBy: userId,
      })
      .returning();

    const row = rows[0];
    if (!row) {
      this.logger.error('创建知识库文件失败，未返回记录');
      throw new Error('创建知识库文件失败');
    }
    return row;
  }

  async delete(id: string, userId: string): Promise<{ success: boolean }> {
    const existing = await this.db
      .select()
      .from(knowledgeFile)
      .where(eq(knowledgeFile.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('文件不存在');
    }

    if (existing[0].createdBy !== userId) {
      throw new ForbiddenException('无权删除此文件');
    }

    await this.db.delete(knowledgeFile).where(eq(knowledgeFile.id, id));
    return { success: true };
  }
}
