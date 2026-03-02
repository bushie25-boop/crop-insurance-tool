// useInsurance.ts — shared state + calculations
import { useState, useMemo, useEffect } from 'react';
import {
  type InsuranceInputs,
  type County,
  type CropType,
  type PlanType,
  type ECOLevel,
  type UnitStructure,
  type OptimizerCombo,
  type StabilityScenario,
  type State,
  getCountiesForState,
  calcFullPremiumSummary,
  calcRevenueGuarantee,
  calcYieldGuarantee,
  getCoverageStackLabel,
  getTopCoveragePct,
  generateHeatmap,
  runBacktest,
  summarizeBacktest,
  buildComparisonTable,
  simulateFarmYields,
  runStabilityComparison,
} from '../lib/insurance';
import { getCountyYields, getPriceHistory } from '../lib/historicalData';

const DEFAULT_INPUTS: InsuranceInputs = {
  crop: 'corn',
  county: 'Trempealeau WI',
  aphYield: 160,
  acres: 500,
  share: 1.0,
  unitStructure: 'Basic',
  coverageLevel: 0.80,
  planType: 'RP',
  springPrice: 4.61,
  scoEnabled: false,
  ecoLevel: 'None',
  isBFR: false,
  yearsInFarming: 1,
  irrigated: false,
};

export type BacktestWindow = 5 | 10 | 15 | 20 | 25 | 'all';
export type YieldStability = 'more_stable' | 'average' | 'less_stable';

const STABILITY_FACTOR_MAP: Record<YieldStability, number> = {
  more_stable: 0.5,
  average: 1.0,
  less_stable: 1.3,
};

