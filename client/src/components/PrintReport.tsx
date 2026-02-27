// PrintReport.tsx — Full crop insurance report, print/PDF optimized
import React from 'react';
import type { InsuranceState } from '../hooks/useInsurance';
import { KEY_DATES_2026, getHailEvents, getDaysUntil } from '../lib/historicalData';

interface Props {
  state: InsuranceState;
  printDate?: string;
}

const S = {
  page: {
    fontFamily: 'Georgia, serif',
    color: '#1a1a1a',
    background: 'white',
    padding: '0.5in',
    pageBreakAfter: 'always' as const,
    breakAfter: 'page' as const,
  },
  lastPage: {
    fontFamily: 'Georgia, serif',
    color: '#1a1a1a',
    background: 'white',
    padding: '0.5in',
  },
  h1: { fontSize: '22px', fontWeight: 'bold', color: '#1a1a1a', margin: '0 0 4px 0' },
  h2: { fontSize: '16px', fontWeight: 'bold', color: '#2d6a2d', margin: '20px 0 6px 0', borderBottom: '2px solid #2d6a2d', paddingBottom: '4px' },
  h3: { fontSize: '13px', fontWeight: 'bold', color: '#1a1a1a', margin: '14px 0 4px 0' },
  row: { display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '13px' },
  label: { color: '#444' },
  value: { fontWeight: 'bold' as const, color: '#1a1a1a' },
  total: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '14px', fontWeight: 'bold' as const, borderTop: '2px solid #1a1a1a', marginTop: '4px' },
  note: { fontSize: '11px', color: '#666', marginTop: '8px', fontStyle: 'italic' as const },
  coverBox: {
    border: '3px solid #2d6a2d',
    borderRadius: '8px',
    padding: '20px 28px',
    marginBottom: '24px',
    background: '#f8fbf8',
  },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '12px', marginTop: '8px' },
  th: { background: '#2d6a2d', color: 'white', padding: '6px 8px', textAlign: 'left' as const, fontWeight: 'bold' },
  td: { padding: '4px 8px', borderBottom: '1px solid #ddd' },
  tdAlt: { padding: '4px 8px', borderBottom: '1px solid #ddd', background: '#f5f5f5' },
  divider: { borderTop: '1px solid #ccc', margin: '12px 0' },
};

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}
function fmtMoney(n: number): string {
  return '$' + n.toFixed(2);
}
function fmtComma(n: number): string {
  return n.toLocaleString('en-US');
}

