// PlanComparison.tsx — 11-combo plan comparison table
import React from 'react';
import type { InsuranceState } from '../hooks/useInsurance';

interface Props {
  state: InsuranceState;
}

function fmt(n: number, dec = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export default function PlanComparison({ state }: Props) {
  const { comparisonTable, inputs } = state;

  if (!comparisonTable.length) {
    return (
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="text-white font-bold text-lg mb-2">📊 Plan Comparison</h3>
        <div className="text-slate-400">Loading comparison data...</div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <h3 className="text-white font-bold text-lg mb-1">📊 Plan Comparison — All 11 Combos</h3>
      <p className="text-xs text-slate-400 mb-3">
        15-year historical trigger rate based on {inputs.county} county yields.
        <span className="text-blue-400 ml-2">Blue = current selection</span>
        <span className="text-green-400 ml-2">Green = best value (trigger rate per premium $)</span>
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs border-b border-slate-700">
              <th className="text-left py-2 px-2">Plan</th>
              <th className="text-left py-2 px-2">Coverage</th>
              <th className="text-right py-2 px-2">Premium/ac*</th>
              <th className="text-right py-2 px-2">Govt pays/ac</th>
              <th className="text-right py-2 px-2">Guarantee/ac</th>
              <th className="text-right py-2 px-2">Subsidy %</th>
              <th className="text-right py-2 px-2">Trigger Rate</th>
              <th className="text-right py-2 px-2">Value Score</th>
            </tr>
          </thead>
          <tbody>
            {comparisonTable.map((row, i) => {
              const rowClass = row.isCurrentSelection
                ? 'bg-blue-900/40 border border-blue-600'
                : row.isBestValue
                ? 'bg-green-900/40 border border-green-600'
                : 'border-b border-slate-700/50';

              return (
                <tr key={i} className={`${rowClass} rounded`}>
                  <td className="py-2 px-2 font-semibold text-white">
                    {row.planType}
                    {row.isCurrentSelection && <span className="ml-1 text-blue-300 text-xs">← you</span>}
                    {row.isBestValue && !row.isCurrentSelection && <span className="ml-1 text-green-300 text-xs">← best $</span>}
                  </td>
                  <td className="py-2 px-2 text-slate-300">
                    {Math.round(row.coverageLevel * 100)}%
                  </td>
                  <td className="py-2 px-2 text-right text-yellow-400 font-bold">
                    ${fmt(row.farmerPremiumPerAcre)}
                  </td>
                  <td className="py-2 px-2 text-right text-green-400">
                    ${fmt(row.govtPaysPerAcre)}
                  </td>
                  <td className="py-2 px-2 text-right text-slate-300">
                    ${fmt(row.guaranteePerAcre)}
                  </td>
                  <td className="py-2 px-2 text-right text-slate-300">
                    {Math.round(row.subsidyPct * 100)}%
                  </td>
                  <td className="py-2 px-2 text-right">
                    <span className={row.historicalTriggerRate > 0.5 ? 'text-green-400' : row.historicalTriggerRate > 0.3 ? 'text-yellow-400' : 'text-slate-300'}>
                      {Math.round(row.historicalTriggerRate * 100)}%
                    </span>
                    <span className="text-slate-500 text-xs ml-1">
                      ({Math.round(row.historicalTriggerRate * 15)}/15 yrs)
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right text-xs text-slate-400">
                    {row.valueScore.toFixed(3)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-xs text-slate-500">
        * Estimated premiums. Trigger rate = years payment triggered ÷ total years (historical county yields).
        Value Score = trigger rate ÷ farmer premium (higher = better coverage per dollar).
      </div>
    </div>
  );
}
