// useFutures.ts — fetch CME nearby futures prices from Yahoo Finance
import { useState, useEffect } from 'react';

const DEFAULTS = { corn: 4.50, soybeans: 10.50 };

async function fetchPrice(symbol: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await resp.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (!price) return null;
    // Corn futures quote in cents/bu → divide by 100; soybeans same
    return Math.round((price / 100) * 100) / 100;
  } catch {
    return null;
  }
}

export interface FuturesPrices {
  corn: number;
  soybeans: number;
  loading: boolean;
  source: 'live' | 'default';
  lastUpdated: Date | null;
}

export function useFutures(): FuturesPrices {
  const [state, setState] = useState<FuturesPrices>({
    corn: DEFAULTS.corn,
    soybeans: DEFAULTS.soybeans,
    loading: true,
    source: 'default',
    lastUpdated: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [corn, soy] = await Promise.all([
        fetchPrice('ZC=F'),
        fetchPrice('ZS=F'),
      ]);
      if (cancelled) return;
      setState({
        corn: corn ?? DEFAULTS.corn,
        soybeans: soy ?? DEFAULTS.soybeans,
        loading: false,
        source: corn && soy ? 'live' : 'default',
        lastUpdated: new Date(),
      });
    })();
    return () => { cancelled = true; };
  }, []);

  return state;
}
