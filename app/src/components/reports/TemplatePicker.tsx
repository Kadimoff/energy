import { FileBarChart, Gauge, Leaf, ShieldCheck, type LucideIcon } from 'lucide-react';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { REPORT_TEMPLATES, type ReportTemplateId } from '@/services/ReportService.schedule';

const ICONS: Record<ReportTemplateId, LucideIcon> = {
  director: FileBarChart,
  energy_manager: Gauge,
  carbon: Leaf,
  iso50001: ShieldCheck,
};

/** Template choice as a native radio group (arrow keys move between options). */
export function TemplatePicker({
  value,
  onChange,
}: {
  value: ReportTemplateId;
  onChange: (v: ReportTemplateId) => void;
}) {
  const { t, tx } = useT('reports');
  return (
    <fieldset>
      <legend className="mb-2 text-13 font-semibold text-ink">{t('picker.template')}</legend>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {REPORT_TEMPLATES.map((id) => {
          const Icon = ICONS[id];
          const active = id === value;
          return (
            <label
              key={id}
              className={cn(
                'relative flex cursor-pointer gap-3 rounded-md border p-3 transition-[border-color,background-color,box-shadow] duration-180 ease-standard has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet-600 has-[:focus-visible]:ring-offset-2',
                active
                  ? 'border-violet-300 bg-violet-50 shadow-sm'
                  : 'border-border bg-surface hover:border-border-strong hover:bg-bg-subtle',
              )}
            >
              <input
                type="radio"
                name="report-template"
                value={id}
                checked={active}
                onChange={() => onChange(id)}
                className="sr-only"
              />
              <span
                className={cn(
                  'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-sm',
                  active ? 'bg-violet-600 text-white' : 'bg-bg-subtle text-ink-2',
                )}
              >
                <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">
                  {tx(`template.${id}.title`)}
                </span>
                <span className="mt-0.5 block text-xs leading-[18px] text-ink-2">
                  {tx(`template.${id}.desc`)}
                </span>
                <span className="mt-1 block text-xs text-ink-3">
                  {tx(`template.${id}.audience`)} · {tx(`template.${id}.pages`)}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
