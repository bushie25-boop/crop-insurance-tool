// QuoteBuilder.tsx — multi-field quote with print-ready PDF
import React, { useState, useEffect } from 'react';
import type { InsuranceState } from '../hooks/useInsurance';
import type { InsuranceInputs, County, CropType, PlanType, ECOLevel, UnitStructure } from '../lib/insurance';
import { calcFullPremiumSummary } from '../lib/insurance';

interface FieldEntry {
  id: string;
  name: string;
  acres: number;
  aphYield: number;
  coverageLevel: number;
  planType: PlanType;
  scoEnabled: boolean;
  ecoLevel: ECOLevel;
  unitStructure: UnitStructure;
}

interface QuoteRecord {
  quoteNumber: string;
  timestamp: string;
  farmerName: string;
  farmName: string;
  crop: CropType;
  county: County;
  springPrice: number;
  fields: FieldEntry[];
}

interface Props {
  state: InsuranceState;
}

function newField(state: InsuranceState): FieldEntry {
  return {
    id: Math.random().toString(36).slice(2),
    name: 'Field ' + (Math.random().toString(36).slice(2, 5)).toUpperCase(),
    acres: state.inputs.acres,
    aphYield: state.inputs.aphYield,
    coverageLevel: state.inputs.coverageLevel,
    planType: state.inputs.planType,
    scoEnabled: state.inputs.scoEnabled,
    ecoLevel: state.inputs.ecoLevel,
    unitStructure: state.inputs.unitStructure,
  };
}

