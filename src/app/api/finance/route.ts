import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ticker = searchParams.get('ticker');

  if (!ticker) {
    return NextResponse.json(
      { error: 'Ticker is required' },
      { status: 400 }
    );
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quote = await yahooFinance.quote(ticker) as any;
    
    if (!quote || !quote.regularMarketPrice) {
       return NextResponse.json(
        { error: 'Could not fetch price for the given ticker' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ticker: quote.symbol,
      price: quote.regularMarketPrice,
      currency: quote.currency,
      shortName: quote.shortName,
      regularMarketTime: quote.regularMarketTime,
    });
    
  } catch (error: unknown) {
    console.error('Finance API Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch stock data', details: message },
      { status: 500 }
    );
  }
}
