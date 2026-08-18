import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

import type {
  Task,
  TaskListResponse,
  BatchCreateTasksRequest,
  BatchCreateTasksResponse,
  UpdateTaskRequest,
  TomorrowPlanTask,
} from '@shared/api.interface';

export async function generateTomorrowPlan(): Promise<{ tasks: TomorrowPlanTask[] }> {
  try {
    const response = await axiosForBackend<{ tasks: TomorrowPlanTask[] }>({
      url: '/api/tasks/generate-tomorrow',
      method: 'POST',
    });
    return response.data;
  } catch (error) {
    logger.error('生成明日计划失败', error);
    throw error;
  }
}

export async function getTasks(params: {
  dueDate?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  try {
    const searchParams = new URLSearchParams();
    if (params.dueDate) searchParams.set('dueDate', params.dueDate);
    if (params.status) searchParams.set('status', params.status);
    if (params.page) searchParams.set('page', String(params.page));
    if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
    const response = await axiosForBackend<TaskListResponse>({
      url: `/api/tasks?${searchParams.toString()}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取任务列表失败', error);
    throw error;
  }
}

export async function batchCreateTasks(data: BatchCreateTasksRequest) {
  try {
    const response = await axiosForBackend<BatchCreateTasksResponse>({
      url: '/api/tasks/batch',
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('批量创建任务失败', error);
    throw error;
  }
}

export async function updateTask(id: string, data: UpdateTaskRequest): Promise<Task> {
  try {
    const response = await axiosForBackend<Task>({
      url: `/api/tasks/${id}`,
      method: 'PATCH',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('更新任务失败', error);
    throw error;
  }
}

export async function deleteTask(id: string): Promise<{ success: boolean }> {
  try {
    const response = await axiosForBackend<{ success: boolean }>({
      url: `/api/tasks/${id}`,
      method: 'DELETE',
    });
    return response.data;
  } catch (error) {
    logger.error('删除任务失败', error);
    throw error;
  }
}
