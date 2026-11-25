import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { makeQueryClient, Providers } from '@/app/providers';
import { queryKeys } from '@/stores/derived';
import { useSettingsStore } from '@/stores/settings';
import { fixture } from '@/test/fixture';
import CarbonPage from './index';

const a = fixture();

function renderPage() {
  const qc = makeQueryClient();
  qc.setQueryData(queryKeys.analysis, a);
  qc.setQueryData(queryKeys.recStates, {});
  return render(
    <Providers client={qc}>
      <MemoryRouter>
        <CarbonPage />
      </MemoryRouter>
    </Providers>,
  );
}

describe('carbon page', () => {
  beforeEach(() => useSettingsStore.setState({ overrides: {} }));

  it('shows KPIs, factor sources, roadmap and the CBAM pre-assessment', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'Karbon' })).toBeInTheDocument();
    expect(screen.getByText('Ümumi emissiya, 2026')).toBeInTheDocument();
    expect(screen.getByText('Scope 1, təbii qaz')).toBeInTheDocument();
    // every CO₂ number has a factor + source tooltip trigger
    expect(
      screen.getAllByRole('button', { name: /Scope 2 şəbəkə əmsalı: 0,41/ }).length,
    ).toBeGreaterThan(3);
    // factors table with source and a link to Settings
    const table = screen.getByRole('table', { name: 'Emissiya əmsalları' });
    expect(within(table).getAllByText(/IPCC 2006/).length).toBeGreaterThan(0);
    expect(within(table).getAllByRole('link', { name: 'Parametrlərdə dəyiş' })[0]).toHaveAttribute(
      'href',
      '/settings',
    );
    expect(screen.getByRole('heading', { name: /Azalma yol xəritəsi/ })).toBeInTheDocument();
    // CBAM: mandatory note, plastics are not covered
    expect(
      screen.getAllByText('Bu, ilkin qiymətləndirmədir, rəsmi CBAM hesabatı deyil.').length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText('Məhsul CBAM əhatəsində deyil. Hazırda CBAM öhdəliyi yaranmır.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Məhsul hazırda əhatədə deyil/)).toBeInTheDocument();
  }, 30000);

  it('a settings override changes the CO₂ numbers and is flagged in the factors table', async () => {
    useSettingsStore.setState({ overrides: { scope2KgCo2PerKwh: 0.5 } });
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Karbon' });
    expect(screen.getAllByText(/Parametrlərdə dəyişdirilib, ilkin dəyər 0,41/).length).toBe(2);
    expect(
      screen.getAllByRole('button', { name: /Scope 2 şəbəkə əmsalı: 0,5/ }).length,
    ).toBeGreaterThan(0);
  }, 30000);

  it('the EU export switch changes the checklist', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Karbon' });
    const sw = screen.getByRole('switch', { name: 'Məhsul Aİ-yə ixrac olunur' });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'false');
  }, 30000);
});
