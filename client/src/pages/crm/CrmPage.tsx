import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Users,
  Eye,
  Edit3,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Building2,
  Upload,
  Download,
  Check,
} from 'lucide-react';

import type {
  Customer,
  CustomerStage,
  FollowUpRecord,
  CreateCustomerRequest,
  UpdateCustomerRequest,
  CreateFollowUpRequest,
} from '@shared/api.interface';
import * as crmApi from '@client/src/api/crm';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Card, CardContent } from '@client/src/components/ui/card';
import { Badge } from '@client/src/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@client/src/components/ui/alert-dialog';
import { CustomerFormDialog, INDUSTRY_OPTIONS } from './CustomerFormDialog';
import { FollowUpFormDialog } from './FollowUpFormDialog';
import {
  CustomerInfoPanel,
  AiAnalysisPanel,
  FollowUpTimeline,
} from './CustomerDetailPanels';

interface StageTab {
  value: string;
  label: string;
}

const STAGE_TABS: StageTab[] = [
  { value: 'ALL', label: '全部' },
  { value: 'UNCONTACTED', label: '未联系' },
  { value: 'ADDED', label: '已添加' },
  { value: 'COMMUNICATING', label: '沟通中' },
  { value: 'INTERESTED', label: '意向客户' },
  { value: 'CLOSED', label: '成交' },
];

const STAGE_CLASSES: Record<CustomerStage, string> = {
  UNCONTACTED: 'bg-gray-100 text-gray-600 border-transparent',
  ADDED: 'bg-blue-100 text-blue-600 border-transparent',
  COMMUNICATING: 'bg-indigo-100 text-indigo-600 border-transparent',
  INTERESTED: 'bg-amber-100 text-amber-600 border-transparent',
  CLOSED: 'bg-green-100 text-green-600 border-transparent',
};

const STAGE_LABELS: Record<CustomerStage, string> = {
  UNCONTACTED: '未联系',
  ADDED: '已添加',
  COMMUNICATING: '沟通中',
  INTERESTED: '意向客户',
  CLOSED: '成交',
};

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];

