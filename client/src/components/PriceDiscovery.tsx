import React, { useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend, Cell,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { YEARS, CORN_PROJ_PRICES, CORN_HARV_PRICES, SOY_PROJ_PRICES, SOY_HARV_PRICES } from '../lib/historicalData';
import type { DataSourcesState } from '../hooks/useDataSources';

interface Props { dataSources: DataSourcesState; }

export default function PriceDiscovery({ dataSources }: Props) {
  const { inputs } = useApp();
  const { crop, springPrice } = inputs;

  const projPrices = crop === 'corn' ? CORN_PROJ_PRICES : SOY_PROJ_PRICES;
  const harvPrices = crop === 'corn' ? CORN_HARV_PRICES : SOY_HARV_PRICES;

  const historicalData = YEARS.map((year, i) => ({
    year,
    projPrice: projPrices[i],
    harvPrice: harvPrices[i],
    priceDrop: harvPrices[i] < projPrices[i],
    priceDiff: Math.round((harvPrices[i] - projPrices[i]) * 100) / 100,
  }));

  const belowProjCount = historicalData.filter(d => d.priceDrop).length;
  const rpAdvantage = historicalData
    .filter(d => d.priceDrop)
    .reduce((sum, d) => sum + Math.abs(d.priceDiff), 0) / historicalData.length;

  // 2-year price history from dataSources (if available)
  const liveHistory = crop === 'corn' ? dataSources.cornHistory : dataSources.soyHistory;
  const recentPrices = liveHistory?.points?.slice(-90) ?? [];
  const vol30 = liveHistory?.volatility30d ?? null;
  const vol90 = liveHistory?.volatility90d ?? null;

  const wasde = dataSources.wasde;
  const outlookColor = wasde?.outlook === 'Bullish' ? 'text-emerald-400'
    : wasde?.outlook === 'Bearish' ? 'text-red-400' : 'text-amber-400';
  const outlookIcon = wasde?.outlook === 'Bullish' ? '📈' : wasde?.outlook === 'Bearish' ? '📉' : '📊';

  return (
    <div className="space-y-4">
      {/* Header cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-lg">
          <div className="text-xs text-slate-400 mb-1">Spring Price (current)</div>
          <div className="text-2xl font-black text-blue-400">${springPrice.toFixed(2)}</div>
          <div className="text-xs text-slate-500 mt-1">
            {dataSources.prices?.source === 'live' ? '📡 CME live' : '📋 Manual input'}
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-lg">
          <div className="text-xs text-slate-400 mb-1">Harvest &lt; Projected</div>
          <div className="text-2xl font-black text-amber-400">{belowProjCount}<span className="text-slate-500 text-sm font-normal"> / {YEARS.length} yrs</span></div>
          <div className="text-xs text-slate-500 mt-1">RP advantage years</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-lg">
          <div className="text-xs text-slate-400 mb-1">RP Avg Advantage</div>
          <div className="text-2xl font-black text-emerald-400">${rpAdvantage.toFixed(2)}/bu</div>
          <div className="text-xs text-slate-500 mt-1">vs. YP in down-price years</div>
        </div>
        {wasde ? (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-lg">
            <div className="text-xs text-slate-400 mb-1">WASDE Market Outlook</div>
            <div className={`text-2xl font-black ${outlookColor}`}>{outlookIcon} {wasde.outlook}</div>
            <div className="text-xs text-slate-500 mt-1">S/U: {wasde.stocksToUse.toFixed(1)}%</div>
          </div>
        ) : (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-lg">
            <div className="text-xs text-slate-400 mb-1">30/90-Day Volatility</div>
            <div className="text-2xl font-black text-purple-400">
              {vol30 ? `${vol30}%` : '—'}
            </div>
            <div className="text-xs text-slate-500 mt-1">Annualized{vol90 ? ` | 90d: ${vol90}%` : ''}</div>
          </div>
        )}
      </div>

      {/* Projected vs Harvest price history */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
        <h3 className="text-slate-100 font-bold text-sm mb-4">
          Projected vs Harvest Price — 2009–2023
          <span className="ml-2 text-xs text-slate-400 font-normal">Red = harvest below projected (RP pays more)</span>
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={historicalData} margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="year" stroke="#64748b" tick={{ fontSize: 11 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
            <Tooltip
              contentStyle={{ background:'#1e293b', border:'1px solid #475569', borderRadius:'8px', fontSize:'12px' }}
              formatter={(v: number, name: string) => [`$${v.toFixed(2)}/bu`, name]}
            />
            <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
            {historicalData.map((d, i) => d.priceDrop && (
              <ReferenceLine key={i} x={d.year} stroke="#ef444440" strokeWidth={20} />
            ))}
            <Line type="monotone" dataKey="projPrice" name="Spring Proj Price" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="harvPrice" name="Harvest Price" stroke="#f87171" strokeWidth={2} dot={{ r: 3 }} />
            <ReferenceLine y={springPrice} stroke="#34d39960" strokeDasharray="5 3" label={{ value: 'Current', fill:'#34d399', fontSize:10 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Price difference bar chart */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
        <h3 className="text-slate-100 font-bold text-sm mb-4">
          Price Spread (Harvest − Projected)
          <span className="ml-2 text-xs text-red-400 font-normal">Red bars = RP advantage over YP</span>
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={historicalData} margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="year" stroke="#64748b" tick={{ fontSize: 11 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
            <Tooltip
              contentStyle={{ background:'#1e293b', border:'1px solid #475569', borderRadius:'8px', fontSize:'12px' }}
              formatter={(v: number) => [`$${v.toFixed(2)}/bu`, 'Harvest − Projected']}
            />
            <ReferenceLine y={0} stroke="#475569" />
            <Bar dataKey="priceDiff" name="Price Spread">
              {historicalData.map((d, i) => (
                <Cell key={i} fill={d.priceDrop ? '#ef4444' : '#22c55e'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent 90-day price chart if available */}
      {recentPrices.length > 20 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-100 font-bold text-sm">
              {crop === 'corn' ? 'ZC=F' : 'ZS=F'} — Last 90 Days
              <span className="ml-2 text-xs text-emerald-400 font-normal">📡 Live CME Data</span>
            </h3>
            {vol30 && (
              <div className="text-xs text-slate-400">
                Vol 30d: <span className="text-purple-400 font-bold">{vol30}%</span>
                {vol90 && <> | 90d: <span className="text-purple-400 font-bold">{vol90}%</span></>}
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={recentPrices} margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} interval={14} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
              <Tooltip
                contentStyle={{ background:'#1e293b', border:'1px solid #475569', borderRadius:'8px', fontSize:'12px' }}
                formatter={(v: number) => [`$${v.toFixed(2)}/bu`, 'Price']}
              />
              <ReferenceLine y={springPrice} stroke="#60a5fa80" strokeDasharray="4 2" label={{ value: 'Spring', fill:'#60a5fa', fontSize:10 }} />
              <Line type="monotone" dataKey="close" name="Price" stroke="#60a5fa" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* WASDE detail if available */}
      {wasde && wasde.stocksToUse > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl">
          <h3 className="text-slate-100 font-bold text-sm mb-3">WASDE Market Outlook — {wasde.marketYear}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="bg-slate-900 rounded-xl p-3 text-center">
              <div className="text-slate-400 mb-1">Stocks-to-Use</div>
              <div className={`text-xl font-black ${outlookColor}`}>{wasde.stocksToUse.toFixed(1)}%</div>
            </div>
            <div className="bg-slate-900 rounded-xl p-3 text-center">
              <div className="text-slate-400 mb-1">Production (MMT)</div>
              <div className="text-xl font-black text-slate-300">{(wasde.production / 1000).toFixed(0)}</div>
            </div>
            <div className="bg-slate-900 rounded-xl p-3 text-center">
              <div className="text-slate-400 mb-1">Total Use (MMT)</div>
              <div className="text-xl font-black text-slate-300">{(wasde.totalUse / 1000).toFixed(0)}</div>
            </div>
            <div className="bg-slate-900 rounded-xl p-3 text-center">
              <div className="text-slate-400 mb-1">Outlook</div>
              <div className={`text-xl font-black ${outlookColor}`}>{outlookIcon} {wasde.outlook}</div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Stocks-to-use guide — {crop === 'corn' ? 'Corn: Bullish <8%, Bearish >15%' : 'Soybeans: Bullish <5%, Bearish >10%'}
          </p>
        </div>
      )}
    </div>
  );
}
