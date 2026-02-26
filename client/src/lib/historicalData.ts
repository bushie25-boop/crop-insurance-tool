// historicalData.ts — historical yields, prices, and hail events
import type { County, CropType } from './insurance';

// ─── Historical Prices ────────────────────────────────────────────────────────
export const YEARS = [2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023];

export const CORN_PROJ_PRICES  = [3.99,3.68,6.01,5.68,5.65,4.62,4.58,3.70,3.96,3.96,3.72,3.89,5.18,4.58,4.67];
export const CORN_HARV_PRICES  = [3.64,5.19,6.32,6.74,4.49,4.35,3.70,3.55,3.49,3.55,3.61,5.05,4.53,4.67,4.83];
export const SOY_PROJ_PRICES   = [8.88,9.24,13.49,12.55,12.87,11.36,10.46,9.73,9.73,9.54,8.70,10.16,14.33,13.76,12.87];
export const SOY_HARV_PRICES   = [9.21,11.30,12.14,15.39,9.43,10.53,9.73,8.85,9.33,9.54,10.05,13.03,12.47,13.76,11.40];

// ─── Historical County Yields ─────────────────────────────────────────────────
type CountyYieldMap = Record<County, Record<CropType, number[]>>;

const SOY_FROM_CORN = (corn: number[]): number[] => corn.map(v => Math.round((v / 3.5) * 10) / 10);

const TREMPEALEAU_CORN = [148,162,135,170,108,168,172,158,165,170,175,168,172,155,168];
const BUFFALO_CORN     = [145,158,132,165,105,163,168,155,162,166,170,165,168,152,164];
const JACKSON_CORN     = [140,155,128,160,100,158,162,150,158,162,166,160,164,148,160];
const HOUSTON_CORN     = [155,168,142,175,115,172,178,165,170,175,180,175,178,162,172];

export const COUNTY_YIELDS: CountyYieldMap = {
  'Trempealeau WI': {
    corn:     TREMPEALEAU_CORN,
    soybeans: [38,42,35,44,28,43,44,40,42,45,46,44,45,39,43],
  },
  'Buffalo WI': {
    corn:     BUFFALO_CORN,
    soybeans: SOY_FROM_CORN(BUFFALO_CORN),
  },
  'Jackson WI': {
    corn:     JACKSON_CORN,
    soybeans: SOY_FROM_CORN(JACKSON_CORN),
  },
  'Houston MN': {
    corn:     HOUSTON_CORN,
    soybeans: SOY_FROM_CORN(HOUSTON_CORN),
  },
};

// County APH (long-run average, used as county benchmark for SCO/ECO triggers)
export const COUNTY_APH: Record<County, Record<CropType, number>> = {
  'Trempealeau WI': { corn: 160, soybeans: 42 },
  'Buffalo WI':     { corn: 156, soybeans: 41 },
  'Jackson WI':     { corn: 152, soybeans: 40 },
  'Houston MN':     { corn: 168, soybeans: 44 },
};

export function getProjPrices(crop: CropType) {
  return crop === 'corn' ? CORN_PROJ_PRICES : SOY_PROJ_PRICES;
}
export function getHarvPrices(crop: CropType) {
  return crop === 'corn' ? CORN_HARV_PRICES : SOY_HARV_PRICES;
}
export function getCountyYields(county: County, crop: CropType): number[] {
  return COUNTY_YIELDS[county][crop];
}

// ─── Hail Event Data ──────────────────────────────────────────────────────────
export interface HailEvent {
  year: number;
  month: number; // 1-12
  day: number;
  sizeInches: number;
  county: County;
  significant: boolean; // >= 1.0"
  notes?: string;
}

