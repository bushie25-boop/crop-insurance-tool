// OptimizerTab.tsx — Coverage Optimizer, Yield Stability, Hail Exposure, Grain Marketing Risk
// B&B Agrisales · Teky · Feb 2026

import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import { type InsuranceState, type YieldStability } from '../hooks/useInsurance';
import { type DataSourcesState } from '../hooks/useDataSources';
import { runOptimizer, type OptimizerCombo } from '../lib/insurance';
import { getHailEvents, CORN_PRICES, SOYBEAN_PRICES, getHailRates, calcHailPremiumPerAcre } from '../lib/historicalData';

interface Props {
  state: InsuranceState;
  dataSources: DataSourcesState;
}

const STABILITY_FACTOR: Record<YieldStability, number> = {
  more_stable: 0.5,
  average: 1.0,
  less_stable: 1.3,
};

const STABILITY_OPTIONS: Array<{ value: YieldStability; label: string; desc: string }> = [
  {
    value: 'more_stable',
    label: '📈 More Stable',
    desc: 'My yields move less than county. Good consistent ground. SCO/ECO adds value since my underlying triggers less.',
  },
  {
    value: 'average',
    label: '📊 About Average',
    desc: 'My yields track the county closely. Standard assumptions apply.',
  },
  {
    value: 'less_stable',
    label: '📉 Less Stable',
    desc: 'My yields swing more than county (variable soils, bluff ground, flood risk). Underlying coverage is more important than ECO.',
  },
];

