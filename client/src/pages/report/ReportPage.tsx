import { useState } from 'react';
import { toast } from 'sonner';
import {
  BookOpen,
  Copy,
  Calendar as CalendarIcon,
  CheckCircle2,
  BarChart3,
  AlertTriangle,
  Sparkles,
  Lightbulb,
  Target,
  Loader2,
} from 'lucide-react';

import { Card, CardContent } from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@client/src/components/ui/popover';
import { Calendar } from '@client/src/components/ui/calendar';
import { generateReport } from '@client/src/api/report';

import type { Report, ReportContent } from '@shared/api.interface';

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const ReportPage = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const dateStr = formatDate(selectedDate);
      const result = await generateReport({ date: dateStr, type: 'DAILY' });
      setReport(result);
      toast.success('日报生成成功');
    } catch {
      toast.error('生成失败，AI服务暂时不可用，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.fullText);
      setCopied(true);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败');
    }
  };

  const dateDisplay = selectedDate.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">工作日报</h1>
          <p className="text-muted-foreground mt-1">
            AI自动生成结构化日报，一键复制分享
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarIcon className="size-4 mr-2" />
                {dateDisplay}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date: Date | undefined) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {report && (
            <Button variant="outline" onClick={handleCopy}>
              {copied ? (
                <CheckCircle2 className="size-4 mr-2" />
              ) : (
                <Copy className="size-4 mr-2" />
              )}
              {copied ? '已复制' : '复制全文'}
            </Button>
          )}
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="size-4 mr-2" />
            )}
            生成今日工作汇报
          </Button>
        </div>
      </div>

      {/* 内容区 */}
      {loading ? (
        <ReportSkeleton />
      ) : report ? (
        <ReportContentCard content={report.content} />
      ) : (
        <ReportEmptyState onGenerate={handleGenerate} />
      )}
    </div>
  );
};

const ReportEmptyState = ({ onGenerate }: { onGenerate: () => void }) => {
  return (
    <Card className="border border-border shadow-sm">
      <CardContent className="p-12 flex flex-col items-center justify-center text-center">
        <div className="aspect-square size-16 rounded-full bg-accent flex items-center justify-center mb-4">
          <BookOpen className="size-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">还没有生成日报</h3>
        <p className="text-muted-foreground mt-2 max-w-md">
          先记录今日工作内容，然后点击「生成今日工作汇报」，AI会自动整理出六大板块的结构化日报
        </p>
        <div className="mt-6 text-left space-y-2 text-sm text-muted-foreground">
          <p>📋 一、今日完成</p>
          <p>📊 二、数据统计</p>
          <p>⚠️ 三、遇到的问题</p>
          <p>💡 四、AI分析</p>
          <p>🎯 五、改进建议</p>
          <p>🌟 六、明日目标和计划</p>
        </div>
        <Button className="mt-6" onClick={onGenerate}>
          <Sparkles className="size-4 mr-2" />
          生成今日工作汇报
        </Button>
      </CardContent>
    </Card>
  );
};

const ReportSkeleton = () => {
  return (
    <Card className="border border-border shadow-sm">
      <CardContent className="p-10 space-y-6">
        <div className="h-7 w-48 bg-accent rounded animate-pulse mx-auto" />
        {[1, 2, 3, 4, 5, 6].map((i: number) => (
          <div key={i} className="space-y-2 animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="h-5 w-32 bg-accent rounded animate-pulse" />
            <div className="h-px bg-border" />
            <div className="space-y-1.5 pt-1">
              <div className="h-4 w-full bg-accent rounded animate-pulse opacity-70" />
              <div className="h-4 w-5/6 bg-accent rounded animate-pulse opacity-50" />
              <div className="h-4 w-2/3 bg-accent rounded animate-pulse opacity-30" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

const sections: Array<{
  key: keyof ReportContent;
  icon: typeof CheckCircle2;
  title: string;
  accent: string;
}> = [
  { key: 'completed', icon: CheckCircle2, title: '今日完成', accent: 'text-emerald-600' },
  { key: 'statistics', icon: BarChart3, title: '数据统计', accent: 'text-blue-600' },
  { key: 'problems', icon: AlertTriangle, title: '遇到的问题', accent: 'text-amber-600' },
  { key: 'aiAnalysis', icon: Sparkles, title: 'AI分析', accent: 'text-primary' },
  { key: 'suggestions', icon: Lightbulb, title: '改进建议', accent: 'text-violet-600' },
  { key: 'tomorrowGoals', icon: Target, title: '明日目标和计划', accent: 'text-rose-600' },
];

const ReportContentCard = ({ content }: { content: ReportContent }) => {
  return (
    <Card className="border border-border shadow-sm">
      <CardContent className="p-10 space-y-8">
        <h2 className="text-xl font-bold text-foreground text-center">
          今日工作汇报
        </h2>

        {sections.map((section, index: number) => {
          const Icon = section.icon;
          const value = content[section.key];

          return (
            <div key={section.key} className="space-y-3">
              <div className="flex items-center gap-2">
                <div
                  className="size-7 rounded-md bg-accent flex items-center justify-center"
                >
                  <Icon className={`size-4 ${section.accent}`} />
                </div>
                <h3 className="font-bold text-foreground">
                  {index + 1}. {section.title}
                </h3>
              </div>
              <div className="h-px bg-border" />
              <div className="text-foreground text-sm leading-relaxed">
                {section.key === 'aiAnalysis' ? (
                  <p className="whitespace-pre-wrap">{value as string}</p>
                ) : section.key === 'statistics' ? (
                  <div className="grid grid-cols-3 gap-3">
                    {(value as Array<{ label: string; value: string }>).map(
                      (stat: { label: string; value: string }, i: number) => (
                        <div
                          key={i}
                          className="bg-accent/50 rounded-lg p-3 text-center"
                        >
                          <div className="text-lg font-bold tabular-nums text-foreground">
                            {stat.value}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {stat.label}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                ) : Array.isArray(value) && value.length > 0 ? (
                  <ul className="space-y-2">
                    {(value as string[]).map((item: string, i: number) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-muted-foreground flex-shrink-0">
                          {i + 1}.
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">暂无数据</p>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default ReportPage;
