import React, { useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, Legend,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { runBacktestExtended, summarizeBacktestExtended } from '../lib/insurance';
import { COUNTY_YIELDS, COUNTY_APH, getProjPrices, getHarvPrices, YEARS, getSignificantHailYears } from '../lib/historicalData';
import type { DataSourcesState } from '../hooks/useDataSources';

const fmt = (n: number, d = 2) => n.toFixed(d);
const fmtMoney = (n: number) => `$${Math.abs(n).toFixed(2)}`;

interface Props { dataSources: DataSourcesState; }

export default function HistoricalBacktest({ dataSources }: Props) {
  const { inputs } = useApp();

  const countyYields = COUNTY_YIELDS[inputs.county][inputs.crop];
  const countyAph = COUNTY_APH[inputs.county][inputs.crop];
  const projPrices = getProjPrices(inputs.crop);
  const harvPrices = getHarvPrices(inputs.crop);
  const sigHailYears = getSignificantHailYears(inputs.county);

  const backtestYears = useMemo(
    () => runBacktestExtended(inputs, countyYields, countyAph, projPrices, harvPrices),
    [inputs, countyYields, countyAph, projPrices, harvPrices]
  );

  const summary = useMemo(() => summarizeBacktestExtended(backtestYears), [backtestYears]);

  // Build cumulative net benefit line
  let cumNet = 0;
  const chartData = backtestYears.map((y, i) => {
    cumNet += y.totalNet;
    return {
      year: y.year,
      label: `${y.year}`,
      underlying: Math.round(y.indemnity * 10) / 10,
      sco: Math.round(y.scoIndemnity * 10) / 10,
      eco: Math.round(y.ecoIndemnity * 10) / 10,
      premium: -Math.round(y.totalPremium * 10) / 10,
      net: Math.round(y.totalNet * 10) / 10,
      cumNet: Math.round(cumNet * 10) / 10,
      triggered: y.triggered,
      scoTriggered: y.scoTriggered,
      ecoTriggered: y.ecoTriggered,
      countyYield: y.countyYield,
      projPrice: y.projPrice,
      harvPrice: y.harvPrice,
      hasHail: sigHailYears.has(y.year),
    };
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    return (
      <div className="bg-slate-900 border border-slate-600 rounded-xl p-3 text-xs min-w-52">
        <div className="font-bold text-white text-sm mb-2">
          {label} {d.hasHail && <span title="Significant hail event">🌨️</span>}
        </div>
        <div className="space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">County Yield</span>
            <span className="text-white">{d.countyYield} bu/ac</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Proj / Harvest Price</span>
            <span className="text-white">${d.projPrice?.toFixed(2)} / ${d.harvPrice?.toFixed(2)}</span>
          </div>
          <div className="border-t border-slate-700 pt-1 mt-1" />
          {d.underlying > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-red-400">Underlying Indemnity</span>
              <span className="text-red-300">+${d.underlying}</span>
            </div>
          )}
          {d.sco > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-purple-400">SCO Indemnity</span>
              <span className="text-purple-300">+${d.sco}</span>
            </div>
          )}
          {d.eco > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-teal-400">ECO Indemnity</span>
              <span className="text-teal-300">+${d.eco}</span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="text-amber-400">Premium Cost</span>
            <span className="text-amber-300">${Math.abs(d.premium)}</span>
          </div>
          <div className="border-t border-slate-700 pt-1 mt-1" />
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Year Net</span>
            <span className={d.net >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {d.net >= 0 ? '+' : ''}{d.net.toFixed(2)}/ac
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Cumulative Net</span>
            <span className={d.cumNet >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {d.cumNet >= 0 ? '+' : ''}{d.cumNet.toFixed(2)}/ac
            </span>
          </div>
        </div>
      </div>
    );
  };

  const worthItColor = summary.totalWorthIt === 'YES ✓' ? 'text-emerald-400'
    : summary.totalWorthIt === 'BREAK EVEN' ? 'text-amber-400' : 'text-slate-400';

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-slate-100 font-bold text-base">Historical Backtest — 2009–2023</h3>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>🌨️ = Significant hail year</span>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-slate-900 rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-red-400">{summary.triggerCount}<span className="text-slate-500 text-sm font-normal">/{summary.totalYears}</span></div>
          <div className="text-xs text-slate-400 mt-0.5">Underlying triggers</div>
        </div>
        {inputs.scoEnabled && (
          <div className="bg-purple-950 border border-purple-800 rounded-xl p-3 text-center">
            <div className="text-2xl font-black text-purple-400">{summary.scoTriggerCount}<span className="text-slate-500 text-sm font-normal">/{summary.totalYears}</span></div>
            <div className="text-xs text-purple-400 mt-0.5">SCO triggers</div>
          </div>
        )}
        {inputs.ecoLevel !== 'None' && (
          <div className="bg-teal-950 border border-teal-800 rounded-xl p-3 text-center">
            <div className="text-2xl font-black text-teal-400">{summary.ecoTriggerCount}<span className="text-slate-500 text-sm font-normal">/{summary.totalYears}</span></div>
            <div className="text-xs text-teal-400 mt-0.5">{inputs.ecoLevel} triggers</div>
          </div>
        )}
        <div className="bg-slate-900 rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-amber-400">${fmt(summary.avgTotalPremium)}</div>
          <div className="text-xs text-slate-400 mt-0.5">Avg total premium/ac</div>
        </div>
        <div className="bg-slate-900 rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-blue-400">${fmt(summary.avgTotalIndemnity)}</div>
          <div className="text-xs text-slate-400 mt-0.5">Avg total indemnity/ac</div>
        </div>
        <div className="bg-slate-900 rounded-xl p-3 text-center">
          <div className={`text-2xl font-black ${summary.totalNetPerYear >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {summary.totalNetPerYear >= 0 ? '+' : ''}{fmt(summary.totalNetPerYear)}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">Net $/ac/yr avg</div>
        </div>
        <div className="bg-slate-900 rounded-xl p-3 text-center col-span-1">
          <div className={`text-2xl font-black ${worthItColor}`}>{summary.totalWorthIt}</div>
          <div className="text-xs text-slate-400 mt-0.5">Was it worth it?</div>
        </div>
      </div>

      {/* Main chart */}
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="left" stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
          <YAxis yAxisId="right" orientation="right" stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
          <ReferenceLine yAxisId="left" y={0} stroke="#475569" />

          {/* Stacked indemnity bars */}
          <Bar yAxisId="left" dataKey="underlying" name="Underlying Indemnity" stackId="ind" fill="#ef4444" radius={[0,0,0,0]} />
          {inputs.scoEnabled && (
            <Bar yAxisId="left" dataKey="sco" name="SCO" stackId="ind" fill="#a855f7" />
          )}
          {inputs.ecoLevel !== 'None' && (
            <Bar yAxisId="left" dataKey="eco" name={inputs.ecoLevel} stackId="ind" fill="#14b8a6" />
          )}

          {/* Premium bars (negative) */}
          <Bar yAxisId="left" dataKey="premium" name="Premium Cost (neg)" fill="#f59e0b" opacity={0.6}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.hasHail ? '#fbbf24' : '#d97706'} />
            ))}
          </Bar>

          {/* Cumulative net line */}
          <Line yAxisId="right" type="monotone" dataKey="cumNet" name="Cumulative Net" stroke="#60a5fa" strokeWidth={2.5} dot={{ r: 3, fill: '#60a5fa' }} />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Hail correlation note */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-slate-900 rounded-xl p-3 text-xs text-slate-400">
          <p className="text-slate-300 font-semibold mb-1">🌨️ Hail Correlation</p>
          <p>
            Of <span className="text-white">{backtestYears.length}</span> years,{' '}
            <span className="text-amber-400 font-bold">{Array.from(sigHailYears).filter(y => YEARS.includes(y)).length}</span> had significant hail events.
            {' '}Payment years correlating with hail:{' '}
            <span className="text-red-400 font-bold">
              {backtestYears.filter(y => y.triggered && sigHailYears.has(y.year)).length}
            </span>
          </p>
        </div>
        {inputs.scoEnabled || inputs.ecoLevel !== 'None' ? (
          <div className="bg-slate-900 rounded-xl p-3 text-xs text-slate-400">
            <p className="text-slate-300 font-semibold mb-1">📊 Coverage Stack Value</p>
            <p>
              Total 15-yr net (all layers):{' '}
              <span className={summary.totalNetPerYear >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                ${fmt(summary.totalNetPerYear * 15)}/ac over 15 years
              </span>
              {' '}({fmt(summary.totalNetPerYear)}/yr average)
            </p>
          </div>
        ) : (
          <div className="bg-slate-900 rounded-xl p-3 text-xs text-slate-400">
            <p className="text-slate-300 font-semibold mb-1">💡 Add SCO/ECO?</p>
            <p>Enable SCO or ECO above to see how the coverage stack performs historically in county-level loss years.</p>
          </div>
        )}
      </div>
    </div>
  );
}
