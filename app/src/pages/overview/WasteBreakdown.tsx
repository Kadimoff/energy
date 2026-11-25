import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartSkeleton } from '@/components/common/Skeletons';
import type { WasteBar } from '@/domain/insights';
import { useT } from '@/i18n';
import { formatAzn, formatEnergy, formatM3, formatPct } from '@/lib/format';

const HATCH =
  'repeating-linear-gradient(135deg, rgb(var(--warning-rgb) / 0.75) 0 2px, rgb(var(--warning-rgb) / 0.35) 2px 5px)';

/** Horizontal 100 % bars per equipment group: production / waste / recoverable (spec 7.3). */
export function WasteBreakdown({ bars, money }: { bars?: WasteBar[]; money: boolean }) {
  const { t, tx } = useT('overview');
  if (!bars) return <ChartSkeleton height={280} />;
  const amount = (b: WasteBar, v: number) => (b.energy === 'gas' ? formatM3(v) : formatEnergy(v));
  return (
    <Card className="h-full">
      <CardHeader className="flex-wrap">
        <div>
          <CardTitle>{t('waste.title')}</CardTitle>
          <CardDescription>{t('waste.subtitle')}</CardDescription>
        </div>
        <ul
          className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2"
          aria-hidden="true"
        >
          <li className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-3.5 rounded-[3px] bg-violet-200" />
            {t('waste.productive')}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-3.5 rounded-[3px]" style={{ background: HATCH }} />
            {t('waste.waste')}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-3.5 rounded-[3px] bg-success" />
            {t('waste.recoverable')}
          </li>
        </ul>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {bars.map((b) => {
            const group = tx(`common:group.${b.group}`);
            return (
              <li
                key={b.group}
                className="grid grid-cols-[minmax(92px,0.9fr)_minmax(0,3fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[132px_minmax(0,1fr)_120px]"
              >
                <span className="truncate text-13 text-ink">{group}</span>
                <span
                  className="flex h-3 overflow-hidden rounded-full bg-bg-subtle"
                  role="img"
                  aria-label={t('waste.row', {
                    group,
                    productive: amount(b, b.productive),
                    waste: amount(b, b.waste),
                    recoverable: amount(b, b.recoverable),
                  })}
                >
                  <span
                    className="h-full bg-violet-200"
                    style={{ width: `${b.productiveShare * 100}%` }}
                  />
                  <span
                    className="h-full"
                    style={{ width: `${b.unrecoverableShare * 100}%`, background: HATCH }}
                  />
                  <span
                    className="h-full bg-success"
                    style={{ width: `${b.recoverableShare * 100}%` }}
                  />
                </span>
                <span className="text-right text-13 tabular-nums">
                  <span className="font-semibold text-ink">
                    {money ? formatAzn(b.wasteAzn) : amount(b, b.waste)}
                  </span>
                  <span className="block text-xs text-ink-3">
                    {t('waste.share', { pct: formatPct(b.wasteShare * 100, 1) })}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        <Link
          to="/equipment"
          className="mt-5 inline-block text-13 font-medium text-violet-700 hover:underline"
        >
          {t('waste.more')}
        </Link>
      </CardContent>
    </Card>
  );
}