export default function OptimizerTab({ state }: Props) {
  const { inputs, yieldStability, setYieldStability, countyYieldData, priceData, backtestWindow, optimizerResults, setOptimizerResults } = state;
  const [running, setRunning] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Build windowed arrays for optimizer
  const { wYields, wAPH, wProj, wHarv } = useMemo(() => {
    if (!countyYieldData) return { wYields: [], wAPH: [], wProj: [], wHarv: [] };
    const { yields, trendAPH, years } = countyYieldData;
    const projPrices = years.map(yr => {
      const idx = priceData.years.indexOf(yr);
      return idx >= 0 ? priceData.projectedPrices[idx] : inputs.springPrice;
    });
    const harvPrices = years.map(yr => {
      const idx = priceData.years.indexOf(yr);
      return idx >= 0 ? (priceData.harvestPrices[idx] > 0 ? priceData.harvestPrices[idx] : inputs.springPrice) : inputs.springPrice;
    });
    const n = backtestWindow === 'all' ? yields.length : backtestWindow;
    return {
      wYields: yields.slice(-n),
      wAPH: trendAPH.slice(-n),
      wProj: projPrices.slice(-n),
      wHarv: harvPrices.slice(-n),
    };
  }, [countyYieldData, priceData, inputs.springPrice, backtestWindow]);

  function handleRunOptimizer() {
    setRunning(true);
    setTimeout(() => {
      const factor = STABILITY_FACTOR[yieldStability];
      const results = runOptimizer(inputs, wYields, wAPH, wProj, wHarv, factor);
      setOptimizerResults(results);
      setRunning(false);
    }, 50);
  }

  // Current selection label + rank
  const currentLabel = `${inputs.planType} ${Math.round(inputs.coverageLevel * 100)}% ${inputs.unitStructure === 'Enterprise' ? 'EU' : inputs.unitStructure === 'Basic' ? 'BU' : 'OU'}${inputs.scoEnabled ? ' + SCO' : ''}${inputs.ecoLevel !== 'None' ? ` + ${inputs.ecoLevel}` : ''}`;
  const currentRank = optimizerResults.find(c => c.label === currentLabel)?.rank ?? null;

  const topCombo = optimizerResults[0] ?? null;
  const hasHailRisk = topCombo && (topCombo.coverageLevel < 0.80 || topCombo.ecoLevel !== 'None');
  const hailEvents = getHailEvents(inputs.county);

  // Price data for grain marketing section
  const priceHistory = inputs.crop === 'corn' ? CORN_PRICES : SOYBEAN_PRICES;
  const priceChanges = priceHistory.years
    .map((yr, i) => ({
      year: yr,
      change: priceHistory.harvestPrices[i] > 0
        ? priceHistory.harvestPrices[i] - priceHistory.projectedPrices[i]
        : null,
    }))
    .filter(d => d.change !== null) as Array<{ year: number; change: number }>;

  const downYears = priceChanges.filter(d => d.change < 0);
  const upYears = priceChanges.filter(d => d.change >= 0);
  const avgDown = downYears.length > 0
    ? downYears.reduce((s, d) => s + d.change, 0) / downYears.length
    : 0;
  const biggestDrop = priceChanges.reduce((min, d) => d.change < min.change ? d : min, priceChanges[0] ?? { year: 0, change: 0 });
  const biggestRally = priceChanges.reduce((max, d) => d.change > max.change ? d : max, priceChanges[0] ?? { year: 0, change: 0 });

  // Marketing exposure
  const coverageForMarketing = topCombo ? topCombo.coverageLevel : inputs.coverageLevel;
  const planTypeForMarketing = topCombo ? topCombo.planType : inputs.planType;
  const guarantee = inputs.aphYield * coverageForMarketing * inputs.springPrice;
  const exposedRevenue = inputs.aphYield * inputs.springPrice - guarantee;
  const exposedBushels = inputs.aphYield * (1 - coverageForMarketing);

  return (
    <div className="space-y-4">
      {/* ─── Section A: Yield Stability ─── */}
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="text-white font-bold text-lg mb-1">🎯 Farm Yield Stability</h3>
        <p className="text-xs text-slate-400 mb-3">
          How does your farm's yield variability compare to the county average? This affects how much value SCO/ECO provides — those pay on county losses, not individual farm losses.
        </p>
        <div className="flex gap-3 mb-3">
          {STABILITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setYieldStability(opt.value)}
              className={`flex-1 rounded-xl p-3 text-left border-2 transition ${
                yieldStability === opt.value
                  ? 'border-blue-500 bg-blue-900/30'
                  : 'border-slate-600 bg-slate-700 hover:border-slate-500'
              }`}
            >
              <div className="text-sm font-bold text-white mb-1">{opt.label}</div>
              <div className="text-xs text-slate-400">{opt.desc}</div>
            </button>
          ))}
        </div>
        <div className="bg-slate-900/50 rounded-lg p-3 text-xs text-slate-400">
          {yieldStability === 'more_stable' && '⚡ More stable farms benefit from SCO/ECO — county losses trigger even when your farm holds up, giving you extra coverage at low cost.'}
          {yieldStability === 'average' && '📊 Using county yield data directly as farm yield proxy. Standard analysis.'}
          {yieldStability === 'less_stable' && '⚠️ Less stable farms should prioritize underlying coverage (higher RP %). SCO/ECO only trigger on county-wide losses — your individual bad years may not be covered by ECO.'}
        </div>
      </div>

      {/* ─── Section B: Optimizer Results ─── */}
      <div className="bg-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold text-lg">🔍 Coverage Optimizer</h3>
          <button
            onClick={handleRunOptimizer}
            disabled={running || wYields.length === 0}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition"
          >
            {running ? '⏳ Running...' : '🔍 Run Optimizer'}
          </button>
        </div>

        {wYields.length === 0 && (
          <p className="text-xs text-slate-500">No county yield data available for {inputs.county}. Check Setup panel.</p>
        )}

        {optimizerResults.length > 0 && (
          <>
            {/* Current selection */}
            <div className="mb-4 bg-slate-700/50 rounded-lg px-3 py-2 text-xs text-slate-300">
              Your current selection: <span className="text-blue-300 font-semibold">{currentLabel}</span>
              {currentRank !== null && (
                <> — <span className="font-semibold">ranked #{currentRank} of {optimizerResults.length}</span></>
              )}
            </div>

            {/* Top 5 cards */}
            <div className="space-y-2 mb-4">
              {optimizerResults.slice(0, 5).map(combo => (
                <div
                  key={combo.label}
                  className={`rounded-xl p-3 border-2 ${combo.rank === 1 ? 'border-yellow-500 bg-yellow-900/10' : 'border-slate-600 bg-slate-700/50'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${combo.rank === 1 ? 'bg-yellow-500 text-black' : 'bg-slate-600 text-slate-200'}`}>
                      #{combo.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="text-white font-bold text-sm">{combo.label}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-2">
                        <div>
                          <div className="text-slate-400">Adj. Net/ac</div>
                          <div className={`text-base font-black ${combo.stabilityAdjustedNet >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            ${combo.stabilityAdjustedNet.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400">Avg Premium</div>
                          <div className="text-white font-semibold">${combo.avgFarmerPremium.toFixed(2)}/ac</div>
                        </div>
                        <div>
                          <div className="text-slate-400">Trigger Rate</div>
                          <div className="text-white font-semibold">{Math.round(combo.triggerRate * 100)}%</div>
                        </div>
                        <div>
                          <div className="text-slate-400">Worst Year</div>
                          <div className={`font-semibold ${combo.worstYearNet < 0 ? 'text-red-400' : 'text-green-400'}`}>
                            ${combo.worstYearNet.toFixed(2)}/ac
                          </div>
                        </div>
                      </div>
                      {/* Coverage bar */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-600 rounded-full overflow-hidden flex">
                          <div
                            className="h-full bg-green-500 rounded-l-full"
                            style={{ width: `${combo.coverageLevel * 100}%` }}
                          />
                          <div
                            className="h-full bg-red-700"
                            style={{ width: `${(1 - combo.coverageLevel) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          {Math.round(combo.coverageLevel * 100)}% covered · {Math.round(combo.hailExposurePct * 100)}% exposed
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Collapsible full table */}
            <button
              onClick={() => setShowAll(v => !v)}
              className="text-xs text-blue-400 hover:text-blue-300 underline mb-2"
            >
              {showAll ? 'Hide' : `Show all ${optimizerResults.length} combinations`}
            </button>

            {showAll && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-slate-300 border-collapse">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-600">
                      <th className="text-left py-1 pr-3">#</th>
                      <th className="text-left py-1 pr-3">Plan</th>
                      <th className="text-right py-1 pr-3">Adj Net</th>
                      <th className="text-right py-1 pr-3">Premium</th>
                      <th className="text-right py-1 pr-3">Trigger%</th>
                      <th className="text-right py-1">Worst</th>
                    </tr>
                  </thead>
                  <tbody>
                    {optimizerResults.map(c => (
                      <tr key={c.label} className={`border-b border-slate-700/50 ${c.label === currentLabel ? 'bg-blue-900/20' : ''}`}>
                        <td className="py-0.5 pr-3 text-slate-500">{c.rank}</td>
                        <td className="py-0.5 pr-3 font-medium">{c.label}</td>
                        <td className={`py-0.5 pr-3 text-right font-semibold ${c.stabilityAdjustedNet >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ${c.stabilityAdjustedNet.toFixed(2)}
                        </td>
                        <td className="py-0.5 pr-3 text-right">${c.avgFarmerPremium.toFixed(2)}</td>
                        <td className="py-0.5 pr-3 text-right">{Math.round(c.triggerRate * 100)}%</td>
                        <td className={`py-0.5 text-right ${c.worstYearNet < 0 ? 'text-red-400' : 'text-green-400'}`}>
                          ${c.worstYearNet.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {optimizerResults.length === 0 && !running && wYields.length > 0 && (
          <p className="text-xs text-slate-500 mt-2">Click "Run Optimizer" to analyze all coverage combinations.</p>
        )}
      </div>

      {/* ─── Section C: Hail Exposure Alert ─── */}
      {hasHailRisk && optimizerResults.length > 0 && (
        <div className="bg-amber-900/30 border border-amber-500 rounded-xl p-4">
          <h3 className="text-amber-300 font-bold text-lg mb-2">⚡ Hail Exposure Warning</h3>
          <p className="text-sm text-slate-300 mb-3">
            The top-ranked combination has{' '}
            <strong>{Math.round(topCombo!.hailExposurePct * 100)}% of your APH revenue unprotected</strong>{' '}
            by the underlying policy ({Math.round(topCombo!.coverageLevel * 100)}% coverage ={' '}
            ${Math.round(topCombo!.coverageLevel * inputs.aphYield * inputs.springPrice)}/ac guaranteed,{' '}
            ${Math.round(topCombo!.hailExposurePct * inputs.aphYield * inputs.springPrice)}/ac exposed).
            {topCombo!.ecoLevel !== 'None' && ' ECO covers county losses but NOT individual hail damage to your specific fields.'}
          </p>

          <div className="text-sm text-slate-300 mb-2">
            <strong>Historical hail events in {inputs.county}:</strong>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {hailEvents.length === 0 && (
              <span className="text-xs text-slate-500">No recorded hail events in dataset for this county.</span>
            )}
            {hailEvents.slice(0, 8).map((evt, i) => (
              <span
                key={i}
                className={`text-xs px-2 py-1 rounded ${
                  evt.magnitude >= 1.5
                    ? 'bg-red-900/60 text-red-300'
                    : evt.magnitude >= 1.0
                    ? 'bg-orange-900/60 text-orange-300'
                    : 'bg-yellow-900/60 text-yellow-300'
                }`}
              >
                {evt.year}: {evt.magnitude}"
              </span>
            ))}
          </div>

          <div className="bg-amber-900/20 rounded-lg p-3 text-xs text-amber-200">
            💡 <strong>Consider:</strong> If going with lower RP coverage + ECO, talk to your agent about standalone hail insurance to cover the gap.
            Hail policies cover the full crop value — not just the insured band. See Pro Ag rates below.
          </div>

          {/* Real Pro Ag Hail Rates */}
          {(() => {
            const hailRates = getHailRates(inputs.county);
            const valuePerAcre = inputs.aphYield * inputs.springPrice;
            return (
              <div className="mt-3">
                <div className="text-sm font-semibold text-amber-200 mb-2">
                  📋 Pro Ag Hail Rates — {inputs.county} ({inputs.crop === 'corn' ? 'Corn' : 'Soybeans'})
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-600">
                      <th className="text-left py-1">Policy Form</th>
                      <th className="text-right py-1">Rate/$100</th>
                      <th className="text-right py-1">Est. Cost/ac</th>
                      <th className="text-right py-1">For {inputs.acres} acres</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hailRates.map(entry => {
                      const rate = inputs.crop === 'corn' ? entry.cornRate : entry.beanRate;
                      const costPerAcre = calcHailPremiumPerAcre(rate, valuePerAcre);
                      return (
                        <tr key={entry.policyForm} className={`border-b border-slate-700/50 ${entry.policyForm === 'Comp 3' ? 'bg-amber-900/20 font-semibold' : ''}`}>
                          <td className="py-1 text-slate-200">
                            {entry.policyForm}
                            {entry.policyForm === 'Comp 3' && <span className="ml-1 text-amber-300 text-xs">★ most common</span>}
                          </td>
                          <td className="py-1 text-right text-slate-300">${rate.toFixed(2)}</td>
                          <td className="py-1 text-right text-white font-semibold">${costPerAcre.toFixed(2)}</td>
                          <td className="py-1 text-right text-slate-300">${(costPerAcre * inputs.acres).toLocaleString('en-US', {maximumFractionDigits: 0})}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="mt-2 text-xs text-slate-500">
                  Source: Pro Ag rate file 2026 · Value basis: {inputs.aphYield} bu/ac × ${inputs.springPrice}/bu = ${valuePerAcre.toFixed(0)}/ac · Contact Root Risk Management for final quote.
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ─── Section D: Grain Marketing Exposure ─── */}
      <div className="bg-slate-800 rounded-xl p-4 space-y-4">
        <div>
          <h3 className="text-white font-bold text-lg mb-1">📈 Grain Marketing Risk & Exposure</h3>
          <p className="text-xs text-slate-400">
            Your insurance coverage protects revenue down to the guarantee level. Below that, indemnity kicks in.
            Above the guarantee — your unpriced grain is fully exposed to price swings.
          </p>
        </div>

        {/* Price swing bar chart */}
        <div>
          <div className="text-sm font-semibold text-slate-200 mb-2">Spring → Fall Price Change by Year ({inputs.crop})</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={priceChanges} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={3} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `$${v.toFixed(1)}`} />
              <Tooltip
                formatter={(v: number) => [`$${v.toFixed(2)}/bu`, 'Price Change']}
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Bar dataKey="change" radius={[3, 3, 0, 0]}>
                {priceChanges.map((entry, i) => (
                  <Cell key={i} fill={entry.change >= 0 ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: 'Years price fell',
              value: `${downYears.length} of ${priceChanges.length}`,
              sub: `${Math.round((downYears.length / priceChanges.length) * 100)}% of years`,
              color: 'text-red-400',
            },
            {
              label: 'Avg decline (down yrs)',
              value: `$${Math.abs(avgDown).toFixed(2)}/bu`,
              sub: 'avg loss when down',
              color: 'text-orange-400',
            },
            {
              label: 'Biggest drop',
              value: `${biggestDrop.year}: $${biggestDrop.change.toFixed(2)}`,
              sub: 'worst single year',
              color: 'text-red-400',
            },
            {
              label: 'Biggest rally',
              value: `${biggestRally.year}: +$${biggestRally.change.toFixed(2)}`,
              sub: 'best single year',
              color: 'text-green-400',
            },
          ].map(stat => (
            <div key={stat.label} className="bg-slate-700/50 rounded-lg p-3">
              <div className="text-xs text-slate-400 mb-1">{stat.label}</div>
              <div className={`font-bold text-sm ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-slate-500">{stat.sub}</div>
            </div>
          ))}
        </div>

        {/* Marketing exposure callout */}
        <div className="bg-slate-700/50 rounded-lg p-3">
          <div className="text-sm text-slate-200 mb-1 font-semibold">Your Price Exposure</div>
          <p className="text-xs text-slate-300">
            At {Math.round(coverageForMarketing * 100)}% coverage, your guarantee is{' '}
            <strong className="text-white">${guarantee.toFixed(0)}/ac</strong>. The top{' '}
            <strong className="text-white">{exposedBushels.toFixed(0)} bu/ac</strong> (
            <strong className="text-amber-300">${exposedRevenue.toFixed(0)}/ac</strong>) is unprotected by insurance —
            price risk falls entirely on your marketing plan.
          </p>
        </div>

        {/* Marketing recommendation */}
        <div className={`rounded-lg p-3 text-xs border ${planTypeForMarketing === 'YP' ? 'bg-red-900/20 border-red-700 text-red-200' : coverageForMarketing >= 0.80 ? 'bg-green-900/20 border-green-700 text-green-200' : 'bg-orange-900/20 border-orange-700 text-orange-200'}`}>
          <div className="font-bold mb-1">💡 Marketing Recommendation</div>
          {planTypeForMarketing === 'YP' && (
            <span>YP does not protect against price decline. Consider forward pricing aggressively or upgrading to RP.</span>
          )}
          {planTypeForMarketing !== 'YP' && coverageForMarketing >= 0.80 && (
            <span>Strong coverage. Consider forward pricing 20–30% of expected production at spring price to lock in some margin above your guarantee.</span>
          )}
          {planTypeForMarketing !== 'YP' && coverageForMarketing < 0.75 && (
            <span>Lower coverage level leaves significant price exposure. Consider pricing 40–50% of bushels forward or using put options to protect downside.</span>
          )}
          {planTypeForMarketing !== 'YP' && coverageForMarketing >= 0.75 && coverageForMarketing < 0.80 && (
            <span>Moderate coverage. Consider pricing 30–40% of expected production forward and monitoring futures closely through summer.</span>
          )}
        </div>

        {/* Seasonal price tendency */}
        <div>
          <div className="text-sm font-semibold text-slate-200 mb-2">Historical Price Tendency</div>
          <p className="text-xs text-slate-400 mb-2">
            In <strong className="text-green-400">{upYears.length}</strong> of {priceChanges.length} years, harvest price was{' '}
            <strong>higher</strong> than projected (green = rally, good if you were short). In{' '}
            <strong className="text-red-400">{downYears.length}</strong> years it was lower (red = decline, unpriced grain lost value).
          </p>
          <div className="flex flex-wrap gap-1.5">
            {priceChanges.map(d => (
              <div
                key={d.year}
                title={`${d.year}: ${d.change >= 0 ? '+' : ''}$${d.change.toFixed(2)}/bu`}
                className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold cursor-default ${
                  d.change >= 0 ? 'bg-green-700/60 text-green-200' : 'bg-red-800/60 text-red-200'
                }`}
              >
                {String(d.year).slice(2)}
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-1">Hover dots for exact change. Green = harvest &gt; projected. Red = harvest &lt; projected.</p>
        </div>
      </div>
    </div>
  );
}
