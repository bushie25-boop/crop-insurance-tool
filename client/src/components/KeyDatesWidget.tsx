// KeyDatesWidget.tsx — countdown to key 2026 crop insurance dates
import React, { useState } from 'react';
import { KEY_DATES_2026, getDaysUntil } from '../lib/historicalData';

export default function KeyDatesWidget() {
  const now = new Date();
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-slate-800 rounded-xl">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-700/50 rounded-xl transition"
      >
        <h3 className="text-white font-bold text-lg">📅 2026 Key Dates</h3>
        <span className="text-slate-400 text-sm">{open ? '▲ Collapse' : '▼ Expand'}</span>
      </button>
      {open && (
      <div className="px-4 pb-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {KEY_DATES_2026.map(item => {
          const days = getDaysUntil(item.date);
          const isPast = days < 0;
          const urgencyClass =
            isPast ? 'border-slate-600 opacity-50' :
            item.urgency === 'urgent' && days <= 30 ? 'border-red-500 bg-red-900/20' :
            item.urgency === 'urgent' ? 'border-orange-500 bg-orange-900/20' :
            'border-slate-600 bg-slate-700/30';

          return (
            <div key={item.id} className={`border rounded-lg p-3 ${urgencyClass}`}>
              <div className="text-xs text-slate-400 mb-1">
                {item.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
              <div className="text-sm font-semibold text-white leading-tight mb-1">{item.label}</div>
              <div className={`text-lg font-black ${
                isPast ? 'text-slate-500' :
                days <= 7 ? 'text-red-400' :
                days <= 30 ? 'text-orange-400' :
                'text-slate-300'
              }`}>
                {isPast ? 'PAST' : days === 0 ? 'TODAY' : `${days}d`}
              </div>
              <div className="text-xs text-slate-400 mt-1 leading-tight">{item.description}</div>
            </div>
          );
        })}
      </div>

      {/* March 15 urgency callout */}
      {getDaysUntil(new Date('2026-03-15')) > 0 && getDaysUntil(new Date('2026-03-15')) <= 30 && (
        <div className="mt-3 bg-red-900/40 border border-red-600 rounded-lg p-3 text-center">
          <span className="text-red-300 font-bold text-sm">
            ⚠️ SALES CLOSING IN {getDaysUntil(new Date('2026-03-15'))} DAYS — March 15, 2026. Contact your agent NOW.
          </span>
        </div>
      )}
      </div>
      )}
    </div>
  );
}
