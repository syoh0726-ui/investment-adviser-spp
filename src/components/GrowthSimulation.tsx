'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';

// localStorage 키
const LS_RETURN_KEY = 'spp_annual_return';
const LS_YEARS_KEY  = 'spp_sim_years';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RefreshCw } from 'lucide-react';

// ✅ 컴포넌트 외부에 선언하여 렌더링 시 재생성 방지
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label, currency, exchangeRate }: any) => {
  if (active && payload && payload.length) {
    const rate = currency === 'KRW' && exchangeRate ? exchangeRate : 1;
    const suffix = currency === 'KRW' ? '억원' : '';
    const format = (v: number) =>
      currency === 'KRW'
        ? `${((v * rate) / 1_0000_0000).toFixed(2)}억원`
        : `$${v.toLocaleString()}`;
    return (
      <div className="bg-zinc-800 p-3 border border-zinc-700 rounded-md shadow-lg text-sm text-white">
        <p className="font-bold mb-1">{label}</p>
        <p className="text-emerald-400">{`예상 총액: ${format(payload[0].value)}`}</p>
        <p className="text-zinc-400">{`원금 누적: ${format(payload[1].value)}`}</p>
        {suffix && <p className="text-zinc-600 text-xs mt-1">(환율 기준 대략값)</p>}
      </div>
    );
  }
  return null;
};

interface GrowthSimulationProps {
  initialAmount: number;
  monthlyInvestment: number;
}

