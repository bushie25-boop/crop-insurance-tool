// quoteUtils.ts — Quote generation utilities
import type { PlanType, ECOLevel, UnitStructure, CropType } from './insurance';
import {
  calcPremiumPerAcre,
  calcSCOPremiumPerAcre,
  calcECOPremiumPerAcre,
  calcGuaranteedRevenue,
  calcMaxIndemnityPerAcre,
  calcCoverageStackLabel,
} from './insurance';

export interface QuoteField {
  id: string;
  fieldName: string;
  acres: number;
  crop: CropType;
  aphYield: number;
  coverageLevel: number;
  planType: PlanType;
  unitStructure: UnitStructure;
  scoEnabled: boolean;
  ecoLevel: ECOLevel;
  springPrice: number;
  county: string;
}

export interface Quote {
  quoteNumber: string;
  quoteDate: string;
  farmerName: string;
  farmName: string;
  address: string;
  preparedBy: string;
  fields: QuoteField[];
}

export interface QuoteLineItem {
  label: string;
  premiumPerAcre: number;
  totalPremium: number;
  guaranteedRevenue: number;
  maxIndemnityPerAcre: number;
  stackLabel: string;
  scoAddon: number;
  ecoAddon: number;
}

export function computeQuoteLine(field: QuoteField): QuoteLineItem {
  const ins = {
    crop: field.crop,
    county: field.county as any,
    aphYield: field.aphYield,
    acres: field.acres,
    unitStructure: field.unitStructure,
    coverageLevel: field.coverageLevel,
    planType: field.planType,
    springPrice: field.springPrice,
    scoEnabled: field.scoEnabled,
    ecoLevel: field.ecoLevel,
  };
  const basePremium = calcPremiumPerAcre(ins);
  const scoAddon = calcSCOPremiumPerAcre(ins);
  const ecoAddon = calcECOPremiumPerAcre(ins);
  const premiumPerAcre = basePremium + scoAddon + ecoAddon;
  return {
    label: field.fieldName,
    premiumPerAcre,
    totalPremium: premiumPerAcre * field.acres,
    guaranteedRevenue: calcGuaranteedRevenue(ins),
    maxIndemnityPerAcre: calcMaxIndemnityPerAcre(ins),
    stackLabel: calcCoverageStackLabel(ins),
    scoAddon,
    ecoAddon,
  };
}

export function generateQuoteNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const r = Math.floor(Math.random() * 9000 + 1000);
  return `BB${y}${m}${d}-${r}`;
}

export function todayStr(): string {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

const STORAGE_KEY = 'bb-quote-history';

export function saveQuote(quote: Quote): void {
  const existing = loadQuoteHistory();
  const updated = [quote, ...existing.filter(q => q.quoteNumber !== quote.quoteNumber)].slice(0, 20);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function loadQuoteHistory(): Quote[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Quote[];
  } catch {
    return [];
  }
}

export function deleteQuote(quoteNumber: string): void {
  const existing = loadQuoteHistory();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.filter(q => q.quoteNumber !== quoteNumber)));
}
