// useDataSources.ts — data fetching hook with status tracking
import { useState, useEffect } from 'react';
import {
  fetchNASSYields,
  fetchFutures,
  fetchHailEvents,
  type DataSourceInfo,
  type NASSObs,
  type FuturesData,
  type NOAAHailEvent,
} from '../lib/dataSources';
import { getCountyYields, getHailEvents, type HailEvent } from '../lib/historicalData';

export interface DataSourcesState {
  nassYields: NASSObs[];
  nassSource: DataSourceInfo;
  cornFutures: FuturesData | null;
  cornFuturesSource: DataSourceInfo;
  soyFutures: FuturesData | null;
  soyFuturesSource: DataSourceInfo;
  hailEvents: (NOAAHailEvent | HailEvent)[];
  hailSource: DataSourceInfo;
  loading: boolean;
}

export function useDataSources(county: string, crop: 'corn' | 'soybeans'): DataSourcesState {
  const [state, setState] = useState<DataSourcesState>({
    nassYields: [],
    nassSource: { name: 'USDA NASS', status: 'estimated' },
    cornFutures: null,
    cornFuturesSource: { name: 'CME Futures', status: 'estimated' },
    soyFutures: null,
    soyFuturesSource: { name: 'CME Futures', status: 'estimated' },
    hailEvents: [],
    hailSource: { name: 'NOAA Storm Events', status: 'estimated' },
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState(s => ({ ...s, loading: true }));

      const [nassResult, cornResult, soyResult, hailResult] = await Promise.allSettled([
        fetchNASSYields(county, crop),
        fetchFutures('corn'),
        fetchFutures('soybeans'),
        fetchHailEvents(county),
      ]);

      if (cancelled) return;

      // NASS yields
      let nassYields: NASSObs[] = [];
      let nassSource: DataSourceInfo = { name: 'USDA NASS', status: 'estimated' };
      if (nassResult.status === 'fulfilled' && nassResult.value.observations.length > 0) {
        nassYields = nassResult.value.observations;
        nassSource = nassResult.value.source;
      } else {
        // Use hardcoded fallback
        const fallback = getCountyYields(county, crop);
        if (fallback) {
          nassYields = fallback.years.map((yr, i) => ({ year: yr, value: fallback.yields[i] }));
        }
      }

      // Futures
      const cornFutures = cornResult.status === 'fulfilled' ? cornResult.value.data : null;
      const cornFuturesSource = cornResult.status === 'fulfilled'
        ? cornResult.value.source
        : { name: 'CME Futures', status: 'estimated' as const };

      const soyFutures = soyResult.status === 'fulfilled' ? soyResult.value.data : null;
      const soyFuturesSource = soyResult.status === 'fulfilled'
        ? soyResult.value.source
        : { name: 'CME Futures', status: 'estimated' as const };

      // Hail events — use hardcoded if API fails
      let hailEvents: (NOAAHailEvent | HailEvent)[] = [];
      let hailSource: DataSourceInfo = { name: 'NOAA Storm Events', status: 'estimated' };
      if (hailResult.status === 'fulfilled' && hailResult.value.events.length > 0) {
        hailEvents = hailResult.value.events;
        hailSource = hailResult.value.source;
      } else {
        hailEvents = getHailEvents(county);
      }

      setState({
        nassYields,
        nassSource,
        cornFutures,
        cornFuturesSource,
        soyFutures,
        soyFuturesSource,
        hailEvents,
        hailSource,
        loading: false,
      });
    }

    load();
    return () => { cancelled = true; };
  }, [county, crop]);

  return state;
}
