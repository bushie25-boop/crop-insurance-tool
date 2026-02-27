// historicalData.ts — Hardcoded fallback data
// ⚠️ ESTIMATED DATA — used when APIs are unavailable
// Sources: USDA NASS, RMA historical price tables, Scout/Storm research
// Label all data as estimated in the UI

export interface CountyYieldHistory {
  county: string;
  crop: 'corn' | 'soybeans';
  years: number[];
  yields: number[];      // bu/ac actual county yields
  trendAPH: number[];    // 30-year trend APH for that year (used as county APH for SCO calc)
}

export interface PriceHistory {
  years: number[];
  projectedPrices: number[];  // spring projected (CME futures avg, Feb)
  harvestPrices: number[];    // fall harvest price (Oct futures avg)
}

// ─── County Yield History ─────────────────────────────────────────────────────
// Source: USDA NASS county estimates + RMA SCO Expected County Yield database
// ⚠️ ESTIMATED — verify via NASS API

export const COUNTY_YIELDS: CountyYieldHistory[] = [
  {
    county: 'Trempealeau WI',
    crop: 'corn',
    years: [2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023],
    yields: [138,142,130,145,158,148,152,155,150,155,165,148,108,162,168,170,172,165,158,162,174,168,160,175],
    trendAPH: [133,135,137,139,141,143,145,146,147,148,151,154,157,158,160,162,163,165,166,167,168,169,170,171],
  },
  {
    county: 'Buffalo WI',
    crop: 'corn',
    years: [2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023],
    yields: [135,139,127,142,155,145,149,152,147,152,162,145,105,158,164,167,170,162,155,158,170,165,157,172],
    trendAPH: [130,132,134,136,138,140,142,143,144,145,148,151,154,155,157,159,161,163,164,165,166,167,168,169],
  },
  {
    county: 'Jackson WI',
    crop: 'corn',
    years: [2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023],
    yields: [131,135,123,138,151,141,145,148,143,148,158,142,100,155,160,163,167,160,152,155,166,162,154,168],
    trendAPH: [126,128,130,132,134,136,138,139,140,141,144,147,150,151,153,155,157,159,160,161,162,163,164,165],
  },
  {
    county: 'Houston MN',
    crop: 'corn',
    years: [2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023],
    yields: [141,145,133,148,161,151,155,158,153,158,168,150,110,165,170,172,175,168,160,163,175,170,162,178],
    trendAPH: [136,138,140,142,144,146,148,149,150,150,153,156,159,160,162,164,165,167,168,169,170,171,172,173],
  },
  {
    county: 'Trempealeau WI',
    crop: 'soybeans',
    years: [2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023],
    yields: [37,39,35,40,43,41,42,43,41,44,47,43,33,47,50,51,53,50,47,49,53,51,48,54],
    trendAPH: [36,37,38,39,40,41,41,42,42,42,43,44,45,45,46,47,48,48,49,49,50,50,51,51],
  },
  {
    county: 'Buffalo WI',
    crop: 'soybeans',
    years: [2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023],
    yields: [36,38,34,39,42,40,41,42,40,43,46,42,32,46,49,50,52,49,46,48,52,50,47,53],
    trendAPH: [35,36,37,38,39,40,40,41,41,41,42,43,44,44,45,46,47,47,48,48,49,49,50,50],
  },
  {
    county: 'Jackson WI',
    crop: 'soybeans',
    years: [2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023],
    yields: [35,37,33,38,41,39,40,41,39,42,45,41,31,45,48,49,51,48,45,47,51,49,46,52],
    trendAPH: [34,35,36,37,38,39,39,40,40,40,41,42,43,43,44,45,46,46,47,47,48,48,49,49],
  },
  {
    county: 'Houston MN',
    crop: 'soybeans',
    years: [2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023],
    yields: [38,40,36,41,44,42,43,44,42,46,49,44,34,48,51,52,54,51,48,50,54,52,49,55],
    trendAPH: [37,38,39,40,41,42,42,43,43,43,44,45,46,46,47,48,49,49,50,50,51,51,52,52],
  },
];

