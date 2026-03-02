import React from 'react';

interface Props {
  actualPremiums: Record<number, number | null>;
  setActualPremiums: (p: Record<number, number | null>) => void;
  crop: 'corn' | 'soybeans';
  county: string;
}

const LEVELS = [0.70, 0.75, 0.80, 0.85];

export default function PremiumQuoteEntry({ actualPremiums, setActualPremiums, crop, county }: Props) {
  function update(cov: number, val: string) {
    const num = val === '' ? null : parseFloat(val);
    setActualPremiums({ ...actualPremiums, [cov]: isNaN(num as number) ? null : num });
  }

  const hasAny = LEVELS.some(c => actualPremiums[c] !== null);

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-white text-sm">📋 Actual RMA Quote Entry</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Enter the <strong className="text-gray-300">producer premium</strong> from your RMA Cost Estimator quote —
            the amount <em>you</em> pay after government subsidy.
            Use the <strong className="text-gray-300">Sub Totals row</strong> which includes
            Base RP + SCO + ECO combined.
          </p>
        </div>
        {hasAny && (
          <span className="text-xs bg-green-900/50 text-green-400 border border-green-500/30 rounded px-2 py-1 ml-3 whitespace-nowrap">
            ✓ Quote loaded
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {LEVELS.map(cov => (
          <div key={cov} className="bg-gray-700/50 rounded-lg p-3">
            <label className="block text-xs text-gray-400 mb-1 font-medium">
              {(cov * 100).toFixed(0)}% RP
              <span className="text-gray-500 font-normal"> w/ SCO + ECO</span>
            </label>
            <div className="flex items-center gap-1">
              <span className="text-gray-400 text-sm">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={actualPremiums[cov] ?? ''}
                onChange={e => update(cov, e.target.value)}
                placeholder="—"
                className="w-full bg-gray-700 text-white rounded px-2 py-1.5 text-sm border border-gray-600 focus:border-blue-400 outline-none text-right font-mono"
              />
              <span className="text-gray-500 text-xs">/ac</span>
            </div>
            {actualPremiums[cov] !== null && (
              <div className="text-xs text-green-400 mt-1 text-right">✓ ${(actualPremiums[cov] as number).toFixed(2)}</div>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500 mt-3">
        📍 {county} · {crop === 'corn' ? '🌽 Corn' : '🫘 Soybeans'} ·
        Find on RMA Cost Estimator → <em>Sub Totals → Producer Premium/Acre</em> column.
        Leave blank to use tool estimates.
      </p>
    </div>
  );
}
