import { ArrowRight, Factory, Sparkles, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NAV_ITEMS } from '@/app/nav';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { anomalyTitleParams, recentAnomalies, topPending } from '@/domain/insights';
import { useT } from '@/i18n';
import { formatAzn, formatDayMonth } from '@/lib/format';
import { normalizeText } from '@/services/CopilotService';
import { paletteFilter } from './filter';
import { useAnalysis, useAnomalies, useRecommendations } from '@/stores/derived';
import { useUiStore } from '@/stores/ui';

const kw = (...xs: string[]) => xs.map(normalizeText);

/**
 * Global command palette (spec 7.1), Ctrl/⌘+K: pages, equipment, anomalies,
 * pending decisions and "AI Copilot-a soruş" (opens the copilot, Ctrl/⌘+J).
 */
export function CommandPalette() {
  const { t, tx } = useT('copilot');
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const setCopilot = useUiStore((s) => s.setCopilotOpen);
  const navigate = useNavigate();
  const { data } = useAnalysis();
  const anomalies = useAnomalies();
  const recs = useRecommendations();
  const [query, setQuery] = useState('');

  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const go = (to: string) => {
    close();
    navigate(to);
  };
  const ask = () => {
    const q = query.trim();
    close();
    setCopilot(true, q || null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogContent
        closeLabel={t('common:actions.close')}
        className="top-[12%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0 sm:top-[16%] [&>button]:hidden"
      >
        <DialogTitle className="sr-only">{t('command.title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('command.description')}</DialogDescription>
        <Command label={t('command.title')} loop filter={paletteFilter}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={t('command.placeholder')}
          />
          <CommandList className="max-h-[min(420px,60vh)]">
            <CommandEmpty>{t('command.empty')}</CommandEmpty>
            <CommandGroup heading={t('command.groupPages')}>
              {NAV_ITEMS.map((n) => {
                const label = tx(`layout:nav.${n.key}`);
                const Icon = n.icon;
                return (
                  <CommandItem
                    key={n.key}
                    value={`page:${n.key}`}
                    keywords={kw(label)}
                    onSelect={() => go(n.path)}
                  >
                    <Icon aria-hidden="true" />
                    {label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {recs && topPending(recs.items, 10).length > 0 && (
              <CommandGroup heading={t('command.groupDecisions')}>
                {topPending(recs.items, 10).map((v) => {
                  const title = tx(`common:rec.title.${v.id}`);
                  return (
                    <CommandItem
                      key={v.id}
                      value={`rec:${v.id}`}
                      keywords={kw(title, ...v.equipmentNames)}
                      onSelect={() => go(`/decisions?rec=${v.id}`)}
                    >
                      <Sparkles aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{title}</span>
                      <span className="shrink-0 text-xs tabular-nums text-ink-3">
                        {formatAzn(v.aznPerMonth)}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            {data && (
              <CommandGroup heading={t('command.groupEquipment')}>
                {data.ds.equipment.map((e) => (
                  <CommandItem
                    key={e.id}
                    value={`eq:${e.id}`}
                    keywords={kw(e.code, e.name)}
                    onSelect={() => go(`/equipment/${e.id}`)}
                  >
                    <Factory aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{e.name}</span>
                    <span className="shrink-0 text-xs text-ink-3">
                      {tx(`common:group.${e.group}`)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {anomalies && (
              <CommandGroup heading={t('command.groupAnomalies')}>
                {recentAnomalies(anomalies, 12).map((a) => {
                  const title = tx(`common:anomaly.title.${a.rule}`, anomalyTitleParams(a));
                  return (
                    <CommandItem
                      key={a.id}
                      value={`an:${a.id}`}
                      keywords={kw(title, tx(`common:rule.${a.rule}`), ...a.equipmentNames)}
                      onSelect={() => go(`/anomalies?id=${encodeURIComponent(a.id)}`)}
                    >
                      <TriangleAlert aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{title}</span>
                      <span className="shrink-0 text-xs text-ink-3">
                        {tx(`common:severity.${a.severity}`)} · {formatDayMonth(a.end)}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            <CommandSeparator />
            <CommandGroup heading={t('command.groupAi')} forceMount>
              <CommandItem
                value="__ask-copilot"
                forceMount
                onSelect={ask}
                className="[&_svg]:text-violet-600"
              >
                <Sparkles aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">
                  {query.trim()
                    ? t('command.askCopilotWith', { query: query.trim() })
                    : t('command.askCopilot')}
                </span>
                <kbd className="rounded-[5px] border border-border bg-bg-subtle px-1.5 py-0.5 font-sans text-[10px] font-semibold text-ink-3">
                  {t('command.copilotShortcut')}
                </kbd>
              </CommandItem>
            </CommandGroup>
          </CommandList>
          <p className="flex items-center gap-1.5 border-t border-border px-3 py-2 text-[11px] text-ink-3">
            <ArrowRight className="size-3" strokeWidth={1.75} aria-hidden="true" />
            {t('command.hintNavigate')}
          </p>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
