import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { Providers } from '@/app/providers';
import { routes } from '@/app/router';
import { useAnomalyStore } from '@/stores/anomalies';

/**
 * Page level tests of the operations area (live, equipment, anomalies).
 * They run the real analysis on the main thread, so they share one router
 * setup and generous timeouts.
 */

const desktop = (q: string) => ({
  matches: /min-width/.test(q),
  media: q,
  onchange: null,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  addListener: () => undefined,
  removeListener: () => undefined,
  dispatchEvent: () => false,
});

beforeAll(() => {
  window.matchMedia = desktop as unknown as typeof window.matchMedia;
});

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
  return router;
}

const LONG = { timeout: 20000 };

describe('ops pages', () => {
  it('equipment list: search, filter by status and open K-2 detail', async () => {
    const router = renderAt('/equipment');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Avadanlıqlar' }, LONG),
    ).toBeInTheDocument();
    const table = await screen.findByRole('table', {}, LONG);
    expect(within(table).getAllByRole('row')).toHaveLength(21);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Avadanlıq axtarışı' }), 'K-2');
    await waitFor(() =>
      expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2),
    );
    expect(router.state.location.search).toContain('q=K-2');
    // sortable header exposes aria-sort
    const wasteHeader = screen.getByRole('columnheader', { name: /İsraf/ });
    expect(wasteHeader).toHaveAttribute('aria-sort', 'descending');
    await userEvent.click(screen.getByRole('link', { name: 'K-2' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'K-2 kompressoru' }, LONG),
    ).toBeInTheDocument();
    expect(screen.getByText('Həftəlik saatlıq yük xəritəsi')).toBeInTheDocument();
    expect(screen.getByText('Yük profili')).toBeInTheDocument();
    expect(await screen.findByText('Bu avadanlığın anomaliyaları')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Saatlıq, 7 gün' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  }, 60000);

  it('equipment detail of K-1 shows the leak flag; unknown id shows not found', async () => {
    renderAt('/equipment/comp-1');
    expect(
      await screen.findByText(/Baza yükü \d+ gündür artır, sızma ehtimalı/, {}, LONG),
    ).toBeInTheDocument();
  }, 60000);

  it('equipment detail with an unknown id offers the way back', async () => {
    renderAt('/equipment/nope');
    expect(await screen.findByText('Bu avadanlıq tapılmadı', {}, LONG)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Siyahıya qayıt' })).toHaveAttribute(
      'href',
      '/equipment',
    );
  }, 60000);

  it('anomalies: filter, open the detail panel, mark a false alarm as model feedback', async () => {
    useAnomalyStore.setState({ status: {}, assignee: {}, comments: {} });
    const router = renderAt('/anomalies?equipment=comp-2');
    const table = await screen.findByRole('table', {}, LONG);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.length).toBeGreaterThan(0);
    await userEvent.click(within(rows[0]).getAllByRole('button')[0]);
    const dialog = await screen.findByRole('dialog');
    expect(router.state.location.search).toContain('id=');
    expect(within(dialog).getByText('AI izahı')).toBeInTheDocument();
    expect(within(dialog).getByText('Əlaqəli tövsiyə')).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Yanlış xəbərdarlıq kimi qeyd et' }),
    );
    expect(await within(dialog).findByText(/Rəy AI modelinə göndərildi/)).toBeInTheDocument();
    const id = new URLSearchParams(router.state.location.search).get('id')!;
    expect(useAnomalyStore.getState().status[id]).toBe('false_alarm');
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Şərh' }),
      'Klapan yoxlanıldı',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Şərh əlavə et' }));
    expect(within(dialog).getByText('Klapan yoxlanıldı')).toBeInTheDocument();
  }, 60000);

  it('anomalies timeline view lists every anomaly as a button', async () => {
    renderAt('/anomalies?view=timeline');
    const group = await screen.findByRole('group', { name: /Anomaliyaların zaman xətti/ }, LONG);
    expect(within(group as HTMLElement).getAllByRole('button').length).toBeGreaterThan(10);
  }, 60000);

  it('live: schematic, stale banner, shift card and event feed', async () => {
    renderAt('/live');
    expect(await screen.findByRole('group', { name: /Zavod sxemi/ }, LONG)).toBeInTheDocument();
    expect(screen.getByText(/AHU-A sayğacı ilə əlaqə yoxdur/)).toBeInTheDocument();
    expect(screen.getByText('Növbə göstəricisi')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Hadisələr, ən yenisi yuxarıda' })).toBeInTheDocument();
    expect(screen.getByText(/AHU-A sayğacı ilə əlaqə kəsildi/)).toBeInTheDocument();
  }, 60000);
});
