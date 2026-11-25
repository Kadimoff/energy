import { ArrowRight, Factory, LineChart, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkline } from '@/components/charts/Sparkline';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n';
import type { CopilotReference } from '@/services/CopilotService';
import { useUiStore } from '@/stores/ui';
import { MiniBandChart } from './MiniBandChart';

const TONE = {
  violet: 'var(--violet-600)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  success: 'var(--success)',
} as const;

/** Reference card under a copilot answer: mini chart, equipment link or decision link. */
export function ReferenceCard({ r }: { r: CopilotReference }) {
  const { t } = useT('copilot');
  const close = useUiStore((s) => s.setCopilotOpen);
  const navigate = useNavigate();
  const box = 'rounded-md border border-border bg-surface p-3';
  switch (r.kind) {
    case 'band':
      return (
        <div className={box}>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-2">
            <LineChart className="size-3.5 text-ink-3" strokeWidth={1.75} aria-hidden="true" />
            {r.title}
          </p>
          <MiniBandChart points={r.points} label={r.title} />
          <p className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-ink-3" aria-hidden="true">
            <span className="inline-flex items-center gap-1">
              <span className="h-0.5 w-3 rounded bg-ink" />
              {t('common:chart.actual')}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-3 rounded-[2px] border border-violet-400 bg-violet-200/60" />
              {t('common:chart.optimalBand')}
            </span>
          </p>
        </div>
      );
    case 'spark':
      return (
        <div className={box}>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-2">
            <LineChart className="size-3.5 text-ink-3" strokeWidth={1.75} aria-hidden="true" />
            {r.title}
          </p>
          <Sparkline
            data={r.values}
            reference={r.reference}
            color={TONE[r.tone]}
            height={56}
            responsive
            ariaLabel={r.title}
          />
          <p className="mt-1.5 text-[11px] text-ink-3">{r.caption}</p>
        </div>
      );
    case 'equipment':
      return (
        <Link
          to={`/equipment/${r.id}`}
          onClick={() => close(false)}
          className="group flex items-center gap-3 rounded-md border border-border bg-surface p-3 transition-colors duration-180 hover:border-violet-200 hover:bg-violet-50/50"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-bg-subtle text-ink-2">
            <Factory className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-13 font-semibold text-ink">{r.name}</span>
            <span className="block text-xs text-ink-3">{r.detail}</span>
          </span>
          <span className="shrink-0 text-xs font-medium text-violet-700">
            {t('ui.openEquipment')}
          </span>
        </Link>
      );
    case 'decision':
      return (
        <div className="relative overflow-hidden rounded-md border border-border bg-surface p-3 pl-4">
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-ai" />
          <p className="flex items-start gap-1.5 text-13 font-semibold leading-snug text-ink">
            <Sparkles
              className="mt-0.5 size-3.5 shrink-0 text-violet-600"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            {r.title}
          </p>
          <p className="mt-0.5 pl-5 text-xs tabular-nums text-ink-2">{r.detail}</p>
          <Button
            size="sm"
            variant="subtle"
            className="ml-5 mt-2 h-7 px-2.5 text-xs"
            onClick={() => {
              close(false);
              navigate(`/decisions?rec=${r.recId}`);
            }}
          >
            {t('ui.openDecision')}
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      );
    case 'page':
      return (
        <Link
          to={r.to}
          onClick={() => close(false)}
          className="inline-flex items-center gap-1 text-13 font-medium text-violet-700 hover:underline"
        >
          {r.label}
          <ArrowRight className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
        </Link>
      );
  }
}
