import { useState, useEffect, useCallback } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  Brain,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Filter,
  User,
  Briefcase,
  Target,
  Settings,
  Sparkles,
  MessageSquare,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import { Badge } from '@client/src/components/ui/badge';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  getMemories,
  createMemory,
  updateMemory,
  deleteMemory,
} from '@client/src/api/memory';
import type { Memory, MemoryType, MemorySource } from '@shared/api.interface';
import { showConfirm } from '@lark-apaas/client-toolkit';

const TYPE_CONFIGS: Array<{
  type: MemoryType;
  label: string;
  icon: typeof User;
  color: string;
  bgColor: string;
}> = [
  { type: 'PROFILE', label: '个人档案', icon: User, color: 'text-primary', bgColor: 'bg-primary/10' },
  { type: 'WORK_STYLE', label: '工作风格', icon: Briefcase, color: 'text-emerald-600', bgColor: 'bg-emerald-500/10' },
  { type: 'SALES_STYLE', label: '销售风格', icon: Target, color: 'text-amber-600', bgColor: 'bg-amber-500/10' },
  { type: 'PREFERENCE', label: '偏好设置', icon: Settings, color: 'text-violet-600', bgColor: 'bg-violet-500/10' },
];

const getTypeConfig = (type: MemoryType) => TYPE_CONFIGS.find((t) => t.type === type) ?? TYPE_CONFIGS[0];

const MemoryPage = () => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<MemoryType | 'ALL'>('ALL');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Memory | null>(null);
  const [newType, setNewType] = useState<MemoryType>('PROFILE');
  const [newContent, setNewContent] = useState('');
  const [editContent, setEditContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadMemories = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getMemories({
        page: 1,
        pageSize: 100,
        type: filterType === 'ALL' ? undefined : filterType,
      });
      setMemories(result.items);
    } catch (error) {
      logger.error('加载记忆列表失败', error);
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  const handleCreate = async () => {
    if (!newContent.trim()) return;
    setSubmitting(true);
    try {
      await createMemory({ type: newType, content: newContent.trim() });
      setNewContent('');
      setCreateDialogOpen(false);
      loadMemories();
    } catch (error) {
      logger.error('创建记忆失败', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (item: Memory) => {
    setEditItem(item);
    setEditContent(item.content);
  };

  const handleSaveEdit = async () => {
    if (!editItem || !editContent.trim()) return;
    setSubmitting(true);
    try {
      await updateMemory(editItem.id, { content: editContent.trim() });
      setEditItem(null);
      loadMemories();
    } catch (error) {
      logger.error('更新记忆失败', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!await showConfirm('确定要删除这条记忆吗？')) return;
    try {
      await deleteMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (error) {
      logger.error('删除记忆失败', error);
    }
  };

  const filteredCount = memories.length;

  return (
    <div className="space-y-6 max-w-[1000px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Brain className="size-6 text-primary" />
            AI 长期记忆
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            AI 会记住你的工作习惯、偏好和重要信息，让建议更贴合你的风格
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="size-4 mr-2" />
          新增记忆
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <TypeStatCard type="ALL" count={filteredCount} active={filterType === 'ALL'} onClick={() => setFilterType('ALL')} />
        {TYPE_CONFIGS.map((config) => {
          const count = memories.filter((m) => m.type === config.type).length;
          return (
            <TypeStatCard
              key={config.type}
              type={config.type}
              label={config.label}
              icon={config.icon}
              count={count}
              active={filterType === config.type}
              onClick={() => setFilterType(config.type)}
            />
          );
        })}
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            记忆列表
            <Badge variant="secondary">{filteredCount} 条</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="w-full h-20 rounded-lg" />
              ))}
            </div>
          ) : memories.length === 0 ? (
            <div className="text-center py-16">
              <Brain className="size-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground text-sm mb-4">
                {filterType === 'ALL' ? '暂无记忆记录' : '该类型暂无记忆'}
              </p>
              <Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="size-3.5 mr-1.5" />
                添加第一条记忆
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {memories.map((item) => (
                <MemoryCard
                  key={item.id}
                  item={item}
                  editing={editItem?.id === item.id}
                  editContent={editContent}
                  onEditChange={setEditContent}
                  onStartEdit={() => handleStartEdit(item)}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={() => setEditItem(null)}
                  onDelete={() => handleDelete(item.id)}
                  saving={submitting}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>新增记忆</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                记忆类型
              </label>
              <Select value={newType} onValueChange={(v) => setNewType(v as MemoryType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_CONFIGS.map((config) => (
                    <SelectItem key={config.type} value={config.type}>
                      <div className="flex items-center gap-2">
                        <config.icon className="size-4" />
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                记忆内容
              </label>
              <Textarea
                value={newContent}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewContent(e.target.value)}
                placeholder="例如：跟客户聊天不要太正式，用轻松的语气..."
                className="min-h-[120px] resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={submitting || !newContent.trim()}>
              <Plus className="size-4 mr-2" />
              添加记忆
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface TypeStatCardProps {
  type: MemoryType | 'ALL';
  label?: string;
  icon?: typeof User;
  count: number;
  active: boolean;
  onClick: () => void;
}

function TypeStatCard({ type, label, icon: Icon, count, active, onClick }: TypeStatCardProps) {
  const displayLabel = label ?? '全部';
  const DisplayIcon = Icon ?? Brain;

  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-lg border text-left transition-all ${
        active
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border bg-card hover:border-primary/30'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <DisplayIcon className={`size-4 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
        <span className="text-sm font-medium text-foreground">{displayLabel}</span>
      </div>
      <div className="text-2xl font-bold text-foreground tabular-nums">{count}</div>
    </button>
  );
}

interface MemoryCardProps {
  item: Memory;
  editing: boolean;
  editContent: string;
  onEditChange: (value: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  saving: boolean;
}

function MemoryCard({
  item,
  editing,
  editContent,
  onEditChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  saving,
}: MemoryCardProps) {
  const config = getTypeConfig(item.type);
  const Icon = config.icon;

  return (
    <div
      className={`p-4 rounded-lg border transition-colors ${
        item.source === 'AI_EXTRACTED'
          ? 'border-amber-200 bg-amber-50/30'
          : 'border-border bg-card'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color} ${config.bgColor}`}>
              <Icon className="size-3" />
              {config.label}
            </span>
            {item.source === 'AI_EXTRACTED' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-amber-700 bg-amber-100">
                <Sparkles className="size-3" />
                AI 提取
              </span>
            )}
            {item.source === 'USER_EXPLICIT' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-blue-700 bg-blue-100">
                <MessageSquare className="size-3" />
                主动设置
              </span>
            )}
          </div>
          {editing ? (
            <div className="space-y-2">
              <Textarea
                value={editContent}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onEditChange(e.target.value)}
                className="min-h-[80px] resize-none text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={onSaveEdit} disabled={saving || !editContent.trim()}>
                  <Save className="size-3.5 mr-1" />
                  保存
                </Button>
                <Button size="sm" variant="outline" onClick={onCancelEdit}>
                  <X className="size-3.5 mr-1" />
                  取消
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
              {item.content}
            </p>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="size-8" onClick={onStartEdit}>
              <Edit3 className="size-4 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" onClick={onDelete}>
              <Trash2 className="size-4 text-red-500/70" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MemoryPage;
