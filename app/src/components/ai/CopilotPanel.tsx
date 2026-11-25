import { Sparkles } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { useT } from '@/i18n';
import { useUiStore } from '@/stores/ui';

const CopilotContent = lazy(() => import('./copilot/CopilotContent'));

/** Right side AI Copilot sheet (420 px), opened from the Topbar or Ctrl/⌘+K. */
export function CopilotPanel() {
  const { t } = useT('layout');
  const open = useUiStore((s) => s.copilotOpen);
  const prompt = useUiStore((s) => s.copilotPrompt);
  const setOpen = useUiStore((s) => s.setCopilotOpen);
  return (
    <Sheet open={open} onOpenChange={(o) => setOpen(o)}>
      <SheetContent
        side="right"
        closeLabel={t('copilot.close')}
        className="overflow-hidden p-0 [&>button]:text-white [&>button:hover]:bg-white/15 [&>button:hover]:text-white"
      >
        <div className="relative bg-violet-700 bg-ai px-6 pb-5 pt-6 text-white">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-sm bg-white/15">
              <Sparkles className="size-4" strokeWidth={2} aria-hidden="true" />
            </span>
            <div>
              <SheetTitle className="text-base font-semibold leading-tight">
                {t('copilot.title')}
              </SheetTitle>
              <SheetDescription className="text-13 text-white/80">
                {t('copilot.subtitle')}
              </SheetDescription>
            </div>
          </div>
        </div>
        <Suspense
          fallback={
            <div className="space-y-3 p-6">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          }
        >
          <CopilotContent initialPrompt={prompt} />
        </Suspense>
      </SheetContent>
    </Sheet>
  );
}
