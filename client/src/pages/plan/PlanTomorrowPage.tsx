import { useState } from 'react';
import { toast } from 'sonner';
import {
  CalendarClock,
  Plus,
  Sparkles,
  Trash2,
  GripVertical,
  Loader2,
  Save,
  Wand2,
} from 'lucide-react';

import { Card, CardContent } from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Badge } from '@client/src/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  generateTomorrowPlan,
  batchCreateTasks,
} from '@client/src/api/task';

import type { TaskPriority, TomorrowPlanTask } from '@shared/api.interface';

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface PlanTask extends TomorrowPlanTask {
  id: string;
  isAiSuggested: boolean;
}

const priorityConfig: Record<TaskPriority, { label: string; borderColor: string; bgColor: string; textColor: string }> = {
  HIGH: {
    label: '高',
    borderColor: 'border-l-[hsl(0_72%_50%)]',
    bgColor: 'bg-[hsl(0_72%_95%)] text-[hsl(0_72%_40%)]',
    textColor: 'text-[hsl(0_72%_50%)]',
  },
  MEDIUM: {
    label: '中',
    borderColor: 'border-l-[hsl(38_90%_45%)]',
    bgColor: 'bg-[hsl(38_90%_95%)] text-[hsl(38_90%_40%)]',
    textColor: 'text-[hsl(38_90%_45%)]',
  },
  LOW: {
    label: '低',
    borderColor: 'border-l-[hsl(152_60%_40%)]',
    bgColor: 'bg-[hsl(152_60%_95%)] text-[hsl(152_60%_35%)]',
    textColor: 'text-[hsl(152_60%_40%)]',
  },
};

