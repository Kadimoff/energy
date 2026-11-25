import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AnomalyTimeline } from '@/components/charts/ops/AnomalyTimeline';
import { HeatmapWeek } from '@/components/charts/ops/HeatmapWeek';
import { LivePowerChart } from '@/components/charts/ops/LivePowerChart';
import { LoadHistogram } from '@/components/charts/ops/LoadHistogram';
import {
  PlantSchematic,
  PlantStatusList,
  PlantStatusTable,
} from '@/components/charts/ops/PlantSchematic';
import { HealthScore, SeverityBadge } from '@/components/charts/ops/status';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MockDataSource } from '@/data/sources/MockDataSource';
import { loadProfile, weekHeatmap } from '@/domain/equipment';
import {
  heatmapView,
  livePowerSeries,
  liveReadings,
  loadHistogram,
  timelineLayout,
  workshopLive,
} from '@/domain/ops';
import { fixture, FIXED_NOW } from '@/test/fixture';

const a = fixture();
const src = new MockDataSource({ now: () => FIXED_NOW });
src.adopt(a.ds);
const ticks = src.liveHistory(60);
const workshops = workshopLive(a.ds, liveReadings(a, ticks[ticks.length - 1]));

const wrap = (ui: React.ReactNode) =>
  render(
    <MemoryRouter>
      <TooltipProvider>{ui}</TooltipProvider>
    </MemoryRouter>,
  );

describe('ops charts', () => {
  it('PlantSchematic: every machine is a keyboard link with value and status text', async () => {
    const onOpen = vi.fn();
    wrap(<PlantSchematic workshops={workshops} onOpen={onOpen} ariaLabel="Zavod sxemi" />);
    const svg = screen.getByRole('group', { name: 'Zavod sxemi' });
    const links = within(svg as unknown as HTMLElement).getAllByRole('link');
    expect(links).toHaveLength(a.ds.equipment.length);
    const offline = screen.getByTestId('node-ahu-wh');
    expect(offline).toHaveAttribute('data-status', 'offline');
    expect(offline.getAttribute('aria-label')).toContain('Əlaqə yoxdur');
    const k2 = screen.getByTestId('node-comp-2');
    expect(k2.getAttribute('aria-label')).toMatch(/kVt/);
    fireEvent.click(k2);
    expect(onOpen).toHaveBeenCalledWith('comp-2');
    k2.focus();
    await userEvent.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledTimes(2);
    // legend: colour + icon + text for each state
    const legend = screen.getByRole('list', { name: 'Vəziyyət izahı' });
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Normal', 'İsraf', 'Dayanıb', 'Əlaqə yoxdur']);
  });

  it('PlantStatusTable and PlantStatusList list all machines', () => {
    const onOpen = vi.fn();
    const { unmount } = wrap(<PlantStatusTable workshops={workshops} />);
    expect(screen.getAllByRole('row')).toHaveLength(a.ds.equipment.length + 1);
    unmount();
    wrap(<PlantStatusList workshops={workshops} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: /K-2 kompressoru/ }));
    expect(onOpen).toHaveBeenCalledWith('comp-2');
  });

  it('HeatmapWeek: aria label, framed idle hours, excess cells and a 7×24 table alternative', async () => {
    const view = heatmapView(weekHeatmap(a, 'comp-2'), 90);
    const { container } = wrap(<HeatmapWeek view={view} name="K-2 kompressoru" unit="kVt" />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('aria-label')).toContain('K-2 kompressoru');
    expect(container.querySelectorAll('[data-excess]')).toHaveLength(view.excessSlots);
    await userEvent.click(screen.getByRole('button', { name: 'Cədvəl kimi bax' }));
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(8);
    expect(within(table).getAllByText(/İstehsalsız saatda artıq yük/).length).toBe(
      view.excessSlots,
    );
  });

  it('LoadHistogram: class shares and table alternative', async () => {
    const now = a.ds.timeline.nowIndex;
    const r = a.ds.readings['comp-2'];
    const bins = loadHistogram(r, 90, now - 672, now);
    wrap(<LoadHistogram bins={bins} profile={loadProfile(r, 90, now - 672, now)} name="K-2" />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(
      /yüksüz .*qismən yük .*tam yük/,
    );
    expect(screen.getByText('Qismən yük')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cədvəl kimi bax' }));
    expect(screen.getAllByRole('row')).toHaveLength(bins.length + 1);
  });

  it('LivePowerChart: aria summary with the peak limit and per-minute table', async () => {
    const s = livePowerSeries(ticks, a.ds.plant.peakLimitKw);
    wrap(<LivePowerChart series={s} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('1\u00A0280\u00A0kVt');
    await userEvent.click(screen.getByRole('button', { name: 'Cədvəl kimi bax' }));
    expect(screen.getAllByRole('row').length).toBe(61);
  });

  it('AnomalyTimeline: items are buttons that open the detail', async () => {
    const from = FIXED_NOW - 30 * 86_400_000;
    const lanes = timelineLayout(a.anomalies, from, FIXED_NOW, [
      ...a.ds.groups.map((g) => g.id),
      'plant',
    ]);
    const onOpen = vi.fn();
    wrap(
      <AnomalyTimeline
        lanes={lanes}
        from={from}
        to={FIXED_NOW}
        laneLabel={(k) => String(k)}
        itemLabel={(id) => `item ${id}`}
        onOpen={onOpen}
        ariaLabel="Zaman xətti"
      />,
    );
    const items = screen.getAllByRole('button', { name: /^item / });
    expect(items).toHaveLength(lanes.reduce((s, l) => s + l.items.length, 0));
    fireEvent.click(items[0]);
    expect(onOpen).toHaveBeenCalledTimes(1);
    items[1].focus();
    await userEvent.keyboard(' ');
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('badges carry text, not colour only', () => {
    wrap(
      <>
        <SeverityBadge severity="critical" />
        <HealthScore value={42} />
      </>,
    );
    expect(screen.getByText('Kritik')).toBeInTheDocument();
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '42');
    expect(screen.getByText('Zəif')).toBeInTheDocument();
  });
});
