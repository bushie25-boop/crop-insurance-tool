// PrintReport.tsx — Print Report v2 with Charts
// B&B Agrisales · Teky · Feb 2026
// Full-screen overlay captured by window.print()
import React from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import type { InsuranceState } from '../hooks/useInsurance';
import { KEY_DATES_2026, getDaysUntil, getHailEvents } from '../lib/historicalData';


interface Props {
  state: InsuranceState;
  printMode: boolean;
  printDate?: string;
}

const STABILITY_FACTOR_MAP: Record<string, number> = {
  more_stable: 0.5,
  average: 1.0,
  less_stable: 1.3,
};

const STABILITY_LABEL: Record<string, string> = {
  more_stable: 'More Stable',
  average: 'Average',
  less_stable: 'Less Stable',
};

const STABILITY_NOTE: Record<string, string> = {
  more_stable: 'dampened county swings (×0.5)',
  average: 'tracks county directly',
  less_stable: 'amplified county swings (×1.3)',
};

function fmt(n: number, d = 2) { return n.toFixed(d); }
function fmtMoney(n: number) { return '$' + n.toFixed(2); }
function fmtComma(n: number) { return n.toLocaleString('en-US'); }

const S = {
  section: { marginBottom: '24px' },
  h2: { fontSize: '15px', fontWeight: 'bold' as const, color: '#2d6a2d', borderBottom: '2px solid #2d6a2d', paddingBottom: '3px', marginBottom: '10px', marginTop: '20px' },
  h3: { fontSize: '13px', fontWeight: 'bold' as const, color: '#1a1a1a', marginBottom: '6px', marginTop: '14px' },
  row: { display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '12px' },
  label: { color: '#555' },
  value: { fontWeight: 'bold' as const, color: '#1a1a1a' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '11px', marginTop: '6px' },
  th: { background: '#2d6a2d', color: 'white', padding: '5px 6px', textAlign: 'left' as const, fontWeight: 'bold' as const },
  td: { padding: '3px 6px', borderBottom: '1px solid #e0e0e0' },
  tdAlt: { padding: '3px 6px', borderBottom: '1px solid #e0e0e0', background: '#f5f5f5' },
  note: { fontSize: '10px', color: '#666', marginTop: '6px', fontStyle: 'italic' as const },
  divider: { borderTop: '1px solid #ccc', margin: '10px 0' },
};

