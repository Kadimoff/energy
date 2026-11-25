import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-9 items-center gap-0.5 rounded-sm border border-border bg-bg-subtle p-0.5',
      className,
    )}
    {...props}
  />
));
TabsList.displayName = 'TabsList';

/**
 * The app uses tabs as segmented controls (view/horizon switches) without
 * Radix TabsContent panels, so the generated aria-controls would point to a
 * missing id (axe: aria-valid-attr-value). It is dropped unless set explicitly.
 */
export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, 'aria-controls': controls, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] px-3 text-13 font-medium text-ink-2 transition-colors duration-180 hover:text-ink disabled:opacity-50 data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-sm',
      className,
    )}
    {...props}
    aria-controls={controls}
  />
));
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn('mt-4', className)} {...props} />
));
TabsContent.displayName = 'TabsContent';
