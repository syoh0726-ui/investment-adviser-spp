'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PortfolioTable from '@/components/PortfolioTable';
import WeightChart from '@/components/WeightChart';
import GrowthSimulation from '@/components/GrowthSimulation';
import AIBriefing from '@/components/AIBriefing';
import { PortfolioItem, calculateRebalance } from '@/lib/calculator';
import { fetchPortfolio } from '@/lib/portfolioService';
import { Button } from '@/components/ui/button';
import { RotateCcw, Download, Save } from 'lucide-react';

// localStorage 키
const LS_PORTFOLIO_KEY = 'spp_portfolio';
const LS_MONTHLY_KEY   = 'spp_monthly_investment';

// localStorage에서 포트폴리오를 불러오는 헬퍼
function loadFromLocalStorage(): PortfolioItem[] | null {
  try {
    const raw = localStorage.getItem(LS_PORTFOLIO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// localStorage에 포트폴리오를 저장하는 헬퍼
function saveToLocalStorage(portfolio: PortfolioItem[], monthly: number) {
  try {
    localStorage.setItem(LS_PORTFOLIO_KEY, JSON.stringify(portfolio));
    localStorage.setItem(LS_MONTHLY_KEY, String(monthly));
  } catch {
    console.warn('[localStorage 저장 실패]');
  }
}

export default function Dashboard() {
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [monthlyInvestment, setMonthlyInvestment] = useState<number>(1000);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // ------------------------------------
  // 초기 로드: localStorage → Supabase 순서로 시도
  // ------------------------------------
  useEffect(() => {
    const loadData = async () => {
      // 1) localStorage에 저장된 데이터가 있으면 우선 사용 (빠른 복원)
      const localData = loadFromLocalStorage();
      if (localData && localData.length > 0) {
        const savedMonthly = localStorage.getItem(LS_MONTHLY_KEY);
        if (savedMonthly) setMonthlyInvestment(Number(savedMonthly));

        // 주가 재조회 (저장된 가격은 구식일 수 있으므로)
        const refreshed = await Promise.all(
          localData.map(async (item) => {
            if (item.ticker === 'CASH') return item; // CASH는 항상 $1
            try {
              const res = await fetch(`/api/finance?ticker=${item.ticker}`);
              if (res.ok) {
                const data = await res.json();
                return { ...item, currentPrice: data.price };
              }
            } catch {
              // 실패하면 저장된 가격 그대로 사용
            }
            return item;
          })
        );
        setPortfolio(refreshed);
        setIsLoading(false);
        return; // localStorage 복원 성공 시 Supabase 호출 생략
      }

      // 2) localStorage에 없으면 Supabase에서 로드 시도
      try {
        const dbItems = await fetchPortfolio();
        const updatedItems = await Promise.all(
          dbItems.map(async (item) => {
            try {
              const res = await fetch(`/api/finance?ticker=${item.ticker}`);
              if (res.ok) {
                const data = await res.json();
                return { ...item, currentPrice: data.price };
              }
            } catch {
              console.error(`Failed to fetch price for ${item.ticker}`);
            }
            return item;
          })
        );
        setPortfolio(updatedItems);
      } catch (error) {
        console.error('Failed to load portfolio from DB:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // ------------------------------------
  // 포트폴리오 변경 시 자동으로 localStorage에 저장
  // ------------------------------------
  useEffect(() => {
    if (isLoading || portfolio.length === 0) return; // 로딩 중 또는 빈 배열은 저장 안 함
    saveToLocalStorage(portfolio, monthlyInvestment);
    setLastSavedAt(new Date().toLocaleTimeString('ko-KR'));
  }, [portfolio, monthlyInvestment, isLoading]);

  // ------------------------------------
  // 초기화: localStorage 삭제 + 상태 리셋
  // ------------------------------------
  const handleReset = useCallback(() => {
    if (!confirm('포트폴리오를 초기화하시겠습니까? 저장된 데이터가 모두 삭제됩니다.')) return;
    localStorage.removeItem(LS_PORTFOLIO_KEY);
    localStorage.removeItem(LS_MONTHLY_KEY);
    setPortfolio([]);
    setMonthlyInvestment(1000);
    setLastSavedAt(null);
  }, []);

  // ------------------------------------
  // 마지막 저장 데이터 불러오기 (현재 포트폴리오를 리셋 후 복원)
  // ------------------------------------
  const handleLoadLast = useCallback(async () => {
    const localData = loadFromLocalStorage();
    if (!localData || localData.length === 0) {
      alert('저장된 포트폴리오 데이터가 없습니다.');
      return;
    }
    setIsLoading(true);
    const savedMonthly = localStorage.getItem(LS_MONTHLY_KEY);
    if (savedMonthly) setMonthlyInvestment(Number(savedMonthly));

    // 주가 재조회 후 복원
    const refreshed = await Promise.all(
      localData.map(async (item) => {
        if (item.ticker === 'CASH') return item;
        try {
          const res = await fetch(`/api/finance?ticker=${item.ticker}`);
          if (res.ok) {
            const data = await res.json();
            return { ...item, currentPrice: data.price };
          }
        } catch {
          /* 실패 시 저장된 가격 사용 */
        }
        return item;
      })
    );
    setPortfolio(refreshed);
    setIsLoading(false);
  }, []);

  const { rebalancedItems, totalCurrentValue } = calculateRebalance(portfolio, monthlyInvestment);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <header className="mb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">Smart Portfolio Planner</h1>
          <p className="text-zinc-400 mt-2">현재 자산 상태와 목표 비중을 확인하고 최적의 월 적립금 리밸런싱을 진행하세요.</p>
        </div>

        {/* 툴바: 마지막 저장 시각 + 불러오기/초기화 버튼 */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {lastSavedAt && (
            <span className="text-xs text-zinc-600 flex items-center gap-1">
              <Save size={12} />
              자동 저장: {lastSavedAt}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadLast}
            className="border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 flex gap-1"
            title="마지막으로 저장된 포트폴리오 데이터를 불러옵니다"
          >
            <Download size={14} />
            마지막 데이터 불러오기
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="border-rose-800 text-rose-400 hover:bg-rose-900/20 hover:text-rose-300 flex gap-1"
            title="포트폴리오를 초기화합니다 (확인 창이 표시됩니다)"
          >
            <RotateCcw size={14} />
            초기화
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto flex flex-col gap-8">
        <section>
          {isLoading ? (
            <div className="flex justify-center items-center h-64 border border-zinc-800 rounded-lg">
              <span className="text-zinc-500 animate-pulse">포트폴리오 데이터 불러오는 중...</span>
            </div>
          ) : (
            <PortfolioTable
              portfolio={portfolio}
              setPortfolio={setPortfolio}
              monthlyInvestment={monthlyInvestment}
              setMonthlyInvestment={setMonthlyInvestment}
            />
          )}
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <WeightChart rebalancedItems={rebalancedItems} />
          <GrowthSimulation
            initialAmount={totalCurrentValue}
            monthlyInvestment={monthlyInvestment}
          />
        </section>

        <section>
          <AIBriefing rebalancedItems={rebalancedItems} />
        </section>
      </main>
    </div>
  );
}
