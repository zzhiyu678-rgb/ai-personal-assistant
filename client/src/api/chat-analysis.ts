import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

import type {
  ChatAnalysisResult,
  ChatAnalysisRequest,
} from '@shared/api.interface';

export async function analyzeChat(data: ChatAnalysisRequest) {
  try {
    const response = await axiosForBackend<ChatAnalysisResult>({
      url: '/api/chat-analysis',
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('聊天分析失败', error);
    throw error;
  }
}
