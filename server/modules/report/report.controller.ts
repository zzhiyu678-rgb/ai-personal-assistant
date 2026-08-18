import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';

import type {
  Report,
  ReportType,
  ReportListResponse,
  GenerateReportRequest,
} from '@shared/api.interface';
import { ReportService } from './report.service';

@Controller('api/reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @NeedLogin()
  @Post('generate')
  async generate(
    @Req() req: Request,
    @Body() body: GenerateReportRequest,
  ): Promise<Report> {
    const { userId } = (req as unknown as { userContext: { userId: string } }).userContext;
    const date = body.date ?? this.getTodayDate();
    return this.reportService.generateReport(date, body.type, userId);
  }

  @NeedLogin()
  @Get()
  async getList(
    @Req() req: Request,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<ReportListResponse> {
    const { userId } = (req as unknown as { userContext: { userId: string } }).userContext;
    const pageNum = page ? Math.max(1, parseInt(page, 10)) : 1;
    const sizeNum = pageSize ? Math.min(50, parseInt(pageSize, 10)) : 10;
    const reportType = type ? (type as ReportType) : undefined;
    return this.reportService.getList(reportType, pageNum, sizeNum, userId);
  }

  @NeedLogin()
  @Get(':id')
  async getDetail(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<Report> {
    const { userId } = (req as unknown as { userContext: { userId: string } }).userContext;
    return this.reportService.getDetail(id, userId);
  }

  private getTodayDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
