import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { buildComparisonTableExtended, PLAN_COMBOS } from '../lib/insurance';
import { COUNTY_YIELDS, COUNTY_APH, getProjPrices, getHarvPrices } from '../lib/historicalData';
import { getSubsidyRate, calcSubsidyBreakdown } from '../lib/dataSources';

const fmt = (n: number, d = 2) => n.toFixed(d);
const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function PlanComparison() {
  const { inputs } = useApp();

  const countyYields = COUNTY_YIELDS[inputs.county][inputs.crop];
  const countyAph = COUNTY_APH[inputs.county][inputs.crop];
  const projPrices = getProjPrices(inputs.crop);
  const harvPrices = getHarvPrices(inputs.crop);

  const rows = useMemo(
    () => buildComparisonTableExtended(inputs, countyYields, countyAph, projPrices, harvPrices),
    [inputs, countyYields, countyAph, projPrices, harvPrices]
  );

  const bestValueIdx = rows.reduce(
    (best, row, i) => row.valueScore > rows[best].valueScore ? i : best, 0
  );

  const isCurrentRow = (i: number) =>
    PLAN_COMBOS[i].planType === inputs.planType &&
    Math.abs(PLAN_COMBOS[i].coverageLevel - inputs.coverageLevel) < 0.01;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-slate-100 font-bold text-base">Plan Comparison</h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-700 inline-block" /> Current selection
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-900 inline-block" /> Best value
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-400 uppercase tracking-wider border-b border-slate-700">
              <th className="text-left py-2 pr-3 font-semibold">Plan</th>
              <th className="text-right py-2 px-2 font-semibold">Prem/ac<br/><span className="text-slate-600 normal-case">(farmer)</span></th>
              <th className="text-right py-2 px-2 font-semibold">Govt<br/>Subsidy</th>
              <th className="text-right py-2 px-2 font-semibold">Gross<br/>Prem/ac</th>
              {inputs.scoEnabled && <th className="text-right py-2 px-2 font-semibold text-purple-400">+SCO</th>}
              {inputs.ecoLevel !== 'None' && <th className="text-right py-2 px-2 font-semibold text-teal-400">+{inputs.ecoLevel}</th>}
              <th className="text-right py-2 px-2 font-semibold">Total<br/>Prem</th>
              <th className="text-right py-2 px-2 font-semibold">Guar.<br/>Rev/ac</th>
              <th className="text-right py-2 px-2 font-semibold">BEven<br/>Yield</th>
              <th className="text-right py-2 px-2 font-semibold">Hist<br/>Trigger%</th>
              {inputs.scoEnabled && <th className="text-right py-2 px-2 font-semibold text-purple-400">SCO%</th>}
              {inputs.ecoLevel !== 'None' && <th className="text-right py-2 px-2 font-semibold text-teal-400">ECO%</th>}
              <th className="text-right py-2 pl-2 font-semibold">Value<br/>Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isCurrent = isCurrentRow(i);
              const isBest = i === bestValueIdx;
              const subsidy = calcSubsidyBreakdown(
                row.premiumPerAcre / (1 - getSubsidyRate(row.coverageLevel)),
                row.coverageLevel
              );
              const grossPremium = row.premiumPerAcre / (1 - getSubsidyRate(row.coverageLevel));
              const subsidyPct = getSubsidyRate(row.coverageLevel);

              return (
                <tr
                  key={i}
                  className={`border-b border-slate-700/50 transition-colors
                    ${isCurrent ? 'bg-blue-900/40' : isBest ? 'bg-emerald-900/30' : 'hover:bg-slate-700/30'}
                  `}
                >
                  <td className="py-2.5 pr-3 font-semibold">
                    <span className={`
                      inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs
                      ${row.planType === 'RP' ? 'bg-blue-900 text-blue-300'
                        : row.planType === 'YP' ? 'bg-slate-700 text-slate-300'
                        : 'bg-indigo-900 text-indigo-300'}
                    `}>
                      {row.planType}
                    </span>
                    {' '}{pct(row.coverageLevel)}
                    {isCurrent && <span className="ml-1 text-blue-400">◀</span>}
                    {isBest && <span className="ml-1 text-emerald-400">★</span>}
                  </td>
                  <td className="text-right py-2.5 px-2 text-amber-400 font-bold">${fmt(row.premiumPerAcre)}</td>
                  <td className="text-right py-2.5 px-2 text-emerald-400">${fmt(subsidy.govtPays)}<br/><span className="text-slate-500 text-[10px]">{Math.round(subsidyPct * 100)}%</span></td>
                  <td className="text-right py-2.5 px-2 text-slate-400">${fmt(grossPremium)}</td>
                  {inputs.scoEnabled && <td className="text-right py-2.5 px-2 text-purple-400">${fmt(row.scoAddonCost)}</td>}
                  {inputs.ecoLevel !== 'None' && <td className="text-right py-2.5 px-2 text-teal-400">${fmt(row.ecoAddonCost)}</td>}
                  <td className="text-right py-2.5 px-2 text-slate-300">${fmt(row.totalPremium / inputs.acres * inputs.acres / inputs.acres)}</td>
                  <td className="text-right py-2.5 px-2 text-blue-300">${fmt(row.guaranteedRevenue)}</td>
                  <td className="text-right py-2.5 px-2 text-slate-300">{fmt(row.breakevenYield, 0)} bu</td>
                  <td className="text-right py-2.5 px-2">
                    <span className={`font-bold ${row.triggerRate >= 0.4 ? 'text-red-400' : row.triggerRate >= 0.2 ? 'text-amber-400' : 'text-slate-400'}`}>
                      {Math.round(row.triggerRate * 100)}%
                    </span>
                  </td>
                  {inputs.scoEnabled && (
                    <td className="text-right py-2.5 px-2 text-purple-400">{Math.round(row.scoTriggerRate * 100)}%</td>
                  )}
                  {inputs.ecoLevel !== 'None' && (
                    <td className="text-right py-2.5 px-2 text-teal-400">{Math.round(row.ecoTriggerRate * 100)}%</td>
                  )}
                  <td className="text-right py-2.5 pl-2">
                    <span className={`font-bold ${isBest ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {(row.valueScore * 1000).toFixed(1)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-400">
        <div className="bg-slate-900 rounded-xl p-3">
          <p className="text-slate-300 font-semibold mb-1">💡 Value Score</p>
          <p>Historical trigger rate ÷ farmer premium/ac. Higher = more return per dollar spent. ★ marks the best ratio.</p>
        </div>
        <div className="bg-emerald-950 border border-emerald-800 rounded-xl p-3">
          <p className="text-emerald-300 font-semibold mb-1">🏛️ Govt Subsidy</p>
          <p>The government pays 38–67% of gross premium depending on coverage level. The "Farmer Pays" column is your actual out-of-pocket cost.</p>
        </div>
        <div className="bg-slate-900 rounded-xl p-3">
          <p className="text-slate-300 font-semibold mb-1">📊 Historical Trigger%</p>
          <p>How often each plan/level would have triggered a payment in {inputs.county} from 2009–2023, based on actual county yields.</p>
        </div>
      </div>
    </div>
  );
}
