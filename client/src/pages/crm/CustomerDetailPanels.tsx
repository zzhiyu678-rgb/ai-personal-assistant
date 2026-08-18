import {
  Building2,
  User,
  Phone,
  Briefcase,
  FileText,
  Edit3,
  Sparkles,
  Target,
  AlertCircle,
  Lightbulb,
  ArrowRight,
  MessageSquare,
  Trash2,
} from 'lucide-react';

import type { Customer, AiCustomerAnalysis, CustomerStage, FollowUpType } from '@shared/api.interface';
import { Badge } from '@client/src/components/ui/badge';
import { Button } from '@client/src/components/ui/button';

interface CustomerInfoPanelProps {
  customer: Customer;
  onEdit: () => void;
}

const STAGE_LABELS: Record<CustomerStage, string> = {
  UNCONTACTED: '未联系',
  ADDED: '已添加',
  COMMUNICATING: '沟通中',
  INTERESTED: '意向客户',
  CLOSED: '成交',
};

const STAGE_CLASSES: Record<CustomerStage, string> = {
  UNCONTACTED: 'bg-gray-100 text-gray-600 border-transparent',
  ADDED: 'bg-blue-100 text-blue-600 border-transparent',
  COMMUNICATING: 'bg-indigo-100 text-indigo-600 border-transparent',
  INTERESTED: 'bg-amber-100 text-amber-600 border-transparent',
  CLOSED: 'bg-green-100 text-green-600 border-transparent',
};

function CustomerInfoPanel({ customer, onEdit }: CustomerInfoPanelProps) {
  return (
    <div className="flex flex-col h-full p-4 overflow-y-auto">
      <div className="flex items-start justify-between mb-4">
        <h2 className="text-xl font-bold text-foreground leading-tight">
          {customer.company}
        </h2>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Edit3 className="size-4" />
          编辑
        </Button>
      </div>

      <Badge
        className={`mb-4 w-fit ${STAGE_CLASSES[customer.stage]}`}
      >
        {STAGE_LABELS[customer.stage]}
      </Badge>

      <div className="space-y-3 text-sm">
        <div className="flex items-start gap-3">
          <User className="size-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <div className="text-muted-foreground text-xs">联系人</div>
            <div className="text-foreground font-medium">
              {customer.contactName}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Phone className="size-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <div className="text-muted-foreground text-xs">联系方式</div>
            <div className="text-foreground font-medium break-words">
              {customer.contactInfo}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Briefcase className="size-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <div className="text-muted-foreground text-xs">行业</div>
            <div className="text-foreground font-medium">
              {customer.industry || '未填写'}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Building2 className="size-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <div className="text-muted-foreground text-xs">创建时间</div>
            <div className="text-foreground font-medium">
              {new Date(customer.createdAt).toLocaleDateString('zh-CN')}
            </div>
          </div>
        </div>
      </div>

      {customer.notes && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="size-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">备注</span>
          </div>
          <div className="bg-accent/50 rounded-lg p-3 text-sm text-foreground whitespace-pre-wrap break-words">
            {customer.notes}
          </div>
        </div>
      )}
    </div>
  );
}

interface AiAnalysisPanelProps {
  analysis: AiCustomerAnalysis | null;
  hasFollowUps: boolean;
}

function DealProbabilityRing({ probability }: { probability: number }) {
  const size = 140;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (probability / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(220, 13%, 91%)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(217, 78%, 51%)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums text-foreground">
          {probability}%
        </span>
        <span className="text-xs text-muted-foreground">成交概率</span>
      </div>
    </div>
  );
}

