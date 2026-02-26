/**
 * dataSources.ts — All external API fetches with localStorage caching.
 * TTL: prices=1hr, yields/hail=7days, RMA=24hr, drought=24hr
 * NEVER throws — always returns null on failure so callers fall back to hardcoded data.
 */

// ─── Cache helpers ────────────────────────────────────────────────────────────
interface CacheEntry<T> { data: T; ts: number; }

function cacheGet<T>(key: string, ttlMs: number): T | null {
  try {
    const raw = localStorage.getItem(`bb-ait-${key}`);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.ts > ttlMs) return null;
    return entry.data;
  } catch { return null; }
}

function cacheSet<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, ts: Date.now() };
    localStorage.setItem(`bb-ait-${key}`, JSON.stringify(entry));
  } catch { /* storage full, ignore */ }
}

function cacheClear(prefix = 'bb-ait-'): void {
  Object.keys(localStorage)
    .filter(k => k.startsWith(prefix))
    .forEach(k => localStorage.removeItem(k));
}
export { cacheClear };

const TTL = {
  PRICE: 60 * 60 * 1000,         // 1 hour
  YIELDS: 7 * 24 * 60 * 60 * 1000, // 7 days
  RMA: 24 * 60 * 60 * 1000,      // 24 hours
  HAIL: 7 * 24 * 60 * 60 * 1000, // 7 days
  DROUGHT: 24 * 60 * 60 * 1000,  // 24 hours
  WASDE: 24 * 60 * 60 * 1000,    // 24 hours
};

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PriceFetchResult {
  corn: number;
  soybeans: number;
  source: 'live' | 'cached' | 'estimate';
  lastUpdated: number;
}

export interface PricePoint { date: string; close: number; }
export interface PriceHistory { symbol: string; points: PricePoint[]; volatility30d: number; volatility90d: number; }

export interface USDAYieldRow { year: number; value: number; }

export interface PlantedHarvestedRow {
  year: number;
  planted: number;
  harvested: number;
  abandonmentRate: number; // (planted-harvested)/planted
}

export interface CropProgressRow { week_ending: string; value: number; }

export interface RMALossRow {
  year: number;
  causeCode: string;
  causeName: string;
  lossAmount: number;
  indemnityAmount: number;
  netAcresLost: number;
}

export interface DroughtRecord {
  date: string;          // YYYY-MM-DD
  d0: number; d1: number; d2: number; d3: number; d4: number; // % area each category
}

export interface WASDEData {
  marketYear: number;
  stocksToUse: number;   // percentage
  production: number;
  totalUse: number;
  endingStocks: number;
  outlook: 'Bearish' | 'Neutral' | 'Bullish';
}

export interface RMAPremiumData {
  planType: string;
  coverageLevel: number;
  premium: number; // $/acre total
  subsidyAmount: number;
  farmerPays: number;
  subsidyPct: number;
}

export interface NoaaHailEvent {
  year: number; month: number; day: number;
  magnitude: number; // inches
  damageProperty: number; damageProps: number;
  damageCrops: number;
  county: string; state: string;
}

// FIPS codes for our counties
export const COUNTY_FIPS: Record<string, string> = {
  'Trempealeau WI': '55121',
  'Buffalo WI':     '55011',
  'Jackson WI':     '55053',
  'Houston MN':     '27055',
};

const CORS_PROXY = 'https://corsproxy.io/?url=';

async function safeFetch(url: string, opts?: RequestInit): Promise<Response | null> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000), ...opts });
    if (!resp.ok) return null;
    return resp;
  } catch { return null; }
}

async function safeFetchProxy(url: string): Promise<Response | null> {
  const direct = await safeFetch(url);
  if (direct) return direct;
  return safeFetch(`${CORS_PROXY}${encodeURIComponent(url)}`);
}

