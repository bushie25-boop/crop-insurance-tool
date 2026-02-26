import React from 'react';
import { useApp, useInputUpdater } from '../context/AppContext';
import type { County, PlanType, UnitStructure, ECOLevel } from '../lib/insurance';

const COUNTIES: County[] = ['Trempealeau WI', 'Buffalo WI', 'Jackson WI', 'Houston MN'];
const PLAN_TYPES: PlanType[] = ['YP', 'RP', 'RP-HPE'];
const UNIT_STRUCTURES: UnitStructure[] = ['Basic', 'Optional', 'Enterprise'];
const ECO_LEVELS: ECOLevel[] = ['None', 'ECO-90', 'ECO-95'];
const COVERAGE_LEVELS = [0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85];

export default function SetupPanel() {
  const { inputs, futuresPrices } = useApp();
  const update = useInputUpdater();

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-slate-100 text-lg font-bold tracking-wide">Setup</h2>
        {futuresPrices.source === 'live' && (
          <span className="text-xs bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded-full">
            📡 Live CME Prices
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {/* Crop toggle */}
        <div className="col-span-2 md:col-span-1">
          <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">Crop</label>
          <div className="flex rounded-lg overflow-hidden border border-slate-600">
            {(['corn', 'soybeans'] as const).map(c => (
              <button
                key={c}
                onClick={() => {
                  update('crop', c);
                  update('aphYield', c === 'corn' ? 180 : 50);
                  update('springPrice', c === 'corn' ? futuresPrices.corn : futuresPrices.soybeans);
                }}
                className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                  inputs.crop === c
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {c === 'corn' ? '🌽 Corn' : '🫘 Beans'}
              </button>
            ))}
          </div>
        </div>

        {/* County */}
        <div>
          <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">County</label>
          <select
            value={inputs.county}
            onChange={e => update('county', e.target.value as County)}
            className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* APH */}
        <div>
          <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">APH Yield (bu/ac)</label>
          <input
            type="number"
            value={inputs.aphYield}
            onChange={e => update('aphYield', Number(e.target.value))}
            className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Acres */}
        <div>
          <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">Acres</label>
          <input
            type="number"
            value={inputs.acres}
            onChange={e => update('acres', Number(e.target.value))}
            className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Spring Price */}
        <div>
          <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">Spring Price ($/bu)</label>
          <input
            type="number"
            step="0.01"
            value={inputs.springPrice}
            onChange={e => update('springPrice', Number(e.target.value))}
            className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Unit Structure */}
        <div>
          <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">Unit Structure</label>
          <select
            value={inputs.unitStructure}
            onChange={e => update('unitStructure', e.target.value as UnitStructure)}
            className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {UNIT_STRUCTURES.map(u => <option key={u} value={u}>{u} Unit</option>)}
          </select>
        </div>

        {/* Coverage Level */}
        <div className="col-span-2">
          <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">
            Coverage Level — <span className="text-blue-400 font-bold">{Math.round(inputs.coverageLevel * 100)}%</span>
          </label>
          <input
            type="range"
            min="50" max="85" step="5"
            value={Math.round(inputs.coverageLevel * 100)}
            onChange={e => update('coverageLevel', Number(e.target.value) / 100)}
            className="w-full accent-blue-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>50%</span><span>65%</span><span>75%</span><span>85%</span>
          </div>
        </div>

        {/* Plan Type */}
        <div className="col-span-2 md:col-span-1">
          <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">Plan Type</label>
          <div className="flex rounded-lg overflow-hidden border border-slate-600">
            {PLAN_TYPES.map(p => (
              <button
                key={p}
                onClick={() => update('planType', p)}
                className={`flex-1 py-2 text-xs font-bold transition-colors ${
                  inputs.planType === p
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* SCO Toggle */}
        <div>
          <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">SCO</label>
          <button
            onClick={() => update('scoEnabled', !inputs.scoEnabled)}
            className={`w-full py-2 rounded-lg text-sm font-semibold border transition-colors ${
              inputs.scoEnabled
                ? 'bg-purple-600 border-purple-500 text-white'
                : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'
            }`}
          >
            {inputs.scoEnabled ? '✓ SCO On' : 'SCO Off'}
          </button>
          {inputs.scoEnabled && (
            <p className="text-xs text-purple-400 mt-1">
              Covers {Math.round(inputs.coverageLevel * 100)}%→86% band
            </p>
          )}
        </div>

        {/* ECO Level */}
        <div>
          <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">ECO Level</label>
          <select
            value={inputs.ecoLevel}
            onChange={e => update('ecoLevel', e.target.value as ECOLevel)}
            className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ECO_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          {inputs.ecoLevel !== 'None' && (
            <p className="text-xs text-teal-400 mt-1">
              Covers 86%→{inputs.ecoLevel === 'ECO-90' ? '90' : '95'}% band
            </p>
          )}
        </div>
      </div>

      {/* Coverage stack summary */}
      {(inputs.scoEnabled || inputs.ecoLevel !== 'None') && (
        <div className="mt-4 bg-slate-900 rounded-xl px-4 py-3 border border-slate-600">
          <p className="text-sm text-slate-300">
            <span className="text-blue-400 font-bold">Coverage Stack:</span>{' '}
            <span className="text-white">{inputs.planType} {Math.round(inputs.coverageLevel * 100)}%</span>
            {inputs.scoEnabled && <span className="text-purple-400"> + SCO ({Math.round(inputs.coverageLevel * 100)}%→86%)</span>}
            {inputs.ecoLevel !== 'None' && (
              <span className="text-teal-400"> + {inputs.ecoLevel} (86%→{inputs.ecoLevel === 'ECO-90' ? '90' : '95'}%)</span>
            )}
            <span className="text-slate-500 ml-2">
              = coverage up to{' '}
              {inputs.ecoLevel !== 'None'
                ? (inputs.ecoLevel === 'ECO-90' ? 90 : 95)
                : inputs.scoEnabled ? 86 : Math.round(inputs.coverageLevel * 100)}% of county revenue
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