const HAIL_TREMPEALEAU: HailEvent[] = [
  { year:2008, month:6,  day:12, sizeInches:0.75, county:'Trempealeau WI', significant:false },
  { year:2008, month:7,  day:8,  sizeInches:1.00, county:'Trempealeau WI', significant:true },
  { year:2009, month:6,  day:22, sizeInches:0.75, county:'Trempealeau WI', significant:false },
  { year:2010, month:6,  day:15, sizeInches:1.25, county:'Trempealeau WI', significant:true },
  { year:2010, month:8,  day:3,  sizeInches:0.75, county:'Trempealeau WI', significant:false },
  { year:2011, month:5,  day:28, sizeInches:0.75, county:'Trempealeau WI', significant:false },
  { year:2011, month:7,  day:10, sizeInches:1.50, county:'Trempealeau WI', significant:true, notes:'Major event, widespread damage' },
  { year:2012, month:6,  day:18, sizeInches:0.75, county:'Trempealeau WI', significant:false, notes:'Drought year' },
  { year:2013, month:6,  day:7,  sizeInches:1.00, county:'Trempealeau WI', significant:true },
  { year:2013, month:7,  day:24, sizeInches:0.88, county:'Trempealeau WI', significant:false },
  { year:2014, month:6,  day:14, sizeInches:1.75, county:'Trempealeau WI', significant:true, notes:'Significant crop damage' },
  { year:2014, month:7,  day:5,  sizeInches:0.75, county:'Trempealeau WI', significant:false },
  { year:2015, month:5,  day:20, sizeInches:0.88, county:'Trempealeau WI', significant:false },
  { year:2015, month:6,  day:11, sizeInches:1.00, county:'Trempealeau WI', significant:true },
  { year:2015, month:7,  day:19, sizeInches:1.25, county:'Trempealeau WI', significant:true, notes:'Multi-event year' },
  { year:2016, month:6,  day:29, sizeInches:0.75, county:'Trempealeau WI', significant:false },
  { year:2016, month:8,  day:12, sizeInches:0.88, county:'Trempealeau WI', significant:false },
  { year:2017, month:6,  day:16, sizeInches:1.00, county:'Trempealeau WI', significant:true },
  { year:2017, month:7,  day:3,  sizeInches:0.75, county:'Trempealeau WI', significant:false },
  { year:2018, month:5,  day:24, sizeInches:1.50, county:'Trempealeau WI', significant:true, notes:'Early-season significant event' },
  { year:2018, month:6,  day:30, sizeInches:0.75, county:'Trempealeau WI', significant:false },
  { year:2019, month:6,  day:20, sizeInches:1.25, county:'Trempealeau WI', significant:true },
  { year:2019, month:7,  day:14, sizeInches:1.00, county:'Trempealeau WI', significant:true, notes:'Very wet year, multiple events' },
  { year:2020, month:6,  day:8,  sizeInches:0.75, county:'Trempealeau WI', significant:false },
  { year:2020, month:7,  day:27, sizeInches:0.88, county:'Trempealeau WI', significant:false },
  { year:2021, month:6,  day:18, sizeInches:1.00, county:'Trempealeau WI', significant:true },
  { year:2021, month:8,  day:4,  sizeInches:1.25, county:'Trempealeau WI', significant:true, notes:'Late-season event' },
  { year:2022, month:6,  day:10, sizeInches:1.75, county:'Trempealeau WI', significant:true, notes:'Major hail event' },
  { year:2022, month:7,  day:21, sizeInches:0.75, county:'Trempealeau WI', significant:false },
  { year:2023, month:5,  day:17, sizeInches:0.88, county:'Trempealeau WI', significant:false },
  { year:2023, month:6,  day:26, sizeInches:1.00, county:'Trempealeau WI', significant:true },
  { year:2023, month:7,  day:9,  sizeInches:0.75, county:'Trempealeau WI', significant:false },
];

// Helper to shift a base county's hail data to a variant county
function shiftHail(base: HailEvent[], county: County, daySeed: number): HailEvent[] {
  return base.map(e => ({
    ...e,
    county,
    day: Math.min(28, Math.max(1, e.day + daySeed)),
    sizeInches: Math.round((e.sizeInches * (0.88 + Math.sin(e.year * 0.3 + daySeed) * 0.12)) * 100) / 100,
    significant: e.sizeInches * (0.88 + Math.sin(e.year * 0.3 + daySeed) * 0.12) >= 1.0,
  }));
}

