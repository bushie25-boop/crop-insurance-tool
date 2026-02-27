// dataSources.ts — All API fetches with localStorage caching
// Fallback to historicalData.ts if APIs fail
// Always show data source status in UI

export type DataSourceStatus = 'live' | 'cached' | 'estimated';

export interface DataSourceInfo {
  name: string;
  status: DataSourceStatus;
  lastUpdated?: string;
  url?: string;
}

// Cache TTLs
const TTL = {
  FUTURES: 60 * 60 * 1000,         // 1 hour
  COUNTY_YIELDS: 24 * 60 * 60 * 1000, // 24 hours
  HAIL_EVENTS: 7 * 24 * 60 * 60 * 1000, // 7 days
};

function setCached(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch { /* quota exceeded */ }
}

function getCached<T>(key: string, ttl: number): { data: T; age: number } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    const age = Date.now() - timestamp;
    if (age > ttl) return null;
    return { data, age };
  } catch {
    return null;
  }
}

// ─── USDA NASS County Yields ──────────────────────────────────────────────────

export interface NASSObs {
  year: number;
  value: number;
}

const COUNTY_STATE_MAP: Record<string, { state: string; county: string }> = {
  'Trempealeau WI': { state: 'WI', county: 'TREMPEALEAU' },
  'Buffalo WI':     { state: 'WI', county: 'BUFFALO' },
  'Jackson WI':     { state: 'WI', county: 'JACKSON' },
  'Houston MN':     { state: 'MN', county: 'HOUSTON' },
  'Winona MN':      { state: 'MN', county: 'WINONA' },
};

export async function fetchNASSYields(
  county: string,
  crop: 'corn' | 'soybeans'
): Promise<{ observations: NASSObs[]; source: DataSourceInfo }> {
  const cacheKey = `nass_yields_${county}_${crop}`;
  const cached = getCached<NASSObs[]>(cacheKey, TTL.COUNTY_YIELDS);

  if (cached) {
    return {
      observations: cached.data,
      source: { name: 'USDA NASS', status: 'cached', lastUpdated: new Date(Date.now() - cached.age).toISOString() },
    };
  }

  const loc = COUNTY_STATE_MAP[county];
  if (!loc) throw new Error(`Unknown county: ${county}`);

  const commodityDesc = crop === 'corn' ? 'CORN' : 'SOYBEANS';
  const url = new URL('https://quickstats.nass.usda.gov/api/api_GET/');
  url.searchParams.set('key', 'DEMO_KEY');
  url.searchParams.set('commodity_desc', commodityDesc);
  url.searchParams.set('statisticcat_desc', 'YIELD');
  url.searchParams.set('unit_desc', 'BU / ACRE');
  url.searchParams.set('agg_level_desc', 'COUNTY');
  url.searchParams.set('state_alpha', loc.state);
  url.searchParams.set('county_name', loc.county);
  url.searchParams.set('year__GE', '2008');
  url.searchParams.set('format', 'JSON');

  try {
    const resp = await fetch(url.toString());
    if (!resp.ok) throw new Error(`NASS HTTP ${resp.status}`);
    const json = await resp.json();
    const observations: NASSObs[] = (json.data || [])
      .filter((d: Record<string, string>) => d.Value && d.Value !== ' (D)' && d.Value !== '(NA)')
      .map((d: Record<string, string>) => ({
        year: parseInt(d.year),
        value: parseFloat(d.Value.replace(',', '')),
      }))
      .sort((a: NASSObs, b: NASSObs) => a.year - b.year);

    setCached(cacheKey, observations);
    return {
      observations,
      source: { name: 'USDA NASS', status: 'live', lastUpdated: new Date().toISOString(), url: url.toString() },
    };
  } catch {
    return {
      observations: [],
      source: { name: 'USDA NASS', status: 'estimated', lastUpdated: undefined },
    };
  }
}

// ─── CME Futures (Yahoo Finance) ─────────────────────────────────────────────

export interface FuturesData {
  symbol: string;
  price: number;
  currency: string;
  timestamps: number[];
  closes: (number | null)[];
}

export async function fetchFutures(crop: 'corn' | 'soybeans'): Promise<{
  data: FuturesData | null;
  source: DataSourceInfo;
}> {
  const symbol = crop === 'corn' ? 'ZC=F' : 'ZS=F';
  const cacheKey = `futures_${symbol}`;
  const cached = getCached<FuturesData>(cacheKey, TTL.FUTURES);

  if (cached) {
    return {
      data: cached.data,
      source: { name: 'CME Futures (Yahoo)', status: 'cached', lastUpdated: new Date(Date.now() - cached.age).toISOString() },
    };
  }

  // Try with cors proxy
  const directUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=90d`;
  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(directUrl)}`;

  for (const url of [directUrl, proxyUrl]) {
    try {
      const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!resp.ok) continue;
      const json = await resp.json();
      const result = json?.chart?.result?.[0];
      if (!result) continue;

      const data: FuturesData = {
        symbol,
        price: result.meta?.regularMarketPrice ?? 0,
        currency: result.meta?.currency ?? 'USD',
        timestamps: result.timestamp ?? [],
        closes: result.indicators?.quote?.[0]?.close ?? [],
      };

      setCached(cacheKey, data);
      return {
        data,
        source: { name: 'CME Futures (Yahoo Finance)', status: 'live', lastUpdated: new Date().toISOString() },
      };
    } catch { continue; }
  }

  return {
    data: null,
    source: { name: 'CME Futures', status: 'estimated', lastUpdated: undefined },
  };
}

// ─── NOAA Hail Events ─────────────────────────────────────────────────────────
// Visualization only — NO insurance rates

export interface NOAAHailEvent {
  year: number;
  date: string;
  county: string;
  magnitude: number;
  description: string;
}

export async function fetchHailEvents(county: string): Promise<{
  events: NOAAHailEvent[];
  source: DataSourceInfo;
}> {
  const cacheKey = `hail_${county}`;
  const cached = getCached<NOAAHailEvent[]>(cacheKey, TTL.HAIL_EVENTS);

  if (cached) {
    return {
      events: cached.data,
      source: { name: 'NOAA Storm Events', status: 'cached', lastUpdated: new Date(Date.now() - cached.age).toISOString() },
    };
  }

  // NOAA Storm Events doesn't have a simple CORS-friendly JSON API
  // Fall through to estimated data
  return {
    events: [],
    source: { name: 'NOAA Storm Events', status: 'estimated', lastUpdated: undefined },
  };
}

// ─── Status badge helper ──────────────────────────────────────────────────────

export function getStatusBadge(status: DataSourceStatus): string {
  switch (status) {
    case 'live': return '✅ Live';
    case 'cached': return '⚠️ Cached';
    case 'estimated': return '📊 Estimated';
  }
}
