import type { Role } from '@/stores/ui';

/**
 * How the overview adapts to the role selector (spec 4): order of the KPI
 * cards, order of the sections and their level of detail.
 */
export type KpiKey = 'consumption' | 'cost' | 'enpi' | 'co2' | 'waste';
export type SectionKey = 'main' | 'breakdown' | 'anomalies';
export type SummaryPart = 'waste' | 'potential' | 'top' | 'anomalies' | 'equipment';

export interface RoleLayout {
  kpis: KpiKey[];
  sections: SectionKey[];
  summary: SummaryPart[];
  /** main chart opens in cumulative (budget) mode */
  cumulative: boolean;
  /** approve / schedule / reject buttons on pending decisions */
  decisionActions: boolean;
  /** side column next to the main chart */
  side: 'decisions' | 'live';
  /** money values in the waste breakdown (else energy units) */
  money: boolean;
  carbon: boolean;
  anomalyCount: number;
  /** anomaly rows show loss and equipment details */
  anomalyDetail: boolean;
}

export const ROLE_LAYOUT: Record<Role, RoleLayout> = {
  director: {
    kpis: ['cost', 'waste', 'co2', 'consumption', 'enpi'],
    sections: ['main', 'breakdown', 'anomalies'],
    summary: ['waste', 'potential', 'top'],
    cumulative: true,
    decisionActions: true,
    side: 'decisions',
    money: true,
    carbon: true,
    anomalyCount: 3,
    anomalyDetail: false,
  },
  energy_manager: {
    kpis: ['waste', 'enpi', 'consumption', 'cost', 'co2'],
    sections: ['main', 'breakdown', 'anomalies'],
    summary: ['waste', 'top', 'anomalies'],
    cumulative: false,
    decisionActions: true,
    side: 'decisions',
    money: true,
    carbon: true,
    anomalyCount: 5,
    anomalyDetail: true,
  },
  operator: {
    kpis: ['consumption', 'waste', 'enpi', 'co2', 'cost'],
    sections: ['anomalies', 'main', 'breakdown'],
    summary: ['anomalies', 'equipment', 'waste'],
    cumulative: false,
    decisionActions: false,
    side: 'live',
    money: false,
    carbon: false,
    anomalyCount: 5,
    anomalyDetail: true,
  },
};
