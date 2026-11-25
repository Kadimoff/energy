import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, Database, GitBranch, LineChart } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

export interface WhyPanelProps {
  /** what data the conclusion is based on */
  data?: ReactNode;
  /** which rule fired */
  rule?: ReactNode;
  /** comparison chart or numbers */
  compare?: ReactNode;
  /** free content below the sections */
  children?: ReactNode;
  defaultOpen?: boolean;
  /** button label, default "Niyə?" */
  label?: string;
  className?: string;
}

/** Expandable "Niyə?" explanation for AI decisions and anomalies (spec 6.4). */
export function WhyPanel({
  data,
  rule,
  compare,
  children,
  defaultOpen = false,
  label,
  className,
}: WhyPanelProps) {
  const { t } = useT();
  const [open, setOpen] = useState(defaultOpen);
  const reduce = useReducedMotion();
  const id = useId();
  const sections = [
    { icon: Database, title: t('ai.whyData'), body: data },
    { icon: GitBranch, title: t('ai.whyRule'), body: rule },
    { icon: LineChart, title: t('ai.whyCompare'), body: compare },
  ].filter((s) => s.body);
  return (
    <div className={cn('text-sm', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-13 font-medium text-violet-700 transition-colors hover:bg-violet-50"
      >
        {label ?? t('ai.why')}
        <ChevronDown
          className={cn(
            'size-4 transition-transform duration-180 ease-standard',
            open && 'rotate-180',
          )}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            key="why"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-3 rounded-md border border-violet-100 bg-violet-50/60 p-4">
              <p className="text-xs font-medium text-ink-3">{t('ai.whyTitle')}</p>
              {sections.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex gap-3">
                  <Icon
                    className="mt-0.5 size-4 shrink-0 text-violet-600"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-13 font-semibold text-ink">{title}</p>
                    <div className="text-13 text-ink-2">{body}</div>
                  </div>
                </div>
              ))}
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
