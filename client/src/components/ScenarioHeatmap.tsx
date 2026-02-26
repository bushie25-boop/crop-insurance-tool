import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { generateHeatmap, calcSCOIndemnity, calcECOIndemnity } from '../lib/insurance';
import { COUNTY_APH } from '../lib/historicalData';

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function indemnityColor(indemnity: number, max: number): string {
  if (indemnity === 0) return 'bg-slate-700 hover:bg-slate-600';
  const r = indemnity / max;
  if (r < 0.15) return 'bg-yellow-900 hover:bg-yellow-800 border-yellow-700';
  if (r < 0.35) return 'bg-yellow-600 hover:bg-yellow-500';
  if (r < 0.60) return 'bg-orange-500 hover:bg-orange-400';
  return 'bg-red-600 hover:bg-red-500';
}

function scoEcoColor(sco: number, eco: number): string {
  const total = sco + eco;
  if (total === 0) return '';
  if (eco > 0) return 'ring-2 ring-teal-400';
  return 'ring-2 ring-purple-400';
}

const PRICE_LABELS_CORN = ['$2.00','$2.50','$3.00','$3.50','$4.00','$4.50','$5.00','$5.50','$6.00'];
const PRICE_LABELS_SOY  = ['$6','$7','$8','$9','$10','$11','$12','$13','$14','$15','$16'];
const YIELD_PCTS = [1.2,1.1,1.0,0.9,0.8,0.7,0.6,0.5,0.4];

