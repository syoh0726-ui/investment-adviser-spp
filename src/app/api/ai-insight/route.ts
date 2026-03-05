import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { portfolio } = await request.json();

    if (!portfolio || !Array.isArray(portfolio) || portfolio.length === 0) {
      return NextResponse.json(
        { error: 'Valid portfolio data is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key is missing. Please add GEMINI_API_KEY to your .env.local file.' },
        { status: 500 }
      );
    }

    // 포트폴리오 데이터를 분석에 적합한 텍스트로 가공
    const portfolioSummary = portfolio
      .map(item => {
        const currentPct = (item.currentWeight * 100).toFixed(1);
        const targetPct  = (item.targetWeight  * 100).toFixed(1);
        const gap        = ((item.targetWeight - item.currentWeight) * 100).toFixed(1);
        const gapLabel   = Number(gap) > 0 ? `+${gap}%p 부족` : `${gap}%p 초과`;
        return `• ${item.ticker}: 현재 ${currentPct}% → 목표 ${targetPct}% (${gapLabel})`;
      })
      .join('\n');

    // CFA 페르소나 심층 분석 프롬프트
    const prompt = `당신은 CFA(공인재무분석사) 자격을 보유한 시니어 포트폴리오 매니저입니다.
15년 이상의 글로벌 자산 운용 경험을 바탕으로, 아래 포트폴리오에 대한 심층 브리핑을 제공해주세요.

[포트폴리오 구성 및 목표 대비 현황]
${portfolioSummary}

---

아래 4개 섹션을 **한국어 마크다운**으로 작성하세요. 각 섹션은 구체적이고 수치 근거를 포함해야 합니다.

## 1. 📊 포트폴리오 현황 진단
- 현재 비중과 목표 비중 간의 괴리 분석
- 집중 리스크(특정 종목·섹터 편중 여부) 평가
- 현금 비중의 적절성 판단

## 2. 🌍 최근 거시경제 동향 및 영향 분석
- 현재 글로벌 금리, 달러, 주요국 증시 흐름이 이 포트폴리오에 미치는 구체적 영향
- 해당 보유 종목/ETF에 직접적으로 영향을 주는 이슈 중심으로 서술

## 3. ⚖️ 자산 배분 리밸런싱 제언
- 목표 비중 달성을 위한 우선 매매 순서 제안 (리스크 최소화 관점)
- 현재 시장 상황을 고려했을 때 목표 비중 자체를 조정할 필요가 있는지 의견 제시

## 4. ⚠️ 핵심 리스크 및 대응 전략
- 이 포트폴리오의 최대 취약 요인 2~3가지 (구체적 시나리오 포함)
- 각 리스크에 대한 헤지 또는 대응 전략 제안

마지막에 전체 포트폴리오에 대한 1줄 종합 평가를 추가하세요.`;

    // @google/generative-ai SDK가 v1beta를 강제하므로, v1 엔드포인트를 fetch로 직접 호출
    // gemini-1.5-flash: 2.0-flash quota 초과 시 별도 할당량으로 사용 가능
    const MODEL = 'gemini-1.5-flash';
    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errBody = await geminiRes.json().catch(() => ({}));
      console.error('Gemini API error body:', errBody);
      throw new Error(errBody?.error?.message || `Gemini API returned ${geminiRes.status}`);
    }

    const geminiData = await geminiRes.json();
    const insightContent = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (!insightContent) {
      throw new Error('Gemini returned empty response');
    }

    return NextResponse.json({ insight: insightContent });

  } catch (error: unknown) {
    console.error('AI Insight Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to generate AI insights', details: message },
      { status: 500 }
    );
  }
}
