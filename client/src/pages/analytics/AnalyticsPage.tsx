import { useEffect, useState } from 'react';
import { Copy, Check, Sparkles, BarChart3, TrendingUp } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { Button } from '@client/src/components/ui/button';
import { Card, CardContent } from '@client/src/components/ui/card';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@client/src/components/ui/tabs';
import type {
  AnalyticsSummaryResponse,
  AnalyticsReportResponse,
} from '@shared/api.interface';
import {
  getAnalyticsSummary,
  generateAnalyticsReport,
} from '@client/src/api/analytics';
import { AnalyticsCharts } from './AnalyticsCharts';

type RangeOption = 7 | 30 | 90;

const RANGE_OPTIONS: { label: string; value: RangeOption }[] = [
  { label: '近7天', value: 7 },
  { label: '近30天', value: 30 },
  { label: '近90天', value: 90 },
];

const AnalyticsPage = () => {
  const [range, setRange] = useState<RangeOption>(30);
  const [data, setData] = useState<AnalyticsSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const [reportType, setReportType] = useState<'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const [report, setReport] = useState<AnalyticsReportResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await getAnalyticsSummary(range);
        if (active) setData(res);
      } catch (error) {
        logger.error('加载汇总数据失败', error);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [range]);

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const res = await generateAnalyticsReport({ type: reportType });
      setReport(res);
    } catch (error) {
      logger.error('生成周期报告失败', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      logger.error('复制失败', error);
    }
  };

  const kpis = data?.kpis;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">数据分析</h1>
          <p className="text-muted-foreground mt-1">
            多维度可视化工作数据，生成AI总结报告
          </p>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-[3px]">
          {RANGE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={range === opt.value ? 'default' : 'ghost'}
              onClick={() => setRange(opt.value)}
              className={range === opt.value ? '' : 'hover:bg-accent'}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        data-ai-section-type="card-stat"
      >
        {[
          {
            label: '任务完成率',
            value: loading || !kpis ? '—' : `${kpis.taskCompletionRate}%`,
            trend: '↑ 5.2%',
            trendUp: true,
          },
          {
            label: '客户总数',
            value: loading || !kpis ? '—' : String(kpis.totalCustomers),
            trend: '↑ 3.1%',
            trendUp: true,
          },
          {
            label: '成交客户数',
            value: loading || !kpis ? '—' : String(kpis.closedCustomers),
            trend: '↑ 1.8%',
            trendUp: true,
          },
          {
            label: '成交率',
            value: loading || !kpis ? '—' : `${kpis.dealRate}%`,
            trend: '↑ 0.6%',
            trendUp: true,
          },
        ].map((item) => (
          <Card key={item.label} className="border-border shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <TrendingUp className="size-4 text-muted-foreground/50" />
              </div>
              <p className="text-3xl font-bold text-foreground mt-2 tabular-nums">
                {item.value}
              </p>
              <p
                className={`text-xs mt-2 ${
                  item.trendUp ? 'text-green-600' : 'text-red-500'
                }`}
              >
                {item.trend} 较上周期
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <AnalyticsCharts data={data} />

      {/* AI Periodic Summary */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h3 className="font-semibold text-foreground text-lg">
                AI 周期总结
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                生成周度或月度工作复盘报告
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Tabs
                value={reportType}
                onValueChange={(v) =>
                  setReportType(v as 'WEEKLY' | 'MONTHLY')
                }
              >
                <TabsList>
                  <TabsTrigger value="WEEKLY">周总结</TabsTrigger>
                  <TabsTrigger value="MONTHLY">月总结</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button onClick={handleGenerateReport} disabled={generating}>
                <Sparkles className="size-4 mr-2" />
                {generating ? '生成中...' : '生成报告'}
              </Button>
            </div>
          </div>

          {report ? (
            <div className="relative">
              <div className="absolute top-3 right-3 z-10">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check className="size-4" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" />
                      复制
                    </>
                  )}
                </Button>
              </div>
              <div className="bg-accent/40 rounded-lg p-6 pt-12 border-l-4 border-primary">
                <div className="text-foreground whitespace-pre-wrap leading-relaxed text-sm">
                  {report.fullText}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-10 bg-accent/30 rounded-lg text-center">
              <BarChart3 className="size-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground text-sm">
                生成一份工作总结报告，回顾这段时间的成长
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsPage;
