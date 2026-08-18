import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';

import { KnowledgeService } from './knowledge.service';
import type { KnowledgeFileListResponse } from '@shared/api.interface';

@Controller('api/knowledge-files')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  @NeedLogin()
  async list(
    @Req() req: { userContext: { userId: string } },
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<KnowledgeFileListResponse> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;

    if (isNaN(pageNum) || pageNum < 1) {
      throw new BadRequestException('page 参数无效');
    }
    if (isNaN(pageSizeNum) || pageSizeNum < 1 || pageSizeNum > 100) {
      throw new BadRequestException('pageSize 参数无效');
    }

    const { userId } = req.userContext;
    return this.knowledgeService.list(userId, {
      search,
      page: pageNum,
      pageSize: pageSizeNum,
    });
  }

  @Post()
  @NeedLogin()
  async create(
    @Req() req: { userContext: { userId: string } },
    @Body() body: { fileName: string; fileType: string; fileSize: number; filePath: string },
  ) {
    const { fileName, fileType, fileSize, filePath } = body;

    if (!fileName || !fileType || !filePath) {
      throw new BadRequestException('缺少必要字段');
    }
    if (fileSize === undefined || fileSize === null) {
      throw new BadRequestException('缺少 fileSize 字段');
    }

    const { userId } = req.userContext;
    const row = await this.knowledgeService.create({
      fileName,
      fileType,
      fileSize: Number(fileSize),
      filePath,
      userId,
    });
    return {
      id: row.id,
      fileName: row.fileName,
      fileType: row.fileType,
      fileSize: row.fileSize,
      filePath: row.filePath,
      uploadedAt: row.createdAt.toISOString(),
      hasExtractedText: Boolean(row.extractedText && row.extractedText.length > 0),
    };
  }

  @Delete(':id')
  @NeedLogin()
  async delete(
    @Req() req: { userContext: { userId: string } },
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    const { userId } = req.userContext;
    return this.knowledgeService.delete(id, userId);
  }
}
