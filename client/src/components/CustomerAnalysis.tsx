import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { getCountyYields, CORN_PRICES, SOYBEAN_PRICES } from '../lib/historicalData';
import { calcGrossPremiumPerAcre, type InsuranceInputs } from '../lib/insurance';
import { SUBSIDY_BU_OU } from '../lib/subsidySchedule';

type County = 'Trempealeau WI' | 'Buffalo WI' | 'Jackson WI' | 'Houston MN' | 'Winona MN';
type Crop = 'corn' | 'soybeans';

const COUNTIES: County[] = ['Trempealeau WI', 'Buffalo WI', 'Jackson WI', 'Houston MN', 'Winona MN'];
const COVERAGE_LEVELS = [0.70, 0.75, 0.80, 0.85];
const YEARS = Array.from({ length: 25 }, (_, i) => 2000 + i);

function olympicAvg(vals: number[]): number {
  const v = [...vals].sort((a, b) => a - b);
  if (v.length < 3) return v.reduce((a, b) => a + b, 0) / (v.length || 1);
  const t = v.slice(1, -1);
  return t.reduce((a, b) => a + b, 0) / t.length;
}
function simpleAvg(vals: number[]): number {
  return vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
}

function getPremPerAcre(aph: number, cov: number, county: County, crop: Crop, projPrice: number): number {
  const inputs: InsuranceInputs = {
    crop, county, aphYield: aph, acres: 100, share: 1.0,
    unitStructure: 'Basic', coverageLevel: cov, planType: 'RP',
    springPrice: projPrice, scoEnabled: true, ecoLevel: 'ECO-95',
    isBFR: false, yearsInFarming: 10, irrigated: false,
  };
  const gross = calcGrossPremiumPerAcre(inputs);
  const subsidy = SUBSIDY_BU_OU[cov] ?? 0.48;
  return gross * (1 - subsidy);
}

interface YearRow { year: number; farmYield: string; }

const LS_KEY = 'customerAnalysis_v1';

interface Props {
  actualPremiums?: Record<number, number | null>;
}

