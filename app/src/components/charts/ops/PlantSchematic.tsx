import { useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { LiveStatus } from '@/data/types';
import type { WorkshopLive } from '@/domain/ops';
import { useT } from '@/i18n';
import { formatKw, formatNumber, formatTime, NBSP, UNITS } from '@/lib/format';
import { cn } from '@/lib/utils';
import { LiveStatusBadge } from './status';
import { LIVE_STATUS, LIVE_STATUS_ORDER } from './statusMeta';
import { useElementWidth } from './useElementWidth';

/**
 * SVG plant schematic (spec 7.4): workshops as rooms, main equipment as
 * blocks with current power and state (colour + icon + text). The layout
 * flows into rows that fit the measured width, so 1 SVG unit ≈ 1 px and
 * the text stays readable from 640 px up; below that the page shows
 * the list variant (PlantStatusList).
 */

export interface PlantSchematicProps {
  workshops: WorkshopLive[];
  onOpen: (equipmentId: string) => void;
  /** accessible summary (counts per state) */
  ariaLabel: string;
  className?: string;
}

/** preferred columns of equipment blocks per workshop (falls back to auto) */
const COLS: Record<string, number> = {
  compressor_room: 2,
  cooling_station: 2,
  extrusion_hall: 3,
  injection_hall: 2,
  warehouse: 2,
  boiler_house: 1,
  admin: 1,
  site: 1,
};

const GAP = 12;
const PAD = 12;
const HEAD = 34;
const BW = 108;
/** blocks may shrink to this width so a row does not leave one room alone */
const BW_MIN = 100;
const BH = 74;
const BGAP = 10;

interface BoxLayout {
  w: WorkshopLive;
  x: number;
  y: number;
  width: number;
  height: number;
  cols: number;
  blockW: number;
}

function layoutSchematic(workshops: WorkshopLive[], width: number) {
  const boxes: BoxLayout[] = [];
  const W = Math.max(320, width);
  let row: BoxLayout[] = [];
  let x = 0;
  let xMin = 0;
  let y = 0;
  const flush = () => {
    if (!row.length) return;
    const used = row.reduce((s, b) => s + b.width, 0) + GAP * (row.length - 1);
    const extra = (W - used) / row.length;
    const h = Math.max(...row.map((b) => b.height));
    let cx = 0;
    for (const b of row) {
      b.width += extra;
      b.x = cx;
      b.height = h;
      b.blockW = (b.width - 2 * PAD - (b.cols - 1) * BGAP) / b.cols;
      cx += b.width + GAP;
      boxes.push(b);
    }
    y += h + GAP;
    row = [];
    x = 0;
    xMin = 0;
  };
  for (const w of workshops) {
    let cols = Math.min(COLS[w.id] ?? Math.min(3, w.items.length), w.items.length);
    const fit = Math.floor((W - 2 * PAD + BGAP) / (BW + BGAP));
    cols = Math.max(1, Math.min(cols, fit));
    const rows = Math.ceil(w.items.length / cols);
    const width = 2 * PAD + cols * BW + (cols - 1) * BGAP;
    const minWidth = 2 * PAD + cols * BW_MIN + (cols - 1) * BGAP;
    const height = HEAD + rows * BH + (rows - 1) * BGAP + PAD;
    if (row.length && xMin + minWidth > W) flush();
    row.push({ w, x, y, width, height, cols, blockW: BW });
    x += width + GAP;
    xMin += minWidth + GAP;
  }
  flush();
  return { boxes, width: W, height: Math.max(0, y - GAP) };
}

export function PlantSchematic({ workshops, onOpen, ariaLabel, className }: PlantSchematicProps) {
  const { t } = useT('live');
  const { ref, width } = useElementWidth<HTMLDivElement>(1000);
  const layout = useMemo(() => layoutSchematic(workshops, width), [workshops, width]);
  const valueText = (kw: number, gas: boolean, lastSeen: number) =>
    Number.isNaN(kw)
      ? `${t('table.lastSeen')} ${formatTime(lastSeen)}`
      : gas
        ? `${formatNumber(kw, 0)}${NBSP}${t('schematic.gasUnit')}`
        : formatKw(kw, kw < 10 ? 1 : 0);

  return (
    <div ref={ref} className={cn('w-full', className)}>
      <svg
        role="group"
        aria-label={ariaLabel}
        width="100%"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="block h-auto select-none"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        {layout.boxes.map((b) => (
          <g key={b.w.id}>
            <rect
              x={b.x + 0.5}
              y={b.y + 0.5}
              width={b.width - 1}
              height={b.height - 1}
              rx={14}
              fill="var(--bg-subtle)"
              stroke="var(--border-strong)"
            />
            <text x={b.x + PAD} y={b.y + 22} fontSize={13} fontWeight={600} fill="var(--text-2)">
              {b.w.name}
            </text>
            {(() => {
              const total =
                b.w.gasM3h > 0 && b.w.totalKw === 0
                  ? `${formatNumber(b.w.gasM3h, 0)}${NBSP}${t('schematic.gasUnit')}`
                  : formatKw(b.w.totalKw);
              // narrow rooms: the blocks already show the value, skip the total
              const fits = b.w.name.length * 7.6 + total.length * 6.8 + 16 < b.width - 2 * PAD;
              return fits ? (
                <text
                  x={b.x + b.width - PAD}
                  y={b.y + 22}
                  fontSize={12}
                  textAnchor="end"
                  fill="var(--text-3)"
                  className="tabular-nums"
                >
                  {total}
                </text>
              ) : null;
            })()}
            {b.w.items.map((it, i) => {
              const col = i % b.cols;
              const r = Math.floor(i / b.cols);
              const x = b.x + PAD + col * (b.blockW + BGAP);
              const y = b.y + HEAD + r * (BH + BGAP);
              const m = LIVE_STATUS[it.status];
              const Icon = m.icon;
              const gas = it.equipment.energy === 'gas';
              const value = valueText(it.kw, gas, it.lastSeen);
              const statusText =
                it.status === 'waste' && it.excessKw > 0
                  ? `${t('status.waste')} +${formatKw(it.excessKw)}`
                  : t(`status.${it.status}`);
              return (
                <g
                  key={it.equipmentId}
                  role="link"
                  tabIndex={0}
                  aria-label={t('schematic.nodeAria', {
                    name: it.equipment.name,
                    value,
                    status: statusText,
                  })}
                  className="group cursor-pointer outline-none"
                  onClick={() => onOpen(it.equipmentId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpen(it.equipmentId);
                    }
                  }}
                  data-status={it.status}
                  data-testid={`node-${it.equipmentId}`}
                >
                  <title>{`${it.equipment.name}: ${value}, ${statusText}`}</title>
                  <rect
                    x={x - 3}
                    y={y - 3}
                    width={b.blockW + 6}
                    height={BH + 6}
                    rx={10}
                    fill="none"
                    stroke="var(--violet-600)"
                    strokeWidth={2}
                    className="opacity-0 transition-opacity duration-180 group-hover:opacity-40 group-focus-visible:opacity-100"
                  />
                  <rect
                    x={x}
                    y={y}
                    width={b.blockW}
                    height={BH}
                    rx={8}
                    fill={m.fill}
                    stroke={m.stroke}
                    strokeWidth={1.5}
                    strokeDasharray={m.dashed ? '5 4' : undefined}
                    style={{ transition: 'fill 180ms, stroke 180ms' }}
                  />
                  <Icon
                    x={x + 9}
                    y={y + 9}
                    width={15}
                    height={15}
                    color={m.text}
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <text aria-hidden="true" x={x + 30} y={y + 21} fontSize={12.5} fontWeight={600} fill="var(--text)">
                    {it.equipment.code}
                  </text>
                  {Number.isNaN(it.kw) ? (
                    <text aria-hidden="true" x={x + 10} y={y + 46} fill={m.text} className="tabular-nums">
                      <tspan fontSize={14} fontWeight={600}>
                        {formatTime(it.lastSeen)}
                      </tspan>
                    </text>
                  ) : (
                    <text aria-hidden="true" x={x + 10} y={y + 46} fill="var(--text)" className="tabular-nums">
                      <tspan fontSize={17} fontWeight={600}>
                        {formatNumber(it.kw, !gas && it.kw < 10 ? 1 : 0)}
                      </tspan>
                      <tspan fontSize={11.5} fontWeight={500} fill="var(--text-2)">
                        {` ${gas ? t('schematic.gasUnit') : UNITS.kw}`}
                      </tspan>
                    </text>
                  )}
                  <text aria-hidden="true" x={x + 10} y={y + 64} fontSize={11.5} fontWeight={500} fill={m.text}>
                    {statusText}
                  </text>
                </g>
              );
            })}
          </g>
        ))}
      </svg>
      <StatusLegend className="mt-3" />
    </div>
  );
}

