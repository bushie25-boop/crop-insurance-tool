// OBBBABanner.tsx — 2026 OBBBA info banner
import React, { useState } from 'react';
import { OBBBA_CHANGES } from '../lib/subsidySchedule';

export default function OBBBABanner() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gradient-to-r from-green-900/80 to-emerald-900/80 border border-green-600 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌾</span>
          <div>
            <div className="text-green-300 font-bold text-sm">2026 UPDATE — BIG BEAUTIFUL BILL (OBBBA)</div>
            <div className="text-white font-semibold">
              Subsidies increased · SCO now open to ARC farmers · Biggest crop insurance overhaul since 2014 Farm Bill
            </div>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-green-300 hover:text-white text-sm font-semibold ml-4 whitespace-nowrap"
        >
          {expanded ? 'Hide ▲' : 'See what changed →'}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 pt-4 border-t border-green-700">
          {OBBBA_CHANGES.map(change => (
            <div key={change.id} className="bg-green-950/50 rounded-lg p-3">
              <div className="text-green-300 font-semibold text-sm mb-1">
                {change.id}. {change.title}
              </div>
              <div className="text-slate-300 text-xs">{change.detail}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
