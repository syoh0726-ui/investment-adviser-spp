'use client';

import React, { useState } from 'react';
import { calculateRebalance, PortfolioItem } from '@/lib/calculator';
import { addStockToDB, updateStockInDB, removeStockFromDB } from '@/lib/portfolioService';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, TrendingUp, TrendingDown, Banknote, RefreshCw } from 'lucide-react';

// CASH는 가격이 항상 $1인 특수 종목으로 처리 (별도 API 조회 불필요)
const CASH_TICKER = 'CASH';

export default function PortfolioTable({
  portfolio,
  setPortfolio,
  monthlyInvestment,
  setMonthlyInvestment
}: {
  portfolio: PortfolioItem[];
  setPortfolio: React.Dispatch<React.SetStateAction<PortfolioItem[]>>;
  monthlyInvestment: number;
  setMonthlyInvestment: React.Dispatch<React.SetStateAction<number>>;
}) {
  const [newTicker, setNewTicker] = useState('');
  const [loading, setLoading] = useState(false);

  // ---------------------
  // 환율 상태 관리 (USD ↔ KRW 토글)
  // ---------------------
  type Currency = 'USD' | 'KRW';
  const [currency, setCurrency] = useState<Currency>('USD');
  // 원화로 표시되는 입력값 (원화 모드에서만 사용)
  const [krwInput, setKrwInput] = useState<number>(0);
  // 현재 USD/KRW 환율 (1 USD = N 원)
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [rateLoading, setRateLoading] = useState(false);

  // 환율 조회: yahoo-finance2의 KRW=X 티커 활용
  const fetchExchangeRate = async () => {
    setRateLoading(true);
    try {
      const res = await fetch('/api/finance?ticker=KRW=X');
      if (res.ok) {
        const data = await res.json();
        setExchangeRate(data.price); // 1 USD = data.price KRW
      } else {
        // 조회 실패 시 기본 환율 사용
        setExchangeRate(1350);
      }
    } catch {
      setExchangeRate(1350);
    } finally {
      setRateLoading(false);
    }
  };

  // 통화 모드 전환 시 환율 조회
  const handleCurrencyToggle = async (next: Currency) => {
    setCurrency(next);
    if (next === 'KRW' && !exchangeRate) {
      await fetchExchangeRate();
    }
    if (next === 'KRW' && exchangeRate) {
      // USD → KRW 변환하여 입력란에 표시
      setKrwInput(Math.round(monthlyInvestment * exchangeRate));
    }
    if (next === 'USD') {
      // KRW 입력값이 있으면 USD로 변환
      if (exchangeRate && krwInput > 0) {
        setMonthlyInvestment(Math.round(krwInput / exchangeRate));
      }
    }
  };

  // 원화 입력값 변경 시 USD로 환산하여 monthlyInvestment 업데이트
  const handleKrwInputChange = (krw: number) => {
    setKrwInput(krw);
    if (exchangeRate && exchangeRate > 0) {
      setMonthlyInvestment(Math.round(krw / exchangeRate));
    }
  };

  const { rebalancedItems, totalCurrentValue, totalTargetValue } = calculateRebalance(
    portfolio,
    monthlyInvestment
  );

  const handleAddTicker = async () => {
    if (!newTicker.trim()) return;

    setLoading(true);
    try {
      // ---------------------
      // 1단계: 주가 조회 (서버사이드 API Route를 통해 yahoo-finance2 호출)
      // ---------------------
      const tickerUpper = newTicker.trim().toUpperCase();
      const res = await fetch(`/api/finance?ticker=${tickerUpper}`);
      
      if (!res.ok) {
        // 서버에서 500이나 404 반환 시 → 티커명 오류 안내
        const body = await res.json().catch(() => ({}));
        throw new Error(body.details || body.error || `API Error ${res.status}`);
      }
      
      const data = await res.json();
      
      // 이미 포트폴리오에 있는 종목인지 확인
      if (portfolio.some(item => item.ticker === data.ticker)) {
        alert('이미 추가된 종목입니다.');
        return;
      }

      // ---------------------
      // 2단계: 화면에 먼저 추가 (DB 성공 여부와 무관하게 즉시 반영)
      // ---------------------
      const localId = crypto.randomUUID();
      const newItem: PortfolioItem = {
        id: localId,
        ticker: data.ticker,
        currentPrice: data.price,
        currentQuantity: 0,
        targetWeight: 0,
      };
      setPortfolio(prev => [...prev, newItem]);
      setNewTicker('');

      // ---------------------
      // 3단계: DB에 저장 시도 (실패해도 화면 반영은 유지하고 조용히 경고만)
      // ---------------------
      try {
        const dbId = await addStockToDB(data.ticker);
        // DB 저장을 성공했으면 ID를 DB ID로 교체 (이후 수정/삭제 시 DB와 동기화 가능하도록)
        setPortfolio(prev =>
          prev.map(item => item.id === localId ? { ...item, id: dbId } : item)
        );
      } catch (dbError: unknown) {
        // DB 실패는 별도로만 콘솔에 기록. 화면에서는 종목이 이미 추가된 상태이므로 무시
        console.warn('[DB 저장 실패, 로컬 모드로 동작합니다]:', dbError);
      }
      
    } catch (error: unknown) {
      console.error('[종목 추가 실패]:', error);
      const errMsg = error instanceof Error ? error.message : '알 수 없는 오류';
      alert(`티커를 찾을 수 없습니다: ${errMsg}\n\n[도움말]\n- 미국 주식: AAPL, TSLA, MSFT\n- 한국 주식: 005930.KS (삼성전자), 000660.KS (SK하이닉스)\n- 코스닥: 035420.KQ (NAVER)`);
    } finally {
      setLoading(false);
    }
  };

  // 현금 항목 추가: 가격은 항상 $1, 수량 = 보유 현금액
  const handleAddCash = () => {
    if (portfolio.some(item => item.ticker === CASH_TICKER)) {
      alert('현금은 포트폴리오에 한 번만 추가할 수 있습니다.');
      return;
    }
    const cashItem: PortfolioItem = {
      id: crypto.randomUUID(),
      ticker: CASH_TICKER,
      currentPrice: 1, // 현금 1단위 = $1
      currentQuantity: 0,
      targetWeight: 0,
    };
    setPortfolio(prev => [...prev, cashItem]);
  };

  const handleUpdateItem = async (id: string, field: keyof PortfolioItem, value: number) => {
    setPortfolio(portfolio.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
    try {
      await updateStockInDB(id, field, value);
    } catch (error) {
      // DB 업데이트 실패는 조용히 처리 (로컬 상태는 정상 유지)
      console.warn('[DB 업데이트 실패]:', error);
    }
  };

  const handleDeleteItem = async (id: string) => {
    setPortfolio(portfolio.filter(item => item.id !== id));
    try {
       await removeStockFromDB(id);
    } catch (error) {
       console.warn('[DB 삭제 실패]:', error);
    }
  };

  return (
    <Card className="flex flex-col gap-4 bg-zinc-900 border-zinc-800 text-zinc-100">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Portfolio Status &amp; Rebalancing</CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Top Controls */}
        <div className="flex flex-col md:flex-row gap-6 items-end justify-between">
          <div className="flex flex-col gap-2 w-full md:w-auto">
            {/* 통화 토글 버튼 */}
            <Label className="text-zinc-400">월 추가 적립금</Label>
            <div className="flex gap-2 items-center">
              {/* USD / KRW 토글 */}
              <div className="flex rounded-md border border-zinc-700 overflow-hidden">
                <button
                  onClick={() => handleCurrencyToggle('USD')}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    currency === 'USD' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  $ USD
                </button>
                <button
                  onClick={() => handleCurrencyToggle('KRW')}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    currency === 'KRW' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  ₩ KRW
                </button>
              </div>

              {/* 금액 입력란 */}
              {currency === 'USD' ? (
                <Input
                  id="monthly-inv"
                  type="number"
                  value={monthlyInvestment}
                  onChange={(e) => setMonthlyInvestment(Number(e.target.value))}
                  className="w-32 bg-zinc-800 border-zinc-700 text-white"
                  placeholder="0"
                />
              ) : (
                <Input
                  id="monthly-inv-krw"
                  type="number"
                  value={krwInput || ''}
                  onChange={(e) => handleKrwInputChange(Number(e.target.value))}
                  className="w-36 bg-zinc-800 border-zinc-700 text-white"
                  placeholder="원화 입력"
                />
              )}

              {/* KRW 모드일 때 환율 정보 및 새로고침 버튼 */}
              {currency === 'KRW' && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-zinc-500">
                    {exchangeRate
                      ? `1 USD = ${exchangeRate.toLocaleString('ko-KR')} ₩`
                      : '환율 로딩 중...'}
                  </span>
                  <span className="text-xs text-zinc-400 font-medium">
                    ≈ ${monthlyInvestment.toLocaleString()} USD
                  </span>
                </div>
              )}

              {/* 환율 수동 새로고침 버튼 (KRW 모드만) */}
              {currency === 'KRW' && (
                <button
                  onClick={fetchExchangeRate}
                  disabled={rateLoading}
                  title="환율 새로고침"
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <RefreshCw size={14} className={rateLoading ? 'animate-spin' : ''} />
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1 w-full md:w-1/2">
            <p className="text-xs text-zinc-500">미국: AAPL / 한국: 005930.KS / 코스닥: 035420.KQ</p>
            <div className="flex gap-2">
              <Input 
                placeholder="Enter Ticker (e.g. AAPL, 005930.KS)" 
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleAddTicker()}
              />
              <Button onClick={handleAddTicker} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
                {loading ? '검색 중...' : '종목 추가'}
              </Button>
              {/* 현금 추가 버튼: API 조회 없이 즉시 추가 */}
              <Button
                onClick={handleAddCash}
                variant="outline"
                className="border-yellow-600 text-yellow-400 hover:bg-yellow-600/10 flex gap-1"
                title="현금 비중을 포트폴리오에 추가합니다"
              >
                <Banknote size={16} />
                현금
              </Button>
            </div>
          </div>
        </div>

        {/* Totals Summary */}
        <div className="flex gap-4 p-4 bg-zinc-800 rounded-lg">
          <div>
            <p className="text-sm text-zinc-400">현재 총액</p>
            <p className="text-2xl font-bold">${totalCurrentValue.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-400">목표 총액 (적립금 포함)</p>
            <p className="text-2xl font-bold text-blue-400">${totalTargetValue.toLocaleString()}</p>
          </div>
        </div>

        {/* Table */}
        <div className="border border-zinc-800 rounded-md overflow-hidden">
          <Table>
            <TableHeader className="bg-zinc-800/50">
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-300">종목</TableHead>
                <TableHead className="text-zinc-300">현재가</TableHead>
                <TableHead className="text-zinc-300">현재 수량</TableHead>
                <TableHead className="text-zinc-300">현재 비중</TableHead>
                <TableHead className="text-zinc-300">목표 비중 (%)</TableHead>
                <TableHead className="text-right text-zinc-300">매매 필요 수량</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rebalancedItems.length === 0 ? (
                <TableRow className="border-zinc-800 hover:bg-zinc-800/30">
                  <TableCell colSpan={6} className="text-center text-zinc-500 py-8">
                    등록된 종목이 없습니다. 새로운 티커를 검색해 추가해보세요.
                  </TableCell>
                </TableRow>
              ) : (
                rebalancedItems.map((item) => {
                  const isCash = item.ticker === CASH_TICKER;
                  const isBuy = item.tradeQuantity > 0;
                  // 현금은 달러 단위, 주식은 주 단위로 표시
                  const displayTradeQuantity = isCash
                    ? Math.round(item.tradeQuantity) // 달러
                    : Math.round(item.tradeQuantity); // 주

                  return (
                    <TableRow key={item.id} className={`border-zinc-800 hover:bg-zinc-800/30 ${isCash ? 'bg-yellow-950/20' : ''}`}>
                      {/* 종목 컬럼: CASH는 아이콘+뱃지로 구분 */}
                      <TableCell className="font-bold">
                        {isCash ? (
                          <span className="flex items-center gap-1 text-yellow-400">
                            <Banknote size={14} /> 현금 (CASH)
                          </span>
                        ) : item.ticker}
                      </TableCell>
                      {/* 현재가: CASH는 항상 $1이므로 고정 표시 */}
                      <TableCell className={isCash ? 'text-zinc-500' : ''}>
                        {isCash ? '$ 1.00 (고정)' : `$${item.currentPrice.toLocaleString()}`}
                      </TableCell>
                      {/* 수량 컬럼: CASH는 '보유 금액($)'으로 안내 */}
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {isCash && <span className="text-zinc-500 text-xs">$</span>}
                          <Input 
                            type="number"
                            value={item.currentQuantity}
                            onChange={(e) => handleUpdateItem(item.id, 'currentQuantity', Number(e.target.value))}
                            className={`bg-zinc-800 border-zinc-700 h-8 ${isCash ? 'w-32' : 'w-24'}`}
                            min={0}
                            placeholder={isCash ? '보유 현금액' : '0'}
                          />
                        </div>
                      </TableCell>
                      {/* 현재 비중: 전체 자산 대비 해당 종목의 실제 비중 */}
                      <TableCell>
                        <span className="text-zinc-300 text-sm">
                          {(item.currentWeight * 100).toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell>
                       <div className="flex items-center gap-1">
                        <Input 
                          type="number"
                          value={(item.targetWeight * 100).toFixed(0)}
                          onChange={(e) => handleUpdateItem(item.id, 'targetWeight', Number(e.target.value) / 100)}
                          className="w-20 bg-zinc-800 border-zinc-700 h-8 text-right pr-2"
                          min={0}
                          max={100}
                        />
                         <span className="text-zinc-400">%</span>
                       </div>
                      </TableCell>
                      {/* 매매 필요 컬럼: CASH는 '달러 단위'로 안내 */}
                      <TableCell className="text-right font-medium">
                        <div className="flex items-center justify-end gap-2">
                          {displayTradeQuantity !== 0 && (
                            <span className={isBuy ? 'text-emerald-500 flex items-center gap-1' : 'text-rose-500 flex items-center gap-1'}>
                              {isBuy ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                              {isCash
                                ? `${displayTradeQuantity > 0 ? '+' : ''}$${displayTradeQuantity.toLocaleString()}`
                                : `${displayTradeQuantity > 0 ? '+' : ''}${displayTradeQuantity}주`
                              }
                            </span>
                          )}
                          {displayTradeQuantity === 0 && <span className="text-zinc-500">-</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.id)} className="text-rose-400 hover:text-rose-500 hover:bg-rose-500/10 h-8 w-8">
                          <Trash2 size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
