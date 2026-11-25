import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { Providers } from './providers';
import { routes } from './router';
import { useRecommendationStore } from '@/stores/recommendations';
import { useSettingsStore } from '@/stores/settings';
import { useUiStore } from '@/stores/ui';
import { useScenarioStore } from '@/stores/scenarios';
import { useAnomalyStore } from '@/stores/anomalies';
import { safeStorage } from '@/stores/storage';
import { useAdminStore } from '@/stores/admin';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';

describe('app shell', () => {
  it('renders navigation, page title, footer, palette (Ctrl+K) and copilot (Ctrl+J)', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/carbon'] });
    render(
      <Providers>
        <RouterProvider router={router} />
      </Providers>,
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Karbon' }, { timeout: 15000 }),
    ).toBeInTheDocument();
    const nav = screen.getAllByRole('navigation')[0];
    expect(nav.querySelectorAll('a')).toHaveLength(10);
    expect(
      screen.getAllByText('Demo versiya. Məlumatlar nümunə üçün yaradılıb.').length,
    ).toBeGreaterThan(0);
    await waitFor(() => expect(document.title).toContain('Karbon'));
    await userEvent.keyboard('{Control>}k{/Control}');
    expect(
      await screen.findByPlaceholderText('Səhifə, avadanlıq və ya anomaliya axtarın', {}, { timeout: 15000 }),
    ).toBeInTheDocument();
    await userEvent.keyboard('{Control>}j{/Control}');
    expect(await screen.findByText('Zavod məlumatı əsasında cavab verir', {}, { timeout: 15000 })).toBeInTheDocument();
  }, 60000);

  it('sidebar shows the plant name set in Settings', () => {
    useAdminStore.getState().setPlant({ name: 'Test Plast MMC' });
    render(
      <Providers>
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>
      </Providers>,
    );
    expect(screen.getByText('Test Plast MMC')).toBeInTheDocument();
    useAdminStore.getState().setPlant({ name: 'Nümunə Polimer Zavodu' });
  });

  it('has a route for every page', () => {
    const paths = routes[0].children!.map((r) => (r.index ? '/' : r.path));
    expect(paths).toEqual(
      expect.arrayContaining([
        '/',
        'live',
        'equipment',
        'equipment/:id',
        'decisions',
        'anomalies',
        'forecast',
        'carbon',
        'mv',
        'reports',
        'settings',
      ]),
    );
  });
});

describe('stores', () => {
  it('ui, settings, recommendations, anomalies and scenarios', () => {
    const ui = useUiStore.getState();
    ui.setRole('operator');
    ui.setRange('custom', { from: 1, to: 2 });
    ui.toggleSidebar();
    ui.setCopilotOpen(true, 'Dünən gecə nə baş verib?');
    ui.setLang('en');
    ui.setPlant('p');
    ui.setCommandOpen(true);
    const s = useUiStore.getState();
    expect([s.role, s.rangePreset, s.customRange?.to, s.copilotPrompt, s.lang]).toEqual([
      'operator',
      'custom',
      2,
      'Dünən gecə nə baş verib?',
      'en',
    ]);
    ui.setLang('az');

    useSettingsStore.getState().setOverride('electricityRateAznPerKwh', 0.12);
    useSettingsStore.getState().setOverrides({ electricityBudgetAzn: 60000 });
    expect(useSettingsStore.getState().overrides).toEqual({
      electricityRateAznPerKwh: 0.12,
      electricityBudgetAzn: 60000,
    });
    useSettingsStore.getState().reset('electricityRateAznPerKwh');
    expect(useSettingsStore.getState().overrides).toEqual({ electricityBudgetAzn: 60000 });
    useSettingsStore.getState().reset();
    expect(useSettingsStore.getState().overrides).toEqual({});

    const r = useRecommendationStore.getState();
    r.approve('a');
    r.schedule('b', 123);
    r.reject('c', 'production_risk', 'risk');
    r.setStatus('d', 'measuring');
    const o = useRecommendationStore.getState().overrides;
    expect([o.a.status, o.b.scheduledFor, o.c.rejectReason, o.d.status]).toEqual([
      'approved',
      123,
      'production_risk',
      'measuring',
    ]);
    r.resetAll();
    expect(useRecommendationStore.getState().overrides).toEqual({});

    const an = useAnomalyStore.getState();
    an.setStatus('x', 'false_alarm');
    an.assign('x', 'Rəşad');
    an.addComment('x', 'Yoxlandı', 'Aysel');
    expect(useAnomalyStore.getState().comments.x[0].text).toBe('Yoxlandı');

    const sc = useScenarioStore.getState().save('Plan A', {
      productionPct: 5,
      tempDeltaC: 0,
      shifts: 2,
      recommendationIds: [],
      monthOffset: 0,
    });
    useScenarioStore.getState().rename(sc.id, 'Plan B');
    expect(useScenarioStore.getState().saved[0].name).toBe('Plan B');
    useScenarioStore.getState().remove(sc.id);
    expect(useScenarioStore.getState().saved).toHaveLength(0);
  });

  it('safe storage survives a throwing localStorage', () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('quota');
    };
    safeStorage.setItem('k', 'v');
    expect(safeStorage.getItem('k')).toBe('v');
    Storage.prototype.setItem = orig;
    safeStorage.removeItem('k');
    expect(safeStorage.getItem('k')).toBeNull();
  });
});
