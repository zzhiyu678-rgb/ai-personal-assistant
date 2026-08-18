import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';

import type {
  Task,
  TaskStatus,
  TaskListResponse,
  BatchCreateTasksRequest,
  BatchCreateTasksResponse,
  UpdateTaskRequest,
  TomorrowPlanTask,
} from '@shared/api.interface';
import { TaskService } from './task.service';

@Controller('api/tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @NeedLogin()
  @Get()
  async getList(
    @Req() req: Request,
    @Query('dueDate') dueDate?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<TaskListResponse> {
    const { userId } = (req as unknown as { userContext: { userId: string } }).userContext;
    const pageNum = page ? Math.max(1, parseInt(page, 10)) : 1;
    const sizeNum = pageSize ? Math.min(50, parseInt(pageSize, 10)) : 20;
    const taskStatus = status ? (status as TaskStatus) : undefined;
    return this.taskService.getList(dueDate, taskStatus, pageNum, sizeNum, userId);
  }

  @NeedLogin()
  @Post('batch')
  async batchCreate(
    @Req() req: Request,
    @Body() body: BatchCreateTasksRequest,
  ): Promise<BatchCreateTasksResponse> {
    const { userId } = (req as unknown as { userContext: { userId: string } }).userContext;
    if (!body.tasks) {
      throw new BadRequestException('缺少 tasks 字段');
    }
    return this.taskService.batchCreate(body, userId);
  }

  @NeedLogin()
  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: UpdateTaskRequest,
  ): Promise<Task> {
    const { userId } = (req as unknown as { userContext: { userId: string } }).userContext;
    return this.taskService.update(id, body, userId);
  }

  @NeedLogin()
  @Delete(':id')
  async remove(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    const { userId } = (req as unknown as { userContext: { userId: string } }).userContext;
    return this.taskService.remove(id, userId);
  }

  @NeedLogin()
  @Post('generate-tomorrow')
  async generateTomorrowPlan(
    @Req() req: Request,
  ): Promise<{ tasks: TomorrowPlanTask[] }> {
    const { userId } = (req as unknown as { userContext: { userId: string } }).userContext;
    return this.taskService.generateTomorrowPlan(userId);
  }
}
