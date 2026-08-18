import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';

import { DailyRecordService } from './daily-record.service';
import type {
  DailyRecord,
  DailyRecordListResponse,
  AiWorkAnalysis,
  SaveDailyRecordRequest,
} from '@shared/api.interface';

@Controller('api/daily-records')
export class DailyRecordController {
  constructor(private readonly dailyRecordService: DailyRecordService) {}

  @NeedLogin()
  @Get(':date')
  async getByDate(
    @Param('date') date: string,
    @Req() req: Request,
  ): Promise<DailyRecord | null> {
    const { userId } = req.userContext;
    return this.dailyRecordService.getByDate(date, userId);
  }

  @NeedLogin()
  @Put(':date')
  async upsert(
    @Param('date') date: string,
    @Body() body: SaveDailyRecordRequest,
    @Req() req: Request,
  ): Promise<DailyRecord> {
    const { userId } = req.userContext;
    return this.dailyRecordService.upsert({ date, userId, ...body });
  }

  @NeedLogin()
  @Post(':date/analyze')
  async analyze(
    @Param('date') date: string,
    @Req() req: Request,
  ): Promise<AiWorkAnalysis> {
    const { userId } = req.userContext;
    return this.dailyRecordService.analyze(date, userId);
  }

  @NeedLogin()
  @Post(':date/analyze-from-content')
  async analyzeFromContent(
    @Param('date') date: string,
    @Body() body: { content: string },
    @Req() req: Request,
  ): Promise<AiWorkAnalysis> {
    const { userId } = req.userContext;
    if (!body.content || !body.content.trim()) {
      throw new BadRequestException('请输入工作内容');
    }
    return this.dailyRecordService.analyzeFromContent(
      date,
      userId,
      body.content,
    );
  }

  @NeedLogin()
  @Put(':date/analysis')
  async updateAnalysis(
    @Param('date') date: string,
    @Body() body: { analysis: AiWorkAnalysis },
    @Req() req: Request,
  ): Promise<DailyRecord> {
    const { userId } = req.userContext;
    if (!body.analysis) {
      throw new BadRequestException('分析数据不能为空');
    }
    return this.dailyRecordService.updateAnalysis(date, userId, body.analysis);
  }

  @NeedLogin()
  @Get()
  async list(
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @Req() req: Request,
  ): Promise<DailyRecordListResponse> {
    const { userId } = req.userContext;
    const pageNum = page ? parseInt(page, 10) : 1;
    const sizeNum = pageSize ? parseInt(pageSize, 10) : 30;
    return this.dailyRecordService.list(userId, {
      page: pageNum,
      pageSize: sizeNum,
    });
  }
}
