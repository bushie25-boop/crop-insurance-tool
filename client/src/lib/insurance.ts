// insurance.ts — VERIFIED calculation engine for crop insurance decision tool
// Rebuilt from scratch: February 2026
// Formulas verified by Stormy O'Day, B&B Agrisales — do not modify without re-verification
// Source spec: ~/.openclaw/workspace/agents/storm/crop-insurance-tool-spec.md

import { getSubsidyPct, getBFRAdditionalSubsidy, SCO_ECO_SUBSIDY, type UnitStructure } from './subsidySchedule';

export type { UnitStructure };
export type CropType = 'corn' | 'soybeans';
export type ECOLevel = 'None' | 'ECO-90' | 'ECO-95';
export type PlanType = 'YP' | 'RP' | 'RP-HPE';
export type County = 'Trempealeau WI' | 'Buffalo WI' | 'Jackson WI' | 'Houston MN';

export interface InsuranceInputs {
  crop: CropType;
  county: County;
  aphYield: number;       // bu/ac
  acres: number;
  share: number;          // 0 to 1 (default 1.0)
  unitStructure: UnitStructure;
  coverageLevel: number;  // 0.50 to 0.85
  planType: PlanType;
  springPrice: number;    // projected price ($/bu)
  scoEnabled: boolean;
  ecoLevel: ECOLevel;
  isBFR: boolean;         // Beginning Farmer & Rancher
  yearsInFarming: number; // for BFR subsidy calculation
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const SCO_TOP = 0.86; // expands to 0.90 in 2027
export const ECO_BOTTOM = 0.86;
export const ECO_TOP_MAP: Record<ECOLevel, number> = {
  None: 0,
  'ECO-90': 0.90,
  'ECO-95': 0.95,
};

// Base actuarial rates for CORN (% of liability)
// Source: Scout research from RMA ADM Browser (Trempealeau WI corn, non-irrigated)
// ⚠️ ESTIMATES — verify at: ewebapp.rma.usda.gov/apps/costestimator/
export const BASE_RATES_CORN: Record<number, number> = {
  0.50: 0.004,
  0.55: 0.006,
  0.60: 0.008,
  0.65: 0.010,
  0.70: 0.012,
  0.75: 0.018,
  0.80: 0.025,
  0.85: 0.035,
};

// Plan multipliers vs YP baseline (estimates)
// RP has harvest-price upside risk, hence higher premium
export const PLAN_MULTIPLIER: Record<PlanType, number> = {
  YP: 1.0,
  'RP-HPE': 1.08,
  RP: 1.15,
};

// Unit structure multipliers vs Enterprise Unit
// EU is the cheapest (baseline). BU and OU cost more due to adverse selection.
export const UNIT_MULTIPLIER: Record<UnitStructure, number> = {
  Enterprise: 1.0,
  Basic: 1.4,
  Optional: 2.2,
};

// SCO/ECO rate estimates (% of band liability)
const SCO_COUNTY_RATE = 0.035; // ~3.5% of band liability (estimate)
const ECO_RATE: Record<ECOLevel, number> = {
  None: 0,
  'ECO-90': 0.040,
  'ECO-95': 0.055,
};

// ─── Core formulas ────────────────────────────────────────────────────────────

/**
 * RP Indemnity
 * Guarantee adjusts UP if harvest price rises above projected (price rally protection)
 */
export function calcIndemnityRP(
  aphYield: number,
  coverageLevel: number,
  projectedPrice: number,
  harvestPrice: number,
  actualYield: number
): number {
  const rpGuarantee = aphYield * coverageLevel * Math.max(projectedPrice, harvestPrice);
  const revenue = actualYield * harvestPrice;
  return Math.max(0, rpGuarantee - revenue);
}

/**
 * RP-HPE Indemnity
 * Guarantee locked at projected price — no upside adjustment
 */
export function calcIndemnityRPHPE(
  aphYield: number,
  coverageLevel: number,
  projectedPrice: number,
  harvestPrice: number,
  actualYield: number
): number {
  const guarantee = aphYield * coverageLevel * projectedPrice;
  return Math.max(0, guarantee - actualYield * harvestPrice);
}

/**
 * YP Indemnity
 * Pays on yield shortfall only, valued at projected price
 */
export function calcIndemnityYP(
  aphYield: number,
  coverageLevel: number,
  projectedPrice: number,
  actualYield: number
): number {
  const guaranteedYield = aphYield * coverageLevel;
  return Math.max(0, guaranteedYield - actualYield) * projectedPrice;
}

/**
 * SCO Indemnity — county-level trigger
 * countyRevenueRatio = (actualCountyYield × harvestPrice) / (countyAPH × projectedPrice)
 */
export function calcSCOIndemnity(
  aphYield: number,
  projectedPrice: number,
  coverageLevel: number,
  countyRevenueRatio: number // actualCountyRevenue / expectedCountyRevenue
): number {
  const paymentFactor = Math.max(
    0,
    Math.min(SCO_TOP, 1.0) - Math.max(countyRevenueRatio, coverageLevel)
  );
  return paymentFactor * aphYield * projectedPrice;
}

/**
 * ECO Indemnity — county-level trigger
 * Bands above SCO (86% to 90% or 95%)
 */
export function calcECOIndemnity(
  aphYield: number,
  projectedPrice: number,
  ecoLevel: ECOLevel,
  countyRevenueRatio: number
): number {
  if (ecoLevel === 'None') return 0;
  const ecoTop = ECO_TOP_MAP[ecoLevel];
  const paymentFactor = Math.max(
    0,
    Math.min(ecoTop, 1.0) - Math.max(countyRevenueRatio, ECO_BOTTOM)
  );
  return paymentFactor * aphYield * projectedPrice;
}

/**
 * Compute indemnity for any plan type
 */
export function calcIndemnity(
  inputs: InsuranceInputs,
  actualYield: number,
  harvestPrice: number
): number {
  const { aphYield, coverageLevel, springPrice, planType } = inputs;
  switch (planType) {
    case 'RP':
      return calcIndemnityRP(aphYield, coverageLevel, springPrice, harvestPrice, actualYield);
    case 'RP-HPE':
      return calcIndemnityRPHPE(aphYield, coverageLevel, springPrice, harvestPrice, actualYield);
    case 'YP':
      return calcIndemnityYP(aphYield, coverageLevel, springPrice, actualYield);
  }
}

// ─── Revenue / Yield Guarantee ────────────────────────────────────────────────

export function calcRevenueGuarantee(inputs: InsuranceInputs): number {
  const { aphYield, coverageLevel, springPrice, planType } = inputs;
  if (planType === 'YP') return aphYield * coverageLevel * springPrice; // dollar equivalent
  return aphYield * coverageLevel * springPrice;
}

export function calcYieldGuarantee(inputs: InsuranceInputs): number {
  return inputs.aphYield * inputs.coverageLevel;
}

// ─── Premium Calculation ──────────────────────────────────────────────────────

/**
 * Step 1: Liability
 */
export function calcLiability(inputs: InsuranceInputs): number {
  return inputs.aphYield * inputs.coverageLevel * inputs.springPrice * inputs.acres * inputs.share;
}

/**
 * Step 2: Gross (actuarial) premium per acre — before subsidy
 * ⚠️ ESTIMATED — uses approximate base rates. Verify at RMA Cost Estimator.
 */
export function calcGrossPremiumPerAcre(inputs: InsuranceInputs): number {
  const { crop, coverageLevel, planType, unitStructure, aphYield, springPrice } = inputs;
  const key = Math.round(coverageLevel * 100) / 100;
  const cornRate = BASE_RATES_CORN[key] ?? 0.018;
  const baseRate = crop === 'soybeans' ? cornRate * 0.9 : cornRate;
  const planMult = PLAN_MULTIPLIER[planType];
  const unitMult = UNIT_MULTIPLIER[unitStructure];
  const liabilityPerAcre = aphYield * coverageLevel * springPrice;
  return liabilityPerAcre * baseRate * planMult * unitMult;
}

/**
 * Step 3: Apply subsidy
 */
export function calcSubsidyBreakdown(inputs: InsuranceInputs): {
  gross: number;
  govtPays: number;
  farmerPays: number;
  subsidyPct: number;
} {
  const gross = calcGrossPremiumPerAcre(inputs);
  let subsidyPct = getSubsidyPct(inputs.coverageLevel, inputs.unitStructure);

  // BFR additional subsidy
  if (inputs.isBFR) {
    const bfrBonus = getBFRAdditionalSubsidy(inputs.yearsInFarming);
    subsidyPct = Math.min(0.95, subsidyPct + bfrBonus); // cap at 95%
  }

  const govtPays = gross * subsidyPct;
  const farmerPays = gross * (1 - subsidyPct);
  return { gross, govtPays, farmerPays, subsidyPct };
}

export function calcFarmerPremiumPerAcre(inputs: InsuranceInputs): number {
  return calcSubsidyBreakdown(inputs).farmerPays;
}

export function calcGovtPremiumPerAcre(inputs: InsuranceInputs): number {
  return calcSubsidyBreakdown(inputs).govtPays;
}

// ─── SCO Premium ──────────────────────────────────────────────────────────────

export function calcSCOPremiumBreakdown(inputs: InsuranceInputs): {
  gross: number;
  govtPays: number;
  farmerPays: number;
} {
  if (!inputs.scoEnabled) return { gross: 0, govtPays: 0, farmerPays: 0 };
  const { aphYield, springPrice, coverageLevel } = inputs;
  const bandWidth = Math.max(0, SCO_TOP - coverageLevel);
  const bandLiability = bandWidth * aphYield * springPrice;
  const gross = bandLiability * SCO_COUNTY_RATE;
  const govtPays = gross * SCO_ECO_SUBSIDY;
  const farmerPays = gross * (1 - SCO_ECO_SUBSIDY);
  return { gross, govtPays, farmerPays };
}

export function calcSCOFarmerCostPerAcre(inputs: InsuranceInputs): number {
  return calcSCOPremiumBreakdown(inputs).farmerPays;
}

// ─── ECO Premium ──────────────────────────────────────────────────────────────

export function calcECOPremiumBreakdown(inputs: InsuranceInputs): {
  gross: number;
  govtPays: number;
  farmerPays: number;
} {
  if (inputs.ecoLevel === 'None') return { gross: 0, govtPays: 0, farmerPays: 0 };
  const { aphYield, springPrice, ecoLevel } = inputs;
  const ecoTop = ECO_TOP_MAP[ecoLevel];
  const bandWidth = Math.max(0, ecoTop - ECO_BOTTOM);
  const bandLiability = bandWidth * aphYield * springPrice;
  const gross = bandLiability * ECO_RATE[ecoLevel];
  const govtPays = gross * SCO_ECO_SUBSIDY;
  const farmerPays = gross * (1 - SCO_ECO_SUBSIDY);
  return { gross, govtPays, farmerPays };
}

export function calcECOFarmerCostPerAcre(inputs: InsuranceInputs): number {
  return calcECOPremiumBreakdown(inputs).farmerPays;
}

// ─── Totals ───────────────────────────────────────────────────────────────────

export interface PremiumSummary {
  underlying: { gross: number; govtPays: number; farmerPays: number; subsidyPct: number };
  sco: { gross: number; govtPays: number; farmerPays: number };
  eco: { gross: number; govtPays: number; farmerPays: number };
  totalFarmerPerAcre: number;
  totalFarmerAllAcres: number;
  totalGovt: number;
  totalGross: number;
}

export function calcFullPremiumSummary(inputs: InsuranceInputs): PremiumSummary {
  const underlying = calcSubsidyBreakdown(inputs);
  const sco = calcSCOPremiumBreakdown(inputs);
  const eco = calcECOPremiumBreakdown(inputs);
  const totalFarmerPerAcre = underlying.farmerPays + sco.farmerPays + eco.farmerPays;
  return {
    underlying,
    sco,
    eco,
    totalFarmerPerAcre,
    totalFarmerAllAcres: totalFarmerPerAcre * inputs.acres,
    totalGovt: underlying.govtPays + sco.govtPays + eco.govtPays,
    totalGross: underlying.gross + sco.gross + eco.gross,
  };
}

// ─── Scenario Heatmap ─────────────────────────────────────────────────────────

export interface HeatmapCell {
  price: number;
  yieldPct: number;       // fraction of APH (e.g. 0.5 = 50% of APH)
  actualYield: number;    // bu/ac
  indemnity: number;      // $/ac underlying
  scoIndemnity: number;
  ecoIndemnity: number;
  totalIndemnity: number;
}

export function generateHeatmap(inputs: InsuranceInputs, countyAPH: number): HeatmapCell[] {
  const { crop, aphYield } = inputs;
  const prices = crop === 'corn'
    ? [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0]
    : [6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  const yieldPcts = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2];

  const cells: HeatmapCell[] = [];
  for (const yPct of yieldPcts) {
    for (const price of prices) {
      const actualYield = aphYield * yPct;
      const indemnity = calcIndemnity(inputs, actualYield, price);

      // For SCO/ECO: use yield pct as proxy for county revenue ratio
      const countyRevenueRatio = (actualYield * price) / (countyAPH * inputs.springPrice);
      const scoIndemnity = inputs.scoEnabled
        ? calcSCOIndemnity(aphYield, inputs.springPrice, inputs.coverageLevel, countyRevenueRatio)
        : 0;
      const ecoIndemnity = inputs.ecoLevel !== 'None'
        ? calcECOIndemnity(aphYield, inputs.springPrice, inputs.ecoLevel, countyRevenueRatio)
        : 0;

      cells.push({
        price,
        yieldPct: yPct,
        actualYield,
        indemnity,
        scoIndemnity,
        ecoIndemnity,
        totalIndemnity: indemnity + scoIndemnity + ecoIndemnity,
      });
    }
  }
  return cells;
}

export function getHeatmapColor(indemnity: number, maxIndemnity: number): string {
  if (indemnity === 0) return 'bg-slate-700 text-slate-500';
  const ratio = indemnity / maxIndemnity;
  if (ratio < 0.15) return 'bg-yellow-700/60 text-yellow-200';
  if (ratio < 0.35) return 'bg-yellow-500 text-yellow-900';
  if (ratio < 0.60) return 'bg-orange-500 text-orange-950';
  return 'bg-red-600 text-white';
}

// ─── Historical Backtest ──────────────────────────────────────────────────────

export interface BacktestYear {
  year: number;
  countyYield: number;
  countyAPH: number;
  projPrice: number;
  harvPrice: number;
  countyRevenueRatio: number;
  underlyingIndemnity: number;
  scoIndemnity: number;
  ecoIndemnity: number;
  totalIndemnity: number;
  farmerPremium: number;
  scoPremium: number;
  ecoPremium: number;
  totalPremium: number;
  netPerAcre: number;
  underlyingTriggered: boolean;
  scoTriggered: boolean;
  ecoTriggered: boolean;
  hailEvent?: { magnitude: number; description: string };
}

export function runBacktest(
  inputs: InsuranceInputs,
  countyYields: number[],    // actual county yields per year
  countyAPHs: number[],      // expected county yield (trend APH) per year
  projPrices: number[],
  harvPrices: number[],
  startYear: number = 2009
): BacktestYear[] {
  return countyYields.map((countyYield, i) => {
    const year = startYear + i;
    const countyAPH = countyAPHs[i] ?? countyAPHs[countyAPHs.length - 1] ?? 160;
    const projPrice = projPrices[i] ?? inputs.springPrice;
    const harvPrice = harvPrices[i] ?? inputs.springPrice;

    const yearInputs: InsuranceInputs = { ...inputs, springPrice: projPrice };

    // Underlying policy uses farm APH (individual-level)
    const underlyingIndemnity = calcIndemnity(yearInputs, countyYield, harvPrice);
    const farmerPremium = calcFarmerPremiumPerAcre(yearInputs);
    const scoPremium = calcSCOFarmerCostPerAcre(yearInputs);
    const ecoPremium = calcECOFarmerCostPerAcre(yearInputs);

    // SCO/ECO use county revenue ratio
    const countyRevenueRatio = countyAPH > 0
      ? (countyYield * harvPrice) / (countyAPH * projPrice)
      : 1;

    const scoIndemnity = inputs.scoEnabled
      ? calcSCOIndemnity(inputs.aphYield, projPrice, inputs.coverageLevel, countyRevenueRatio)
      : 0;
    const ecoIndemnity = inputs.ecoLevel !== 'None'
      ? calcECOIndemnity(inputs.aphYield, projPrice, inputs.ecoLevel, countyRevenueRatio)
      : 0;

    const totalIndemnity = underlyingIndemnity + scoIndemnity + ecoIndemnity;
    const totalPremium = farmerPremium + scoPremium + ecoPremium;

    return {
      year,
      countyYield,
      countyAPH,
      projPrice,
      harvPrice,
      countyRevenueRatio,
      underlyingIndemnity,
      scoIndemnity,
      ecoIndemnity,
      totalIndemnity,
      farmerPremium,
      scoPremium,
      ecoPremium,
      totalPremium,
      netPerAcre: totalIndemnity - totalPremium,
      underlyingTriggered: underlyingIndemnity > 0,
      scoTriggered: scoIndemnity > 0,
      ecoTriggered: ecoIndemnity > 0,
    };
  });
}

export interface BacktestSummary {
  years: number;
  underlyingTriggers: number;
  scoTriggers: number;
  ecoTriggers: number;
  anyTriggers: number;
  avgFarmerPremium: number;
  avgTotalIndemnity: number;
  avgNetPerAcre: number;
  cumulativeNet: number;
  triggerRate: number;
}

export function summarizeBacktest(years: BacktestYear[]): BacktestSummary {
  const n = years.length;
  return {
    years: n,
    underlyingTriggers: years.filter(y => y.underlyingTriggered).length,
    scoTriggers: years.filter(y => y.scoTriggered).length,
    ecoTriggers: years.filter(y => y.ecoTriggered).length,
    anyTriggers: years.filter(y => y.totalIndemnity > 0).length,
    avgFarmerPremium: years.reduce((s, y) => s + y.totalPremium, 0) / n,
    avgTotalIndemnity: years.reduce((s, y) => s + y.totalIndemnity, 0) / n,
    avgNetPerAcre: years.reduce((s, y) => s + y.netPerAcre, 0) / n,
    cumulativeNet: years.reduce((s, y) => s + y.netPerAcre, 0),
    triggerRate: years.filter(y => y.totalIndemnity > 0).length / n,
  };
}

// ─── Plan Comparison ──────────────────────────────────────────────────────────

export const PLAN_COMBOS: Array<{ planType: PlanType; coverageLevel: number }> = [
  { planType: 'YP', coverageLevel: 0.70 },
  { planType: 'YP', coverageLevel: 0.75 },
  { planType: 'YP', coverageLevel: 0.80 },
  { planType: 'YP', coverageLevel: 0.85 },
  { planType: 'RP', coverageLevel: 0.70 },
  { planType: 'RP', coverageLevel: 0.75 },
  { planType: 'RP', coverageLevel: 0.80 },
  { planType: 'RP', coverageLevel: 0.85 },
  { planType: 'RP-HPE', coverageLevel: 0.75 },
  { planType: 'RP-HPE', coverageLevel: 0.80 },
  { planType: 'RP-HPE', coverageLevel: 0.85 },
];

export interface PlanComboRow {
  planType: PlanType;
  coverageLevel: number;
  farmerPremiumPerAcre: number;
  govtPaysPerAcre: number;
  grossPremiumPerAcre: number;
  guaranteePerAcre: number;
  subsidyPct: number;
  historicalTriggerRate: number;
  valueScore: number; // triggerRate / farmerPremium (higher = better value)
  isCurrentSelection: boolean;
  isBestValue: boolean;
}

export function buildComparisonTable(
  inputs: InsuranceInputs,
  backtestYields: number[],
  backtestAPHs: number[],
  backtestProjPrices: number[],
  backtestHarvPrices: number[]
): PlanComboRow[] {
  const rows: PlanComboRow[] = PLAN_COMBOS.map(({ planType, coverageLevel }) => {
    const sim: InsuranceInputs = { ...inputs, planType, coverageLevel };
    const { farmerPays, govtPays, gross, subsidyPct } = calcSubsidyBreakdown(sim);
    const guaranteePerAcre = sim.aphYield * coverageLevel * sim.springPrice;
    const years = runBacktest(sim, backtestYields, backtestAPHs, backtestProjPrices, backtestHarvPrices);
    const summary = summarizeBacktest(years);
    const valueScore = farmerPays > 0 ? summary.triggerRate / farmerPays : 0;
    return {
      planType,
      coverageLevel,
      farmerPremiumPerAcre: farmerPays,
      govtPaysPerAcre: govtPays,
      grossPremiumPerAcre: gross,
      guaranteePerAcre,
      subsidyPct,
      historicalTriggerRate: summary.triggerRate,
      valueScore,
      isCurrentSelection: planType === inputs.planType && coverageLevel === inputs.coverageLevel,
      isBestValue: false,
    };
  });

  // Mark best value
  const bestIdx = rows.reduce((best, row, i) => row.valueScore > rows[best].valueScore ? i : best, 0);
  rows[bestIdx].isBestValue = true;
  return rows;
}

// ─── Coverage stack label ─────────────────────────────────────────────────────

export function getCoverageStackLabel(inputs: InsuranceInputs): string {
  const base = `${inputs.planType} ${Math.round(inputs.coverageLevel * 100)}%`;
  const sco = inputs.scoEnabled ? '+ SCO (to 86%)' : '';
  const eco = inputs.ecoLevel !== 'None'
    ? `+ ${inputs.ecoLevel} (to ${ECO_TOP_MAP[inputs.ecoLevel] * 100}%)`
    : '';
  return [base, sco, eco].filter(Boolean).join(' ');
}

export function getTopCoveragePct(inputs: InsuranceInputs): number {
  if (inputs.ecoLevel !== 'None') return ECO_TOP_MAP[inputs.ecoLevel] * 100;
  if (inputs.scoEnabled) return 86;
  return inputs.coverageLevel * 100;
}
