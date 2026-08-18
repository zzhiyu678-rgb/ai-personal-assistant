import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@client/src/components/ui/sheet';
import { Badge } from '@client/src/components/ui/badge';
import { Button } from '@client/src/components/ui/button';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { Pencil, Trash2, CalendarDays, Sparkles } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { getGoal } from '@client/src/api/goal';
import type {
  GoalWithChildren,
  GoalStatus,
  DecomposedGoal,
} from '@shared/api.interface';
import DecomposePanel from './DecomposePanel';

interface GoalDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goalId: string | null;
  onEdit: (goal: GoalWithChildren) => void;
  onDelete: (goalId: string) => void;
  onRefetch: () => void;
  decompose: (id: string) => Promise<DecomposedGoal[]>;
  confirmDecompose: (
    id: string,
    goals: DecomposedGoal[],
  ) => Promise<void>;
}

const statusMap: Record<string, { label: string; className: string }> = {
  NOT_STARTED: {
    label: '未开始',
    className: 'bg-muted text-muted-foreground border-transparent',
  },
  IN_PROGRESS: {
    label: '进行中',
    className: 'bg-primary/10 text-primary border-transparent',
  },
  DONE: {
    label: '已完成',
    className:
      'bg-[hsl(152_60%_96%)] text-[hsl(152_60%_40%)] border-transparent',
  },
};

const childStatusColor: Record<string, string> = {
  NOT_STARTED: 'bg-muted',
  IN_PROGRESS: 'bg-primary',
  DONE: 'bg-[hsl(152_60%_40%)]',
};

function GoalDetailSheet({
  open,
  onOpenChange,
  goalId,
  onEdit,
  onDelete,
  onRefetch,
  decompose,
  confirmDecompose,
}: GoalDetailSheetProps) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<GoalWithChildren | null>(null);
  const [decomposeLoading, setDecomposeLoading] = useState(false);
  const [suggestedGoals, setSuggestedGoals] = useState<DecomposedGoal[]>([]);
  const [showDecompose, setShowDecompose] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open || !goalId) {
      setDetail(null);
      setShowDecompose(false);
      setSuggestedGoals([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await getGoal(goalId);
        if (!cancelled) setDetail(data);
      } catch (error) {
        logger.error('加载目标详情失败', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, goalId]);

  const handleDecompose = async () => {
    if (!goalId) return;
    setDecomposeLoading(true);
    setShowDecompose(true);
    try {
      const goals = await decompose(goalId);
      setSuggestedGoals(goals);
    } catch (error) {
      logger.error('AI拆解失败', error);
      setShowDecompose(false);
    } finally {
      setDecomposeLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!goalId) return;
    setConfirming(true);
    try {
      await confirmDecompose(goalId, suggestedGoals);
      setShowDecompose(false);
      setSuggestedGoals([]);
      onOpenChange(false);
      onRefetch();
    } catch (error) {
      logger.error('确认拆解失败', error);
    } finally {
      setConfirming(false);
    }
  };

  const statusInfo = detail
    ? statusMap[detail.status] ?? statusMap.NOT_STARTED
    : statusMap.NOT_STARTED;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-lg p-0 shadow-xl">
        <div className="flex flex-col h-full">
          {showDecompose ? (
            <div className="p-6 overflow-y-auto flex-1">
              <DecomposePanel
                loading={decomposeLoading}
                suggestedGoals={suggestedGoals}
                onGoalsChange={setSuggestedGoals}
                onConfirm={handleConfirm}
                onCancel={() => {
                  setShowDecompose(false);
                  setSuggestedGoals([]);
                }}
                confirming={confirming}
              />
            </div>
          ) : (
            <>
              <SheetHeader className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <SheetTitle>
                    {loading ? (
                      <Skeleton className="h-6 w-48" />
                    ) : (
                      detail?.title
                    )}
                  </SheetTitle>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {loading ? (
                    <Skeleton className="h-5 w-16 rounded-full" />
                  ) : (
                    <Badge
                      variant="secondary"
                      className={statusInfo.className}
                    >
                      {statusInfo.label}
                    </Badge>
                  )}
                  {loading ? (
                    <Skeleton className="h-4 w-32" />
                  ) : (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="size-3" />
                      {detail?.startDate} ~ {detail?.endDate}
                    </span>
                  )}
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {loading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                ) : (
                  <>
                    <div>
                      <h4 className="text-sm font-medium text-foreground mb-2">
                        描述
                      </h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {detail?.description || '暂无描述'}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-foreground">
                          总体进度
                        </h4>
                        <span className="text-sm font-semibold text-foreground tabular-nums">
                          {detail?.progress ?? 0}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-accent rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${detail?.progress ?? 0}%` }}
                        />
                      </div>
                    </div>

                    {detail && detail.children.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-foreground mb-3">
                          子目标 ({detail.children.length})
                        </h4>
                        <div className="space-y-2">
                          {detail.children.map((child) => {
                            const childStatus = child.status as GoalStatus;
                            return (
                              <div
                                key={child.id}
                                className="border border-border rounded-lg p-3 bg-card"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-foreground truncate pr-2">
                                    {child.title}
                                  </span>
                                  <span
                                    className={`text-xs font-semibold tabular-nums shrink-0 ${
                                      childStatus === 'DONE'
                                        ? 'text-[hsl(152_60%_40%)]'
                                        : childStatus === 'IN_PROGRESS'
                                          ? 'text-primary'
                                          : 'text-muted-foreground'
                                    }`}
                                  >
                                    {child.progress}%
                                  </span>
                                </div>
                                <div className="w-full h-1 bg-accent rounded-full overflow-hidden mb-2">
                                  <div
                                    className={`h-full rounded-full transition-all ${childStatusColor[childStatus] ?? 'bg-muted'}`}
                                    style={{ width: `${child.progress}%` }}
                                  />
                                </div>
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>{child.startDate}</span>
                                  <span>
                                    {
                                      statusMap[childStatus]
                                        ?.label
                                    }
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="p-6 border-t border-border space-y-2">
                {detail?.type === 'MONTH' && (
                  <Button
                    className="w-full"
                    onClick={handleDecompose}
                    disabled={decomposeLoading}
                  >
                    <Sparkles className="size-4" />
                    {decomposeLoading ? 'AI拆解中...' : 'AI拆解为周目标'}
                  </Button>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => detail && onEdit(detail)}
                    disabled={loading || !detail}
                  >
                    <Pencil className="size-4" />
                    编辑
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 text-destructive hover:text-destructive"
                    onClick={() => {
                      if (goalId) onDelete(goalId);
                    }}
                    disabled={loading || !detail}
                  >
                    <Trash2 className="size-4" />
                    删除
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default GoalDetailSheet;
