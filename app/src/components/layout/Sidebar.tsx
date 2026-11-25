import { Building2, Check, ChevronsUpDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '@/app/nav';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { baseConfig } from '@/data/config';
import { useT } from '@/i18n';
import { useIsDesktop } from '@/lib/useMediaQuery';
import { cn } from '@/lib/utils';
import { usePendingCount } from '@/stores/derived';
import { usePlantProfile } from '@/stores/admin';
import { useUiStore } from '@/stores/ui';
import { LogoMark } from './Logo';

/** Left navigation, 240 px (72 px collapsed), hidden below 768 px. */
export function Sidebar() {
  const { t } = useT('layout');
  const collapsedPref = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const plantId = useUiStore((s) => s.plantId);
  const setPlant = useUiStore((s) => s.setPlant);
  const pending = usePendingCount();
  const profile = usePlantProfile();
  const plantName = profile.name.trim() || baseConfig.plant.name;
  const plants = [{ id: baseConfig.plant.id, name: plantName }];
  const isDesktop = useIsDesktop();
  const iconOnly = collapsedPref || !isDesktop;

  return (
    <aside
      data-collapsed={collapsedPref}
      className={cn(
        'group/sb sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface/80 backdrop-blur-[2px] md:flex',
        'w-sidebar-collapsed lg:w-sidebar lg:data-[collapsed=true]:w-sidebar-collapsed',
        'transition-[width] duration-180 ease-standard',
      )}
    >
      <div className="flex h-topbar items-center gap-2.5 px-5 group-data-[collapsed=true]/sb:px-5 max-lg:px-5">
        <LogoMark className="shrink-0" />
        <div className="min-w-0 max-lg:hidden group-data-[collapsed=true]/sb:hidden">
          <p className="truncate text-sm font-semibold leading-tight text-ink">
            {t('common:app.name')}
          </p>
          <p className="truncate text-xs text-ink-3">{t('common:app.tagline')}</p>
        </div>
      </div>

      <nav aria-label={t('nav.label')} className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const label = t(`nav.${item.key}`);
            const badge = item.key === 'decisions' && pending ? pending : null;
            const link = (
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  cn(
                    'relative flex h-10 items-center gap-3 rounded-sm px-3 text-sm font-medium transition-colors duration-180',
                    'max-lg:justify-center max-lg:px-0 group-data-[collapsed=true]/sb:justify-center group-data-[collapsed=true]/sb:px-0',
                    isActive
                      ? 'bg-violet-50 text-violet-700'
                      : 'text-ink-2 hover:bg-bg-subtle hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={cn(
                        'size-[18px] shrink-0',
                        isActive ? 'text-violet-600' : 'text-ink-3',
                      )}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span className="truncate max-lg:sr-only group-data-[collapsed=true]/sb:sr-only">
                      {label}
                    </span>
                    {badge !== null && (
                      <span className="sr-only">, {t('nav.pendingBadge', { count: badge })}</span>
                    )}
                    {badge !== null && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          'ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1.5 text-[11px] font-semibold tabular-nums text-white',
                          'max-lg:absolute max-lg:right-1.5 max-lg:top-1 max-lg:h-4 max-lg:min-w-4 max-lg:px-1 max-lg:text-[10px]',
                          'group-data-[collapsed=true]/sb:absolute group-data-[collapsed=true]/sb:right-1.5 group-data-[collapsed=true]/sb:top-1 group-data-[collapsed=true]/sb:h-4 group-data-[collapsed=true]/sb:min-w-4 group-data-[collapsed=true]/sb:px-1 group-data-[collapsed=true]/sb:text-[10px]',
                        )}
                      >
                        {badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
            return (
              <li key={item.key}>
                {iconOnly ? (
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{label}</TooltipContent>
                  </Tooltip>
                ) : (
                  link
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-1 border-t border-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t('sidebar.plantSelect')}
            className="flex w-full items-center gap-2.5 rounded-sm px-2 py-2 text-left transition-colors hover:bg-bg-subtle max-lg:justify-center group-data-[collapsed=true]/sb:justify-center"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-border bg-bg-subtle text-ink-2">
              <Building2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 max-lg:hidden group-data-[collapsed=true]/sb:hidden">
              <span className="block text-xs text-ink-3">{t('sidebar.plant')}</span>
              <span className="block truncate text-13 font-medium text-ink">
                {plantName}
              </span>
            </span>
            <ChevronsUpDown
              className="size-4 text-ink-3 max-lg:hidden group-data-[collapsed=true]/sb:hidden"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-64">
            <DropdownMenuLabel>{t('sidebar.plantSelect')}</DropdownMenuLabel>
            {plants.map((p) => (
              <DropdownMenuItem key={p.id} onSelect={() => setPlant(p.id)}>
                <Building2 aria-hidden="true" />
                <span className="flex-1">{p.name}</span>
                {plantId === p.id && <Check className="!text-violet-600" aria-hidden="true" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-2.5 rounded-sm px-2 py-1.5 max-lg:justify-center group-data-[collapsed=true]/sb:justify-center">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700"
            aria-hidden="true"
          >
            AM
          </span>
          <span className="min-w-0 flex-1 max-lg:hidden group-data-[collapsed=true]/sb:hidden">
            <span className="block truncate text-13 font-medium text-ink">{t('sidebar.user')}</span>
            <span className="block truncate text-xs text-ink-3">{t('sidebar.userRole')}</span>
          </span>
        </div>

        <button
          type="button"
          onClick={toggle}
          aria-label={collapsedPref ? t('sidebar.expand') : t('sidebar.collapse')}
          className="hidden h-8 w-full items-center gap-2 rounded-sm px-2 text-xs text-ink-3 transition-colors hover:bg-bg-subtle hover:text-ink lg:flex group-data-[collapsed=true]/sb:justify-center"
        >
          {collapsedPref ? (
            <PanelLeftOpen className="size-4" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <PanelLeftClose className="size-4" strokeWidth={1.75} aria-hidden="true" />
          )}
          <span className="group-data-[collapsed=true]/sb:hidden">{t('sidebar.collapse')}</span>
        </button>
      </div>
    </aside>
  );
}