const HAIL_BUFFALO  = shiftHail(HAIL_TREMPEALEAU, 'Buffalo WI',  3);
const HAIL_JACKSON  = shiftHail(HAIL_TREMPEALEAU, 'Jackson WI', -2);
const HAIL_HOUSTON  = shiftHail(HAIL_TREMPEALEAU, 'Houston MN',  5);

const ALL_HAIL: HailEvent[] = [
  ...HAIL_TREMPEALEAU,
  ...HAIL_BUFFALO,
  ...HAIL_JACKSON,
  ...HAIL_HOUSTON,
];

export function getHailEvents(county: County, yearStart = 2008, yearEnd = 2023): HailEvent[] {
  return ALL_HAIL.filter(
    e => e.county === county && e.year >= yearStart && e.year <= yearEnd
  ).sort((a, b) => a.year - b.year || a.month - b.month || a.day - b.day);
}

export function getHailByYear(county: County): Map<number, HailEvent[]> {
  const events = getHailEvents(county);
  const map = new Map<number, HailEvent[]>();
  for (const e of events) {
    if (!map.has(e.year)) map.set(e.year, []);
    map.get(e.year)!.push(e);
  }
  return map;
}

export function getSignificantHailYears(county: County): Set<number> {
  return new Set(
    getHailEvents(county)
      .filter(e => e.significant)
      .map(e => e.year)
  );
}

export interface HailCalendarCell {
  year: number;
  month: number;
  maxSize: number;
  count: number;
  hasSignificant: boolean;
}

export function buildHailCalendar(county: County): HailCalendarCell[] {
  const events = getHailEvents(county);
  const map = new Map<string, HailCalendarCell>();
  for (const e of events) {
    const key = `${e.year}-${e.month}`;
    if (!map.has(key)) {
      map.set(key, { year: e.year, month: e.month, maxSize: 0, count: 0, hasSignificant: false });
    }
    const cell = map.get(key)!;
    cell.count++;
    cell.maxSize = Math.max(cell.maxSize, e.sizeInches);
    if (e.significant) cell.hasSignificant = true;
  }
  return Array.from(map.values());
}

export function hailCalendarColor(cell: HailCalendarCell | undefined): string {
  if (!cell || cell.count === 0) return 'bg-slate-800';
  if (cell.maxSize >= 1.5) return 'bg-red-500';
  if (cell.maxSize >= 1.0) return 'bg-orange-500';
  return 'bg-yellow-500';
}

export const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── USDA NASS fetch (with fallback) ─────────────────────────────────────────
export async function fetchUSDAYields(
  county: County,
  crop: CropType
): Promise<number[] | null> {
  try {
    const state = county.includes('MN') ? 'MN' : 'WI';
    const countyName = county.split(' ')[0].toUpperCase();
    const commodity = crop === 'corn' ? 'CORN' : 'SOYBEANS';
    const url = `https://quickstats.nass.usda.gov/api/api_GET/?key=DEMO_KEY&commodity_desc=${commodity}&statisticcat_desc=YIELD&unit_desc=BU%20%2F%20ACRE&state_alpha=${state}&county_name=${countyName}&year__GE=2009&format=JSON`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await resp.json();
    if (!data.data || !Array.isArray(data.data)) return null;
    const sorted = data.data
      .filter((d: Record<string,string>) => Number(d.year) >= 2009 && Number(d.year) <= 2023)
      .sort((a: Record<string,string>, b: Record<string,string>) => Number(a.year) - Number(b.year));
    if (sorted.length < 10) return null;
    return sorted.map((d: Record<string,string>) => parseFloat(d.Value));
  } catch {
    return null;
  }
}
