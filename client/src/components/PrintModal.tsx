import { useState } from 'react';

export interface PrintSections {
  coverPage: boolean;
  coverageSetup: boolean;
  backtest: boolean;
  stabilityComparison: boolean;
  optimizer: boolean;
  hailQuote: boolean;
  priceHistory: boolean;
  grainMarketing: boolean;
}

interface Props {
  onPrint: (sections: PrintSections) => void;
  onCancel: () => void;
  clientName: string;
  farmName: string;
}

const DEFAULT_SECTIONS: PrintSections = {
  coverPage: true,
  coverageSetup: true,
  backtest: true,
  stabilityComparison: true,
  optimizer: true,
  hailQuote: true,
  priceHistory: true,
  grainMarketing: true,
};

export default function PrintModal({ onPrint, onCancel, clientName, farmName }: Props) {
  const [sections, setSections] = useState<PrintSections>(DEFAULT_SECTIONS);

  const toggle = (key: keyof PrintSections) =>
    setSections(prev => ({ ...prev, [key]: !prev[key] }));

  const allSelected = Object.values(sections).every(Boolean);
  const toggleAll = () => {
    const val = !allSelected;
    setSections({
      coverPage: val, coverageSetup: val, backtest: val,
      stabilityComparison: val, optimizer: val, hailQuote: val,
      priceHistory: val, grainMarketing: val,
    });
  };

  const ITEMS: { key: keyof PrintSections; label: string; desc: string }[] = [
    { key: 'coverPage',           label: '📄 Cover Page',               desc: 'Client name, farm, date, Root Risk branding' },
    { key: 'coverageSetup',       label: '⚙️ Coverage Setup',           desc: 'APH, coverage level, plan type, premium summary' },
    { key: 'backtest',            label: '📊 Historical Backtest',       desc: `Payment history chart & table (${new Date().getFullYear() - 2000} years)` },
    { key: 'stabilityComparison', label: '📈 Stability Scenarios',       desc: 'More stable / Average / Less stable yield comparison' },
    { key: 'optimizer',           label: '🎯 Optimizer Results',         desc: 'Best plan recommendations and scoring' },
    { key: 'hailQuote',           label: '🌩️ Hail Insurance Quote',     desc: 'Pro Ag hail rates, policy comparison, payout chart' },
    { key: 'priceHistory',        label: '💹 Price History',             desc: 'Corn/soybean projected vs harvest prices 2000–present' },
    { key: 'grainMarketing',      label: '🌽 Grain Marketing Notes',     desc: 'Marketing risk analysis and recommendations' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <div className="text-lg font-bold text-white">🖨️ Print Report</div>
            <div className="text-xs text-slate-400 mt-0.5">
              {clientName || 'Client'}{farmName ? ` · ${farmName}` : ''}
            </div>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
        </div>

        {/* Section checklist */}
        <div className="px-6 py-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {/* Select all */}
          <label className="flex items-center gap-3 py-2 border-b border-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="w-4 h-4 rounded accent-blue-500"
            />
            <span className="text-sm font-semibold text-slate-300">Select All</span>
          </label>

          {ITEMS.map(({ key, label, desc }) => (
            <label key={key} className={`flex items-start gap-3 py-2 px-2 rounded-lg cursor-pointer transition-colors ${sections[key] ? 'bg-slate-700/60' : 'hover:bg-slate-700/30'}`}>
              <input
                type="checkbox"
                checked={sections[key]}
                onChange={() => toggle(key)}
                className="w-4 h-4 mt-0.5 rounded accent-blue-500"
              />
              <div>
                <div className="text-sm font-medium text-white">{label}</div>
                <div className="text-xs text-slate-400">{desc}</div>
              </div>
            </label>
          ))}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-700">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => onPrint(sections)}
            disabled={!Object.values(sections).some(Boolean)}
            className="flex-1 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Print Selected
          </button>
        </div>
      </div>
    </div>
  );
}
