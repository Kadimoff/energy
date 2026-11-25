import {
  CircleAlert,
  CircleCheck,
  CircleDot,
  CircleSlash,
  Search,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { LineChart as LineIcon, Table2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AnomalyStatus, LiveStatus, Severity } from '@/data/types';
import type { EquipmentRow } from '@/domain/viewmodels';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { LIVE_STATUS, SEVERITY_META, type StatusMeta } from './statusMeta';

export function LiveStatusBadge({ status, className }: { status: LiveStatus; className?: string }) {
  const { t } = useT('live');
  const m = LIVE_STATUS[status];
  const Icon = m.icon;
  return (
    <Badge variant={m.badge} className={className}>
      <Icon aria-hidden="true" />
      {t(`status.${status}`)}
    </Badge>
  );
}

const ROW_STATUS: Record<EquipmentRow['status'], { icon: LucideIcon; badge: StatusMeta['badge'] }> =
  {
    normal: { icon: CircleCheck, badge: 'success' },
    waste: { icon: TriangleAlert, badge: 'warning' },
    attention: { icon: CircleAlert, badge: 'info' },
  };

export function EquipmentStatusBadge({
  status,
  className,
}: {
  status: EquipmentRow['status'];
  className?: string;
}) {
  const { t } = useT('equipment');
  const m = ROW_STATUS[status];
  const Icon = m.icon;
  return (
    <Badge variant={m.badge} className={className}>
      <Icon aria-hidden="true" />
      {t(`status.${status}`)}
    </Badge>
  );
}

/** "Cədvəl kimi bax" / "Qrafik kimi bax" toggle used by every custom chart. */
export function ViewAsTableButton({
  asTable,
  onToggle,
  className,
}: {
  asTable: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const { t } = useT();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      aria-pressed={asTable}
      className={cn('shrink-0', className)}
    >
      {asTable ? <LineIcon aria-hidden="true" /> : <Table2 aria-hidden="true" />}
      {asTable ? t('chart.viewChart') : t('chart.viewTable')}
    </Button>
  );
}

/** Health score: number, 5-step bar and level text (never colour only). */
export function HealthScore({
  value,
  compact,
  className,
}: {
  value: number;
  compact?: boolean;
  className?: string;
}) {
  const { t } = useT('equipment');
  const level = value >= 80 ? 'good' : value >= 60 ? 'fair' : 'poor';
  const color = level === 'good' ? 'bg-success' : level === 'fair' ? 'bg-warning' : 'bg-danger';
  const label = t(`health.${level}`);
  return (
    <span
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label={t('health.aria', { value, level: label })}
      className={cn('inline-flex items-center gap-2 tabular-nums', className)}
    >
      <span className="font-semibold text-ink">{value}</span>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-bg-subtle ring-1 ring-inset ring-border">
        <span className={cn('block h-full rounded-full', color)} style={{ width: `${value}%` }} />
      </span>
      {!compact && (
        <span
          className={cn(
            'text-xs',
            level === 'good'
              ? 'text-success-text'
              : level === 'fair'
                ? 'text-warning-text'
                : 'text-danger-text',
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const { tx } = useT();
  const m = SEVERITY_META[severity];
  const Icon = m.icon;
  return (
    <Badge variant={m.badge} className={className}>
      <Icon aria-hidden="true" />
      {tx(`severity.${severity}`)}
    </Badge>
  );
}

const ANOMALY_STATUS: Record<AnomalyStatus, { icon: LucideIcon; badge: StatusMeta['badge'] }> = {
  open: { icon: CircleDot, badge: 'violet' },
  investigating: { icon: Search, badge: 'info' },
  resolved: { icon: CircleCheck, badge: 'success' },
  false_alarm: { icon: CircleSlash, badge: 'neutral' },
};

export function AnomalyStatusBadge({
  status,
  className,
}: {
  status: AnomalyStatus;
  className?: string;
}) {
  const { tx } = useT();
  const m = ANOMALY_STATUS[status];
  const Icon = m.icon;
  return (
    <Badge variant={m.badge} className={className}>
      <Icon aria-hidden="true" />
      {tx(`anomalyStatus.${status}`)}
    </Badge>
  );
}
