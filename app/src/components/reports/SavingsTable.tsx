import { Badge } from '@/components/ui/badge';
import { useT } from '@/i18n';
import { formatAzn, formatKwh, formatPct } from '@/lib/format';
import type { SavingsBlock } from '@/services/ReportService';
import { SheetTable } from './sheet-ui';

/** M&V results table used by several report templates. */
export function SavingsTable({ savings }: { savings: SavingsBlock }) {
  const { t, tx } = useT('reports');
  const perMonth = t('common:units.perMonth');
  return (
    <>
      <SheetTable
        caption={t('em.mv')}
        rows={savings.items}
        rowKey={(m) => m.id}
        columns={[
          { key: 'm', header: t('director.colMeasure'), cell: (m) => tx(`common:measure.${m.id}`) },
          {
            key: 'o',
            header: t('em.colMethod'),
            className: 'whitespace-nowrap',
            cell: (m) => `Option ${m.method}`,
          },
          {
            key: 'e',
            header: t('em.colExpected'),
            align: 'right',
            cell: (m) => formatPct(m.expectedPct, 0),
          },
          {
            key: 'a',
            header: t('em.colAchieved'),
            align: 'right',
            cell: (m) => formatPct(m.savingPct, 1),
          },
          {
            key: 'k',
            header: t('em.colAvoided'),
            align: 'right',
            cell: (m) => `${formatKwh(m.avoidedPerMonthKwh)}${perMonth}`,
          },
          {
            key: 'ci',
            header: t('em.colCi'),
            align: 'right',
            cell: (m) => `±${formatKwh(m.ciKwh)}`,
          },
          {
            key: 's',
            header: t('director.colStatus'),
            cell: (m) => (
              <Badge
                variant={
                  m.status === 'verified'
                    ? 'success'
                    : m.status === 'below_expected'
                      ? 'warning'
                      : 'neutral'
                }
                className="px-1.5 py-0 text-[11px]"
              >
                {tx(`common:mvStatus.${m.status}`)}
              </Badge>
            ),
          },
        ]}
      />
      <p className="mt-1.5 text-xs text-ink-2">
        {t('em.mvTotal', {
          month: `${formatAzn(savings.verifiedPerMonthAzn)}${perMonth}`,
          cum: formatAzn(savings.cumulativeAzn),
        })}
      </p>
    </>
  );
}
