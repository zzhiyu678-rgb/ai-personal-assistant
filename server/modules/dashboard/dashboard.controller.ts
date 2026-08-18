import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';

import { DashboardService } from './dashboard.service';
import type {
  DashboardTodayResponse,
  Task,
  TaskPriority,
  TaskStatus,
} from '@shared/api.interface';

@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('today')
  @NeedLogin()
  async getToday(@Req() req: Request): Promise<DashboardTodayResponse> {
    const { userId } = req.userContext;
    return this.dashboardService.getTodayData(userId);
  }

  @Get('ai-suggestion')
  @NeedLogin()
  async getAiSuggestion(@Req() req: Request): Promise<{ suggestion: string | null }> {
    const { userId } = req.userContext;
    const suggestion = await this.dashboardService.getAiSuggestion(userId);
    return { suggestion };
  }

  @Get('tasks')
  @NeedLogin()
  async getTodayTasks(@Req() req: Request): Promise<Task[]> {
    const { userId } = req.userContext;
    return this.dashboardService.getTodayTasks(userId);
  }

  @Patch('tasks/:id')
  @NeedLogin()
  async updateTaskStatus(
    @Param('id') id: string,
    @Body() body: { status: TaskStatus },
    @Req() req: Request,
  ): Promise<Task> {
    if (!body.status) {
      throw new BadRequestException('status 不能为空');
    }
    const { userId } = req.userContext;
    return this.dashboardService.updateTaskStatus(id, body.status, userId);
  }

  @Post('tasks')
  @NeedLogin()
  async createTask(
    @Body() body: { title: string; priority?: TaskPriority },
    @Req() req: Request,
  ): Promise<Task> {
    if (!body.title || body.title.trim().length === 0) {
      throw new BadRequestException('任务标题不能为空');
    }
    const { userId } = req.userContext;
    return this.dashboardService.createQuickTask(
      body.title.trim(),
      body.priority,
      userId,
    );
  }

  @Delete('tasks/:id')
  @NeedLogin()
  async deleteTask(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: boolean }> {
    const { userId } = req.userContext;
    return this.dashboardService.deleteTask(id, userId);
  }
}