export default function ScenarioHeatmap() {
  const { inputs } = useApp();
  const [hovered, setHovered] = useState<{ price: number; yPct: number; ind: number; sco: number; eco: number } | null>(null);

  const cells = generateHeatmap(inputs);
  const maxInd = Math.max(...cells.map(c => c.indemnity), 1);
  const countyAph = COUNTY_APH[inputs.county][inputs.crop];

  const priceLabels = inputs.crop === 'corn' ? PRICE_LABELS_CORN : PRICE_LABELS_SOY;
  const prices = inputs.crop === 'corn'
    ? [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0]
    : [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

  // Current price column index
  const curPriceIdx = prices.reduce((best, p, i) =>
    Math.abs(p - inputs.springPrice) < Math.abs(prices[best] - inputs.springPrice) ? i : best, 0);
  const curYieldPct = 1.0;
  const curYieldIdx = YIELD_PCTS.indexOf(curYieldPct);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-slate-100 font-bold text-base">Scenario Heatmap — Indemnity per Acre</h3>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-700 inline-block"/>&nbsp;No payment</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-600 inline-block"/>&nbsp;Small</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500 inline-block"/>&nbsp;Medium</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-600 inline-block"/>&nbsp;Large</span>
          {inputs.scoEnabled && <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-purple-400 inline-block"/>&nbsp;+SCO</span>}
          {inputs.ecoLevel !== 'None' && <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-teal-400 inline-block"/>&nbsp;+ECO</span>}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Price axis header */}
          <div className="flex ml-16 mb-1">
            {priceLabels.map((p, i) => (
              <div key={i} className={`flex-1 min-w-[52px] text-center text-xs ${i === curPriceIdx ? 'text-blue-400 font-bold' : 'text-slate-500'}`}>
                {p}
                {i === curPriceIdx && <div className="text-blue-400">▼</div>}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {YIELD_PCTS.map((yPct, ri) => {
            const actualYield = inputs.aphYield * yPct;
            const countyYieldPct = (actualYield / countyAph);
            return (
              <div key={yPct} className="flex items-center mb-0.5">
                <div className={`w-14 text-right pr-2 text-xs ${ri === curYieldIdx ? 'text-blue-400 font-bold' : 'text-slate-500'} flex-shrink-0`}>
                  {Math.round(yPct * 100)}%
                  {ri === curYieldIdx && <span className="ml-1">◀</span>}
                </div>
                {prices.map((price, ci) => {
                  const cell = cells.find(c => c.price === price && Math.abs(c.yieldPct - yPct) < 0.01);
                  const ind = cell?.indemnity ?? 0;
                  const sco = calcSCOIndemnity(inputs, countyYieldPct);
                  const eco = calcECOIndemnity(inputs, countyYieldPct);
                  const isCurrent = ci === curPriceIdx && ri === curYieldIdx;
                  const ringClass = scoEcoColor(sco, eco);

                  return (
                    <div
                      key={price}
                      onMouseEnter={() => setHovered({ price, yPct, ind, sco, eco })}
                      onMouseLeave={() => setHovered(null)}
                      className={`flex-1 min-w-[52px] h-9 mx-0.5 rounded cursor-pointer transition-all duration-100 border border-transparent flex items-center justify-center text-xs font-mono
                        ${indemnityColor(ind, maxInd)} ${ringClass}
                        ${isCurrent ? 'outline outline-2 outline-white' : ''}`}
                    >
                      {ind > 0 ? `$${fmt(ind)}` : ''}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* X-axis label */}
          <div className="text-center text-xs text-slate-500 mt-2 ml-16">
            Harvest Price ($/bu) →
          </div>
        </div>
      </div>

      {/* Y-axis label */}
      <div className="text-xs text-slate-500 mt-1">↑ Yield (% of APH {inputs.aphYield} bu/ac)</div>

      {/* Hover tooltip */}
      {hovered && (
        <div className="mt-4 bg-slate-900 border border-slate-600 rounded-xl p-4 text-sm">
          <div className="flex flex-wrap gap-6">
            <div>
              <span className="text-slate-400">Harvest Price:</span>{' '}
              <span className="text-white font-bold">${hovered.price.toFixed(2)}/bu</span>
            </div>
            <div>
              <span className="text-slate-400">Farm Yield:</span>{' '}
              <span className="text-white font-bold">{fmt(inputs.aphYield * hovered.yPct)} bu/ac ({Math.round(hovered.yPct * 100)}% of APH)</span>
            </div>
            <div>
              <span className="text-slate-400">Underlying Indemnity:</span>{' '}
              <span className={`font-bold ${hovered.ind > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                ${fmt(hovered.ind)}/ac
              </span>
            </div>
            {inputs.scoEnabled && (
              <div>
                <span className="text-purple-400">SCO Indemnity:</span>{' '}
                <span className="text-purple-300 font-bold">${fmt(hovered.sco)}/ac</span>
              </div>
            )}
            {inputs.ecoLevel !== 'None' && (
              <div>
                <span className="text-teal-400">{inputs.ecoLevel} Indemnity:</span>{' '}
                <span className="text-teal-300 font-bold">${fmt(hovered.eco)}/ac</span>
              </div>
            )}
            <div>
              <span className="text-slate-400">Total:</span>{' '}
              <span className="text-amber-400 font-bold">${fmt(hovered.ind + hovered.sco + hovered.eco)}/ac</span>
            </div>
          </div>
        </div>
      )}

      {/* SCO/ECO trigger notes */}
      {(inputs.scoEnabled || inputs.ecoLevel !== 'None') && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {inputs.scoEnabled && (
            <div className="bg-purple-950 border border-purple-700 rounded-xl p-3 text-xs text-purple-300">
              <span className="font-bold">SCO Trigger:</span> County yield drops below 86% of county APH ({Math.round(countyAph * 0.86)} bu/ac).
              SCO ring appears on cells where county yield would be below this threshold.
            </div>
          )}
          {inputs.ecoLevel !== 'None' && (
            <div className="bg-teal-950 border border-teal-700 rounded-xl p-3 text-xs text-teal-300">
              <span className="font-bold">{inputs.ecoLevel} Trigger:</span> County yield drops below {inputs.ecoLevel === 'ECO-90' ? '90' : '95'}% of county APH ({Math.round(countyAph * (inputs.ecoLevel === 'ECO-90' ? 0.90 : 0.95))} bu/ac).
            </div>
          )}
        </div>
      )}
    </div>
  );
}
