import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';

import type {
  GoalType,
  GoalStatus,
  GoalListResponse,
  Goal,
  GoalWithChildren,
  CreateGoalRequest,
  UpdateGoalRequest,
  DecomposeGoalResponse,
  ConfirmDecomposeRequest,
  ConfirmDecomposeResponse,
} from '@shared/api.interface';
import { GoalService } from './goal.service';

@Controller('api/goals')
export class GoalController {
  constructor(private readonly goalService: GoalService) {}

  @NeedLogin()
  @Get()
  async list(
    @Req() req: Request,
    @Query('type') type?: GoalType,
    @Query('status') status?: GoalStatus,
  ): Promise<GoalListResponse> {
    const { userId } = (req as unknown as { userContext: { userId: string } })
      .userContext;
    return this.goalService.list(userId, type, status);
  }

  @NeedLogin()
  @Get(':id')
  async detail(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<GoalWithChildren> {
    const { userId } = (req as unknown as { userContext: { userId: string } })
      .userContext;
    return this.goalService.getDetail(userId, id);
  }

  @NeedLogin()
  @Post()
  async create(
    @Req() req: Request,
    @Body() body: CreateGoalRequest,
  ): Promise<Goal> {
    const { userId } = (req as unknown as { userContext: { userId: string } })
      .userContext;
    return this.goalService.create(userId, body);
  }

  @NeedLogin()
  @Put(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: UpdateGoalRequest,
  ): Promise<Goal> {
    const { userId } = (req as unknown as { userContext: { userId: string } })
      .userContext;
    return this.goalService.update(userId, id, body);
  }

  @NeedLogin()
  @Delete(':id')
  async remove(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    const { userId } = (req as unknown as { userContext: { userId: string } })
      .userContext;
    return this.goalService.remove(userId, id);
  }

  @NeedLogin()
  @Post(':id/decompose')
  async decompose(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<DecomposeGoalResponse> {
    const { userId } = (req as unknown as { userContext: { userId: string } })
      .userContext;
    return this.goalService.decompose(userId, id);
  }

  @NeedLogin()
  @Post(':id/decompose/confirm')
  async confirmDecompose(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: ConfirmDecomposeRequest,
  ): Promise<ConfirmDecomposeResponse> {
    const { userId } = (req as unknown as { userContext: { userId: string } })
      .userContext;
    return this.goalService.confirmDecompose(userId, id, body.goals);
  }
}
