// useInsurance.ts — shared state + calculations
import { useState, useMemo } from 'react';
import {
  type InsuranceInputs,
  type County,
  type CropType,
  type PlanType,
  type ECOLevel,
  type UnitStructure,
  calcFullPremiumSummary,
  calcRevenueGuarantee,
  calcYieldGuarantee,
  getCoverageStackLabel,
  getTopCoveragePct,
  generateHeatmap,
  runBacktest,
  summarizeBacktest,
  buildComparisonTable,
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
};

export function useInsurance() {
  const [inputs, setInputs] = useState<InsuranceInputs>(DEFAULT_INPUTS);

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

    return runBacktest(inputs, yields, trendAPH, projPrices, harvPrices, startYear);
  }, [inputs, countyYieldData, priceData]);

  const backtestSummary = useMemo(() => summarizeBacktest(backtestYears), [backtestYears]);

  const countyAPH = useMemo(() => {
    if (!countyYieldData) return inputs.aphYield;
    const aphs = countyYieldData.trendAPH;
    return aphs[aphs.length - 1] ?? inputs.aphYield;
  }, [countyYieldData, inputs.aphYield]);

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
    return buildComparisonTable(inputs, yields, trendAPH, projPrices, harvPrices);
  }, [inputs, countyYieldData, priceData]);

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
  };
}

export type InsuranceState = ReturnType<typeof useInsurance>;
