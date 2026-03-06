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

      // [추가] 초기 세팅 시(데이터가 이번달 1개일 때) 과거 달(1월, 2월) 더미 데이터 주입
      // 월이 3월(getMonth() === 2) 이상일 때만 2달 전까지의 복제본을 생성
      if (newRecords.length === 1 && today.getMonth() >= 2) {
         const dummyRecords: MonthlyRecord[] = [];
         for (let i = 2; i >= 1; i--) {
            const pastDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const pastMonthStr = `${pastDate.getFullYear()}-${String(pastDate.getMonth() + 1).padStart(2, '0')}`;
            
            // 약간의 변동성/원금 수준으로 더미 자산 산출 (여기서는 동일하게 복제 후 자산만 약간 낮춤)
            const dummyAsset = totalCurrentValue * (1 - (0.01 * i)); // 한 달 전은 -1%, 두 달 전은 -2%
            
            dummyRecords.push({
               month: pastMonthStr,
               totalAsset: dummyAsset,
               snapshot: portfolio
            });
         }
         // 과거 데이터가 앞에 오도록 기존 데이터 앞에 병합
         const mergedRecords = [...dummyRecords, ...newRecords];
         localStorage.setItem(LS_MONTHLY_RECORDS_KEY, JSON.stringify(mergedRecords));
         return mergedRecords;
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
