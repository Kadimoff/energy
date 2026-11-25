import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { makeQueryClient, Providers } from '@/app/providers';
import { DecisionActions } from '@/components/ai/decision/DecisionActions';
import { useDecisionNotice } from '@/components/ai/decision/notice';
import type { RecommendationState } from '@/data/types';
import { queryKeys } from '@/stores/derived';
import { useRecommendationStore } from '@/stores/recommendations';
import { useUiStore } from '@/stores/ui';
import { fixture } from '@/test/fixture';
import OverviewPage from '@/pages/overview';
import DecisionsPage from './index';

const a = fixture();
const base: Record<string, RecommendationState> = Object.fromEntries(
  a.engine.recommendations.map((r) => [r.id, { status: 'proposed' as const, updatedAt: 0 }]),
);

function wrap(ui: ReactNode, route = '/') {
  const qc = makeQueryClient();
  qc.setQueryData(queryKeys.analysis, a);
  qc.setQueryData(queryKeys.recStates, base);
  qc.setQueryData(queryKeys.anomalies, a.anomalies);
  return render(
    <Providers client={qc}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </Providers>,
  );
}

const state = (id: string) => useRecommendationStore.getState().overrides[id];

beforeEach(() => {
  useRecommendationStore.getState().resetAll();
  useDecisionNotice.getState().clear();
  useUiStore.getState().setRole('director');
});

describe('decision actions', () => {
  const rec = {
    id: 'rec-comp-schedule',
    status: 'proposed' as const,
    state: base['rec-comp-schedule'],
  };

  it('approve writes the store and pushes a notice', async () => {
    wrap(<DecisionActions rec={rec} />);
    await userEvent.click(screen.getByRole('button', { name: /Təsdiqlə/ }));
    expect(state(rec.id).status).toBe('approved');
    expect(useDecisionNotice.getState().notice).toMatchObject({
      recId: rec.id,
      status: 'approved',
    });
  });

  it('reject requires a reason, "Digər" requires a note', async () => {
    wrap(<DecisionActions rec={rec} />);
    await userEvent.click(screen.getByRole('button', { name: /Rədd et/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Rədd et' }));
    expect(within(dialog).getByText('Səbəb seçin')).toBeInTheDocument();
    expect(state(rec.id)).toBeUndefined();
    await userEvent.click(within(dialog).getByLabelText('Digər'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Rədd et' }));
    expect(within(dialog).getByText(/qısa qeyd yazın/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByLabelText('İstehsal riski'));
    expect(
      within(dialog).getByText(/AI-ın gələcək təkliflərini yaxşılaşdırmaq/),
    ).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Rədd et' }));
    expect(state(rec.id)).toMatchObject({ status: 'rejected', rejectReason: 'production_risk' });
  });

  it('schedule stores the chosen date, past dates are refused', async () => {
    wrap(<DecisionActions rec={rec} />);
    await userEvent.click(screen.getByRole('button', { name: /Planla/ }));
    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByLabelText('Tətbiq tarixi');
    await userEvent.clear(input);
    await userEvent.type(input, '2026-11-01');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Planla' }));
    expect(within(dialog).getByText('Keçmiş tarix seçilə bilməz')).toBeInTheDocument();
    await userEvent.clear(input);
    await userEvent.type(input, '2026-11-28');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Planla' }));
    expect(state(rec.id).status).toBe('scheduled');
    expect(state(rec.id).scheduledFor).toBe(new Date(2026, 10, 28).getTime());
  });

  it('advances approved to in progress and reopens rejected', async () => {
    const { unmount } = wrap(
      <DecisionActions
        rec={{ ...rec, status: 'approved', state: { status: 'approved', updatedAt: 0 } }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Tətbiqə başla/ }));
    expect(state(rec.id).status).toBe('in_progress');
    unmount();
    wrap(
      <DecisionActions
        rec={{ ...rec, status: 'rejected', state: { status: 'rejected', updatedAt: 0 } }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Yenidən baxışa qaytar/ }));
    expect(state(rec.id).status).toBe('proposed');
  });
});

describe('decision center page', () => {
  it('approving a decision updates the month-end forecast immediately', async () => {
    wrap(<DecisionsPage />, '/decisions');
    const summary = await screen.findByRole('region', { name: 'Ümumi potensial qənaət' });
    const forecastBefore = within(summary).getByText(/Büdcə 50 000 AZN/).textContent;
    const card = screen.getByRole('article', { name: /Ekstruziya xətlərində gözləmə rejimini/ });
    await userEvent.click(within(card).getByRole('button', { name: /Təsdiqlə/ }));
    await waitFor(() =>
      expect(within(summary).getByText(/Büdcə 50 000 AZN/).textContent).not.toBe(forecastBefore),
    );
    expect(within(card).getByText('Təsdiqləndi')).toBeInTheDocument();
    expect(await screen.findByText(/Ay sonu xərc proqnozu .* idi, indi/)).toBeInTheDocument();
  });

  it('filters and switches to the kanban view', async () => {
    wrap(<DecisionsPage />, '/decisions');
    await screen.findByRole('region', { name: 'Ümumi potensial qənaət' });
    await userEvent.click(screen.getByRole('button', { name: 'İnvestisiya tələb edir' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Rədd edilən' }));
    expect(screen.getByText('Filtrlərə uyğun qərar yoxdur')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /Kanban/ }));
    expect(await screen.findByRole('region', { name: 'Status axını' })).toBeInTheDocument();
  });
});

describe('overview role selector', () => {
  it('director sees decision actions, operator sees the live card and read-only decisions', async () => {
    const { unmount } = wrap(<OverviewPage />);
    expect(await screen.findByText('Gözləyən AI qərarları')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Təsdiqlə/ }).length).toBe(3);
    expect(screen.getByText('Karbon')).toBeInTheDocument();
    unmount();
    useUiStore.getState().setRole('operator');
    wrap(<OverviewPage />);
    expect(await screen.findByText('İndi zavodda')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Təsdiqlə/ })).toBeNull();
    expect(screen.getByText(/Qərarları enerji meneceri təsdiqləyir/)).toBeInTheDocument();
    expect(screen.queryByText('Karbon')).toBeNull();
  });
});
