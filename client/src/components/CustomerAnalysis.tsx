import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { getCountyYields, CORN_PRICES, SOYBEAN_PRICES } from '../lib/historicalData';
import { calcGrossPremiumPerAcre } from '../lib/insurance';
import { SUBSIDY_BU_OU } from '../lib/subsidySchedule';

type County = 'Trempealeau WI' | 'Buffalo WI' | 'Jackson WI' | 'Houston MN' | 'Winona MN';
type Crop = 'corn' | 'soybeans';

const COUNTIES: County[] = ['Trempealeau WI', 'Buffalo WI', 'Jackson WI', 'Houston MN', 'Winona MN'];
const COVERAGE_LEVELS = [0.70, 0.75, 0.80, 0.85];
const YEARS = Array.from({ length: 25 }, (_, i) => 2000 + i); // 2000-2024

function olympicAvg(yields: number[]): number {
  const valid = yields.filter(y => y > 0).sort((a, b) => a - b);
  if (valid.length < 3) return valid.reduce((a, b) => a + b, 0) / (valid.length || 1);
  const trimmed = valid.slice(1, -1);
  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

function simpleAvg(yields: number[]): number {
  const valid = yields.filter(y => y > 0);
  return valid.reduce((a, b) => a + b, 0) / (valid.length || 1);
}

function calcNetFarmerPremium(gross: number, covPct: number): number {
  const subsidy = SUBSIDY_BU_OU[covPct] ?? 0.48;
  return gross * (1 - subsidy);
}

interface YearRow {
  year: number;
  farmYield: string; // string so we can have blank inputs
}

interface Props {
  actualPremiums?: Record<number, number | null>;
}

export default function CustomerAnalysis({ actualPremiums = {} }: Props) {
  const [customerName, setCustomerName] = useState('');
  const [farmName, setFarmName] = useState('');
  const [crop, setCrop] = useState<Crop>('corn');
  const [county, setCounty] = useState<County>('Trempealeau WI');
  const [selectedCov, setSelectedCov] = useState(0.80);
  const [aphMethod, setAphMethod] = useState<'olympic' | 'simple'>('olympic');
  const [rows, setRows] = useState<YearRow[]>(YEARS.map(y => ({ year: y, farmYield: '' })));
  const [calibCov, setCalibCov] = useState(0.80);
  const [calibActual, setCalibActual] = useState('');
  const [calibFactor, setCalibFactor] = useState(1.0);
  const [calibApplied, setCalibApplied] = useState(false);

  const countyData = useMemo(() => getCountyYields(county, crop), [county, crop]);
  const prices = crop === 'corn' ? CORN_PRICES : SOYBEAN_PRICES;

  const enteredYields = useMemo(() =>
    rows.filter(r => r.farmYield !== '' && !isNaN(parseFloat(r.farmYield)))
        .map(r => parseFloat(r.farmYield)),
    [rows]
  );

  const last10 = useMemo(() => {
    const withData = rows.filter(r => r.farmYield !== '' && !isNaN(parseFloat(r.farmYield)));
    return withData.slice(-10).map(r => parseFloat(r.farmYield));
  }, [rows]);

  const calcAPH = aphMethod === 'olympic' ? olympicAvg(last10) : simpleAvg(last10);

  // For each year, calc indemnity at a given coverage level
  function calcYearPayments(aph: number, covPct: number) {
    return rows.map(row => {
      const yi = countyData?.years.indexOf(row.year) ?? -1;
      if (yi < 0 || !countyData) return { year: row.year, rp: 0, sco: 0, eco: 0, premium: 0, triggered: false };

      const countyYield = countyData.yields[yi];
      const countyAPH = countyData.trendAPH[yi];
      const pi = prices.years.indexOf(row.year);
      const projPrice = pi >= 0 ? prices.projectedPrices[pi] : 0;
      const harvPrice = pi >= 0 ? (prices.harvestPrices[pi] || projPrice) : 0;

      const farmY = row.farmYield !== '' ? parseFloat(row.farmYield) : null;

      // RP indemnity (farm-level)
      let rp = 0;
      if (farmY !== null && projPrice > 0) {
        const guarantee = aph * covPct * Math.max(projPrice, harvPrice);
        const actual = farmY * harvPrice;
        rp = Math.max(0, guarantee - actual);
      }

      // SCO (county-level trigger)
      const scoTop = 0.86;
      let sco = 0;
      if (covPct < scoTop && countyAPH > 0 && projPrice > 0) {
        const scoGuarantee = countyAPH * scoTop * projPrice;
        const scoActual = countyYield * harvPrice;
        const ratio = scoActual / (countyAPH * projPrice);
        if (ratio < scoTop) {
          const payFactor = (scoTop - Math.max(ratio, covPct)) / (scoTop - covPct);
          const scoLiability = aph * (scoTop - covPct) * projPrice;
          sco = Math.max(0, payFactor * scoLiability);
        }
      }

      // ECO (county-level trigger, 86-95%)
      let eco = 0;
      if (countyAPH > 0 && projPrice > 0) {
        const ecoTop = 0.95;
        const ecoBot = 0.86;
        const ratio = (countyYield * harvPrice) / (countyAPH * projPrice);
        if (ratio < ecoTop) {
          const payFactor = (ecoTop - Math.max(ratio, ecoBot)) / (ecoTop - ecoBot);
          const ecoLiability = aph * (ecoTop - ecoBot) * projPrice;
          eco = Math.max(0, payFactor * ecoLiability);
        }
      }

      // Gross premium estimate
      const grossPrem = calcGrossPremiumPerAcre(aph, covPct, county, crop, projPrice, false, 'RP');
      const netPrem = calcNetFarmerPremium(grossPrem, covPct);

      return {
        year: row.year,
        rp: Math.round(rp * 100) / 100,
        sco: Math.round(sco * 100) / 100,
        eco: Math.round(eco * 100) / 100,
        premium: Math.round(netPrem * 100) / 100,
        triggered: rp > 0 || sco > 0 || eco > 0,
      };
    });
  }

  const yearData = useMemo(() => calcYearPayments(calcAPH, selectedCov), [calcAPH, selectedCov, rows, county, crop, prices]);

  // Coverage comparison
  const covComparison = useMemo(() => {
    return COVERAGE_LEVELS.map(cov => {
      const ydata = calcYearPayments(calcAPH, cov);
      const withFarm = ydata.filter((_, i) => rows[i].farmYield !== '');
      // Use actual quoted premium if available, otherwise use tool estimate × calibFactor
      const quotedPrem = actualPremiums[cov] ?? null;
      const annualPrem = quotedPrem !== null
        ? quotedPrem
        : (withFarm.length > 0 ? withFarm.reduce((s, r) => s + r.premium, 0) / withFarm.length * calibFactor : 0);
      const totalPrem = annualPrem * withFarm.length;
      const totalIndem = withFarm.reduce((s, r) => s + r.rp + r.sco + r.eco, 0);
      const netCost = totalPrem - totalIndem;
      const trigYears = withFarm.filter(r => r.triggered).length;
      const yearsCount = withFarm.length;
      const bestPayout = withFarm.length > 0 ? Math.max(...withFarm.map(r => r.rp + r.sco + r.eco)) : 0;
      const usingActual = quotedPrem !== null;
      return { cov, totalPrem, totalIndem, netCost, trigYears, yearsCount, annualPrem, bestPayout, usingActual };
    });
  }, [calcAPH, rows, county, crop, calibFactor, actualPremiums]);

  const bestCov = covComparison.reduce((best, c) => c.netCost < best.netCost ? c : best, covComparison[0]);

  function applyCalibration() {
    const actual = parseFloat(calibActual);
    if (!actual || actual <= 0) return;
    const aph = calcAPH || 150;
    const pi = prices.years.indexOf(2026);
    const projPrice = pi >= 0 ? prices.projectedPrices[pi] : 4.62;
    const toolEst = calcNetFarmerPremium(calcGrossPremiumPerAcre(aph, calibCov, county, crop, projPrice, false, 'RP'), calibCov);
    if (toolEst > 0) {
      setCalibFactor(actual / toolEst);
      setCalibApplied(true);
    }
  }

  const chartData = useMemo(() => {
    return yearData
      .filter((_, i) => rows[i].farmYield !== '')
      .map(r => ({
        year: r.year,
        Premium: -(r.premium * calibFactor),
        Indemnity: r.rp + r.sco + r.eco,
        Net: (r.rp + r.sco + r.eco) - (r.premium * calibFactor),
      }));
  }, [yearData, calibFactor, rows]);

  function updateYield(idx: number, val: string) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, farmYield: val } : r));
  }

  return (
    <div className="space-y-6 p-4">
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <h2 className="text-xl font-bold text-white mb-1">👤 Customer Analysis</h2>
        <p className="text-gray-400 text-sm">Enter a customer's yield history to show which coverage level would have been the best buy for their operation.</p>
      </div>

      {/* Section 1 — Customer Setup */}
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
              {(['corn', 'soybeans'] as Crop[]).map(c => (
                <button key={c} onClick={() => setCrop(c)}
                  className={`flex-1 py-2 rounded text-sm font-medium capitalize ${crop === c ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                  {c === 'corn' ? '🌽 Corn' : '🫘 Soybeans'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">APH Method</label>
            <div className="flex gap-2">
              <button onClick={() => setAphMethod('olympic')}
                className={`flex-1 py-2 rounded text-xs ${aphMethod === 'olympic' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                Olympic Avg
              </button>
              <button onClick={() => setAphMethod('simple')}
                className={`flex-1 py-2 rounded text-xs ${aphMethod === 'simple' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                Simple Avg
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Coverage Level</label>
            <div className="flex gap-1">
              {COVERAGE_LEVELS.map(c => (
                <button key={c} onClick={() => setSelectedCov(c)}
                  className={`flex-1 py-2 rounded text-xs font-medium ${selectedCov === c ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                  {(c * 100).toFixed(0)}%
                </button>
              ))}
            </div>
          </div>
        </div>
        {calcAPH > 0 && (
          <div className="mt-3 p-3 bg-green-900/30 border border-green-500/30 rounded">
            <span className="text-green-400 font-semibold">Calculated APH: {calcAPH.toFixed(1)} bu/ac</span>
            <span className="text-gray-400 text-sm ml-3">({aphMethod === 'olympic' ? 'Olympic avg' : 'Simple avg'} of last {Math.min(last10.length, 10)} years with data)</span>
          </div>
        )}
      </div>

      {/* Section 2 — Yield History */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="font-semibold text-white mb-3">Yield History</h3>
        <p className="text-xs text-gray-400 mb-3">Enter the customer's actual farm yields. County data auto-fills from RMA verified sources.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-700">
                <th className="py-2 text-left">Year</th>
                <th className="py-2 text-right">Farm Yield</th>
                <th className="py-2 text-right text-gray-500">County Yield</th>
                <th className="py-2 text-right text-gray-500">Proj Price</th>
                <th className="py-2 text-right text-gray-500">Harv Price</th>
                <th className="py-2 text-right">RP Pay</th>
                <th className="py-2 text-right">SCO Pay</th>
                <th className="py-2 text-right">ECO Pay</th>
                <th className="py-2 text-right">Total Pay</th>
                <th className="py-2 text-right">Premium</th>
                <th className="py-2 text-center">Net</th>
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
                const net = totalPay - (yd.premium * calibFactor);
                const hasFarm = row.farmYield !== '';
                const triggered = hasFarm && yd.triggered;
                return (
                  <tr key={row.year} className={`border-b border-gray-700/50 ${triggered ? 'bg-green-900/20' : ''}`}>
                    <td className="py-1 text-gray-300 font-mono">{row.year}</td>
                    <td className="py-1">
                      <input
                        type="number"
                        value={row.farmYield}
                        onChange={e => updateYield(idx, e.target.value)}
                        placeholder="—"
                        className="w-20 bg-gray-700 text-white rounded px-2 py-1 text-right text-sm border border-gray-600 focus:border-blue-400 outline-none"
                      />
                    </td>
                    <td className="py-1 text-right text-gray-500 font-mono">{countyYield?.toFixed(1) ?? '—'}</td>
                    <td className="py-1 text-right text-gray-500 font-mono">{projPrice ? `$${projPrice.toFixed(2)}` : '—'}</td>
                    <td className="py-1 text-right text-gray-500 font-mono">{harvPrice ? `$${harvPrice.toFixed(2)}` : '—'}</td>
                    <td className={`py-1 text-right font-mono ${hasFarm && yd.rp > 0 ? 'text-green-400 font-bold' : 'text-gray-500'}`}>
                      {hasFarm ? (yd.rp > 0 ? `$${yd.rp.toFixed(2)}` : '—') : '—'}
                    </td>
                    <td className={`py-1 text-right font-mono ${hasFarm && yd.sco > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                      {hasFarm ? (yd.sco > 0 ? `$${yd.sco.toFixed(2)}` : '—') : '—'}
                    </td>
                    <td className={`py-1 text-right font-mono ${hasFarm && yd.eco > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                      {hasFarm ? (yd.eco > 0 ? `$${yd.eco.toFixed(2)}` : '—') : '—'}
                    </td>
                    <td className={`py-1 text-right font-mono font-bold ${triggered ? 'text-green-400' : 'text-gray-500'}`}>
                      {hasFarm ? (totalPay > 0 ? `$${totalPay.toFixed(2)}` : '—') : '—'}
                    </td>
                    <td className="py-1 text-right font-mono text-red-400">
                      {hasFarm ? `$${(yd.premium * calibFactor).toFixed(2)}` : '—'}
                    </td>
                    <td className={`py-1 text-right font-mono font-bold ${!hasFarm ? 'text-gray-500' : net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {hasFarm ? `${net >= 0 ? '+' : ''}$${net.toFixed(2)}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3 — Calibration */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="font-semibold text-white mb-3">📋 Premium Calibration</h3>
        <p className="text-xs text-gray-400 mb-3">Enter one actual RMA premium to calibrate all coverage levels proportionally.</p>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Coverage of your quote</label>
            <div className="flex gap-1">
              {COVERAGE_LEVELS.map(c => (
                <button key={c} onClick={() => setCalibCov(c)}
                  className={`px-3 py-2 rounded text-xs font-medium ${calibCov === c ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                  {(c * 100).toFixed(0)}%
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Actual producer premium ($/ac)</label>
            <input type="number" value={calibActual} onChange={e => setCalibActual(e.target.value)}
              placeholder="e.g. 21.35"
              className="w-32 bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600 focus:border-blue-400 outline-none" />
          </div>
          <button onClick={applyCalibration}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium">
            Apply Calibration
          </button>
          {calibApplied && (
            <div className="text-green-400 text-sm">
              ✓ Calibration factor: {calibFactor.toFixed(3)}× (tool was {((calibFactor - 1) * 100).toFixed(1)}% {calibFactor > 1 ? 'low' : 'high'})
            </div>
          )}
        </div>
      </div>

      {/* Section 4 — Coverage Comparison */}
      {enteredYields.length >= 3 && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="font-semibold text-white mb-3">📊 Coverage Level Comparison — {enteredYields.length} years of data</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-700">
                  <th className="py-2 text-left">Metric</th>
                  {covComparison.map(c => (
                    <th key={c.cov} className={`py-2 text-right ${c.cov === bestCov.cov ? 'text-yellow-400' : ''}`}>
                      {(c.cov * 100).toFixed(0)}% RP
                      {c.cov === bestCov.cov && ' ⭐'}
                      {c.usingActual && <div className="text-xs text-green-400 font-normal">actual quote</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {[
                  { label: 'Est. Annual Premium', fn: (c: typeof covComparison[0]) => `$${c.annualPrem.toFixed(2)}/ac`, highlight: false },
                  { label: 'Years with Payment', fn: (c: typeof covComparison[0]) => `${c.trigYears} of ${c.yearsCount}`, highlight: false },
                  { label: 'Total Premiums Paid', fn: (c: typeof covComparison[0]) => `$${c.totalPrem.toFixed(0)}/ac`, highlight: false },
                  { label: 'Total Indemnity Recv\'d', fn: (c: typeof covComparison[0]) => `$${c.totalIndem.toFixed(0)}/ac`, highlight: false },
                  { label: 'Best Single-Year Payout', fn: (c: typeof covComparison[0]) => `$${c.bestPayout.toFixed(2)}/ac`, highlight: false },
                  { label: 'NET COST (Paid − Recv\'d)', fn: (c: typeof covComparison[0]) => `$${c.netCost.toFixed(0)}/ac`, highlight: true },
                  { label: 'Avg Net Cost/Year', fn: (c: typeof covComparison[0]) => `$${(c.yearsCount > 0 ? c.netCost / c.yearsCount : 0).toFixed(2)}/ac`, highlight: true },
                ].map(row => (
                  <tr key={row.label} className={row.highlight ? 'bg-gray-700/30' : ''}>
                    <td className={`py-2 ${row.highlight ? 'font-bold text-white' : 'text-gray-400'}`}>{row.label}</td>
                    {covComparison.map(c => (
                      <td key={c.cov} className={`py-2 text-right font-mono ${
                        row.highlight && c.cov === bestCov.cov ? 'text-yellow-400 font-bold text-base' :
                        row.highlight ? 'text-white font-semibold' : 'text-gray-300'
                      }`}>
                        {row.fn(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded text-sm">
            <span className="text-yellow-400 font-semibold">⭐ Best historical value: {(bestCov.cov * 100).toFixed(0)}% RP</span>
            <span className="text-gray-400 ml-2">— Net cost ${bestCov.netCost.toFixed(0)}/ac over {bestCov.yearsCount} years (${(bestCov.netCost / bestCov.yearsCount).toFixed(2)}/ac/year)</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">* Premiums are estimates{calibApplied ? ` calibrated by ${calibFactor.toFixed(2)}×` : ''}. Always verify with RMA Cost Estimator. Past performance does not guarantee future results.</p>
        </div>
      )}

      {/* Section 5 — Chart */}
      {chartData.length >= 3 && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="font-semibold text-white mb-3">Year by Year — {(selectedCov * 100).toFixed(0)}% RP</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="year" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1F2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#F9FAFB' }}
                formatter={(val: number) => [`$${Math.abs(val).toFixed(2)}/ac`, undefined]}
              />
              <Legend />
              <ReferenceLine y={0} stroke="#6B7280" />
              <Bar dataKey="Premium" fill="#EF4444" name="Premium Paid" />
              <Bar dataKey="Indemnity" fill="#22C55E" name="Indemnity Received" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Section 6 — Print */}
      {enteredYields.length >= 3 && (
        <div className="flex justify-end">
          <button onClick={() => window.print()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center gap-2">
            📄 Print Customer Report
          </button>
        </div>
      )}
    </div>
  );
}
