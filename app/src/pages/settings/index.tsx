import {
  Bell,
  Building2,
  Database,
  Leaf,
  Receipt,
  RotateCcw,
  Target,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { AlertSection } from '@/components/settings/AlertSection';
import { DataSourceSection } from '@/components/settings/DataSourceSection';
import { ImpactPreview } from '@/components/settings/ImpactPreview';
import {
  BudgetSection,
  EmissionSection,
  TargetSection,
  TariffSection,
} from '@/components/settings/MoneySections';
import { PlantSection } from '@/components/settings/PlantSection';
import { UsersSection } from '@/components/settings/UsersSection';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { useAdminStore } from '@/stores/admin';
import { useAnalysis } from '@/stores/derived';
import { useSettingsStore } from '@/stores/settings';

const SECTIONS = [
  { id: 'plant', icon: Building2 },
  { id: 'budget', icon: Wallet },
  { id: 'tariffs', icon: Receipt },
  { id: 'emissions', icon: Leaf },
  { id: 'targets', icon: Target },
  { id: 'alerts', icon: Bell },
  { id: 'sources', icon: Database },
  { id: 'users', icon: Users },
] as const satisfies readonly { id: string; icon: LucideIcon }[];

type SectionId = (typeof SECTIONS)[number]['id'];
const MONEY: SectionId[] = ['budget', 'tariffs', 'emissions', 'targets'];
const isSection = (v: string | null): v is SectionId => SECTIONS.some((s) => s.id === v);

/** Route "/settings": plant profile, budget, tariffs, factors, targets, alerts, data sources, users (spec 7.12). */
export default function SettingsPage() {
  const { t, tx } = useT('settings');
  const [params, setParams] = useSearchParams();
  const raw = params.get('section');
  const section: SectionId = isSection(raw) ? raw : 'tariffs';
  const [confirm, setConfirm] = useState(false);
  const overrides = useSettingsStore((s) => s.overrides);
  const resetAll = useSettingsStore((s) => s.reset);
  const resetAdmin = useAdminStore((s) => s.resetSettings);
  const { data } = useAnalysis();
  const [mountedAt] = useState(() => Date.now());
  const nowMs = data?.ds.timeline.nowMs ?? mountedAt;

  const go = (id: SectionId) => {
    const next = new URLSearchParams(params);
    next.set('section', id);
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button variant="secondary" onClick={() => setConfirm(true)}>
            <RotateCcw aria-hidden="true" />
            {t('actions.resetAll')}
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav
          aria-label={t('nav.label')}
          className="lg:sticky lg:top-[calc(var(--topbar-h)+24px)] lg:self-start"
        >
          <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
            {SECTIONS.map((s) => {
              const active = s.id === section;
              return (
                <li key={s.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => go(s.id)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex w-full items-center gap-2.5 whitespace-nowrap rounded-sm px-3 py-2 text-left text-13 font-medium transition-colors duration-180',
                      active
                        ? 'bg-violet-50 text-violet-700'
                        : 'text-ink-2 hover:bg-bg-subtle hover:text-ink',
                    )}
                  >
                    <s.icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    {tx(`nav.${s.id}`)}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="min-w-0 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-ink">{tx(`nav.${section}`)}</h2>
            <p className="mt-0.5 text-13 text-ink-2">{tx(`nav.${section}Desc`)}</p>
          </div>
          {MONEY.includes(section) && <ImpactPreview />}
          {section === 'plant' && <PlantSection />}
          {section === 'budget' && <BudgetSection />}
          {section === 'tariffs' && <TariffSection nowMs={nowMs} />}
          {section === 'emissions' && <EmissionSection nowMs={nowMs} />}
          {section === 'targets' && <TargetSection />}
          {section === 'alerts' && <AlertSection />}
          {section === 'sources' && <DataSourceSection />}
          {section === 'users' && <UsersSection />}
        </div>
      </div>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent closeLabel={t('common:actions.close')}>
          <DialogHeader>
            <DialogTitle>{t('reset.title')}</DialogTitle>
            <DialogDescription>{t('reset.body')}</DialogDescription>
          </DialogHeader>
          <p className="text-13 text-ink-2">
            {t('reset.count', { n: Object.keys(overrides).length })}
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                resetAll();
                resetAdmin();
                setConfirm(false);
              }}
            >
              {t('reset.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