export default function PrintReport({ state, printDate }: Props) {
  const { inputs, premiumSummary, revenueGuarantee, backtestYears,
          clientName, farmName, yieldStability, topCoveragePct, countyAPH, priceData } = state;

  const crop = inputs.crop;
  const coveragePct = Math.round(inputs.coverageLevel * 100);
  const priceHistory = priceData;
  const hailEvents = getHailEvents(inputs.county);

  // Price change stats
  const priceChanges: number[] = [];
  for (let i = 0; i < priceHistory.years.length; i++) {
    const proj = priceHistory.projectedPrices[i];
    const harv = priceHistory.harvestPrices[i];
    if (proj > 0 && harv > 0) priceChanges.push(harv - proj);
  }
  const downYears = priceChanges.filter(c => c < 0);
  const avgDecline = downYears.length > 0 ? downYears.reduce((a, b) => a + b, 0) / downYears.length : 0;
  const worstIdx = priceChanges.indexOf(Math.min(...priceChanges));
  const bestIdx = priceChanges.indexOf(Math.max(...priceChanges));

  // Backtest summary stats
  const numYears = backtestYears.length;
  const payYears = backtestYears.filter(r => r.totalIndemnity > 0).length;
  const avgPrem = numYears > 0 ? backtestYears.reduce((s, r) => s + r.farmerPremium, 0) / numYears : 0;
  const avgIndem = numYears > 0 ? backtestYears.reduce((s, r) => s + r.totalIndemnity, 0) / numYears : 0;
  const avgNet = avgIndem - avgPrem;
  const cumNet = backtestYears.reduce((s, r) => s + r.netPerAcre, 0);

  const yieldLoss = backtestYears.filter(r => r.totalIndemnity > 0 && r.yieldLossBu > 0 && r.harvPrice >= r.projPrice).length;
  const priceLoss = backtestYears.filter(r => r.totalIndemnity > 0 && r.harvPrice < r.projPrice && r.countyYield >= r.countyAPH).length;
  const bothLoss = backtestYears.filter(r => r.totalIndemnity > 0 && r.harvPrice < r.projPrice && r.countyYield < r.countyAPH).length;

  // Uninsured exposure
  const uninsuredPct = 100 - Math.round(topCoveragePct * 100);
  const uninsuredRevenue = (uninsuredPct / 100) * revenueGuarantee;

  // Grain marketing
  const uninsuredBuPerAc = inputs.aphYield * (1 - inputs.coverageLevel);
  const totalUninsuredBu = uninsuredBuPerAc * inputs.acres;
  const atRiskValue = totalUninsuredBu * inputs.springPrice;

  // Coverage description
  let coverageStack = `${inputs.planType} ${coveragePct}%`;
  if (inputs.scoEnabled) coverageStack += ' + SCO (to 86%)';
  if (inputs.ecoLevel !== 'None') coverageStack += ` + ECO (to ${inputs.ecoLevel})`;

  const stabilityText: Record<string, string> = {
    more_stable: 'Your farm historically yields more consistently than county average. Trend-adjusted APH may slightly underestimate your actual performance.',
    average: 'Your farm yield stability is consistent with county average. County backtest is a reasonable proxy for your farm performance.',
    less_stable: 'Your farm yields are more variable than county average. Consider additional coverage layers to protect against yield swings.',
  };

  const marketingRec = inputs.planType === 'RP'
    ? coveragePct >= 80
      ? 'You have strong RP coverage. Consider forward-contracting 20–30% of expected bushels above your insurance guarantee to lock in margins without over-committing.'
      : 'With RP coverage below 80%, your price floor has meaningful gaps. Prioritize forward-contracting bushels above your guarantee and consider puts for the uninsured band.'
    : 'With YP (Yield Protection), you have no price protection from RP. All bushels are exposed to harvest price decline. Forward-contracting or options are strongly recommended.';

  return (
    <div id="print-report">
      <style>{`
        @media print {
          #print-report { display: block !important; }
          body { background: white !important; }
        }
        @media screen {
          #print-report { display: none !important; }
        }
      `}</style>

      {/* ── PAGE 1: Cover / Summary ── */}
      <div style={S.page}>
        <div style={S.coverBox}>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2d6a2d', marginBottom: '8px' }}>
            🌾 B&B Agrisales
          </div>
          <div style={{ fontSize: '18px', color: '#333', marginBottom: '16px' }}>
            Crop Insurance Decision Report
          </div>
          <div style={S.divider} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '13px', marginTop: '10px' }}>
            <div><span style={S.label}>Prepared for:</span> <strong>{clientName || '—'}{farmName ? ` / ${farmName}` : ''}</strong></div>
            <div><span style={S.label}>Date:</span> <strong>{printDate || new Date().toLocaleDateString()}</strong></div>
            <div><span style={S.label}>County:</span> <strong>{inputs.county}</strong></div>
            <div><span style={S.label}>Crop:</span> <strong style={{ textTransform: 'capitalize' }}>{crop}</strong></div>
            <div><span style={S.label}>Agent:</span> <strong>B&B Agrisales, Fountain City WI</strong></div>
            <div><span style={S.label}>Phone:</span> <strong>507-429-0165</strong></div>
          </div>
        </div>

        <div style={S.h2}>POLICY SUMMARY</div>
        <div style={S.row}><span style={S.label}>Plan:</span><span style={S.value}>{inputs.planType} {coveragePct}% {inputs.unitStructure} Unit</span></div>
        <div style={S.row}><span style={S.label}>APH Yield:</span><span style={S.value}>{inputs.aphYield} bu/ac</span></div>
        <div style={S.row}><span style={S.label}>Spring Price:</span><span style={S.value}>{fmtMoney(inputs.springPrice)}/bu</span></div>
        <div style={S.row}><span style={S.label}>Coverage Stack:</span><span style={S.value}>{coverageStack}</span></div>
        <div style={S.row}><span style={S.label}>Revenue Guarantee:</span><span style={S.value}>{fmtMoney(revenueGuarantee)}/ac</span></div>
        <div style={S.row}><span style={S.label}>Acres:</span><span style={S.value}>{fmtComma(inputs.acres)} ac</span></div>

        <div style={S.h2}>PREMIUM BREAKDOWN</div>
        <div style={S.row}><span style={S.label}>Underlying gross premium:</span><span style={S.value}>{fmtMoney(premiumSummary.grossPremium)}/ac</span></div>
        <div style={{ ...S.row, paddingLeft: '16px' }}><span style={S.label}>Government pays ({Math.round(premiumSummary.subsidyPct * 100)}%):</span><span style={S.value}>{fmtMoney(premiumSummary.subsidyAmount)}/ac</span></div>
        <div style={{ ...S.row, paddingLeft: '16px' }}><span style={S.label}>Your cost:</span><span style={S.value}>{fmtMoney(premiumSummary.farmerPremium)}/ac</span></div>
        {inputs.scoEnabled && <div style={S.row}><span style={S.label}>SCO premium (farmer cost):</span><span style={S.value}>{fmtMoney(premiumSummary.scoPremium)}/ac</span></div>}
        {inputs.ecoLevel !== 'None' && <div style={S.row}><span style={S.label}>ECO premium (farmer cost):</span><span style={S.value}>{fmtMoney(premiumSummary.ecoPremium)}/ac</span></div>}
        <div style={S.divider} />
        <div style={S.total}><span>TOTAL FARMER COST:</span><span>{fmtMoney(premiumSummary.totalFarmerPremium)}/ac</span></div>
        <div style={S.row}><span style={S.label}>Total for {fmtComma(inputs.acres)} acres:</span><span style={S.value}>{fmtMoney(premiumSummary.totalFarmerPremium * inputs.acres)}/yr</span></div>
        <div style={S.row}><span style={S.label}>Government subsidy value:</span><span style={S.value}>{fmtMoney(premiumSummary.subsidyAmount)}/ac</span></div>
        <p style={S.note}>* Estimated. Actual premium determined at policy issuance by RMA.</p>
      </div>

      {/* ── PAGE 2: Historical Backtest ── */}
      <div style={S.page}>
        <div style={S.h2}>HISTORICAL BACKTEST — {numYears}-YEAR ANALYSIS</div>
        <p style={{ fontSize: '13px', color: '#444', margin: '0 0 12px 0' }}>
          Using {inputs.county} county yields (USDA NASS) · {crop} · {inputs.planType} {coveragePct}%
        </p>

        <div style={S.h3}>SUMMARY STATISTICS</div>
        <div style={S.row}><span style={S.label}>Years analyzed:</span><span style={S.value}>{numYears} ({backtestYears[0]?.year ?? '—'}–{backtestYears[backtestYears.length - 1]?.year ?? '—'})</span></div>
        <div style={S.row}><span style={S.label}>Years with payment:</span><span style={S.value}>{payYears} of {numYears} ({numYears > 0 ? Math.round(payYears / numYears * 100) : 0}%)</span></div>
        <div style={S.row}><span style={S.label}>Average farmer premium:</span><span style={S.value}>{fmtMoney(avgPrem)}/ac/yr</span></div>
        <div style={S.row}><span style={S.label}>Average indemnity:</span><span style={S.value}>{fmtMoney(avgIndem)}/ac/yr</span></div>
        <div style={S.row}><span style={S.label}>Average net:</span><span style={S.value}>{avgNet >= 0 ? '+' : ''}{fmtMoney(avgNet)}/ac/yr</span></div>
        <div style={S.row}><span style={S.label}>Cumulative net ({numYears}yr):</span><span style={S.value}>{cumNet >= 0 ? '+' : ''}{fmtMoney(cumNet)}/ac</span></div>

        <div style={S.h3}>Cause of loss breakdown:</div>
        <div style={S.row}><span style={S.label}>  Yield-driven losses:</span><span style={S.value}>{yieldLoss} years</span></div>
        <div style={S.row}><span style={S.label}>  Price-driven losses:</span><span style={S.value}>{priceLoss} years</span></div>
        <div style={S.row}><span style={S.label}>  Both yield + price:</span><span style={S.value}>{bothLoss} years</span></div>

        <div style={S.h3}>YEAR-BY-YEAR TABLE</div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Year</th>
              <th style={S.th}>Yield</th>
              <th style={S.th}>Expected</th>
              <th style={S.th}>Harv $</th>
              <th style={S.th}>Rev Ratio</th>
              <th style={S.th}>Payment</th>
              <th style={S.th}>Premium</th>
              <th style={S.th}>Net</th>
            </tr>
          </thead>
          <tbody>
            {backtestYears.map((r, i) => (
              <tr key={r.year}>
                <td style={i % 2 === 0 ? S.td : S.tdAlt}>{r.year}</td>
                <td style={i % 2 === 0 ? S.td : S.tdAlt}>{fmt(r.countyYield, 1)}</td>
                <td style={i % 2 === 0 ? S.td : S.tdAlt}>{fmt(r.countyAPH, 1)}</td>
                <td style={i % 2 === 0 ? S.td : S.tdAlt}>${fmt(r.harvPrice, 2)}</td>
                <td style={i % 2 === 0 ? S.td : S.tdAlt}>{fmt(r.countyRevenueRatio * 100, 1)}%</td>
                <td style={i % 2 === 0 ? S.td : S.tdAlt}>{r.totalIndemnity > 0 ? fmtMoney(r.totalIndemnity) : '—'}</td>
                <td style={i % 2 === 0 ? S.td : S.tdAlt}>{fmtMoney(r.farmerPremium)}</td>
                <td style={i % 2 === 0 ? S.td : S.tdAlt}>{r.netPerAcre >= 0 ? '+' : ''}{fmtMoney(r.netPerAcre)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── PAGE 3: Coverage Analysis ── */}
      <div style={S.page}>
        <div style={S.h2}>COVERAGE ANALYSIS</div>

        <div style={S.h3}>Your Coverage Stack:</div>
        <div style={{ fontSize: '13px', lineHeight: '1.8', paddingLeft: '12px' }}>
          <div>• <strong>{inputs.planType} {coveragePct}%</strong> — covers revenue losses below {coveragePct}% of expected</div>
          {inputs.scoEnabled && <div>• <strong>SCO</strong> — fills gap from {coveragePct}% to 86%</div>}
          {inputs.ecoLevel !== 'None' && <div>• <strong>ECO ({inputs.ecoLevel})</strong> — fills gap above 86% to {inputs.ecoLevel}</div>}
          <div>• Top coverage: <strong>{Math.round(topCoveragePct * 100)}%</strong> of expected revenue</div>
        </div>

        <div style={{ ...S.divider, marginTop: '16px' }} />

        <div style={{ background: '#fff8f0', border: '1px solid #e0a060', borderRadius: '6px', padding: '12px 16px', margin: '12px 0', fontSize: '13px' }}>
          <strong>Uninsured Exposure: {uninsuredPct}% of APH revenue ≈ {fmtMoney(uninsuredRevenue)}/ac</strong>
          <p style={{ margin: '4px 0 0 0', color: '#555' }}>
            This is the portion exposed to yield AND price risk with no indemnity.
          </p>
        </div>

        <div style={S.h2}>YIELD STABILITY NOTE</div>
        <div style={S.row}>
          <span style={S.label}>Farm yield stability:</span>
          <span style={S.value}>
            {yieldStability === 'more_stable' ? 'More Stable' : yieldStability === 'less_stable' ? 'Less Stable' : 'Average'} than county average
          </span>
        </div>
        <p style={{ fontSize: '13px', color: '#444', marginTop: '6px' }}>
          {stabilityText[yieldStability]}
        </p>

        {hailEvents.length > 0 && (
          <>
            <div style={S.h2}>HAIL EXPOSURE WARNING</div>
            <p style={{ fontSize: '13px', color: '#333', marginBottom: '8px' }}>
              At {coveragePct}% RP, the top {100 - coveragePct}% of your crop value is not covered by the underlying policy.
              Historical hail events in {inputs.county}:
            </p>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Year</th>
                  <th style={S.th}>Date</th>
                  <th style={S.th}>Size</th>
                  <th style={S.th}>Intensity</th>
                  <th style={S.th}>Est. Damage</th>
                </tr>
              </thead>
              <tbody>
                {hailEvents.map((e, i) => (
                  <tr key={i}>
                    <td style={S.td}>{e.year}</td>
                    <td style={S.td}>{e.date}</td>
                    <td style={S.td}>{e.size}</td>
                    <td style={S.td}>{e.intensity}</td>
                    <td style={S.td}>{e.estimatedDamage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ ...S.note, color: '#b54', marginTop: '10px', fontStyle: 'normal' }}>
              Consider standalone hail insurance to cover this exposure ($5–15/ac typical).
            </p>
          </>
        )}
      </div>

      {/* ── PAGE 4: Grain Marketing & Key Dates ── */}
      <div style={S.lastPage}>
        <div style={S.h2}>GRAIN MARKETING RISK SUMMARY</div>
        <div style={S.row}><span style={S.label}>2026 Spring Price (projected):</span><span style={S.value}>{fmtMoney(inputs.springPrice)}/bu</span></div>
        <div style={S.row}><span style={S.label}>Coverage guarantee:</span><span style={S.value}>{fmtMoney(revenueGuarantee)}/ac</span></div>
        <div style={S.row}><span style={S.label}>Insured revenue band:</span><span style={S.value}>{fmtMoney(revenueGuarantee * inputs.coverageLevel)} – {fmtMoney(revenueGuarantee)}/ac</span></div>

        <div style={S.h3}>Unpriced bushels above guarantee:</div>
        <div style={{ ...S.row, paddingLeft: '12px' }}><span style={S.label}>{fmt(uninsuredBuPerAc, 1)} bu/ac × {fmtComma(inputs.acres)} ac:</span><span style={S.value}>{fmtComma(Math.round(totalUninsuredBu))} bu total</span></div>
        <div style={{ ...S.row, paddingLeft: '12px' }}><span style={S.label}>At current price:</span><span style={S.value}>${fmtComma(Math.round(atRiskValue))} at risk to price movement</span></div>

        <div style={S.h3}>Historical spring→fall price changes ({crop}, {priceHistory.years[0]}–{priceHistory.years[priceHistory.years.length - 1]}):</div>
        <div style={{ ...S.row, paddingLeft: '12px' }}><span style={S.label}>Prices fell spring→fall:</span><span style={S.value}>{downYears.length} of {priceChanges.length} years ({Math.round(downYears.length / priceChanges.length * 100)}%)</span></div>
        <div style={{ ...S.row, paddingLeft: '12px' }}><span style={S.label}>Average decline (down yrs):</span><span style={S.value}>{fmtMoney(avgDecline)}/bu</span></div>
        {priceChanges.length > 0 && <>
          <div style={{ ...S.row, paddingLeft: '12px' }}><span style={S.label}>Worst decline:</span><span style={S.value}>{priceHistory.years[worstIdx]}: {fmtMoney(priceChanges[worstIdx])}/bu</span></div>
          <div style={{ ...S.row, paddingLeft: '12px' }}><span style={S.label}>Best rally:</span><span style={S.value}>{priceHistory.years[bestIdx]}: +{fmtMoney(priceChanges[bestIdx])}/bu</span></div>
        </>}

        <div style={{ background: '#f0f8f0', border: '1px solid #2d6a2d', borderRadius: '6px', padding: '12px 16px', margin: '16px 0', fontSize: '13px' }}>
          <strong>MARKETING RECOMMENDATION:</strong>
          <p style={{ margin: '4px 0 0 0', color: '#333' }}>{marketingRec}</p>
        </div>

        <div style={S.h2}>KEY DATES — 2026 CROP YEAR</div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Date</th>
              <th style={S.th}>Event</th>
              <th style={S.th}>Days</th>
              <th style={S.th}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {KEY_DATES_2026.map((d, i) => {
              const days = getDaysUntil(d.date);
              return (
                <tr key={d.id}>
                  <td style={i % 2 === 0 ? S.td : S.tdAlt}>{d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td style={i % 2 === 0 ? S.td : S.tdAlt}><strong>{d.label}</strong></td>
                  <td style={i % 2 === 0 ? S.td : S.tdAlt}>{days > 0 ? `${days}d` : 'PAST'}</td>
                  <td style={i % 2 === 0 ? S.td : S.tdAlt}>{d.description}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ ...S.divider, marginTop: '24px' }} />
        <p style={{ fontSize: '11px', color: '#666', lineHeight: '1.6' }}>
          <strong>DISCLAIMER</strong> — This report is for informational and planning purposes only. Premium estimates are
          approximate and will be determined at policy issuance by your RMA-approved insurance provider. County yield data
          sourced from USDA NASS. Price data from RMA historical projected/harvest price tables. Consult your crop
          insurance agent for final quotes and coverage decisions.
        </p>
        <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#2d6a2d', marginTop: '8px' }}>
          B&B Agrisales · Fountain City, WI · 507-429-0165
        </p>
      </div>
    </div>
  );
}