export function useInsurance() {
  const [inputs, setInputs] = useState<InsuranceInputs>(DEFAULT_INPUTS);
  const [backtestWindow, setBacktestWindow] = useState<BacktestWindow>(15);
  const [assumedYield2026, setAssumedYield2026] = useState<number>(173);
  const [yield2025Override, setYield2025Override] = useState<number | null>(null);
  const [yieldStability, setYieldStability] = useState<YieldStability>('average');
  const [clientName, setClientName] = useState('');
  const [farmName, setFarmName] = useState('');
  // Actual RMA quoted premiums (producer net, w/ SCO + ECO) — entered by agent
  const [actualPremiums, setActualPremiums] = useState<Record<number, number | null>>({
    0.70: null, 0.75: null, 0.80: null, 0.85: null,
  });
  const [optimizerResults, setOptimizerResults] = useState<OptimizerCombo[]>([]);
  const [selectedState, setSelectedState] = useState<State>('WI');

  function updateState(state: State) {
    setSelectedState(state);
    const counties = getCountiesForState(state);
    if (counties.length > 0) {
      updateInput('county', counties[0] as County);
    }
  }

  function updateInput<K extends keyof InsuranceInputs>(key: K, value: InsuranceInputs[K]) {
    setInputs(prev => {
      const next = { ...prev, [key]: value };
      // Auto-update defaults when crop changes
      if (key === 'crop') {
        if (value === 'corn') {
          next.aphYield = 160;
          next.springPrice = 4.61;
        } else {
          next.aphYield = 48;
          next.springPrice = 11.07;
        }
      }
      return next;
    });
  }

  const premiumSummary = useMemo(() => calcFullPremiumSummary(inputs), [inputs]);
  const revenueGuarantee = useMemo(() => calcRevenueGuarantee(inputs), [inputs]);
  const yieldGuarantee = useMemo(() => calcYieldGuarantee(inputs), [inputs]);
  const coverageLabel = useMemo(() => getCoverageStackLabel(inputs), [inputs]);
  const topCoveragePct = useMemo(() => getTopCoveragePct(inputs), [inputs]);

  const countyYieldData = useMemo(() => getCountyYields(inputs.county, inputs.crop), [inputs.county, inputs.crop]);
  const priceData = useMemo(() => getPriceHistory(inputs.crop), [inputs.crop]);

  const backtestYears = useMemo(() => {
    if (!countyYieldData) return [];
    const { yields, trendAPH, years } = countyYieldData;
    const startYear = years[0];

    // Align prices with years
    const projPrices = years.map(yr => {
      const idx = priceData.years.indexOf(yr);
      return idx >= 0 ? priceData.projectedPrices[idx] : inputs.springPrice;
    });
    const harvPrices = years.map(yr => {
      const idx = priceData.years.indexOf(yr);
      return idx >= 0 ? (priceData.harvestPrices[idx] > 0 ? priceData.harvestPrices[idx] : inputs.springPrice) : inputs.springPrice;
    });

    const stabilityFactor = STABILITY_FACTOR_MAP[yieldStability];

    // Inject yield2025Override BEFORE runBacktest so the math recalculates correctly
    const effectiveYields = yields.map((y, i) =>
      years[i] === 2025 && yield2025Override !== null ? yield2025Override : y
    );

    const allFarmYields = simulateFarmYields(effectiveYields, trendAPH, stabilityFactor);
    const fullBacktest = runBacktest(inputs, effectiveYields, trendAPH, projPrices, harvPrices, startYear, allFarmYields);
    // Apply window filter — take the most recent N years
    const windowed = backtestWindow === 'all'
      ? fullBacktest
      : fullBacktest.slice(-backtestWindow);
    return windowed;
  }, [inputs, countyYieldData, priceData, backtestWindow, yieldStability, yield2025Override]);

  const backtestSummary = useMemo(() => summarizeBacktest(backtestYears), [backtestYears]);

  const countyAPH = useMemo(() => {
    if (!countyYieldData) return inputs.aphYield;
    const aphs = countyYieldData.trendAPH;
    return aphs[aphs.length - 1] ?? inputs.aphYield;
  }, [countyYieldData, inputs.aphYield]);

  // Reset assumedYield2026 whenever county or crop changes
  useEffect(() => {
    setAssumedYield2026(countyAPH);
  }, [inputs.county, inputs.crop, countyAPH]);

  // 2026 single-year projection row
  const assumed2026Row = useMemo(() => {
    const projPrice2026 = inputs.crop === 'corn' ? 4.61 : 11.07;
    const row = runBacktest(
      inputs,
      [assumedYield2026],
      [countyAPH],
      [projPrice2026],
      [projPrice2026], // harvest unknown — use projected as proxy
      2026
    );
    return row[0] ?? null;
  }, [inputs, assumedYield2026, countyAPH]);

  const heatmap = useMemo(() => generateHeatmap(inputs, countyAPH), [inputs, countyAPH]);

  const comparisonTable = useMemo(() => {
    if (!countyYieldData) return [];
    const { yields, trendAPH, years } = countyYieldData;
    const projPrices = years.map(yr => {
      const idx = priceData.years.indexOf(yr);
      return idx >= 0 ? priceData.projectedPrices[idx] : inputs.springPrice;
    });
    const harvPrices = years.map(yr => {
      const idx = priceData.years.indexOf(yr);
      return idx >= 0 ? (priceData.harvestPrices[idx] > 0 ? priceData.harvestPrices[idx] : inputs.springPrice) : inputs.springPrice;
    });
    // Apply same window filter as backtestYears
    const n = backtestWindow === 'all' ? yields.length : backtestWindow;
    const wYields = yields.slice(-n);
    const wTrend = trendAPH.slice(-n);
    const wProj = projPrices.slice(-n);
    const wHarv = harvPrices.slice(-n);
    const stabilityFactor = STABILITY_FACTOR_MAP[yieldStability];
    const wFarmYields = simulateFarmYields(wYields, wTrend, stabilityFactor);
    return buildComparisonTable(inputs, wYields, wTrend, wProj, wHarv, wFarmYields);
  }, [inputs, countyYieldData, priceData, backtestWindow, yieldStability]);

  // Farm yields aligned with backtestYears (for chart display)
  const farmYields = useMemo(() => backtestYears.map(y => y.farmYield), [backtestYears]);

  const stabilityComparison = useMemo((): StabilityScenario[] => {
    if (!countyYieldData) return [];
    const { yields, trendAPH, years } = countyYieldData;
    const windowSize = backtestWindow === 'all' ? yields.length : backtestWindow;
    const slicedYields = yields.slice(-windowSize);
    const slicedAPHs = trendAPH.slice(-windowSize);
    const slicedYears = years.slice(-windowSize);
    const projPrices = slicedYears.map(yr => {
      const idx = priceData.years.indexOf(yr);
      return idx >= 0 ? priceData.projectedPrices[idx] : inputs.springPrice;
    });
    const harvPrices = slicedYears.map(yr => {
      const idx = priceData.years.indexOf(yr);
      return idx >= 0 ? (priceData.harvestPrices[idx] > 0 ? priceData.harvestPrices[idx] : inputs.springPrice) : inputs.springPrice;
    });
    return runStabilityComparison(inputs, slicedYields, slicedAPHs, projPrices, harvPrices, slicedYears[0]);
  }, [inputs, countyYieldData, priceData, backtestWindow]);

  return {
    inputs,
    updateInput,
    setInputs,
    // Calculations
    premiumSummary,
    revenueGuarantee,
    yieldGuarantee,
    coverageLabel,
    topCoveragePct,
    // Backtest
    backtestYears,
    backtestSummary,
    countyAPH,
    // Heatmap
    heatmap,
    // Comparison
    comparisonTable,
    // Price/yield data
    countyYieldData,
    priceData,
    // Backtest window
    backtestWindow,
    setBacktestWindow,
    // 2026 assumption
    assumedYield2026,
    setAssumedYield2026,
    assumed2026Row,
    // 2025 override
    yield2025Override,
    setYield2025Override,
    // Farm yields (simulated, aligned with backtestYears)
    farmYields,
    // Stability comparison
    stabilityComparison,
    // Optimizer
    yieldStability,
    setYieldStability,
    optimizerResults,
    setOptimizerResults,
    // Client info
    clientName,
    setClientName,
    farmName,
    setFarmName,
    // State/county selector
    selectedState,
    updateState,
    // Actual quoted premiums
    actualPremiums,
    setActualPremiums,
  };
}

export type InsuranceState = ReturnType<typeof useInsurance>;
