import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

import type { DashboardTodayResponse, Task, TaskPriority, TaskStatus } from '@shared/api.interface';

export async function getDashboardToday(): Promise<DashboardTodayResponse> {
  try {
    const response = await axiosForBackend({
      url: '/api/dashboard/today',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取仪表盘数据失败', error);
    throw error;
  }
}

export async function getAiSuggestion(): Promise<string | null> {
  try {
    const response = await axiosForBackend({
      url: '/api/dashboard/ai-suggestion',
      method: 'GET',
    });
    return response.data?.suggestion ?? null;
  } catch (error) {
    logger.error('获取AI建议失败', error);
    return null;
  }
}

export async function getTodayTasks(): Promise<Task[]> {
  try {
    const response = await axiosForBackend({
      url: '/api/dashboard/tasks',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取今日任务失败', error);
    throw error;
  }
}

export async function updateTaskStatus(
  id: string,
  status: TaskStatus,
): Promise<Task> {
  try {
    const response = await axiosForBackend({
      url: `/api/dashboard/tasks/${id}`,
      method: 'PATCH',
      data: { status },
    });
    return response.data;
  } catch (error) {
    logger.error('更新任务状态失败', error);
    throw error;
  }
}

export async function createQuickTask(
  title: string,
  priority?: TaskPriority,
): Promise<Task> {
  try {
    const response = await axiosForBackend({
      url: '/api/dashboard/tasks',
      method: 'POST',
      data: { title, priority },
    });
    return response.data;
  } catch (error) {
    logger.error('创建任务失败', error);
    throw error;
  }
}
