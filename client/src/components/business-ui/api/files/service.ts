'use client';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';

export interface UploadFileData {
  id: string;
  filePath: string;
  bucketId: string;
  url: string;
}

export async function uploadFile(file: File): Promise<UploadFileData> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axiosForBackend<{
    id: string;
    filePath: string;
    fileType: string;
    fileName: string;
    fileSize: number;
    url: string;
  }>({
    url: '/api/files/upload',
    method: 'POST',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return {
    id: response.data.id,
    filePath: response.data.filePath,
    bucketId: 'local',
    url: response.data.url,
  };
}
