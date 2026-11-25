import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-sm border px-2 py-0.5 text-xs font-medium [&_svg]:size-3.5 [&_svg]:stroke-[1.75]',
  {
    variants: {
      variant: {
        neutral: 'border-border bg-bg-subtle text-ink-2',
        violet: 'border-violet-200 bg-violet-50 text-violet-700',
        success: 'border-transparent bg-success-surface text-success-text',
        warning: 'border-transparent bg-warning-surface text-warning-text',
        danger: 'border-transparent bg-danger-surface text-danger-text',
        info: 'border-transparent bg-info-surface text-info-text',
        outline: 'border-border-strong bg-transparent text-ink-2',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
