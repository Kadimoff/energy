import { Ellipsis } from 'lucide-react';
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { NAV_ITEMS } from '@/app/nav';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { usePendingCount } from '@/stores/derived';

/** Mobile (< 768 px) bottom navigation; the rest of the items live in "Daha çox". */
export function BottomNav() {
  const { t } = useT('layout');
  const [open, setOpen] = useState(false);
  const pending = usePendingCount();
  const { pathname } = useLocation();
  const main = NAV_ITEMS.filter((i) => i.mobile);
  const rest = NAV_ITEMS.filter((i) => !i.mobile);
  const restActive = rest.some((i) => pathname.startsWith(i.path));
  const itemCls = (active: boolean) =>
    cn(
      'relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-sm px-1 text-[11px] font-medium leading-tight',
      active ? 'text-violet-700' : 'text-ink-3',
    );
  return (
    <>
      <nav
        aria-label={t('nav.label')}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <ul className="flex items-stretch gap-1 py-1.5">
          {main.map((item) => (
            <li key={item.key} className="flex min-w-0 flex-1">
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) => itemCls(isActive)}
              >
                <item.icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                <span aria-hidden="true" className="max-w-full truncate">
                  {t(`navShort.${item.key}`)}
                </span>
                <span className="sr-only">{t(`nav.${item.key}`)}</span>
                {item.key === 'decisions' && pending ? (
                  <span className="absolute right-[calc(50%-20px)] top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-semibold text-white">
                    <span className="sr-only">{t('nav.pendingBadge', { count: pending })}</span>
                    <span aria-hidden="true">{pending}</span>
                  </span>
                ) : null}
              </NavLink>
            </li>
          ))}
          <li className="flex min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={itemCls(restActive)}
              aria-haspopup="dialog"
            >
              <Ellipsis className="size-5" strokeWidth={1.75} aria-hidden="true" />
              <span>{t('nav.more')}</span>
            </button>
          </li>
        </ul>
      </nav>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          closeLabel={t('common:actions.close')}
          className="px-4 pb-8 pt-5"
        >
          <SheetTitle className="mb-1 text-base font-semibold text-ink">{t('nav.more')}</SheetTitle>
          <SheetDescription className="sr-only">{t('nav.label')}</SheetDescription>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {rest.map((item) => (
              <li key={item.key}>
                <NavLink
                  to={item.path}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-[48px] items-center gap-3 rounded-md border px-3 text-sm font-medium',
                      isActive
                        ? 'border-violet-200 bg-violet-50 text-violet-700'
                        : 'border-border text-ink-2',
                    )
                  }
                >
                  <item.icon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
                  {t(`nav.${item.key}`)}
                </NavLink>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
