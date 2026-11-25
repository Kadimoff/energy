import {
  CircleAlert,
  CircleCheck,
  CircleDot,
  CirclePause,
  OctagonAlert,
  TriangleAlert,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import type { LiveStatus, Severity } from '@/data/types';

/**
 * Shared status vocabulary of the operations pages. A status is always
 * shown with colour AND icon AND text (spec 6.2: colour never alone).
 */

export interface StatusMeta {
  icon: LucideIcon;
  /** CSS colours for SVG drawings */
  stroke: string;
  fill: string;
  text: string;
  badge: 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'violet';
  dashed?: boolean;
}

export const LIVE_STATUS: Record<LiveStatus, StatusMeta> = {
  normal: {
    icon: CircleCheck,
    stroke: 'var(--success)',
    fill: 'var(--success-surface)',
    text: 'var(--success-text)',
    badge: 'success',
  },
  waste: {
    icon: TriangleAlert,
    stroke: 'var(--warning)',
    fill: 'var(--warning-surface)',
    text: 'var(--warning-text)',
    badge: 'warning',
  },
  stopped: {
    icon: CirclePause,
    stroke: 'var(--border-strong)',
    fill: 'var(--bg-subtle)',
    text: 'var(--text-3)',
    badge: 'neutral',
  },
  offline: {
    icon: WifiOff,
    stroke: 'var(--danger)',
    fill: 'var(--surface)',
    text: 'var(--danger-text)',
    badge: 'danger',
    dashed: true,
  },
};

export const LIVE_STATUS_ORDER: LiveStatus[] = ['normal', 'waste', 'stopped', 'offline'];

export const SEVERITY_META: Record<
  Severity,
  { icon: LucideIcon; color: string; badge: StatusMeta['badge'] }
> = {
  critical: { icon: OctagonAlert, color: 'var(--danger)', badge: 'danger' },
  high: { icon: TriangleAlert, color: 'var(--warning)', badge: 'warning' },
  medium: { icon: CircleAlert, color: 'var(--info)', badge: 'info' },
  low: { icon: CircleDot, color: 'var(--chart-6)', badge: 'neutral' },
};
