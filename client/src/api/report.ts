import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

import type {
  Report,
  ReportListResponse,
  GenerateReportRequest,
} from '@shared/api.interface';

export async function generateReport(data: GenerateReportRequest) {
  try {
    const response = await axiosForBackend<Report>({
      url: '/api/reports/generate',
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('生成日报失败', error);
    throw error;
  }
}

export async function getReports(params: { type?: string; page?: number; pageSize?: number }) {
  try {
    const searchParams = new URLSearchParams();
    if (params.type) searchParams.set('type', params.type);
    if (params.page) searchParams.set('page', String(params.page));
    if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
    const response = await axiosForBackend<ReportListResponse>({
      url: `/api/reports?${searchParams.toString()}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取报告列表失败', error);
    throw error;
  }
}

export async function getReport(id: string) {
  try {
    const response = await axiosForBackend<Report>({
      url: `/api/reports/${id}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取报告详情失败', error);
    throw error;
  }
}
