// subsidySchedule.ts — Post-OBBBA subsidy tables
// Source: RMA Manager's Bulletin MGR-25-006, August 20, 2025
// Effective: All crops with sales closing date on or after July 1, 2025 (2026 crop year)

export type UnitStructure = 'Basic' | 'Optional' | 'Enterprise';

// Basic Unit and Optional Unit share the same subsidy rates
export const SUBSIDY_BU_OU: Record<number, number> = {
  0.50: 0.67,
  0.55: 0.69,
  0.60: 0.69,
  0.65: 0.64,
  0.70: 0.64,
  0.75: 0.60,
  0.80: 0.51,
  0.85: 0.41,
};

export const SUBSIDY_EU: Record<number, number> = {
  0.50: 0.80,
  0.55: 0.80,
  0.60: 0.80,
  0.65: 0.80,
  0.70: 0.80,
  0.75: 0.80,
  0.80: 0.71,
  0.85: 0.56,
};

// SCO and ECO — post-OBBBA (was 0.65, increased +15 pts)
export const SCO_ECO_SUBSIDY = 0.80;

export function getSubsidyPct(coverageLevel: number, unitStructure: UnitStructure): number {
  const key = Math.round(coverageLevel * 100) / 100;
  if (unitStructure === 'Enterprise') {
    return SUBSIDY_EU[key] ?? 0.80;
  }
  return SUBSIDY_BU_OU[key] ?? 0.64;
}

// BFR (Beginning Farmer & Rancher) additional subsidy — post-OBBBA (10-year window)
// Year 1-4: +5%, Year 5: +3%, Year 6-10: +1%
export function getBFRAdditionalSubsidy(yearsInFarming: number): number {
  if (yearsInFarming <= 0) return 0;
  if (yearsInFarming <= 4) return 0.05;
  if (yearsInFarming === 5) return 0.03;
  if (yearsInFarming <= 10) return 0.01;
  return 0;
}

// OBBBA changes reference
export const OBBBA_CHANGES = [
  {
    id: 1,
    title: 'ARC farmers can now buy SCO',
    detail: 'Previously blocked if enrolled in ARC at FSA. Now available regardless of FSA program election. A major change for the region.',
  },
  {
    id: 2,
    title: 'SCO/ECO subsidy increased to 80%',
    detail: 'Was 65%. Now 80% — a 15-point improvement. Farmer net cost for SCO dropped from 35% to 20% of gross premium.',
  },
  {
    id: 3,
    title: 'Underlying subsidies increased 3–5 pts',
    detail: 'Coverage levels 55–75% got +5 pts; 80–85% got +3 pts. Enterprise Unit saw +3% improvement at 75–85%.',
  },
  {
    id: 4,
    title: 'ECO provides 90% coverage in 2026',
    detail: 'ECO-90 allows access to the new 90% upper limit one year early. SCO itself formally expands to 90% in 2027.',
  },
  {
    id: 5,
    title: 'Prevented planting buyup cut from 10% to 5%',
    detail: 'The optional PP buyup was reduced. Relevant for flood-prone or low-lying ground.',
  },
  {
    id: 6,
    title: 'BFR definition expanded to 10 years',
    detail: 'Was 5 years. Farmers with 6–9 years experience may now qualify for BFR premium subsidies. Application deadline: March 15, 2026.',
  },
  {
    id: 7,
    title: 'WFRP maximum coverage raised to 90%',
    detail: 'Whole-Farm Revenue Protection (diversified operations) can now go to 90% coverage. Was 85%.',
  },
];