export default function PrintReport({ state, printMode, printDate }: Props) {
  if (!printMode) return null;

  const {
    inputs, premiumSummary, revenueGuarantee, backtestYears,
    clientName, farmName, yieldStability, topCoveragePct, countyAPH,
    priceData, countyYieldData, optimizerResults,
  } = state;

  const stabilityFactor = STABILITY_FACTOR_MAP[yieldStability] ?? 1.0;
  const stabilityLabel = STABILITY_LABEL[yieldStability] ?? 'Average';
  const stabilityNote = STABILITY_NOTE[yieldStability] ?? 'tracks county directly';

  const crop = inputs.crop;
  const coveragePct = Math.round(inputs.coverageLevel * 100);
  const hailEvents = getHailEvents(inputs.county);

  // ── Section 3: Backtest chart data ──
  const numYears = backtestYears.length;
  const payYears = backtestYears.filter(r => r.totalIndemnity > 0).length;
  const avgPrem = numYears > 0 ? backtestYears.reduce((s, r) => s + r.totalPremium, 0) / numYears : 0;
  const avgIndem = numYears > 0 ? backtestYears.reduce((s, r) => s + r.totalIndemnity, 0) / numYears : 0;
  const avgNet = avgIndem - avgPrem;
  const cumNet = backtestYears.reduce((s, r) => s + r.netPerAcre, 0);
  const worstNet = numYears > 0 ? Math.min(...backtestYears.map(y => y.netPerAcre)) : 0;

  const yieldDriven = backtestYears.filter(r => r.totalIndemnity > 0 && r.yieldLossBu > 0 && r.harvPrice >= r.projPrice).length;
  const priceDriven = backtestYears.filter(r => r.totalIndemnity > 0 && r.harvPrice < r.projPrice && r.countyYield >= r.countyAPH).length;
  const bothDriven = backtestYears.filter(r => r.totalIndemnity > 0 && r.harvPrice < r.projPrice && r.countyYield < r.countyAPH).length;

  let cumulative = 0;
  const backtestChartData = backtestYears.map(r => {
    cumulative += r.netPerAcre;
    return {
      year: r.year,
      underlying: r.underlyingIndemnity,
      sco: r.scoIndemnity,
      eco: r.ecoIndemnity,
      premium: -r.totalPremium,
      cumNet: cumulative,
    };
  });

  // ── Section 6: Price chart data ──
  const priceChartData = priceData.years
    .map((yr, i) => {
      const proj = priceData.projectedPrices[i];
      const harv = priceData.harvestPrices[i];
      if (!proj || !harv || harv === 0) return null;
      return { year: yr, change: harv - proj };
    })
    .filter(Boolean) as Array<{ year: number; change: number }>;

  const priceChanges = priceChartData.map(d => d.change);
  const downYears = priceChanges.filter(c => c < 0);
  const avgDecline = downYears.length > 0 ? downYears.reduce((a, b) => a + b, 0) / downYears.length : 0;
  const worstChange = priceChanges.length > 0 ? Math.min(...priceChanges) : 0;
  const bestChange = priceChanges.length > 0 ? Math.max(...priceChanges) : 0;
  const worstYear = priceData.years[priceChanges.indexOf(worstChange)] ?? '';
  const bestYear = priceData.years[priceChanges.indexOf(bestChange)] ?? '';

  // Marketing recommendation
  const marketingRec = inputs.planType === 'RP'
    ? coveragePct >= 80
      ? 'Strong RP coverage. Consider forward-contracting 20–30% of expected bushels above your insurance guarantee to lock in margins without over-committing.'
      : 'RP coverage below 80% leaves meaningful gaps. Prioritize forward-contracting bushels above your guarantee and consider puts for the uninsured band.'
    : 'With YP (Yield Protection), you have no price protection from RP. All bushels are exposed to harvest price decline. Forward-contracting or options are strongly recommended.';

  const uninsuredBuPerAc = inputs.aphYield * (1 - inputs.coverageLevel);
  const totalUninsuredBu = uninsuredBuPerAc * inputs.acres;
  const atRiskValue = totalUninsuredBu * inputs.springPrice;

  // Top 3 optimizer results
  const top3 = optimizerResults.slice(0, 3);
  const currentLabel = `${inputs.planType} ${coveragePct}% ${inputs.unitStructure === 'Enterprise' ? 'EU' : inputs.unitStructure === 'Basic' ? 'BU' : 'OU'}${inputs.scoEnabled ? ' + SCO' : ''}${inputs.ecoLevel !== 'None' ? ` + ${inputs.ecoLevel}` : ''}`;
  const currentRank = optimizerResults.find(c => c.label === currentLabel)?.rank ?? null;

  return (
    <div
      className="print-report-overlay"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, background: 'white',
        overflow: 'auto', padding: '32px',
        fontFamily: 'Georgia, serif', color: '#1a1a1a',
      }}
    >
      <style>{`
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
        @page { margin: 0.4in; size: letter portrait; }
        .page-break { break-after: page; }
      `}</style>
      {/* ── SECTION 1: Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/root-risk-logo.jpg" alt="Root Risk Management" style={{ height: '40px', filter: 'none' }} />
          <div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#2d6a2d' }}>Root Risk Management</div>
            <div style={{ fontSize: '12px', color: '#555' }}>Crop Insurance Decision Report</div>
          </div>
        </div>
        <div style={{ fontSize: '12px', textAlign: 'right', color: '#444', lineHeight: '1.6' }}>
          {clientName && <div><strong>Client:</strong> {clientName}{farmName ? ` / ${farmName}` : ''}</div>}
          <div><strong>Date:</strong> {printDate || new Date().toLocaleDateString()}</div>
          <div><strong>County:</strong> {inputs.county} &nbsp;|&nbsp; <strong>Crop:</strong> <span style={{ textTransform: 'capitalize' }}>{crop}</span></div>
        </div>
      </div>
      <div style={S.divider} />

      {/* ── SECTION 2: Policy Summary + Premium Breakdown ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        <div>
          <div style={S.h2}>POLICY SUMMARY</div>
          <div style={S.row}><span style={S.label}>Plan:</span><span style={S.value}>{inputs.planType} {coveragePct}% {inputs.unitStructure} Unit</span></div>
          <div style={S.row}><span style={S.label}>APH Yield:</span><span style={S.value}>{inputs.aphYield} bu/ac</span></div>
          <div style={S.row}><span style={S.label}>Acres:</span><span style={S.value}>{fmtComma(inputs.acres)} ac</span></div>
          <div style={S.row}><span style={S.label}>Spring Price:</span><span style={S.value}>{fmtMoney(inputs.springPrice)}/bu</span></div>
          <div style={S.row}><span style={S.label}>Revenue Guarantee:</span><span style={S.value}>{fmtMoney(revenueGuarantee)}/ac</span></div>
          {inputs.scoEnabled && <div style={S.row}><span style={S.label}>SCO:</span><span style={S.value}>Enabled (to 86%)</span></div>}
          {inputs.ecoLevel !== 'None' && <div style={S.row}><span style={S.label}>ECO:</span><span style={S.value}>{inputs.ecoLevel}</span></div>}
          <div style={S.row}><span style={S.label}>Top Coverage:</span><span style={S.value}>{Math.round(topCoveragePct * 100)}%</span></div>
        </div>
        <div>
          <div style={S.h2}>PREMIUM BREAKDOWN</div>
          <div style={S.row}><span style={S.label}>Underlying gross premium:</span><span style={S.value}>{fmtMoney(premiumSummary.underlying.gross)}/ac</span></div>
          <div style={{ ...S.row, paddingLeft: '12px' }}><span style={S.label}>Govt pays ({Math.round(premiumSummary.underlying.subsidyPct * 100)}%):</span><span style={S.value}>{fmtMoney(premiumSummary.underlying.govtPays)}/ac</span></div>
          <div style={{ ...S.row, paddingLeft: '12px' }}><span style={S.label}>Your cost:</span><span style={S.value}>{fmtMoney(premiumSummary.underlying.farmerPays)}/ac</span></div>
          {inputs.scoEnabled && <div style={S.row}><span style={S.label}>SCO (farmer cost):</span><span style={S.value}>{fmtMoney(premiumSummary.sco.farmerPays)}/ac</span></div>}
          {inputs.ecoLevel !== 'None' && <div style={S.row}><span style={S.label}>ECO (farmer cost):</span><span style={S.value}>{fmtMoney(premiumSummary.eco.farmerPays)}/ac</span></div>}
          <div style={{ ...S.divider, margin: '6px 0' }} />
          <div style={{ ...S.row, fontWeight: 'bold', fontSize: '13px' }}>
            <span>TOTAL/ac:</span><span>{fmtMoney(premiumSummary.totalFarmerPerAcre)}/ac</span>
          </div>
          <div style={S.row}><span style={S.label}>Total for {fmtComma(inputs.acres)} acres:</span><span style={S.value}>{fmtMoney(premiumSummary.totalFarmerAllAcres)}/yr</span></div>
        </div>
      </div>

      {/* ── SECTION 3: Backtest Performance ── */}
      <div style={S.h2}>HISTORICAL PERFORMANCE ANALYSIS — {numYears}-YEAR BACKTEST</div>

      {/* Sub-section A: Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '12px' }}>
        {[
          { label: 'Years w/ Payment', val: `${payYears} / ${numYears} (${numYears > 0 ? Math.round(payYears/numYears*100) : 0}%)` },
          { label: 'Avg Premium/yr', val: `${fmtMoney(avgPrem)}/ac` },
          { label: 'Avg Indemnity/yr', val: `${fmtMoney(avgIndem)}/ac` },
          { label: 'Avg Net/yr', val: `${avgNet >= 0 ? '+' : ''}${fmtMoney(avgNet)}/ac` },
          { label: 'Worst Year Net', val: `${worstNet >= 0 ? '+' : ''}${fmtMoney(worstNet)}/ac` },
          { label: `Cumulative Net (${numYears}yr)`, val: `${cumNet >= 0 ? '+' : ''}${fmtMoney(cumNet)}/ac` },
        ].map(({ label, val }) => (
          <div key={label} style={{ background: '#f8f8f8', border: '1px solid #ddd', borderRadius: '4px', padding: '6px 10px' }}>
            <div style={{ fontSize: '10px', color: '#666' }}>{label}</div>
            <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Sub-section B: Chart */}
      {backtestChartData.length > 0 && (
        <div style={{ background: 'white' }}>
          <ComposedChart width={680} height={200} data={backtestChartData} margin={{ top: 4, right: 20, bottom: 4, left: 0 }}>
            <XAxis dataKey="year" tick={{ fontSize: 9 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 9 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} />
            <Tooltip formatter={(v: number) => fmtMoney(Math.abs(v))} />
            <Legend wrapperStyle={{ fontSize: '10px' }} />
            <ReferenceLine yAxisId="left" y={0} stroke="#666" />
            <Bar yAxisId="left" dataKey="underlying" name="Underlying" stackId="a" fill="#3b82f6" />
            <Bar yAxisId="left" dataKey="sco" name="SCO" stackId="a" fill="#a855f7" />
            <Bar yAxisId="left" dataKey="eco" name="ECO" stackId="a" fill="#14b8a6" />
            <Bar yAxisId="left" dataKey="premium" name="Premium" fill="#ef4444" />
            <Line yAxisId="right" type="monotone" dataKey="cumNet" name="Cum. Net" stroke="#f97316" dot={false} strokeWidth={2} />
          </ComposedChart>
        </div>
      )}

      {/* Sub-section C: Cause of loss */}
      <div style={{ fontSize: '12px', color: '#444', margin: '6px 0' }}>
        <strong>Cause of loss:</strong>&nbsp;
        Yield-driven: <strong>{yieldDriven} yrs</strong> &nbsp;|&nbsp;
        Price-driven: <strong>{priceDriven} yrs</strong> &nbsp;|&nbsp;
        Both: <strong>{bothDriven} yrs</strong>
      </div>

      {/* Sub-section D: Year table */}
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Year</th>
            <th style={S.th}>Farm Yield</th>
            <th style={S.th}>County Yield</th>
            <th style={S.th}>Rev Ratio</th>
            <th style={S.th}>Cause</th>
            <th style={S.th}>Payment</th>
            <th style={S.th}>Premium</th>
            <th style={S.th}>Net</th>
          </tr>
        </thead>
        <tbody>
          {backtestYears.map((r, i) => (
            <tr key={r.year}>
              <td style={i % 2 === 0 ? S.td : S.tdAlt}>{r.year}</td>
              <td style={i % 2 === 0 ? S.td : S.tdAlt}>{fmt(r.farmYield, 1)}</td>
              <td style={i % 2 === 0 ? S.td : S.tdAlt}>{fmt(r.countyYield, 1)}</td>
              <td style={i % 2 === 0 ? S.td : S.tdAlt}>{fmt(r.countyRevenueRatio * 100, 1)}%</td>
              <td style={i % 2 === 0 ? S.td : S.tdAlt}>{r.causeTags.join(', ')}</td>
              <td style={i % 2 === 0 ? S.td : S.tdAlt}>{r.totalIndemnity > 0 ? fmtMoney(r.totalIndemnity) : '—'}</td>
              <td style={i % 2 === 0 ? S.td : S.tdAlt}>{fmtMoney(r.totalPremium)}</td>
              <td style={{ ...(i % 2 === 0 ? S.td : S.tdAlt), color: r.netPerAcre >= 0 ? '#16a34a' : '#dc2626', fontWeight: 'bold' }}>
                {r.netPerAcre >= 0 ? '+' : ''}{fmtMoney(r.netPerAcre)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── SECTION 4: Optimizer Recommendation ── */}
      <div style={S.h2}>OPTIMIZER RECOMMENDATION</div>
      {optimizerResults.length > 0 ? (
        <div>
          <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px' }}>
            Based on {numYears}-year history · {stabilityLabel} farm stability
          </div>
          {top3.map((c, i) => (
            <div key={c.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 10px', marginBottom: '4px', borderRadius: '4px',
              background: i === 0 ? '#f0fdf4' : '#fafafa',
              border: `1px solid ${i === 0 ? '#86efac' : '#e0e0e0'}`,
              fontSize: '12px',
            }}>
              <div>
                <strong>#{c.rank}{i === 0 ? ' BEST VALUE' : ''}:</strong> {c.label}
              </div>
              <div style={{ fontWeight: 'bold', color: c.stabilityAdjustedNet >= 0 ? '#16a34a' : '#dc2626' }}>
                Adj. Net: {c.stabilityAdjustedNet >= 0 ? '+' : ''}{fmtMoney(c.stabilityAdjustedNet)}/ac/yr
              </div>
            </div>
          ))}
          <div style={{ fontSize: '11px', color: '#444', marginTop: '8px' }}>
            Current selection: <strong>{currentLabel}</strong>{currentRank ? ` (ranked #${currentRank} of ${optimizerResults.length})` : ''}
          </div>
          {hailEvents.length > 0 && (
            <div style={{ background: '#fff8f0', border: '1px solid #e0a060', borderRadius: '4px', padding: '8px 12px', marginTop: '10px', fontSize: '11px' }}>
              ⚠️ <strong>Hail Exposure:</strong> {hailEvents.length} hail events recorded in {inputs.county} since 2000. At {coveragePct}% coverage, the top {100 - coveragePct}% of crop value is uninsured. Consider standalone hail insurance ($5–15/ac).
            </div>
          )}
        </div>
      ) : (
        <p style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>Run the Optimizer tab to see personalized recommendations.</p>
      )}

      {/* ── SECTION 5: Grain Marketing Risk ── */}
      <div style={S.h2}>GRAIN MARKETING RISK</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <div style={S.row}><span style={S.label}>Uninsured bu/ac:</span><span style={S.value}>{fmt(uninsuredBuPerAc, 1)} bu/ac</span></div>
          <div style={S.row}><span style={S.label}>Total uninsured bu:</span><span style={S.value}>{fmtComma(Math.round(totalUninsuredBu))} bu</span></div>
          <div style={S.row}><span style={S.label}>At-risk value:</span><span style={S.value}>${fmtComma(Math.round(atRiskValue))}</span></div>
          <div style={{ ...S.divider, margin: '8px 0' }} />
          <div style={S.row}><span style={S.label}>Prices fell spring→fall:</span><span style={S.value}>{downYears.length} / {priceChanges.length} yrs ({Math.round(downYears.length / Math.max(priceChanges.length, 1) * 100)}%)</span></div>
          <div style={S.row}><span style={S.label}>Avg decline (down yrs):</span><span style={S.value}>{fmtMoney(avgDecline)}/bu</span></div>
          <div style={S.row}><span style={S.label}>Worst drop:</span><span style={S.value}>{worstYear}: {fmtMoney(worstChange)}/bu</span></div>
          <div style={S.row}><span style={S.label}>Best rally:</span><span style={S.value}>{bestYear}: +{fmtMoney(bestChange)}/bu</span></div>
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '4px', padding: '8px', marginTop: '10px', fontSize: '11px' }}>
            <strong>Marketing Rec:</strong> {marketingRec}
          </div>
        </div>
        <div>
          {priceChartData.length > 0 && (
            <ComposedChart width={500} height={150} data={priceChartData} margin={{ top: 4, right: 10, bottom: 4, left: 0 }}>
              <XAxis dataKey="year" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip formatter={(v: number) => fmtMoney(v)} />
              <ReferenceLine y={0} stroke="#666" />
              <Bar dataKey="change" name="Spring→Fall Change">
                {priceChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.change >= 0 ? '#16a34a' : '#dc2626'} />
                ))}
              </Bar>
            </ComposedChart>
          )}
          <p style={{ fontSize: '10px', color: '#666', marginTop: '2px', textAlign: 'center' }}>
            Spring→Fall {crop} price change ($/bu) by year
          </p>
        </div>
      </div>

      {/* ── SECTION 6: Key Dates + Disclaimer ── */}
      <div style={S.h2}>KEY DATES — 2026 CROP YEAR</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px', fontSize: '11px', marginBottom: '16px' }}>
        {KEY_DATES_2026.map(d => {
          const days = getDaysUntil(d.date);
          return (
            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #eee' }}>
              <span style={{ color: '#444' }}>
                <strong>{d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong> — {d.label}
              </span>
              <span style={{ fontWeight: 'bold', color: days <= 0 ? '#999' : days <= 14 ? '#dc2626' : '#555' }}>
                {days > 0 ? `${days}d` : 'PAST'}
              </span>
            </div>
          );
        })}
      </div>

      <div style={S.divider} />
      <p style={{ fontSize: '10px', color: '#666', lineHeight: '1.6' }}>
        <strong>DISCLAIMER</strong> — This report is for informational and planning purposes only. Premium estimates are
        approximate and will be determined at policy issuance by your RMA-approved insurance provider. County yield data
        sourced from USDA NASS. Price data from RMA historical projected/harvest price tables. Simulated farm yields are
        model-based estimates and do not represent actual APH or RMA-certified yields. Consult your crop insurance agent
        for final quotes and coverage decisions.
      </p>
      <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#2d6a2d', marginTop: '6px' }}>
        Root Risk Management · Fountain City, WI · 507-429-0165
      </p>
    </div>
  );
}
