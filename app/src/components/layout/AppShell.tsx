import { Suspense, useEffect } from 'react';
import { Outlet, useMatches } from 'react-router-dom';
import { CopilotPanel } from '@/components/ai/CopilotPanel';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/Skeletons';
import { useT } from '@/i18n';
import { useAnalysis } from '@/stores/derived';
import { useUiStore } from '@/stores/ui';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export interface RouteHandle {
  /** i18n key of the page title, e.g. "layout:nav.overview" */
  titleKey: string;
}

/** Application frame: sidebar, topbar, content, footer, mobile nav, copilot. */
export function AppShell() {
  const { t, tx } = useT('layout');
  const matches = useMatches();
  const handle = [...matches].reverse().find((m) => (m.handle as RouteHandle | undefined)?.titleKey)
    ?.handle as RouteHandle | undefined;
  const title = handle ? tx(handle.titleKey) : t('common:app.name');
  const setCopilotOpen = useUiStore((s) => s.setCopilotOpen);
  const analysis = useAnalysis();

  useEffect(() => {
    document.title = `${title} · ${t('common:app.name')}`;
  }, [title, t]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCopilotOpen(!useUiStore.getState().copilotOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setCopilotOpen]);

  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="sr-only-focusable fixed left-3 top-3 z-50 rounded-sm bg-surface px-3 py-2 text-sm font-medium text-violet-700 shadow-md"
      >
        {t('skip')}
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} />
        <main
          id="main"
          tabIndex={-1}
          className="flex-1 px-4 pb-8 pt-6 outline-none md:px-6 md:pb-10 lg:px-8 lg:pt-8"
        >
          <div className="mx-auto w-full max-w-[1440px]">
            {analysis.isError ? (
              <ErrorState onRetry={() => void analysis.refetch()} />
            ) : (
              <Suspense fallback={<PageSkeleton />}>
                <Outlet />
              </Suspense>
            )}
          </div>
        </main>
        <footer className="px-4 pb-24 text-center text-xs text-ink-3 md:px-6 md:pb-6">
          {t('common:footer.demo')}
        </footer>
      </div>
      <BottomNav />
      <CopilotPanel />
    </div>
  );
}
