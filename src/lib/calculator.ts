export interface PortfolioItem {
  id: string;
  ticker: string;
  currentPrice: number;
  currentQuantity: number;
  targetWeight: number; // 0.0 ~ 1.0 비율 값 (예: 25% -> 0.25)
}

export interface RebalanceResult extends PortfolioItem {
  currentValue: number; // 현재 평가 금액 (현재가 * 현재수량)
  currentWeight: number; // 전체 자산 대비 현재 비중 (현재 평가 금액 / 전체 평가 금액)
  targetValue: number; // 목표 자산 대비 목표 금액 (목표 자산 * 목표 비중)
  requiredQuantity: number; // 목표 금액을 달성하기 위한 필요 총 수량
  tradeQuantity: number; // 매수/매도할 수량 (양수: 매수, 음수: 매도)
}

/**
 * 리밸런싱 수량을 계산하는 핵심 로직 함수
 * @param currentPortfolio 보유 종목들의 현재 상태 배열
 * @param monthlyInvestment 월 추가 적립금
 */
export function calculateRebalance(
  currentPortfolio: PortfolioItem[],
  monthlyInvestment: number
): {
  rebalancedItems: RebalanceResult[];
  totalCurrentValue: number;
  totalTargetValue: number;
} {
  // 1. 현재 총액 계산
  const totalCurrentValue = currentPortfolio.reduce(
    (sum, item) => sum + item.currentPrice * item.currentQuantity,
    0
  );

  // 2. 목표 자산 = 현재 총액 + 월 적립금
  const totalTargetValue = totalCurrentValue + monthlyInvestment;

  // 3. 종목별 비중, 필요 수량, 매수/매도량 계산
  const rebalancedItems: RebalanceResult[] = currentPortfolio.map((item) => {
    const currentValue = item.currentPrice * item.currentQuantity;
    const currentWeight = totalCurrentValue > 0 ? currentValue / totalCurrentValue : 0;
    
    const targetValue = totalTargetValue * item.targetWeight;
    const requiredQuantity = targetValue / item.currentPrice;
    
    // 목표 수량과 현재 수량의 차이가 매매 수량 (음수면 매도, 양수면 매수)
    const tradeQuantity = requiredQuantity - item.currentQuantity;

    return {
      ...item,
      currentValue,
      currentWeight,
      targetValue,
      requiredQuantity,
      tradeQuantity,
    };
  });

  return {
    rebalancedItems,
    totalCurrentValue,
    totalTargetValue,
  };
}
