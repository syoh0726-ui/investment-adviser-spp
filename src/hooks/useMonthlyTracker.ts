import { useState, useEffect } from 'react';
import { PortfolioItem } from '@/lib/calculator';

export type MonthlyRecord = {
  month: string; // "YYYY-MM"
  totalAsset: number;
  snapshot: PortfolioItem[];
};

const LS_MONTHLY_RECORDS_KEY = 'spp_monthly_records';

export function useMonthlyTracker(portfolio: PortfolioItem[], totalCurrentValue: number) {
  const [records, setRecords] = useState<MonthlyRecord[]>([]);

  // 1. 초기 마운트 시 로컬스토리지 기록 로드
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(LS_MONTHLY_RECORDS_KEY);
      if (raw) {
        try {
          setRecords(JSON.parse(raw));
        } catch {
          console.warn('Failed to parse monthly records');
        }
      }
    }
  }, []);

  // 2. 포트폴리오가 변경되거나 총 자산이 바뀔 때 기록 갱신 (이번 달 기준)
  useEffect(() => {
    if (portfolio.length === 0 || totalCurrentValue === 0) return;

    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    setRecords((prev) => {
      const newRecords = [...prev];
      const existingIndex = newRecords.findIndex((r) => r.month === currentMonth);
      
      const newRecord: MonthlyRecord = {
        month: currentMonth,
        totalAsset: totalCurrentValue,
        snapshot: portfolio,
      };

      if (existingIndex >= 0) {
        // 이미 갱신된 달이면 최신 자산액으로 덮어쓰기
        newRecords[existingIndex] = newRecord;
      } else {
        // 처음 기록되는 달이면 새로운 month로 추가
        newRecords.push(newRecord);
      }

      // 로컬 스토리지에 자동 저장
      localStorage.setItem(LS_MONTHLY_RECORDS_KEY, JSON.stringify(newRecords));
      return newRecords;
    });
  }, [portfolio, totalCurrentValue]);

  // 기록 전체 초기화 (Reset)
  const clearRecords = () => {
    localStorage.removeItem(LS_MONTHLY_RECORDS_KEY);
    setRecords([]);
  };

  return { records, clearRecords };
}
