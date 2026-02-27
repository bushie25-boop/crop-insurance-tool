import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { getHailRates } from '../lib/historicalData';

// ─── Policy Math ─────────────────────────────────────────────────────────────
function calcPayablePct(damagePct: number, policyForm: string): number {
  const d = damagePct;
  if (policyForm === 'Basic') {
    let payable = d;
    if (d > 70) payable += (d - 70) * 0.5;
    return Math.min(100, payable);
  }
  if (policyForm === 'DXS5') {
    if (d <= 5) return 0;
    let payable = d < 25 ? (d - 5) * 1.25 : d;
    if (d > 70) payable += (d - 70) * 0.5;
    return Math.min(100, payable);
  }
  if (policyForm === 'Comp 2') {
    if (d <= 5) return 0;
    return Math.min(100, (d - 5) * 2.0);
  }
  if (policyForm === 'Comp 2+') {
    const basic = Math.min(100, d + (d > 70 ? (d - 70) * 0.5 : 0));
    const comp2 = d <= 5 ? 0 : Math.min(100, (d - 5) * 2.0);
    return Math.max(basic, comp2);
  }
  if (policyForm === 'Comp 3') {
    if (d <= 5) return 0;
    return Math.min(100, (d - 5) * 3.0);
  }
  if (policyForm === 'Comp 4') {
    if (d <= 5) return 0;
    return Math.min(100, (d - 5) * 4.0);
  }
  return Math.min(100, d);
}

function findBreakeven(policyForm: string, premiumPerAcre: number, coveragePerAcre: number): number {
  if (coveragePerAcre <= 0) return 0;
  for (let d = 0; d <= 100; d += 0.1) {
    const indemnity = (calcPayablePct(d, policyForm) / 100) * coveragePerAcre;
    if (indemnity >= premiumPerAcre) return Math.round(d * 10) / 10;
  }
  return 100;
}

const POLICY_FORMS = ['Basic', 'DXS5', 'Comp 2', 'Comp 2+', 'Comp 3', 'Comp 4'];
const POLICY_COLORS: Record<string, string> = {
  'Basic':   '#60a5fa',
  'DXS5':    '#a78bfa',
  'Comp 2':  '#34d399',
  'Comp 2+': '#fbbf24',
  'Comp 3':  '#f87171',
  'Comp 4':  '#fb923c',
};

const fmt$ = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmt$c = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

type InputMode = 'coverage' | 'cost';

interface Props {
  county: string;
  crop: 'corn' | 'soybeans';
  aphYield: number;
  springPrice: number;
  acres: number;
}

