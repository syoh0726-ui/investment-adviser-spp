import { supabase } from './supabaseClient';
import { PortfolioItem } from './calculator';

// 단일 마스터 포트폴리오 ID를 고정하여 테스트 (실제로는 User Auth 연동)
const MASTER_PORTFOLIO_ID = '00000000-0000-0000-0000-000000000001';

export async function fetchPortfolio(): Promise<PortfolioItem[]> {
  const { error: pError } = await supabase
    .from('portfolios')
    .select('id')
    .eq('id', MASTER_PORTFOLIO_ID)
    .single();

  if (pError && pError.code === 'PGRST116') {
     // 포트폴리오가 없으면 생성
     await supabase.from('portfolios').insert([{
         id: MASTER_PORTFOLIO_ID,
         initial_asset: 0,
         monthly_investment: 1000
     }]);
  }

  const { data: stocks, error: sError } = await supabase
    .from('stocks')
    .select('*')
    .eq('portfolio_id', MASTER_PORTFOLIO_ID);

  if (sError) throw sError;

  // DB에 저장된 주식 정보는 quantity와 target_weight만 가지므로,
  // 현재가는 다시 클라이언트/서버에서 조회해야 하지만, 
  // 여기서는 로컬 상태 관리를 위해 DB 정보만 매핑합니다. 
  // (실제 주가는 PortfolioTable에서 추가 시점 및 로드 후 갱신됨)
  return (stocks || []).map((stock: Record<string, unknown>) => ({
    id: String(stock.id),
    ticker: String(stock.ticker),
    currentPrice: 0, // 초기 로드 시 0, 이후 주가 재조회 필요
    currentQuantity: Number(stock.quantity),
    targetWeight: Number(stock.target_weight)
  }));
}

export async function addStockToDB(ticker: string): Promise<string> {
   const { data, error } = await supabase
      .from('stocks')
      .insert([{
          portfolio_id: MASTER_PORTFOLIO_ID,
          ticker: ticker,
          quantity: 0,
          target_weight: 0
      }])
      .select('id')
      .single();
      
   if (error) throw error;
   return data.id;
}

export async function updateStockInDB(id: string, field: string, value: number) {
    const dbField = field === 'currentQuantity' ? 'quantity' : 'target_weight';
    const { error } = await supabase
       .from('stocks')
       .update({ [dbField]: value })
       .eq('id', id);
       
    if (error) throw error;
}

export async function removeStockFromDB(id: string) {
    const { error } = await supabase
      .from('stocks')
      .delete()
      .eq('id', id);

    if (error) throw error;
}
