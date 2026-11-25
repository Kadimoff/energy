export type ConfidenceLevel = 'high' | 'medium' | 'low';

/** 80+ high, 60–79 medium, below 60 low (spec 6.4). */
export function confidenceLevel(value: number): ConfidenceLevel {
  return value >= 80 ? 'high' : value >= 60 ? 'medium' : 'low';
}
