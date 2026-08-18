import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MessageSquareText,
  Sparkles,
  Lightbulb,
  AlertTriangle,
  TrendingUp,
  MessageCircle,
} from 'lucide-react';

import { Button } from '@client/src/components/ui/button';
import { Card, CardContent } from '@client/src/components/ui/card';
import { analyzeChat } from '@client/src/api/chat-analysis';
import type { ChatAnalysisResult } from '@shared/api.interface';

const MIN_CHAT_LENGTH = 10;

function getProbabilityLevel(prob: number): { label: string; color: string } {
  if (prob >= 70) return { label: '高意向', color: 'text-emerald-600' };
  if (prob >= 40) return { label: '中意向', color: 'text-amber-600' };
  return { label: '低意向', color: 'text-rose-600' };
}

function AnimatedNumber({
  target,
  duration = 1200,
}: {
  target: number;
  duration?: number;
}) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    setValue(0);
    startTimeRef.current = null;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const step = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target, duration]);

  return <span className="tabular-nums">{value}</span>;
}

function DealProbabilityRing({ probability }: { probability: number }) {
  const size = 160;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const [dashOffset, setDashOffset] = useState(circumference);

  useEffect(() => {
    // start from full (empty ring) then animate
    setDashOffset(circumference);
    const timer = window.setTimeout(() => {
      const offset = circumference - (probability / 100) * circumference;
      setDashOffset(offset);
    }, 50);
    return () => window.clearTimeout(timer);
  }, [probability, circumference]);

  const level = getProbabilityLevel(probability);

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          viewBox={`0 0 ${size} ${size}`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="hsl(220, 13%, 91%)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="hsl(217, 78%, 51%)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{
              transition: 'stroke-dashoffset 1.2s cubic-bezier(0.33, 1, 0.68, 1)',
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-foreground tabular-nums leading-none">
            <AnimatedNumber target={probability} />
            <span className="text-xl ml-0.5">%</span>
          </span>
        </div>
      </div>
      <div className={`mt-3 text-sm font-medium ${level.color}`}>
        {level.label}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-card rounded-lg p-6 shadow-sm border border-border">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-lg bg-accent animate-pulse" />
        <div className="h-5 w-28 bg-accent rounded animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full bg-accent/70 rounded animate-pulse" />
        <div className="h-4 w-4/5 bg-accent/70 rounded animate-pulse" />
        <div className="h-4 w-3/5 bg-accent/70 rounded animate-pulse" />
      </div>
    </div>
  );
}

const ChatAnalysisPage = () => {
  const [chatText, setChatText] = useState('');
  const [result, setResult] = useState<ChatAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleCards, setVisibleCards] = useState(0);

  const charCount = chatText.length;
  const canSubmit = chatText.trim().length >= MIN_CHAT_LENGTH && !isLoading;

  const handleAnalyze = useCallback(async () => {
    if (!canSubmit) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    setVisibleCards(0);

    try {
      const data = await analyzeChat({ chatText: chatText.trim() });
      setResult(data);
      // stagger card reveal
      for (let i = 1; i <= 4; i += 1) {
        window.setTimeout(() => {
          setVisibleCards(i);
        }, i * 120);
      }
    } catch (err) {
      setError('分析失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  }, [canSubmit, chatText]);

  const handleClear = useCallback(() => {
    setChatText('');
    setResult(null);
    setError(null);
    setVisibleCards(0);
  }, []);

  const cardBaseClass =
    'bg-card rounded-lg p-6 shadow-sm border border-border transition-all duration-500';
  const cardHiddenClass = 'opacity-0 translate-y-4';
  const cardVisibleClass = 'opacity-100 translate-y-0';

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">聊天分析</h1>
        <p className="text-muted-foreground mt-1">
          粘贴客户聊天内容，AI 自动分析客户真实需求、顾虑和成交概率
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 左侧输入区 */}
        <div className="lg:col-span-2">
          <div className="sticky top-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-foreground mb-4">聊天内容</h3>
                <textarea
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  className="w-full min-h-[400px] p-4 rounded-lg border border-input bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none text-sm leading-relaxed"
                  placeholder="粘贴客户聊天内容..."
                />
                <div className="flex items-center justify-between mt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                    disabled={isLoading}
                  >
                    清空
                  </Button>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {charCount} 字
                    </span>
                    <Button onClick={handleAnalyze} disabled={!canSubmit}>
                      {isLoading ? (
                        <>
                          <svg
                            className="animate-spin size-4"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                            />
                          </svg>
                          分析中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="size-4" />
                          开始分析
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 右侧结果区 */}
        <div className="lg:col-span-3">
          {error && (
            <div className="mb-4 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : result ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 客户真实需求 */}
              <div
                className={`${cardBaseClass} ${
                  visibleCards >= 1 ? cardVisibleClass : cardHiddenClass
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Lightbulb className="size-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">客户真实需求</h3>
                </div>
                <ul className="space-y-2">
                  {result.needs.map((need: string, idx: number) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm text-foreground/90"
                    >
                      <span className="mt-1.5 size-1.5 rounded-full bg-primary shrink-0" />
                      <span className="leading-relaxed">{need}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 客户顾虑 */}
              <div
                className={`${cardBaseClass} ${
                  visibleCards >= 2 ? cardVisibleClass : cardHiddenClass
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <AlertTriangle className="size-5 text-amber-600" />
                  </div>
                  <h3 className="font-semibold text-foreground">客户顾虑</h3>
                </div>
                <ul className="space-y-2">
                  {result.concerns.map((concern: string, idx: number) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm text-foreground/90"
                    >
                      <AlertTriangle className="mt-0.5 size-4 text-amber-500 shrink-0" />
                      <span className="leading-relaxed">{concern}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 成交概率 */}
              <div
                className={`rounded-lg p-6 shadow-sm border border-border bg-gradient-to-br from-primary/5 to-primary/10 transition-all duration-500 ${
                  visibleCards >= 3 ? cardVisibleClass : cardHiddenClass
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <TrendingUp className="size-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">成交概率</h3>
                </div>
                <DealProbabilityRing probability={result.dealProbability} />
              </div>

              {/* 下一句话建议 */}
              <div
                className={`${cardBaseClass} ${
                  visibleCards >= 4 ? cardVisibleClass : cardHiddenClass
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MessageCircle className="size-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">下一句话建议</h3>
                </div>
                <div className="border-l-4 border-primary bg-primary/5 rounded-r-lg p-4 italic text-sm text-foreground/90 leading-relaxed">
                  {result.nextReply}
                </div>
              </div>
            </div>
          ) : (
            // 空状态
            <div className="bg-card rounded-lg p-10 shadow-sm border border-border">
              <div className="text-center mb-8">
                <div className="aspect-square size-16 rounded-full bg-accent flex items-center justify-center mx-auto mb-4">
                  <MessageSquareText className="size-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  粘贴聊天内容，一键分析客户意向
                </h3>
                <p className="text-muted-foreground mt-2 max-w-sm mx-auto text-sm">
                  从四个维度深度解读客户真实想法，帮你精准把握沟通节奏
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { icon: Lightbulb, title: '客户真实需求', text: '挖掘客户潜在需求与购买动机' },
                  { icon: AlertTriangle, title: '客户顾虑', text: '识别客户犹豫点与决策障碍' },
                  { icon: TrendingUp, title: '成交概率', text: '量化评估当前成交可能性' },
                  { icon: MessageCircle, title: '下一句话建议', text: 'AI 生成最优回复话术' },
                ].map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-4 rounded-lg bg-background/60 opacity-60"
                    >
                      <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
                        <Icon className="size-4 text-muted-foreground" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-foreground/70">
                          {item.title}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.text}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatAnalysisPage;
