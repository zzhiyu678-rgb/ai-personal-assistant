import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

import type {
  AiConversationListResponse,
  AiConversation,
  AiMessageListResponse,
  SendMessageRequest,
} from '@shared/api.interface';

export async function getConversations() {
  try {
    const response = await axiosForBackend<AiConversationListResponse>({
      url: '/api/ai-conversations',
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取对话列表失败', error);
    throw error;
  }
}

export async function createConversation(title?: string) {
  try {
    const response = await axiosForBackend<AiConversation>({
      url: '/api/ai-conversations',
      method: 'POST',
      data: title ? { title } : {},
    });
    return response.data;
  } catch (error) {
    logger.error('创建对话失败', error);
    throw error;
  }
}

export async function getMessages(conversationId: string) {
  try {
    const response = await axiosForBackend<AiMessageListResponse>({
      url: `/api/ai-conversations/${conversationId}/messages`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取消息列表失败', error);
    throw error;
  }
}

/**
 * 流式发送消息，使用原生 fetch 处理 ReadableStream
 * onChunk 每收到一块文本就回调一次，返回累积的完整文本
 */
export async function sendStreamMessage(
  conversationId: string,
  data: SendMessageRequest,
  onChunk: (fullText: string) => void,
): Promise<string> {
  try {
    const response = await fetch(
      `/api/ai-conversations/${conversationId}/messages`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法读取响应流');
    }

    const decoder = new TextDecoder();
    let result = '';

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
      onChunk(result);
    }

    return result;
  } catch (error) {
    logger.error('发送消息失败', error);
    throw error;
  }
}

/**
 * 只保存用户消息，不触发AI生成。
 * 用于连续消息合并：先逐条保存，debounce后再调用generateReply。
 */
export async function saveMessage(
  conversationId: string,
  data: SendMessageRequest,
): Promise<{ id: string; role: string; content: string }> {
  try {
    const response = await axiosForBackend({
      url: `/api/ai-conversations/${conversationId}/messages/save`,
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('保存消息失败', error);
    throw error;
  }
}

/**
 * 合并当前对话中所有未回复的用户消息，生成一次AI回复并流式返回。
 */
export async function generateReplyStream(
  conversationId: string,
  onChunk: (fullText: string) => void,
): Promise<string> {
  try {
    const response = await fetch(
      `/api/ai-conversations/${conversationId}/messages/generate`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法读取响应流');
    }

    const decoder = new TextDecoder();
    let result = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
      onChunk(result);
    }

    return result;
  } catch (error) {
    logger.error('生成回复失败', error);
    throw error;
  }
}

export async function deleteConversation(id: string) {
  try {
    const response = await axiosForBackend<{ success: boolean }>({
      url: `/api/ai-conversations/${id}`,
      method: 'DELETE',
    });
    return response.data;
  } catch (error) {
    logger.error('删除对话失败', error);
    throw error;
  }
}

export async function updateConversationTitle(id: string, title: string) {
  try {
    const response = await axiosForBackend<{ id: string; title: string }>({
      url: `/api/ai-conversations/${id}`,
      method: 'PATCH',
      data: { title },
    });
    return response.data;
  } catch (error) {
    logger.error('更新对话标题失败', error);
    throw error;
  }
}
