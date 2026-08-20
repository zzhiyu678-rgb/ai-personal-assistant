import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  ChevronLeft,
  ChevronRight,
  Save,
  History,
  Calendar,
  CheckCircle2,
  Plus,
  Check,
  Loader2,
  Trash2,
  CheckSquare,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Textarea } from '@client/src/components/ui/textarea';
import { Input } from '@client/src/components/ui/input';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { getDailyRecord, saveDailyRecord, getDailyRecordList } from '@client/src/api/daily-record';
import { getTasks, batchCreateTasks, updateTask, deleteTask } from '@client/src/api/task';
import type { DailyRecord, Task, TaskPriority, TaskStatus } from '@shared/api.interface';
import { useAutoSave } from '@client/src/hooks/useAutoSave';

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

const DRAFT_KEY_PREFIX = 'daily_record_draft_';

function formatDateLabel(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const w = WEEKDAYS[date.getDay()];
  return `${y}年${m}月${d}日 ${w}`;
}

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function SaveStatusIndicator({ status, lastSaved }: { status: string; lastSaved: Date | null }) {
  if (status === 'saving') {
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Save className="size-3 animate-pulse" />
        保存中...
      </span>
    );
  }
  if (status === 'saved' && lastSaved) {
    return (
      <span className="text-xs text-emerald-600 flex items-center gap-1">
        <CheckCircle2 className="size-3" />
        已保存 {lastSaved.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
      </span>
    );
  }
  if (status === 'error') {
    return <span className="text-xs text-red-500">保存失败，请重试</span>;
  }
  return null;
}

const priorityLabel: Record<TaskPriority, string> = {
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
};

const priorityClass: Record<TaskPriority, string> = {
  HIGH: 'bg-red-50 text-red-600 border-red-100',
  MEDIUM: 'bg-amber-50 text-amber-600 border-amber-100',
  LOW: 'bg-green-50 text-green-600 border-green-100',
};

