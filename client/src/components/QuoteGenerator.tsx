import React, { useState, useEffect, useRef } from 'react';
import type { QuoteField, Quote } from '../lib/quoteUtils';
import {
  computeQuoteLine, generateQuoteNumber, todayStr,
  saveQuote, loadQuoteHistory, deleteQuote,
} from '../lib/quoteUtils';
import { calcPremiumPerAcre, calcSCOPremiumPerAcre, calcECOPremiumPerAcre, calcGuaranteedRevenue } from '../lib/insurance';
import { useApp } from '../context/AppContext';
import type { CropType, PlanType, UnitStructure, ECOLevel } from '../lib/insurance';

const COUNTIES = ['Trempealeau WI', 'Buffalo WI', 'Jackson WI', 'Houston MN'];
const fmt = (n: number, d = 2) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

function newField(overrides?: Partial<QuoteField>): QuoteField {
  return {
    id: Math.random().toString(36).slice(2),
    fieldName: 'Field 1',
    acres: 100,
    crop: 'corn',
    aphYield: 180,
    coverageLevel: 0.75,
    planType: 'RP',
    unitStructure: 'Basic',
    scoEnabled: false,
    ecoLevel: 'None',
    springPrice: 4.50,
    county: 'Trempealeau WI',
    ...overrides,
  };
}

function emptyQuote(): Quote {
  return {
    quoteNumber: generateQuoteNumber(),
    quoteDate: todayStr(),
    farmerName: '',
    farmName: '',
    address: '',
    preparedBy: "B&B Agrisales — Stormy O'Day",
    fields: [newField()],
  };
}

