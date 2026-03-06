'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MonthlyRecord } from '@/hooks/useMonthlyTracker';

interface MonthlyProgressChartProps {
  records: MonthlyRecord[];
  monthlyInvestment: number;
}

const LS_RETURN_KEY = 'spp_annual_return';

// [추가] 과거 월별 고정 환율표 (실제 종가와 유사한 임의의 예시값)
const HISTORICAL_EXCHANGE_RATES: Record<string, number> = {
  '2024-01': 1334.0,
  '2024-02': 1331.5,
};

export default function MonthlyProgressChart({ records, monthlyInvestment }: MonthlyProgressChartProps) {
  const [annualReturnPct, setAnnualReturnPct] = useState(7);
  const [currency, setCurrency] = useState<'USD' | 'KRW'>('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(1400);

  // GrowthSimulation 컴포넌트에서 변경되는 수익률(localStorage) 실시간 동기화
  useEffect(() => {
    const syncReturn = () => {
       const stored = localStorage.getItem(LS_RETURN_KEY);
       if (stored) setAnnualReturnPct(Number(stored));
    };
    syncReturn();
    const interval = setInterval(syncReturn, 2000);
    return () => clearInterval(interval);
  }, []);

  // 환율 조회 (최신)
  useEffect(() => {
    fetch('/api/finance?ticker=KRW=X')
      .then((res) => res.json())
      .then((data) => {
        if (data.price) setExchangeRate(data.price);
      })
      .catch((err) => console.error('Failed to fetch exchange rate', err));
  }, []);

  // 차트 데이터 계산
  const chartData = useMemo(() => {
    if (!records || records.length === 0) return [];

    const monthlyRate = annualReturnPct / 100 / 12;
    const firstRecord = records[0];
    const startDate = new Date(firstRecord.month + '-01');

    return records.map((record) => {
      const currentDate = new Date(record.month + '-01');
      // 시작된 달(0개월차)부터 현재 데이터 달까지의 차이 개월 수
      const monthsDiff =
        (currentDate.getFullYear() - startDate.getFullYear()) * 12 +
        (currentDate.getMonth() - startDate.getMonth());

      // 첫 자산을 기준으로 시뮬레이션 되는 기대 자산 복리 계산
      let expectedAsset = firstRecord.totalAsset;
      if (monthsDiff > 0) {
        expectedAsset = expectedAsset * Math.pow(1 + monthlyRate, monthsDiff);
        if (monthlyRate > 0) {
          expectedAsset +=
            monthlyInvestment *
            ((Math.pow(1 + monthlyRate, monthsDiff) - 1) / monthlyRate) *
            (1 + monthlyRate);
        } else {
          expectedAsset += monthlyInvestment * monthsDiff;
        }
      }

      // [수정] 차트에 찍히는 달이 '현재 달'이면 실시간 환율을, '과거 달'이면 고정 환율 매핑표를 사용
      let rate = 1;
      if (currency === 'KRW') {
         const isCurrentMonth =
            currentDate.getFullYear() === new Date().getFullYear() &&
            currentDate.getMonth() === new Date().getMonth();
         
         if (isCurrentMonth) {
            rate = exchangeRate;
         } else {
            // 과거 달의 고정 환율표에 데이터가 없을 경우 그냥 실시간 환율 또는 1330원 기본값 폴백 적용
            rate = HISTORICAL_EXCHANGE_RATES[record.month] || exchangeRate || 1330;
         }
      }
      
      return {
        month: record.month,
        actual: record.totalAsset * rate,
        expected: expectedAsset * rate,
      };
    });
  }, [records, annualReturnPct, monthlyInvestment, currency, exchangeRate]);

  const formatCurrency = (value: number) => {
    if (currency === 'KRW') {
      return `₩${Math.round(value).toLocaleString()}`;
    }
    return `$${Math.round(value).toLocaleString()}`;
  };

  if (!records || records.length === 0) return null;

  return (
    <Card className="bg-zinc-900 border-zinc-800 text-white mt-8">
      <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-xl">월별 누적 성과 추적 (Monthly Tracker)</CardTitle>
          <CardDescription className="text-zinc-400">
            초기 시작점 대비 실제 자산 성장과 시뮬레이션(기대 수익 {annualReturnPct}%) 예측치 비교
          </CardDescription>
        </div>
        <div className="flex gap-2 mt-4 md:mt-0">
          <button
            onClick={() => setCurrency('USD')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              currency === 'USD' ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            $ USD
          </button>
          <button
            onClick={() => setCurrency('KRW')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              currency === 'KRW' ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            ₩ KRW
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length < 2 ? (
            <div className="h-[300px] flex items-center justify-center text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-md">
                과거 월별 기록이 최소 2달 이상 누적되어야 의미 있는 성장 곡선이 그려집니다.<br/>
                현재 등록된 달: {chartData[0]?.month}
            </div>
        ) : (
            <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                       <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="month" stroke="#71717a" fontSize={12} tickMargin={10} />
                <YAxis
                    stroke="#71717a"
                    fontSize={12}
                    tickFormatter={(val) => {
                      if (val >= 10000 && currency === 'KRW') return `₩${(val / 10000).toLocaleString()}만`;
                      if (val >= 1000) return `${currency === 'USD' ? '$' : ''}${(val / 1000).toLocaleString()}k`;
                      return String(val);
                    }}
                    width={80}
                />
                <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value: any, name: any) => [
                      formatCurrency(Number(value)),
                      name === 'actual' ? '실제 누적 자산' : `기대 시뮬레이션 (${annualReturnPct}%)`
                    ]}
                    labelStyle={{ color: '#a1a1aa', marginBottom: '8px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Area
                    type="monotone"
                    dataKey="expected"
                    name="기대 시뮬레이션"
                    stroke="#a855f7"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fill="transparent"
                />
                <Area
                    type="monotone"
                    dataKey="actual"
                    name="실제 누적 자산"
                    stroke="#10b981"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorActual)"
                />
                </AreaChart>
            </ResponsiveContainer>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
