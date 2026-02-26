// insurance.ts — pure calculation logic for crop insurance decision tool
// Includes: YP / RP / RP-HPE underlying + SCO + ECO layers

export type CropType = 'corn' | 'soybeans';
export type ECOLevel = 'None' | 'ECO-90' | 'ECO-95';
export type PlanType = 'YP' | 'RP' | 'RP-HPE';
export type UnitStructure = 'Basic' | 'Optional' | 'Enterprise';
export type County = 'Trempealeau WI' | 'Buffalo WI' | 'Jackson WI' | 'Houston MN';

export interface InsuranceInputs {
  crop: CropType;
  county: County;
  aphYield: number;
  acres: number;
  unitStructure: UnitStructure;
  coverageLevel: number; // 0.50 to 0.85
  planType: PlanType;
  springPrice: number;
  scoEnabled: boolean;
  ecoLevel: ECOLevel;
}

// ─── SCO / ECO constants ─────────────────────────────────────────────────────
// SCO covers band: coverageLevel → 86% using county yields
// Premium subsidy: 65% (farmer pays 35%)
export const SCO_TOP = 0.86;
export const SCO_COUNTY_RATE = 0.015; // ~1.5% of band liability (unsubsidized)
export const SCO_SUBSIDY = 0.65;

// ECO covers band: 86% → 90% or 95% using county yields
// Premium subsidy: 44%
export const ECO_TOP: Record<ECOLevel, number> = { None: 0, 'ECO-90': 0.90, 'ECO-95': 0.95 };
export const ECO_UNSUBSIDIZED_RATE: Record<ECOLevel, number> = {
  None: 0,
  'ECO-90': 0.022,
  'ECO-95': 0.038,
};
export const ECO_SUBSIDY = 0.44;

// Premium base rates (% of liability) for corn
const CORN_BASE_RATES: Record<number, number> = {
  0.50: 0.008,
  0.55: 0.011,
  0.60: 0.015,
  0.65: 0.021,
  0.70: 0.030,
  0.75: 0.042,
  0.80: 0.060,
  0.85: 0.085,
};

const UNIT_MULTIPLIERS: Record<UnitStructure, number> = {
  Basic: 1.0,
  Optional: 0.85,
  Enterprise: 0.65,
};

export function getBaseRate(crop: CropType, coverageLevel: number): number {
  const cornRate = CORN_BASE_RATES[Math.round(coverageLevel * 100) / 100] ?? 0.030;
  return crop === 'soybeans' ? cornRate * 0.9 : cornRate;
}

export function getPlanMultiplier(planType: PlanType): number {
  if (planType === 'RP') return 1.15;
  if (planType === 'RP-HPE') return 1.08;
  return 1.0; // YP
}

export function calcGuaranteedRevenue(inputs: InsuranceInputs): number {
  const { aphYield, coverageLevel, springPrice, planType } = inputs;
  if (planType === 'YP') {
    return aphYield * coverageLevel; // guaranteed yield in bu/ac
  }
  return aphYield * coverageLevel * springPrice;
}

export function calcPremiumPerAcre(inputs: InsuranceInputs): number {
  // Returns farmer cost after RMA subsidy (not gross premium)
  return calcFarmerPremiumPerAcre(inputs);
}

export function calcMaxIndemnityPerAcre(inputs: InsuranceInputs): number {
  return calcGuaranteedRevenue(inputs);
}

export function calcBreakevenYield(inputs: InsuranceInputs): number {
  const { aphYield, coverageLevel, planType, springPrice } = inputs;
  if (planType === 'YP') {
    return aphYield * coverageLevel;
  }
  // RP/RP-HPE: breakeven yield when harvest price = spring price
  return aphYield * coverageLevel;
}

export function calcIndemnityRP(
  guaranteedRevenue: number,
  actualYield: number,
  harvestPrice: number
): number {
  return Math.max(0, guaranteedRevenue - actualYield * harvestPrice);
}

