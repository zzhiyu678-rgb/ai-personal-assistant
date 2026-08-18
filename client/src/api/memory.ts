import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

import type {
  Memory,
  MemoryListResponse,
  CreateMemoryRequest,
  UpdateMemoryRequest,
} from '@shared/api.interface';

export async function getMemories(params: { page?: number; pageSize?: number; type?: string }) {
  try {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
    if (params.type) searchParams.set('type', params.type);
    const response = await axiosForBackend<MemoryListResponse>({
      url: `/api/memories?${searchParams.toString()}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取记忆列表失败', error);
    throw error;
  }
}

export async function createMemory(data: CreateMemoryRequest) {
  try {
    const response = await axiosForBackend<Memory>({
      url: '/api/memories',
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('创建记忆失败', error);
    throw error;
  }
}

export async function updateMemory(id: string, data: UpdateMemoryRequest) {
  try {
    const response = await axiosForBackend<Memory>({
      url: `/api/memories/${id}`,
      method: 'PUT',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('更新记忆失败', error);
    throw error;
  }
}

export async function deleteMemory(id: string) {
  try {
    const response = await axiosForBackend<{ success: boolean }>({
      url: `/api/memories/${id}`,
      method: 'DELETE',
    });
    return response.data;
  } catch (error) {
    logger.error('删除记忆失败', error);
    throw error;
  }
}
