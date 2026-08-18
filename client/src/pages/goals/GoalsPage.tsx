import { useCallback, useEffect, useState } from 'react';
import { Plus, Target } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { Button } from '@client/src/components/ui/button';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@client/src/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Card, CardContent } from '@client/src/components/ui/card';

import {
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  decomposeGoal,
  confirmDecompose,
} from '@client/src/api/goal';
import type {
  Goal,
  GoalType,
  GoalStatus,
  GoalWithChildren,
  CreateGoalRequest,
  UpdateGoalRequest,
  DecomposedGoal,
} from '@shared/api.interface';
import GoalCard from './GoalCard';
import GoalFormDialog from './GoalFormDialog';
import GoalDetailSheet from './GoalDetailSheet';
import { showConfirm } from '@lark-apaas/client-toolkit';

const GOAL_TYPES: { value: GoalType; label: string }[] = [
  { value: 'YEAR', label: '年度' },
  { value: 'MONTH', label: '月度' },
  { value: 'WEEK', label: '周' },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: 'NOT_STARTED', label: '未开始' },
  { value: 'IN_PROGRESS', label: '进行中' },
  { value: 'DONE', label: '已完成' },
];

const GoalsPage = () => {
  const [typeFilter, setTypeFilter] = useState<GoalType>('MONTH');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalWithChildren | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    try {
      const params: { type?: string; status?: string } = {
        type: typeFilter,
      };
      if (statusFilter) params.status = statusFilter;
      const data = await getGoals(params);
      setGoals(data.items);
      setTotal(data.total);
    } catch (error) {
      logger.error('加载目标列表失败', error);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    void fetchGoals();
  }, [fetchGoals]);

  const parentOptions = goals
    .filter((g) => g.type !== 'WEEK')
    .map((g) => ({ id: g.id, title: g.title }));

  const handleCreateClick = () => {
    setEditingGoal(null);
    setFormOpen(true);
  };

  const handleFormSubmit = async (
    data: CreateGoalRequest | UpdateGoalRequest,
  ) => {
    setSubmitting(true);
    try {
      if (editingGoal) {
        await updateGoal(editingGoal.id, data as UpdateGoalRequest);
      } else {
        await createGoal(data as CreateGoalRequest);
      }
      setFormOpen(false);
      setEditingGoal(null);
      await fetchGoals();
    } catch (error) {
      logger.error('保存目标失败', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCardClick = (goal: Goal) => {
    setSelectedGoalId(goal.id);
    setDetailOpen(true);
  };

  const handleEditFromSheet = (goal: GoalWithChildren) => {
    setDetailOpen(false);
    setEditingGoal(goal);
    setFormOpen(true);
  };

  const handleDelete = async (goalId: string) => {
    if (!await showConfirm('确定删除该目标吗？子目标将被解除关联。')) return;
    try {
      await deleteGoal(goalId);
      setDetailOpen(false);
      setSelectedGoalId(null);
      await fetchGoals();
    } catch (error) {
      logger.error('删除目标失败', error);
    }
  };

  const handleDecompose = async (id: string): Promise<DecomposedGoal[]> => {
    const result = await decomposeGoal(id);
    return result.suggestedGoals;
  };

  const handleConfirmDecompose = async (
    id: string,
    goalsList: DecomposedGoal[],
  ) => {
    await confirmDecompose(id, { goals: goalsList });
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* 顶部操作栏 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">目标管理</h1>
          <p className="text-muted-foreground mt-1">
            建立年度、月度、周三级目标体系，让目标落地可执行
          </p>
        </div>
        <Button onClick={handleCreateClick}>
          <Plus className="size-4" />
          新建目标
        </Button>
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <Tabs
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as GoalType)}
        >
          <TabsList>
            {GOAL_TYPES.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="状态筛选" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 目标卡片列表 */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i: number) => (
            <Card key={i} className="border border-border shadow-sm">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-5 w-16 bg-accent rounded-full animate-pulse" />
                  <div className="h-4 w-10 bg-accent rounded animate-pulse" />
                </div>
                <div className="h-5 w-3/4 bg-accent rounded animate-pulse" />
                <div className="h-4 w-full bg-accent rounded animate-pulse" />
                <div className="h-4 w-2/3 bg-accent rounded animate-pulse" />
                <div className="h-1.5 w-full bg-accent rounded-full animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : goals.length === 0 ? (
        <Card className="border border-border shadow-sm">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center">
            <div className="aspect-square size-16 rounded-full bg-accent flex items-center justify-center mb-4">
              <Target className="size-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              暂无目标
            </h3>
            <p className="text-muted-foreground mt-2 max-w-md">
              点击右上角创建你的第一个目标，AI私人助理会帮你拆解成可执行的周计划
            </p>
            <Button className="mt-6" onClick={handleCreateClick}>
              <Plus className="size-4" />
              新建目标
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="text-sm text-muted-foreground">
            共 {total} 个目标
          </div>
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            data-ai-section-type="card-list"
          >
            {goals.map((goal: Goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onClick={() => handleCardClick(goal)}
              />
            ))}
          </div>
        </>
      )}

      {/* 新建/编辑弹窗 */}
      <GoalFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editingGoal={editingGoal}
        parentOptions={parentOptions}
        defaultType={typeFilter}
        onSubmit={handleFormSubmit}
        submitting={submitting}
      />

      {/* 详情抽屉 */}
      <GoalDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        goalId={selectedGoalId}
        onEdit={handleEditFromSheet}
        onDelete={handleDelete}
        onRefetch={fetchGoals}
        decompose={handleDecompose}
        confirmDecompose={handleConfirmDecompose}
      />
    </div>
  );
};

export default GoalsPage;