export function getCountyYields(county: string, crop: 'corn' | 'soybeans'): CountyYieldHistory | undefined {
  return COUNTY_YIELDS.find(c => c.county === county && c.crop === crop);
}

// ─── Price History ────────────────────────────────────────────────────────────
// Source: RMA historical projected/harvest prices
// https://www.rma.usda.gov/data/projected-harvest-prices
// ⚠️ ESTIMATED for older years — verify for recent crop years

export const CORN_PRICES: PriceHistory = {
  years:           [2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
  projectedPrices: [2.32, 2.46, 2.32, 2.42, 2.89, 2.32, 2.53, 4.06, 5.40, 4.04, 3.99, 6.01, 5.68, 5.65, 4.62, 3.86, 3.86, 3.96, 3.96, 4.00, 3.88, 4.58, 5.90, 4.90, 4.64, 4.70, 4.61],
  harvestPrices:   [1.85, 1.97, 2.32, 2.35, 2.06, 1.98, 3.03, 3.77, 4.10, 3.99, 5.32, 6.32, 7.50, 4.30, 3.49, 3.83, 3.49, 3.15, 3.60, 3.88, 4.30, 5.37, 6.70, 4.72, 4.10, 4.41, 0],  // 0 = not yet announced
};

export const SOYBEAN_PRICES: PriceHistory = {
  years:           [2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
  projectedPrices: [5.19, 5.50, 5.22, 6.13, 7.34, 6.29, 6.04, 8.24,13.36, 9.04, 8.70,13.49,12.55,12.87,11.36, 8.85, 8.85, 9.69,10.16, 9.54, 9.17,13.76,14.33,12.61,11.55,10.54,11.07],
  harvestPrices:   [4.72, 4.30, 5.48, 7.34, 5.74, 5.86, 6.69, 9.91, 9.54, 9.65,11.30,12.14,15.39,12.87, 9.65, 8.55, 9.72,10.15, 8.60, 9.25, 9.68,12.26,13.76,12.84,10.20,10.20, 0],
};

export function getPriceHistory(crop: 'corn' | 'soybeans'): PriceHistory {
  return crop === 'corn' ? CORN_PRICES : SOYBEAN_PRICES;
}

// How often harvest price < projected price (RP advantage)
export function calcRPAdvantageRate(crop: 'corn' | 'soybeans'): {
  rate: number;
  count: number;
  total: number;
  years: number[];
} {
  const history = getPriceHistory(crop);
  const years: number[] = [];
  let count = 0;
  let total = 0;
  for (let i = 0; i < history.years.length; i++) {
    const hp = history.harvestPrices[i];
    const pp = history.projectedPrices[i];
    if (hp > 0 && pp > 0) {
      total++;
      if (hp < pp) {
        count++;
        years.push(history.years[i]);
      }
    }
  }
  return { rate: total > 0 ? count / total : 0, count, total, years };
}

// ─── Hail Events (visualization only) ────────────────────────────────────────
// Source: NOAA Storm Events Database
// ⚠️ ESTIMATED/SAMPLE — pull from NOAA API for actual events
// Note: NO hail insurance rates — visualization only

export interface HailEvent {
  year: number;
  county: string;
  date: string;
  magnitude: number; // inches
  description: string;
}

export const HAIL_EVENTS_SAMPLE: HailEvent[] = [
  { year: 2011, county: 'Trempealeau WI', date: '2011-06-18', magnitude: 1.0, description: 'Hail to 1" across NE Trempealeau County' },
  { year: 2012, county: 'Trempealeau WI', date: '2012-07-01', magnitude: 0.75, description: 'Scattered hail with severe storms' },
  { year: 2014, county: 'Trempealeau WI', date: '2014-07-12', magnitude: 1.25, description: 'Hail to 1.25" with storm damage' },
  { year: 2016, county: 'Trempealeau WI', date: '2016-06-22', magnitude: 1.0, description: 'Hail and wind damage' },
  { year: 2018, county: 'Trempealeau WI', date: '2018-06-29', magnitude: 0.75, description: 'Hail with severe thunderstorm' },
  { year: 2019, county: 'Trempealeau WI', date: '2019-07-10', magnitude: 1.5, description: 'Large hail to 1.5" in south county' },
  { year: 2021, county: 'Trempealeau WI', date: '2021-07-05', magnitude: 0.88, description: 'Penny-sized hail with storms' },
  { year: 2023, county: 'Trempealeau WI', date: '2023-08-02', magnitude: 1.0, description: 'Hail to 1" with late season storms' },
  // Buffalo
  { year: 2012, county: 'Buffalo WI', date: '2012-07-02', magnitude: 1.0, description: 'Hail event, Buffalo County' },
  { year: 2019, county: 'Buffalo WI', date: '2019-07-11', magnitude: 1.25, description: 'Hail 1.25" Buffalo County' },
  // Jackson
  { year: 2015, county: 'Jackson WI', date: '2015-06-30', magnitude: 0.75, description: 'Hail with severe storms Jackson County' },
  { year: 2020, county: 'Jackson WI', date: '2020-07-15', magnitude: 1.0, description: 'Hail 1.0" Jackson County' },
  // Houston MN
  { year: 2013, county: 'Houston MN', date: '2013-07-08', magnitude: 0.88, description: 'Hail Houston County MN' },
  { year: 2017, county: 'Houston MN', date: '2017-08-01', magnitude: 1.0, description: 'Hail 1.0" Houston County MN' },
];

export function getHailEvents(county: string): HailEvent[] {
  return HAIL_EVENTS_SAMPLE.filter(e => e.county === county);
}

// ─── Key Dates ────────────────────────────────────────────────────────────────

export const KEY_DATES_2026 = [
  {
    id: 'price-discovery-close',
    label: 'Price Discovery Closes',
    date: new Date('2026-02-28'),
    urgency: 'high' as const,
    description: 'Final date for December/November CME futures to count toward projected price calculation.',
  },
  {
    id: 'projected-price-announced',
    label: 'Projected Prices Announced',
    date: new Date('2026-03-05'),
    urgency: 'normal' as const,
    description: 'RMA announces final 2026 projected prices for corn and soybeans.',
  },
  {
    id: 'sales-closing',
    label: 'Sales Closing Date',
    date: new Date('2026-03-15'),
    urgency: 'urgent' as const,
    description: 'HARD DEADLINE — Last day to buy, change, or add coverage for 2026 corn and soybeans. No exceptions.',
  },
  {
    id: 'bfr-deadline',
    label: 'BFR Application Deadline',
    date: new Date('2026-03-15'),
    urgency: 'urgent' as const,
    description: 'Last day to apply for Beginning Farmer & Rancher premium subsidy benefits.',
  },
  {
    id: 'production-reporting',
    label: 'Production Reporting Due',
    date: new Date('2026-04-29'),
    urgency: 'normal' as const,
    description: 'Submit 2025 actual yields to update APH database.',
  },
  {
    id: 'acreage-reporting',
    label: 'Acreage Report Deadline',
    date: new Date('2026-07-15'),
    urgency: 'normal' as const,
    description: 'Report actual 2026 planted acres at FSA/USDA.',
  },
  {
    id: 'premium-billing',
    label: 'Premium Billing Date',
    date: new Date('2026-08-15'),
    urgency: 'normal' as const,
    description: 'Premium due date. Unpaid premiums trigger cancellation.',
  },
  {
    id: 'harvest-price',
    label: 'Harvest Price Announced',
    date: new Date('2026-11-05'),
    urgency: 'normal' as const,
    description: 'RMA announces final 2026 harvest price for corn and soybeans.',
  },
];

export function getDaysUntil(date: Date): number {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
