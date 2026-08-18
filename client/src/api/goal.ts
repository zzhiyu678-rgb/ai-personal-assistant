import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

import type {
  GoalListResponse,
  Goal,
  GoalWithChildren,
  CreateGoalRequest,
  UpdateGoalRequest,
  DecomposeGoalResponse,
  ConfirmDecomposeRequest,
  ConfirmDecomposeResponse,
} from '@shared/api.interface';

export async function getGoals(params: { type?: string; status?: string }) {
  try {
    const searchParams = new URLSearchParams();
    if (params.type) searchParams.set('type', params.type);
    if (params.status) searchParams.set('status', params.status);
    const response = await axiosForBackend<GoalListResponse>({
      url: `/api/goals?${searchParams.toString()}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取目标列表失败', error);
    throw error;
  }
}

export async function getGoal(id: string) {
  try {
    const response = await axiosForBackend<GoalWithChildren>({
      url: `/api/goals/${id}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取目标详情失败', error);
    throw error;
  }
}

export async function createGoal(data: CreateGoalRequest) {
  try {
    const response = await axiosForBackend<Goal>({
      url: '/api/goals',
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('创建目标失败', error);
    throw error;
  }
}

export async function updateGoal(id: string, data: UpdateGoalRequest) {
  try {
    const response = await axiosForBackend<Goal>({
      url: `/api/goals/${id}`,
      method: 'PUT',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('更新目标失败', error);
    throw error;
  }
}

export async function deleteGoal(id: string) {
  try {
    const response = await axiosForBackend<{ success: boolean }>({
      url: `/api/goals/${id}`,
      method: 'DELETE',
    });
    return response.data;
  } catch (error) {
    logger.error('删除目标失败', error);
    throw error;
  }
}

export async function decomposeGoal(id: string) {
  try {
    const response = await axiosForBackend<DecomposeGoalResponse>({
      url: `/api/goals/${id}/decompose`,
      method: 'POST',
    });
    return response.data;
  } catch (error) {
    logger.error('AI拆解目标失败', error);
    throw error;
  }
}

export async function confirmDecompose(id: string, data: ConfirmDecomposeRequest) {
  try {
    const response = await axiosForBackend<ConfirmDecomposeResponse>({
      url: `/api/goals/${id}/decompose/confirm`,
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('确认拆解结果失败', error);
    throw error;
  }
}