// ─── CME Futures prices ────────────────────────────────────────────────────────
export async function fetchCurrentPrices(): Promise<PriceFetchResult | null> {
  const cacheKey = 'futures-current';
  const cached = cacheGet<PriceFetchResult>(cacheKey, TTL.PRICE);
  if (cached) return { ...cached, source: 'cached' };

  async function fetchYahoo(symbol: string): Promise<number | null> {
    const resp = await safeFetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
    );
    if (!resp) return null;
    try {
      const d = await resp.json();
      const p = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
      return p ? Math.round((p / 100) * 100) / 100 : null;
    } catch { return null; }
  }

  const [corn, soy] = await Promise.all([fetchYahoo('ZC=F'), fetchYahoo('ZS=F')]);
  if (!corn || !soy) return null;

  const result: PriceFetchResult = {
    corn, soybeans: soy, source: 'live', lastUpdated: Date.now(),
  };
  cacheSet(cacheKey, result);
  return result;
}

// ─── CME 2-year daily price history ───────────────────────────────────────────
export async function fetchPriceHistory(symbol: 'ZC=F' | 'ZS=F'): Promise<PriceHistory | null> {
  const cacheKey = `price-history-${symbol}`;
  const cached = cacheGet<PriceHistory>(cacheKey, TTL.PRICE);
  if (cached) return cached;

  const resp = await safeFetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2y`
  );
  if (!resp) return null;

  try {
    const d = await resp.json();
    const result = d?.chart?.result?.[0];
    if (!result) return null;
    const timestamps: number[] = result.timestamp ?? [];
    const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];

    const points: PricePoint[] = timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().split('T')[0],
        close: closes[i] ? Math.round((closes[i] / 100) * 100) / 100 : 0,
      }))
      .filter(p => p.close > 0);

    if (points.length < 10) return null;

    // Calculate volatility (annualized std dev of daily returns)
    const calcVol = (pts: PricePoint[], days: number): number => {
      const slice = pts.slice(-days);
      if (slice.length < 5) return 0;
      const returns = slice.slice(1).map((p, i) => Math.log(p.close / slice[i].close));
      const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
      const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / returns.length;
      return Math.round(Math.sqrt(variance * 252) * 100 * 100) / 100; // annualized %
    };

    const history: PriceHistory = {
      symbol,
      points,
      volatility30d: calcVol(points, 30),
      volatility90d: calcVol(points, 90),
    };
    cacheSet(cacheKey, history);
    return history;
  } catch { return null; }
}

// ─── USDA NASS Yields ─────────────────────────────────────────────────────────
export async function fetchNASSYields(
  county: string, crop: 'corn' | 'soybeans', stateAlpha: string
): Promise<USDAYieldRow[] | null> {
  const cacheKey = `nass-yields-${county}-${crop}`;
  const cached = cacheGet<USDAYieldRow[]>(cacheKey, TTL.YIELDS);
  if (cached) return cached;

  const commodity = crop === 'corn' ? 'CORN' : 'SOYBEANS';
  const countyName = county.split(' ')[0].toUpperCase();
  const url = `https://quickstats.nass.usda.gov/api/api_GET/?key=DEMO_KEY&commodity_desc=${commodity}&statisticcat_desc=YIELD&unit_desc=BU%20%2F%20ACRE&state_alpha=${stateAlpha}&county_name=${countyName}&year__GE=2005&format=JSON`;

  const resp = await safeFetch(url);
  if (!resp) return null;

  try {
    const d = await resp.json();
    if (!d.data || d.data.length < 5) return null;
    const rows: USDAYieldRow[] = d.data
      .map((r: Record<string,string>) => ({ year: Number(r.year), value: parseFloat(r.Value) }))
      .filter((r: USDAYieldRow) => !isNaN(r.value))
      .sort((a: USDAYieldRow, b: USDAYieldRow) => a.year - b.year);
    cacheSet(cacheKey, rows);
    return rows;
  } catch { return null; }
}

