import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Effort } from '@/data/types';
import {
  activeFilterCount,
  EMPTY_FILTERS,
  type DecisionFilters as Filters,
  type ImpactLevel,
  type StatusFilter,
} from '@/domain/decisions';
import type { RecommendationVM } from '@/domain/viewmodels';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

const STATUSES: StatusFilter[] = ['all', 'pending', 'active', 'rejected'];
const CATEGORIES: RecommendationVM['category'][] = [
  'schedule',
  'maintenance',
  'control',
  'peak',
  'investment',
];
const IMPACTS: ImpactLevel[] = ['high', 'medium', 'low'];
const EFFORTS: Effort[] = ['zero', 'low', 'invest'];

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'h-7 whitespace-nowrap rounded-sm border px-2.5 text-xs font-medium transition-colors duration-180',
        pressed
          ? 'border-violet-300 bg-violet-50 text-violet-700'
          : 'border-border bg-surface text-ink-2 hover:border-border-strong hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function DecisionFilters({
  value,
  onChange,
  shown,
}: {
  value: Filters;
  onChange: (f: Filters) => void;
  shown: number;
}) {
  const { t, tx } = useT('decisions');
  const n = activeFilterCount(value);
  return (
    <section aria-label={t('filters.label')} className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label={t('filters.status')}
          className="inline-flex max-w-full overflow-x-auto rounded-sm bg-bg-subtle p-0.5 ring-1 ring-inset ring-border"
        >
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={value.status === s}
              onClick={() => onChange({ ...value, status: s })}
              className={cn(
                'h-7 shrink-0 whitespace-nowrap rounded-[6px] px-2.5 text-13 font-medium transition-colors duration-180 sm:px-3',
                value.status === s ? 'bg-surface text-ink shadow-sm' : 'text-ink-2 hover:text-ink',
              )}
            >
              {tx(`filters.${s}`)}
            </button>
          ))}
        </div>
        <span className="text-xs text-ink-3" aria-live="polite">
          {t('filters.count', { count: shown })}
        </span>
        {n > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-7"
            onClick={() => onChange(EMPTY_FILTERS)}
          >
            <RotateCcw aria-hidden="true" />
            {t('filters.reset')}
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <fieldset className="flex flex-wrap items-center gap-1.5">
          <legend className="sr-only">{t('filters.category')}</legend>
          <span aria-hidden="true" className="mr-1 text-xs text-ink-3">
            {t('filters.category')}
          </span>
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              pressed={value.categories.includes(c)}
              onClick={() => onChange({ ...value, categories: toggle(value.categories, c) })}
            >
              {tx(`common:category.${c}`)}
            </Chip>
          ))}
        </fieldset>
        <fieldset className="flex flex-wrap items-center gap-1.5">
          <legend className="sr-only">{t('filters.impact')}</legend>
          <span aria-hidden="true" className="mr-1 text-xs text-ink-3">
            {t('filters.impact')}
          </span>
          {IMPACTS.map((c) => (
            <Chip
              key={c}
              pressed={value.impact.includes(c)}
              onClick={() => onChange({ ...value, impact: toggle(value.impact, c) })}
            >
              {tx(`filters.impactLevel.${c}`)}
            </Chip>
          ))}
        </fieldset>
        <fieldset className="flex flex-wrap items-center gap-1.5">
          <legend className="sr-only">{t('filters.effort')}</legend>
          <span aria-hidden="true" className="mr-1 text-xs text-ink-3">
            {t('filters.effort')}
          </span>
          {EFFORTS.map((c) => (
            <Chip
              key={c}
              pressed={value.effort.includes(c)}
              onClick={() => onChange({ ...value, effort: toggle(value.effort, c) })}
            >
              {tx(`common:effort.${c}`)}
            </Chip>
          ))}
        </fieldset>
      </div>
    </section>
  );
}
