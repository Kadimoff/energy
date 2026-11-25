import { Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SourceTooltip } from '@/components/common/SourceTooltip';
import { ChartSkeleton } from '@/components/common/Skeletons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { baseConfig } from '@/data/config';
import type { CarbonSnapshot } from '@/domain/insights';
import { useT } from '@/i18n';
import { formatNumber, formatPct, formatTCo2 } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useRates } from '@/stores/derived';

const R = 42;
const C = 2 * Math.PI * R;

/** Carbon mini panel (spec 7.3): Scope 1/2 donut + annual target progress. */
export function CarbonMini({ snap, pendingT }: { snap?: CarbonSnapshot; pendingT?: number }) {
  const { t } = useT('overview');
  const rates = useRates();
  if (!snap) return <ChartSkeleton height={240} />;
  const s2Share = snap.ytdTotalT > 0 ? snap.ytdScope2T / snap.ytdTotalT : 0;
  const s1Share = 1 - s2Share;
  const em = baseConfig.emissions;
  const items = [
    {
      key: 's2',
      label: t('carbon.scope2'),
      value: snap.ytdScope2T,
      share: s2Share,
      color: 'var(--violet-600)',
      factor: `${formatNumber(rates.scope2KgCo2PerKwh, 2)} kq CO₂/kVt·saat`,
      meta: em.scope2,
    },
    {
      key: 's1',
      label: t('carbon.scope1'),
      value: snap.ytdScope1T,
      share: s1Share,
      color: 'var(--chart-3)',
      factor: `${formatNumber(rates.scope1KgCo2PerKwh, 3)} kq CO₂/kVt·saat`,
      meta: em.scope1,
    },
  ];
  const usedPct = Math.min(100, snap.usedShare * 100);
  const elapsedPct = Math.min(100, snap.elapsedShare * 100);
  return (
    <Card className="h-full">
      <CardHeader>
        <div>
          <CardTitle>{t('carbon.title')}</CardTitle>
          <CardDescription>{t('carbon.subtitle', { year: snap.year })}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid items-center gap-x-10 gap-y-5 md:grid-cols-2 xl:grid-cols-1">
          <div className="flex items-center gap-5">
            <div
              className="relative m-0 size-[112px] shrink-0"
              role="img"
              aria-label={`${t('carbon.donut')}: ${items.map((i) => `${i.label} ${formatTCo2(i.value, 0)}`).join(', ')}`}
            >
              <svg viewBox="0 0 100 100" className="size-full -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  stroke="var(--chart-3)"
                  strokeWidth="12"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  stroke="var(--violet-600)"
                  strokeWidth="12"
                  strokeDasharray={`${s2Share * C} ${C}`}
                />
              </svg>
              <figcaption className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-lg font-semibold leading-none tabular-nums text-ink">
                  {formatNumber(snap.ytdTotalT, 0)}
                </span>
                <span className="mt-1 text-[11px] leading-none text-ink-3">t CO₂e</span>
              </figcaption>
            </div>
            <ul className="min-w-0 flex-1 space-y-2.5">
              {items.map((i) => (
                <li key={i.key} className="text-13">
                  <span className="flex items-center gap-1.5 text-ink-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: i.color }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{i.label}</span>
                    <SourceTooltip
                      label={i.label}
                      value={i.factor}
                      source={i.meta.source}
                      date={i.meta.date}
                      lastChecked={i.meta.lastChecked}
                      verify={i.meta.verify}
                    />
                  </span>
                  <span className="ml-4 block font-semibold tabular-nums text-ink">
                    {formatTCo2(i.value, 0)}{' '}
                    <span className="font-normal text-ink-3">· {formatPct(i.share * 100)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="flex items-baseline justify-between text-13">
              <span className="text-ink-2">
                {t('carbon.target', { target: formatTCo2(snap.annualTargetT, 0) })}
              </span>
              <span className="font-semibold tabular-nums text-ink">
                {formatPct(snap.usedShare * 100)}
              </span>
            </div>
            <div className="relative mt-2 h-2 rounded-full bg-violet-50 ring-1 ring-inset ring-border">
              <div
                className={cn(
                  'absolute inset-y-0 left-0 rounded-full',
                  snap.onTrack ? 'bg-success' : 'bg-warning',
                )}
                style={{ width: `${usedPct}%` }}
              />
              <div
                className="absolute inset-y-[-4px] w-0.5 rounded bg-ink"
                style={{ left: `${elapsedPct}%` }}
                aria-hidden="true"
              />
            </div>
            <p className="mt-2 text-xs text-ink-3">
              {t('carbon.progress', {
                used: formatPct(snap.usedShare * 100),
                elapsed: formatPct(snap.elapsedShare * 100),
              })}
            </p>
            <p
              className={cn(
                'mt-1 text-xs font-medium',
                snap.onTrack ? 'text-success-text' : 'text-warning-text',
              )}
            >
              {snap.onTrack
                ? t('carbon.onTrack', { projected: formatTCo2(snap.projectedYearT, 0) })
                : t('carbon.offTrack', {
                    projected: formatTCo2(snap.projectedYearT, 0),
                    gap: formatTCo2(snap.overTargetT, 0),
                  })}
            </p>
          </div>
        </div>
        {pendingT !== undefined && pendingT > 0 && (
          <p className="mt-5 flex items-center gap-2 rounded-md bg-violet-50 px-3 py-2.5 text-13 text-ink-2">
            <Sparkles
              className="size-4 shrink-0 text-violet-600"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            {t('carbon.pending', { t: formatTCo2(pendingT, 0) })}
          </p>
        )}
        <Link
          to="/carbon"
          className="mt-4 inline-block text-13 font-medium text-violet-700 hover:underline"
        >
          {t('carbon.more')}
        </Link>
      </CardContent>
    </Card>
  );
}
