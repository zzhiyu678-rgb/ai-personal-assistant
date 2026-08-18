import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  Target,
  FileText,
  Bot,
  BookOpen,
  CalendarClock,
  Users,
  BarChart3,
  Sparkles,
  Plus,
  ChevronRight,
  Check,
  Loader2,
  Zap,
  Clock,
  TrendingUp,
  Flame,
  Sunrise,
  Sun,
  Moon,
  Trash2,
} from 'lucide-react';

import { Card, CardContent } from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';

import * as dashboardApi from '@client/src/api/dashboard';
import { deleteTask, updateTask } from '@client/src/api/task';
import type { Task, TaskPriority, TaskStatus } from '@shared/api.interface';

const quickActions = [
  { label: '目标管理', path: '/goals', icon: Target, desc: '年度/月度/周目标' },
  { label: '今日记录', path: '/work/today', icon: FileText, desc: '记录今日工作' },
  { label: '工作日报', path: '/report', icon: BookOpen, desc: 'AI生成日报' },
  { label: '客户管理', path: '/crm', icon: Users, desc: 'CRM客户跟进' },
  { label: '数据分析', path: '/analytics', icon: BarChart3, desc: '数据复盘' },
];

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

function formatDateChinese(dateStr: string): string {
  const d = new Date(dateStr);
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${weekdays[d.getDay()]}，${month}月${day}日`;
}

function RingProgress({ value, size = 80, stroke = 8 }: { value: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          className="stroke-muted"
          opacity="0.2"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          className="stroke-primary transition-all duration-500 ease-out"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-foreground tabular-nums">{value}%</span>
      </div>
    </div>
  );
}

// 模块级缓存：避免页面切换后重新加载
interface DashboardCache {
  data: DashboardTodayResponse | null;
  tasks: Task[];
  timestamp: number;
}
const dashboardCache: DashboardCache = {
  data: null,
  tasks: [],
  timestamp: 0,
};
const CACHE_TTL = 30 * 1000; // 30秒缓存

const DashboardPage = () => {
  const [coreLoading, setCoreLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [todayDate, setTodayDate] = useState('');
  const [completionRate, setCompletionRate] = useState(0);
  const [todayTaskCount, setTodayTaskCount] = useState(0);
  const [monthlyGoalProgress, setMonthlyGoalProgress] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('MEDIUM');
  const [showAddInput, setShowAddInput] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async (forceRefresh = false) => {
    // 检查缓存
    const now = Date.now();
    if (!forceRefresh && dashboardCache.data && now - dashboardCache.timestamp < CACHE_TTL) {
      const cached = dashboardCache;
      setTodayDate(cached.data.todayDate);
      setCompletionRate(cached.data.completionRate);
      setTodayTaskCount(cached.data.todayTaskCount);
      setMonthlyGoalProgress(cached.data.monthlyGoalProgress);
      setStreakDays(cached.data.streakDays);
      setTasks(cached.tasks);
      setCoreLoading(false);
      // 后台静默刷新
      void loadData(true);
      return;
    }

    setCoreLoading(true);
    setError(null);

    try {
      // 核心数据和任务并行加载
      const [data, taskList] = await Promise.all([
        dashboardApi.getDashboardToday(),
        dashboardApi.getTodayTasks(),
      ]);

      setTodayDate(data.todayDate);
      setCompletionRate(data.completionRate);
      setTodayTaskCount(data.todayTaskCount);
      setMonthlyGoalProgress(data.monthlyGoalProgress);
      setStreakDays(data.streakDays);
      setTasks(taskList);

      // 更新缓存
      dashboardCache.data = data;
      dashboardCache.tasks = taskList;
      dashboardCache.timestamp = now;
    } catch (err) {
      logger.error('加载仪表盘数据失败', err);
      setError('加载失败，请刷新重试');
    } finally {
      setCoreLoading(false);
    }

    // AI建议独立异步加载，不阻塞核心数据
    setAiLoading(true);
    try {
      const suggestion = await dashboardApi.getAiSuggestion();
      setAiSuggestion(suggestion);
    } catch {
      setAiSuggestion(null);
    } finally {
      setAiLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleToggleTask = useCallback(async (taskItem: Task) => {
    const newStatus: TaskStatus = taskItem.status === 'DONE' ? 'TODO' : 'DONE';
    setUpdatingIds((prev) => new Set(prev).add(taskItem.id));

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskItem.id ? { ...t, status: newStatus } : t)),
    );

    try {
      const updated = await dashboardApi.updateTaskStatus(taskItem.id, newStatus);
      setTasks((prev) => prev.map((t) => (t.id === taskItem.id ? updated : t)));
      dashboardCache.timestamp = 0; // 任务状态变化，失效缓存

      // Update today stats
      setTodayTaskCount((prevCount) => prevCount);
      const allTasks = tasks.map((t) => (t.id === taskItem.id ? updated : t));
      const doneCount = allTasks.filter((t) => t.status === 'DONE').length;
      const rate = allTasks.length > 0 ? Math.round((doneCount / allTasks.length) * 100) : 0;
      setCompletionRate(rate);
    } catch (err) {
      logger.error('更新任务状态失败', err);
      // Revert on error
      setTasks((prev) =>
        prev.map((t) => (t.id === taskItem.id ? taskItem : t)),
      );
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(taskItem.id);
        return next;
      });
    }
  }, [tasks]);

  const handleAddTask = useCallback(async () => {
    const title = newTaskTitle.trim();
    if (!title) return;
    setAddingTask(true);
    try {
      const created = await dashboardApi.createQuickTask(title, newTaskPriority);
      setTasks((prev) => [created, ...prev]);
      setNewTaskTitle('');
      setNewTaskPriority('MEDIUM');
      setShowAddInput(false);
      setTodayTaskCount((prev) => prev + 1);
      dashboardCache.timestamp = 0; // 新增任务，失效缓存
      // Recalculate completion rate
      const allTasks = [created, ...tasks];
      const doneCount = allTasks.filter((t) => t.status === 'DONE').length;
      const rate = allTasks.length > 0 ? Math.round((doneCount / allTasks.length) * 100) : 0;
      setCompletionRate(rate);
    } catch (err) {
      logger.error('添加任务失败', err);
      alert('添加任务失败，请重试');
    } finally {
      setAddingTask(false);
    }
  }, [newTaskTitle, newTaskPriority, tasks]);

  const handleDeleteTask = useCallback(async (taskItem: Task) => {
    if (!window.confirm('确定删除这个任务吗？')) return;
    setDeletingIds((prev) => new Set(prev).add(taskItem.id));
    try {
      await deleteTask(taskItem.id);
      setTasks((prev) => prev.filter((t) => t.id !== taskItem.id));
      setTodayTaskCount((prev) => Math.max(0, prev - 1));
      dashboardCache.timestamp = 0; // 删除任务，失效缓存
      const remaining = tasks.filter((t) => t.id !== taskItem.id);
      const doneCount = remaining.filter((t) => t.status === 'DONE').length;
      const rate = remaining.length > 0 ? Math.round((doneCount / remaining.length) * 100) : 0;
      setCompletionRate(rate);
    } catch (err) {
      logger.error('删除任务失败', err);
      alert('删除失败，请稍后重试');
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(taskItem.id);
        return next;
      });
    }
  }, [tasks]);

  const handleChangePriority = useCallback(async (taskItem: Task, priority: TaskPriority) => {
    if (taskItem.priority === priority) return;
    setUpdatingIds((prev) => new Set(prev).add(taskItem.id));
    // Optimistic update
    setTasks((prev) => prev.map((t) => (t.id === taskItem.id ? { ...t, priority } : t)));
    try {
      await updateTask(taskItem.id, { priority });
      dashboardCache.timestamp = 0; // 优先级变化，失效缓存
    } catch (err) {
      logger.error('更新任务优先级失败', err);
      setTasks((prev) => prev.map((t) => (t.id === taskItem.id ? taskItem : t)));
      alert('优先级更新失败，请重试');
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(taskItem.id);
        return next;
      });
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        void handleAddTask();
      }
    },
    [handleAddTask],
  );

  const dateDisplay = todayDate ? formatDateChinese(todayDate) : '';

  const greetingInfo = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 6) return { text: '凌晨好', icon: Moon, color: 'text-indigo-500' };
    if (hour < 12) return { text: '早上好', icon: Sunrise, color: 'text-amber-500' };
    if (hour < 14) return { text: '中午好', icon: Sun, color: 'text-amber-600' };
    if (hour < 18) return { text: '下午好', icon: Sun, color: 'text-orange-500' };
    return { text: '晚上好', icon: Moon, color: 'text-indigo-500' };
  }, []);

  const statusMessage = useMemo(() => {
    if (todayTaskCount === 0) return '今天还没有任务，先规划一下吧';
    if (completionRate === 100) return '太棒了，今日任务全部完成！🎉';
    if (completionRate >= 70) return '进度良好，继续保持！';
    if (completionRate >= 40) return '稳扎稳打，加油推进剩余任务';
    return '任务较多，建议优先处理高优先级';
  }, [todayTaskCount, completionRate]);

  const priorityOrder: Record<TaskPriority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      // 未完成优先
      if (a.status !== b.status) {
        return a.status === 'DONE' ? 1 : -1;
      }
      // 按优先级排序
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [tasks]);

  const statCards = [
    {
      label: '今日完成进度',
      value: `${completionRate}%`,
      icon: Zap,
      color: completionRate >= 70 ? 'text-emerald-600' : completionRate >= 40 ? 'text-amber-600' : 'text-red-500',
      bgColor: completionRate >= 70 ? 'bg-emerald-500/10' : completionRate >= 40 ? 'bg-amber-500/10' : 'bg-red-500/10',
    },
    {
      label: '今日待办任务',
      value: String(todayTaskCount),
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: '本月目标完成率',
      value: `${monthlyGoalProgress}%`,
      icon: TrendingUp,
      color: 'text-violet-600',
      bgColor: 'bg-violet-500/10',
    },
    {
      label: '连续工作天数',
      value: `${streakDays}天`,
      icon: Flame,
      color: 'text-orange-600',
      bgColor: 'bg-orange-500/10',
    },
  ];

  if (coreLoading && !dashboardCache.data) {
    return (
      <div className="space-y-6 max-w-[1400px] mx-auto p-6">
        {/* 顶部大卡片骨架 */}
        <div className="h-40 rounded-xl bg-muted/30 animate-pulse" />
        {/* 统计卡片骨架 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-muted/30 animate-pulse" />
          ))}
        </div>
        {/* 任务列表骨架 */}
        <div className="h-64 rounded-xl bg-muted/30 animate-pulse" />
        {/* 快捷入口骨架 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-muted/30 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 max-w-[1400px] mx-auto">
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground">{error}</p>
          <Button variant="default" size="sm" className="mt-4" onClick={loadData}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* 今日状态大卡片 */}
      <Card className="bg-gradient-to-br from-primary/15 via-primary/5 to-card border-primary/20 shadow-md overflow-hidden">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <greetingInfo.icon className={`size-6 ${greetingInfo.color}`} />
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  {greetingInfo.text}，欢迎回来
                </h1>
              </div>
              <p className="text-muted-foreground text-base">{dateDisplay}</p>
              <div className="mt-4 px-4 py-3 bg-white/60 backdrop-blur-sm rounded-lg border border-white/80 inline-block">
                <p className="text-foreground font-medium">{statusMessage}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button asChild size="lg">
                <Link to="/work/today">
                  <FileText className="size-4 mr-2" />
                  记录今日工作
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/assistant">
                  <Bot className="size-4 mr-2" />
                  找AI顾问聊聊
                </Link>
              </Button>
            </div>
          </div>

          {/* AI 一句话建议 */}
          {(aiSuggestion || aiLoading) && (
            <div className="mt-6 pt-6 border-t border-primary/20 flex items-start gap-3">
              <div className="flex aspect-square size-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 shrink-0 shadow-md">
                <Sparkles className="size-5 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">AI 今日提醒</h3>
                {aiLoading ? (
                  <div className="flex items-center gap-2 text-foreground/60">
                    <Loader2 className="size-4 animate-spin" />
                    <span className="text-sm">AI建议生成中...</span>
                  </div>
                ) : (
                  <p className="text-foreground/80 leading-relaxed">{aiSuggestion}</p>
                )}
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/work/today">
                  去处理
                  <ChevronRight className="size-4 ml-1" />
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 核心数据卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((item) => (
          <Card key={item.label} className="border border-border shadow-sm bg-card hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`size-10 rounded-lg ${item.bgColor} flex items-center justify-center`}>
                  <item.icon className={`size-5 ${item.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {item.value}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 今日任务列表 */}
        <Card className="lg:col-span-2 border border-border shadow-sm bg-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">今日任务</h3>
              {!showAddInput && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddInput(true)}
                >
                  <Plus className="size-4 mr-1" />
                  添加
                </Button>
              )}
            </div>

            {showAddInput && (
              <div className="flex flex-col gap-2 mb-4">
                <div className="flex gap-2">
                  <Input
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="输入任务标题..."
                    autoFocus
                  />
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleAddTask}
                    disabled={addingTask || !newTaskTitle.trim()}
                  >
                    {addingTask ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      '添加'
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAddInput(false);
                      setNewTaskTitle('');
                      setNewTaskPriority('MEDIUM');
                    }}
                  >
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
                        newTaskPriority === p
                          ? priorityClass[p]
                          : 'border-border text-muted-foreground hover:border-primary/30',
                      ].join(' ')}
                    >
                      {priorityLabel[p]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tasks.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground text-sm">
                  今天还没有任务，点击上方添加一个
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {sortedTasks.map((taskItem) => {
                  const isDone = taskItem.status === 'DONE';
                  const isUpdating = updatingIds.has(taskItem.id);
                  const isDeleting = deletingIds.has(taskItem.id);
                  return (
                    <li
                      key={taskItem.id}
                      className={[
                        'flex items-center gap-3 p-3 rounded-lg transition-colors group',
                        isDone ? 'opacity-60' : 'hover:bg-accent/50',
                      ].join(' ')}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleTask(taskItem)}
                        disabled={isUpdating}
                        className={[
                          'size-5 rounded border flex items-center justify-center shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                          isDone
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-border hover:border-primary',
                        ].join(' ')}
                        aria-label={isDone ? '标记为未完成' : '标记为完成'}
                      >
                        {isDone && <Check className="size-3.5" />}
                      </button>
                      <span
                        className={[
                          'flex-1 text-sm',
                          isDone
                            ? 'text-muted-foreground line-through'
                            : 'text-foreground',
                        ].join(' ')}
                      >
                        {taskItem.title}
                      </span>
                      <select
                        value={taskItem.priority}
                        onChange={(e) => handleChangePriority(taskItem, e.target.value as TaskPriority)}
                        disabled={isUpdating}
                        className={[
                          'text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 cursor-pointer bg-transparent focus:outline-none',
                          priorityClass[taskItem.priority],
                        ].join(' ')}
                        aria-label="任务优先级"
                      >
                        <option value="HIGH">高</option>
                        <option value="MEDIUM">中</option>
                        <option value="LOW">低</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(taskItem)}
                        disabled={isDeleting}
                        className="size-7 rounded flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity focus-visible:opacity-100"
                        aria-label="删除任务"
                      >
                        {isDeleting ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* 快捷功能入口 */}
        <Card className="border border-border shadow-sm bg-card">
          <CardContent className="p-6">
            <h3 className="font-semibold text-foreground mb-4">快捷入口</h3>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex flex-col items-center justify-center p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-accent/50 transition-colors text-center group"
                >
                  <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                    <item.icon className="size-5 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                  <span className="text-xs text-muted-foreground mt-0.5">{item.desc}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