const PlanTomorrowPage = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  const dueDate = formatDate(tomorrow);

  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('MEDIUM');
  const [newEstimatedTime, setNewEstimatedTime] = useState<string>('30');

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateTomorrowPlan();
      const planTasks: PlanTask[] = result.tasks.map(
        (t: TomorrowPlanTask, i: number) => ({
          ...t,
          id: `ai-${Date.now()}-${i}`,
          isAiSuggested: true,
        }),
      );
      setTasks(planTasks);
      toast.success(`已生成 ${planTasks.length} 条明日计划`);
    } catch {
      toast.error('生成失败，AI服务暂时不可用，请稍后重试');
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    await handleGenerate();
  };

  const handleSave = async () => {
    if (tasks.length === 0) {
      toast.error('请先添加任务');
      return;
    }
    setSaving(true);
    try {
      await batchCreateTasks({
        tasks: tasks.map((t: PlanTask) => ({
          title: t.title,
          priority: t.priority,
          estimatedTime: t.estimatedTime,
          dueDate,
          isAiSuggested: t.isAiSuggested,
        })),
      });
      toast.success('计划已保存');
    } catch {
      toast.error('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTask = () => {
    if (!newTitle.trim()) {
      toast.error('请输入任务标题');
      return;
    }
    const newTask: PlanTask = {
      id: `manual-${Date.now()}`,
      title: newTitle.trim(),
      priority: newPriority,
      estimatedTime: Number(newEstimatedTime) || 0,
      reason: '',
      isAiSuggested: false,
    };
    setTasks([...tasks, newTask]);
    setNewTitle('');
    setNewEstimatedTime('30');
    setShowAddForm(false);
  };

  const handleDelete = (id: string) => {
    setTasks(tasks.filter((t: PlanTask) => t.id !== id));
  };

  const moveTask = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= tasks.length) return;
    const newTasks = [...tasks];
    [newTasks[index], newTasks[newIndex]] = [newTasks[newIndex], newTasks[index]];
    setTasks(newTasks);
  };

  const hasTasks = tasks.length > 0;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* 顶部操作区 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">明日计划</h1>
          <p className="text-muted-foreground mt-1">{dateStr}</p>
        </div>
        <div className="flex items-center gap-2">
          {hasTasks && (
            <>
              <Button variant="outline" onClick={handleRegenerate} disabled={generating}>
                {generating ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="size-4 mr-2" />
                )}
                重新生成
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <Save className="size-4 mr-2" />
                )}
                保存计划
              </Button>
            </>
          )}
          {!hasTasks && (
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="size-4 mr-2" />
              )}
              AI生成明日计划
            </Button>
          )}
        </div>
      </div>

      {/* 任务列表 */}
      {generating ? (
        <PlanSkeleton />
      ) : hasTasks ? (
        <div className="space-y-3">
          {tasks.map((task: PlanTask, index: number) => {
            const cfg = priorityConfig[task.priority];
            return (
              <Card
                key={task.id}
                className={`bg-card border border-border shadow-sm border-l-4 ${cfg.borderColor}`}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="flex flex-col gap-0.5 flex-shrink-0 pt-0.5">
                    <button
                      type="button"
                      onClick={() => moveTask(index, 'up')}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      disabled={index === 0}
                      aria-label="上移"
                    >
                      <GripVertical className="size-4" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={cfg.bgColor} variant="outline">
                        {cfg.label}优先级
                      </Badge>
                      {task.isAiSuggested && (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                          <Sparkles className="size-3 mr-1" />
                          AI建议
                        </Badge>
                      )}
                      {task.estimatedTime > 0 && (
                        <span className="text-xs text-muted-foreground">
                          预计 {task.estimatedTime} 分钟
                        </span>
                      )}
                    </div>
                    <h4 className="font-medium text-foreground mt-2 break-words">
                      {task.title}
                    </h4>
                    {task.reason && task.isAiSuggested && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {task.reason}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(task.id)}
                    className="text-muted-foreground hover:text-destructive flex-shrink-0"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border border-border shadow-sm">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center">
            <div className="aspect-square size-16 rounded-full bg-accent flex items-center justify-center mb-4">
              <CalendarClock className="size-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">暂无明日计划</h3>
            <p className="text-muted-foreground mt-2 max-w-md">
              点击「AI生成明日计划」，AI将结合今日工作记录、目标进度和历史数据，为你生成一份优先级清晰的明日任务清单
            </p>
            <Button className="mt-6" onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="size-4 mr-2" />
              )}
              AI生成明日计划
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 手动添加区 */}
      {hasTasks && (
        <div>
          {showAddForm ? (
            <Card className="border border-border shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    任务标题
                  </label>
                  <Input
                    placeholder="输入任务内容"
                    value={newTitle}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewTitle(e.target.value)
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      优先级
                    </label>
                    <Select
                      value={newPriority}
                      onValueChange={(val: string) =>
                        setNewPriority(val as TaskPriority)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HIGH">高</SelectItem>
                        <SelectItem value="MEDIUM">中</SelectItem>
                        <SelectItem value="LOW">低</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      预计时间（分钟）
                    </label>
                    <Input
                      type="number"
                      value={newEstimatedTime}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setNewEstimatedTime(e.target.value)
                      }
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={() => setShowAddForm(false)}>
                    取消
                  </Button>
                  <Button onClick={handleAddTask}>添加</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Button
              variant="outline"
              className="w-full border-dashed"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="size-4 mr-2" />
              添加任务
            </Button>
          )}
        </div>
      )}

      {/* 底部说明 */}
      <p className="text-xs text-muted-foreground text-center">
        AI基于今日记录、目标进度和历史数据生成
      </p>
    </div>
  );
};

const PlanSkeleton = () => {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i: number) => (
        <Card
          key={i}
          className="bg-card border border-border shadow-sm animate-pulse"
        >
          <CardContent className="p-4">
            <div className="h-5 w-20 bg-accent rounded mb-3" />
            <div className="h-4 w-3/4 bg-accent rounded mb-2" />
            <div className="h-3 w-1/2 bg-accent/50 rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default PlanTomorrowPage;
