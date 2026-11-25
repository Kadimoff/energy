import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { makeQueryClient, Providers } from '@/app/providers';
import { queryKeys } from '@/stores/derived';
import { fixture } from '@/test/fixture';
import MvPage from './index';

const a = fixture();

function renderPage(path = '/mv') {
  const qc = makeQueryClient();
  qc.setQueryData(queryKeys.analysis, a);
  qc.setQueryData(queryKeys.recStates, {});
  return render(
    <Providers client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <MvPage />
      </MemoryRouter>
    </Providers>,
  );
}

describe('M&V page', () => {
  it('lists measures with status, expected vs verified and opens the detail', async () => {
    renderPage();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Qənaət və yoxlama' }),
    ).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Tətbiq olunmuş tədbirlər' });
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    expect(within(table).getAllByText('Təsdiqləndi')).toHaveLength(2);
    expect(within(table).getByText('Gözləniləndən az')).toBeInTheDocument();
    expect(within(table).getByText('Ölçülür')).toBeInTheDocument();
    // first measure detail by default
    const detail = screen.getByRole('region', { name: 'Tədbirin detalları' });
    expect(
      within(detail).getByText('İnjeksiya maşınlarında servo nasos rejimi'),
    ).toBeInTheDocument();
    expect(within(detail).getByText('Düzəlişlərin izahı')).toBeInTheDocument();
    expect(within(detail).getByText('R²')).toBeInTheDocument();
    expect(within(detail).getByText(/Model etibarlıdır/)).toBeInTheDocument();
    // open another measure (mobile list and desktop table both render in jsdom)
    await userEvent.click(
      screen.getAllByRole('button', {
        name: /Ətraflı: Sex işıqlandırmasının LED-ə keçirilməsi/,
      })[0],
    );
    expect(
      within(screen.getByRole('region', { name: 'Tədbirin detalları' })).getByText(
        'Sex işıqlandırmasının LED-ə keçirilməsi',
      ),
    ).toBeInTheDocument();
  }, 30000);

  it('deep link and Option C evaluation', async () => {
    renderPage('/mv?m=m-ct-vsd');
    const detail = await screen.findByRole('region', { name: 'Tədbirin detalları' });
    expect(
      within(detail).getByText('Soyutma qülləsi nasoslarına tezlik çeviricisi'),
    ).toBeInTheDocument();
    await userEvent.click(within(detail).getByRole('tab', { name: /Option C/ }));
    expect(
      await within(detail).findByText(/Option C bütün obyektdəki dəyişiklikləri/),
    ).toBeInTheDocument();
    expect(within(detail).getByText(/Option B daha uyğundur/)).toBeInTheDocument();
  }, 30000);
});