function TaskSection({ dateStr }: { dateStr: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('MEDIUM');
  const [showAddInput, setShowAddInput] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getTasks({ dueDate: dateStr, pageSize: 50 });
      setTasks(result.items || []);
    } catch (e) {
      logger.error('加载任务失败', e);
    } finally {
      setLoading(false);
    }
  }, [dateStr]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleToggleTask = useCallback(async (task: Task) => {
    const newStatus: TaskStatus = task.status === 'DONE' ? 'TODO' : 'DONE';
    setUpdatingIds((prev) => new Set(prev).add(task.id));
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
    try {
      const updated = await updateTask(task.id, { status: newStatus });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    } catch (err) {
      logger.error('更新任务状态失败', err);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  }, []);

  const handleAddTask = useCallback(async () => {
    const title = newTaskTitle.trim();
    if (!title) return;
    setAddingTask(true);
    try {
      const result = await batchCreateTasks({
        tasks: [{ title, priority: newTaskPriority, dueDate: dateStr }],
      });
      if (result.items && result.items.length > 0) {
        // 创建后重新加载获取完整任务数据
        await loadTasks();
      }
      setNewTaskTitle('');
      setNewTaskPriority('MEDIUM');
      setShowAddInput(false);
    } catch (err) {
      logger.error('添加任务失败', err);
      alert('添加任务失败，请重试');
    } finally {
      setAddingTask(false);
    }
  }, [newTaskTitle, newTaskPriority, dateStr]);

  const handleDeleteTask = useCallback(async (task: Task) => {
    if (!window.confirm('确定删除这个任务吗？')) return;
    setDeletingIds((prev) => new Set(prev).add(task.id));
    try {
      await deleteTask(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } catch (err) {
      logger.error('删除任务失败', err);
      alert('删除失败，请稍后重试');
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  }, []);

  const handleChangePriority = useCallback(async (task: Task, priority: TaskPriority) => {
    if (task.priority === priority) return;
    setUpdatingIds((prev) => new Set(prev).add(task.id));
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, priority } : t)));
    try {
      await updateTask(task.id, { priority });
    } catch (err) {
      logger.error('更新优先级失败', err);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
      alert('优先级更新失败，请重试');
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  }, []);

  const handleStartEdit = useCallback((task: Task) => {
    setEditingId(task.id);
    setEditingTitle(task.title);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return;
    const title = editingTitle.trim();
    if (!title) {
      setEditingId(null);
      return;
    }
    const task = tasks.find((t) => t.id === editingId);
    if (!task || task.title === title) {
      setEditingId(null);
      return;
    }
    setUpdatingIds((prev) => new Set(prev).add(editingId));
    setTasks((prev) => prev.map((t) => (t.id === editingId ? { ...t, title } : t)));
    try {
      await updateTask(editingId, { title });
    } catch (err) {
      logger.error('更新任务标题失败', err);
      setTasks((prev) => prev.map((t) => (t.id === editingId ? task : t)));
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(editingId);
        return next;
      });
      setEditingId(null);
    }
  }, [editingId, editingTitle, tasks]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        if (editingId) {
          void handleSaveEdit();
        } else {
          void handleAddTask();
        }
      } else if (e.key === 'Escape') {
        if (editingId) {
          setEditingId(null);
        } else {
          setShowAddInput(false);
          setNewTaskTitle('');
        }
      }
    },
    [editingId, handleAddTask, handleSaveEdit],
  );

  const priorityOrder: Record<TaskPriority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'DONE' ? 1 : -1;
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const doneCount = tasks.filter((t) => t.status === 'DONE').length;

  return (
    <Card className="shadow-sm border border-border">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <CheckSquare className="size-4 text-primary" />
          今日任务
          {tasks.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              ({doneCount}/{tasks.length} 已完成)
            </span>
          )}
        </CardTitle>
        {!showAddInput && (
          <Button variant="outline" size="sm" onClick={() => setShowAddInput(true)}>
            <Plus className="size-4 mr-1" />
            添加任务
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {showAddInput && (
          <div className="flex flex-col gap-2 p-3 bg-accent/30 rounded-lg">
            <div className="flex gap-2">
              <Input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入任务标题，回车快速添加..."
                autoFocus
              />
              <Button variant="default" size="sm" onClick={handleAddTask} disabled={addingTask || !newTaskTitle.trim()}>
                {addingTask ? <Loader2 className="size-4 animate-spin" /> : '添加'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowAddInput(false); setNewTaskTitle(''); }}>
                取消
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">优先级：</span>
              {(['HIGH', 'MEDIUM', 'LOW'] as TaskPriority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setNewTaskPriority(p)}
                  className={[
                    'text-xs px-2.5 py-1 rounded-full border font-medium transition-colors',
                    newTaskPriority === p ? priorityClass[p] : 'border-border text-muted-foreground hover:border-primary/30',
                  ].join(' ')}
                >
                  {priorityLabel[p]}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="w-full h-10" />
            <Skeleton className="w-full h-10" />
            <Skeleton className="w-3/4 h-10" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-6">
            <CheckSquare className="size-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">暂无任务，点击上方添加</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {sortedTasks.map((task) => {
              const isDone = task.status === 'DONE';
              const isUpdating = updatingIds.has(task.id);
              const isDeleting = deletingIds.has(task.id);
              const isEditing = editingId === task.id;
              return (
                <li
                  key={task.id}
                  className={[
                    'flex items-center gap-3 p-2.5 rounded-lg transition-colors group',
                    isDone ? 'opacity-60' : 'hover:bg-accent/50',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleTask(task)}
                    disabled={isUpdating}
                    className={[
                      'size-5 rounded border flex items-center justify-center shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                      isDone ? 'bg-green-500 border-green-500 text-white' : 'border-border hover:border-primary',
                    ].join(' ')}
                    aria-label={isDone ? '标记为未完成' : '标记为完成'}
                  >
                    {isDone && <Check className="size-3.5" />}
                  </button>

                  {isEditing ? (
                    <Input
                      ref={editInputRef}
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={handleSaveEdit}
                      className="flex-1 h-8 text-sm"
                    />
                  ) : (
                    <span
                      onClick={() => handleStartEdit(task)}
                      className={[
                        'flex-1 text-sm cursor-pointer truncate',
                        isDone ? 'text-muted-foreground line-through' : 'text-foreground',
                      ].join(' ')}
                      title="点击编辑任务名称"
                    >
                      {task.title}
                    </span>
                  )}

                  <select
                    value={task.priority}
                    onChange={(e) => handleChangePriority(task, e.target.value as TaskPriority)}
                    disabled={isUpdating || isEditing}
                    className={[
                      'text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 cursor-pointer bg-transparent focus:outline-none',
                      priorityClass[task.priority],
                    ].join(' ')}
                    aria-label="任务优先级"
                  >
                    <option value="HIGH">高</option>
                    <option value="MEDIUM">中</option>
                    <option value="LOW">低</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => handleDeleteTask(task)}
                    disabled={isDeleting}
                    className="size-7 rounded flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity focus-visible:opacity-100"
                    aria-label="删除任务"
                  >
                    {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function HistoryView({ currentDate, onSelect }: { currentDate: string; onSelect: (d: string) => void }) {
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const list = await getDailyRecordList({ page: 1, pageSize: 60 });
        if (!cancelled) setRecords(list.items || []);
      } catch (e) {
        logger.error('加载历史记录失败', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-6 space-y-3">
          <Skeleton className="w-full h-12" />
          <Skeleton className="w-full h-12" />
          <Skeleton className="w-3/4 h-12" />
        </CardContent>
      </Card>
    );
  }

  if (records.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-12 text-center">
          <Calendar className="size-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">暂无历史记录</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="space-y-1">
          {records.map((rec) => (
            <button
              key={rec.id}
              onClick={() => onSelect(rec.date)}
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center justify-between ${
                rec.date === currentDate
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-accent/50 text-foreground'
              }`}
            >
              <div>
                <div className="font-medium text-sm">{rec.date}</div>
                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {rec.plan?.slice(0, 60) || '无内容'}
                </div>
              </div>
              {rec.date === currentDate && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">当前</span>
              )}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const WorkTodayPage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const dateStr = toDateStr(currentDate);
  const draftKey = `${DRAFT_KEY_PREFIX}${dateStr}`;

  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<DailyRecord | null>(null);
  const [inputContent, setInputContent] = useState('');
  const [viewMode, setViewMode] = useState<'input' | 'history'>('input');
  const [manualSaving, setManualSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { saveStatus, lastSaved, forceSave } = useAutoSave({
    value: inputContent,
    storageKey: draftKey,
    delay: 5000, // 5秒自动保存
    onSave: async (content) => {
      if (!content.trim()) return;
      await saveDailyRecord(dateStr, { completed: content });
    },
  });

  const loadRecord = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDailyRecord(dateStr);
      setRecord(data);
      if (data && data.completed) {
        setInputContent(data.completed);
      } else {
        const draft = localStorage.getItem(draftKey);
        setInputContent(draft || '');
      }
    } catch (error) {
      logger.error('加载工作记录失败', error);
    } finally {
      setLoading(false);
    }
  }, [dateStr, draftKey]);

  useEffect(() => {
    loadRecord();
  }, [loadRecord]);

  const handleSave = async () => {
    if (!inputContent.trim()) return;
    setManualSaving(true);
    try {
      const saved = await saveDailyRecord(dateStr, { completed: inputContent });
      setRecord(saved);
      localStorage.removeItem(draftKey);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      logger.error('保存失败', error);
      alert('保存失败，请重试');
    } finally {
      setManualSaving(false);
    }
  };

  const goPrevDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const goNextDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const goToday = () => setCurrentDate(new Date());

  const today = isToday(currentDate);
  const hasContent = inputContent.trim().length > 0;

  return (
    <div className="space-y-6 max-w-[1000px] mx-auto pb-28">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="icon" onClick={goPrevDay} aria-label="前一天">
            <ChevronLeft className="size-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {formatDateLabel(currentDate)}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              记录今天的工作，之后AI会帮你整理成工作日报
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={goNextDay} aria-label="后一天">
            <ChevronRight className="size-5" />
          </Button>
          <input
            type="date"
            value={dateStr}
            onChange={(e) => {
              if (e.target.value) setCurrentDate(new Date(e.target.value + 'T00:00:00'));
            }}
            className="text-sm border border-input rounded-md px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label="选择日期"
          />
          {!today && (
            <Button variant="outline" size="sm" onClick={goToday}>
              今天
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'input' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('input')}
          >
            <Calendar className="size-4 mr-1.5" />
            今日记录
          </Button>
          <Button
            variant={viewMode === 'history' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('history')}
          >
            <History className="size-4 mr-1.5" />
            历史记录
          </Button>
        </div>
      </div>

      {viewMode === 'history' ? (
        <HistoryView
          currentDate={dateStr}
          onSelect={(d) => {
            setCurrentDate(new Date(d + 'T00:00:00'));
            setViewMode('input');
          }}
        />
      ) : (
        <>
          {/* 今日任务模块 - 与Dashboard共用同一套任务数据 */}
          <TaskSection dateStr={dateStr} />

          {/* 工作记录 - 始终显示输入框 */}
          <Card className="shadow-sm border border-border">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Calendar className="size-4 text-primary" />
                工作记录
              </CardTitle>
              <SaveStatusIndicator status={saveStatus} lastSaved={lastSaved} />
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={inputContent}
                placeholder={'今天完成了什么？\n遇到了什么问题？\n明天有什么想法？\n\n直接写下来，之后AI会帮你整理成工作日报。'}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInputContent(e.target.value)}
                className="min-h-[280px] resize-none text-base leading-relaxed"
              />
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    每5秒自动保存，也可以手动点击保存
                  </div>
                  <Button
                    onClick={handleSave}
                    disabled={manualSaving || !hasContent}
                  >
                    {saveSuccess ? (
                      <>
                        <CheckCircle2 className="size-4 mr-2" />
                        已保存
                      </>
                    ) : (
                      <>
                        <Save className="size-4 mr-2" />
                        {manualSaving ? '保存中...' : '保存'}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
        </>
      )}
    </div>
  );
};

export { WorkTodayPage };
export default WorkTodayPage;
