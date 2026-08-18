import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';

import type { AnalyticsSummaryResponse } from '@shared/api.interface';

const CHART_COLOR = '#3B82F6';
const PIE_COLORS = ['#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE'];

interface ChartProps {
  title: string;
  option: EChartsOption;
  height?: number;
  empty?: boolean;
}

function ChartCard({ title, option, height = 300, empty }: ChartProps) {
  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-6">
      <h3 className="font-semibold text-foreground mb-4">{title}</h3>
      {empty ? (
        <div
          className="flex items-center justify-center text-muted-foreground text-sm"
          style={{ height }}
        >
          暂无数据
        </div>
      ) : (
        <ReactECharts option={option} theme="ud" style={{ height }} />
      )}
    </div>
  );
}

interface AnalyticsChartsProps {
  data: AnalyticsSummaryResponse | null;
}

export function AnalyticsCharts({ data }: AnalyticsChartsProps) {
  const workTrendOption = useMemo<EChartsOption>(() => {
    if (!data) return {};
    return {
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, data: ['完成任务数'] },
      grid: { containLabel: true, left: 10, right: 10, top: 20, bottom: 40 },
      xAxis: {
        type: 'category',
        data: data.workTrend.map((item) => item.date.slice(5)),
      },
      yAxis: { type: 'value' },
      series: [
        {
          name: '完成任务数',
          type: 'line',
          smooth: true,
          data: data.workTrend.map((item) => item.completedCount),
          itemStyle: { color: CHART_COLOR },
          lineStyle: { color: CHART_COLOR },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(59,130,246,0.3)' },
                { offset: 1, color: 'rgba(59,130,246,0.02)' },
              ],
            },
          },
        },
      ],
    };
  }, [data]);

  const completionBarOption = useMemo<EChartsOption>(() => {
    if (!data) return {};
    return {
      tooltip: { trigger: 'axis', valueFormatter: (v) => `${v}%` },
      legend: { bottom: 0, data: ['完成率'] },
      grid: { containLabel: true, left: 10, right: 10, top: 20, bottom: 40 },
      xAxis: {
        type: 'category',
        data: data.taskCompletionByPeriod.map((item) => item.period),
        axisLabel: { interval: 0, rotate: data.taskCompletionByPeriod.length > 4 ? 30 : 0 },
        boundaryGap: true,
      },
      yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
      series: [
        {
          name: '完成率',
          type: 'bar',
          data: data.taskCompletionByPeriod.map((item) => item.rate),
          itemStyle: { color: CHART_COLOR, borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 40,
        },
      ],
    };
  }, [data]);

  const customerGrowthOption = useMemo<EChartsOption>(() => {
    if (!data) return {};
    return {
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, data: ['新增客户数'] },
      grid: { containLabel: true, left: 10, right: 10, top: 20, bottom: 40 },
      xAxis: {
        type: 'category',
        data: data.customerGrowth.map((item) => item.date.slice(5)),
        boundaryGap: true,
      },
      yAxis: { type: 'value' },
      series: [
        {
          name: '新增客户数',
          type: 'bar',
          data: data.customerGrowth.map((item) => item.newCount),
          itemStyle: {
            color: '#10B981',
            borderRadius: [4, 4, 0, 0],
          },
          barMaxWidth: 30,
        },
      ],
    };
  }, [data]);

  const communicationOption = useMemo<EChartsOption>(() => {
    if (!data) return {};
    return {
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, data: ['跟进记录数'] },
      grid: { containLabel: true, left: 10, right: 10, top: 20, bottom: 40 },
      xAxis: {
        type: 'category',
        data: data.communicationStats.map((item) => item.date.slice(5)),
      },
      yAxis: { type: 'value' },
      series: [
        {
          name: '跟进记录数',
          type: 'line',
          smooth: true,
          data: data.communicationStats.map((item) => item.count),
          itemStyle: { color: '#F59E0B' },
          lineStyle: { color: '#F59E0B' },
        },
      ],
    };
  }, [data]);

  const stagePieOption = useMemo<EChartsOption>(() => {
    if (!data) return {};
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0 },
      color: PIE_COLORS,
      series: [
        {
          name: '阶段分布',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '45%'],
          label: { show: false },
          emphasis: { label: { show: false } },
          data: data.stageDistribution.map((item) => ({
            name: item.stage,
            value: item.count,
          })),
        },
      ],
    };
  }, [data]);

  const industryPieOption = useMemo<EChartsOption>(() => {
    if (!data) return {};
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0 },
      color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
      series: [
        {
          name: '行业分布',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '45%'],
          label: { show: false },
          emphasis: { label: { show: false } },
          data: data.industryDistribution.map((item) => ({
            name: item.industry,
            value: item.count,
          })),
        },
      ],
    };
  }, [data]);

  const hasData = !!data;
  const workTrendEmpty =
    !hasData || data.workTrend.every((item) => item.completedCount === 0);
  const completionEmpty =
    !hasData ||
    data.taskCompletionByPeriod.every((item) => item.rate === 0);
  const growthEmpty =
    !hasData || data.customerGrowth.every((item) => item.newCount === 0);
  const commEmpty =
    !hasData ||
    data.communicationStats.every((item) => item.count === 0);
  const stageEmpty =
    !hasData ||
    data.stageDistribution.every((item) => item.count === 0);
  const industryEmpty =
    !hasData ||
    data.industryDistribution.every((item) => item.count === 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      <ChartCard
        title="工作趋势"
        option={workTrendOption}
        empty={workTrendEmpty}
      />
      <ChartCard
        title="任务完成率"
        option={completionBarOption}
        empty={completionEmpty}
      />
      <ChartCard
        title="新增客户趋势"
        option={customerGrowthOption}
        empty={growthEmpty}
      />
      <ChartCard
        title="沟通数量统计"
        option={communicationOption}
        empty={commEmpty}
      />
      <ChartCard
        title="客户阶段分布"
        option={stagePieOption}
        empty={stageEmpty}
      />
      <ChartCard
        title="行业分布"
        option={industryPieOption}
        empty={industryEmpty}
      />
    </div>
  );
}

export default AnalyticsCharts;
