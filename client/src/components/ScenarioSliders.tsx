import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { calcIndemnity } from '../lib/insurance';

const fmt2 = (n: number) => `$${n.toFixed(2)}`;
const fmt0 = (n: number) => `$${Math.round(n)}`;

export default function ScenarioSliders() {
  const { inputs } = useApp();
  const { crop, aphYield, springPrice } = inputs;

  const [sliderPrice, setSliderPrice] = useState(springPrice);
  const [sliderYieldPct, setSliderYieldPct] = useState(100); // % of APH

  const priceMin = crop === 'corn' ? 2.0 : 6.0;
  const priceMax = crop === 'corn' ? 6.0 : 16.0;
  const priceStep = crop === 'corn' ? 0.10 : 0.25;

  // Line chart 1: indemnity vs yield (at fixed harvest price)
  const yieldData = useMemo(() => {
    const pts = [];
    for (let pct = 40; pct <= 120; pct += 5) {
      const actualYield = aphYield * (pct / 100);
      const ind = calcIndemnity(inputs, actualYield, sliderPrice);
      pts.push({ yieldPct: pct, yield: Math.round(actualYield), indemnity: Math.round(ind) });
    }
    return pts;
  }, [inputs, sliderPrice]);

  // Line chart 2: indemnity vs price (at fixed yield)
  const priceData = useMemo(() => {
    const pts = [];
    const actualYield = aphYield * (sliderYieldPct / 100);
    const step = crop === 'corn' ? 0.10 : 0.25;
    for (let p = priceMin; p <= priceMax + 0.001; p += step) {
      const price = Math.round(p * 100) / 100;
      const ind = calcIndemnity(inputs, actualYield, price);
      pts.push({ price: parseFloat(price.toFixed(2)), indemnity: Math.round(ind) });
    }
    return pts;
  }, [inputs, sliderYieldPct, priceMin, priceMax, crop]);

  const currentYieldInd = calcIndemnity(inputs, aphYield * (sliderYieldPct / 100), sliderPrice);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
      <h3 className="text-slate-100 font-bold text-base mb-5">Scenario Sliders — Live Indemnity Explorer</h3>

      {/* Current indemnity at intersection */}
      <div className="bg-slate-900 rounded-xl p-4 mb-5 flex flex-wrap gap-6 items-center">
        <div>
          <span className="text-xs text-slate-400">Harvest Price</span>
          <div className="text-xl font-black text-blue-400">${sliderPrice.toFixed(2)}/bu</div>
        </div>
        <div>
          <span className="text-xs text-slate-400">Farm Yield</span>
          <div className="text-xl font-black text-blue-400">{Math.round(aphYield * sliderYieldPct / 100)} bu/ac ({sliderYieldPct}%)</div>
        </div>
        <div>
          <span className="text-xs text-slate-400">Estimated Indemnity</span>
          <div className={`text-2xl font-black ${currentYieldInd > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {currentYieldInd > 0 ? `$${Math.round(currentYieldInd)}/ac` : 'No Payment'}
          </div>
        </div>
        {currentYieldInd > 0 && (
          <div>
            <span className="text-xs text-slate-400">Total Indemnity ({inputs.acres} ac)</span>
            <div className="text-xl font-black text-amber-400">
              ${Math.round(currentYieldInd * inputs.acres).toLocaleString()}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Chart 1: Indemnity vs Yield at slider price */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-300 font-semibold">
              Indemnity vs Yield <span className="text-blue-400">(at ${sliderPrice.toFixed(2)}/bu harvest)</span>
            </p>
          </div>
          <div className="mb-3">
            <label className="text-xs text-slate-400">Harvest Price: <span className="text-white font-bold">${sliderPrice.toFixed(2)}/bu</span></label>
            <input
              type="range"
              min={priceMin * 100} max={priceMax * 100} step={priceStep * 100}
              value={sliderPrice * 100}
              onChange={e => setSliderPrice(Number(e.target.value) / 100)}
              className="w-full accent-blue-500 mt-1"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>${priceMin}</span><span>${priceMax}</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={yieldData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="yieldPct" tickFormatter={v => `${v}%`} stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `$${v}`} stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`$${v}/ac`, 'Indemnity']} labelFormatter={l => `Yield: ${l}% of APH`} contentStyle={{ background:'#1e293b', border:'1px solid #475569', borderRadius:'8px' }} />
              <ReferenceLine x={sliderYieldPct} stroke="#60a5fa" strokeDasharray="4 2" label={{ value: 'Current', fill: '#60a5fa', fontSize: 10 }} />
              <Line type="monotone" dataKey="indemnity" stroke="#f87171" strokeWidth={2.5} dot={false} name="Indemnity" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: Indemnity vs Price at slider yield */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-300 font-semibold">
              Indemnity vs Price <span className="text-blue-400">(at {sliderYieldPct}% yield / {Math.round(aphYield * sliderYieldPct / 100)} bu/ac)</span>
            </p>
          </div>
          <div className="mb-3">
            <label className="text-xs text-slate-400">Farm Yield: <span className="text-white font-bold">{sliderYieldPct}% of APH ({Math.round(aphYield * sliderYieldPct / 100)} bu/ac)</span></label>
            <input
              type="range"
              min={40} max={120} step={5}
              value={sliderYieldPct}
              onChange={e => setSliderYieldPct(Number(e.target.value))}
              className="w-full accent-blue-500 mt-1"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>40% ({Math.round(aphYield * 0.4)} bu)</span><span>120% ({Math.round(aphYield * 1.2)} bu)</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={priceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="price" tickFormatter={v => `$${Number(v).toFixed(1)}`} stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `$${v}`} stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`$${v}/ac`, 'Indemnity']} labelFormatter={l => `Price: $${Number(l).toFixed(2)}/bu`} contentStyle={{ background:'#1e293b', border:'1px solid #475569', borderRadius:'8px' }} />
              <ReferenceLine x={sliderPrice} stroke="#60a5fa" strokeDasharray="4 2" label={{ value: 'Current', fill: '#60a5fa', fontSize: 10 }} />
              <ReferenceLine x={inputs.springPrice} stroke="#34d399" strokeDasharray="4 2" label={{ value: 'Spring Price', fill: '#34d399', fontSize: 10 }} />
              <Line type="monotone" dataKey="indemnity" stroke="#fb923c" strokeWidth={2.5} dot={false} name="Indemnity" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