function AiAnalysisPanel({ analysis, hasFollowUps }: AiAnalysisPanelProps) {
  if (!analysis) {
    return (
      <div className="bg-primary/5 rounded-lg p-4 h-full flex flex-col items-center justify-center text-center">
        <div className="aspect-square size-16 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <Sparkles className="size-8 text-primary" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-2">
          AI 智能分析
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {hasFollowUps
            ? 'AI 正在分析中，请稍候...'
            : '暂无分析数据，添加第一条跟进记录后AI将自动分析客户意向与成交概率'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-primary/5 rounded-lg p-4 h-full overflow-y-auto space-y-4">
      <div className="flex items-center gap-2">
        <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center">
          <Sparkles className="size-4 text-primary" />
        </div>
        <h3 className="text-base font-semibold text-foreground">AI 智能分析</h3>
      </div>

      <div className="flex justify-center py-2">
        <DealProbabilityRing probability={analysis.dealProbability} />
      </div>

      <div className="bg-card rounded-lg p-3 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Target className="size-4 text-primary" />
          <span className="text-xs font-medium text-foreground">意向等级</span>
        </div>
        <div className="text-lg font-bold text-foreground">
          {analysis.intentionLevel}
        </div>
      </div>

      {analysis.concerns.length > 0 && (
        <div className="bg-card rounded-lg p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="size-4 text-amber-500" />
            <span className="text-xs font-medium text-foreground">客户顾虑</span>
          </div>
          <ul className="space-y-1.5">
            {analysis.concerns.map((concern: string, idx: number) => (
              <li
                key={idx}
                className="text-sm text-foreground/80 flex items-start gap-2"
              >
                <span className="text-amber-500 mt-1">•</span>
                <span>{concern}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.suggestions.length > 0 && (
        <div className="bg-card rounded-lg p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="size-4 text-primary" />
            <span className="text-xs font-medium text-foreground">沟通建议</span>
          </div>
          <ul className="space-y-1.5">
            {analysis.suggestions.map((suggestion: string, idx: number) => (
              <li
                key={idx}
                className="text-sm text-foreground/80 flex items-start gap-2"
              >
                <span className="text-primary mt-1">•</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.nextStep && (
        <div className="rounded-lg p-3 bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/20 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <ArrowRight className="size-4 text-primary" />
            <span className="text-xs font-semibold text-primary">
              下一步行动
            </span>
          </div>
          <p className="text-sm text-foreground font-medium">
            {analysis.nextStep}
          </p>
        </div>
      )}
    </div>
  );
}

interface FollowUpTimelineProps {
  followUps: Array<{
    id: string;
    content: string;
    followType: FollowUpType;
    aiSuggestion: string | null;
    createdAt: string;
  }>;
  onAddFollowUp: () => void;
  onDeleteFollowUp?: (id: string) => void;
  onAnalyze?: () => void;
  analyzing?: boolean;
  loading: boolean;
}

const FOLLOW_UP_LABELS: Record<FollowUpType, string> = {
  PHONE: '电话',
  WECHAT: '微信',
  MEETING: '会面',
  EMAIL: '邮件',
  OTHER: '其他',
};

const FOLLOW_UP_CLASSES: Record<FollowUpType, string> = {
  PHONE: 'bg-blue-100 text-blue-600 border-transparent',
  WECHAT: 'bg-green-100 text-green-600 border-transparent',
  MEETING: 'bg-purple-100 text-purple-600 border-transparent',
  EMAIL: 'bg-indigo-100 text-indigo-600 border-transparent',
  OTHER: 'bg-gray-100 text-gray-600 border-transparent',
};

function FollowUpTimeline({
  followUps,
  onAddFollowUp,
  onDeleteFollowUp,
  onAnalyze,
  analyzing,
  loading,
}: FollowUpTimelineProps) {
  return (
    <div className="flex flex-col h-full border-x border-border">
      <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <MessageSquare className="size-5 text-primary" />
          跟进记录
          <span className="text-xs font-normal text-muted-foreground">
            ({followUps.length})
          </span>
        </h3>
        <div className="flex items-center gap-2">
          {onAnalyze && (
            <Button size="sm" variant="outline" onClick={onAnalyze} disabled={analyzing}>
              <Sparkles className="size-4 mr-1" />
              {analyzing ? '分析中...' : 'AI分析'}
            </Button>
          )}
          <Button size="sm" onClick={onAddFollowUp} disabled={loading}>
            添加跟进
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pl-8">
        {followUps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="aspect-square size-12 rounded-full bg-accent flex items-center justify-center mb-3">
              <MessageSquare className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">暂无跟进记录</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              添加第一条跟进记录，开始客户跟进旅程
            </p>
          </div>
        ) : (
          <div className="relative border-l-2 border-border pl-6 space-y-6">
            {followUps.map((fu) => (
              <div key={fu.id} className="relative">
                <div className="absolute left-[-25px] top-1.5 w-4 h-4 rounded-full bg-primary border-2 border-card" />

                <div className="bg-card rounded-lg border border-border shadow-sm p-4 group">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={FOLLOW_UP_CLASSES[fu.followType]}>
                      {FOLLOW_UP_LABELS[fu.followType]}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(fu.createdAt).toLocaleString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {onDeleteFollowUp && (
                        <button
                          onClick={() => {
                            if (window.confirm('确定删除这条跟进记录吗？')) {
                              onDeleteFollowUp(fu.id);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity"
                          title="删除跟进记录"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap break-words mb-2">
                    {fu.content}
                  </p>
                  {fu.aiSuggestion && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <div className="flex items-center gap-1 mb-1">
                        <Sparkles className="size-3 text-primary" />
                        <span className="text-xs font-medium text-primary">
                          AI 建议
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {fu.aiSuggestion}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { CustomerInfoPanel, AiAnalysisPanel, FollowUpTimeline };