export function calcIndemnityRPHPE(
  guaranteedRevenue: number,
  actualYield: number,
  harvestPrice: number
): number {
  // RP-HPE: no harvest price increase benefit, use spring price floor
  return Math.max(0, guaranteedRevenue - actualYield * harvestPrice);
}

export function calcIndemnityYP(
  guaranteedYield: number,
  actualYield: number,
  springPrice: number
): number {
  return Math.max(0, (guaranteedYield - actualYield) * springPrice);
}

export function calcIndemnity(
  inputs: InsuranceInputs,
  actualYield: number,
  harvestPrice: number
): number {
  const guaranteed = calcGuaranteedRevenue(inputs);
  if (inputs.planType === 'YP') {
    return calcIndemnityYP(guaranteed, actualYield, inputs.springPrice);
  }
  if (inputs.planType === 'RP') {
    // RP: guarantee adjusts UP when harvest > spring (price rally protection)
    // Guarantee = APH × cov% × max(spring, harvest)
    // Indemnity  = max(0, Guarantee - actualYield × harvestPrice)
    const rpGuarantee = inputs.aphYield * inputs.coverageLevel * Math.max(harvestPrice, inputs.springPrice);
    return Math.max(0, rpGuarantee - actualYield * harvestPrice);
  }
  // RP-HPE: no harvest price upside — guarantee locked to spring price
  return Math.max(0, guaranteed - actualYield * harvestPrice);
}

/**
 * Returns the RP guarantee adjusted to the given harvest price.
 * Use this to show "what is my guarantee worth right now?" mid-season.
 */
export function calcRPGuaranteeAtPrice(inputs: InsuranceInputs, harvestPrice: number): number {
  return inputs.aphYield * inputs.coverageLevel * Math.max(inputs.springPrice, harvestPrice);
}

// ─── RMA Subsidy Schedule ────────────────────────────────────────────────────
// Source: USDA RMA — farmer pays (1 - subsidy%) of gross premium
export const RMA_SUBSIDY_SCHEDULE: Record<number, number> = {
  0.50: 0.67,
  0.55: 0.64,
  0.60: 0.64,
  0.65: 0.59,
  0.70: 0.59,
  0.75: 0.55,
  0.80: 0.48,
  0.85: 0.38,
};

export function getFarmerSubsidyPct(coverageLevel: number): number {
  const key = Math.round(coverageLevel * 100) / 100;
  return RMA_SUBSIDY_SCHEDULE[key] ?? 0.55;
}

export function calcGrossPremiumPerAcre(inputs: InsuranceInputs): number {
  const { crop, aphYield, coverageLevel, planType, unitStructure, springPrice } = inputs;
  const baseRate = getBaseRate(crop, coverageLevel);
  const planMult = getPlanMultiplier(planType);
  const unitMult = UNIT_MULTIPLIERS[unitStructure];
  const liability = aphYield * springPrice;
  return liability * baseRate * planMult * unitMult;
}

export function calcFarmerPremiumPerAcre(inputs: InsuranceInputs): number {
  const gross = calcGrossPremiumPerAcre(inputs);
  const subsidyPct = getFarmerSubsidyPct(inputs.coverageLevel);
  return gross * (1 - subsidyPct);
}

export function calcGovtSubsidyPerAcre(inputs: InsuranceInputs): number {
  const gross = calcGrossPremiumPerAcre(inputs);
  const subsidyPct = getFarmerSubsidyPct(inputs.coverageLevel);
  return gross * subsidyPct;
}

/*
 * ─── Test Cases (verified) ───────────────────────────────────────────────────
 * RP: spring=$4.50, harvest=$5.50, APH=180, cov=75%, actual=100 bu/ac
 *   guarantee = 180 × 0.75 × max(4.50,5.50) = 180 × 0.75 × 5.50 = $742.50
 *   revenue   = 100 × 5.50 = $550.00
 *   indemnity = max(0, 742.50 - 550.00) = $192.50/ac  ✓
 *
 * RP: spring=$4.50, harvest=$3.50, APH=180, cov=75%, actual=100 bu/ac
 *   guarantee = 180 × 0.75 × max(4.50,3.50) = 180 × 0.75 × 4.50 = $607.50
 *   revenue   = 100 × 3.50 = $350.00
 *   indemnity = max(0, 607.50 - 350.00) = $257.50/ac  ✓
 *
 * YP: spring=$4.50, APH=180, cov=75%, actual=100 bu/ac
 *   guaranteed yield = 180 × 0.75 = 135 bu/ac
 *   indemnity = (135 - 100) × 4.50 = 35 × 4.50 = $157.50/ac  ✓
 * ────────────────────────────────────────────────────────────────────────────
 */