// ─── USDA NASS Planted vs Harvested acres ────────────────────────────────────
export async function fetchPlantedHarvested(
  stateAlpha: string, crop: 'corn' | 'soybeans'
): Promise<PlantedHarvestedRow[] | null> {
  const cacheKey = `nass-planted-${stateAlpha}-${crop}`;
  const cached = cacheGet<PlantedHarvestedRow[]>(cacheKey, TTL.YIELDS);
  if (cached) return cached;

  const commodity = crop === 'corn' ? 'CORN' : 'SOYBEANS';
  const fetchStat = async (stat: string) => {
    const url = `https://quickstats.nass.usda.gov/api/api_GET/?key=DEMO_KEY&commodity_desc=${commodity}&statisticcat_desc=${stat}&unit_desc=ACRES&agg_level_desc=STATE&state_alpha=${stateAlpha}&year__GE=2009&format=JSON`;
    const resp = await safeFetch(url);
    if (!resp) return null;
    try {
      const d = await resp.json();
      if (!d.data) return null;
      return d.data.reduce((m: Record<number,number>, r: Record<string,string>) => {
        m[Number(r.year)] = parseFloat(r.Value.replace(/,/g,''));
        return m;
      }, {} as Record<number,number>);
    } catch { return null; }
  };

  const [planted, harvested] = await Promise.all([fetchStat('AREA PLANTED'), fetchStat('AREA HARVESTED')]);
  if (!planted || !harvested) return null;

  const years = Object.keys(planted).map(Number).filter(y => harvested[y]);
  if (years.length < 5) return null;

  const rows: PlantedHarvestedRow[] = years.sort().map(year => {
    const p = planted[year] ?? 0, h = harvested[year] ?? 0;
    return { year, planted: p, harvested: h, abandonmentRate: p > 0 ? (p - h) / p : 0 };
  });
  cacheSet(cacheKey, rows);
  return rows;
}

// ─── NOAA Storm Events — Hail ─────────────────────────────────────────────────
export async function fetchNOAAHail(county: string, stateAbbr: string): Promise<NoaaHailEvent[] | null> {
  const cacheKey = `noaa-hail-${county}-${stateAbbr}`;
  const cached = cacheGet<NoaaHailEvent[]>(cacheKey, TTL.HAIL);
  if (cached) return cached;

  const countyEncoded = encodeURIComponent(`${county.split(' ')[0].toUpperCase()}:${stateAbbr}`);
  const stateFips = stateAbbr === 'WI' ? '55%2CWISCONSIN' : '27%2CMINNESOTA';
  const url = `https://www.ncdc.noaa.gov/stormevents/csv?eventType=%28Z%29+Hail&beginDate_mm=01&beginDate_dd=01&beginDate_yyyy=2000&endDate_mm=12&endDate_dd=31&endDate_yyyy=2023&county=${countyEncoded}&hailfilter=0.00&tornfilter=0&windfilter=000&sort=DT&submitbutton=Search&statefips=${stateFips}`;

  const resp = await safeFetchProxy(url);
  if (!resp) return null;

  try {
    const text = await resp.text();
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return null;

    const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim());
    const get = (row: string[], key: string): string => {
      const i = headers.indexOf(key);
      return i >= 0 ? (row[i] ?? '').replace(/"/g,'').trim() : '';
    };

    const events: NoaaHailEvent[] = [];
    for (const line of lines.slice(1)) {
      const row = line.split(',');
      const dateStr = get(row, 'BEGIN_DATE_TIME') || get(row, 'BEGIN_DATE');
      const mag = parseFloat(get(row, 'MAGNITUDE') || get(row, 'TOR_LENGTH') || '0');
      if (!dateStr || isNaN(mag)) continue;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) continue;
      events.push({
        year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(),
        magnitude: mag,
        damageProperty: parseFloat(get(row, 'DAMAGE_PROPERTY') || '0'),
        damageProps: 0,
        damageCrops: parseFloat(get(row, 'DAMAGE_CROPS') || '0'),
        county, state: stateAbbr,
      });
    }

    if (events.length < 3) return null;
    cacheSet(cacheKey, events);
    return events;
  } catch { return null; }
}

// ─── NOAA Drought Monitor ─────────────────────────────────────────────────────
export async function fetchDroughtHistory(fips: string): Promise<DroughtRecord[] | null> {
  const cacheKey = `drought-${fips}`;
  const cached = cacheGet<DroughtRecord[]>(cacheKey, TTL.DROUGHT);
  if (cached) return cached;

  const url = `https://usdm.climate.gov/api/usdmstatistics/historical?county=${fips}&startdate=2009-01-01&enddate=2023-12-31`;
  const resp = await safeFetchProxy(url);
  if (!resp) return null;

  try {
    const d = await resp.json();
    if (!Array.isArray(d) || d.length < 5) return null;
    const rows: DroughtRecord[] = d.map((r: Record<string,number|string>) => ({
      date: String(r.ReleaseDate || r.date || ''),
      d0: Number(r.D0 ?? 0), d1: Number(r.D1 ?? 0), d2: Number(r.D2 ?? 0),
      d3: Number(r.D3 ?? 0), d4: Number(r.D4 ?? 0),
    })).filter(r => r.date);
    cacheSet(cacheKey, rows);
    return rows;
  } catch { return null; }
}

