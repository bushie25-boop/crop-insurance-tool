// ScenarioHeatmap.tsx — 2D indemnity heatmap (harvest price × yield)
import React, { useState } from 'react';
import type { InsuranceState } from '../hooks/useInsurance';
import { getHeatmapColor } from '../lib/insurance';

interface Props {
  state: InsuranceState;
}

function fmt(n: number, dec = 0): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export default function ScenarioHeatmap({ state }: Props) {
  const { inputs, heatmap } = state;
  const [tooltip, setTooltip] = useState<typeof heatmap[0] | null>(null);

  const maxIndemnity = Math.max(...heatmap.map(c => c.totalIndemnity), 1);

  // Get unique prices and yields for axes
  const prices = Array.from(new Set(heatmap.map(c => c.price))).sort((a, b) => a - b);
  const yieldPcts = Array.from(new Set(heatmap.map(c => c.yieldPct))).sort((a, b) => b - a); // high to low

  function getCell(price: number, yieldPct: number) {
    return heatmap.find(c => c.price === price && c.yieldPct === yieldPct);
  }

  const coveragePct = inputs.coverageLevel * 100;

  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <h3 className="text-white font-bold text-lg mb-1">🎯 Scenario Heatmap</h3>
      <p className="text-xs text-slate-400 mb-3">
        Indemnity per acre at each harvest price × farm yield combination.
        Current selection: <span className="text-blue-300">{inputs.planType} {coveragePct}%</span>
        {inputs.scoEnabled && <span className="text-purple-300"> + SCO</span>}
        {inputs.ecoLevel !== 'None' && <span className="text-teal-300"> + {inputs.ecoLevel}</span>}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-slate-400 text-left px-1 py-1 whitespace-nowrap">
                Yield % APH ↓ / Harvest Price →
              </th>
              {prices.map(p => (
                <th key={p} className="text-slate-400 font-normal text-center px-1 py-1 whitespace-nowrap">
                  ${p.toFixed(2)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {yieldPcts.map(yPct => (
              <tr key={yPct}>
                <td className="text-slate-400 px-1 py-0.5 whitespace-nowrap">
                  {Math.round(yPct * 100)}% = {fmt(inputs.aphYield * yPct, 0)} bu
                  {Math.abs(yPct - inputs.coverageLevel) < 0.01 && (
                    <span className="text-blue-400 ml-1">← guarantee line</span>
                  )}
                </td>
                {prices.map(price => {
                  const cell = getCell(price, yPct);
                  if (!cell) return <td key={price} />;
                  const colorClass = getHeatmapColor(cell.totalIndemnity, maxIndemnity);
                  // Show RP guarantee line
                  const rpGuarantee = inputs.aphYield * inputs.coverageLevel * Math.max(inputs.springPrice, price);
                  const isAtGuaranteeLine = Math.abs(cell.actualYield * price - rpGuarantee) < rpGuarantee * 0.05;
                  return (
                    <td key={price}
                      className={`${colorClass} text-center rounded cursor-pointer transition-all hover:opacity-80 px-1 py-1 relative`}
                      style={{ minWidth: '52px' }}
                      onMouseEnter={() => setTooltip(cell)}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {cell.totalIndemnity > 0 ? `$${fmt(cell.totalIndemnity)}` : '—'}
                      {isAtGuaranteeLine && inputs.planType !== 'YP' && (
                        <div className="absolute inset-0 border-2 border-blue-400 rounded pointer-events-none" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex gap-3 mt-3 flex-wrap text-xs">
        <div className="flex items-center gap-1"><div className="w-4 h-4 rounded bg-slate-700" />No payment</div>
        <div className="flex items-center gap-1"><div className="w-4 h-4 rounded bg-yellow-500" />Small</div>
        <div className="flex items-center gap-1"><div className="w-4 h-4 rounded bg-orange-500" />Medium</div>
        <div className="flex items-center gap-1"><div className="w-4 h-4 rounded bg-red-600" />Large</div>
        {inputs.planType !== 'YP' && (
          <div className="flex items-center gap-1"><div className="w-4 h-4 rounded border-2 border-blue-400" />RP guarantee line</div>
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="mt-3 bg-slate-700 rounded-lg p-3 text-sm">
          <div className="text-white font-bold mb-1">
            Harvest: ${tooltip.price.toFixed(2)}/bu · Yield: {fmt(tooltip.actualYield, 0)} bu/ac ({Math.round(tooltip.yieldPct * 100)}% of APH)
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="bg-blue-900/40 rounded p-2">
              <div className="text-slate-400">Underlying</div>
              <div className="text-white font-bold">${fmt(tooltip.indemnity)}/ac</div>
            </div>
            {inputs.scoEnabled && (
              <div className="bg-purple-900/40 rounded p-2">
                <div className="text-slate-400">SCO</div>
                <div className="text-white font-bold">${fmt(tooltip.scoIndemnity)}/ac</div>
              </div>
            )}
            {inputs.ecoLevel !== 'None' && (
              <div className="bg-teal-900/40 rounded p-2">
                <div className="text-slate-400">ECO</div>
                <div className="text-white font-bold">${fmt(tooltip.ecoIndemnity)}/ac</div>
              </div>
            )}
            <div className="bg-green-900/40 rounded p-2">
              <div className="text-slate-400">Total</div>
              <div className="text-green-400 font-bold">${fmt(tooltip.totalIndemnity)}/ac</div>
            </div>
          </div>
        </div>
      )}

      {/* SCO/ECO note */}
      {(inputs.scoEnabled || inputs.ecoLevel !== 'None') && (
        <div className="mt-2 text-xs text-amber-300">
          ⚠️ SCO/ECO in heatmap uses farm revenue ratio as proxy for county — actual SCO/ECO triggers on county-level yields.
          SCO/ECO payments are issued mid-year following the loss year.
        </div>
      )}
    </div>
  );
}
