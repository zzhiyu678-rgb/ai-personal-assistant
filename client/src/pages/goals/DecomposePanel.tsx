import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import { Badge } from '@client/src/components/ui/badge';
import { Skeleton } from '@client/src/components/ui/skeleton';
import type { DecomposedGoal } from '@shared/api.interface';

interface DecomposePanelProps {
  loading: boolean;
  suggestedGoals: DecomposedGoal[];
  onGoalsChange: (goals: DecomposedGoal[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
  confirming: boolean;
}

function DecomposePanel({
  loading,
  suggestedGoals,
  onGoalsChange,
  onConfirm,
  onCancel,
  confirming,
}: DecomposePanelProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleRemove = (index: number) => {
    const next = suggestedGoals.filter((_: DecomposedGoal, i: number) => i !== index);
    onGoalsChange(next);
  };

  const handleFieldChange = (
    index: number,
    field: keyof DecomposedGoal,
    value: string,
  ) => {
    const next = suggestedGoals.map(
      (g: DecomposedGoal, i: number) =>
        i === index ? { ...g, [field]: value } : g,
    );
    onGoalsChange(next);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge className="bg-primary/10 text-primary border-transparent">
            AI 拆解中
          </Badge>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            取消
          </Button>
        </div>
        {[0, 1, 2].map((i: number) => (
          <div
            key={i}
            className="border border-border rounded-lg p-4 space-y-3 bg-card"
          >
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge className="bg-primary/10 text-primary border-transparent">
          AI 建议周目标
        </Badge>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          返回详情
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        以下为 AI 生成的周目标建议，可直接编辑或删除不合适的项，确认后将批量创建。
      </p>

      <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
        {suggestedGoals.map((g: DecomposedGoal, index: number) => (
          <div
            key={index}
            className="border border-border rounded-lg p-4 space-y-3 bg-card hover:border-primary/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <Input
                  value={g.title}
                  onChange={(e) =>
                    handleFieldChange(index, 'title', e.target.value)
                  }
                  onFocus={() => setEditingIndex(index)}
                  onBlur={() => setEditingIndex(null)}
                  className="font-medium text-foreground"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => handleRemove(index)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>

            {editingIndex === index && (
              <Textarea
                value={g.description}
                onChange={(e) =>
                  handleFieldChange(index, 'description', e.target.value)
                }
                rows={2}
                placeholder="目标描述"
              />
            )}
            {editingIndex !== index && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {g.description || '暂无描述'}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  开始日期
                </label>
                <Input
                  type="date"
                  value={g.startDate}
                  onChange={(e) =>
                    handleFieldChange(index, 'startDate', e.target.value)
                  }
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  结束日期
                </label>
                <Input
                  type="date"
                  value={g.endDate}
                  onChange={(e) =>
                    handleFieldChange(index, 'endDate', e.target.value)
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {suggestedGoals.length === 0 && (
        <div className="text-center text-muted-foreground py-8 text-sm">
          暂无建议目标
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={confirming}
        >
          取消
        </Button>
        <Button
          onClick={onConfirm}
          disabled={confirming || suggestedGoals.length === 0}
        >
          {confirming ? '保存中...' : `确认保存 (${suggestedGoals.length})`}
        </Button>
      </div>
    </div>
  );
}

export default DecomposePanel;
