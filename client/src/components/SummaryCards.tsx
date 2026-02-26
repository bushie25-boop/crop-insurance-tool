import React from 'react';
import { useApp } from '../context/AppContext';
import {
  calcGuaranteedRevenue,
  calcPremiumPerAcre,
  calcGrossPremiumPerAcre,
  calcGovtSubsidyPerAcre,
  calcSCOPremiumPerAcre,
  calcECOPremiumPerAcre,
  calcBreakevenYield,
  getFarmerSubsidyPct,
} from '../lib/insurance';

const fmt = (n: number, decimals = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

interface CardProps {
  title: string;
  value: string;
  sub?: string;
  accent?: string;
  icon?: string;
  detail?: React.ReactNode;
}

function Card({ title, value, sub, accent = 'text-blue-400', icon, detail }: CardProps) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 uppercase tracking-widest">{title}</span>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <div className={`text-3xl font-black ${accent} leading-none`}>{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
      {detail && <div className="mt-1 pt-2 border-t border-slate-700">{detail}</div>}
    </div>
  );
}

export default function SummaryCards() {
  const { inputs } = useApp();

  const guaranteed = calcGuaranteedRevenue(inputs);
  const farmerBasePremium = calcPremiumPerAcre(inputs); // farmer's cost after RMA subsidy
  const grossBasePremium = calcGrossPremiumPerAcre(inputs);
  const govtSubsidy = calcGovtSubsidyPerAcre(inputs);
  const subsidyPct = getFarmerSubsidyPct(inputs.coverageLevel);
  const scoPremium = calcSCOPremiumPerAcre(inputs);
  const ecoPremium = calcECOPremiumPerAcre(inputs);
  const farmerTotal = farmerBasePremium + scoPremium + ecoPremium;
  const farmerTotalAll = farmerTotal * inputs.acres;
  const breakevenYield = calcBreakevenYield(inputs);

  const isYP = inputs.planType === 'YP';
  const guaranteedLabel = isYP
    ? `${fmt(guaranteed, 1)} bu/ac`
    : `$${fmt(guaranteed)}/ac`;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card
        icon="🛡️"
        title={isYP ? 'Guaranteed Yield' : 'Guaranteed Revenue'}
        value={guaranteedLabel}
        sub={isYP
          ? `${Math.round(inputs.coverageLevel * 100)}% of ${inputs.aphYield} bu APH`
          : `APH × ${Math.round(inputs.coverageLevel * 100)}% × $${inputs.springPrice}`}
        accent="text-blue-400"
      />

      <Card
        icon="💰"
        title="Your Premium / acre"
        value={`$${fmt(farmerTotal)}`}
        accent="text-amber-400"
        sub={`$${fmt(farmerTotalAll, 0)} total for ${inputs.acres.toLocaleString()} ac`}
        detail={
          <div className="space-y-1 text-xs">
            {/* Subsidy breakdown — the big selling point */}
            <div className="flex justify-between text-slate-400">
              <span>Total premium (gross)</span>
              <span className="text-slate-300">${fmt(grossBasePremium)}/ac</span>
            </div>
            <div className="flex justify-between text-green-400 font-medium">
              <span>🏛️ Govt pays ({Math.round(subsidyPct * 100)}%)</span>
              <span className="text-green-300">${fmt(govtSubsidy)}/ac</span>
            </div>
            <div className="flex justify-between text-amber-300 font-bold">
              <span>💰 Your cost</span>
              <span>${fmt(farmerBasePremium)}/ac</span>
            </div>
            {inputs.scoEnabled && (
              <div className="flex justify-between text-purple-400 mt-1 pt-1 border-t border-slate-700">
                <span>+ SCO ({Math.round(inputs.coverageLevel*100)}%→86%)</span>
                <span className="text-purple-300">${fmt(scoPremium)}</span>
              </div>
            )}
            {inputs.ecoLevel !== 'None' && (
              <div className="flex justify-between text-teal-400">
                <span>+ {inputs.ecoLevel} (86%→{inputs.ecoLevel === 'ECO-90' ? '90' : '95'}%)</span>
                <span className="text-teal-300">${fmt(ecoPremium)}</span>
              </div>
            )}
            {/* Fix 4: Disclaimer */}
            <p className="text-slate-500 italic text-[10px] pt-1">* Estimated. Actual premium determined at policy issuance by RMA.</p>
          </div>
        }
      />

      <Card
        icon="🔥"
        title="Max Indemnity / acre"
        value={`$${fmt(guaranteed)}`}
        accent="text-red-400"
        sub="Worst-case total loss payout"
      />

      <Card
        icon="⚖️"
        title="Break-even Yield"
        value={`${fmt(breakevenYield, 1)} bu/ac`}
        accent="text-emerald-400"
        sub={`Payment triggers below ${fmt(breakevenYield, 1)} bu/ac`}
        detail={
          <div className="flex items-center gap-2 text-xs">
            <div className="flex-1 bg-slate-700 rounded-full h-1.5">
              <div
                className="bg-emerald-500 h-1.5 rounded-full"
                style={{ width: `${Math.min(100, (breakevenYield / inputs.aphYield) * 100)}%` }}
              />
            </div>
            <span className="text-slate-400">{Math.round((breakevenYield / inputs.aphYield) * 100)}% of APH</span>
          </div>
        }
      />
    </div>
  );
}