export default function GrowthSimulation({ initialAmount, monthlyInvestment }: GrowthSimulationProps) {
  // localStorage에서 마지막으로 입력한 수익률/기간 복원 (없으면 기본값)
  const [annualReturnPct, setAnnualReturnPct] = useState(() => {
    if (typeof window === 'undefined') return 7;
    return Number(localStorage.getItem(LS_RETURN_KEY) ?? 7);
  });
  const [years, setYears] = useState(() => {
    if (typeof window === 'undefined') return 20;
    return Number(localStorage.getItem(LS_YEARS_KEY) ?? 20);
  });

  // 값이 변경될 때마다 자동 저장
  useEffect(() => {
    localStorage.setItem(LS_RETURN_KEY, String(annualReturnPct));
  }, [annualReturnPct]);

  useEffect(() => {
    localStorage.setItem(LS_YEARS_KEY, String(years));
  }, [years]);

  // 통화 표시 상태
  type Currency = 'USD' | 'KRW';
  const [currency, setCurrency] = useState<Currency>('USD');
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [rateLoading, setRateLoading] = useState(false);

  const expectedAnnualReturn = annualReturnPct / 100;

  // 환율 조회
  const fetchExchangeRate = useCallback(async () => {
    setRateLoading(true);
    try {
      const res = await fetch('/api/finance?ticker=KRW=X');
      if (res.ok) {
        const data = await res.json();
        setExchangeRate(data.price);
      } else {
        setExchangeRate(1350);
      }
    } catch {
      setExchangeRate(1350);
    } finally {
      setRateLoading(false);
    }
  }, []);

  const handleCurrencyToggle = async (next: Currency) => {
    setCurrency(next);
    if (next === 'KRW' && !exchangeRate) {
      await fetchExchangeRate();
    }
  };

  const data = useMemo(() => {
    const result = [];
    const monthlyReturn = expectedAnnualReturn / 12;
    let currentBalance = initialAmount;
    let totalInvested = initialAmount;

    result.push({ year: '현재', balance: Math.round(currentBalance), invested: Math.round(totalInvested) });

    for (let i = 1; i <= years; i++) {
      for (let month = 1; month <= 12; month++) {
        currentBalance = currentBalance * (1 + monthlyReturn) + monthlyInvestment;
        totalInvested += monthlyInvestment;
      }
      result.push({ year: `${i}년`, balance: Math.round(currentBalance), invested: Math.round(totalInvested) });
    }
    return result;
  }, [initialAmount, monthlyInvestment, years, expectedAnnualReturn]);

  // 환율 적용한 금액 포맷 함수
  const formatValue = (usd: number) => {
    if (currency === 'KRW' && exchangeRate) {
      const krw = usd * exchangeRate;
      if (krw >= 1_0000_0000) return `${(krw / 1_0000_0000).toFixed(1)}억`;
      if (krw >= 10_000) return `${(krw / 10_000).toFixed(0)}만`;
      return `${krw.toLocaleString()}원`;
    }
    // USD 표시
    if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
    if (usd >= 1_000)     return `$${(usd / 1_000).toFixed(0)}K`;
    return `$${usd.toLocaleString()}`;
  };

  const finalBalance = data[data.length - 1]?.balance ?? 0;

  return (
    <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 flex-1 h-full">
      <CardHeader>
        <CardTitle className="text-xl font-bold">자산 성장 시뮬레이션</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* 파라미터 입력 영역 */}
        <div className="flex gap-4 flex-wrap items-end">
          <div className="flex flex-col gap-1">
            <Label className="text-zinc-400 text-xs">예상 연 수익률</Label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={annualReturnPct}
                onChange={(e) => setAnnualReturnPct(Math.max(0, Math.min(100, Number(e.target.value))))}
                className="w-20 h-8 bg-zinc-800 border-zinc-700 text-white text-sm"
                min={0} max={100} step={0.5}
              />
              <span className="text-zinc-400 text-sm">%</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-zinc-400 text-xs">기간</Label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={years}
                onChange={(e) => setYears(Math.max(1, Math.min(30, Number(e.target.value))))}
                className="w-20 h-8 bg-zinc-800 border-zinc-700 text-white text-sm"
                min={1} max={30}
              />
              <span className="text-zinc-400 text-sm">년</span>
            </div>
          </div>

          {/* USD / KRW 토글 */}
          <div className="flex flex-col gap-1">
            <Label className="text-zinc-400 text-xs">표시 통화</Label>
            <div className="flex items-center gap-1">
              <div className="flex rounded-md border border-zinc-700 overflow-hidden">
                <button
                  onClick={() => handleCurrencyToggle('USD')}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${currency === 'USD' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}
                >
                  $ USD
                </button>
                <button
                  onClick={() => handleCurrencyToggle('KRW')}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${currency === 'KRW' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}
                >
                  ₩ KRW
                </button>
              </div>
              {/* 환율 새로고침 */}
              {currency === 'KRW' && (
                <button
                  onClick={fetchExchangeRate}
                  disabled={rateLoading}
                  title="환율 새로고침"
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <RefreshCw size={13} className={rateLoading ? 'animate-spin' : ''} />
                </button>
              )}
            </div>
            {/* 환율 표시 */}
            {currency === 'KRW' && exchangeRate && (
              <span className="text-xs text-zinc-600">
                1 USD = {exchangeRate.toLocaleString('ko-KR')}₩
              </span>
            )}
          </div>

          {/* 최종 예상 금액 요약 */}
          <div className="flex flex-col gap-0.5 ml-auto text-right">
            <span className="text-zinc-400 text-xs">{years}년 후 예상 총액</span>
            <span className="text-emerald-400 font-bold text-lg">
              {formatValue(finalBalance)}
            </span>
          </div>
        </div>

        {/* 라인 차트 */}
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
              <XAxis
                dataKey="year"
                stroke="#a1a1aa"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                interval={years <= 10 ? 0 : years <= 20 ? 4 : 9}
              />
              <YAxis
                stroke="#a1a1aa"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatValue}
                width={currency === 'KRW' ? 70 : 60}
              />
              <Tooltip content={<CustomTooltip currency={currency} exchangeRate={exchangeRate} />} />
              <Line type="monotone" dataKey="balance" name="예상 총액" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="invested" name="원금 누적" stroke="#71717a" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

      </CardContent>
    </Card>
  );
}
