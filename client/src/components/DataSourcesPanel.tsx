import React from 'react';
import type { DataSourcesState } from '../hooks/useDataSources';
import { cacheClear } from '../lib/dataSources';

interface Props { dataSources: DataSourcesState; }

const STATUS_CONFIG = {
  loading: { icon: '⏳', color: 'text-slate-400', bg: 'bg-slate-800' },
  live:    { icon: '✅', color: 'text-emerald-400', bg: 'bg-emerald-950' },
  cached:  { icon: '⚠️', color: 'text-amber-400',  bg: 'bg-amber-950' },
  estimate:{ icon: '❌', color: 'text-slate-500',   bg: 'bg-slate-900' },
};

export default function DataSourcesPanel({ dataSources }: Props) {
  const { sources, loadingProgress, allDone, refresh } = dataSources;

  const liveCount = sources.filter(s => s.status === 'live').length;
  const cachedCount = sources.filter(s => s.status === 'cached').length;

  const handleRefresh = () => {
    cacheClear();
    refresh();
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-slate-300 font-bold text-sm">Data Sources</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {liveCount} live · {cachedCount} cached · {sources.length - liveCount - cachedCount} estimated
          </span>
          <button
            onClick={handleRefresh}
            className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1 rounded-lg transition-colors"
          >
            🔄 Refresh All
          </button>
        </div>
      </div>

      {/* Loading progress bar */}
      {!allDone && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Loading data...</span>
            <span>{loadingProgress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-700">
            <div
              className="h-1.5 rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {sources.map((source, i) => {
          const cfg = STATUS_CONFIG[source.status];
          return (
            <div key={i} className={`${cfg.bg} rounded-lg px-3 py-2 flex items-center gap-2`}>
              <span className="text-sm">{cfg.icon}</span>
              <div>
                <div className={`text-xs font-medium ${cfg.color}`}>{source.name}</div>
                {source.lastUpdated && source.status !== 'loading' && (
                  <div className="text-[10px] text-slate-600">
                    {new Date(source.lastUpdated).toLocaleTimeString()}
                  </div>
                )}
                {source.status === 'loading' && (
                  <div className="text-[10px] text-slate-600">fetching...</div>
                )}
                {source.status === 'estimate' && (
                  <div className="text-[10px] text-slate-600">using estimates</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
