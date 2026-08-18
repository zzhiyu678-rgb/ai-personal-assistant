import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

import type { KnowledgeFileListResponse } from '@shared/api.interface';

export async function getKnowledgeFiles(params: {
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  try {
    const searchParams = new URLSearchParams();
    if (params.search) searchParams.set('search', params.search);
    if (params.page) searchParams.set('page', String(params.page));
    if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
    const response = await axiosForBackend<KnowledgeFileListResponse>({
      url: `/api/knowledge-files?${searchParams.toString()}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取知识库文件列表失败', error);
    throw error;
  }
}

export async function createKnowledgeFile(params: {
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
}) {
  try {
    const response = await axiosForBackend({
      url: '/api/knowledge-files',
      method: 'POST',
      data: params,
    });
    return response.data;
  } catch (error) {
    logger.error('保存知识库文件元信息失败', error);
    throw error;
  }
}

export async function deleteKnowledgeFile(id: string) {
  try {
    const response = await axiosForBackend<{ success: boolean }>({
      url: `/api/knowledge-files/${id}`,
      method: 'DELETE',
    });
    return response.data;
  } catch (error) {
    logger.error('删除知识库文件失败', error);
    throw error;
  }
}
