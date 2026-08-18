import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

import type {
  DailyRecord,
  DailyRecordListResponse,
  SaveDailyRecordRequest,
  AiWorkAnalysis,
} from '@shared/api.interface';

export async function getDailyRecord(date: string) {
  try {
    const response = await axiosForBackend<DailyRecord | null>({
      url: `/api/daily-records/${date}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取工作记录失败', error);
    throw error;
  }
}

export async function saveDailyRecord(date: string, data: SaveDailyRecordRequest) {
  try {
    const response = await axiosForBackend<DailyRecord>({
      url: `/api/daily-records/${date}`,
      method: 'PUT',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('保存工作记录失败', error);
    throw error;
  }
}

export async function analyzeDailyRecord(date: string) {
  try {
    const response = await axiosForBackend<AiWorkAnalysis>({
      url: `/api/daily-records/${date}/analyze`,
      method: 'POST',
    });
    return response.data;
  } catch (error) {
    logger.error('AI分析工作记录失败', error);
    throw error;
  }
}

export async function analyzeDailyRecordFromContent(date: string, content: string) {
  try {
    const response = await axiosForBackend<AiWorkAnalysis>({
      url: `/api/daily-records/${date}/analyze-from-content`,
      method: 'POST',
      data: { content },
    });
    return response.data;
  } catch (error) {
    logger.error('AI分析工作记录失败', error);
    throw error;
  }
}

export async function updateDailyRecordAnalysis(date: string, analysis: AiWorkAnalysis) {
  try {
    const response = await axiosForBackend<DailyRecord>({
      url: `/api/daily-records/${date}/analysis`,
      method: 'PUT',
      data: { analysis },
    });
    return response.data;
  } catch (error) {
    logger.error('更新分析结果失败', error);
    throw error;
  }
}

export async function getDailyRecordList(params: { page?: number; pageSize?: number }) {
  try {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
    const response = await axiosForBackend<DailyRecordListResponse>({
      url: `/api/daily-records?${searchParams.toString()}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取历史记录列表失败', error);
    throw error;
  }
}