// Generate heatmap data
export interface HeatmapCell {
  price: number;
  yieldPct: number; // as fraction of APH (0.4 to 1.2)
  actualYield: number;
  indemnity: number;
}

export function generateHeatmap(inputs: InsuranceInputs): HeatmapCell[] {
  const { crop, aphYield } = inputs;
  const prices = crop === 'corn'
    ? [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0]
    : [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
  const yieldPcts = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2];

  const cells: HeatmapCell[] = [];
  for (const yPct of yieldPcts) {
    for (const price of prices) {
      const actualYield = aphYield * yPct;
      const indemnity = calcIndemnity(inputs, actualYield, price);
      cells.push({ price, yieldPct: yPct, actualYield, indemnity });
    }
  }
  return cells;
}

export function getHeatmapColor(indemnity: number, maxIndemnity: number): string {
  if (indemnity === 0) return 'bg-slate-700';
  const ratio = indemnity / maxIndemnity;
  if (ratio < 0.25) return 'bg-yellow-500';
  if (ratio < 0.6) return 'bg-orange-500';
  return 'bg-red-500';
}

// Backtest calculation
export interface BacktestYear {
  year: number;
  countyYield: number;
  projPrice: number;
  harvPrice: number;
  premium: number;
  indemnity: number;
  net: number; // indemnity - premium
  triggered: boolean;
}

export function runBacktest(
  inputs: InsuranceInputs,
  countyYields: number[],
  projPrices: number[],
  harvPrices: number[],
  startYear = 2009
): BacktestYear[] {
  return countyYields.map((countyYield, i) => {
    const year = startYear + i;
    const projPrice = projPrices[i] ?? inputs.springPrice;
    const harvPrice = harvPrices[i] ?? inputs.springPrice;

    // Use historical prices for simulation
    const simInputs: InsuranceInputs = { ...inputs, springPrice: projPrice };
    const guaranteed = calcGuaranteedRevenue(simInputs);
    const premium = calcPremiumPerAcre(simInputs);
    const indemnity = calcIndemnity(simInputs, countyYield, harvPrice);
    const triggered = indemnity > 0;

    return {
      year,
      countyYield,
      projPrice,
      harvPrice,
      premium,
      indemnity,
      net: indemnity - premium,
      triggered,
    };
  });
}

export interface BacktestSummary {
  triggerCount: number;
  totalYears: number;
  avgPremium: number;
  avgIndemnity: number;
  netPerYear: number;
  worthIt: 'YES ✓' | 'MARGINAL' | 'BREAK EVEN';
  triggerRate: number;
}

export function summarizeBacktest(years: BacktestYear[]): BacktestSummary {
  const triggerCount = years.filter((y) => y.triggered).length;
  const avgPremium = years.reduce((s, y) => s + y.premium, 0) / years.length;
  const avgIndemnity = years.reduce((s, y) => s + y.indemnity, 0) / years.length;
  const netPerYear = avgIndemnity - avgPremium;
  const triggerRate = triggerCount / years.length;

  let worthIt: BacktestSummary['worthIt'];
  if (netPerYear > 1) worthIt = 'YES ✓';
  else if (netPerYear > -2) worthIt = 'BREAK EVEN';
  else worthIt = 'MARGINAL';

  return {
    triggerCount,
    totalYears: years.length,
    avgPremium,
    avgIndemnity,
    netPerYear,
    worthIt,
    triggerRate,
  };
}

