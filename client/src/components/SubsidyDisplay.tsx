import React from 'react';
import { useApp } from '../context/AppContext';
import { calcPremiumPerAcre, calcSCOPremiumPerAcre, calcECOPremiumPerAcre } from '../lib/insurance';
import { getSubsidyRate, calcSubsidyBreakdown } from '../lib/dataSources';

const fmt = (n: number) => n.toFixed(2);

export default function SubsidyDisplay() {
  const { inputs } = useApp();

  const farmerPremium = calcPremiumPerAcre(inputs);
  const grossPremium = farmerPremium / (1 - getSubsidyRate(inputs.coverageLevel));
  const subsidy = calcSubsidyBreakdown(grossPremium, inputs.coverageLevel);

  const scoPremiumFarmer = calcSCOPremiumPerAcre(inputs);
  const scoPremiumGross = inputs.scoEnabled ? scoPremiumFarmer / 0.35 : 0; // SCO subsidy = 65%
  const ecoFarmerPremium = calcECOPremiumPerAcre(inputs);
  const ecoGrossPremium = inputs.ecoLevel !== 'None' ? ecoFarmerPremium / 0.56 : 0; // ECO subsidy = 44%

  const totalGross = grossPremium + scoPremiumGross + ecoGrossPremium;
  const totalFarmer = farmerPremium + scoPremiumFarmer + ecoFarmerPremium;
  const totalGovt = totalGross - totalFarmer;
  const overallSubsidyPct = totalGross > 0 ? totalGovt / totalGross : 0;

  const totalAcres = inputs.acres;

  return (
    <div className="bg-gradient-to-br from-emerald-950 to-slate-900 border border-emerald-700 rounded-2xl p-6 shadow-xl">
      <h3 className="text-emerald-300 font-bold text-base mb-1">🏛️ Government Subsidy — Your Real Cost</h3>
      <p className="text-xs text-slate-400 mb-5">
        Most farmers underestimate the subsidy. At {Math.round(inputs.coverageLevel * 100)}% coverage,
        the government pays <span className="text-emerald-400 font-bold">{Math.round(getSubsidyRate(inputs.coverageLevel) * 100)}%</span> of your base premium.
      </p>

      {/* Big visual: govt vs farmer */}
      <div className="flex items-stretch gap-4 mb-5">
        <div className="flex-1 bg-emerald-900/40 border border-emerald-700 rounded-2xl p-5 text-center">
          <div className="text-xs text-emerald-400 uppercase tracking-wider mb-1">Govt Pays</div>
          <div className="text-4xl font-black text-emerald-400">${fmt(totalGovt)}</div>
          <div className="text-sm text-emerald-600">/acre/year</div>
          <div className="text-xs text-emerald-600 mt-1">${Math.round(totalGovt * totalAcres).toLocaleString()} total</div>
        </div>
        <div className="flex items-center text-slate-500 font-bold text-xl">+</div>
        <div className="flex-1 bg-amber-900/40 border border-amber-700 rounded-2xl p-5 text-center">
          <div className="text-xs text-amber-400 uppercase tracking-wider mb-1">You Pay</div>
          <div className="text-4xl font-black text-amber-400">${fmt(totalFarmer)}</div>
          <div className="text-sm text-amber-600">/acre/year</div>
          <div className="text-xs text-amber-600 mt-1">${Math.round(totalFarmer * totalAcres).toLocaleString()} total</div>
        </div>
        <div className="flex items-center text-slate-500 font-bold text-xl">=</div>
        <div className="flex-1 bg-slate-700/40 border border-slate-600 rounded-2xl p-5 text-center">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Gross Premium</div>
          <div className="text-4xl font-black text-slate-300">${fmt(totalGross)}</div>
          <div className="text-sm text-slate-500">/acre/year</div>
          <div className="text-xs text-slate-500 mt-1">${Math.round(totalGross * totalAcres).toLocaleString()} total</div>
        </div>
      </div>

      {/* Subsidy bar */}
      <div className="mb-5">
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>Subsidy rate: <span className="text-emerald-400 font-bold">{Math.round(overallSubsidyPct * 100)}%</span></span>
          <span>You pay only <span className="text-amber-400 font-bold">{Math.round((1 - overallSubsidyPct) * 100)}%</span></span>
        </div>
        <div className="h-4 rounded-full overflow-hidden bg-slate-700 flex">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${overallSubsidyPct * 100}%` }}
          />
          <div
            className="h-full bg-amber-500 transition-all"
            style={{ width: `${(1 - overallSubsidyPct) * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-emerald-400">← Govt</span>
          <span className="text-amber-400">You →</span>
        </div>
      </div>

      {/* Breakdown table */}
      <div className="space-y-2 text-xs">
        <div className="flex justify-between items-center py-1.5 border-b border-slate-700">
          <span className="text-slate-400">{inputs.planType} {Math.round(inputs.coverageLevel * 100)}% (base)</span>
          <div className="flex gap-6">
            <span className="text-emerald-400">Govt: ${fmt(subsidy.govtPays)}</span>
            <span className="text-amber-400">You: ${fmt(subsidy.farmerPays)}</span>
            <span className="text-slate-500">({Math.round(subsidy.rate * 100)}% subsidy)</span>
          </div>
        </div>
        {inputs.scoEnabled && (
          <div className="flex justify-between items-center py-1.5 border-b border-slate-700">
            <span className="text-purple-400">SCO Band</span>
            <div className="flex gap-6">
              <span className="text-emerald-400">Govt: ${fmt(scoPremiumGross * 0.65)}</span>
              <span className="text-amber-400">You: ${fmt(scoPremiumFarmer)}</span>
              <span className="text-slate-500">(65% subsidy)</span>
            </div>
          </div>
        )}
        {inputs.ecoLevel !== 'None' && (
          <div className="flex justify-between items-center py-1.5 border-b border-slate-700">
            <span className="text-teal-400">{inputs.ecoLevel} Band</span>
            <div className="flex gap-6">
              <span className="text-emerald-400">Govt: ${fmt(ecoGrossPremium * 0.44)}</span>
              <span className="text-amber-400">You: ${fmt(ecoFarmerPremium)}</span>
              <span className="text-slate-500">(44% subsidy)</span>
            </div>
          </div>
        )}
        <div className="flex justify-between items-center py-1.5 font-bold">
          <span className="text-slate-300">TOTAL</span>
          <div className="flex gap-6">
            <span className="text-emerald-300">Govt: ${fmt(totalGovt)}/ac (${Math.round(totalGovt * totalAcres).toLocaleString()})</span>
            <span className="text-amber-300">You: ${fmt(totalFarmer)}/ac (${Math.round(totalFarmer * totalAcres).toLocaleString()})</span>
          </div>
        </div>
      </div>

      <div className="mt-4 bg-emerald-950 border border-emerald-800 rounded-xl p-3 text-xs text-emerald-300">
        💡 <strong>The real math:</strong> For every $1 you spend on crop insurance at {Math.round(inputs.coverageLevel * 100)}% coverage,
        the government contributes ${(overallSubsidyPct / (1 - overallSubsidyPct)).toFixed(2)}.
        Your net cost is only ${fmt(totalFarmer)}/ac to protect ${fmt(inputs.aphYield * inputs.springPrice)}/ac of revenue.
      </div>
    </div>
  );
}
