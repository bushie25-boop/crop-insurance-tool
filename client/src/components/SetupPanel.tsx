// SetupPanel.tsx — Input controls
import React, { useState } from 'react';
import type { InsuranceState } from '../hooks/useInsurance';
import type { County, CropType, PlanType, ECOLevel, UnitStructure } from '../lib/insurance';

const COUNTIES: County[] = ['Trempealeau WI', 'Buffalo WI', 'Jackson WI', 'Houston MN'];
const COVERAGE_LEVELS = [0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85];

interface Props {
  state: InsuranceState;
}

export default function SetupPanel({ state }: Props) {
  const { inputs, updateInput } = state;
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-slate-800 rounded-xl">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-700/50 rounded-xl transition"
      >
        <h2 className="text-white font-bold text-lg">⚙️ Policy Setup</h2>
        <span className="text-slate-400 text-sm">{open ? '▲ Collapse' : '▼ Expand'}</span>
      </button>
      {open && (
      <div className="px-4 pb-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">

        {/* Client Name */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Client Name</label>
          <input
            type="text"
            value={state.clientName}
            onChange={e => state.setClientName(e.target.value)}
            placeholder="Farmer name..."
            className="w-full bg-slate-700 text-white rounded px-2 py-2 text-sm border border-slate-600 placeholder-slate-500"
          />
        </div>

        {/* Farm Name */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Farm / Operation</label>
          <input
            type="text"
            value={state.farmName}
            onChange={e => state.setFarmName(e.target.value)}
            placeholder="Farm name..."
            className="w-full bg-slate-700 text-white rounded px-2 py-2 text-sm border border-slate-600 placeholder-slate-500"
          />
        </div>

        {/* Crop */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Crop</label>
          <div className="flex gap-1">
            {(['corn','soybeans'] as CropType[]).map(c => (
              <button key={c} onClick={() => updateInput('crop', c)}
                className={`flex-1 py-2 rounded text-sm font-semibold capitalize ${inputs.crop === c ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                {c === 'corn' ? '🌽' : '🫘'} {c}
              </button>
            ))}
          </div>
        </div>

        {/* County */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">County</label>
          <select value={inputs.county} onChange={e => updateInput('county', e.target.value as County)}
            className="w-full bg-slate-700 text-white rounded px-2 py-2 text-sm border border-slate-600">
            {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* APH */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">APH Yield (bu/ac)</label>
          <input type="number" value={inputs.aphYield}
            onChange={e => updateInput('aphYield', Number(e.target.value))}
            min={50} max={300} step={1}
            className="w-full bg-slate-700 text-white rounded px-2 py-2 text-sm border border-slate-600" />
        </div>

        {/* Acres */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Acres</label>
          <input type="number" value={inputs.acres}
            onChange={e => updateInput('acres', Number(e.target.value))}
            min={1} max={99999} step={10}
            className="w-full bg-slate-700 text-white rounded px-2 py-2 text-sm border border-slate-600" />
        </div>

        {/* Spring Projected Price */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Spring Price ($/bu)</label>
          <input type="number" value={inputs.springPrice}
            onChange={e => updateInput('springPrice', Number(e.target.value))}
            min={1} max={30} step={0.01}
            className="w-full bg-slate-700 text-white rounded px-2 py-2 text-sm border border-slate-600" />
          <div className="text-xs text-slate-500 mt-0.5">
            {inputs.crop === 'corn' ? '2026 corn: ~$4.61' : '2026 soy: ~$11.07'}
          </div>
        </div>

        {/* Share */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Share %</label>
          <input type="number" value={Math.round(inputs.share * 100)}
            onChange={e => updateInput('share', Number(e.target.value) / 100)}
            min={1} max={100} step={1}
            className="w-full bg-slate-700 text-white rounded px-2 py-2 text-sm border border-slate-600" />
        </div>

        {/* Plan */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Plan</label>
          <div className="flex gap-1">
            {(['YP','RP','RP-HPE'] as PlanType[]).map(p => (
              <button key={p} onClick={() => updateInput('planType', p)}
                className={`flex-1 py-2 rounded text-xs font-semibold ${inputs.planType === p ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Unit Structure */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Unit Structure</label>
          <div className="flex gap-1">
            {(['Enterprise','Basic','Optional'] as UnitStructure[]).map(u => (
              <button key={u} onClick={() => updateInput('unitStructure', u)}
                className={`flex-1 py-1 rounded text-xs font-semibold ${inputs.unitStructure === u ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                {u.slice(0,3)}
              </button>
            ))}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">EU=cheapest · BU=mid · OU=highest</div>
        </div>

        {/* Coverage Level */}
        <div className="col-span-2">
          <label className="block text-xs text-slate-400 mb-1">
            Coverage Level: <span className="text-white font-bold">{Math.round(inputs.coverageLevel * 100)}%</span>
          </label>
          <div className="flex gap-1">
            {COVERAGE_LEVELS.map(cl => (
              <button key={cl} onClick={() => updateInput('coverageLevel', cl)}
                className={`flex-1 py-2 rounded text-xs font-semibold ${inputs.coverageLevel === cl ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                {Math.round(cl * 100)}%
              </button>
            ))}
          </div>
        </div>

        {/* SCO toggle */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">SCO Add-on</label>
          <button onClick={() => updateInput('scoEnabled', !inputs.scoEnabled)}
            className={`w-full py-2 rounded text-sm font-semibold ${inputs.scoEnabled ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
            {inputs.scoEnabled ? '✓ SCO ON' : 'SCO OFF'}
          </button>
          {inputs.scoEnabled && (
            <div className="text-xs text-purple-300 mt-0.5">
              🆕 Now available to ARC farmers!
            </div>
          )}
        </div>

        {/* ECO */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">ECO Level</label>
          <div className="flex gap-1">
            {(['None','ECO-90','ECO-95'] as ECOLevel[]).map(e => (
              <button key={e} onClick={() => updateInput('ecoLevel', e)}
                className={`flex-1 py-2 rounded text-xs font-semibold ${inputs.ecoLevel === e ? 'bg-teal-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                {e === 'None' ? 'None' : e}
              </button>
            ))}
          </div>
        </div>

        {/* Irrigated Practice */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Irrigated Practice
            <span className="text-slate-500 ml-1">(affects actuarial rates)</span>
          </label>
          <button onClick={() => updateInput('irrigated', !inputs.irrigated)}
            className={`w-full py-2 rounded text-sm font-semibold ${inputs.irrigated ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
            {inputs.irrigated ? '💧 Irrigated' : '🌧 Non-Irrigated'}
          </button>
          {inputs.irrigated && inputs.crop === 'soybeans' && (
            <div className="text-xs text-amber-400 mt-0.5">⚠️ Irrigated rates apply to corn only</div>
          )}
        </div>

        {/* BFR */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Beginning Farmer (BFR)?</label>
          <button onClick={() => updateInput('isBFR', !inputs.isBFR)}
            className={`w-full py-2 rounded text-sm font-semibold ${inputs.isBFR ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
            {inputs.isBFR ? '✓ BFR' : 'BFR: No'}
          </button>
          {inputs.isBFR && (
            <div className="mt-1">
              <label className="text-xs text-slate-400">Years in farming:</label>
              <input type="number" value={inputs.yearsInFarming}
                onChange={e => updateInput('yearsInFarming', Number(e.target.value))}
                min={1} max={10} step={1}
                className="w-full bg-slate-700 text-white rounded px-2 py-1 text-sm border border-slate-600 mt-0.5" />
              <div className="text-xs text-orange-300 mt-0.5">⚠️ Deadline: March 15, 2026</div>
            </div>
          )}
        </div>

      </div>

      {/* ARC callout */}
      {inputs.scoEnabled && (
        <div className="mt-3 bg-purple-900/40 border border-purple-600 rounded-lg px-3 py-2 text-sm text-purple-300">
          🆕 <strong>2026:</strong> SCO now available to ARC-enrolled farmers. Previously restricted. Contact your FSA office if you need to update your election.
        </div>
      )}

      {/* SCO/ECO timing note */}
      {(inputs.scoEnabled || inputs.ecoLevel !== 'None') && (
        <div className="mt-2 bg-amber-900/30 border border-amber-600 rounded-lg px-3 py-2 text-sm text-amber-300">
          ⚠️ SCO/ECO payments are issued mid-year following the loss year. A 2026 loss would pay in mid-2027.
        </div>
      )}
      </div>
      )}
    </div>
  );
}
