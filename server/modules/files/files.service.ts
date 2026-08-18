import { join, resolve, extname, basename } from 'path';
import { createReadStream, existsSync, unlinkSync } from 'fs';
import { Inject, Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and, desc, count, ilike, or, sql } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';

import { knowledgeFile } from '../../database/schema';
import { verifyFileSignature } from './multer.config';
import { TextExtractorService } from './text-extractor.service';

export interface UploadedFileInfo {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  url: string;
}

interface StoredFile {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  extractedText: string | null;
  extractStatus: string;
  extractError: string | null;
  createdBy: string;
  createdAt: Date;
}

const FILE_TYPE_MAP: Record<string, string> = {
  '.pdf': 'PDF',
  '.doc': 'Word',
  '.docx': 'Word',
  '.ppt': 'PPT',
  '.pptx': 'PPT',
  '.xls': 'Excel',
  '.xlsx': 'Excel',
  '.txt': 'TXT',
  '.md': 'Markdown',
  '.png': 'Image',
  '.jpg': 'Image',
  '.jpeg': 'Image',
  '.gif': 'Image',
  '.webp': 'Image',
  '.svg': 'Image',
};

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly uploadDir: string;
  private readonly maxFileSize: number;

  constructor(
    private readonly configService: ConfigService,
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly textExtractor: TextExtractorService,
  ) {
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR', './uploads');
    this.maxFileSize = Number(
      this.configService.get<string>('MAX_FILE_SIZE', '10485760'),
    );
  }

  getUploadDir(): string {
    return this.uploadDir;
  }

  getMaxFileSize(): number {
    return this.maxFileSize;
  }

  async saveUploadedFile(
    file: Express.Multer.File,
    userId: string,
    category: string = 'knowledge',
  ): Promise<UploadedFileInfo> {
    const ext = extname(file.originalname).toLowerCase();
    const fullPath = file.path;

    if (!verifyFileSignature(fullPath, file.originalname)) {
      this.deletePhysicalFile(fullPath);
      throw new Error('文件签名校验失败，文件可能已损坏或类型不匹配');
    }

    const relativePath = this.getRelativePath(fullPath);
    const fileType = FILE_TYPE_MAP[ext] || ext.slice(1).toUpperCase();

    const rows = await this.db
      .insert(knowledgeFile)
      .values({
        fileName: file.originalname,
        fileType,
        fileSize: file.size,
        filePath: relativePath,
        extractedText: '',
        extractStatus: 'PROCESSING',
        extractError: null,
        createdBy: userId,
      })
      .returning();

    const row = rows[0];
    if (!row) {
      this.deletePhysicalFile(fullPath);
      throw new Error('保存文件记录失败');
    }

    // 异步提取文本，不阻塞上传响应
    this.extractAndSave(row.id, fullPath, file.originalname).catch(
      (err: unknown) => {
        this.logger.error(
          `文本提取失败 [${file.originalname}]: ${JSON.stringify(err)}`,
        );
      },
    );

    return {
      id: row.id,
      fileName: row.fileName,
      fileType: row.fileType,
      fileSize: row.fileSize,
      filePath: relativePath,
      url: `/api/files/${row.id}`,
    };
  }

  private async extractAndSave(
    fileId: string,
    fullPath: string,
    originalName: string,
  ): Promise<void> {
    const result = await this.textExtractor.extract(fullPath, originalName);

    if (result.success) {
      await this.db
        .update(knowledgeFile)
        .set({
          extractedText: result.text,
          extractStatus: 'READY',
          extractError: null,
          updatedAt: new Date(),
        })
        .where(eq(knowledgeFile.id, fileId));
      this.logger.log(`文本提取成功 [${originalName}]: ${result.text.length} 字符`);
    } else {
      await this.db
        .update(knowledgeFile)
        .set({
          extractStatus: 'ERROR',
          extractError: result.error || '未知错误',
          updatedAt: new Date(),
        })
        .where(eq(knowledgeFile.id, fileId));
      this.logger.warn(`文本提取失败 [${originalName}]: ${result.error}`);
    }
  }

  async getFileStream(id: string, userId: string) {
    const file = await this.findFileById(id);
    if (!file) {
      throw new NotFoundException('文件不存在');
    }
    if (file.createdBy !== userId) {
      throw new ForbiddenException('无权访问此文件');
    }

    const fullPath = join(this.uploadDir, file.filePath);
    if (!existsSync(fullPath)) {
      throw new NotFoundException('文件已不存在');
    }

    return {
      fileName: file.fileName,
      filePath: fullPath,
      fileSize: file.fileSize,
      fileType: file.fileType,
      stream: createReadStream(fullPath),
    };
  }

  async deleteFile(id: string, userId: string): Promise<{ success: boolean }> {
    const file = await this.findFileById(id);
    if (!file) {
      throw new NotFoundException('文件不存在');
    }
    if (file.createdBy !== userId) {
      throw new ForbiddenException('无权删除此文件');
    }

    const fullPath = join(this.uploadDir, file.filePath);
    this.deletePhysicalFile(fullPath);

    await this.db.delete(knowledgeFile).where(eq(knowledgeFile.id, id));
    return { success: true };
  }

  private async findFileById(id: string): Promise<StoredFile | null> {
    const rows = await this.db
      .select()
      .from(knowledgeFile)
      .where(eq(knowledgeFile.id, id))
      .limit(1);

    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: row.id,
      fileName: row.fileName,
      fileType: row.fileType,
      fileSize: row.fileSize,
      filePath: row.filePath,
      extractedText: row.extractedText,
      extractStatus: (row as any).extractStatus,
      extractError: (row as any).extractError,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    };
  }

  /**
   * 搜索知识库中与查询相关的内容
   * 基于关键词匹配（为未来向量检索预留接口）
   */
  async searchKnowledge(
    userId: string,
    query: string,
    limit: number = 3,
  ): Promise<Array<{ fileName: string; fileType: string; snippet: string }>> {
    const keywords = this.extractKeywords(query);
    if (keywords.length === 0) {
      // 没有关键词时返回最近的已处理文件
      const recent = await this.db
        .select({
          fileName: knowledgeFile.fileName,
          fileType: knowledgeFile.fileType,
          extractedText: knowledgeFile.extractedText,
        })
        .from(knowledgeFile)
        .where(
          and(
            eq(knowledgeFile.createdBy, userId),
            eq(knowledgeFile.extractStatus, 'READY'),
          ),
        )
        .orderBy(desc(knowledgeFile.updatedAt))
        .limit(limit);

      return recent
        .filter((f) => f.extractedText)
        .map((f) => ({
          fileName: f.fileName,
          fileType: f.fileType,
          snippet: (f.extractedText || '').slice(0, 2000),
        }));
    }

    // 用 ILIKE 搜索文件名和提取文本
    const conditions = keywords.map((kw) =>
      or(
        ilike(knowledgeFile.fileName, `%${kw}%`),
        ilike(knowledgeFile.extractedText, `%${kw}%`),
      ),
    );

    const results = await this.db
      .select({
        fileName: knowledgeFile.fileName,
        fileType: knowledgeFile.fileType,
        extractedText: knowledgeFile.extractedText,
      })
      .from(knowledgeFile)
      .where(
        and(
          eq(knowledgeFile.createdBy, userId),
          eq(knowledgeFile.extractStatus, 'READY'),
          or(...conditions),
        ),
      )
      .orderBy(desc(knowledgeFile.updatedAt))
      .limit(limit * 2);

    // 简单相关性排序：匹配关键词数量多的排前面
    const scored = results
      .filter((f) => f.extractedText)
      .map((f) => {
        const text = (f.extractedText || '').toLowerCase();
        const name = f.fileName.toLowerCase();
        let score = 0;
        for (const kw of keywords) {
          const kwLower = kw.toLowerCase();
          if (name.includes(kwLower)) score += 3;
          if (text.includes(kwLower)) score += 1;
        }
        // 提取最相关的片段
        const snippet = this.extractRelevantSnippet(
          f.extractedText || '',
          keywords,
        );
        return {
          fileName: f.fileName,
          fileType: f.fileType,
          snippet,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored;
  }

  private extractKeywords(query: string): string[] {
    // 简单关键词提取：移除停用词，取长度>=2的词
    const stopWords = new Set([
      '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一',
      '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有',
      '看', '好', '自己', '这', 'the', 'a', 'an', 'is', 'are', 'was', 'were',
      'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'can', 'to', 'of', 'in', 'for',
      'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    ]);

    // 中文按字切分（2-4字），英文按空格
    const words: string[] = [];
    // 提取英文单词
    const englishWords = query.match(/[a-zA-Z]{2,}/g) || [];
    words.push(...englishWords);
    // 提取中文 2-4 字组合
    const chineseChars = query.match(/[\u4e00-\u9fa5]+/g) || [];
    for (const segment of chineseChars) {
      for (let len = 2; len <= Math.min(4, segment.length); len++) {
        for (let i = 0; i <= segment.length - len; i++) {
          words.push(segment.slice(i, i + len));
        }
      }
    }

    return [...new Set(words.filter((w) => !stopWords.has(w.toLowerCase())))]
      .slice(0, 10);
  }

  private extractRelevantSnippet(
    text: string,
    keywords: string[],
    maxLength: number = 1500,
  ): string {
    if (text.length <= maxLength) return text;

    const lowerText = text.toLowerCase();
    let bestPos = 0;
    let bestScore = 0;

    // 滑动窗口找最相关的位置
    const windowSize = Math.min(maxLength, text.length);
    for (let pos = 0; pos <= text.length - windowSize; pos += 100) {
      const window = lowerText.slice(pos, pos + windowSize);
      let score = 0;
      for (const kw of keywords) {
        const kwLower = kw.toLowerCase();
        let idx = window.indexOf(kwLower);
        while (idx !== -1) {
          score++;
          idx = window.indexOf(kwLower, idx + 1);
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestPos = pos;
      }
    }

    const snippet = text.slice(bestPos, bestPos + windowSize);
    return (bestPos > 0 ? '...' : '') + snippet + (bestPos + windowSize < text.length ? '...' : '');
  }

  private getRelativePath(fullPath: string): string {
    const absUploadDir = resolve(this.uploadDir);
    const absFullPath = resolve(fullPath);
    return absFullPath.startsWith(absUploadDir)
      ? absFullPath.slice(absUploadDir.length).replace(/^\/|\\/, '')
      : basename(fullPath);
  }

  private deletePhysicalFile(filePath: string): void {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch (error) {
      this.logger.warn(`删除物理文件失败: ${filePath}, ${JSON.stringify(error)}`);
    }
  }
}
