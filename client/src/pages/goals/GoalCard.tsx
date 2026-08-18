import { Card, CardContent } from '@client/src/components/ui/card';
import { Badge } from '@client/src/components/ui/badge';
import { CalendarDays } from 'lucide-react';
import type { Goal } from '@shared/api.interface';

interface GoalCardProps {
  goal: Goal;
  onClick: () => void;
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

function GoalCard({ goal, onClick }: GoalCardProps) {
  const statusInfo = statusMap[goal.status] ?? statusMap.NOT_STARTED;

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 border border-border shadow-sm bg-card"
    >
      <CardContent className="p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Badge
            variant="secondary"
            className={`text-xs font-medium ${statusInfo.className}`}
          >
            {statusInfo.label}
          </Badge>
          <span className="text-xs font-semibold text-foreground tabular-nums">
            {goal.progress}%
          </span>
        </div>

        <h3 className="font-semibold text-foreground truncate">{goal.title}</h3>

        <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
          {goal.description || '暂无描述'}
        </p>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" />
          <span>
            {goal.startDate} ~ {goal.endDate}
          </span>
        </div>

        <div className="pt-1">
          <div className="w-full h-1.5 bg-accent rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${goal.progress}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default GoalCard;