const CrmPage = () => {
  const [stage, setStage] = useState<string>('ALL');
  const [industry, setIndustry] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [jumpPage, setJumpPage] = useState<string>('');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [detailOpen, setDetailOpen] = useState<boolean>(false);
  const [followUps, setFollowUps] = useState<FollowUpRecord[]>([]);
  const [followUpsLoading, setFollowUpsLoading] = useState<boolean>(false);

  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formLoading, setFormLoading] = useState<boolean>(false);

  const [followUpFormOpen, setFollowUpFormOpen] = useState<boolean>(false);
  const [followUpFormLoading, setFollowUpFormLoading] = useState<boolean>(false);
  const [analyzingCustomer, setAnalyzingCustomer] = useState<boolean>(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);

  // 批量导入状态
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{
    columns: string[];
    rows: Array<Record<string, string>>;
    fieldMapping: Record<string, string>;
  } | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; duplicates: number } | null>(null);
  const [editableRows, setEditableRows] = useState<Array<Record<string, string>>>([]);
  const [selectedPreviewRows, setSelectedPreviewRows] = useState<Set<number>>(new Set());

  // 批量删除
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await crmApi.getCustomers({
        stage,
        industry: industry || undefined,
        search: search || undefined,
        page,
        pageSize,
      });
      setCustomers(result.items);
      setTotal(result.total);
    } catch {
      setCustomers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [stage, industry, search, page, pageSize]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleStageChange = (value: string) => {
    setStage(value);
    setPage(1);
  };

  const handleIndustryChange = (value: string) => {
    setIndustry(value);
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setPage(1);
      fetchCustomers();
    }
  };

  const openCreateDialog = () => {
    setFormMode('create');
    setFormOpen(true);
  };

  const openEditDialog = (cust: Customer) => {
    setSelectedCustomer(cust);
    setFormMode('edit');
    setFormOpen(true);
  };

  const handleFormSubmit = async (
    data: CreateCustomerRequest | UpdateCustomerRequest,
  ) => {
    setFormLoading(true);
    try {
      if (formMode === 'create') {
        await crmApi.createCustomer(data as CreateCustomerRequest);
      } else if (selectedCustomer) {
        const updated = await crmApi.updateCustomer(
          selectedCustomer.id,
          data as UpdateCustomerRequest,
        );
        if (detailOpen && selectedCustomer.id === updated.id) {
          setSelectedCustomer(updated);
        }
      }
      setFormOpen(false);
      fetchCustomers();
    } catch {
      // handled by caller
    } finally {
      setFormLoading(false);
    }
  };

  const openDeleteDialog = (cust: Customer) => {
    setCustomerToDelete(cust);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!customerToDelete) return;
    setDeleteLoading(true);
    try {
      await crmApi.deleteCustomer(customerToDelete.id);
      if (detailOpen && selectedCustomer?.id === customerToDelete.id) {
        setDetailOpen(false);
        setSelectedCustomer(null);
      }
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
      fetchCustomers();
    } catch {
      // handled by caller
    } finally {
      setDeleteLoading(false);
    }
  };

  // ==================== 批量导入 ====================
  const handleImportFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls'].includes(ext || '')) {
      alert('请上传.xlsx或.xls格式文件');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('文件不能超过10MB');
      return;
    }
    setImportFile(file);
    setImportLoading(true);
    setImportPreview(null);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const resp = await fetch('/api/customers/import/preview', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (!data.rows || data.rows.length === 0) {
        alert('未识别到有效客户数据');
        return;
      }
      setImportPreview(data);
      setEditableRows(data.rows.map((r: Record<string, string>) => ({ ...r })));
    } catch (err) {
      console.error('导入预览失败', err);
      alert('文件解析失败，请检查文件格式');
    } finally {
      setImportLoading(false);
    }
    e.target.value = '';
  };

  const handleImportCellChange = (rowIdx: number, field: string, value: string) => {
    setEditableRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], [field]: value };
      return next;
    });
  };

  const handleConfirmImport = async () => {
    if (!importPreview || editableRows.length === 0) return;
    setImportLoading(true);
    try {
      // 将预览行转换为标准字段
      const customers = editableRows.map((row) => {
        const getField = (fieldName: string) => {
          // 先通过 fieldMapping 找列名
          const col = Object.entries(importPreview.fieldMapping).find(([, f]) => f === fieldName)?.[0];
          if (col && row[col]) return row[col];
          // 备用：直接找字段名
          return row[fieldName] || '';
        };
        return {
          company: getField('company'),
          phone: getField('phone'),
          email: getField('email'),
          website: getField('website'),
          legalRep: getField('legalRep'),
          morePhone: getField('morePhone'),
          industry: getField('industry'),
          notes: getField('notes'),
        };
      }).filter((c) => c.company);

      const resp = await fetch('/api/customers/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customers }),
      });
      const result = await resp.json();
      setImportResult(result);
      fetchCustomers();
    } catch (err) {
      console.error('导入失败', err);
      alert('导入失败，请重试');
    } finally {
      setImportLoading(false);
    }
  };

  const openCustomerDetail = async (cust: Customer) => {
    setSelectedCustomer(cust);
    setDetailOpen(true);
    setFollowUpsLoading(true);
    try {
      const result = await crmApi.getFollowUps(cust.id);
      setFollowUps(result.items);
    } catch {
      setFollowUps([]);
    } finally {
      setFollowUpsLoading(false);
    }
  };

  const handleAddFollowUp = () => {
    setFollowUpFormOpen(true);
  };

  const handleFollowUpSubmit = async (data: CreateFollowUpRequest) => {
    if (!selectedCustomer) return;
    setFollowUpFormLoading(true);
    try {
      const newFollowUp = await crmApi.createFollowUp(selectedCustomer.id, data);
      setFollowUps((prev) => [newFollowUp, ...prev]);

      const updatedCustomer = await crmApi.getCustomer(selectedCustomer.id);
      setSelectedCustomer(updatedCustomer);

      fetchCustomers();
      setFollowUpFormOpen(false);
    } catch {
      // handled by caller
    } finally {
      setFollowUpFormLoading(false);
    }
  };

  const handleAnalyzeCustomer = async () => {
    if (!selectedCustomer) return;
    setAnalyzingCustomer(true);
    try {
      const result = await crmApi.analyzeCustomer(selectedCustomer.id);
      const updatedCustomer = await crmApi.getCustomer(selectedCustomer.id);
      setSelectedCustomer(updatedCustomer);
      toast.success('AI分析完成');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '分析失败';
      toast.error(msg.includes('API Key') || msg.includes('豆包') ? '请先配置豆包 AI API Key' : 'AI分析失败，请重试');
    } finally {
      setAnalyzingCustomer(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // 切换每页数量，回到第1页
  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
    setSelectedIds(new Set());
  };

  // 跳转页码
  const handleJumpPage = () => {
    const target = parseInt(jumpPage, 10);
    if (!isNaN(target) && target >= 1 && target <= totalPages) {
      setPage(target);
      setSelectedIds(new Set());
    }
    setJumpPage('');
  };

  // 全选当前筛选结果（获取所有匹配客户ID）
  const handleSelectAllFiltered = async () => {
    try {
      const result = await crmApi.getCustomers({
        stage,
        industry: industry || undefined,
        search: search || undefined,
        page: 1,
        pageSize: 10000,
      });
      const allIds = result.items.map((c: Customer) => c.id);
      setSelectedIds(new Set(allIds));
      toast.success(`已选择当前筛选结果共 ${allIds.length} 个客户`);
    } catch {
      toast.error('获取筛选结果失败，请重试');
    }
  };

  // 批量删除后处理分页
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`确定删除选中的 ${selectedIds.size} 个客户吗？`)) return;
    setBatchDeleting(true);
    try {
      await crmApi.batchDeleteCustomers([...selectedIds]);
      const deletedCount = selectedIds.size;
      setSelectedIds(new Set());
      // 如果当前页删空了且不是第1页，回到上一页
      const remainingOnPage = customers.length - deletedCount;
      if (remainingOnPage <= 0 && page > 1) {
        setPage(page - 1);
      } else {
        fetchCustomers();
      }
      toast.success(`成功删除 ${deletedCount} 个客户`);
    } catch {
      toast.error('批量删除失败，请重试');
    } finally {
      setBatchDeleting(false);
    }
  };

  return (
    <div className="h-[calc(100vh-108px)] flex flex-col overflow-hidden max-w-[1400px] mx-auto w-full p-6 gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground">客户管理</h1>
          <p className="text-muted-foreground mt-1">
            管理客户全生命周期，AI辅助提升转化率
          </p>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              onClick={handleBatchDelete}
              disabled={batchDeleting}
            >
              <Trash2 className="size-4 mr-2" />
              批量删除({selectedIds.size})
            </Button>
          )}
          <Button variant="outline" onClick={() => window.open('/api/customers/import/template', '_blank')}>
            <Download className="size-4 mr-2" />
            下载模板
          </Button>
          <Button variant="outline" onClick={() => { setImportOpen(true); setImportPreview(null); setImportResult(null); setImportFile(null); }}>
            <Upload className="size-4 mr-2" />
            批量导入
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="size-4 mr-2" />
            新增客户
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="border border-border shadow-sm flex-shrink-0">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 max-w-sm min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="搜索公司名/电话/邮箱..."
                className="pl-9"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
            </div>

            <div className="w-[140px]">
              <Select value={industry} onValueChange={handleIndustryChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="全部行业" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部行业</SelectItem>
                  {INDUSTRY_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            {STAGE_TABS.map((tab) => (
              <Button
                key={tab.value}
                variant={stage === tab.value ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleStageChange(tab.value)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Customer List */}
      <Card className="border border-border shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden">
        {loading ? (
          <CardContent className="p-12 flex items-center justify-center flex-1">
            <p className="text-muted-foreground text-sm">加载中...</p>
          </CardContent>
        ) : customers.length === 0 ? (
          <CardContent className="p-12 flex flex-col items-center justify-center text-center flex-1">
            <div className="aspect-square size-16 rounded-full bg-accent flex items-center justify-center mb-4">
              <Users className="size-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">还没有客户</h3>
            <p className="text-muted-foreground mt-2 max-w-md">
              添加第一个客户，开始管理你的客户跟进流程，
              AI将自动分析客户意向并推荐下一步沟通策略
            </p>
            <Button className="mt-6" onClick={openCreateDialog}>
              <Plus className="size-4 mr-2" />
              新增客户
            </Button>
          </CardContent>
        ) : (
          <>
            {/* 列表工具栏 */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-accent/20 flex-shrink-0">
              <span className="text-sm text-muted-foreground">
                共 <span className="font-semibold text-foreground">{total.toLocaleString()}</span> 个客户
                {search && <span className="ml-2">（搜索："{search}"）</span>}
              </span>
              {total > customers.length && (
                <button
                  onClick={handleSelectAllFiltered}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.size === total && total > 0}
                    readOnly
                    className="rounded"
                  />
                  全选当前筛选结果（{total}）
                </button>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full min-w-[1000px]">
                <thead>
                  <tr className="bg-background text-left sticky top-0 z-10 border-b border-border shadow-sm">
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === customers.length && customers.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(new Set(customers.map((c) => c.id)));
                          } else {
                            setSelectedIds(new Set());
                          }
                        }}
                        className="rounded"
                      />
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      公司名称
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      法人
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      有效电话
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      更多电话
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      邮箱
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      官网
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      阶段
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                      行业
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground text-right">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((cust) => (
                    <tr
                      key={cust.id}
                      className="border-t border-border hover:bg-accent/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(cust.id)}
                          onChange={(e) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(cust.id);
                              else next.delete(cust.id);
                              return next;
                            });
                          }}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Building2 className="size-4 text-primary" />
                          </div>
                          <span className="font-medium text-foreground truncate max-w-[180px]">
                            {cust.company}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {(() => {
                          const m = cust.notes?.match(/[【\[]法人[】\]]\s*(.+?)(?:\n|$)/) || cust.notes?.match(/法人[：:]\s*(.+?)(?:\n|$)/);
                          return m ? m[1].trim() : '-';
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {cust.contactInfo && cust.contactInfo !== '未提供' ? cust.contactInfo : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {(() => {
                          const m = cust.notes?.match(/[【\[]更多电话[】\]]\s*(.+?)(?:\n|$)/) || cust.notes?.match(/更多电话[：:]\s*(.+?)(?:\n|$)/);
                          return m ? m[1].trim().slice(0, 30) : '-';
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {(() => {
                          const m = cust.notes?.match(/[【\[]邮箱[】\]]\s*(.+?)(?:\n|$)/) || cust.notes?.match(/邮箱[：:]\s*(.+?)(?:\n|$)/);
                          return m ? m[1].trim().slice(0, 30) : '-';
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {(() => {
                          const m = cust.notes?.match(/[【\[]官网[】\]]\s*(.+?)(?:\n|$)/) || cust.notes?.match(/官网[：:]\s*(.+?)(?:\n|$)/);
                          return m ? m[1].trim().slice(0, 25) : '-';
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={STAGE_CLASSES[cust.stage]}>
                          {STAGE_LABELS[cust.stage]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {cust.industry || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openCustomerDetail(cust)}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(cust)}
                          >
                            <Edit3 className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(cust)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border flex-shrink-0 bg-background">
              {/* 左侧：每页数量 + 总数 */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>共 <span className="font-semibold text-foreground">{total.toLocaleString()}</span> 条</span>
                <div className="flex items-center gap-1.5">
                  <span>每页</span>
                  <select
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                    className="h-7 px-2 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>{size} 条</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 中间：分页按钮 */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => { setPage(1); setSelectedIds(new Set()); }}
                  className="h-8 px-2 text-xs"
                >
                  首页
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => { setPage((p) => Math.max(1, p - 1)); setSelectedIds(new Set()); }}
                  className="h-8 px-2"
                >
                  <ChevronLeft className="size-4" />
                </Button>

                {/* 页码 */}
                <div className="hidden sm:flex items-center gap-0.5">
                  {(() => {
                    const pages: number[] = [];
                    const maxVisible = 5;
                    let start = Math.max(1, page - Math.floor(maxVisible / 2));
                    let end = Math.min(totalPages, start + maxVisible - 1);
                    if (end - start + 1 < maxVisible) {
                      start = Math.max(1, end - maxVisible + 1);
                    }
                    for (let i = start; i <= end; i++) pages.push(i);
                    return pages.map((p) => (
                      <Button
                        key={p}
                        variant={p === page ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => { setPage(p); setSelectedIds(new Set()); }}
                        className="h-8 w-8 p-0 text-xs"
                      >
                        {p}
                      </Button>
                    ));
                  })()}
                </div>

                <span className="text-xs text-muted-foreground px-1 sm:hidden">
                  {page}/{totalPages}
                </span>

                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); setSelectedIds(new Set()); }}
                  className="h-8 px-2"
                >
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => { setPage(totalPages); setSelectedIds(new Set()); }}
                  className="h-8 px-2 text-xs"
                >
                  末页
                </Button>
              </div>

              {/* 右侧：跳转 + 页码信息 */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="hidden sm:inline">第 {page}/{totalPages} 页</span>
                <div className="flex items-center gap-1">
                  <span>跳至</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={jumpPage}
                    onChange={(e) => setJumpPage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleJumpPage(); }}
                    className="h-7 w-14 px-2 text-xs rounded border border-border bg-background text-center focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder={String(page)}
                  />
                  <span>页</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleJumpPage}
                    className="h-7 px-2 text-xs"
                  >
                    跳转
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Customer Detail Drawer */}
      {detailOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDetailOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-[80%] min-w-[800px] bg-background shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <h2 className="text-lg font-semibold text-foreground">客户详情</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDetailOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Left: Info Panel */}
              <div className="w-1/4 border-r border-border overflow-hidden">
                <CustomerInfoPanel
                  customer={selectedCustomer}
                  onEdit={() => openEditDialog(selectedCustomer)}
                />
              </div>

              {/* Middle: Timeline */}
              <div className="w-1/2 overflow-hidden">
                <FollowUpTimeline
                  followUps={followUps}
                  onAddFollowUp={handleAddFollowUp}
                  onDeleteFollowUp={async (id) => {
                    try {
                      await crmApi.deleteFollowUp(selectedCustomer!.id, id);
                      setFollowUps((prev) => prev.filter((f) => f.id !== id));
                    } catch {
                      alert('删除跟进记录失败，请重试');
                    }
                  }}
                  onAnalyze={handleAnalyzeCustomer}
                  analyzing={analyzingCustomer}
                  loading={followUpsLoading}
                />
              </div>

              {/* Right: AI Analysis */}
              <div className="w-1/4 p-4 overflow-hidden">
                <AiAnalysisPanel
                  analysis={selectedCustomer.aiAnalysis}
                  hasFollowUps={followUps.length > 0}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Customer Dialog */}
      <CustomerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        customer={formMode === 'edit' ? selectedCustomer : null}
        onSubmit={handleFormSubmit}
        loading={formLoading}
      />

      {/* Follow-up Form Dialog */}
      <FollowUpFormDialog
        open={followUpFormOpen}
        onOpenChange={setFollowUpFormOpen}
        onSubmit={handleFollowUpSubmit}
        loading={followUpFormLoading}
      />

      {/* Delete Confirm Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除客户</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除客户「{customerToDelete?.company}」吗？
              该客户的所有跟进记录也将被一并删除，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 批量导入对话框 */}
      {importOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !importLoading && setImportOpen(false)}>
          <div
            className="bg-card rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">批量导入客户</h2>
              <button onClick={() => !importLoading && setImportOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5">
              {!importPreview && !importLoading && (
                <div className="text-center py-12">
                  <Upload className="size-12 text-muted-foreground/40 mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">上传Excel文件（.xlsx/.xls），支持智能识别列名</p>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleImportFileSelect}
                    className="hidden"
                    id="crm-import-file"
                  />
                  <label htmlFor="crm-import-file">
                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md cursor-pointer hover:bg-primary/90 text-sm font-medium">
                      <Upload className="size-4" />
                      选择文件
                    </span>
                  </label>
                  <p className="text-xs text-muted-foreground mt-4">
                    建议先<a href="/api/customers/import/template" className="text-primary hover:underline" download>下载模板</a>，按模板填写后导入
                  </p>
                </div>
              )}

              {importLoading && !importPreview && (
                <div className="text-center py-12">
                  <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">正在解析文件...</p>
                </div>
              )}

              {importPreview && !importResult && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">
                      共识别到 <span className="font-semibold text-foreground">{editableRows.length}</span> 条数据，可直接编辑缺失字段
                    </p>
                    <div className="flex items-center gap-2">
                      {selectedPreviewRows.size > 0 && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (!window.confirm(`确定删除选中的 ${selectedPreviewRows.size} 条数据吗？`)) return;
                            setEditableRows((prev) => prev.filter((_, idx) => !selectedPreviewRows.has(idx)));
                            setSelectedPreviewRows(new Set());
                          }}
                        >
                          <Trash2 className="size-3.5 mr-1" />
                          删除选中({selectedPreviewRows.size})
                        </Button>
                      )}
                      <span className="text-xs text-muted-foreground">文件：{importFile?.name}</span>
                    </div>
                  </div>
                  <div className="border border-border rounded-lg overflow-auto max-h-[50vh]">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="px-2 py-2 w-8">
                            <input
                              type="checkbox"
                              checked={selectedPreviewRows.size === editableRows.length && editableRows.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPreviewRows(new Set(editableRows.map((_, i) => i)));
                                } else {
                                  setSelectedPreviewRows(new Set());
                                }
                              }}
                              className="rounded"
                            />
                          </th>
                          {['公司名称', '法人', '有效电话', '更多电话', '邮箱', '官网', '行业', '备注'].map((field) => {
                            const col = Object.entries(importPreview.fieldMapping).find(([, f]) => f === field)?.[0];
                            return (
                              <th key={field} className="px-3 py-2 text-left font-medium text-foreground border-b border-border whitespace-nowrap">
                                {field}
                                {!col && <span className="text-red-400 ml-1">*</span>}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {editableRows.map((row, idx) => (
                          <tr key={idx} className="border-b border-border/50 hover:bg-accent/30">
                            <td className="px-2 py-1.5">
                              <input
                                type="checkbox"
                                checked={selectedPreviewRows.has(idx)}
                                onChange={(e) => {
                                  setSelectedPreviewRows((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(idx);
                                    else next.delete(idx);
                                    return next;
                                  });
                                }}
                                className="rounded"
                              />
                            </td>
                            {['company', 'legalRep', 'phone', 'morePhone', 'email', 'website', 'industry', 'notes'].map((field) => {
                              const col = Object.entries(importPreview.fieldMapping).find(([, f]) => f === field)?.[0];
                              const value = col ? row[col] : (row[field] || '');
                              return (
                                <td key={field} className="px-2 py-1.5">
                                  <input
                                    type="text"
                                    value={value || ''}
                                    onChange={(e) => handleImportCellChange(idx, col || field, e.target.value)}
                                    className={[
                                      'w-full px-2 py-1 text-sm rounded border bg-transparent focus:outline-none focus:ring-1 focus:ring-primary',
                                      !value ? 'border-red-200 bg-red-50/50 placeholder:text-red-300' : 'border-transparent hover:border-border',
                                    ].join(' ')}
                                    placeholder={!value ? '缺失' : ''}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">* 标红字段为未识别列，可手动补充</p>
                </div>
              )}

              {importResult && (
                <div className="text-center py-12">
                  <div className="size-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <Check className="size-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">导入完成</h3>
                  <div className="flex justify-center gap-8 text-sm">
                    <div><span className="text-2xl font-bold text-green-600">{importResult.success}</span><p className="text-muted-foreground">成功导入</p></div>
                    <div><span className="text-2xl font-bold text-amber-600">{importResult.duplicates}</span><p className="text-muted-foreground">重复跳过</p></div>
                    <div><span className="text-2xl font-bold text-red-500">{importResult.failed}</span><p className="text-muted-foreground">导入失败</p></div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
              {importResult ? (
                <Button onClick={() => { setImportOpen(false); setImportPreview(null); setImportResult(null); }}>
                  完成
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => !importLoading && setImportOpen(false)} disabled={importLoading}>
                    取消
                  </Button>
                  {importPreview && (
                    <Button onClick={handleConfirmImport} disabled={importLoading || editableRows.length === 0}>
                      {importLoading ? '导入中...' : `确认导入(${editableRows.length}条)`}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrmPage;
