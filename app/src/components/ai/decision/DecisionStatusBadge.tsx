import { CalendarClock, Check, CircleDashed, Gauge, Hammer, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { RecommendationStatus } from '@/data/types';
import { useT } from '@/i18n';

const MAP: Record<
  RecommendationStatus,
  { variant: 'neutral' | 'violet' | 'success' | 'warning' | 'danger' | 'info'; icon: typeof Check }
> = {
  proposed: { variant: 'violet', icon: CircleDashed },
  approved: { variant: 'success', icon: Check },
  scheduled: { variant: 'info', icon: CalendarClock },
  in_progress: { variant: 'info', icon: Hammer },
  measuring: { variant: 'warning', icon: Gauge },
  verified: { variant: 'success', icon: Check },
  rejected: { variant: 'neutral', icon: X },
};

/** Recommendation status chip (icon + text, never colour only). */
export function DecisionStatusBadge({ status }: { status: RecommendationStatus }) {
  const { tx } = useT();
  const m = MAP[status];
  const Icon = m.icon;
  return (
    <Badge variant={m.variant}>
      <Icon aria-hidden="true" />
      {tx(`recStatus.${status}`)}
    </Badge>
  );
}
