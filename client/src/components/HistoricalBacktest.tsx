// HistoricalBacktest.tsx — 15-year backtest with stacked bar chart
import React from 'react';
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

export default function HistoricalBacktest({ state }: Props) {
  const { backtestYears, backtestSummary, inputs } = state;
  const hailEvents = getHailEvents(inputs.county);

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
      projPrice: yr.projPrice,
      harvPrice: yr.harvPrice,
      hail: hailEvt ? hailEvt.magnitude : undefined,
    };
  });

  const { underlyingTriggers, scoTriggers, ecoTriggers, anyTriggers, years,
    avgFarmerPremium, avgTotalIndemnity, avgNetPerAcre } = backtestSummary;

  return (
    <div className="bg-slate-800 rounded-xl p-4 space-y-5">
      <div>
        <h3 className="text-white font-bold text-lg mb-1">📊 Historical Backtest ({years} Years)</h3>
        <p className="text-xs text-slate-400">
          Using {inputs.county} county yields · {inputs.planType} {Math.round(inputs.coverageLevel * 100)}% ·
          APH: {inputs.aphYield} bu/ac · 📊 Estimated data
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-black text-white">{anyTriggers}/{years}</div>
          <div className="text-xs text-slate-400">Years triggered any payment</div>
          <div className="text-sm text-slate-300">{Math.round((anyTriggers/years)*100)}% rate</div>
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

      {/* Year-by-year table */}
      <div>
        <div className="text-sm text-slate-400 mb-2">Year-by-Year Detail</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700">
                <th className="text-left py-1 px-2">Year</th>
                <th className="text-right py-1 px-2">County Yield</th>
                <th className="text-right py-1 px-2">Proj $</th>
                <th className="text-right py-1 px-2">Harv $</th>
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
                    <td className="py-1 px-2 text-right text-slate-300">{fmt(yr.countyYield, 0)} bu</td>
                    <td className="py-1 px-2 text-right text-slate-300">${yr.projPrice.toFixed(2)}</td>
                    <td className="py-1 px-2 text-right text-slate-300">${yr.harvPrice.toFixed(2)}</td>
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
