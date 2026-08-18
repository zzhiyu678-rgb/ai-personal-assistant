import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';

import type {
  AnalyticsSummaryResponse,
  GenerateAnalyticsReportRequest,
  AnalyticsReportResponse,
} from '@shared/api.interface';
import { AnalyticsService } from './analytics.service';

interface AuthenticatedRequest extends Request {
  userContext: {
    userId: string;
    tenantId: string;
    appId: string;
    env: string;
  };
}

@Controller('api/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @NeedLogin()
  @Get('summary')
  async getSummary(
    @Req() req: AuthenticatedRequest,
    @Query('range') range?: string,
  ): Promise<AnalyticsSummaryResponse> {
    const days = range ? parseInt(range, 10) : 30;
    if (![7, 30, 90].includes(days)) {
      throw new BadRequestException('range 必须是 7、30 或 90');
    }
    const { userId } = req.userContext;
    return this.analyticsService.getSummary(userId, days);
  }

  @NeedLogin()
  @Post('report')
  async generateReport(
    @Req() req: AuthenticatedRequest,
    @Body() body: GenerateAnalyticsReportRequest,
  ): Promise<AnalyticsReportResponse> {
    const { userId } = req.userContext;
    return this.analyticsService.generatePeriodicReport(userId, body);
  }
}
