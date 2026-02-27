// SummaryCards.tsx — live-updating summary of guarantees and premiums
import React from 'react';
import type { InsuranceState } from '../hooks/useInsurance';

interface Props {
  state: InsuranceState;
}

function fmt(n: number, dec = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export default function SummaryCards({ state }: Props) {
  const { inputs, premiumSummary, revenueGuarantee, yieldGuarantee, coverageLabel, topCoveragePct } = state;
  const { underlying, sco, eco, totalFarmerPerAcre, totalFarmerAllAcres } = premiumSummary;

  const guaranteeLabel = inputs.planType === 'YP' ? 'Yield Guarantee' : 'Revenue Guarantee';
  const guaranteeValue = inputs.planType === 'YP'
    ? `${fmt(yieldGuarantee, 1)} bu/ac`
    : `$${fmt(revenueGuarantee)}/ac`;
  const guaranteeSubtext = inputs.planType === 'YP'
    ? `$${fmt(yieldGuarantee * inputs.springPrice)}/ac at projected price`
    : `${inputs.aphYield} bu × ${fmtPct(inputs.coverageLevel)} × $${inputs.springPrice}`;

  return (
    <div className="space-y-3">
      {/* Coverage label */}
      <div className="bg-blue-900/40 border border-blue-600 rounded-lg px-4 py-2 text-center">
        <span className="text-blue-300 font-bold">{coverageLabel}</span>
        <span className="text-slate-400 text-sm ml-2">(top {topCoveragePct}% covered)</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">

        {/* Guarantee card */}
        <div className="bg-slate-800 rounded-xl p-4 col-span-2 md:col-span-1">
          <div className="text-xs text-slate-400 mb-1">{guaranteeLabel}</div>
          <div className="text-2xl font-black text-white">{guaranteeValue}</div>
          <div className="text-xs text-slate-500 mt-1">{guaranteeSubtext}</div>
          {inputs.planType === 'RP' && (
            <div className="text-xs text-blue-300 mt-1">
              ↑ Adjusts up if harvest price rises
            </div>
          )}
        </div>

        {/* Underlying premium card */}
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-2">Underlying Premium</div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Total actuarial:</span>
              <span>${fmt(underlying.gross)}/ac</span>
            </div>
            <div className="flex justify-between text-xs text-green-400">
              <span>🏛️ Govt pays ({fmtPct(underlying.subsidyPct)}):</span>
              <span>${fmt(underlying.govtPays)}/ac</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-white">
              <span>💰 Your cost:</span>
              <span>${fmt(underlying.farmerPays)}/ac</span>
            </div>
          </div>
          {inputs.isBFR && (
            <div className="mt-1 text-xs text-green-300 bg-green-900/30 rounded px-2 py-1">
              🎓 BFR subsidy applied
            </div>
          )}
        </div>

        {/* SCO card */}
        {inputs.scoEnabled && (
          <div className="bg-purple-900/30 border border-purple-700 rounded-xl p-4">
            <div className="text-xs text-purple-300 mb-2">SCO Add-on (80% subsidized)</div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Total actuarial:</span>
                <span>${fmt(sco.gross)}/ac</span>
              </div>
              <div className="flex justify-between text-xs text-green-400">
                <span>🏛️ Govt pays (80%):</span>
                <span>${fmt(sco.govtPays)}/ac</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-white">
                <span>💰 Your cost:</span>
                <span>${fmt(sco.farmerPays)}/ac</span>
              </div>
            </div>
            <div className="text-xs text-purple-300 mt-1">
              Band: {fmtPct(inputs.coverageLevel)} → 86%
            </div>
          </div>
        )}

        {/* ECO card */}
        {inputs.ecoLevel !== 'None' && (
          <div className="bg-teal-900/30 border border-teal-700 rounded-xl p-4">
            <div className="text-xs text-teal-300 mb-2">{inputs.ecoLevel} (80% subsidized)</div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Total actuarial:</span>
                <span>${fmt(eco.gross)}/ac</span>
              </div>
              <div className="flex justify-between text-xs text-green-400">
                <span>🏛️ Govt pays (80%):</span>
                <span>${fmt(eco.govtPays)}/ac</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-white">
                <span>💰 Your cost:</span>
                <span>${fmt(eco.farmerPays)}/ac</span>
              </div>
            </div>
            <div className="text-xs text-teal-300 mt-1">
              Band: 86% → {inputs.ecoLevel === 'ECO-90' ? '90%' : '95%'}
            </div>
          </div>
        )}

        {/* Total cost card */}
        <div className="bg-slate-700 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-2">Total Farmer Cost</div>
          <div className="text-2xl font-black text-yellow-400">${fmt(totalFarmerPerAcre)}/ac</div>
          <div className="text-slate-300 font-semibold mt-1">
            ${fmt(totalFarmerAllAcres, 0)} total
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {fmt(inputs.acres, 0)} acres × ${fmt(totalFarmerPerAcre)}/ac
          </div>
        </div>

      </div>

      {/* Estimated disclaimer */}
      <div className="text-xs text-slate-500 text-center">
        * Estimated premium based on approximate RMA actuarial rates. Actual premium determined at policy issuance.
        Verify at: <a href="https://ewebapp.rma.usda.gov/apps/costestimator/" target="_blank" rel="noopener noreferrer"
          className="text-blue-400 hover:underline">ewebapp.rma.usda.gov/apps/costestimator/</a>
      </div>
    </div>
  );
}
