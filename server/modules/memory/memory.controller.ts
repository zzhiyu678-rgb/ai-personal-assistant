import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
} from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';

import { MemoryService } from './memory.service';
import type {
  Memory,
  MemoryListResponse,
  MemoryType,
  CreateMemoryRequest,
  UpdateMemoryRequest,
} from '@shared/api.interface';

@Controller('api/memories')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @NeedLogin()
  @Get()
  async list(
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @Query('type') type: string | undefined,
    @Req() req: Request,
  ): Promise<MemoryListResponse> {
    const { userId } = req.userContext;
    const pageNum = page ? parseInt(page, 10) : 1;
    const sizeNum = pageSize ? parseInt(pageSize, 10) : 50;
    return this.memoryService.list(userId, {
      page: pageNum,
      pageSize: sizeNum,
      type: type as MemoryType | undefined,
    });
  }

  @NeedLogin()
  @Post()
  async create(
    @Body() body: CreateMemoryRequest,
    @Req() req: Request,
  ): Promise<Memory> {
    const { userId } = req.userContext;
    return this.memoryService.create(userId, body);
  }

  @NeedLogin()
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateMemoryRequest,
    @Req() req: Request,
  ): Promise<Memory> {
    const { userId } = req.userContext;
    return this.memoryService.update(userId, id, body);
  }

  @NeedLogin()
  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: boolean }> {
    const { userId } = req.userContext;
    await this.memoryService.delete(userId, id);
    return { success: true };
  }
}