export function StatusLegend({ className }: { className?: string }) {
  const { t } = useT('live');
  return (
    <ul
      aria-label={t('schematic.legend')}
      className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-2', className)}
    >
      {LIVE_STATUS_ORDER.map((s) => {
        const m = LIVE_STATUS[s];
        const Icon = m.icon;
        return (
          <li key={s} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-flex size-4 items-center justify-center rounded-[4px] border"
              style={{
                background: m.fill,
                borderColor: m.stroke,
                borderStyle: m.dashed ? 'dashed' : 'solid',
              }}
            >
              <Icon className="size-3" style={{ color: m.text }} strokeWidth={2} />
            </span>
            {t(`status.${s}`)}
          </li>
        );
      })}
    </ul>
  );
}

/** Table alternative of the schematic (desktop) */
export function PlantStatusTable({ workshops }: { workshops: WorkshopLive[] }) {
  const { t } = useT('live');
  return (
    <div className="max-h-[520px] overflow-auto rounded-md border border-border">
      <Table>
        <caption className="sr-only">{t('table.caption')}</caption>
        <TableHeader className="sticky top-0 bg-surface">
          <TableRow>
            <TableHead>{t('table.workshop')}</TableHead>
            <TableHead>{t('table.equipment')}</TableHead>
            <TableHead className="text-right">{t('table.power')}</TableHead>
            <TableHead className="text-right">{t('table.optimal')}</TableHead>
            <TableHead>{t('table.status')}</TableHead>
            <TableHead className="text-right">{t('table.lastSeen')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workshops.flatMap((w) =>
            w.items.map((it, i) => {
              const gas = it.equipment.energy === 'gas';
              const fmt = (v: number) =>
                gas ? `${formatNumber(v, 0)}${NBSP}${t('schematic.gasUnit')}` : formatKw(v);
              return (
                <TableRow key={it.equipmentId}>
                  <TableCell className="text-ink-2">{i === 0 ? w.name : ''}</TableCell>
                  <TableCell className="font-medium">{it.equipment.name}</TableCell>
                  <TableCell className="text-right">
                    {Number.isNaN(it.kw) ? '–' : fmt(it.kw)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right text-ink-2">
                    {fmt(it.lowerKw)} – {fmt(it.upperKw)}
                  </TableCell>
                  <TableCell>
                    <LiveStatusBadge status={it.status} />
                  </TableCell>
                  <TableCell className="text-right text-ink-2">{formatTime(it.lastSeen)}</TableCell>
                </TableRow>
              );
            }),
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/** Mobile variant: workshops as compact cards with one row per machine. */
export function PlantStatusList({
  workshops,
  onOpen,
}: {
  workshops: WorkshopLive[];
  onOpen: (equipmentId: string) => void;
}) {
  const { t } = useT('live');
  return (
    <div className="space-y-3">
      {workshops.map((w) => (
        <section
          key={w.id}
          aria-label={w.name}
          className="rounded-md border border-border bg-bg-subtle"
        >
          <header className="flex items-center justify-between px-3 py-2 text-13">
            <h3 className="font-semibold text-ink-2">{w.name}</h3>
            <span className="tabular-nums text-ink-3">
              {w.gasM3h > 0 && w.totalKw === 0
                ? `${formatNumber(w.gasM3h, 0)}${NBSP}${t('schematic.gasUnit')}`
                : formatKw(w.totalKw)}
            </span>
          </header>
          <ul className="divide-y divide-border border-t border-border bg-surface">
            {w.items.map((it) => (
              <li key={it.equipmentId}>
                <button
                  type="button"
                  onClick={() => onOpen(it.equipmentId)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-violet-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-13 font-medium text-ink">
                      {it.equipment.code}
                    </span>
                    <span className="block truncate text-xs text-ink-3">{it.equipment.name}</span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-ink">
                    {Number.isNaN(it.kw)
                      ? formatTime(it.lastSeen)
                      : it.equipment.energy === 'gas'
                        ? `${formatNumber(it.kw, 0)}${NBSP}${t('schematic.gasUnit')}`
                        : formatKw(it.kw)}
                  </span>
                  <LiveStatusBadge status={it.status as LiveStatus} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
