import { NextRequest, NextResponse } from 'next/server';

/** Proxy léger vers Yahoo Finance Search (symboles / ETF par ticker ou ISIN). */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') || '').trim();
  if (q.length < 2) {
    return NextResponse.json({ ok: true as const, quotes: [] });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=16&newsCount=0&listsCount=0`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; SmartimmoMarketSearch/1.0)',
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false as const, error: `HTTP_${res.status}`, quotes: [] });
    }
    const json = (await res.json()) as { quotes?: unknown[] };
    const quotes = Array.isArray(json.quotes) ? json.quotes : [];
    return NextResponse.json({ ok: true as const, quotes });
  } catch {
    return NextResponse.json({ ok: false as const, error: 'NETWORK', quotes: [] });
  }
}
