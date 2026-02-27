// PriceDiscovery.tsx — price history, RP advantage, futures chart
import React from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import type { InsuranceState } from '../hooks/useInsurance';
import type { DataSourcesState } from '../hooks/useDataSources';
import { getPriceHistory, calcRPAdvantageRate } from '../lib/historicalData';
import { getStatusBadge } from '../lib/dataSources';

interface Props {
  state: InsuranceState;
  dataSources: DataSourcesState;
}

function fmt(n: number, dec = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export default function PriceDiscovery({ state, dataSources }: Props) {
  const { inputs } = state;
  const priceHistory = getPriceHistory(inputs.crop);
  const rpAdvantage = calcRPAdvantageRate(inputs.crop);

  const chartData = priceHistory.years
    .map((yr, i) => ({
      year: yr,
      projected: priceHistory.projectedPrices[i],
      harvest: priceHistory.harvestPrices[i] > 0 ? priceHistory.harvestPrices[i] : undefined,
      rpAdvantage: priceHistory.harvestPrices[i] > 0
        ? priceHistory.harvestPrices[i] < priceHistory.projectedPrices[i] ? 1 : 0
        : undefined,
    }));

  // Futures chart from Yahoo
  const futuresData = inputs.crop === 'corn' ? dataSources.cornFutures : dataSources.soyFutures;
  const futuresSource = inputs.crop === 'corn' ? dataSources.cornFuturesSource : dataSources.soyFuturesSource;

  const futuresChart = futuresData
    ? futuresData.timestamps.slice(-60).map((ts, i) => ({
        date: new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        price: futuresData.closes[futuresData.timestamps.length - 60 + i],
      })).filter(d => d.price !== null)
    : [];

  const currentPrice = inputs.crop === 'corn' ? 4.61 : 11.07;

  return (
    <div className="bg-slate-800 rounded-xl p-4 space-y-5">
      <div>
        <h3 className="text-white font-bold text-lg mb-1">💹 Price Discovery Tracker</h3>
        <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-3">
          <div className="text-blue-300 font-bold text-sm">2026 {inputs.crop === 'corn' ? 'Corn' : 'Soybean'} Projected Price</div>
          <div className="text-3xl font-black text-white">${currentPrice.toFixed(2)}/bu</div>
          <div className="text-xs text-slate-400 mt-1">
            Price discovery closes <strong className="text-yellow-300">Feb 28, 2026</strong>.
            Final prices announced <strong className="text-yellow-300">March 5, 2026</strong>.
          </div>
        </div>
      </div>

      {/* RP Advantage */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-700 rounded-lg p-3">
          <div className="text-sm text-slate-400 mb-1">RP Price Advantage</div>
          <div className="text-2xl font-black text-green-400">{Math.round(rpAdvantage.rate * 100)}%</div>
          <div className="text-xs text-slate-400">
            Harvest price &lt; projected in {rpAdvantage.count} of {rpAdvantage.total} years
          </div>
          <div className="text-xs text-slate-500 mt-1">
            RP guarantee rises when harvest &gt; projected. In {rpAdvantage.total - rpAdvantage.count} years, RP's upside mattered.
          </div>
        </div>
        <div className="bg-slate-700 rounded-lg p-3">
          <div className="text-sm text-slate-400 mb-1">Years RP Advantage Triggered</div>
          <div className="text-xs text-slate-300 mt-1">
            {rpAdvantage.years.map(yr => (
              <span key={yr} className="inline-block bg-red-900/40 border border-red-700 rounded px-1 mr-1 mb-1">{yr}</span>
            ))}
          </div>
          <div className="text-xs text-slate-500 mt-1">Years where harvest price fell below projected</div>
        </div>
      </div>

      {/* Historical price chart */}
      <div>
        <div className="text-sm text-slate-400 mb-2">
          Historical Projected vs. Harvest Prices — 📊 Estimated
          <span className="text-xs text-slate-500 ml-2">Source: RMA Price Discovery data</span>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="year" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
            <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={v => `$${v}`} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
              labelStyle={{ color: '#fff', fontWeight: 'bold' }}
              formatter={(v: number, name: string) => [`$${fmt(v)}`, name]}
            />
            <Legend />
            <Line dataKey="projected" name="Projected (spring)" stroke="#3b82f6" strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 3 }} />
            <Line dataKey="harvest" name="Harvest (fall)" stroke="#f59e0b" strokeWidth={2}
              dot={{ fill: '#f59e0b', r: 3 }} connectNulls={false} />
            <Bar dataKey="rpAdvantage" name="Harvest < Projected" fill="#ef444430" yAxisId="right" hide />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Futures chart */}
      <div>
        <div className="text-sm text-slate-400 mb-2">
          90-Day CME Futures — {getStatusBadge(futuresSource.status)}
          {futuresSource.lastUpdated && (
            <span className="text-xs text-slate-500 ml-2">
              as of {new Date(futuresSource.lastUpdated).toLocaleString()}
            </span>
          )}
        </div>
        {futuresChart.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={futuresChart} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tick={{ fill: '#9CA3AF', fontSize: 10 }}
                interval={Math.floor(futuresChart.length / 8)} />
              <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={v => `$${v}`} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                formatter={(v: number) => [`$${fmt(v)}`, 'Futures']}
              />
              <ReferenceLine y={currentPrice} stroke="#3b82f6" strokeDasharray="5 5"
                label={{ value: `2026 Proj $${currentPrice}`, fill: '#3b82f6', fontSize: 11 }} />
              <Line dataKey="price" name="CME Futures" stroke="#10b981" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="bg-slate-700 rounded p-4 text-center text-slate-400 text-sm">
            📊 Futures chart unavailable — using estimated projected price of ${currentPrice}
          </div>
        )}
      </div>
    </div>
  );
}
