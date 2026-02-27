import { useState, useMemo } from 'react';
import { getHailRates, type HailRateEntry } from '../lib/historicalData';

type InputMode = 'coverage' | 'cost';

export default function HailQuoter({ county, crop, aphYield, springPrice, acres }: {
  county: string;
  crop: 'corn' | 'soybeans';
  aphYield: number;
  springPrice: number;
  acres: number;
}) {
  const rates = getHailRates(county);
  const defaultValuePerAcre = aphYield * springPrice;

  const [inputMode, setInputMode] = useState<InputMode>('coverage');
  const [selectedPolicy, setSelectedPolicy] = useState<string>('Comp 3');
  const [coveragePerAcre, setCoveragePerAcre] = useState<number>(Math.round(defaultValuePerAcre));
  const [costPerAcre, setCostPerAcre] = useState<number>(10);
  const [damagePercent, setDamagePercent] = useState<number>(30);

  const policy = rates.find(r => r.policyForm === selectedPolicy) ?? rates[3] ?? rates[0];
  const rate = crop === 'corn' ? policy.cornRate : policy.beanRate;

  const effectiveCoverage = useMemo(() => {
    if (inputMode === 'coverage') return coveragePerAcre;
    return rate > 0 ? (costPerAcre / rate) * 100 : 0;
  }, [inputMode, coveragePerAcre, costPerAcre, rate]);

  const premiumPerAcre = (rate / 100) * effectiveCoverage;
  const indemnityPerAcre = (damagePercent / 100) * effectiveCoverage;
  const netPerAcre = indemnityPerAcre - premiumPerAcre;
  const breakevenPct = effectiveCoverage > 0 ? (premiumPerAcre / effectiveCoverage) * 100 : 0;
  const totalPremium = premiumPerAcre * acres;
  const totalIndemnity = indemnityPerAcre * acres;
  const totalNet = netPerAcre * acres;

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  const fmtAc = (n: number) => `$${n.toFixed(2)}/ac`;

  return (
    <div className="space-y-6 p-4">
      <div className="text-lg font-bold text-white">🌩️ Hail Insurance Quoter</div>
      <div className="text-sm text-slate-400">Pro Ag · {county} · {crop === 'corn' ? 'Corn' : 'Soybeans'}</div>

      <div>
        <label className="block text-xs text-slate-400 mb-2">Policy Form</label>
        <div className="flex flex-wrap gap-2">
          {rates.map(r => (
            <button key={r.policyForm}
              onClick={() => setSelectedPolicy(r.policyForm)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                selectedPolicy === r.policyForm
                  ? 'bg-amber-500 text-black'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}>
              {r.policyForm}
              {r.policyForm === 'Comp 3' && <span className="ml-1 text-xs opacity-70">★</span>}
            </button>
          ))}
        </div>
        <div className="mt-1 text-xs text-slate-500">{policy.description} · Rate: ${rate.toFixed(2)} per $100 of coverage</div>
      </div>

      <div>
        <div className="flex rounded overflow-hidden border border-slate-600 w-fit mb-3">
          <button
            onClick={() => setInputMode('coverage')}
            className={`px-4 py-2 text-sm font-medium ${inputMode === 'coverage' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
            Set Coverage ($/ac)
          </button>
          <button
            onClick={() => setInputMode('cost')}
            className={`px-4 py-2 text-sm font-medium ${inputMode === 'cost' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
            Set Cost ($/ac)
          </button>
        </div>

        {inputMode === 'coverage' ? (
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Coverage per acre <span className="text-slate-500">(crop value = {fmtAc(defaultValuePerAcre)})</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={100} max={Math.max(1500, Math.round(defaultValuePerAcre * 1.2))} step={10}
                value={coveragePerAcre}
                onChange={e => setCoveragePerAcre(Number(e.target.value))}
                className="flex-1"
              />
              <input
                type="number"
                value={coveragePerAcre}
                onChange={e => setCoveragePerAcre(Number(e.target.value))}
                className="w-24 bg-slate-700 text-white rounded px-2 py-1 text-sm border border-slate-600"
              />
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {effectiveCoverage > 0 ? `${Math.round((effectiveCoverage / defaultValuePerAcre) * 100)}% of crop value` : ''}
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs text-slate-400 mb-1">Premium cost per acre (you choose what to spend)</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1} max={30} step={0.5}
                value={costPerAcre}
                onChange={e => setCostPerAcre(Number(e.target.value))}
                className="flex-1"
              />
              <input
                type="number"
                value={costPerAcre}
                onChange={e => setCostPerAcre(Number(e.target.value))}
                className="w-24 bg-slate-700 text-white rounded px-2 py-1 text-sm border border-slate-600"
              />
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Buys {fmtAc(effectiveCoverage)} of coverage ({Math.round((effectiveCoverage / defaultValuePerAcre) * 100)}% of crop value)
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">
          Hail damage scenario: <span className="text-white font-bold">{damagePercent}% crop loss</span>
        </label>
        <input
          type="range"
          min={0} max={100} step={1}
          value={damagePercent}
          onChange={e => setDamagePercent(Number(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>0% — No damage</span>
          <span>25% — Light</span>
          <span>50% — Moderate</span>
          <span>75% — Severe</span>
          <span>100% — Total loss</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-700 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">Coverage</div>
          <div className="text-xl font-bold text-white">{fmtAc(effectiveCoverage)}</div>
          <div className="text-xs text-slate-500">{fmt(effectiveCoverage * acres)} total ({acres} ac)</div>
        </div>
        <div className="bg-slate-700 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">Premium (what you pay)</div>
          <div className="text-xl font-bold text-amber-400">{fmtAc(premiumPerAcre)}</div>
          <div className="text-xs text-slate-500">{fmt(totalPremium)} total</div>
        </div>
        <div className="rounded-lg p-3 bg-slate-700">
          <div className="text-xs text-slate-400 mb-1">Indemnity (what you collect)</div>
          <div className={`text-xl font-bold ${indemnityPerAcre > 0 ? 'text-green-400' : 'text-slate-400'}`}>
            {fmtAc(indemnityPerAcre)}
          </div>
          <div className="text-xs text-slate-500">{fmt(totalIndemnity)} total</div>
        </div>
        <div className={`rounded-lg p-3 ${netPerAcre >= 0 ? 'bg-green-900/30' : 'bg-red-900/20'}`}>
          <div className="text-xs text-slate-400 mb-1">Net (indemnity − premium)</div>
          <div className={`text-xl font-bold ${netPerAcre >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {netPerAcre >= 0 ? '+' : ''}{fmtAc(netPerAcre)}
          </div>
          <div className="text-xs text-slate-500">{netPerAcre >= 0 ? '+' : ''}{fmt(totalNet)} total</div>
        </div>
      </div>

      <div className={`rounded-lg p-3 border ${damagePercent >= breakevenPct ? 'border-green-500/40 bg-green-900/20' : 'border-slate-600 bg-slate-700/50'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-white">Breakeven damage: {breakevenPct.toFixed(1)}%</div>
            <div className="text-xs text-slate-400 mt-0.5">
              {damagePercent < breakevenPct
                ? `You need ${(breakevenPct - damagePercent).toFixed(1)}% more damage to break even`
                : `You're ${(damagePercent - breakevenPct).toFixed(1)}% above breakeven — collecting more than you paid`}
            </div>
          </div>
          <div className="text-2xl">{damagePercent >= breakevenPct ? '✅' : '⏳'}</div>
        </div>
      </div>

      <div>
        <div className="text-xs text-slate-400 mb-1">Damage vs breakeven</div>
        <div className="relative h-6 bg-slate-700 rounded overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-red-500/60 transition-all"
            style={{ width: `${damagePercent}%` }}
          />
          <div
            className="absolute top-0 h-full w-0.5 bg-white"
            style={{ left: `${breakevenPct}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
            {damagePercent}% damage · breakeven at {breakevenPct.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="text-xs text-slate-500 border-t border-slate-700 pt-3">
        Rates: Pro Ag 2026 rate file · {county} · Contact Root Risk Management (507-429-0165) for final quote and policy details.
      </div>
    </div>
  );
}