export default function CustomerAnalysis({ actualPremiums = {} }: Props) {
  // Load persisted state from localStorage
  const saved = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
  }, []);

  const [customerName, setCustomerName] = useState<string>(saved.customerName ?? '');
  const [farmName, setFarmName] = useState<string>(saved.farmName ?? '');
  const [crop, setCrop] = useState<Crop>(saved.crop ?? 'corn');
  const [county, setCounty] = useState<County>(saved.county ?? 'Trempealeau WI');
  const [selectedCov, setSelectedCov] = useState<number>(saved.selectedCov ?? 0.80);
  const [aphMethod, setAphMethod] = useState<'olympic' | 'simple'>(saved.aphMethod ?? 'olympic');
  const [rows, setRows] = useState<YearRow[]>(
    saved.rows ?? YEARS.map(y => ({ year: y, farmYield: '' }))
  );

  // Persist to localStorage on any change
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ customerName, farmName, crop, county, selectedCov, aphMethod, rows }));
  }, [customerName, farmName, crop, county, selectedCov, aphMethod, rows]);

  const countyData = useMemo(() => getCountyYields(county, crop), [county, crop]);
  const prices = crop === 'corn' ? CORN_PRICES : SOYBEAN_PRICES;

  const enteredRows = useMemo(() => rows.filter(r => r.farmYield !== '' && !isNaN(parseFloat(r.farmYield))), [rows]);
  const last10Yields = useMemo(() => enteredRows.slice(-10).map(r => parseFloat(r.farmYield)), [enteredRows]);
  const calcAPH = last10Yields.length > 0 ? (aphMethod === 'olympic' ? olympicAvg(last10Yields) : simpleAvg(last10Yields)) : 0;

  function calcYearPayments(aph: number, cov: number) {
    return rows.map(row => {
      const yi = countyData?.years.indexOf(row.year) ?? -1;
      if (yi < 0 || !countyData) return { year: row.year, rp: 0, sco: 0, eco: 0, premium: 0, triggered: false };
      const countyYield = countyData.yields[yi];
      const countyAPH = countyData.trendAPH[yi];
      const pi = prices.years.indexOf(row.year);
      const projPrice = pi >= 0 ? prices.projectedPrices[pi] : 0;
      const harvPrice = pi >= 0 ? (prices.harvestPrices[pi] || projPrice) : 0;
      const farmY = row.farmYield !== '' ? parseFloat(row.farmYield) : null;

      let rp = 0;
      if (farmY !== null && projPrice > 0 && aph > 0) {
        const guarantee = aph * cov * Math.max(projPrice, harvPrice);
        rp = Math.max(0, guarantee - farmY * harvPrice);
      }

      let sco = 0;
      if (cov < 0.86 && countyAPH > 0 && projPrice > 0) {
        const ratio = (countyYield * harvPrice) / (countyAPH * projPrice);
        if (ratio < 0.86) {
          const payFactor = (0.86 - Math.max(ratio, cov)) / (0.86 - cov);
          sco = Math.max(0, payFactor * aph * (0.86 - cov) * projPrice);
        }
      }

      let eco = 0;
      if (countyAPH > 0 && projPrice > 0) {
        const ratio = (countyYield * harvPrice) / (countyAPH * projPrice);
        if (ratio < 0.95) {
          const payFactor = (0.95 - Math.max(ratio, 0.86)) / (0.95 - 0.86);
          eco = Math.max(0, payFactor * aph * (0.95 - 0.86) * projPrice);
        }
      }

      const prem = projPrice > 0 && aph > 0 ? getPremPerAcre(aph, cov, county, crop, projPrice) : 0;
      return { year: row.year, rp: Math.round(rp*100)/100, sco: Math.round(sco*100)/100, eco: Math.round(eco*100)/100, premium: Math.round(prem*100)/100, triggered: rp > 0 || sco > 0 || eco > 0 };
    });
  }

  const yearData = useMemo(() => calcYearPayments(calcAPH, selectedCov), [calcAPH, selectedCov, rows, county, crop]);

  const covComparison = useMemo(() => COVERAGE_LEVELS.map(cov => {
    const ydata = calcYearPayments(calcAPH, cov);
    const withFarm = ydata.filter((_, i) => rows[i].farmYield !== '');
    const quotedPrem = actualPremiums[cov] ?? null;
    const annualPrem = quotedPrem !== null
      ? quotedPrem
      : (withFarm.length > 0 ? withFarm.reduce((s, r) => s + r.premium, 0) / withFarm.length : 0);
    const totalPrem = annualPrem * withFarm.length;
    const totalIndem = withFarm.reduce((s, r) => s + r.rp + r.sco + r.eco, 0);
    const netCost = totalPrem - totalIndem;
    const trigYears = withFarm.filter(r => r.triggered).length;
    const bestPayout = withFarm.length > 0 ? Math.max(...withFarm.map(r => r.rp + r.sco + r.eco)) : 0;
    return { cov, totalPrem, totalIndem, netCost, trigYears, yearsCount: withFarm.length, annualPrem, bestPayout, usingActual: quotedPrem !== null };
  }), [calcAPH, rows, county, crop, actualPremiums]);

  const bestCov = covComparison.reduce((b, c) => c.netCost < b.netCost ? c : b, covComparison[0]);

  const chartData = useMemo(() => yearData
    .filter((_, i) => rows[i].farmYield !== '')
    .map(r => ({
      year: r.year,
      'Premium Paid': -(r.premium),
      'Indemnity': r.rp + r.sco + r.eco,
    })), [yearData, rows]);

  function updateYield(idx: number, val: string) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, farmYield: val } : r));
  }

  return (
    <div className="space-y-6 p-4">
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <h2 className="text-xl font-bold text-white mb-1">👤 Customer Analysis</h2>
        <p className="text-gray-400 text-sm">Enter a customer's yield history to show which coverage level would have been the best buy for their operation. Data persists when switching tabs.</p>
      </div>

      {/* Customer Setup */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="font-semibold text-white mb-3">Customer Setup</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Customer Name</label>
            <input value={customerName} onChange={e => setCustomerName(e.target.value)}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600 focus:border-blue-400 outline-none" placeholder="e.g. Schmitt Family Inc" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Farm Name</label>
            <input value={farmName} onChange={e => setFarmName(e.target.value)}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600 focus:border-blue-400 outline-none" placeholder="e.g. Home Farm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">County</label>
            <select value={county} onChange={e => setCounty(e.target.value as County)}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600">
              {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Crop</label>
            <div className="flex gap-2">
              {(['corn','soybeans'] as Crop[]).map(c => (
                <button key={c} onClick={() => setCrop(c)}
                  className={`flex-1 py-2 rounded text-sm font-medium ${crop===c ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                  {c==='corn' ? '🌽 Corn' : '🫘 Soybeans'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">APH Method</label>
            <div className="flex gap-2">
              {(['olympic','simple'] as const).map(m => (
                <button key={m} onClick={() => setAphMethod(m)}
                  className={`flex-1 py-2 rounded text-xs ${aphMethod===m ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                  {m==='olympic' ? 'Olympic Avg' : 'Simple Avg'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Chart Coverage</label>
            <div className="flex gap-1">
              {COVERAGE_LEVELS.map(c => (
                <button key={c} onClick={() => setSelectedCov(c)}
                  className={`flex-1 py-2 rounded text-xs font-medium ${selectedCov===c ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                  {(c*100).toFixed(0)}%
                </button>
              ))}
            </div>
          </div>
        </div>
        {calcAPH > 0 && (
          <div className="mt-3 p-3 bg-green-900/30 border border-green-500/30 rounded flex items-center gap-3">
            <span className="text-green-400 font-bold text-lg">{calcAPH.toFixed(1)} bu/ac</span>
            <span className="text-gray-400 text-sm">Calculated APH · {aphMethod==='olympic' ? 'Olympic avg' : 'Simple avg'} of last {Math.min(last10Yields.length,10)} years entered</span>
          </div>
        )}
        {Object.values(actualPremiums).some(v => v !== null) && (
          <div className="mt-2 p-2 bg-blue-900/20 border border-blue-500/20 rounded text-xs text-blue-300">
            ✓ Using actual RMA quotes from Overview page for premium comparison
          </div>
        )}
      </div>

      {/* Yield History */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="font-semibold text-white mb-1">Yield History</h3>
        <p className="text-xs text-gray-400 mb-3">Enter farm yields — county data auto-fills. Green rows = payment would have triggered.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-700">
                <th className="py-2 text-left">Year</th>
                <th className="py-2 text-right">Farm Yield</th>
                <th className="py-2 text-right text-gray-600">County</th>
                <th className="py-2 text-right text-gray-600">Proj $</th>
                <th className="py-2 text-right text-gray-600">Harv $</th>
                <th className="py-2 text-right">RP Pay</th>
                <th className="py-2 text-right">SCO</th>
                <th className="py-2 text-right">ECO</th>
                <th className="py-2 text-right font-bold">Total Pay</th>
                <th className="py-2 text-right text-red-400">Premium</th>
                <th className="py-2 text-right font-bold">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const yi = countyData?.years.indexOf(row.year) ?? -1;
                const countyYield = yi >= 0 ? countyData?.yields[yi] : undefined;
                const pi = prices.years.indexOf(row.year);
                const projPrice = pi >= 0 ? prices.projectedPrices[pi] : undefined;
                const harvPrice = pi >= 0 ? (prices.harvestPrices[pi] || projPrice) : undefined;
                const yd = yearData[idx];
                const totalPay = yd.rp + yd.sco + yd.eco;
                const net = totalPay - yd.premium;
                const hasFarm = row.farmYield !== '';
                return (
                  <tr key={row.year} className={`border-b border-gray-700/40 ${hasFarm && yd.triggered ? 'bg-green-900/20' : ''}`}>
                    <td className="py-1 text-gray-400 font-mono">{row.year}</td>
                    <td className="py-1">
                      <input type="number" value={row.farmYield} onChange={e => updateYield(idx, e.target.value)} placeholder="—"
                        className="w-20 bg-gray-700 text-white rounded px-2 py-1 text-right text-xs border border-gray-600 focus:border-blue-400 outline-none" />
                    </td>
                    <td className="py-1 text-right text-gray-600 font-mono">{countyYield?.toFixed(1)??'—'}</td>
                    <td className="py-1 text-right text-gray-600 font-mono">{projPrice?`$${projPrice.toFixed(2)}`:'—'}</td>
                    <td className="py-1 text-right text-gray-600 font-mono">{harvPrice?`$${harvPrice.toFixed(2)}`:'—'}</td>
                    <td className={`py-1 text-right font-mono ${hasFarm&&yd.rp>0?'text-green-400 font-bold':'text-gray-600'}`}>{hasFarm?(yd.rp>0?`$${yd.rp.toFixed(2)}`:'—'):'—'}</td>
                    <td className={`py-1 text-right font-mono ${hasFarm&&yd.sco>0?'text-green-400':'text-gray-600'}`}>{hasFarm?(yd.sco>0?`$${yd.sco.toFixed(2)}`:'—'):'—'}</td>
                    <td className={`py-1 text-right font-mono ${hasFarm&&yd.eco>0?'text-green-400':'text-gray-600'}`}>{hasFarm?(yd.eco>0?`$${yd.eco.toFixed(2)}`:'—'):'—'}</td>
                    <td className={`py-1 text-right font-mono font-bold ${hasFarm&&totalPay>0?'text-green-400':'text-gray-600'}`}>{hasFarm?(totalPay>0?`$${totalPay.toFixed(2)}`:'—'):'—'}</td>
                    <td className={`py-1 text-right font-mono ${hasFarm?'text-red-400':'text-gray-600'}`}>{hasFarm?`$${yd.premium.toFixed(2)}`:'—'}</td>
                    <td className={`py-1 text-right font-mono font-bold ${!hasFarm?'text-gray-600':net>=0?'text-green-400':'text-red-400'}`}>{hasFarm?`${net>=0?'+':''}$${net.toFixed(2)}`:'—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Coverage Comparison */}
      {enteredRows.length >= 3 && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="font-semibold text-white mb-3">📊 Coverage Comparison — {enteredRows.length} years · {customerName || 'Customer'}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs border-b border-gray-700">
                  <th className="py-2 text-left text-gray-400">Metric</th>
                  {covComparison.map(c => (
                    <th key={c.cov} className={`py-2 text-right ${c.cov===bestCov.cov?'text-yellow-400':'text-gray-400'}`}>
                      <div>{(c.cov*100).toFixed(0)}% RP{c.cov===bestCov.cov?' ⭐':''}</div>
                      {c.usingActual
                        ? <div className="text-green-400 font-normal">actual quote</div>
                        : <div className="text-gray-600 font-normal">estimated</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/40">
                {[
                  { label: 'Annual Premium', fn: (c: typeof covComparison[0]) => `$${c.annualPrem.toFixed(2)}/ac` },
                  { label: 'Years with Payment', fn: (c: typeof covComparison[0]) => `${c.trigYears} / ${c.yearsCount}` },
                  { label: 'Total Premiums Paid', fn: (c: typeof covComparison[0]) => `$${c.totalPrem.toFixed(0)}/ac` },
                  { label: "Total Indemnity Recv'd", fn: (c: typeof covComparison[0]) => `$${c.totalIndem.toFixed(0)}/ac` },
                  { label: 'Best Single-Year Payout', fn: (c: typeof covComparison[0]) => `$${c.bestPayout.toFixed(2)}/ac` },
                  { label: 'NET COST', fn: (c: typeof covComparison[0]) => `$${c.netCost.toFixed(0)}/ac`, bold: true },
                  { label: 'Avg Net Cost/Year', fn: (c: typeof covComparison[0]) => `$${c.yearsCount>0?(c.netCost/c.yearsCount).toFixed(2):0}/ac`, bold: true },
                ].map(row => (
                  <tr key={row.label} className={row.bold ? 'bg-gray-700/30' : ''}>
                    <td className={`py-2 ${row.bold?'font-bold text-white':'text-gray-400'}`}>{row.label}</td>
                    {covComparison.map(c => (
                      <td key={c.cov} className={`py-2 text-right font-mono ${row.bold&&c.cov===bestCov.cov?'text-yellow-400 font-bold text-base':row.bold?'text-white font-semibold':'text-gray-300'}`}>
                        {row.fn(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded">
            <span className="text-yellow-400 font-semibold">⭐ Best historical value: {(bestCov.cov*100).toFixed(0)}% RP</span>
            <span className="text-gray-400 text-sm ml-2">— Net cost ${bestCov.netCost.toFixed(0)}/ac over {bestCov.yearsCount} years (${bestCov.yearsCount>0?(bestCov.netCost/bestCov.yearsCount).toFixed(2):0}/ac/yr avg)</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">* Premiums {Object.values(actualPremiums).some(v=>v!==null)?'use actual RMA quotes where entered, estimates otherwise':'are tool estimates — enter actual quotes on Overview page for accuracy'}. Past history does not guarantee future results.</p>
        </div>
      )}

      {/* Chart */}
      {chartData.length >= 3 && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="font-semibold text-white mb-3">Year by Year — {(selectedCov*100).toFixed(0)}% RP</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{top:10,right:20,left:10,bottom:5}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{fill:'#9CA3AF',fontSize:11}} />
              <YAxis tick={{fill:'#9CA3AF',fontSize:11}} />
              <Tooltip contentStyle={{background:'#1F2937',border:'1px solid #374151',borderRadius:6}} labelStyle={{color:'#F9FAFB'}} formatter={(v:number)=>[`$${Math.abs(v).toFixed(2)}/ac`]} />
              <Legend />
              <ReferenceLine y={0} stroke="#6B7280" />
              <Bar dataKey="Premium Paid" fill="#EF4444" />
              <Bar dataKey="Indemnity" fill="#22C55E" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {enteredRows.length >= 3 && (
        <div className="flex justify-end">
          <button onClick={()=>window.print()} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium">
            📄 Print Customer Report
          </button>
        </div>
      )}
    </div>
  );
}
