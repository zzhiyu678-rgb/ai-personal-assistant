import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Upload,
  Search,
  FileText,
  Trash2,
  File,
  CheckCircle2,
  Loader2,
  Download,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { Card, CardContent } from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  createKnowledgeFile,
  deleteKnowledgeFile,
  getKnowledgeFiles,
} from '@client/src/api/knowledge';
import { uploadFile, getFileUrl } from '@client/src/api/files';
import type { KnowledgeFile } from '@shared/api.interface';

type UploadStatus = 'uploading' | 'parsing' | 'done' | 'error';

interface UploadingFile {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: UploadStatus;
  errorMessage?: string;
}

const ACCEPTED_EXTENSIONS = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md';
const FILE_TYPE_LABELS: Record<string, string> = {
  pdf: 'PDF',
  doc: 'Word',
  docx: 'Word',
  ppt: 'PPT',
  pptx: 'PPT',
  xls: 'Excel',
  xlsx: 'Excel',
  txt: '文本',
  md: 'Markdown',
};

function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex < 0) return '';
  return fileName.slice(dotIndex + 1).toLowerCase();
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function getFileTypeColor(fileType: string): string {
  const ext = fileType.toLowerCase();
  if (ext === 'pdf') return 'text-red-500';
  if (ext === 'doc' || ext === 'docx') return 'text-blue-500';
  if (ext === 'ppt' || ext === 'pptx') return 'text-orange-500';
  if (ext === 'xls' || ext === 'xlsx') return 'text-green-600';
  if (ext === 'txt' || ext === 'md') return 'text-gray-500';
  return 'text-muted-foreground';
}

