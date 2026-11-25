import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useT } from '@/i18n';
import { formatAzn } from '@/lib/format';
import { useBudgetHero } from '@/stores/coreViews';
import { useDecisionNotice } from './notice';

interface Shown {
  seq: number;
  recId: string;
  status: string;
  before: number | undefined;
  after: number | undefined;
}

/**
 * Polite live notice after a decision: what changed and how the month-end
 * forecast moved (before / after both come from the forecast view model).
 */
export function DecisionNotice() {
  const { t, tx } = useT('decisions');
  const notice = useDecisionNotice((s) => s.notice);
  const clear = useDecisionNotice((s) => s.clear);
  const cost = useBudgetHero()?.forecastAzn;
  const reduce = useReducedMotion();
  const [last, setLast] = useState(cost);
  const [shown, setShown] = useState<Shown | null>(null);

  // derive "before" from the value of the previous render (React state pattern)
  if (notice && notice.seq !== shown?.seq) {
    setShown({ ...notice, before: last, after: cost });
    setLast(cost);
  } else if (cost !== last) {
    if (shown) setShown({ ...shown, after: cost });
    setLast(cost);
  }

  useEffect(() => {
    if (!shown) return;
    const id = window.setTimeout(() => {
      setShown(null);
      clear();
    }, 6500);
    return () => window.clearTimeout(id);
  }, [shown, clear]);

  const visible = shown && notice && shown.seq === notice.seq;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 md:bottom-6"
    >
      <AnimatePresence>
        {visible && (
          <motion.div
            key={shown.seq}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            role="status"
            className="pointer-events-auto flex max-w-lg items-start gap-3 rounded-md border border-border bg-surface px-4 py-3 shadow-lg"
          >
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0 text-success"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <div className="min-w-0 text-13">
              <p className="font-semibold text-ink">
                {tx(`notice.${shown.status}`, { title: tx(`common:rec.title.${shown.recId}`) })}
              </p>
              {shown.before !== undefined && shown.after !== undefined && (
                <p className="mt-0.5 tabular-nums text-ink-2">
                  {t('notice.forecast', {
                    before: formatAzn(shown.before),
                    after: formatAzn(shown.after),
                  })}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setShown(null);
                clear();
              }}
              aria-label={t('notice.dismiss')}
              className="rounded-sm p-0.5 text-ink-3 hover:bg-violet-50 hover:text-ink"
            >
              <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
