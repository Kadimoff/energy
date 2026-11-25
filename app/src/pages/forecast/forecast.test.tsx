import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { makeQueryClient, Providers } from '@/app/providers';
import { normalizeScenario } from '@/domain/analytics/forecastView';
import { defaultScenario, runScenario } from '@/domain/scenario';
import { formatAzn } from '@/lib/format';
import { queryKeys } from '@/stores/derived';
import { useRecommendationStore } from '@/stores/recommendations';
import { useScenarioStore } from '@/stores/scenarios';
import { useSettingsStore } from '@/stores/settings';
import { fixture, rates } from '@/test/fixture';
import ForecastPage from './index';

const a = fixture();

function renderPage() {
  const qc = makeQueryClient();
  qc.setQueryData(queryKeys.analysis, a);
  qc.setQueryData(queryKeys.recStates, {});
  return render(
    <Providers client={qc}>
      <MemoryRouter>
        <ForecastPage />
      </MemoryRouter>
    </Providers>,
  );
}

/** Testing Library normalises NBSP in the DOM to spaces, so the matcher must use spaces too. */
const plain = (s: string) => s.replace(/\u00A0/g, ' ');

const expectCost = (patch: Partial<typeof defaultScenario>) =>
  plain(
    formatAzn(
      runScenario(
        a,
        a.engine,
        {},
        rates,
        normalizeScenario({ ...defaultScenario, ...patch }, rates),
      ).scenario.costAzn,
    ),
  );

describe('forecast page: simulator wiring', () => {
  beforeEach(() => {
    useScenarioStore.setState({ saved: [] });
    useSettingsStore.setState({ overrides: {} });
    useRecommendationStore.setState({ overrides: {} });
  });

  it('renders the month-end forecast and updates the scenario when controls change', async () => {
    renderPage();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Proqnoz və ssenarilər' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Büdcəni aşma ehtimalı/)).toBeInTheDocument();
    const results = screen.getByRole('region', { name: /Ssenari nəticələri/ });
    expect(within(results).getAllByText(expectCost({}))[0]).toBeInTheDocument();

    // three shifts on workdays
    await userEvent.click(screen.getByRole('tab', { name: /3 növbə/ }));
    await waitFor(() =>
      expect(within(results).getByText(expectCost({ shifts: 3 }))).toBeInTheDocument(),
    );

    // a recommendation from the checklist lowers the month-end cost further
    await userEvent.click(
      screen.getByRole('checkbox', { name: /Ekstruziya xətlərində gözləmə rejimini tətbiq edin/ }),
    );
    await waitFor(() =>
      expect(
        within(results).getByText(
          expectCost({ shifts: 3, recommendationIds: ['rec-ext-standby'] }),
        ),
      ).toBeInTheDocument(),
    );

    // production slider via keyboard (+1% per arrow)
    const thumb = screen.getByRole('slider', { name: 'İstehsal həcmi' });
    thumb.focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    await waitFor(() =>
      expect(
        within(results).getByText(
          expectCost({ shifts: 3, productionPct: 2, recommendationIds: ['rec-ext-standby'] }),
        ),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText('İstehsal +2%')).toBeInTheDocument();
  }, 30000);

  it('saves a scenario by name and compares it side by side', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 1 });
    await userEvent.click(screen.getByRole('tab', { name: /1 növbə/ }));
    await userEvent.click(screen.getByRole('button', { name: /Ssenarini yadda saxla/ }));
    expect(screen.getByText('Ssenariyə ad verin')).toHaveAttribute('role', 'status');
    await userEvent.type(screen.getByLabelText('Ssenari adı'), 'Bir növbə');
    await userEvent.click(screen.getByRole('button', { name: /Ssenarini yadda saxla/ }));
    expect(useScenarioStore.getState().saved).toHaveLength(1);
    expect(useScenarioStore.getState().saved[0].input.shifts).toBe(1);
    expect(screen.getByText('Bir növbə')).toBeInTheDocument();
    const cmp = screen.getByRole('region', { name: /yan-yana müqayisəsi/ });
    expect(within(cmp).getByRole('table')).toBeInTheDocument();
    expect(within(cmp).getAllByRole('row')).toHaveLength(6);
    // load it back after a reset
    await userEvent.click(screen.getByRole('button', { name: 'Sıfırla' }));
    await userEvent.click(
      screen.getByRole('button', { name: /"Bir növbə" ssenarisini simulyatora yüklə/ }),
    );
    expect(screen.getByRole('tab', { name: /1 növbə/ })).toHaveAttribute('aria-selected', 'true');
  }, 30000);

  it('peak planner: staggered starts lower the peak', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Pik yük planlayıcısı' });
    const intervals = screen.getByRole('tablist', { name: 'Xətlər arasında fasilə' });
    await userEvent.click(within(intervals).getByRole('tab', { name: '15 dəq' }));
    expect(screen.getAllByText('08:45').length).toBeGreaterThan(0);
    expect(screen.getByText('45 dəqiqə')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'E-1 xəttini aşağı apar' }));
    expect(screen.getByText('Pikin azalması').nextSibling?.textContent).toMatch(/kVt/);
  }, 30000);
});
