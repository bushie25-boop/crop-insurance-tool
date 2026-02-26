import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { useDataSources } from './hooks/useDataSources';
import SetupPanel from './components/SetupPanel';
import SummaryCards from './components/SummaryCards';
import ScenarioHeatmap from './components/ScenarioHeatmap';
import ScenarioSliders from './components/ScenarioSliders';
import HistoricalBacktest from './components/HistoricalBacktest';
import PlanComparison from './components/PlanComparison';
import PriceDiscovery from './components/PriceDiscovery';
import HailRisk from './components/HailRisk';
import CauseOfLoss from './components/CauseOfLoss';
import SubsidyDisplay from './components/SubsidyDisplay';
import QuoteGenerator from './components/QuoteGenerator';
import DataSourcesPanel from './components/DataSourcesPanel';

type Tab = 'overview' | 'scenarios' | 'backtest' | 'prices' | 'hail' | 'causes' | 'quote';

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'overview',   label: 'Overview',       icon: '🏠' },
  { id: 'scenarios',  label: 'Scenario Engine', icon: '🎯' },
  { id: 'backtest',   label: 'Backtest',        icon: '📊' },
  { id: 'prices',     label: 'Price Discovery', icon: '💹' },
  { id: 'hail',       label: 'Hail Risk',       icon: '🌨️' },
  { id: 'causes',     label: 'Cause of Loss',   icon: '🔍' },
  { id: 'quote',      label: 'Quote Builder',   icon: '📋' },
];

function AppInner() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { inputs } = useApp();
  const dataSources = useDataSources(inputs.county, inputs.crop);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Print styles: hide everything except quote area */}
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          #quote-print-area { display: block !important; }
          @page { margin: 0.5in; }
        }
        @media screen {
          #quote-print-area { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="no-print bg-slate-900 border-b border-slate-700 sticky top-0 z-40 shadow-xl">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-black text-white tracking-tight">B&B Agrisales</div>
            <div className="text-slate-600">|</div>
            <div className="text-sm text-slate-400">Crop Insurance Decision Tool</div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="capitalize">{inputs.crop}</span>
            <span>·</span>
            <span>{inputs.county}</span>
            <span>·</span>
            <span>{inputs.planType} {Math.round(inputs.coverageLevel * 100)}%</span>
            {inputs.scoEnabled && <span className="text-purple-400">+SCO</span>}
            {inputs.ecoLevel !== 'None' && <span className="text-teal-400">+{inputs.ecoLevel}</span>}
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-[1600px] mx-auto px-4 flex gap-1 pb-0 overflow-x-auto scrollbar-hide">
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
      <div className="no-print max-w-[1600px] mx-auto px-4 py-6 space-y-5">
        {/* Setup panel — always visible */}
        <SetupPanel />

        {/* Tab content */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            <SummaryCards />
            <SubsidyDisplay />
            <PlanComparison />
            <DataSourcesPanel dataSources={dataSources} />
          </div>
        )}

        {activeTab === 'scenarios' && (
          <div className="space-y-5">
            <SummaryCards />
            <ScenarioHeatmap />
            <ScenarioSliders />
          </div>
        )}

        {activeTab === 'backtest' && (
          <div className="space-y-5">
            <SummaryCards />
            <HistoricalBacktest dataSources={dataSources} />
          </div>
        )}

        {activeTab === 'prices' && (
          <div className="space-y-5">
            <PriceDiscovery dataSources={dataSources} />
          </div>
        )}

        {activeTab === 'hail' && (
          <div className="space-y-5">
            <HailRisk dataSources={dataSources} />
          </div>
        )}

        {activeTab === 'causes' && (
          <div className="space-y-5">
            <CauseOfLoss dataSources={dataSources} />
          </div>
        )}

        {activeTab === 'quote' && (
          <QuoteGenerator />
        )}
      </div>

      {/* Print-only area */}
      <div id="quote-print-area" />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
