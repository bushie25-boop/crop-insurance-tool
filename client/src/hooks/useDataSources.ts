/**
 * useDataSources.ts — Parallel data fetch on mount with loading progress.
 * All fetches are fire-and-forget; failures populate with null.
 */
import { useState, useEffect, useRef } from 'react';
import type { County, CropType } from '../lib/insurance';
import {
  fetchCurrentPrices, fetchPriceHistory,
  fetchNASSYields, fetchPlantedHarvested,
  fetchNOAAHail, fetchDroughtHistory,
  fetchRMACauseOfLoss, fetchWASDE, fetchRMAPremiums,
  fetchCropProgress, COUNTY_FIPS,
  type PriceFetchResult, type PriceHistory, type USDAYieldRow,
  type PlantedHarvestedRow, type NoaaHailEvent,
  type DroughtRecord, type RMACauseOfLossRow,
  type WASDEData, type RMAPremiumData, type CropProgressRow,
} from '../lib/dataSources';

export type SourceStatus = 'loading' | 'live' | 'cached' | 'estimate';

export interface SourceInfo {
  name: string;
  status: SourceStatus;
  lastUpdated: number | null;
}

export interface DataSourcesState {
  prices: PriceFetchResult | null;
  cornHistory: PriceHistory | null;
  soyHistory: PriceHistory | null;
  nassYields: USDAYieldRow[] | null;
  plantedHarvested: PlantedHarvestedRow[] | null;
  noaaHail: NoaaHailEvent[] | null;
  drought: DroughtRecord[] | null;
  rmaLoss: RMACauseOfLossRow[] | null;
  wasde: WASDEData | null;
  rmaPremiums: RMAPremiumData[] | null;
  cropProgress: CropProgressRow[] | null;
  sources: SourceInfo[];
  loadingProgress: number; // 0-100
  allDone: boolean;
  refresh: () => void;
}

const STATE_ALPHA: Record<string, string> = {
  'Trempealeau WI': 'WI', 'Buffalo WI': 'WI', 'Jackson WI': 'WI', 'Houston MN': 'MN',
};
const STATE_CODE: Record<string, string> = {
  'Trempealeau WI': '55', 'Buffalo WI': '55', 'Jackson WI': '55', 'Houston MN': '27',
};
const COUNTY_CODE: Record<string, string> = {
  'Trempealeau WI': '121', 'Buffalo WI': '011', 'Jackson WI': '053', 'Houston MN': '055',
};
const NOAA_STATE: Record<string, string> = {
  'Trempealeau WI': 'WI', 'Buffalo WI': 'WI', 'Jackson WI': 'WI', 'Houston MN': 'MN',
};

function makeSource(name: string, status: SourceStatus = 'loading'): SourceInfo {
  return { name, status, lastUpdated: null };
}

export function useDataSources(county: County, crop: CropType): DataSourcesState {
  const [state, setState] = useState<DataSourcesState>({
    prices: null, cornHistory: null, soyHistory: null,
    nassYields: null, plantedHarvested: null, noaaHail: null,
    drought: null, rmaLoss: null, wasde: null, rmaPremiums: null,
    cropProgress: null,
    sources: [
      makeSource('CME Futures'),
      makeSource('Price History'),
      makeSource('USDA NASS Yields'),
      makeSource('Planted/Harvested'),
      makeSource('NOAA Hail Events'),
      makeSource('Drought Monitor'),
      makeSource('RMA Cause of Loss'),
      makeSource('WASDE / Market'),
      makeSource('RMA Premiums'),
      makeSource('Crop Progress'),
    ],
    loadingProgress: 0,
    allDone: false,
    refresh: () => {},
  });

  const refreshRef = useRef(0);

  const runFetch = async () => {
    const version = ++refreshRef.current;
    const total = 10;
    let done = 0;

    const tick = (idx: number, status: SourceStatus, data?: unknown) => {
      if (refreshRef.current !== version) return;
      done++;
      setState(prev => {
        const sources = [...prev.sources];
        sources[idx] = { ...sources[idx], status, lastUpdated: Date.now() };
        return { ...prev, sources, loadingProgress: Math.round((done / total) * 100) };
      });
    };

    const update = (key: keyof DataSourcesState, val: unknown) => {
      if (refreshRef.current !== version) return;
      setState(prev => ({ ...prev, [key]: val }));
    };

    const fips = COUNTY_FIPS[county] ?? '55121';
    const stateAlpha = STATE_ALPHA[county] ?? 'WI';
    const stateCode = STATE_CODE[county] ?? '55';
    const countyCode = COUNTY_CODE[county] ?? '121';
    const noaaState = NOAA_STATE[county] ?? 'WI';
    const countyShort = county.split(' ')[0];

    // All fetches run in parallel
    const tasks = [
      fetchCurrentPrices().then(r => {
        update('prices', r); tick(0, r ? (r.source === 'live' ? 'live' : 'cached') : 'estimate');
      }),
      Promise.all([fetchPriceHistory('ZC=F'), fetchPriceHistory('ZS=F')]).then(([ch, sh]) => {
        update('cornHistory', ch); update('soyHistory', sh);
        tick(1, ch ? 'live' : 'estimate');
      }),
      fetchNASSYields(countyShort, crop, stateAlpha).then(r => {
        update('nassYields', r); tick(2, r ? 'live' : 'estimate');
      }),
      fetchPlantedHarvested(stateAlpha, crop).then(r => {
        update('plantedHarvested', r); tick(3, r ? 'live' : 'estimate');
      }),
      fetchNOAAHail(countyShort, noaaState).then(r => {
        update('noaaHail', r); tick(4, r ? 'live' : 'estimate');
      }),
      fetchDroughtHistory(fips).then(r => {
        update('drought', r); tick(5, r ? 'live' : 'estimate');
      }),
      fetchRMACauseOfLoss(stateCode, countyCode, crop).then(r => {
        update('rmaLoss', r); tick(6, r ? 'live' : 'estimate');
      }),
      fetchWASDE(crop).then(r => {
        update('wasde', r); tick(7, r ? 'live' : 'estimate');
      }),
      fetchRMAPremiums(stateCode, countyCode, crop).then(r => {
        update('rmaPremiums', r); tick(8, r ? 'live' : 'estimate');
      }),
      fetchCropProgress(stateAlpha, crop).then(r => {
        update('cropProgress', r); tick(9, r ? 'live' : 'estimate');
      }),
    ];

    await Promise.allSettled(tasks);
    if (refreshRef.current === version) {
      setState(prev => ({ ...prev, allDone: true, loadingProgress: 100 }));
    }
  };

  useEffect(() => {
    setState(prev => ({
      ...prev, allDone: false, loadingProgress: 0,
      sources: prev.sources.map(s => ({ ...s, status: 'loading' as SourceStatus })),
    }));
    runFetch();
  }, [county, crop]);

  useEffect(() => {
    setState(prev => ({ ...prev, refresh: runFetch }));
  }, [county, crop]);

  return state;
}
