'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RebalanceResult } from '@/lib/calculator';

interface WeightChartProps {
  rebalancedItems: RebalanceResult[];
}

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
];

// ✅ 컴포넌트 함수 외부에 선언해야 렌더링 시 재생성되지 않음
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-800 p-3 border border-zinc-700 rounded-md shadow-lg text-sm text-white">
        <p className="font-bold">{payload[0].name}</p>
        <p className="text-zinc-300">{`비중: ${payload[0].value}%`}</p>
      </div>
    );
  }
  return null;
};

// 도넛 차트 아래 색상 사각형 + 이름 + 비율(%) 커스텀 범례
const ColorLegend = ({ data }: { data: { name: string; value: number }[] }) => (
  <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2 px-2">
    {data.map((entry, index) => (
      <div key={entry.name} className="flex items-center gap-1 text-xs text-zinc-300">
        <span
          className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
          style={{ backgroundColor: COLORS[index % COLORS.length] }}
        />
        <span>{entry.name}: <span className="font-semibold text-white">{entry.value}%</span></span>
      </div>
    ))}
  </div>
);

export default function WeightChart({ rebalancedItems }: WeightChartProps) {
  const currentData = rebalancedItems.filter(item => item.currentWeight > 0).map(item => ({
    name: item.ticker,
    value: Number((item.currentWeight * 100).toFixed(2))
  }));

  const targetData = rebalancedItems.filter(item => item.targetWeight > 0).map(item => ({
    name: item.ticker,
    value: Number((item.targetWeight * 100).toFixed(2))
  }));

  return (
    <Card className="bg-zinc-900 border-zinc-800 text-zinc-100 flex-1 h-full">
      <CardHeader>
        <CardTitle className="text-xl font-bold">포트폴리오 비중 비교</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col md:flex-row h-full pb-6">
        
        {/* 현재 비중 차트 */}
        <div className="flex-1 flex flex-col">
          <h3 className="text-zinc-400 font-semibold mb-2 text-center">현재 비중</h3>
          {currentData.length > 0 ? (
            <>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={currentData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={2} dataKey="value">
                      {currentData.map((_, index) => (
                        <Cell key={`cell-current-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ColorLegend data={currentData} />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">보유 데이터 없음</div>
          )}
        </div>

        {/* 목표 비중 차트 */}
        <div className="flex-1 flex flex-col">
          <h3 className="text-blue-400 font-semibold mb-2 text-center">목표 비중</h3>
          {targetData.length > 0 ? (
            <>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={targetData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={2} dataKey="value">
                      {targetData.map((_, index) => (
                        <Cell key={`cell-target-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ColorLegend data={targetData} />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">목표 데이터 없음</div>
          )}
        </div>

      </CardContent>
    </Card>
  );
}
