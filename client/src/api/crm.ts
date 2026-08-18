import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

import type {
  Customer,
  CustomerListResponse,
  CreateCustomerRequest,
  UpdateCustomerRequest,
  FollowUpListResponse,
  CreateFollowUpRequest,
  FollowUpRecord,
} from '@shared/api.interface';

export async function getCustomers(params: {
  stage?: string;
  industry?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  try {
    const searchParams = new URLSearchParams();
    if (params.stage) searchParams.set('stage', params.stage);
    if (params.industry) searchParams.set('industry', params.industry);
    if (params.search) searchParams.set('search', params.search);
    if (params.page) searchParams.set('page', String(params.page));
    if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
    const response = await axiosForBackend<CustomerListResponse>({
      url: `/api/customers?${searchParams.toString()}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取客户列表失败', error);
    throw error;
  }
}

export async function getCustomer(id: string) {
  try {
    const response = await axiosForBackend<Customer>({
      url: `/api/customers/${id}`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取客户详情失败', error);
    throw error;
  }
}

export async function createCustomer(data: CreateCustomerRequest) {
  try {
    const response = await axiosForBackend<Customer>({
      url: '/api/customers',
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('创建客户失败', error);
    throw error;
  }
}

export async function updateCustomer(id: string, data: UpdateCustomerRequest) {
  try {
    const response = await axiosForBackend<Customer>({
      url: `/api/customers/${id}`,
      method: 'PUT',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('更新客户失败', error);
    throw error;
  }
}

export async function deleteCustomer(id: string) {
  try {
    const response = await axiosForBackend<{ success: boolean }>({
      url: `/api/customers/${id}`,
      method: 'DELETE',
    });
    return response.data;
  } catch (error) {
    logger.error('删除客户失败', error);
    throw error;
  }
}

export async function getFollowUps(customerId: string) {
  try {
    const response = await axiosForBackend<FollowUpListResponse>({
      url: `/api/customers/${customerId}/follow-ups`,
      method: 'GET',
    });
    return response.data;
  } catch (error) {
    logger.error('获取跟进记录失败', error);
    throw error;
  }
}

export async function createFollowUp(customerId: string, data: CreateFollowUpRequest) {
  try {
    const response = await axiosForBackend<FollowUpRecord>({
      url: `/api/customers/${customerId}/follow-ups`,
      method: 'POST',
      data,
    });
    return response.data;
  } catch (error) {
    logger.error('添加跟进记录失败', error);
    throw error;
  }
}

export async function deleteFollowUp(customerId: string, followUpId: string) {
  try {
    const response = await axiosForBackend<{ success: boolean }>({
      url: `/api/customers/${customerId}/follow-ups/${followUpId}`,
      method: 'DELETE',
    });
    return response.data;
  } catch (error) {
    logger.error('删除跟进记录失败', error);
    throw error;
  }
}

export async function batchDeleteCustomers(ids: string[]) {
  try {
    const response = await axiosForBackend<{ success: number; failed: number }>({
      url: '/api/customers/batch-delete',
      method: 'POST',
      data: { ids },
    });
    return response.data;
  } catch (error) {
    logger.error('批量删除客户失败', error);
    throw error;
  }
}

export async function analyzeCustomer(customerId: string) {
  try {
    const response = await axiosForBackend<{
      intentScore: number;
      customerType: string;
      needs: string;
      nextAction: string;
      suggestedReply: string;
      aiAnalysis?: string;
    }>({
      url: `/api/customers/${customerId}/analyze`,
      method: 'POST',
    });
    return response.data;
  } catch (error) {
    logger.error('客户AI分析失败', error);
    throw error;
  }
}