// Plan comparison
export interface PlanComboRow {
  planType: PlanType;
  coverageLevel: number;
  premiumPerAcre: number;
  totalPremium: number;
  guaranteedRevenue: number;
  maxIndemnityPerAcre: number;
  breakevenYield: number;
  triggerRate: number;
  valueScore: number; // triggerRate / premiumPerAcre
}

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

export function buildComparisonTable(
  inputs: InsuranceInputs,
  countyYields: number[],
  projPrices: number[],
  harvPrices: number[]
): PlanComboRow[] {
  return PLAN_COMBOS.map(({ planType, coverageLevel }) => {
    const simInputs = { ...inputs, planType, coverageLevel };
    const premiumPerAcre = calcPremiumPerAcre(simInputs);
    const totalPremium = premiumPerAcre * inputs.acres;
    const guaranteedRevenue = calcGuaranteedRevenue(simInputs);
    const maxIndemnityPerAcre = guaranteedRevenue;
    const breakevenYield = calcBreakevenYield(simInputs);
    const years = runBacktest(simInputs, countyYields, projPrices, harvPrices);
    const { triggerRate } = summarizeBacktest(years);
    const valueScore = premiumPerAcre > 0 ? triggerRate / premiumPerAcre : 0;

    return {
      planType,
      coverageLevel,
      premiumPerAcre,
      totalPremium,
      guaranteedRevenue,
      maxIndemnityPerAcre,
      breakevenYield,
      triggerRate,
      valueScore,
    };
  });
}

// ─── SCO helpers ─────────────────────────────────────────────────────────────

/**
 * SCO covers the band between the underlying coverage level and 86%.
 * It triggers based on COUNTY yield index, not farm APH.
 * county_yield_index = actual_county_yield / county_APH
 * SCO triggers when county_yield_index < 0.86
 * SCO payment = (min(0.86, 1 - county_yield_index) - max(0, coverageLevel - county_yield_index)) × springPrice × aphYield
 * Simplified for display: band payment = max(0, min(SCO_TOP, 1) - max(countyYieldPct, coverageLevel)) × springPrice × aphYield
 */
export function calcSCOPremiumPerAcre(inputs: InsuranceInputs): number {
  if (!inputs.scoEnabled) return 0;
  const { coverageLevel, aphYield, springPrice } = inputs;
  const bandWidth = Math.max(0, SCO_TOP - coverageLevel);
  const bandLiability = bandWidth * aphYield * springPrice;
  const grossPremium = bandLiability * SCO_COUNTY_RATE;
  return grossPremium * (1 - SCO_SUBSIDY); // farmer's share
}

export function calcSCOIndemnity(
  inputs: InsuranceInputs,
  countyYieldPct: number // actual county yield / county APH (0 to 1+)
): number {
  if (!inputs.scoEnabled) return 0;
  const { coverageLevel, aphYield, springPrice } = inputs;
  // Payment = max(0, min(SCO_TOP, 1) - max(countyYieldPct, coverageLevel)) × spring_price × APH
  const paymentFactor = Math.max(
    0,
    Math.min(SCO_TOP, 1.0) - Math.max(countyYieldPct, coverageLevel)
  );
  return paymentFactor * aphYield * springPrice;
}

export function scoWouldTrigger(countyYieldPct: number): boolean {
  return countyYieldPct < SCO_TOP;
}

// ─── ECO helpers ─────────────────────────────────────────────────────────────

/**
 * ECO covers the band from 86% up to 90% or 95%.
 * Also county-level trigger.
 */
export function calcECOPremiumPerAcre(inputs: InsuranceInputs): number {
  if (inputs.ecoLevel === 'None') return 0;
  const { aphYield, springPrice, ecoLevel } = inputs;
  const top = ECO_TOP[ecoLevel];
  const bandWidth = Math.max(0, top - SCO_TOP);
  const bandLiability = bandWidth * aphYield * springPrice;
  const grossPremium = bandLiability * ECO_UNSUBSIDIZED_RATE[ecoLevel];
  return grossPremium * (1 - ECO_SUBSIDY); // farmer's share
}

