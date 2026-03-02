// App.tsx — Crop Insurance Decision Tool v2
// B&B Agrisales · Rebuilt Feb 2026 with verified formulas (OBBBA)
import React, { useState } from 'react';
import { useInsurance } from './hooks/useInsurance';
import { useDataSources } from './hooks/useDataSources';
import OBBBABanner from './components/OBBBABanner';
import KeyDatesWidget from './components/KeyDatesWidget';
import SetupPanel from './components/SetupPanel';
import SummaryCards from './components/SummaryCards';
import ScenarioHeatmap from './components/ScenarioHeatmap';
import HistoricalBacktest from './components/HistoricalBacktest';
import PlanComparison from './components/PlanComparison';
import PriceDiscovery from './components/PriceDiscovery';
import QuoteBuilder from './components/QuoteBuilder';
import DataSourcesPanel from './components/DataSourcesPanel';
import HailMap from './components/HailMap';
import OptimizerTab from './components/OptimizerTab';
import HailQuoter from './components/HailQuoter';
import CustomerAnalysis from './components/CustomerAnalysis';
import PrintReport from './components/PrintReport';
import PrintModal, { type PrintSections } from './components/PrintModal';

type Tab = 'overview' | 'scenarios' | 'backtest' | 'prices' | 'quote' | 'hail' | 'hail-quote' | 'optimizer' | 'customer';

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'overview',   label: 'Overview',         icon: '🏠' },
  { id: 'scenarios',  label: 'Scenario Heatmap',  icon: '🎯' },
  { id: 'backtest',   label: 'Backtest',          icon: '📊' },
  { id: 'prices',     label: 'Price Discovery',   icon: '💹' },
  { id: 'quote',      label: 'Quote Builder',     icon: '📋' },
  { id: 'hail',       label: 'Hail Map',          icon: '🌩️' },
  { id: 'hail-quote', label: 'Hail Quote',         icon: '🌩️' },
  { id: 'optimizer',  label: 'Optimizer',         icon: '🎯' },
  { id: 'customer',   label: 'Customer Analysis', icon: '👤' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [printMode, setPrintMode] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printSections, setPrintSections] = useState<PrintSections | null>(null);
  const state = useInsurance();
  const dataSources = useDataSources(state.inputs.county, state.inputs.crop);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; visibility: hidden !important; }
          .print-report-overlay, .print-report-overlay * { visibility: visible !important; }
          .print-report-overlay { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; background: white !important; }
          body { background: white !important; margin: 0 !important; }
        }
      `}</style>

      {/* Header */}
      <div className="no-print bg-slate-900 border-b border-slate-700 sticky top-0 z-40 shadow-xl">
        <div className="max-w-[1700px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/root-risk-logo.jpg"
              alt="Root Risk Management"
              className="h-10 w-auto object-contain"
              style={{ filter: 'invert(1) brightness(2)' }}
            />
            <div>
              <div className="text-sm font-black text-white tracking-tight leading-tight">Root Risk Management</div>
              <div className="text-xs text-slate-400 leading-tight">Crop Insurance Decision Tool</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="capitalize">{state.inputs.crop}</span>
            <span>·</span>
            <span>{state.inputs.county}</span>
            <span>·</span>
            <span className="text-blue-300 font-semibold">
              {state.inputs.planType} {Math.round(state.inputs.coverageLevel * 100)}%
            </span>
            {state.inputs.scoEnabled && <span className="text-purple-400">+SCO</span>}
            {state.inputs.ecoLevel !== 'None' && <span className="text-teal-400">+{state.inputs.ecoLevel}</span>}
            {state.inputs.isBFR && <span className="text-green-400 font-bold">BFR</span>}
            <span>·</span>
            <span className="text-cyan-400">{state.inputs.irrigated ? 'Irrigated' : 'Non-Irr'}</span>
            <button
              onClick={() => setShowPrintModal(true)}
              className="flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition ml-2"
            >
              🖨️ Print Report
            </button>
          </div>
        </div>

        <div className="max-w-[1700px] mx-auto px-4 flex gap-1 pb-0 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-t-xl border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-white border-blue-500 bg-slate-800'
                  : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="no-print max-w-[1700px] mx-auto px-4 py-5 space-y-4">
        {/* Always visible */}
        <OBBBABanner />
        {activeTab === 'overview' && <KeyDatesWidget />}
        {activeTab === 'overview' && <SetupPanel state={state} />}

        {/* Tab content */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <SummaryCards state={state} />
            <PlanComparison state={state} />
            <DataSourcesPanel dataSources={dataSources} />
          </div>
        )}

        {activeTab === 'scenarios' && (
          <div className="space-y-4">
            <SummaryCards state={state} />
            <ScenarioHeatmap state={state} />
          </div>
        )}

        {activeTab === 'backtest' && (
          <div className="space-y-4">
            <SummaryCards state={state} />
            <HistoricalBacktest state={state} />
          </div>
        )}

        {activeTab === 'prices' && (
          <PriceDiscovery state={state} dataSources={dataSources} />
        )}

        {activeTab === 'quote' && (
          <QuoteBuilder state={state} />
        )}

        {activeTab === 'hail' && (
          <HailMap selectedCounty={state.inputs.county} />
        )}

        {activeTab === 'hail-quote' && (
          <HailQuoter
            county={state.inputs.county}
            crop={state.inputs.crop as 'corn' | 'soybeans'}
            aphYield={state.inputs.aphYield}
            springPrice={state.inputs.projectedPrice}
            acres={state.inputs.acres}
          />
        )}

        {activeTab === 'optimizer' && (
          <OptimizerTab state={state} dataSources={dataSources} />
        )}
        {activeTab === 'customer' && (
          <CustomerAnalysis />
        )}
      </div>

      <PrintReport state={state} printMode={printMode} printSections={printSections} printDate={new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} />
      {showPrintModal && (
        <PrintModal
          clientName={state.inputs.clientName ?? ''}
          farmName={state.inputs.farmName ?? ''}
          onCancel={() => setShowPrintModal(false)}
          onPrint={(sections) => {
            setShowPrintModal(false);
            setPrintSections(sections);
            setPrintMode(true);
            setTimeout(() => {
              window.print();
              setTimeout(() => {
                setPrintMode(false);
                setPrintSections(null);
              }, 500);
            }, 1200);
          }}
        />
      )}
    </div>
  );
}
