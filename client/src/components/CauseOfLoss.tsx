import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useApp } from '../context/AppContext';
import type { DataSourcesState } from '../hooks/useDataSources';

interface Props { dataSources: DataSourcesState; }

// Hardcoded fallback cause-of-loss distribution for WI corn (% of indemnity)
const FALLBACK_CORN_COL = [
  { causeName: 'Drought', pct: 38, color: '#f59e0b' },
  { causeName: 'Excess Moisture', pct: 22, color: '#60a5fa' },
  { causeName: 'Hail', pct: 18, color: '#a78bfa' },
  { causeName: 'Freeze/Cold', pct: 11, color: '#7dd3fc' },
  { causeName: 'Wind', pct: 6, color: '#86efac' },
  { causeName: 'Other', pct: 5, color: '#94a3b8' },
];
const FALLBACK_SOY_COL = [
  { causeName: 'Drought', pct: 35, color: '#f59e0b' },
  { causeName: 'Excess Moisture', pct: 28, color: '#60a5fa' },
  { causeName: 'Hail', pct: 15, color: '#a78bfa' },
  { causeName: 'Freeze/Cold', pct: 10, color: '#7dd3fc' },
  { causeName: 'Disease', pct: 7, color: '#86efac' },
  { causeName: 'Other', pct: 5, color: '#94a3b8' },
];

const COLORS = ['#f59e0b','#60a5fa','#a78bfa','#7dd3fc','#86efac','#94a3b8','#f87171','#34d399'];

export default function CauseOfLoss({ dataSources }: Props) {
  const { inputs } = useApp();

  const fallback = inputs.crop === 'corn' ? FALLBACK_CORN_COL : FALLBACK_SOY_COL;

  const liveData = useMemo(() => {
    const raw = dataSources.rmaLoss;
    if (!raw || raw.length === 0) return null;

    const grouped = new Map<string, { causeName: string; indemnity: number }>();
    for (const r of raw) {
      const key = r.causeName || r.causeCode;
      const entry = grouped.get(key) ?? { causeName: key, indemnity: 0 };
      entry.indemnity += r.indemnity;
      grouped.set(key, entry);
    }
    const total = Array.from(grouped.values()).reduce((s, r) => s + r.indemnity, 0);
    if (total === 0) return null;

    return Array.from(grouped.values())
      .sort((a, b) => b.indemnity - a.indemnity)
      .slice(0, 8)
      .map((r, i) => ({
        causeName: r.causeName,
        pct: Math.round((r.indemnity / total) * 100),
        indemnity: r.indemnity,
        color: COLORS[i] ?? '#94a3b8',
      }));
  }, [dataSources.rmaLoss]);

  const displayData = liveData ?? fallback;
  const isLive = !!liveData;

  // Drought history timeline
  const droughtData = useMemo(() => {
    if (!dataSources.drought) return null;
    return dataSources.drought
      .filter(d => {
        const y = Number(d.date?.split('-')[0]);
        return y >= 2009 && y <= 2023;
      })
      .filter((_, i) => i % 4 === 0) // sample weekly → monthly-ish
      .map(d => ({
        date: d.date?.slice(0, 7) ?? '',
        severe: d.d3 + d.d4,
        moderate: d.d2,
        abnormal: d.d0 + d.d1,
      }));
  }, [dataSources.drought]);

  return (
    <div className="space-y-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-100 font-bold text-base">
            What Actually Causes Claims — {inputs.county}
          </h3>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            isLive ? 'bg-emerald-900 text-emerald-300' : 'bg-slate-700 text-slate-400'
          }`}>
            {isLive ? '✅ RMA Live Data' : '📋 WI Estimates'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={displayData}
                cx="50%"
                cy="50%"
                outerRadius={110}
                innerRadius={55}
                dataKey="pct"
                label={({ causeName, pct }) => `${causeName} ${pct}%`}
                labelLine={{ stroke: '#64748b', strokeWidth: 1 }}
              >
                {displayData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background:'#1e293b', border:'1px solid #475569', borderRadius:'8px', fontSize:'12px' }}
                formatter={(v: number) => [`${v}%`, 'Share of Indemnity']}
              />
            </PieChart>
          </ResponsiveContainer>

          <div className="space-y-2">
            {displayData.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.color }} />
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-300">{d.causeName}</span>
                    <span className="text-sm font-bold" style={{ color: d.color }}>{d.pct}%</span>
                  </div>
                  <div className="mt-0.5 h-1.5 rounded-full bg-slate-700">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: `${d.pct}%`, background: d.color }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-400">
          <div className="bg-amber-950 border border-amber-800 rounded-xl p-3">
            <p className="text-amber-300 font-semibold mb-1">☀️ Drought Dominates</p>
            <p>Drought typically accounts for 35–40% of crop insurance claims in the Midwest. 2012 was a record drought year in {inputs.county}.</p>
          </div>
          <div className="bg-blue-950 border border-blue-800 rounded-xl p-3">
            <p className="text-blue-300 font-semibold mb-1">💧 Excess Moisture</p>
            <p>Wet springs cause prevented planting and excess moisture losses. {inputs.crop === 'soybeans' ? 'Soybeans' : 'Corn'} are especially vulnerable in saturated soils.</p>
          </div>
          <div className="bg-purple-950 border border-purple-800 rounded-xl p-3">
            <p className="text-purple-300 font-semibold mb-1">🌨️ Hail Impact</p>
            <p>Hail is the most localized cause — individual fields can be devastated while neighbors are fine. Hail insurance (standalone) can supplement RP coverage.</p>
          </div>
        </div>
      </div>

      {/* Drought Timeline if data available */}
      {droughtData && droughtData.length > 10 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-100 font-bold text-sm">Drought History — {inputs.county} (NOAA Drought Monitor)</h3>
            <span className="text-xs bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded-full">✅ Live</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={droughtData} margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 9 }} interval={11} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} domain={[0,100]} />
              <Tooltip
                contentStyle={{ background:'#1e293b', border:'1px solid #475569', borderRadius:'8px', fontSize:'11px' }}
                formatter={(v: number, name: string) => [`${v}%`, name]}
              />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
              <Bar dataKey="abnormal" name="Abnormally Dry (D0-D1)" stackId="d" fill="#fcd34d" />
              <Bar dataKey="moderate" name="Moderate (D2)" stackId="d" fill="#f97316" />
              <Bar dataKey="severe" name="Severe/Extreme (D3-D4)" stackId="d" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