export function calcECOIndemnity(
  inputs: InsuranceInputs,
  countyYieldPct: number
): number {
  if (inputs.ecoLevel === 'None') return 0;
  const { aphYield, springPrice, ecoLevel } = inputs;
  const top = ECO_TOP[ecoLevel];
  // Payment = max(0, min(top, 1) - max(countyYieldPct, SCO_TOP)) × spring_price × APH
  const paymentFactor = Math.max(
    0,
    Math.min(top, 1.0) - Math.max(countyYieldPct, SCO_TOP)
  );
  return paymentFactor * aphYield * springPrice;
}

export function ecoWouldTrigger(inputs: InsuranceInputs, countyYieldPct: number): boolean {
  if (inputs.ecoLevel === 'None') return false;
  return countyYieldPct < ECO_TOP[inputs.ecoLevel];
}

// ─── Total premium (underlying + SCO + ECO) ─────────────────────────────────

export function calcTotalPremiumPerAcre(inputs: InsuranceInputs): number {
  return (
    calcPremiumPerAcre(inputs) +
    calcSCOPremiumPerAcre(inputs) +
    calcECOPremiumPerAcre(inputs)
  );
}

export function calcCoverageStackLabel(inputs: InsuranceInputs): string {
  const base = `${inputs.planType} ${Math.round(inputs.coverageLevel * 100)}%`;
  const sco = inputs.scoEnabled ? '+ SCO' : '';
  const eco = inputs.ecoLevel !== 'None' ? `+ ${inputs.ecoLevel}` : '';
  const parts = [base, sco, eco].filter(Boolean);
  const topCoverage = inputs.ecoLevel !== 'None'
    ? ECO_TOP[inputs.ecoLevel] * 100
    : inputs.scoEnabled
    ? 86
    : inputs.coverageLevel * 100;
  return `${parts.join(' ')} = coverage up to ${topCoverage}% of county revenue`;
}

// ─── Extended backtest with SCO/ECO ─────────────────────────────────────────

export interface BacktestYearExtended extends BacktestYear {
  countyYieldPct: number;
  scoIndemnity: number;
  ecoIndemnity: number;
  totalIndemnity: number;
  totalPremium: number;
  totalNet: number;
  scoTriggered: boolean;
  ecoTriggered: boolean;
}

export function runBacktestExtended(
  inputs: InsuranceInputs,
  countyYields: number[],
  countyAph: number,
  projPrices: number[],
  harvPrices: number[],
  startYear = 2009
): BacktestYearExtended[] {
  return countyYields.map((countyYield, i) => {
    const year = startYear + i;
    const projPrice = projPrices[i] ?? inputs.springPrice;
    const harvPrice = harvPrices[i] ?? inputs.springPrice;

    const simInputs: InsuranceInputs = { ...inputs, springPrice: projPrice };
    const guaranteed = calcGuaranteedRevenue(simInputs);
    const premium = calcPremiumPerAcre(simInputs);
    const indemnity = calcIndemnity(simInputs, countyYield, harvPrice);
    const triggered = indemnity > 0;

    const countyYieldPct = countyYield / countyAph;
    const scoIndemnity = calcSCOIndemnity(simInputs, countyYieldPct);
    const ecoIndemnity = calcECOIndemnity(simInputs, countyYieldPct);
    const scoPremium = calcSCOPremiumPerAcre(simInputs);
    const ecoPremium = calcECOPremiumPerAcre(simInputs);

    const totalIndemnity = indemnity + scoIndemnity + ecoIndemnity;
    const totalPremium = premium + scoPremium + ecoPremium;
    const totalNet = totalIndemnity - totalPremium;

    return {
      year,
      countyYield,
      projPrice,
      harvPrice,
      premium,
      indemnity,
      net: indemnity - premium,
      triggered,
      countyYieldPct,
      scoIndemnity,
      ecoIndemnity,
      totalIndemnity,
      totalPremium,
      totalNet,
      scoTriggered: scoWouldTrigger(countyYieldPct),
      ecoTriggered: ecoWouldTrigger(simInputs, countyYieldPct),
    };
  });
}

