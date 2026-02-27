// DataSourcesPanel.tsx — API data source status panel
import React from 'react';
import type { DataSourcesState } from '../hooks/useDataSources';
import { getStatusBadge } from '../lib/dataSources';

interface Props {
  dataSources: DataSourcesState;
}

export default function DataSourcesPanel({ dataSources }: Props) {
  const sources = [
    { ...dataSources.nassSource, label: 'County Yields (NASS)' },
    { ...dataSources.cornFuturesSource, label: 'Corn Futures' },
    { ...dataSources.soyFuturesSource, label: 'Soybean Futures' },
    { ...dataSources.hailSource, label: 'Hail Events (NOAA)' },
  ];

  return (
    <div className="bg-slate-800 rounded-xl p-3">
      <h3 className="text-white font-semibold text-sm mb-2">🔌 Data Sources</h3>
      <div className="flex flex-wrap gap-2">
        {sources.map(src => (
          <div key={src.label} className="bg-slate-700 rounded px-2 py-1 text-xs">
            <span className="text-slate-400">{src.label}:</span>
            <span className={`ml-1 font-semibold ${src.status === 'live' ? 'text-green-400' : src.status === 'cached' ? 'text-yellow-400' : 'text-slate-400'}`}>
              {getStatusBadge(src.status)}
            </span>
            {src.lastUpdated && (
              <span className="text-slate-500 ml-1">
                {new Date(src.lastUpdated).toLocaleTimeString()}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="text-xs text-slate-500 mt-2">
        ✅ Live = fetched now · ⚠️ Cached = localStorage · 📊 Estimated = hardcoded fallback
      </div>
    </div>
  );
}
