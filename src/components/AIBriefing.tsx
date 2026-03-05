'use client';

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, Sparkles, RefreshCw } from 'lucide-react';
import { RebalanceResult } from '@/lib/calculator';

interface AIBriefingProps {
  rebalancedItems: RebalanceResult[];
}

export default function AIBriefing({ rebalancedItems }: AIBriefingProps) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<Date | null>(null);

  // 캐싱: 마지막으로 API를 호출했던 포트폴리오 데이터를 저장
  // 동일한 포트폴리오로 다시 누르면 기존 결과를 재사용하여 API 토큰 절약
  const cachedPortfolioKey = useRef<string | null>(null);

  const getPortfolioKey = () =>
    JSON.stringify(
      rebalancedItems.map(i => `${i.ticker}:${i.currentWeight.toFixed(4)}:${i.targetWeight.toFixed(4)}`)
    );

  const fetchInsight = async (forceRefresh = false) => {
    if (rebalancedItems.length === 0) {
      setError('포트폴리오에 자산이 없습니다.');
      return;
    }

    const currentKey = getPortfolioKey();

    // 캐시 히트: 포트폴리오가 변경되지 않았고 강제 새로고침이 아니면 기존 결과 사용
    if (!forceRefresh && cachedPortfolioKey.current === currentKey && insight) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolio: rebalancedItems })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'AI 분석을 가져오는데 실패했습니다.');
      }

      setInsight(data.insight);
      cachedPortfolioKey.current = currentKey;
      setLastAnalyzedAt(new Date());
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('알 수 없는 에러가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 포트폴리오가 변경되었는지 여부 (캐시 무효화 체크)
  const isPortfolioChanged =
    insight !== null && cachedPortfolioKey.current !== getPortfolioKey();

  return (
    <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 mt-8">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Bot className="text-blue-500" />
            AI 포트폴리오 인사이트 브리핑
          </CardTitle>
          <CardDescription className="text-zinc-400 mt-1 text-xs">
            Gemini Pro 기반 · 리스크 점검 · 자산 배분 제언
            {lastAnalyzedAt && (
              <span className="ml-2 text-zinc-600">
                (마지막 분석: {lastAnalyzedAt.toLocaleTimeString('ko-KR')})
              </span>
            )}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {/* 포트폴리오가 변경되었을 때만 재분석 버튼 활성화 */}
          {insight && (
            <Button
              onClick={() => fetchInsight(true)}
              disabled={loading}
              variant="outline"
              className="border-zinc-700 text-zinc-400 hover:text-white flex gap-1 text-xs h-8"
              title="포트폴리오가 변경되었습니다. 재분석하려면 클릭하세요."
            >
              <RefreshCw size={12} className={loading && isPortfolioChanged ? 'animate-spin' : ''} />
              {isPortfolioChanged ? '포트폴리오 변경됨 · 재분석' : '재분석'}
            </Button>
          )}
          <Button
            onClick={() => fetchInsight(false)}
            disabled={loading || rebalancedItems.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white flex gap-2"
          >
            <Sparkles size={16} />
            {loading ? '분석 생성 중...' : '브리핑 시작'}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-md mt-4 text-sm">
            {error}
          </div>
        )}

        <div className="mt-4 p-6 bg-zinc-950/50 rounded-lg min-h-[150px] border border-zinc-800 text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-3 py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p>Gemini Pro가 포트폴리오 전반의 리스크와 자산 배분을 심층 분석하고 있습니다...</p>
            </div>
          ) : insight ? (
            <div>{insight}</div>
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-500 py-10">
              우측 상단의 &quot;브리핑 시작&quot; 버튼을 눌러 AI 분석을 받아보세요.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