function FileTypeIcon({
  fileName,
  size = 'md',
}: {
  fileName: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const ext = getFileExtension(fileName);
  const colorClass = getFileTypeColor(ext);
  const sizeClass =
    size === 'lg' ? 'size-8' : size === 'sm' ? 'size-4' : 'size-5';

  return (
    <FileText
      className={`${sizeClass} ${colorClass} shrink-0`}
      aria-hidden="true"
    />
  );
}

const KnowledgePage = () => {
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<number | null>(null);

  const fetchFiles = useCallback(
    async (searchValue: string, currentPage: number) => {
      setLoading(true);
      try {
        const result = await getKnowledgeFiles({
          search: searchValue || undefined,
          page: currentPage,
          pageSize,
        });
        setFiles(result.items);
        setTotal(result.total);
      } catch (error) {
        logger.error('加载知识库文件失败', error);
      } finally {
        setLoading(false);
      }
    },
    [pageSize],
  );

  useEffect(() => {
    fetchFiles(search, page);
  }, [fetchFiles, search, page]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    setPage(1);

    if (searchTimerRef.current) {
      window.clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = window.setTimeout(() => {
      fetchFiles(value, 1);
    }, 300);
  };

  const updateUploadingFile = (
    tempId: string,
    patch: Partial<UploadingFile>,
  ) => {
    setUploadingFiles((prev) =>
      prev.map((f) => (f.id === tempId ? { ...f, ...patch } : f)),
    );
  };

  const removeUploadingFile = (tempId: string) => {
    setUploadingFiles((prev) => prev.filter((f) => f.id !== tempId));
  };

  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const fileList = Array.from(selectedFiles);

    for (const file of fileList) {
      const tempId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const uploadingItem: UploadingFile = {
        id: tempId,
        fileName: file.name,
        fileSize: file.size,
        progress: 0,
        status: 'uploading',
      };
      setUploadingFiles((prev) => [...prev, uploadingItem]);

      try {
        const uploadResult = await uploadFile(file, (progress: number) => {
          updateUploadingFile(tempId, { progress });
        });

        updateUploadingFile(tempId, { progress: 100, status: 'parsing' });

        const ext = getFileExtension(file.name);
        const fileTypeLabel = FILE_TYPE_LABELS[ext] || ext.toUpperCase();

        await createKnowledgeFile({
          fileName: file.name,
          fileType: fileTypeLabel,
          fileSize: file.size,
          filePath: uploadResult.filePath,
        });

        updateUploadingFile(tempId, { status: 'done', progress: 100 });
        fetchFiles(search, page);

        window.setTimeout(() => {
          removeUploadingFile(tempId);
        }, 2000);
      } catch (error) {
        logger.error('上传文件失败', error);
        const errorMessage =
          error instanceof Error ? error.message : '上传失败，请重试';
        updateUploadingFile(tempId, {
          status: 'error',
          errorMessage,
        });
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteKnowledgeFile(id);
      setFiles((prev) => prev.filter((f) => f.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (error) {
      logger.error('删除文件失败', error);
    }
  };

  const handleDownload = (id: string) => {
    const url = getFileUrl(id);
    window.open(url, '_blank');
  };

  const showEmpty = !loading && files.length === 0 && uploadingFiles.length === 0;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI 知识库</h1>
          <p className="text-muted-foreground mt-1">
            上传公司资料和销售素材，让AI回答更贴合业务实际
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="搜索文件名..."
              className="pl-9"
              value={search}
              onChange={handleSearchChange}
            />
          </div>
          <Button onClick={handleUploadClick}>
            <Upload className="size-4" />
            上传文件
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      </div>

      {/* 使用说明提示条 */}
      <Card className="border border-border bg-accent/40 shadow-sm">
        <CardContent className="p-4 flex items-center gap-3">
          <FileText className="size-5 text-primary shrink-0" />
          <p className="text-sm text-muted-foreground">
            上传的文件将被AI学习，在工作助手对话中自动参考相关内容。支持 PDF /
            Word / PPT / Excel / TXT / MD 格式。
          </p>
        </CardContent>
      </Card>

      {/* 文件列表区 */}
      <Card className="border border-border shadow-sm">
        <CardContent className="p-0">
          {/* 上传进度卡片区 */}
          {uploadingFiles.length > 0 && (
            <div className="p-4 space-y-3 border-b border-border">
              {uploadingFiles.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-accent/50"
                >
                  <FileTypeIcon fileName={item.fileName} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {item.fileName}
                      </p>
                      <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                        {item.status === 'uploading' && `${item.progress}%`}
                        {item.status === 'parsing' && '解析中...'}
                        {item.status === 'done' && (
                          <span className="text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="size-3" />
                            已加入知识库
                          </span>
                        )}
                        {item.status === 'error' && (
                          <span className="text-red-500">上传失败</span>
                        )}
                      </span>
                    </div>
                    {(item.status === 'uploading' ||
                      item.status === 'parsing') && (
                      <div className="mt-2 h-1.5 w-full bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-200 rounded-full"
                          style={{
                            width:
                              item.status === 'parsing'
                                ? '100%'
                                : `${item.progress}%`,
                          }}
                        />
                      </div>
                    )}
                    {item.status === 'error' && item.errorMessage && (
                      <p className="text-xs text-red-500 mt-1">
                        {item.errorMessage}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {loading && files.length === 0 ? (
            <div className="p-12 flex items-center justify-center">
              <Loader2 className="size-6 text-primary animate-spin" />
            </div>
          ) : showEmpty ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <div className="aspect-square size-16 rounded-full bg-accent flex items-center justify-center mb-4">
                <File className="size-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                还没有上传文件
              </h3>
              <p className="text-muted-foreground mt-2 max-w-md">
                点击上方按钮开始上传，支持 PDF / Word / PPT / Excel / TXT / MD 格式
              </p>
              <Button className="mt-6" onClick={handleUploadClick}>
                <Upload className="size-4" />
                上传文件
              </Button>
            </div>
          ) : (
            <div>
              {/* 表头 */}
              <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <div className="col-span-5">文件名</div>
                <div className="col-span-2">文件类型</div>
                <div className="col-span-2">文件大小</div>
                <div className="col-span-2">上传时间</div>
                    <div className="col-span-1 text-right">操作</div>
                  </div>

                  {/* 行 */}
                  <div>
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className="grid grid-cols-12 gap-4 px-6 py-3 items-center hover:bg-accent/40 transition-colors border-b border-border/50 last:border-b-0"
                      >
                        <div className="col-span-5 flex items-center gap-3 min-w-0">
                          <FileTypeIcon fileName={file.fileName} />
                          <span className="text-sm text-foreground truncate">
                            {file.fileName}
                          </span>
                        </div>
                        <div className="col-span-2 text-sm text-muted-foreground">
                          {file.fileType}
                        </div>
                        <div className="col-span-2 text-sm text-muted-foreground tabular-nums">
                          {formatFileSize(file.fileSize)}
                        </div>
                        <div className="col-span-2 text-sm text-muted-foreground tabular-nums">
                          {formatDate(file.uploadedAt)}
                        </div>
                        <div className="col-span-1 flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-primary"
                            onClick={() => handleDownload(file.id)}
                            title="下载"
                          >
                            <Download className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-red-500 hover:bg-red-50"
                            onClick={() => handleDelete(file.id)}
                            title="删除"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

              {/* 分页信息 */}
              {total > pageSize && (
                <div className="px-6 py-3 flex items-center justify-between border-t border-border text-sm text-muted-foreground">
                  <span>
                    共 {total} 个文件，第 {page} /{' '}
                    {Math.ceil(total / pageSize)} 页
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= Math.ceil(total / pageSize)}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default KnowledgePage;
