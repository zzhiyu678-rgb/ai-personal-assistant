import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

export interface UploadFileResult {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  url: string;
}

export async function uploadFile(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<UploadFileResult> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await axiosForBackend<UploadFileResult>({
      url: '/api/files/upload',
      method: 'POST',
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent: { loaded: number; total?: number }) => {
        if (progressEvent.total && onProgress) {
          const percent = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total,
          );
          onProgress(percent);
        }
      },
    });
    return response.data;
  } catch (error) {
    logger.error('文件上传失败', error);
    throw error;
  }
}

export function getFileUrl(fileId: string): string {
  return `/api/files/${fileId}`;
}

export async function deleteFile(id: string): Promise<{ success: boolean }> {
  try {
    const response = await axiosForBackend<{ success: boolean }>({
      url: `/api/files/${id}`,
      method: 'DELETE',
    });
    return response.data;
  } catch (error) {
    logger.error('删除文件失败', error);
    throw error;
  }
}