// ─── RMA Cause of Loss ────────────────────────────────────────────────────────
export interface RMACauseOfLossRow {
  year: number;
  causeCode: string;
  causeName: string;
  indemnity: number;
  netAcresLost: number;
}

const CAUSE_NAMES: Record<string,string> = {
  '06':'Hail','58':'Drought','42':'Excess Moisture','07':'Freeze/Cold',
  '05':'Wind','01':'Drought (D1+)','11':'Excessive Heat','08':'Flood',
  '04':'Prevented Planting','02':'Disease','03':'Insects',
};

export async function fetchRMACauseOfLoss(
  state: string, county: string, crop: 'corn' | 'soybeans'
): Promise<RMACauseOfLossRow[] | null> {
  const cacheKey = `rma-col-${state}-${county}-${crop}`;
  const cached = cacheGet<RMACauseOfLossRow[]>(cacheKey, TTL.RMA);
  if (cached) return cached;

  const commodityCode = crop === 'corn' ? '41' : '81';
  const url = `https://pubagdataws1.rma.usda.gov/ADMWebService/api/CauseOfLoss/?reinsuranceYear=2023&stateCode=${state}&commodityCode=${commodityCode}`;
  const resp = await safeFetch(url);
  if (!resp) return null;

  try {
    const d = await resp.json();
    if (!Array.isArray(d) || d.length === 0) return null;
    const rows: RMACauseOfLossRow[] = d.slice(0, 50).map((r: Record<string,unknown>) => ({
      year: Number(r.reinsuranceYear ?? r.year ?? 2023),
      causeCode: String(r.causeOfLossCode ?? r.causeCode ?? ''),
      causeName: CAUSE_NAMES[String(r.causeOfLossCode ?? '')] ?? String(r.causeOfLossDescription ?? 'Other'),
      indemnity: Number(r.indemnityAmount ?? r.indemnity ?? 0),
      netAcresLost: Number(r.netDeterminedAcres ?? r.netAcresLost ?? 0),
    }));
    cacheSet(cacheKey, rows);
    return rows;
  } catch { return null; }
}

// ─── WASDE / PSD API ──────────────────────────────────────────────────────────
export async function fetchWASDE(crop: 'corn' | 'soybeans'): Promise<WASDEData | null> {
  const cacheKey = `wasde-${crop}`;
  const cached = cacheGet<WASDEData>(cacheKey, TTL.WASDE);
  if (cached) return cached;

  // USDA PSD commodity codes: corn=0440000, soybeans=2222000
  const code = crop === 'corn' ? '0440000' : '2222000';
  const url = `https://apps.fas.usda.gov/psdonline/api/psd/commodity/${code}/data/annual?marketYear=2023`;
  const resp = await safeFetch(url);
  if (!resp) return null;

  try {
    const d = await resp.json();
    if (!Array.isArray(d) || d.length === 0) return null;

    const getAttr = (attrId: number) => {
      const row = d.find((r: Record<string,number>) => r.AttributeId === attrId || r.attributeId === attrId);
      return row ? Number(row.Value ?? row.value ?? 0) : 0;
    };

    // Attribute IDs: production=28, domestic use=176, exports=88, ending stocks=176
    const production = getAttr(28) || getAttr(57);
    const totalUse = getAttr(176) || getAttr(125);
    const endingStocks = getAttr(20) || getAttr(125);
    const stocksToUse = totalUse > 0 ? Math.round((endingStocks / totalUse) * 10000) / 100 : 0;

    let outlook: WASDEData['outlook'] = 'Neutral';
    if (crop === 'corn') {
      if (stocksToUse < 8) outlook = 'Bullish';
      else if (stocksToUse > 15) outlook = 'Bearish';
    } else {
      if (stocksToUse < 5) outlook = 'Bullish';
      else if (stocksToUse > 10) outlook = 'Bearish';
    }

    const result: WASDEData = { marketYear: 2023, stocksToUse, production, totalUse, endingStocks, outlook };
    cacheSet(cacheKey, result);
    return result;
  } catch { return null; }
}

