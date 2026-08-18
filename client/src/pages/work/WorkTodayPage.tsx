import { useState, useEffect, useCallback } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  ChevronLeft,
  ChevronRight,
  Save,
  History,
  Calendar,
  CheckCircle2,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Textarea } from '@client/src/components/ui/textarea';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { getDailyRecord, saveDailyRecord, getDailyRecordList } from '@client/src/api/daily-record';
import type { DailyRecord } from '@shared/api.interface';
import { useAutoSave } from '@client/src/hooks/useAutoSave';

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

const DRAFT_KEY_PREFIX = 'daily_record_draft_';

function formatDateLabel(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const w = WEEKDAYS[date.getDay()];
  return `${y}年${m}月${d}日 ${w}`;
}

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function SaveStatusIndicator({ status, lastSaved }: { status: string; lastSaved: Date | null }) {
  if (status === 'saving') {
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Save className="size-3 animate-pulse" />
        保存中...
      </span>
    );
  }
  if (status === 'saved' && lastSaved) {
    return (
      <span className="text-xs text-emerald-600 flex items-center gap-1">
        <CheckCircle2 className="size-3" />
        已保存 {lastSaved.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
      </span>
    );
  }
  if (status === 'error') {
    return <span className="text-xs text-red-500">保存失败，请重试</span>;
  }
  return null;
}

function HistoryView({ currentDate, onSelect }: { currentDate: string; onSelect: (d: string) => void }) {
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const list = await getDailyRecordList({ page: 1, pageSize: 60 });
        if (!cancelled) setRecords(list.items || []);
      } catch (e) {
        logger.error('加载历史记录失败', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-6 space-y-3">
          <Skeleton className="w-full h-12" />
          <Skeleton className="w-full h-12" />
          <Skeleton className="w-3/4 h-12" />
        </CardContent>
      </Card>
    );
  }

  if (records.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-12 text-center">
          <Calendar className="size-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">暂无历史记录</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="space-y-1">
          {records.map((rec) => (
            <button
              key={rec.id}
              onClick={() => onSelect(rec.date)}
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center justify-between ${
                rec.date === currentDate
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-accent/50 text-foreground'
              }`}
            >
              <div>
                <div className="font-medium text-sm">{rec.date}</div>
                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {rec.plan?.slice(0, 60) || '无内容'}
                </div>
              </div>
              {rec.date === currentDate && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">当前</span>
              )}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const WorkTodayPage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const dateStr = toDateStr(currentDate);
  const draftKey = `${DRAFT_KEY_PREFIX}${dateStr}`;

  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<DailyRecord | null>(null);
  const [inputContent, setInputContent] = useState('');
  const [viewMode, setViewMode] = useState<'input' | 'history'>('input');
  const [manualSaving, setManualSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { saveStatus, lastSaved, forceSave } = useAutoSave({
    value: inputContent,
    storageKey: draftKey,
    delay: 5000, // 5秒自动保存
    onSave: async (content) => {
      if (!content.trim()) return;
      await saveDailyRecord(dateStr, { completed: content });
    },
  });

  const loadRecord = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDailyRecord(dateStr);
      setRecord(data);
      if (data && data.completed) {
        setInputContent(data.completed);
      } else {
        const draft = localStorage.getItem(draftKey);
        setInputContent(draft || '');
      }
    } catch (error) {
      logger.error('加载工作记录失败', error);
    } finally {
      setLoading(false);
    }
  }, [dateStr, draftKey]);

  useEffect(() => {
    loadRecord();
  }, [loadRecord]);

  const handleSave = async () => {
    if (!inputContent.trim()) return;
    setManualSaving(true);
    try {
      const saved = await saveDailyRecord(dateStr, { completed: inputContent });
      setRecord(saved);
      localStorage.removeItem(draftKey);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      logger.error('保存失败', error);
      alert('保存失败，请重试');
    } finally {
      setManualSaving(false);
    }
  };

  const goPrevDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const goNextDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const goToday = () => setCurrentDate(new Date());

  const today = isToday(currentDate);
  const hasContent = inputContent.trim().length > 0;

  return (
    <div className="space-y-6 max-w-[1000px] mx-auto pb-28">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="icon" onClick={goPrevDay} aria-label="前一天">
            <ChevronLeft className="size-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {formatDateLabel(currentDate)}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              记录今天的工作，之后AI会帮你整理成工作日报
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={goNextDay} aria-label="后一天">
            <ChevronRight className="size-5" />
          </Button>
          <input
            type="date"
            value={dateStr}
            onChange={(e) => {
              if (e.target.value) setCurrentDate(new Date(e.target.value + 'T00:00:00'));
            }}
            className="text-sm border border-input rounded-md px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label="选择日期"
          />
          {!today && (
            <Button variant="outline" size="sm" onClick={goToday}>
              今天
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'input' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('input')}
          >
            <Calendar className="size-4 mr-1.5" />
            今日记录
          </Button>
          <Button
            variant={viewMode === 'history' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('history')}
          >
            <History className="size-4 mr-1.5" />
            历史记录
          </Button>
        </div>
      </div>

      {viewMode === 'history' ? (
        <HistoryView
          currentDate={dateStr}
          onSelect={(d) => {
            setCurrentDate(new Date(d + 'T00:00:00'));
            setViewMode('input');
          }}
        />
      ) : loading ? (
        <Card className="shadow-sm">
          <CardContent className="p-6 space-y-3">
            <Skeleton className="w-32 h-5" />
            <Skeleton className="w-full h-64 rounded-md" />
            <Skeleton className="w-28 h-9" />
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm border border-border">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Calendar className="size-4 text-primary" />
              工作记录
            </CardTitle>
            <SaveStatusIndicator status={saveStatus} lastSaved={lastSaved} />
          </CardHeader>
          <CardContent className="space-y-4">
            {!record && !hasContent && (
              <div className="text-center py-8">
                <Calendar className="size-10 text-primary/40 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm mb-3">
                  {formatDateLabel(currentDate)}暂无工作记录
                </p>
                <Button variant="outline" size="sm" onClick={() => {
                  const ta = document.querySelector('textarea');
                  ta?.focus();
                }}>
                  <Calendar className="size-3.5 mr-1.5" />
                  创建该日期记录
                </Button>
              </div>
            )}
            <Textarea
              value={inputContent}
              placeholder={'今天完成了什么？\n遇到了什么问题？\n明天有什么想法？\n\n直接写下来，之后AI会帮你整理成工作日报。'}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInputContent(e.target.value)}
              className="min-h-[280px] resize-none text-base leading-relaxed"
            />
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                每5秒自动保存，也可以手动点击保存
              </div>
              <Button
                onClick={handleSave}
                disabled={manualSaving || !hasContent}
              >
                {saveSuccess ? (
                  <>
                    <CheckCircle2 className="size-4 mr-2" />
                    已保存
                  </>
                ) : (
                  <>
                    <Save className="size-4 mr-2" />
                    {manualSaving ? '保存中...' : '保存'}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export { WorkTodayPage };
export default WorkTodayPage;
