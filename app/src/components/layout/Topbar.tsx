import { Bell, CalendarDays, ChevronDown, Sparkles, TriangleAlert, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { baseConfig } from '@/data/config';
import { useT } from '@/i18n';
import { formatDate, formatDateRange, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAnomalies, useDateRange } from '@/stores/derived';
import { useUiStore, type RangePreset, type Role } from '@/stores/ui';
import { LogoMark } from './Logo';

const RANGES: RangePreset[] = ['today', '7d', 'month', 'quarter', 'year', 'custom'];
const ROLES: Role[] = ['director', 'energy_manager', 'operator'];

function toInput(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function RangeSelector({ compact }: { compact?: boolean }) {
  const { t } = useT('layout');
  const preset = useUiStore((s) => s.rangePreset);
  const setRange = useUiStore((s) => s.setRange);
  const resolved = useDateRange();
  const [customOpen, setCustomOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const openCustom = () => {
    if (resolved) {
      setFrom(toInput(resolved.from));
      setTo(toInput(resolved.to - 1));
    }
    setCustomOpen(true);
  };
  return (
    <Popover open={customOpen} onOpenChange={setCustomOpen}>
      <DropdownMenu>
        <PopoverAnchor asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              aria-label={`${t('topbar.range')}: ${t(`common:range.${preset}`)}`}
            >
              <CalendarDays aria-hidden="true" />
              <span>{t(`common:range.${preset}`)}</span>
              {!compact && resolved && (
                <span className="hidden font-normal text-ink-3 xl:inline">
                  {resolved.preset === 'today'
                    ? formatDate(resolved.from)
                    : formatDateRange(resolved.from, resolved.to - 1)}
                </span>
              )}
              <ChevronDown className="text-ink-3" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
        </PopoverAnchor>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>{t('topbar.range')}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={preset}
            onValueChange={(v) => (v === 'custom' ? openCustom() : setRange(v as RangePreset))}
          >
            {RANGES.map((r) => (
              <DropdownMenuRadioItem key={r} value={r}>
                {t(`common:range.${r}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <PopoverContent align="end" className="w-72">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new Date(`${from}T00:00:00`).getTime();
            const tt = new Date(`${to}T00:00:00`).getTime();
            if (Number.isFinite(f) && Number.isFinite(tt) && tt >= f) {
              setRange('custom', { from: f, to: tt });
              setCustomOpen(false);
            }
          }}
        >
          <label className="block text-13 text-ink-2">
            {t('topbar.customFrom')}
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1"
            />
          </label>
          <label className="block text-13 text-ink-2">
            {t('topbar.customTo')}
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1"
            />
          </label>
          <Button type="submit" variant="default" size="sm" className="w-full">
            {t('topbar.apply')}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function RoleSelector() {
  const { t } = useT('layout');
  const role = useUiStore((s) => s.role);
  const setRole = useUiStore((s) => s.setRole);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          aria-label={`${t('topbar.roleLabel')}: ${t(`common:role.${role}`)}`}
        >
          <UserRound aria-hidden="true" />
          <span className="max-md:hidden">{t(`common:role.${role}`)}</span>
          <ChevronDown className="text-ink-3" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{t('topbar.roleLabel')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={role} onValueChange={(v) => setRole(v as Role)}>
          {ROLES.map((r) => (
            <DropdownMenuRadioItem key={r} value={r}>
              {t(`common:role.${r}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Notifications() {
  const { t, tx } = useT('layout');
  const anomalies = useAnomalies();
  const items = (anomalies ?? [])
    .filter((a) => a.status === 'open' && (a.severity === 'critical' || a.severity === 'high'))
    .slice(0, 5);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={
            items.length
              ? t('topbar.notificationsCount', { count: items.length })
              : t('topbar.notifications')
          }
          className="relative"
        >
          <Bell className="!size-[18px]" aria-hidden="true" />
          {items.length > 0 && (
            <span
              className="absolute right-2 top-2 size-2 rounded-full bg-danger ring-2 ring-surface"
              aria-hidden="true"
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <p className="border-b border-border px-4 py-3 text-13 font-semibold text-ink">
          {t('topbar.notifications')}
        </p>
        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-13 text-ink-3">
            {t('topbar.notificationsEmpty')}
          </p>
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {items.map((a) => (
              <li key={a.id}>
                <Link
                  to="/anomalies"
                  className="flex gap-3 px-4 py-3 transition-colors hover:bg-bg-subtle"
                >
                  <TriangleAlert
                    className={cn(
                      'mt-0.5 size-4 shrink-0',
                      a.severity === 'critical' ? 'text-danger' : 'text-warning',
                    )}
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block text-13 font-medium text-ink">
                      {tx(`common:rule.${a.rule}`)}
                      {a.equipmentNames.length
                        ? `: ${a.equipmentNames.slice(0, 3).join(', ')}`
                        : ''}
                    </span>
                    <span className="block text-xs text-ink-3">
                      {tx(`common:severity.${a.severity}`)} · {formatDate(a.end)},{' '}
                      {formatTime(a.end)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function LiveIndicator() {
  const { t } = useT('layout');
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-ink-2"
      role="status"
      aria-label={t('topbar.liveAria')}
    >
      <span className="relative flex size-2" aria-hidden="true">
        <span className="absolute inline-flex size-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
        <span className="relative inline-flex size-2 rounded-full bg-success" />
      </span>
      {t('topbar.live')}
    </span>
  );
}

export interface TopbarProps {
  title: string;
}

/** Top bar: page title, range, role, notifications, live, AI Copilot (spec 7.1). */
export function Topbar({ title }: TopbarProps) {
  const { t } = useT('layout');
  const setCopilotOpen = useUiStore((s) => s.setCopilotOpen);
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-surface/85 backdrop-blur-md">
      <div className="flex h-topbar items-center gap-3 px-4 md:px-6">
        <LogoMark className="size-7 md:hidden" />
        <p className="flex min-w-0 flex-1 items-center gap-2 truncate text-sm" aria-hidden="true">
          <span className="hidden truncate text-ink-3 xl:inline">{baseConfig.plant.name}</span>
          <span className="hidden text-border-strong xl:inline">/</span>
          <span className="truncate font-semibold text-ink">{title}</span>
        </p>
        <div className="hidden items-center gap-2 md:flex">
          <RangeSelector />
          <RoleSelector />
        </div>
        <div className="hidden lg:block">
          <LiveIndicator />
        </div>
        <Notifications />
        <Button
          variant="primary"
          size="sm"
          onClick={() => setCopilotOpen(true)}
          aria-keyshortcuts="Control+K Meta+K"
          className="max-md:size-9 max-md:px-0"
        >
          <Sparkles aria-hidden="true" />
          <span className="max-md:sr-only">{t('topbar.copilot')}</span>
          <kbd className="ml-1 hidden rounded-[5px] bg-white/20 px-1.5 py-0.5 font-sans text-[10px] font-semibold xl:inline">
            {t('topbar.copilotShortcut')}
          </kbd>
        </Button>
      </div>
      <div className="flex items-center gap-2 overflow-x-auto border-t border-border/70 px-4 py-2 md:hidden">
        <RangeSelector compact />
        <RoleSelector />
        <div className="ml-auto">
          <LiveIndicator />
        </div>
      </div>
    </header>
  );
}
