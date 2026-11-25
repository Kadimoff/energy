import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { Providers } from '@/app/providers';
import { baseConfig, resolveRates } from '@/data/config';
import { formatAzn } from '@/lib/format';
import { useAdminStore } from '@/stores/admin';
import { useMonthOverview } from '@/stores/derived';
import { useSettingsStore } from '@/stores/settings';
import SettingsPage from './index';

/** Reads the same view model the overview page uses (cost KPI + month-end forecast). */
function OverviewProbe() {
  const ov = useMonthOverview();
  if (!ov) return null;
  return (
    <output data-testid="probe">
      {JSON.stringify({
        forecast: ov.electricity.costMean,
        cost: ov.costAzn.value,
        prob: ov.electricity.overrunProbability,
        budget: ov.costAzn.budgetAzn,
        co2: ov.co2T.value,
      })}
    </output>
  );
}

const probe = () =>
  JSON.parse(screen.getByTestId('probe').textContent ?? '{}') as {
    forecast: number;
    cost: number;
    prob: number;
    budget: number;
    co2: number;
  };

function renderAt(url: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/settings',
        element: (
          <>
            <SettingsPage />
            <OverviewProbe />
          </>
        ),
      },
    ],
    { initialEntries: [url] },
  );
  return render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
}

describe('Settings page', () => {
  beforeEach(() => {
    useSettingsStore.getState().reset();
    useAdminStore.getState().resetSettings();
  });

  it('changing the kWh tariff instantly updates overview cost and forecast', async () => {
    renderAt('/settings?section=tariffs');
    await screen.findByTestId('probe', {}, { timeout: 20000 });
    const before = probe();
    const base = resolveRates(baseConfig);
    expect(screen.getByTestId('impact-elec').textContent).toBe(formatAzn(before.forecast));

    const input = screen.getByLabelText('kVt·saat tarifi');
    expect(input).toHaveValue('0,11');
    await userEvent.clear(input);
    await userEvent.type(input, '0,22');

    expect(useSettingsStore.getState().overrides.electricityRateAznPerKwh).toBe(0.22);
    const after = probe();
    // variable part doubles, fixed fee stays
    const fee = base.electricityFixedFeeAzn;
    expect(after.forecast - fee).toBeCloseTo((before.forecast - fee) * 2, 6);
    expect(after.cost - fee).toBeCloseTo((before.cost - fee) * 2, 6);
    expect(after.prob).toBeGreaterThanOrEqual(before.prob);
    expect(screen.getByTestId('impact-elec').textContent).toBe(formatAzn(after.forecast));
    expect(screen.getAllByText('Dəyişdirilib').length).toBeGreaterThan(0);

    // invalid input shows a friendly message and is never applied
    await userEvent.clear(input);
    await userEvent.type(input, '5');
    expect(screen.getByText('Dəyər 1 həddini keçməməlidir. Rəqəmi yoxlayın.')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(useSettingsStore.getState().overrides.electricityRateAznPerKwh).toBe(0.22);
    await userEvent.clear(input);
    await userEvent.type(input, 'abc');
    expect(screen.getByText(/Rəqəm daxil edin/)).toBeInTheDocument();

    // reset to default from the field
    fireEvent.blur(input);
    await userEvent.click(screen.getByRole('button', { name: 'kVt·saat tarifi: defaulta qaytar' }));
    await waitFor(() =>
      expect(useSettingsStore.getState().overrides.electricityRateAznPerKwh).toBeUndefined(),
    );
    expect(probe().forecast).toBeCloseTo(before.forecast, 6);
  }, 40000);

  it('consumer group, budget and the global reset propagate everywhere', async () => {
    renderAt('/settings?section=tariffs');
    await screen.findByTestId('probe', {}, { timeout: 20000 });
    const before = probe();
    await userEvent.click(screen.getByRole('radio', { name: /Digər qeyri-əhali istehlakçıları/ }));
    expect(useSettingsStore.getState().overrides.consumerGroup).toBe('other_non_household');
    expect(screen.getByLabelText('kVt·saat tarifi')).toHaveValue('0,10');
    expect(probe().forecast).toBeLessThan(before.forecast);

    await userEvent.click(screen.getByRole('button', { name: 'Büdcə' }));
    const budget = await screen.findByLabelText('Elektrik büdcəsi');
    await userEvent.clear(budget);
    await userEvent.type(budget, '80000');
    expect(probe().budget).toBe(80000);
    expect(probe().prob).toBeLessThan(before.prob + 1e-9);

    await userEvent.click(screen.getByRole('button', { name: 'Defaulta qaytar' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Defaulta qaytar' }));
    await waitFor(() => expect(useSettingsStore.getState().overrides).toEqual({}));
    expect(probe().forecast).toBeCloseTo(before.forecast, 6);
    expect(probe().budget).toBe(baseConfig.budgets.electricityAznPerMonth);
  }, 40000);

  it('renders every section with labelled controls', async () => {
    renderAt('/settings?section=plant');
    expect(await screen.findByLabelText('Müəssisənin adı')).toHaveValue(baseConfig.plant.name);
    const area = screen.getByLabelText('İstehsal sahəsi');
    await userEvent.clear(area);
    await userEvent.type(area, '20000');
    expect(useAdminStore.getState().plant.areaM2).toBe(20000);
    expect(
      screen.getByText(/Statik faktorlar \(sahə, iş qrafiki və ya növbələr\) dəyişdirilib/),
    ).toHaveAttribute('role', 'status');

    for (const [nav, probeText] of [
      ['Emissiya əmsalları', 'Scope 2, şəbəkə elektriki'],
      ['Hədəflər', 'EnPI hədəfi'],
      ['Xəbərdarlıq qaydaları', 'Büdcə aşma riski'],
      ['Məlumat mənbələri', 'CSV şablonunu yüklə'],
      ['İstifadəçilər və rollar', 'Rollar və icazələr'],
    ] as const) {
      await userEvent.click(screen.getByRole('button', { name: nav }));
      expect((await screen.findAllByText(probeText)).length).toBeGreaterThan(0);
    }
    // users: add with validation
    await userEvent.click(screen.getByRole('button', { name: 'İstifadəçi əlavə et' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'İstifadəçi əlavə et' }));
    expect(within(dialog).getAllByText('Bu sahəni boş qoymayın.').length).toBe(2);
    await userEvent.type(within(dialog).getByLabelText('Ad və soyad'), 'Nigar Əhmədova');
    await userEvent.type(within(dialog).getByLabelText('E-poçt'), 'nigar@zavod.example');
    await act(async () => {
      await userEvent.click(within(dialog).getByRole('button', { name: 'İstifadəçi əlavə et' }));
    });
    expect(useAdminStore.getState().users.some((u) => u.email === 'nigar@zavod.example')).toBe(
      true,
    );
  }, 40000);
});