function fmt(n: number, dec = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function generateQuoteNumber(): string {
  const now = new Date();
  return `BB-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

const COVERAGE_LEVELS = [0.70, 0.75, 0.80, 0.85];
const PLAN_TYPES: PlanType[] = ['YP', 'RP', 'RP-HPE'];
const ECO_LEVELS: ECOLevel[] = ['None', 'ECO-90', 'ECO-95'];
const UNIT_STRUCTURES: UnitStructure[] = ['Enterprise', 'Basic', 'Optional'];

export default function QuoteBuilder({ state }: Props) {
  const { inputs } = state;
  const [farmerName, setFarmerName] = useState('');
  const [farmName, setFarmName] = useState('');
  const [fields, setFields] = useState<FieldEntry[]>([newField(state)]);
  const [quoteHistory, setQuoteHistory] = useState<QuoteRecord[]>([]);
  const [savedQuote, setSavedQuote] = useState<QuoteRecord | null>(null);

  // Load history from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('bb_quote_history');
      if (raw) setQuoteHistory(JSON.parse(raw));
    } catch {}
  }, []);

  function addField() {
    setFields(f => [...f, newField(state)]);
  }

  function removeField(id: string) {
    setFields(f => f.filter(fi => fi.id !== id));
  }

  function updateField<K extends keyof FieldEntry>(id: string, key: K, value: FieldEntry[K]) {
    setFields(f => f.map(fi => fi.id === id ? { ...fi, [key]: value } : fi));
  }

  function calcFieldPremium(field: FieldEntry) {
    const fieldInputs: InsuranceInputs = {
      ...inputs,
      aphYield: field.aphYield,
      acres: field.acres,
      coverageLevel: field.coverageLevel,
      planType: field.planType,
      scoEnabled: field.scoEnabled,
      ecoLevel: field.ecoLevel,
      unitStructure: field.unitStructure,
    };
    const summary = calcFullPremiumSummary(fieldInputs);
    return summary;
  }

  function saveAndPrint() {
    const quote: QuoteRecord = {
      quoteNumber: generateQuoteNumber(),
      timestamp: new Date().toISOString(),
      farmerName,
      farmName,
      crop: inputs.crop,
      county: inputs.county,
      springPrice: inputs.springPrice,
      fields,
    };
    setSavedQuote(quote);
    const history = [quote, ...quoteHistory].slice(0, 20);
    setQuoteHistory(history);
    try {
      localStorage.setItem('bb_quote_history', JSON.stringify(history));
    } catch {}
    setTimeout(() => window.print(), 300);
  }

  const totalAcres = fields.reduce((s, f) => s + f.acres, 0);
  const totalFarmerCost = fields.reduce((s, f) => {
    const sum = calcFieldPremium(f);
    return s + sum.totalFarmerAllAcres;
  }, 0);

  const q = savedQuote;

  return (
    <div className="space-y-4">
      {/* Screen UI */}
      <div className="no-print bg-slate-800 rounded-xl p-4">
        <h3 className="text-white font-bold text-lg mb-4">📋 Quote Builder</h3>

        {/* Farmer info */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Farmer Name</label>
            <input value={farmerName} onChange={e => setFarmerName(e.target.value)}
              placeholder="John Smith"
              className="w-full bg-slate-700 text-white rounded px-2 py-2 text-sm border border-slate-600" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Farm Name</label>
            <input value={farmName} onChange={e => setFarmName(e.target.value)}
              placeholder="Smith Family Farm"
              className="w-full bg-slate-700 text-white rounded px-2 py-2 text-sm border border-slate-600" />
          </div>
        </div>

        <div className="text-xs text-slate-400 mb-3">
          <span className="font-semibold text-slate-300">Crop:</span> {inputs.crop === 'corn' ? '🌽 Corn' : '🫘 Soybeans'} ·
          <span className="font-semibold text-slate-300 ml-2">County:</span> {inputs.county} ·
          <span className="font-semibold text-slate-300 ml-2">2026 Projected Price:</span> ${inputs.springPrice.toFixed(2)}/bu
        </div>

        {/* Fields */}
        <div className="space-y-3">
          {fields.map((field, idx) => {
            const ps = calcFieldPremium(field);
            return (
              <div key={field.id} className="bg-slate-700 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-semibold text-sm">Field {idx + 1}</span>
                  {fields.length > 1 && (
                    <button onClick={() => removeField(field.id)}
                      className="text-red-400 hover:text-red-300 text-xs">✕ Remove</button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
                  <div className="col-span-2">
                    <label className="text-xs text-slate-400">Field Name</label>
                    <input value={field.name} onChange={e => updateField(field.id, 'name', e.target.value)}
                      className="w-full bg-slate-600 text-white rounded px-2 py-1 text-sm border border-slate-500 mt-0.5" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Acres</label>
                    <input type="number" value={field.acres}
                      onChange={e => updateField(field.id, 'acres', Number(e.target.value))}
                      className="w-full bg-slate-600 text-white rounded px-2 py-1 text-sm border border-slate-500 mt-0.5" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">APH (bu/ac)</label>
                    <input type="number" value={field.aphYield}
                      onChange={e => updateField(field.id, 'aphYield', Number(e.target.value))}
                      className="w-full bg-slate-600 text-white rounded px-2 py-1 text-sm border border-slate-500 mt-0.5" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Coverage</label>
                    <select value={field.coverageLevel}
                      onChange={e => updateField(field.id, 'coverageLevel', Number(e.target.value))}
                      className="w-full bg-slate-600 text-white rounded px-2 py-1 text-sm border border-slate-500 mt-0.5">
                      {COVERAGE_LEVELS.map(cl => (
                        <option key={cl} value={cl}>{Math.round(cl*100)}%</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Plan</label>
                    <select value={field.planType}
                      onChange={e => updateField(field.id, 'planType', e.target.value as PlanType)}
                      className="w-full bg-slate-600 text-white rounded px-2 py-1 text-sm border border-slate-500 mt-0.5">
                      {PLAN_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Unit</label>
                    <select value={field.unitStructure}
                      onChange={e => updateField(field.id, 'unitStructure', e.target.value as UnitStructure)}
                      className="w-full bg-slate-600 text-white rounded px-2 py-1 text-sm border border-slate-500 mt-0.5">
                      {UNIT_STRUCTURES.map(u => <option key={u} value={u}>{u.slice(0,3)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">SCO/ECO</label>
                    <div className="flex gap-1 mt-0.5">
                      <button onClick={() => updateField(field.id, 'scoEnabled', !field.scoEnabled)}
                        className={`flex-1 py-1 rounded text-xs font-semibold ${field.scoEnabled ? 'bg-purple-600 text-white' : 'bg-slate-600 text-slate-300'}`}>
                        SCO
                      </button>
                      <select value={field.ecoLevel}
                        onChange={e => updateField(field.id, 'ecoLevel', e.target.value as ECOLevel)}
                        className="flex-1 bg-slate-600 text-white rounded px-1 text-xs border border-slate-500">
                        {ECO_LEVELS.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                {/* Field premium summary */}
                <div className="mt-2 flex gap-4 text-xs text-slate-400">
                  <span>Guarantee: <strong className="text-white">${fmt(field.aphYield * field.coverageLevel * inputs.springPrice)}/ac</strong></span>
                  <span>Your cost: <strong className="text-yellow-400">${fmt(ps.totalFarmerPerAcre)}/ac</strong></span>
                  <span>Govt pays: <strong className="text-green-400">${fmt(ps.underlying.govtPays + ps.sco.govtPays + ps.eco.govtPays)}/ac</strong></span>
                  <span>Total for field: <strong className="text-white">${fmt(ps.totalFarmerAllAcres, 0)}</strong></span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 mt-3">
          <button onClick={addField}
            className="bg-slate-700 hover:bg-slate-600 text-white text-sm rounded px-4 py-2 font-semibold">
            + Add Field
          </button>
          <div className="flex-1" />
          <div className="text-sm text-slate-300 self-center">
            {totalAcres.toLocaleString()} total acres · Est. total cost: <strong className="text-yellow-400">${fmt(totalFarmerCost, 0)}</strong>
          </div>
          <button onClick={saveAndPrint}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm rounded px-6 py-2 font-bold">
            🖨️ Save & Print Quote
          </button>
        </div>

        {/* History */}
        {quoteHistory.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="text-xs text-slate-400 font-semibold mb-2">Recent Quotes</div>
            <div className="space-y-1">
              {quoteHistory.slice(0, 5).map(q => (
                <div key={q.quoteNumber} className="text-xs text-slate-400 flex gap-4">
                  <span className="text-blue-400 font-mono">{q.quoteNumber}</span>
                  <span>{q.farmerName || 'Unnamed'} — {q.farmName || 'Unnamed Farm'}</span>
                  <span className="text-slate-500">{new Date(q.timestamp).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Print area */}
      {q && (
        <div id="quote-print-area" className="hidden print:block bg-white text-black p-8 font-sans text-sm">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="text-2xl font-black">B&B Agrisales</div>
              <div className="text-gray-600">Fountain City, Wisconsin</div>
              <div className="text-gray-600">Quote prepared by: Stormy O'Day</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">Crop Insurance Quote</div>
              <div className="text-gray-600">Quote #: <strong>{q.quoteNumber}</strong></div>
              <div className="text-gray-600">Date: {new Date(q.timestamp).toLocaleDateString()}</div>
            </div>
          </div>

          <div className="mb-4 p-3 border border-gray-300 rounded">
            <div><strong>Farmer:</strong> {q.farmerName || '—'}</div>
            <div><strong>Farm:</strong> {q.farmName || '—'}</div>
            <div><strong>Crop:</strong> {q.crop === 'corn' ? 'Corn' : 'Soybeans'} · <strong>County:</strong> {q.county}</div>
            <div><strong>2026 Projected Price:</strong> ${q.springPrice.toFixed(2)}/bu · <strong>Crop Year:</strong> 2026</div>
          </div>

          <table className="w-full border-collapse border border-gray-300 text-xs mb-4">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 p-2 text-left">Field</th>
                <th className="border border-gray-300 p-2 text-right">Acres</th>
                <th className="border border-gray-300 p-2 text-right">APH</th>
                <th className="border border-gray-300 p-2 text-center">Coverage</th>
                <th className="border border-gray-300 p-2 text-center">Plan</th>
                <th className="border border-gray-300 p-2 text-center">Unit</th>
                <th className="border border-gray-300 p-2 text-center">SCO/ECO</th>
                <th className="border border-gray-300 p-2 text-right">Guarantee/ac</th>
                <th className="border border-gray-300 p-2 text-right">Govt pays/ac</th>
                <th className="border border-gray-300 p-2 text-right">Your cost/ac</th>
                <th className="border border-gray-300 p-2 text-right">Total cost</th>
              </tr>
            </thead>
            <tbody>
              {q.fields.map(field => {
                const fieldInputs: InsuranceInputs = {
                  ...inputs,
                  aphYield: field.aphYield,
                  acres: field.acres,
                  coverageLevel: field.coverageLevel,
                  planType: field.planType,
                  scoEnabled: field.scoEnabled,
                  ecoLevel: field.ecoLevel,
                  unitStructure: field.unitStructure,
                  crop: q.crop,
                  county: q.county,
                  springPrice: q.springPrice,
                };
                const ps = calcFullPremiumSummary(fieldInputs);
                const govtTotal = ps.underlying.govtPays + ps.sco.govtPays + ps.eco.govtPays;
                return (
                  <tr key={field.id}>
                    <td className="border border-gray-300 p-2">{field.name}</td>
                    <td className="border border-gray-300 p-2 text-right">{field.acres.toLocaleString()}</td>
                    <td className="border border-gray-300 p-2 text-right">{field.aphYield}</td>
                    <td className="border border-gray-300 p-2 text-center">{Math.round(field.coverageLevel*100)}%</td>
                    <td className="border border-gray-300 p-2 text-center">{field.planType}</td>
                    <td className="border border-gray-300 p-2 text-center">{field.unitStructure.slice(0,3)}</td>
                    <td className="border border-gray-300 p-2 text-center text-xs">
                      {field.scoEnabled ? 'SCO' : ''}{field.ecoLevel !== 'None' ? ` ${field.ecoLevel}` : ''}
                      {!field.scoEnabled && field.ecoLevel === 'None' ? 'None' : ''}
                    </td>
                    <td className="border border-gray-300 p-2 text-right">${fmt(field.aphYield * field.coverageLevel * q.springPrice)}</td>
                    <td className="border border-gray-300 p-2 text-right">${fmt(govtTotal)}</td>
                    <td className="border border-gray-300 p-2 text-right font-bold">${fmt(ps.totalFarmerPerAcre)}</td>
                    <td className="border border-gray-300 p-2 text-right font-bold">${fmt(ps.totalFarmerAllAcres, 0)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 font-bold">
              <tr>
                <td className="border border-gray-300 p-2" colSpan={8}>TOTAL</td>
                <td className="border border-gray-300 p-2 text-right" colSpan={2}>All fields:</td>
                <td className="border border-gray-300 p-2 text-right">${fmt(q.fields.reduce((s,f) => {
                  const fi: InsuranceInputs = { ...inputs, aphYield: f.aphYield, acres: f.acres, coverageLevel: f.coverageLevel, planType: f.planType, scoEnabled: f.scoEnabled, ecoLevel: f.ecoLevel, unitStructure: f.unitStructure, crop: q.crop, county: q.county, springPrice: q.springPrice };
                  return s + calcFullPremiumSummary(fi).totalFarmerAllAcres;
                }, 0), 0)}</td>
              </tr>
            </tfoot>
          </table>

          <div className="text-xs text-gray-500 border-t border-gray-300 pt-3 space-y-1">
            <p><strong>Disclaimer:</strong> Estimated premium based on RMA actuarial averages. Final premium set at policy issuance by RMA. Subsidy percentages per RMA MGR-25-006 (OBBBA, effective 2026 crop year).</p>
            <p>* Premiums are estimates only. Verify actual rates at: ewebapp.rma.usda.gov/apps/costestimator/</p>
            <p>* SCO/ECO payments are issued mid-year following the loss year. A 2026 loss would pay in mid-2027.</p>
            <p><strong>Sales Closing Date: March 15, 2026.</strong> Coverage must be purchased or changed prior to this date.</p>
            <p>This quote was prepared by B&B Agrisales · Stormy O'Day · Fountain City, Wisconsin</p>
          </div>
        </div>
      )}
    </div>
  );
}
