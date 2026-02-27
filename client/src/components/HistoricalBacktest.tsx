// HistoricalBacktest.tsx — 15-year backtest with stacked bar chart
import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, ComposedChart, ReferenceLine, ResponsiveContainer
} from 'recharts';
import type { InsuranceState } from '../hooks/useInsurance';
import { getHailEvents } from '../lib/historicalData';

interface Props {
  state: InsuranceState;
}

function fmt(n: number, dec = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

const WINDOW_OPTIONS: Array<{ label: string; value: import('../hooks/useInsurance').BacktestWindow }> = [
  { label: '5 yr', value: 5 },
  { label: '10 yr', value: 10 },
  { label: '15 yr', value: 15 },
  { label: '20 yr', value: 20 },
  { label: '25 yr', value: 25 },
  { label: 'All (25)', value: 'all' },
];

export default function HistoricalBacktest({ state }: Props) {
  const { backtestYears, backtestSummary, inputs, backtestWindow, setBacktestWindow } = state;
  const hailEvents = getHailEvents(inputs.county);
  const [showExplainer, setShowExplainer] = useState(false);

  if (!backtestYears.length) {
    return (
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="text-white font-bold text-lg mb-2">📊 Historical Backtest</h3>
        <div className="text-slate-400">Loading backtest data...</div>
      </div>
    );
  }

  // Build chart data with cumulative net
  let cumNet = 0;
  const chartData = backtestYears.map(yr => {
    cumNet += yr.netPerAcre;
    const hailEvt = hailEvents.find(h => h.year === yr.year);
    return {
      year: yr.year,
      underlying: parseFloat(yr.underlyingIndemnity.toFixed(2)),
      sco: parseFloat(yr.scoIndemnity.toFixed(2)),
      eco: parseFloat(yr.ecoIndemnity.toFixed(2)),
      premium: -parseFloat(yr.totalPremium.toFixed(2)),
      netPerAcre: parseFloat(yr.netPerAcre.toFixed(2)),
      cumulativeNet: parseFloat(cumNet.toFixed(2)),
      countyYield: yr.countyYield,
      countyAPH: yr.countyAPH,
      revenueRatio: parseFloat((yr.countyRevenueRatio * 100).toFixed(1)),
      projPrice: yr.projPrice,
      harvPrice: yr.harvPrice,
      hail: hailEvt ? hailEvt.magnitude : undefined,
      expectedRevenue: parseFloat(yr.expectedRevenue.toFixed(2)),
      actualRevenue: parseFloat(yr.actualRevenue.toFixed(2)),
      revenueShortfall: parseFloat(yr.revenueShortfall.toFixed(2)),
    };
  });

  // Cause-of-loss summary counts
  const yieldOnlyYears = backtestYears.filter(y =>
    y.causeTags.includes('Yield ↓') && !y.causeTags.includes('Price ↓') && !y.causeTags.includes('Price ↑ (RP)')
  ).length;
  const priceOnlyYears = backtestYears.filter(y =>
    y.causeTags.includes('Price ↓') && !y.causeTags.includes('Yield ↓')
  ).length;
  const bothYears = backtestYears.filter(y =>
    y.causeTags.includes('Yield ↓') && y.causeTags.includes('Price ↓')
  ).length;

  // Worst year by revenue ratio
  const worstYear = backtestYears.reduce((prev, cur) =>
    cur.countyRevenueRatio < prev.countyRevenueRatio ? cur : prev, backtestYears[0]);
  const lowestRatio = parseFloat((worstYear.countyRevenueRatio * 100).toFixed(1));

  const { underlyingTriggers, scoTriggers, ecoTriggers, anyTriggers, years,
    avgFarmerPremium, avgTotalIndemnity, avgNetPerAcre } = backtestSummary;

  // Compute year range for subtitle
  const firstYear = backtestYears.length > 0 ? backtestYears[0].year : null;
  const lastYear = backtestYears.length > 0 ? backtestYears[backtestYears.length - 1].year : null;
  const yearRangeLabel = firstYear && lastYear ? `${firstYear}–${lastYear} (${years} years)` : `${years} years`;

  return (
    <div className="bg-slate-800 rounded-xl p-4 space-y-5">
      <div>
        <h3 className="text-white font-bold text-lg mb-1">📊 Historical Backtest ({years} Years)</h3>
        {/* Year range selector */}
        <div className="flex flex-wrap gap-1 my-2">
          {WINDOW_OPTIONS.map(opt => (
            <button
              key={String(opt.value)}
              onClick={() => setBacktestWindow(opt.value)}
              className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                backtestWindow === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400">
          Using {inputs.county} county yields · {inputs.planType} {Math.round(inputs.coverageLevel * 100)}% ·
          {yearRangeLabel} · 📊 Estimated
        </p>
      </div>

      {/* How this works explainer */}
      <div>
        <button
          onClick={() => setShowExplainer(v => !v)}
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          ℹ️ How trigger rate is calculated {showExplainer ? '▴' : '▾'}
        </button>
        {showExplainer && (
          <div className="mt-2 p-3 bg-slate-900/50 rounded-lg text-xs text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300 mb-1">How the backtest works:</div>
            <div>• Each year uses actual Trempealeau/Buffalo/Jackson/Houston county yields from USDA NASS paired with real RMA projected and harvest prices for that year.</div>
            <div>• Underlying policy (YP/RP/RP-HPE): triggers when county revenue (county yield × harvest price) falls short of your farm guarantee (APH × coverage% × price). County yield is used as a farm yield proxy — individual farm data varies.</div>
            <div>• SCO triggers when county revenue ratio (actual county revenue ÷ expected county revenue) falls below 86%.</div>
            <div>• ECO triggers when county revenue ratio falls below 90% (ECO-90) or 95% (ECO-95).</div>
            <div>• A bad county yield year (like 2012 drought: 108 bu/ac vs ~157 trend) drops the revenue ratio to ~69% — triggering underlying, SCO, and ECO all at once.</div>
            <div>• Premium is your estimated farmer net cost each year (recalculated at that year's projected price).</div>
            <div>• Net = indemnity received − premium paid. Cumulative net shows whether the policy "paid off" over time.</div>
            <div className="mt-2 text-amber-400">⚠️ County yield used as farm proxy. Your individual farm yield may differ significantly from county average — especially on variable terrain like western WI bluffs.</div>
          </div>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-black text-white">{anyTriggers}/{years}</div>
          <div className="text-xs text-slate-400">Years triggered any payment</div>
          <div className="text-sm text-slate-300">{Math.round((anyTriggers/years)*100)}% rate</div>
          <div className="text-xs text-slate-500 mt-1">Worst: {worstYear.year} ({lowestRatio}%)</div>
        </div>
        <div className="bg-slate-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-black text-yellow-400">${fmt(avgFarmerPremium)}/ac</div>
          <div className="text-xs text-slate-400">Avg farmer premium/yr</div>
        </div>
        <div className="bg-slate-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-black text-blue-400">${fmt(avgTotalIndemnity)}/ac</div>
          <div className="text-xs text-slate-400">Avg indemnity/yr</div>
        </div>
        <div className={`bg-slate-700 rounded-lg p-3 text-center`}>
          <div className={`text-2xl font-black ${avgNetPerAcre >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {avgNetPerAcre >= 0 ? '+' : ''}${fmt(avgNetPerAcre)}/ac
          </div>
          <div className="text-xs text-slate-400">Avg net/year</div>
        </div>
      </div>

      {inputs.scoEnabled && (
        <div className="text-xs text-purple-300">
          SCO triggered: {scoTriggers}/{years} years ({Math.round((scoTriggers/years)*100)}%)
          {inputs.ecoLevel !== 'None' && ` · ECO triggered: ${ecoTriggers}/${years} years`}
        </div>
      )}

      {/* Bar chart */}
      <div>
        <div className="text-sm text-slate-400 mb-2">Indemnity by Year (stacked) vs. Premium Cost</div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={v => `$${v}`} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
              labelStyle={{ color: '#fff', fontWeight: 'bold' }}
              formatter={(v: number, name: string) => [`$${fmt(Math.abs(v))}/ac`, name]}
            />
            <Legend />
            <ReferenceLine y={0} stroke="#64748b" />
            <Bar dataKey="premium" name="Premium cost" fill="#ef4444" opacity={0.7} />
            <Bar dataKey="underlying" name="Underlying indemnity" fill="#3b82f6" stackId="indemnity" />
            {inputs.scoEnabled && (
              <Bar dataKey="sco" name="SCO indemnity" fill="#a855f7" stackId="indemnity" />
            )}
            {inputs.ecoLevel !== 'None' && (
              <Bar dataKey="eco" name="ECO indemnity" fill="#14b8a6" stackId="indemnity" />
            )}
            <Line dataKey="cumulativeNet" name="Cumulative net" stroke="#f59e0b" strokeWidth={2}
              dot={{ fill: '#f59e0b', r: 3 }} type="monotone" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* County Yield vs Expected (Trend) Yield chart */}
      <div>
        <div className="text-sm text-slate-400 mb-2">County Yield vs Expected (Trend) Yield</div>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
            <YAxis
              tick={{ fill: '#9CA3AF', fontSize: 11 }}
              tickFormatter={v => `${v}`}
              label={{ value: 'bu/ac', angle: -90, position: 'insideLeft', fill: '#9CA3AF', fontSize: 11, offset: 10 }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload as { countyYield: number; countyAPH: number; revenueRatio: number };
                const ratio = d.revenueRatio;
                const ratioColor = ratio < 86 ? '#f87171' : ratio < 95 ? '#fbbf24' : '#4ade80';
                const trigger = ratio < 86 ? ' ← below 86%, SCO triggered' : ratio < 95 ? ' ← below 95%' : '';
                return (
                  <div style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                    <div style={{ color: '#fff', fontWeight: 'bold', marginBottom: 4 }}>Year: {label}</div>
                    <div style={{ color: '#22c55e' }}>Actual Yield: {d.countyYield} bu/ac</div>
                    <div style={{ color: '#94a3b8' }}>Expected Yield: {d.countyAPH} bu/ac</div>
                    <div style={{ color: ratioColor }}>Revenue Ratio: {ratio}%{trigger}</div>
                  </div>
                );
              }}
            />
            <Legend />
            <Line dataKey="countyAPH" name="Expected (Trend)" stroke="#94a3b8" strokeWidth={2}
              strokeDasharray="4 4" dot={false} type="monotone" />
            <Line dataKey="countyYield" name="Actual County Yield" stroke="#22c55e" strokeWidth={2}
              dot={{ fill: '#22c55e', r: 3 }} type="monotone" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Expected vs Actual Revenue chart */}
      <div>
        <div className="text-sm text-slate-400 mb-2">Expected vs Actual Revenue ($/ac)</div>
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={v => `$${v}`} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: '#f97316', fontSize: 11 }} tickFormatter={v => `$${v}`} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
              labelStyle={{ color: '#fff', fontWeight: 'bold' }}
              formatter={(v: number, name: string) => [`$${fmt(v, 0)}/ac`, name]}
            />
            <Legend />
            <ReferenceLine yAxisId="right" y={0} stroke="#64748b" />
            <Bar yAxisId="left" dataKey="expectedRevenue" name="Expected Revenue" fill="#475569" />
            <Bar yAxisId="left" dataKey="actualRevenue" name="Actual Revenue" fill="#3b82f6" />
            <Line yAxisId="right" dataKey="revenueShortfall" name="Shortfall" stroke="#f97316"
              strokeWidth={2} strokeDasharray="3 3" dot={{ fill: '#f97316', r: 3 }} type="monotone" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Cause-of-loss summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-black text-red-400">{yieldOnlyYears}</div>
          <div className="text-xs text-slate-400">Yield-driven losses</div>
        </div>
        <div className="bg-orange-900/20 border border-orange-700/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-black text-orange-400">{priceOnlyYears}</div>
          <div className="text-xs text-slate-400">Price-driven losses</div>
        </div>
        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-black text-yellow-400">{bothYears}</div>
          <div className="text-xs text-slate-400">Both (yield + price)</div>
        </div>
      </div>

      {/* Year-by-year table */}
      <div>
        <div className="text-sm text-slate-400 mb-2">Year-by-Year Detail</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700">
                <th className="text-left py-1 px-2">Year</th>
                <th className="text-right py-1 px-2">County Yield</th>
                <th className="text-right py-1 px-2">Expected Yield</th>
                <th className="text-right py-1 px-2">Rev Ratio</th>
                <th className="text-right py-1 px-2">Proj $</th>
                <th className="text-right py-1 px-2">Harv $</th>
                <th className="text-right py-1 px-2">Cause</th>
                <th className="text-right py-1 px-2">Rev Shortfall</th>
                <th className="text-right py-1 px-2">Underlying</th>
                {inputs.scoEnabled && <th className="text-right py-1 px-2">SCO</th>}
                {inputs.ecoLevel !== 'None' && <th className="text-right py-1 px-2">ECO</th>}
                <th className="text-right py-1 px-2">Total Indem.</th>
                <th className="text-right py-1 px-2">Premium</th>
                <th className="text-right py-1 px-2">Net/ac</th>
                <th className="text-center py-1 px-2">Hail ⚡</th>
              </tr>
            </thead>
            <tbody>
              {backtestYears.map(yr => {
                const hailEvt = hailEvents.find(h => h.year === yr.year);
                return (
                  <tr key={yr.year} className={`border-b border-slate-700/50 ${yr.totalIndemnity > 0 ? 'bg-blue-900/10' : ''}`}>
                    <td className="py-1 px-2 font-semibold text-white">{yr.year}</td>
                    <td className="py-1 px-2 text-right">
                      {(() => {
                        const diff = yr.countyYield - yr.countyAPH;
                        const cls = diff > 0 ? 'text-green-400' : diff / yr.countyAPH < -0.10 ? 'text-red-400' : 'text-slate-300';
                        return <span className={cls}>{fmt(yr.countyYield, 0)} bu</span>;
                      })()}
                    </td>
                    <td className="py-1 px-2 text-right text-slate-400">{fmt(yr.countyAPH, 0)} bu</td>
                    <td className="py-1 px-2 text-right font-semibold">
                      {(() => {
                        const ratio = parseFloat((yr.countyRevenueRatio * 100).toFixed(1));
                        const cls = ratio < 86 ? 'text-red-400' : ratio < 95 ? 'text-yellow-400' : 'text-green-400';
                        return <span className={cls}>{ratio}%</span>;
                      })()}
                    </td>
                    <td className="py-1 px-2 text-right text-slate-300">${yr.projPrice.toFixed(2)}</td>
                    <td className="py-1 px-2 text-right text-slate-300">${yr.harvPrice.toFixed(2)}</td>
                    {/* Cause tags */}
                    <td className="py-1 px-2 text-right">
                      {yr.causeTags.map((tag, idx) => {
                        const badgeCls =
                          tag === 'Yield ↓' ? 'bg-red-900/50 text-red-300' :
                          tag === 'Price ↓' ? 'bg-orange-900/50 text-orange-300' :
                          tag === 'Price ↑ (RP)' ? 'bg-green-900/50 text-green-300' :
                          'text-slate-500';
                        return tag === '—'
                          ? <span key={idx} className="text-slate-500">—</span>
                          : <span key={idx} className={`inline-block rounded px-1 mr-0.5 text-[10px] font-medium ${badgeCls}`}>{tag}</span>;
                      })}
                    </td>
                    {/* Rev Shortfall */}
                    <td className="py-1 px-2 text-right font-semibold">
                      {yr.revenueShortfall > 0
                        ? <span className="text-red-400">-${Math.round(yr.revenueShortfall)}</span>
                        : yr.revenueShortfall < 0
                          ? <span className="text-green-400">+${Math.round(Math.abs(yr.revenueShortfall))}</span>
                          : <span className="text-slate-500">$0</span>}
                    </td>
                    <td className="py-1 px-2 text-right">
                      {yr.underlyingIndemnity > 0
                        ? <span className="text-blue-400">${fmt(yr.underlyingIndemnity)}</span>
                        : <span className="text-slate-600">—</span>}
                    </td>
                    {inputs.scoEnabled && (
                      <td className="py-1 px-2 text-right">
                        {yr.scoIndemnity > 0
                          ? <span className="text-purple-400">${fmt(yr.scoIndemnity)}</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                    )}
                    {inputs.ecoLevel !== 'None' && (
                      <td className="py-1 px-2 text-right">
                        {yr.ecoIndemnity > 0
                          ? <span className="text-teal-400">${fmt(yr.ecoIndemnity)}</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                    )}
                    <td className="py-1 px-2 text-right font-semibold">
                      {yr.totalIndemnity > 0
                        ? <span className="text-green-400">${fmt(yr.totalIndemnity)}</span>
                        : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-1 px-2 text-right text-red-400">${fmt(yr.totalPremium)}</td>
                    <td className="py-1 px-2 text-right font-bold">
                      <span className={yr.netPerAcre >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {yr.netPerAcre >= 0 ? '+' : ''}{fmt(yr.netPerAcre)}
                      </span>
                    </td>
                    <td className="py-1 px-2 text-center text-xs" title={hailEvt?.description}>
                      {hailEvt ? `⚡${hailEvt.magnitude}"` : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-slate-500 mt-2">
          ⚡ Hail events shown for risk visualization only — estimated from NOAA Storm Events. 
          NO hail insurance rates shown. Contact your agent for hail coverage quotes.
        </div>
      </div>

      {/* SCO/ECO timing note */}
      {(inputs.scoEnabled || inputs.ecoLevel !== 'None') && (
        <div className="text-xs text-amber-300 bg-amber-900/20 border border-amber-700 rounded p-2">
          ⚠️ SCO/ECO payments are issued mid-year following the loss year. A 2026 loss would pay in mid-2027.
          Backtest uses county yields as proxy for county revenue ratio (estimated).
        </div>
      )}
    </div>
  );
}