export interface BacktestSummaryExtended extends BacktestSummary {
  scoTriggerCount: number;
  ecoTriggerCount: number;
  avgSCOIndemnity: number;
  avgECOIndemnity: number;
  avgTotalPremium: number;
  avgTotalIndemnity: number;
  totalNetPerYear: number;
  totalWorthIt: 'YES ✓' | 'MARGINAL' | 'BREAK EVEN';
}

export function summarizeBacktestExtended(
  years: BacktestYearExtended[]
): BacktestSummaryExtended {
  const base = summarizeBacktest(years);
  const n = years.length;
  const scoTriggerCount = years.filter((y) => y.scoTriggered).length;
  const ecoTriggerCount = years.filter((y) => y.ecoTriggered).length;
  const avgSCOIndemnity = years.reduce((s, y) => s + y.scoIndemnity, 0) / n;
  const avgECOIndemnity = years.reduce((s, y) => s + y.ecoIndemnity, 0) / n;
  const avgTotalPremium = years.reduce((s, y) => s + y.totalPremium, 0) / n;
  const avgTotalIndemnity = years.reduce((s, y) => s + y.totalIndemnity, 0) / n;
  const totalNetPerYear = avgTotalIndemnity - avgTotalPremium;

  let totalWorthIt: BacktestSummaryExtended['totalWorthIt'];
  if (totalNetPerYear > 1) totalWorthIt = 'YES ✓';
  else if (totalNetPerYear > -2) totalWorthIt = 'BREAK EVEN';
  else totalWorthIt = 'MARGINAL';

  return {
    ...base,
    scoTriggerCount,
    ecoTriggerCount,
    avgSCOIndemnity,
    avgECOIndemnity,
    avgTotalPremium,
    avgTotalIndemnity,
    totalNetPerYear,
    totalWorthIt,
  };
}

// ─── Plan comparison with SCO/ECO columns ────────────────────────────────────

export interface PlanComboRowExtended extends PlanComboRow {
  scoAddonCost: number;
  ecoAddonCost: number;
  totalPremiumPerAcre: number;
  scoTriggerRate: number;
  ecoTriggerRate: number;
}

export function buildComparisonTableExtended(
  inputs: InsuranceInputs,
  countyYields: number[],
  countyAph: number,
  projPrices: number[],
  harvPrices: number[]
): PlanComboRowExtended[] {
  return PLAN_COMBOS.map(({ planType, coverageLevel }) => {
    const simInputs: InsuranceInputs = { ...inputs, planType, coverageLevel };
    const premiumPerAcre = calcPremiumPerAcre(simInputs);
    const scoAddonCost = calcSCOPremiumPerAcre(simInputs);
    const ecoAddonCost = calcECOPremiumPerAcre(simInputs);
    const totalPremiumPerAcre = premiumPerAcre + scoAddonCost + ecoAddonCost;
    const totalPremium = totalPremiumPerAcre * inputs.acres;
    const guaranteedRevenue = calcGuaranteedRevenue(simInputs);
    const maxIndemnityPerAcre = guaranteedRevenue;
    const breakevenYield = calcBreakevenYield(simInputs);
    const years = runBacktestExtended(simInputs, countyYields, countyAph, projPrices, harvPrices);
    const summary = summarizeBacktestExtended(years);

    return {
      planType,
      coverageLevel,
      premiumPerAcre,
      totalPremium,
      guaranteedRevenue,
      maxIndemnityPerAcre,
      breakevenYield,
      triggerRate: summary.triggerRate,
      valueScore: premiumPerAcre > 0 ? summary.triggerRate / premiumPerAcre : 0,
      scoAddonCost,
      ecoAddonCost,
      totalPremiumPerAcre,
      scoTriggerRate: summary.scoTriggerCount / summary.totalYears,
      ecoTriggerRate: summary.ecoTriggerCount / summary.totalYears,
    };
  });
}
