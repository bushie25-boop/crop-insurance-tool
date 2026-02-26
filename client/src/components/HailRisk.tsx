import React, { useMemo } from 'react';
import {
  ComposedChart, Bar, Line, ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, ReferenceLine,
} from 'recharts';
import { useApp } from '../context/AppContext';
import {
  getHailEvents, buildHailCalendar, hailCalendarColor,
  MONTH_ABBR, YEARS, COUNTY_YIELDS, COUNTY_APH, getSignificantHailYears,
} from '../lib/historicalData';
import { runBacktestExtended } from '../lib/insurance';
import { getProjPrices, getHarvPrices } from '../lib/historicalData';
import type { DataSourcesState } from '../hooks/useDataSources';

interface Props { dataSources: DataSourcesState; }

const CALENDAR_YEARS = [2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023];

export default function HailRisk({ dataSources }: Props) {
  const { inputs } = useApp();
  const { county, crop } = inputs;

  const hailEvents = getHailEvents(county);
  const sigHailYears = getSignificantHailYears(county);
  const calendar = buildHailCalendar(county);

  const countyYields = COUNTY_YIELDS[county][crop];
  const countyAph = COUNTY_APH[county][crop];
  const projPrices = getProjPrices(crop);
  const harvPrices = getHarvPrices(crop);

  const backtestYears = useMemo(
    () => runBacktestExtended(inputs, countyYields, countyAph, projPrices, harvPrices),
    [inputs, countyYields, countyAph, projPrices, harvPrices]
  );

  // Hail events per year with max size + yield overlay
  const hailByYear = useMemo(() => {
    const map = new Map<number, { count: number; maxSize: number; sigCount: number }>();
    for (const e of hailEvents) {
      const entry = map.get(e.year) ?? { count: 0, maxSize: 0, sigCount: 0 };
      entry.count++;
      entry.maxSize = Math.max(entry.maxSize, e.sizeInches);
      if (e.significant) entry.sigCount++;
      map.set(e.year, entry);
    }
    return map;
  }, [hailEvents]);

  const timelineData = CALENDAR_YEARS.map(year => {
    const hail = hailByYear.get(year) ?? { count: 0, maxSize: 0, sigCount: 0 };
    const yIdx = YEARS.indexOf(year);
    const yield_ = yIdx >= 0 ? countyYields[yIdx] : null;
    const backtest = yIdx >= 0 ? backtestYears[yIdx] : null;
    return {
      year,
      hailCount: hail.count,
      maxHailSize: hail.maxSize,
      sigHailCount: hail.sigCount,
      countyYield: yield_,
      indemnity: backtest?.indemnity ?? 0,
      hasPayment: (backtest?.indemnity ?? 0) > 0,
      hasSigHail: hail.sigCount > 0,
    };
  });

  // Scatter: sig hail events vs indemnity (for 2009-2023)
  const scatterData = YEARS.map((year, i) => {
    const hail = hailByYear.get(year) ?? { count: 0, maxSize: 0, sigCount: 0 };
    return {
      year,
      sigHailCount: hail.sigCount,
      indemnity: backtestYears[i]?.indemnity ?? 0,
      countyYield: countyYields[i],
    };
  });

  // Month distribution
  const monthCounts = Array(12).fill(0);
  const monthSigCounts = Array(12).fill(0);
  for (const e of hailEvents) {
    monthCounts[e.month - 1]++;
    if (e.significant) monthSigCounts[e.month - 1]++;
  }
  const monthData = MONTH_ABBR.map((m, i) => ({
    month: m, total: monthCounts[i], significant: monthSigCounts[i],
  }));

  const peakMonth = MONTH_ABBR[monthCounts.indexOf(Math.max(...monthCounts))];
  const totalSigEvents = hailEvents.filter(e => e.significant).length;
  const hailPaymentCorrelation = YEARS.filter(y =>
    sigHailYears.has(y) && backtestYears[YEARS.indexOf(y)]?.triggered
  ).length;

  // Calendar grid
  const calMap = new Map(calendar.map(c => [`${c.year}-${c.month}`, c]));

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
        <h3 className="text-slate-100 font-bold text-base mb-4">🌨️ Hail Risk Summary — {county}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 rounded-xl p-3 text-center">
            <div className="text-2xl font-black text-orange-400">{totalSigEvents}</div>
            <div className="text-xs text-slate-400 mt-1">Significant events ≥1.0"<br/>2008–2023</div>
          </div>
          <div className="bg-slate-900 rounded-xl p-3 text-center">
            <div className="text-2xl font-black text-yellow-400">{sigHailYears.size}</div>
            <div className="text-xs text-slate-400 mt-1">Years with sig hail<br/>2008–2023</div>
          </div>
          <div className="bg-slate-900 rounded-xl p-3 text-center">
            <div className="text-xl font-black text-red-400">Jun–Jul</div>
            <div className="text-xs text-slate-400 mt-1">Peak risk window<br/>({peakMonth} highest month)</div>
          </div>
          <div className="bg-slate-900 rounded-xl p-3 text-center">
            <div className="text-2xl font-black text-blue-400">{hailPaymentCorrelation}</div>
            <div className="text-xs text-slate-400 mt-1">Hail years w/ insurance<br/>payment (2009–2023)</div>
          </div>
        </div>

        {/* Data source badge */}
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className={`px-2 py-0.5 rounded-full ${
            dataSources.noaaHail ? 'bg-emerald-900 text-emerald-300' : 'bg-slate-700 text-slate-400'
          }`}>
            {dataSources.noaaHail ? '✅ NOAA Live Data' : '📋 Hardcoded Estimates'}
          </span>
        </div>
      </div>

      {/* Timeline: hail events + yield + indemnity */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
        <h3 className="text-slate-100 font-bold text-sm mb-4">
          Hail Events × Yield × Insurance Payment — 2008–2023
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={timelineData} margin={{ top: 10, right: 20, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="year" stroke="#64748b" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="hail" stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={v => `${v}`} domain={[0, 6]} label={{ value: '# Events', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} />
            <YAxis yAxisId="yield" orientation="right" stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={v => `${v} bu`} />
            <Tooltip
              contentStyle={{ background:'#1e293b', border:'1px solid #475569', borderRadius:'8px', fontSize:'11px' }}
              formatter={(v: number, name: string) => {
                if (name === 'Hail Events') return [`${v} events`, name];
                if (name === 'Max Hail Size') return [`${v}"`, name];
                if (name === 'County Yield') return [`${v} bu/ac`, name];
                if (name === 'Indemnity') return [`$${v.toFixed(2)}/ac`, name];
                return [v, name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />

            {/* Payment years highlighted */}
            {timelineData.map((d, i) => d.hasPayment && (
              <ReferenceLine key={i} x={d.year} yAxisId="hail" stroke="#ef444430" strokeWidth={30} />
            ))}

            <Bar yAxisId="hail" dataKey="hailCount" name="Hail Events" radius={[3,3,0,0]}>
              {timelineData.map((d, i) => (
                <Cell key={i} fill={d.hasSigHail ? '#f97316' : '#fbbf24'} opacity={0.8} />
              ))}
            </Bar>
            <Line yAxisId="yield" type="monotone" dataKey="countyYield" name="County Yield" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            <Line yAxisId="hail" type="monotone" dataKey="indemnity" name="Indemnity" stroke="#f87171" strokeWidth={2} dot={{ r: 3, fill: '#f87171' }} />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="text-xs text-slate-500 mt-2">
          Orange bars = years with ≥1.0" hail. Yellow = lighter events. Red shading = insurance payment year.
        </p>
      </div>

      {/* Hail Calendar Heatmap */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
        <h3 className="text-slate-100 font-bold text-sm mb-4">
          Hail Calendar — Year × Month Intensity
        </h3>
        <div className="overflow-x-auto">
          <div className="min-w-max">
            {/* Month headers */}
            <div className="flex ml-12 mb-1">
              {MONTH_ABBR.map((m, i) => (
                <div key={i} className={`w-10 text-center text-xs font-semibold ${
                  [4,5,6].includes(i) ? 'text-orange-400' : 'text-slate-500'
                }`}>{m}</div>
              ))}
            </div>
            {CALENDAR_YEARS.map(year => (
              <div key={year} className="flex items-center mb-0.5">
                <div className={`w-10 text-right pr-2 text-xs flex-shrink-0 ${
                  sigHailYears.has(year) ? 'text-orange-400 font-bold' : 'text-slate-500'
                }`}>
                  {year}
                  {sigHailYears.has(year) && <span className="ml-0.5">🌨</span>}
                </div>
                {MONTH_ABBR.map((_, mi) => {
                  const cell = calMap.get(`${year}-${mi + 1}`);
                  const colorClass = hailCalendarColor(cell);
                  return (
                    <div
                      key={mi}
                      className={`w-10 h-6 mx-px rounded text-xs flex items-center justify-center cursor-default transition-all ${colorClass}`}
                      title={cell ? `${cell.count} event(s), max ${cell.maxSize}"` : 'No events'}
                    >
                      {cell && cell.count > 0 ? (
                        <span className="text-white font-bold text-[10px]">{cell.maxSize >= 1.0 ? `${cell.maxSize}"` : '•'}</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="flex mt-3 ml-12 gap-3 text-xs text-slate-400">
              <span><span className="inline-block w-3 h-3 bg-slate-800 rounded mr-1"/>No events</span>
              <span><span className="inline-block w-3 h-3 bg-yellow-500 rounded mr-1"/>Light (&lt;1.0")</span>
              <span><span className="inline-block w-3 h-3 bg-orange-500 rounded mr-1"/>Moderate (≥1.0")</span>
              <span><span className="inline-block w-3 h-3 bg-red-500 rounded mr-1"/>Significant (≥1.5")</span>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly risk distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
          <h3 className="text-slate-100 font-bold text-sm mb-4">Monthly Hail Risk Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={monthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #475569', borderRadius:'8px', fontSize:'11px' }} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
              <Bar dataKey="total" name="Total Events" fill="#fbbf24" opacity={0.7} radius={[3,3,0,0]} />
              <Bar dataKey="significant" name={'Significant (\u22651.0")'} fill="#f97316" radius={[3,3,0,0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Hail vs Indemnity scatter */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
          <h3 className="text-slate-100 font-bold text-sm mb-4">Sig. Hail Events vs Indemnity (2009–2023)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <ScatterChart margin={{ top: 10, right: 20, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="sigHailCount" name="Sig. Hail Events" type="number" stroke="#64748b" tick={{ fontSize: 11 }} label={{ value: '# Sig Hail Events', position: 'insideBottom', fill: '#64748b', fontSize: 10, dy: 10 }} />
              <YAxis dataKey="indemnity" name="Indemnity" stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
              <ZAxis range={[60, 120]} />
              <Tooltip
                contentStyle={{ background:'#1e293b', border:'1px solid #475569', borderRadius:'8px', fontSize:'11px' }}
                formatter={(v: number, name: string) => {
                  if (name === 'Indemnity') return [`$${v.toFixed(2)}/ac`, name];
                  return [v, name];
                }}
                labelFormatter={() => ''}
                cursor={{ strokeDasharray: '3 3' }}
              />
              <Scatter
                data={scatterData}
                name="Year"
                fill="#60a5fa"
              >
                {scatterData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.indemnity > 0 ? '#f87171' : '#60a5fa'}
                    opacity={0.8}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-500 mt-2">
            Red dots = payment triggered. Blue = no payment. Shows how hail events correlate with insurance payments.
          </p>
        </div>
      </div>

      {/* "Hail Pays" year-by-year indicator */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
        <h3 className="text-slate-100 font-bold text-sm mb-4">🌨️ "Hail Pays" Indicator — Year by Year</h3>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
          {YEARS.map((year, i) => {
            const hail = hailByYear.get(year);
            const backtest = backtestYears[i];
            const hasSigHail = hail && hail.sigCount > 0;
            const hasPay = backtest?.indemnity > 0;
            const bothHailAndPay = hasSigHail && hasPay;

            return (
              <div key={year} className={`rounded-xl p-3 text-center border transition-all ${
                bothHailAndPay ? 'bg-red-950 border-red-700'
                : hasSigHail ? 'bg-orange-950 border-orange-800'
                : hasPay ? 'bg-blue-950 border-blue-800'
                : 'bg-slate-900 border-slate-700'
              }`}>
                <div className={`text-sm font-bold ${
                  bothHailAndPay ? 'text-red-300' : hasSigHail ? 'text-orange-300' : hasPay ? 'text-blue-300' : 'text-slate-500'
                }`}>{year}</div>
                <div className="text-lg mt-0.5">
                  {hasSigHail ? '🌨️' : '—'}
                </div>
                <div className="text-xs mt-0.5 font-semibold">
                  {hasPay ? (
                    <span className="text-emerald-400">+${backtest.indemnity.toFixed(0)}</span>
                  ) : (
                    <span className="text-slate-600">No pay</span>
                  )}
                </div>
                {countyYields[i] && (
                  <div className="text-xs text-slate-500 mt-0.5">{countyYields[i]} bu</div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-950 border border-red-700 inline-block"/>🌨️+Payment</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-950 border border-orange-800 inline-block"/>Hail only</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-950 border border-blue-800 inline-block"/>Payment (no sig hail)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-900 border border-slate-700 inline-block"/>No events</span>
        </div>
      </div>
    </div>
  );
}
