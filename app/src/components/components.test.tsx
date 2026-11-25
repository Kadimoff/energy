import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AiBadge } from '@/components/ai/AiBadge';
import { ConfidenceMeter } from '@/components/ai/ConfidenceMeter';
import { WhyPanel } from '@/components/ai/WhyPanel';
import { ActualVsOptimalChart } from '@/components/charts/ActualVsOptimalChart';
import { Sparkline } from '@/components/charts/Sparkline';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { StaleDataBanner } from '@/components/common/StaleDataBanner';
import { KpiCard } from '@/components/kpi/KpiCard';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { ChartPoint } from '@/domain/viewmodels';
import { formatAzn } from '@/lib/format';

const wrap = (ui: React.ReactNode) =>
  render(
    <MemoryRouter>
      <TooltipProvider>{ui}</TooltipProvider>
    </MemoryRouter>,
  );

describe('shared components', () => {
  it('KpiCard shows value with unit, delta and link', () => {
    wrap(
      <KpiCard
        label="Bu ay xərc"
        value={54295}
        format={(v) => formatAzn(v)}
        deltaPct={4.2}
        to="/forecast"
        animate={false}
        sparkline={[1, 2, 3]}
      />,
    );
    expect(screen.getByText('54 295 AZN')).toBeInTheDocument();
    expect(screen.getByText('+4,2%')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/forecast');
  });

  it('ConfidenceMeter exposes value and level text', () => {
    wrap(
      <>
        <ConfidenceMeter value={86} />
        <ConfidenceMeter value={64} />
        <ConfidenceMeter value={41} showValue={false} />
      </>,
    );
    const meters = screen.getAllByRole('meter');
    expect(meters[0]).toHaveAttribute('aria-valuenow', '86');
    expect(screen.getByText('Yüksək')).toBeInTheDocument();
    expect(screen.getByText('Orta')).toBeInTheDocument();
    expect(screen.getByText('Aşağı, yoxlama tövsiyə olunur')).toBeInTheDocument();
  });

  it('WhyPanel expands with explanation sections', async () => {
    wrap(<WhyPanel data="Son 30 gün saatlıq sərfiyyat" rule="İstehsalsız saatlarda yük" />);
    const btn = screen.getByRole('button', { name: /Niyə\?/ });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Son 30 gün saatlıq sərfiyyat')).toBeInTheDocument();
  });

  it('states and badges render their copy', async () => {
    const retry = vi.fn();
    wrap(
      <>
        <AiBadge />
        <EmptyState
          title="Boşdur"
          body="Qərar Mərkəzinə keçin"
          action={{ label: 'Aç', to: '/decisions' }}
        />
        <EmptyState title="İkinci" action={{ label: 'Bas', onClick: retry }} />
        <ErrorState onRetry={retry} />
        <StaleDataBanner minutes={12} name="AHU-A" />
        <StaleDataBanner minutes={3} />
        <Sparkline data={[1, Number.NaN, 3, 2]} ariaLabel="trend" reference={2} />
        <Sparkline data={[1]} />
      </>,
    );
    expect(screen.getAllByText('AI').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Aç' })).toHaveAttribute('href', '/decisions');
    await userEvent.click(screen.getByRole('button', { name: 'Bas' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yenidən cəhd et' }));
    expect(retry).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/12 dəqiqə əvvəl. AHU-A/)).toBeInTheDocument();
    expect(screen.getByText(/3 dəqiqə əvvəl/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'trend' })).toBeInTheDocument();
  });

  it('ActualVsOptimalChart offers a table alternative and cumulative toggle', async () => {
    const pts: ChartPoint[] = [0, 1, 2].map((i) => ({
      t: new Date(2026, 10, 1 + i).getTime(),
      actual: i < 2 ? 100 + i * 50 : null,
      optimal: 100,
      lower: 90,
      upper: 110,
      waste: i < 2 ? i * 40 : null,
      forecast: i >= 1 ? 120 : null,
      forecastLower: i >= 1 ? 110 : null,
      forecastUpper: i >= 1 ? 130 : null,
      budget: 105,
      cumActual: i < 2 ? 100 + i * 150 : null,
      cumOptimal: 100 * (i + 1),
      cumLower: 90 * (i + 1),
      cumUpper: 110 * (i + 1),
      cumForecast: i >= 1 ? 250 + (i - 1) * 120 : null,
      cumForecastLower: null,
      cumForecastUpper: null,
      cumBudget: 105 * (i + 1),
      isFuture: i >= 2,
    }));
    wrap(<ActualVsOptimalChart points={pts} title="Faktiki vs optimal" ariaSummary="test" />);
    expect(screen.getByRole('img', { name: /Faktiki vs optimal/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Toplanan' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cədvəl kimi bax' }));
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(within(table).getByText('1 noyabr 2026')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Qrafik kimi bax' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('chart handles empty data', () => {
    wrap(
      <ActualVsOptimalChart
        points={[]}
        title="Boş"
        showControls={false}
        resolution="hour"
        unit="m3"
      />,
    );
    expect(screen.getByText('Seçilmiş dövr üçün məlumat yoxdur')).toBeInTheDocument();
  });
});
