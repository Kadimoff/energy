import {
  Activity,
  BadgeCheck,
  Factory,
  FileText,
  LayoutDashboard,
  Leaf,
  Settings,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

export type NavKey =
  | 'overview'
  | 'live'
  | 'equipment'
  | 'decisions'
  | 'anomalies'
  | 'forecast'
  | 'carbon'
  | 'mv'
  | 'reports'
  | 'settings';

export interface NavItem {
  key: NavKey;
  path: string;
  icon: LucideIcon;
  /** shown in the mobile bottom bar (others go to "Daha çox") */
  mobile?: boolean;
}

/** Spec 7.2 navigation order. Labels: i18n layout.json nav.<key>. */
export const NAV_ITEMS: NavItem[] = [
  { key: 'overview', path: '/', icon: LayoutDashboard, mobile: true },
  { key: 'live', path: '/live', icon: Activity, mobile: true },
  { key: 'equipment', path: '/equipment', icon: Factory },
  { key: 'decisions', path: '/decisions', icon: Sparkles, mobile: true },
  { key: 'anomalies', path: '/anomalies', icon: TriangleAlert, mobile: true },
  { key: 'forecast', path: '/forecast', icon: TrendingUp },
  { key: 'carbon', path: '/carbon', icon: Leaf },
  { key: 'mv', path: '/mv', icon: BadgeCheck },
  { key: 'reports', path: '/reports', icon: FileText },
  { key: 'settings', path: '/settings', icon: Settings },
];
