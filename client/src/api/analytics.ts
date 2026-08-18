import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

import type {
  AnalyticsSummaryResponse,
  GenerateAnalyticsReportRequest,
  AnalyticsReportResponse,
} from '@shared/api.interface';

export async function getAnalyticsSummary(range: number) {
  try {
    const response = await axiosForBackend<AnalyticsSummaryResponse>({
      url: `/api/analytics/summary?range=${range}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取数据分析汇总失败', error);
    throw error;
  }
}

export async function generateAnalyticsReport(data: GenerateAnalyticsReportRequest) {
  try {
    const response = await axiosForBackend<AnalyticsReportResponse>({
      url: '/api/analytics/report',
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('生成周期工作总结报告失败', error);
    throw error;
  }
}
