import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { vi } from 'vitest';
import { Providers } from '@/app/providers';
import { useAdminStore, defaultSchedules } from '@/stores/admin';
import { useSettingsStore } from '@/stores/settings';
import { CSV_BOM } from '@/services/ReportService.csv';
import ReportsPage from './index';

function renderAt(url: string) {
  const router = createMemoryRouter([{ path: '/reports', element: <ReportsPage /> }], {
    initialEntries: [url],
  });
  return render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  );
}

describe('Reports page', () => {
  beforeEach(() => {
    useSettingsStore.getState().reset();
    useAdminStore.setState({ schedules: defaultSchedules(), sendLog: [] });
  });

  it('previews the one-page director report and switches templates', async () => {
    renderAt('/reports');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Hesabatlar' }),
    ).toBeInTheDocument();
    const preview = await screen.findByRole('region', { name: 'A4 önizləmə' }, { timeout: 20000 });
    await within(preview).findAllByText('Ən çox israf edən 3 avadanlıq', {}, { timeout: 20000 });
    expect(within(preview).getAllByRole('article')).toHaveLength(1);
    for (const h of [
      'Əsas rəqəmlər',
      'Büdcə vəziyyəti',
      'Təsdiqlənmiş qənaət',
      'Növbəti ay üçün tövsiyələr',
    ])
      expect(within(preview).getAllByText(h).length).toBeGreaterThan(0);
    // print copy lives directly under <body>
    expect(document.querySelector('body > .report-print-host .report-page')).not.toBeNull();

    await userEvent.click(screen.getByRole('radio', { name: /Karbon hesabatı/ }));
    expect(
      (await within(preview).findAllByText('İllik hədəfə qarşı irəliləyiş')).length,
    ).toBeGreaterThan(0);
    expect(within(preview).getAllByRole('article')).toHaveLength(2);
    await userEvent.click(screen.getByRole('radio', { name: /ISO 50001/ }));
    expect(
      (await within(preview).findAllByText('Əhəmiyyətli enerji istifadəsi')).length,
    ).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('radio', { name: /Enerji meneceri hesabatı/ }));
    expect((await within(preview).findAllByText('Avadanlıq qrupları üzrə')).length).toBeGreaterThan(
      0,
    );
  }, 40000);

  it('exports CSV with BOM and prints via window.print', async () => {
    const blobs: Blob[] = [];
    const createUrl = vi.fn((b: Blob) => {
      blobs.push(b);
      return 'blob:test';
    });
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: vi.fn() });
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    renderAt('/reports?t=director');
    const csvBtn = await screen.findByRole('button', { name: 'CSV ixrac' });
    await waitFor(() => expect(csvBtn).toBeEnabled(), { timeout: 20000 });
    await userEvent.click(csvBtn);
    expect(createUrl).toHaveBeenCalledTimes(1);
    const buf = await new Promise<ArrayBuffer>((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result as ArrayBuffer);
      r.readAsArrayBuffer(blobs[0]);
    });
    expect([...new Uint8Array(buf).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(buf);
    expect(text.startsWith(CSV_BOM)).toBe(true);
    expect(text).toContain('Göstərici;Dəyər;Vahid');
    expect(text).toContain('Ən çox israf edən avadanlıqlar');
    await userEvent.click(screen.getByRole('button', { name: 'PDF kimi yüklə' }));
    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
    click.mockRestore();
  }, 40000);

  it('auto-send plan: validation, add, send now (simulation)', async () => {
    renderAt('/reports');
    expect(
      await screen.findByText('Avtomatik göndərmə planı', {}, { timeout: 20000 }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Simulyasiya').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Yeni plan' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Yadda saxla' }));
    expect(
      within(dialog).getByText('Ən azı bir alıcının e-poçt ünvanını yazın.'),
    ).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('Alıcılar'), 'cfo@zavod.example, səhv');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Yadda saxla' }));
    expect(within(dialog).getByText(/Bu ünvan düzgün deyil: səhv/)).toBeInTheDocument();
    await userEvent.clear(within(dialog).getByLabelText('Alıcılar'));
    await userEvent.type(within(dialog).getByLabelText('Alıcılar'), 'cfo@zavod.example');
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Həftəlik' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Yadda saxla' }));
    await waitFor(() => expect(useAdminStore.getState().schedules).toHaveLength(3));
    expect(useAdminStore.getState().schedules[2]).toMatchObject({
      frequency: 'weekly',
      recipients: ['cfo@zavod.example'],
    });
    await userEvent.click(screen.getAllByRole('button', { name: 'İndi göndər' })[0]);
    expect(useAdminStore.getState().sendLog).toHaveLength(1);
  }, 40000);
});
