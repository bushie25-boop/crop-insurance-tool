import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { InsuranceInputs, CropType, County, PlanType, UnitStructure, ECOLevel } from '../lib/insurance';
import { useFutures } from '../lib/useFutures';

interface AppContextValue {
  inputs: InsuranceInputs;
  setInputs: React.Dispatch<React.SetStateAction<InsuranceInputs>>;
  futuresPrices: ReturnType<typeof useFutures>;
}

const DEFAULT_INPUTS: InsuranceInputs = {
  crop: 'corn',
  county: 'Trempealeau WI',
  aphYield: 180,
  acres: 500,
  unitStructure: 'Basic',
  coverageLevel: 0.75,
  planType: 'RP',
  springPrice: 4.50,
  scoEnabled: false,
  ecoLevel: 'None',
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [inputs, setInputs] = useState<InsuranceInputs>(DEFAULT_INPUTS);
  const futures = useFutures();

  // Once futures load, update springPrice if still at default
  useEffect(() => {
    if (futures.source === 'live' && !futures.loading) {
      setInputs(prev => ({
        ...prev,
        springPrice: prev.crop === 'corn' ? futures.corn : futures.soybeans,
      }));
    }
  }, [futures.loading, futures.source]);

  return (
    <AppContext.Provider value={{ inputs, setInputs, futuresPrices: futures }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function useInputUpdater() {
  const { setInputs } = useApp();
  return <K extends keyof InsuranceInputs>(key: K, value: InsuranceInputs[K]) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };
}