export default function QuoteGenerator() {
  const { inputs } = useApp();
  const [quote, setQuote] = useState<Quote>(emptyQuote);
  const [history, setHistory] = useState<Quote[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setHistory(loadQuoteHistory()); }, []);

  // Pre-populate with current inputs when switching to this tab
  useEffect(() => {
    setQuote(prev => ({
      ...prev,
      fields: prev.fields.map((f, i) =>
        i === 0 ? {
          ...f,
          crop: inputs.crop,
          county: inputs.county,
          aphYield: inputs.aphYield,
          acres: inputs.acres,
          coverageLevel: inputs.coverageLevel,
          planType: inputs.planType,
          unitStructure: inputs.unitStructure,
          scoEnabled: inputs.scoEnabled,
          ecoLevel: inputs.ecoLevel,
          springPrice: inputs.springPrice,
        } : f
      ),
    }));
  }, []);

  const updateQuote = <K extends keyof Quote>(key: K, val: Quote[K]) =>
    setQuote(prev => ({ ...prev, [key]: val }));

  const updateField = (id: string, key: keyof QuoteField, val: unknown) =>
    setQuote(prev => ({
      ...prev,
      fields: prev.fields.map(f => f.id === id ? { ...f, [key]: val } : f),
    }));

  const addField = () =>
    setQuote(prev => ({
      ...prev,
      fields: [...prev.fields, newField({ fieldName: `Field ${prev.fields.length + 1}`, id: Math.random().toString(36).slice(2) })],
    }));

  const removeField = (id: string) =>
    setQuote(prev => ({ ...prev, fields: prev.fields.filter(f => f.id !== id) }));

  const lines = quote.fields.map(computeQuoteLine);
  const totalPremium = lines.reduce((s, l) => s + l.totalPremium, 0);
  const totalAcres = quote.fields.reduce((s, f) => s + f.acres, 0);

  const handleSave = () => {
    saveQuote(quote);
    setHistory(loadQuoteHistory());
    alert('Quote saved!');
  };

  const handlePrint = () => {
    setShowPrintPreview(true);
    setTimeout(() => window.print(), 300);
  };

  const handleLoad = (q: Quote) => {
    setQuote(q);
    setShowHistory(false);
  };

  const handleDelete = (qn: string) => {
    deleteQuote(qn);
    setHistory(loadQuoteHistory());
  };

  const handleNew = () => {
    if (confirm('Start a new quote? Unsaved changes will be lost.')) {
      setQuote(emptyQuote());
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-slate-100 font-bold text-base flex-1">📋 Quote Generator</h3>
        <button onClick={handleNew} className="text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 px-4 py-2 rounded-xl transition-colors">New Quote</button>
        <button onClick={() => setShowHistory(!showHistory)} className="text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 px-4 py-2 rounded-xl transition-colors">
          History ({history.length})
        </button>
        <button onClick={handleSave} className="text-sm bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded-xl transition-colors">💾 Save</button>
        <button onClick={handlePrint} className="text-sm bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl transition-colors">🖨️ Print / PDF</button>
      </div>

      {/* Quote History panel */}
      {showHistory && history.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-xl">
          <h4 className="text-slate-300 font-semibold text-sm mb-3">Saved Quotes</h4>
          <div className="space-y-2">
            {history.map(q => (
              <div key={q.quoteNumber} className="flex items-center justify-between bg-slate-900 rounded-xl px-4 py-2.5 text-sm">
                <div>
                  <span className="text-blue-400 font-mono font-bold">{q.quoteNumber}</span>
                  <span className="text-slate-300 ml-3">{q.farmerName || '(no name)'}</span>
                  <span className="text-slate-500 ml-3 text-xs">{q.farmName}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-slate-500 text-xs">{q.quoteDate}</span>
                  <span className="text-amber-400 text-xs">${fmt(q.fields.reduce((s,f) => {
                    const l = computeQuoteLine(f);
                    return s + l.totalPremium;
                  }, 0), 0)} total</span>
                  <button onClick={() => handleLoad(q)} className="text-blue-400 hover:text-blue-300 text-xs">Load</button>
                  <button onClick={() => handleDelete(q.quoteNumber)} className="text-red-500 hover:text-red-400 text-xs">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Farmer Info */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-slate-300 font-semibold text-sm">Farmer Information</h4>
          <span className="text-xs text-slate-500 font-mono">Quote #{quote.quoteNumber} · {quote.quoteDate}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { key: 'farmerName', label: 'Farmer Name', placeholder: 'John Smith' },
            { key: 'farmName', label: 'Farm Name', placeholder: 'Smith Family Farm' },
            { key: 'address', label: 'Address', placeholder: '123 County Rd, Arcadia WI' },
            { key: 'preparedBy', label: 'Prepared By', placeholder: "B&B Agrisales" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">{label}</label>
              <input
                type="text"
                value={quote[key as keyof Quote] as string}
                onChange={e => updateQuote(key as keyof Quote, e.target.value as Quote[keyof Quote])}
                placeholder={placeholder}
                className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-3">
        {quote.fields.map((field, fi) => {
          const line = lines[fi];
          return (
            <div key={field.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <input
                  type="text"
                  value={field.fieldName}
                  onChange={e => updateField(field.id, 'fieldName', e.target.value)}
                  className="text-slate-100 font-bold bg-transparent border-b border-slate-600 focus:outline-none focus:border-blue-500 text-base"
                />
                {quote.fields.length > 1 && (
                  <button onClick={() => removeField(field.id)} className="text-red-500 hover:text-red-400 text-xs px-2 py-1 rounded-lg hover:bg-red-950 transition-colors">
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">County</label>
                  <select value={field.county} onChange={e => updateField(field.id, 'county', e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                    {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Crop</label>
                  <select value={field.crop} onChange={e => updateField(field.id, 'crop', e.target.value as CropType)}
                    className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="corn">🌽 Corn</option>
                    <option value="soybeans">🫘 Soybeans</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Acres</label>
                  <input type="number" value={field.acres} onChange={e => updateField(field.id, 'acres', Number(e.target.value))}
                    className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">APH (bu/ac)</label>
                  <input type="number" value={field.aphYield} onChange={e => updateField(field.id, 'aphYield', Number(e.target.value))}
                    className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Spring Price</label>
                  <input type="number" step="0.01" value={field.springPrice} onChange={e => updateField(field.id, 'springPrice', Number(e.target.value))}
                    className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Plan</label>
                  <select value={field.planType} onChange={e => updateField(field.id, 'planType', e.target.value as PlanType)}
                    className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="YP">YP</option>
                    <option value="RP">RP</option>
                    <option value="RP-HPE">RP-HPE</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Coverage</label>
                  <select value={field.coverageLevel} onChange={e => updateField(field.id, 'coverageLevel', Number(e.target.value))}
                    className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                    {[0.50,0.55,0.60,0.65,0.70,0.75,0.80,0.85].map(v => (
                      <option key={v} value={v}>{Math.round(v*100)}%</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Unit Structure</label>
                  <select value={field.unitStructure} onChange={e => updateField(field.id, 'unitStructure', e.target.value as UnitStructure)}
                    className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="Basic">Basic</option>
                    <option value="Optional">Optional</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">SCO</label>
                  <button
                    onClick={() => updateField(field.id, 'scoEnabled', !field.scoEnabled)}
                    className={`w-full py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                      field.scoEnabled ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'
                    }`}>
                    {field.scoEnabled ? '✓ On' : 'Off'}
                  </button>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">ECO</label>
                  <select value={field.ecoLevel} onChange={e => updateField(field.id, 'ecoLevel', e.target.value as ECOLevel)}
                    className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="None">None</option>
                    <option value="ECO-90">ECO-90</option>
                    <option value="ECO-95">ECO-95</option>
                  </select>
                </div>
              </div>

              {/* Line summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-900 rounded-xl p-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Coverage Stack</span>
                  <span className="text-blue-400 font-semibold">{line.stackLabel.split('=')[0].trim()}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Premium/ac</span>
                  <span className="text-amber-400 font-bold text-sm">${fmt(line.premiumPerAcre)}</span>
                  {line.scoAddon > 0 && <span className="text-purple-400 ml-1">+${fmt(line.scoAddon)} SCO</span>}
                  {line.ecoAddon > 0 && <span className="text-teal-400 ml-1">+${fmt(line.ecoAddon)} ECO</span>}
                </div>
                <div>
                  <span className="text-slate-500 block">Total Premium</span>
                  <span className="text-amber-400 font-bold text-sm">${fmt(line.totalPremium)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Guaranteed Revenue</span>
                  <span className="text-blue-400 font-bold text-sm">${fmt(line.guaranteedRevenue)}/ac</span>
                </div>
              </div>
            </div>
          );
        })}

        <button
          onClick={addField}
          className="w-full bg-slate-800 border-2 border-dashed border-slate-600 hover:border-blue-500 hover:bg-slate-700 text-slate-400 hover:text-blue-400 rounded-2xl py-4 text-sm font-semibold transition-all"
        >
          + Add Field / Crop
        </button>
      </div>

      {/* Quote totals */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs text-slate-400">Total Acres</div>
            <div className="text-2xl font-black text-slate-100">{totalAcres.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Total Premium</div>
            <div className="text-2xl font-black text-amber-400">${fmt(totalPremium, 0)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Avg Premium/Acre</div>
            <div className="text-2xl font-black text-amber-300">${totalAcres > 0 ? fmt(totalPremium / totalAcres) : '0.00'}</div>
          </div>
        </div>
      </div>

      {/* Print preview (hidden from screen, shown only when printing) */}
      <div className="hidden print:block" id="quote-print-area">
        <PrintableQuote quote={quote} lines={lines} totalPremium={totalPremium} totalAcres={totalAcres} />
      </div>
    </div>
  );
}

// ─── Printable Quote ──────────────────────────────────────────────────────────
interface PrintProps {
  quote: Quote;
  lines: ReturnType<typeof computeQuoteLine>[];
  totalPremium: number;
  totalAcres: number;
}

function PrintableQuote({ quote, lines, totalPremium, totalAcres }: PrintProps) {
  const fmt = (n: number, d = 2) =>
    n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

  return (
    <div className="font-sans text-slate-900 bg-white max-w-4xl mx-auto print:p-0">
      {/* Header */}
      <div className="bg-slate-800 text-white px-8 py-6 flex items-start justify-between">
        <div>
          <div className="text-2xl font-black tracking-tight">B&B Agrisales</div>
          <div className="text-slate-400 text-sm mt-0.5">Fountain City, Wisconsin</div>
          <div className="text-slate-400 text-xs mt-0.5">Crop Insurance Services</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-slate-100">Crop Insurance Quote</div>
          <div className="text-slate-400 text-sm mt-1">Quote #{quote.quoteNumber}</div>
          <div className="text-slate-400 text-sm">{quote.quoteDate}</div>
        </div>
      </div>

      {/* Farmer info */}
      <div className="px-8 py-5 border-b-2 border-slate-200 grid grid-cols-2 gap-8">
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Prepared For</div>
          <div className="text-lg font-bold text-slate-900">{quote.farmerName || '—'}</div>
          <div className="text-slate-600">{quote.farmName}</div>
          <div className="text-slate-600 text-sm">{quote.address}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Prepared By</div>
          <div className="text-slate-800 font-semibold">{quote.preparedBy}</div>
        </div>
      </div>

      {/* Fields */}
      {quote.fields.map((field, i) => {
        const line = lines[i];
        return (
          <div key={field.id} className="px-8 py-5 border-b border-slate-100">
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className="text-base font-bold text-slate-900">{field.fieldName}</span>
                <span className="text-slate-500 ml-3 text-sm">{field.acres} ac · {field.county} · {field.crop === 'corn' ? 'Corn' : 'Soybeans'}</span>
              </div>
              <div className="text-right">
                <div className="text-xl font-black text-slate-900">${fmt(line.totalPremium, 0)}</div>
                <div className="text-xs text-slate-500">total premium</div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4 text-sm bg-slate-50 rounded-lg p-3">
              <div>
                <div className="text-xs text-slate-500">Plan / Coverage</div>
                <div className="font-semibold">{field.planType} {Math.round(field.coverageLevel * 100)}%</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">APH Yield</div>
                <div className="font-semibold">{field.aphYield} bu/ac</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Spring Price</div>
                <div className="font-semibold">${field.springPrice.toFixed(2)}/bu</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Guar. Revenue</div>
                <div className="font-semibold">${fmt(line.guaranteedRevenue)}/ac</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Base Premium</div>
                <div className="font-semibold">${fmt(line.premiumPerAcre - line.scoAddon - line.ecoAddon)}/ac</div>
              </div>
              {line.scoAddon > 0 && (
                <div>
                  <div className="text-xs text-slate-500">+ SCO Add-on</div>
                  <div className="font-semibold">${fmt(line.scoAddon)}/ac</div>
                </div>
              )}
              {line.ecoAddon > 0 && (
                <div>
                  <div className="text-xs text-slate-500">+ ECO Add-on</div>
                  <div className="font-semibold">${fmt(line.ecoAddon)}/ac</div>
                </div>
              )}
              <div>
                <div className="text-xs text-slate-500">Total Prem/ac</div>
                <div className="font-bold text-slate-900">${fmt(line.premiumPerAcre)}/ac</div>
              </div>
            </div>
            {(field.scoEnabled || field.ecoLevel !== 'None') && (
              <div className="mt-2 text-xs text-slate-600 italic">
                Coverage stack: {line.stackLabel}
              </div>
            )}
          </div>
        );
      })}

      {/* Totals */}
      <div className="px-8 py-5 bg-slate-50">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Total: <span className="font-bold text-slate-900">{totalAcres.toLocaleString()} acres</span> across {quote.fields.length} field{quote.fields.length > 1 ? 's' : ''}
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-slate-900">${fmt(totalPremium, 0)}</div>
            <div className="text-sm text-slate-500">Estimated Total Annual Premium</div>
            <div className="text-sm text-slate-500">${fmt(totalAcres > 0 ? totalPremium / totalAcres : 0)}/ac average</div>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="px-8 py-4 border-t border-slate-200 text-xs text-slate-500 italic">
        Estimated premium based on RMA actuarial data and simplified rating methodology. Final premium is determined at policy issuance by the insurance provider using official RMA actuarial tables. This quote is for illustrative purposes only and does not constitute a binding offer of coverage. Coverage is subject to policy terms, conditions, and availability.
      </div>

      {/* Footer */}
      <div className="px-8 py-4 bg-slate-800 text-slate-400 text-xs flex justify-between">
        <span>B&B Agrisales · Fountain City, WI 54629 · {quote.preparedBy}</span>
        <span>Quote #{quote.quoteNumber} · {quote.quoteDate}</span>
      </div>
    </div>
  );
}