// ─── RMA Premium data ─────────────────────────────────────────────────────────
export async function fetchRMAPremiums(
  stateCode: string, countyCode: string, crop: 'corn' | 'soybeans'
): Promise<RMAPremiumData[] | null> {
  const cacheKey = `rma-premium-${stateCode}-${countyCode}-${crop}`;
  const cached = cacheGet<RMAPremiumData[]>(cacheKey, TTL.RMA);
  if (cached) return cached;

  const commodityCode = crop === 'corn' ? '41' : '81';
  const url = `https://pubagdataws1.rma.usda.gov/ADMWebService/api/PremiumData/PremiumCalcBySubCounty?stateCode=${stateCode}&countyCode=${countyCode}&commodityCode=${commodityCode}&reinsuranceYear=2025`;
  const resp = await safeFetch(url);
  if (!resp) return null;

  try {
    const d = await resp.json();
    if (!Array.isArray(d) || d.length === 0) return null;
    const rows: RMAPremiumData[] = d.slice(0, 20).map((r: Record<string,unknown>) => ({
      planType: String(r.planCode ?? r.planType ?? ''),
      coverageLevel: Number(r.coverageLevel ?? 0) / 100,
      premium: Number(r.totalPremiumPerAcre ?? r.premium ?? 0),
      subsidyAmount: Number(r.subsidyAmount ?? r.subsidy ?? 0),
      farmerPays: Number(r.producerPremiumPerAcre ?? r.farmerPays ?? 0),
      subsidyPct: Number(r.subsidyPercent ?? 0),
    }));
    cacheSet(cacheKey, rows);
    return rows;
  } catch { return null; }
}

// ─── USDA Crop Progress ───────────────────────────────────────────────────────
export async function fetchCropProgress(stateAlpha: string, crop: 'corn' | 'soybeans'): Promise<CropProgressRow[] | null> {
  const cacheKey = `nass-progress-${stateAlpha}-${crop}`;
  const cached = cacheGet<CropProgressRow[]>(cacheKey, TTL.YIELDS);
  if (cached) return cached;

  const commodity = crop === 'corn' ? 'CORN' : 'SOYBEANS';
  const url = `https://quickstats.nass.usda.gov/api/api_GET/?key=DEMO_KEY&commodity_desc=${commodity}&statisticcat_desc=PROGRESS&unit_desc=PCT%20PLANTED&agg_level_desc=STATE&state_alpha=${stateAlpha}&year__GE=2023&format=JSON`;
  const resp = await safeFetch(url);
  if (!resp) return null;

  try {
    const d = await resp.json();
    if (!d.data || d.data.length < 2) return null;
    const rows: CropProgressRow[] = d.data
      .map((r: Record<string,string>) => ({ week_ending: r.week_ending ?? '', value: parseFloat(r.Value) }))
      .filter((r: CropProgressRow) => !isNaN(r.value))
      .sort((a: CropProgressRow, b: CropProgressRow) => a.week_ending.localeCompare(b.week_ending));
    cacheSet(cacheKey, rows);
    return rows;
  } catch { return null; }
}

// ─── Subsidy rates by coverage level (RMA standard) ──────────────────────────
export const RMA_SUBSIDY_RATES: Record<string, number> = {
  '50': 0.67, '55': 0.64, '60': 0.64, '65': 0.59,
  '70': 0.59, '75': 0.55, '80': 0.48, '85': 0.38,
};

export function getSubsidyRate(coverageLevel: number): number {
  const key = String(Math.round(coverageLevel * 100));
  return RMA_SUBSIDY_RATES[key] ?? 0.50;
}

export function calcSubsidyBreakdown(grossPremium: number, coverageLevel: number) {
  const rate = getSubsidyRate(coverageLevel);
  const govtPays = grossPremium * rate;
  const farmerPays = grossPremium - govtPays;
  return { govtPays, farmerPays, rate };
}
