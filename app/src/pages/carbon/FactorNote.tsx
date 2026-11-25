import { SourceTooltip } from '@/components/common/SourceTooltip';
import { baseConfig } from '@/data/config';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { useFactorText, type FactorKind } from './hooks';

/** Source tooltip for one emission factor (spec 5.6: every CO₂ number shows its factor). */
export function FactorTooltip({ kind, className }: { kind: FactorKind; className?: string }) {
  const { tx } = useT('carbon');
  const text = useFactorText();
  const meta =
    kind === 'scope1'
      ? baseConfig.emissions.scope1
      : kind === 'scope2'
        ? baseConfig.emissions.scope2
        : baseConfig.emissions.gasKwhPerM3;
  return (
    <SourceTooltip
      label={tx(`factor.${kind}`)}
      value={text(kind)}
      source={meta.source}
      date={'date' in meta ? meta.date : null}
      lastChecked={meta.lastChecked}
      verify={meta.verify}
      className={className}
    />
  );
}

/** Inline "Scope 2 əmsalı 0,41 kq CO₂/kVt·saat ⓘ" note. */
export function FactorNote({
  kinds,
  short = false,
  className,
}: {
  kinds: FactorKind[];
  /** short names, value only in the tooltip (KPI cards) */
  short?: boolean;
  className?: string;
}) {
  const { tx } = useT('carbon');
  const text = useFactorText();
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-3 gap-y-1', className)}>
      {kinds.map((k) => (
        <span key={k} className="inline-flex items-center gap-0.5 whitespace-nowrap">
          <span className="text-ink-3">
            {tx(short ? `factorShort.${k}` : `factor.${k}`)}
            {!short && ':'}
          </span>
          {!short && <span className="ml-1 tabular-nums text-ink-2">{text(k)}</span>}
          <FactorTooltip kind={k} />
        </span>
      ))}
    </span>
  );
}