export default function HailQuoter({ county, crop, aphYield, springPrice, acres }: Props) {
  const rates = getHailRates(county);
  const maxCoverage = crop === 'corn' ? 900 : 700;
  const defaultCoverage = Math.min(Math.round(aphYield * springPrice), maxCoverage);

  const [inputMode, setInputMode] = useState<InputMode>('coverage');
  const [selectedPolicy, setSelectedPolicy] = useState('Comp 3');
  const [coveragePerAcre, setCoveragePerAcre] = useState(defaultCoverage);
  const [costPerAcre, setCostPerAcre] = useState(10);
  const [damagePercent, setDamagePercent] = useState(30);

  const rateMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rates) {
      m[r.policyForm] = crop === 'corn' ? r.cornRate : r.beanRate;
    }
    return m;
  }, [rates, crop]);

  const selectedRate = rateMap[selectedPolicy] ?? 1.10;

  const effectiveCoverage = useMemo(() => {
    if (inputMode === 'coverage') return coveragePerAcre;
    return selectedRate > 0 ? (costPerAcre / selectedRate) * 100 : 0;
  }, [inputMode, coveragePerAcre, costPerAcre, selectedRate]);

  const premiumPerAcre = (selectedRate / 100) * effectiveCoverage;
  const payablePct = calcPayablePct(damagePercent, selectedPolicy);
  const indemnityPerAcre = (payablePct / 100) * effectiveCoverage;
  const netPerAcre = indemnityPerAcre - premiumPerAcre;
  const breakeven = findBreakeven(selectedPolicy, premiumPerAcre, effectiveCoverage);

  const chartData = useMemo(() => {
    const data = [];
    for (let d = 0; d <= 100; d += 5) {
      const point: Record<string, number> = { damage: d };
      for (const pf of POLICY_FORMS) point[pf] = calcPayablePct(d, pf);
      data.push(point);
    }
    return data;
  }, []);

  const compRows = useMemo(() => POLICY_FORMS.map(pf => {
    const r = rateMap[pf] ?? 0;
    const prem = (r / 100) * effectiveCoverage;
    const pp = calcPayablePct(damagePercent, pf);
    const indem = (pp / 100) * effectiveCoverage;
    const net = indem - prem;
    const maxed = pp >= 100;
    return { pf, payable: pp, indemnity: indem, net, maxed };
  }), [rateMap, effectiveCoverage, damagePercent]);

  return (
    <div className="space-y-6 p-4 text-white">
      <div>
        <div className="text-xl font-bold">🌩️ Hail Insurance Quoter</div>
        <div className="text-sm text-slate-400">Pro Ag 2026 · {county} · {crop === 'corn' ? '🌽 Corn' : '🫘 Soybeans'}</div>
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">Policy Form</label>
        <div className="flex flex-wrap gap-2">
          {POLICY_FORMS.map(pf => (
            <button
              key={pf}
              onClick={() => setSelectedPolicy(pf)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                selectedPolicy === pf
                  ? 'text-slate-900 border-transparent'
                  : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-400'
              }`}
              style={selectedPolicy === pf ? { backgroundColor: POLICY_COLORS[pf] } : {}}
            >
              {pf}
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-500 mt-1">
          {rates.find(r => r.policyForm === selectedPolicy)?.description ?? ''}
          {' '}· Rate: {selectedRate.toFixed(2)}% of coverage
        </div>
      </div>

      <div>
        <div className="flex gap-2 mb-3">
          {(['coverage', 'cost'] as InputMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setInputMode(mode)}
              className={`px-3 py-1 rounded text-sm ${inputMode === mode ? 'bg-blue-600' : 'bg-slate-700 text-slate-300'}`}
            >
              {mode === 'coverage' ? 'Coverage $/ac' : 'Cost $/ac'}
            </button>
          ))}
        </div>

        {inputMode === 'coverage' ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <input
                type="range" min={50} max={maxCoverage} step={10}
                value={coveragePerAcre}
                onChange={e => setCoveragePerAcre(Number(e.target.value))}
                className="flex-1 accent-blue-500"
              />
              <input
                type="number" min={50} max={maxCoverage}
                value={coveragePerAcre}
                onChange={e => setCoveragePerAcre(Math.min(maxCoverage, Math.max(50, Number(e.target.value))))}
                className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-center"
              />
              <span className="text-slate-400 text-sm">/ac</span>
            </div>
            <div className="text-xs text-slate-500">Max: {fmt$(maxCoverage)}/ac ({crop === 'corn' ? 'Corn' : 'Soybeans'} IPA limit)</div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <input
                type="range" min={1} max={30} step={0.5}
                value={costPerAcre}
                onChange={e => setCostPerAcre(Number(e.target.value))}
                className="flex-1 accent-blue-500"
              />
              <span className="text-sm font-medium w-20 text-right">{fmt$c(costPerAcre)}/ac</span>
            </div>
            <div className="text-xs text-slate-500">
              Implied coverage: {fmt$(Math.round(effectiveCoverage))}/ac
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wide">
          Crop Damage — {damagePercent}%
        </label>
        <input
          type="range" min={0} max={100} step={1}
          value={damagePercent}
          onChange={e => setDamagePercent(Number(e.target.value))}
          className="w-full accent-orange-400"
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          {[0, 25, 50, 75, 100].map(v => <span key={v}>{v}%</span>)}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <SummaryCard label="Coverage" primary={`${fmt$(effectiveCoverage)}/ac`} secondary={`${fmt$(effectiveCoverage * acres)} total`} />
        <SummaryCard label="Premium" primary={`${fmt$c(premiumPerAcre)}/ac`} secondary={`${fmt$(premiumPerAcre * acres)} total`} />
        <SummaryCard label="Payable %" primary={`${payablePct.toFixed(1)}%`} secondary="of coverage" />
        <SummaryCard
          label="Indemnity"
          primary={`${fmt$c(indemnityPerAcre)}/ac`}
          secondary={`${fmt$(indemnityPerAcre * acres)} total`}
          highlight={indemnityPerAcre > 0 ? 'green' : undefined}
        />
        <SummaryCard
          label="Net"
          primary={`${netPerAcre >= 0 ? '+' : ''}${fmt$c(netPerAcre)}/ac`}
          secondary={`${netPerAcre >= 0 ? '+' : ''}${fmt$(netPerAcre * acres)} total`}
          highlight={netPerAcre >= 0 ? 'green' : 'red'}
        />
      </div>

      <div className={`rounded-lg p-3 border flex items-center gap-3 ${
        damagePercent >= breakeven ? 'bg-green-900/30 border-green-700' : 'bg-red-900/30 border-red-700'
      }`}>
        <span className="text-2xl">{damagePercent >= breakeven ? '✅' : '⚠️'}</span>
        <div>
          <div className="font-semibold text-sm">Breakeven at {breakeven}% damage</div>
          <div className="text-xs text-slate-400">
            {damagePercent >= breakeven
              ? `${(damagePercent - breakeven).toFixed(1)}% above breakeven — policy is paying off`
              : `${(breakeven - damagePercent).toFixed(1)}% below breakeven`}
          </div>
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold text-slate-300 mb-2">📈 Payout % vs Damage % — All Policies</div>
        <div className="bg-slate-800 rounded-lg p-3">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="damage" stroke="#94a3b8" tickFormatter={(v: number) => `${v}%`} />
              <YAxis stroke="#94a3b8" tickFormatter={(v: number) => `${v}%`} domain={[0, 100]} />
              <Tooltip
                formatter={(val: number, name: string) => [`${val.toFixed(1)}%`, name]}
                labelFormatter={(v: number) => `${v}% damage`}
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
              />
              <Legend />
              {POLICY_FORMS.map(pf => (
                <Line
                  key={pf}
                  type="monotone"
                  dataKey={pf}
                  stroke={POLICY_COLORS[pf]}
                  strokeWidth={selectedPolicy === pf ? 3 : 1.5}
                  dot={false}
                  strokeDasharray={selectedPolicy === pf ? undefined : '4 2'}
                />
              ))}
              <ReferenceLine x={damagePercent} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: `${damagePercent}%`, fill: '#f59e0b', fontSize: 11 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold text-slate-300 mb-2">📊 All Policies at {damagePercent}% Damage</div>
        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 uppercase border-b border-slate-700">
                <th className="px-3 py-2 text-left">Policy</th>
                <th className="px-3 py-2 text-right">Payable%</th>
                <th className="px-3 py-2 text-right">Indemnity/ac</th>
                <th className="px-3 py-2 text-right">Net/ac</th>
              </tr>
            </thead>
            <tbody>
              {compRows.map(({ pf, payable, indemnity, net, maxed }) => (
                <tr
                  key={pf}
                  className={`border-b border-slate-700/50 ${selectedPolicy === pf ? 'bg-slate-700' : ''}`}
                >
                  <td className="px-3 py-2 font-medium">
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-2"
                      style={{ backgroundColor: POLICY_COLORS[pf] }}
                    />
                    {pf}
                    {selectedPolicy === pf && <span className="ml-1 text-xs text-slate-400">◀</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {payable.toFixed(1)}%{maxed ? '*' : ''}
                  </td>
                  <td className="px-3 py-2 text-right">{fmt$c(indemnity)}</td>
                  <td className={`px-3 py-2 text-right font-medium ${net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {net >= 0 ? '+' : ''}{fmt$c(net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {compRows.some(r => r.maxed) && (
            <div className="px-3 py-1.5 text-xs text-slate-500">* maxed at 100% coverage</div>
          )}
        </div>
      </div>

      <div className="bg-slate-800/60 rounded-lg p-4 space-y-1.5 text-sm">
        <div className="text-slate-300 font-semibold mb-2">📋 Important Notes</div>
        <div className="text-slate-400">• <strong className="text-slate-200">Comp 3</strong> pays 100% of coverage at just <strong className="text-yellow-400">38.3% crop damage</strong></div>
        <div className="text-slate-400">• Basic pays from first dollar; Comp plans have a <strong className="text-slate-200">5% minimum loss</strong></div>
        <div className="text-slate-400">• Coverage max: <strong className="text-slate-200">Corn $900/ac · Soybeans $700/ac</strong> (IPA limits)</div>
        <div className="text-slate-400">• <strong className="text-green-400">3% cash discount</strong> if premium paid by Aug 15</div>
        <div className="text-slate-400">• Minimum policy premium: <strong className="text-slate-200">$50</strong></div>
      </div>

      <div className="text-xs text-slate-500 border-t border-slate-700 pt-3">
        Source: Pro Ag 2026 WI Crop Hail Manual · Contact{' '}
        <span className="text-blue-400">Root Risk Management (507-429-0165)</span> for official quote
      </div>
    </div>
  );
}

function SummaryCard({
  label, primary, secondary, highlight,
}: {
  label: string;
  primary: string;
  secondary: string;
  highlight?: 'green' | 'red';
}) {
  return (
    <div className="bg-slate-800 rounded-lg p-3">
      <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-lg font-bold ${highlight === 'green' ? 'text-green-400' : highlight === 'red' ? 'text-red-400' : 'text-white'}`}>
        {primary}
      </div>
      <div className="text-xs text-slate-500">{secondary}</div>
    </div>
  );
}
