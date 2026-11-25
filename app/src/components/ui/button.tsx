import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-sm font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-180 ease-standard disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.75]',
  {
    variants: {
      variant: {
        /** Main CTA: AI gradient, at most one per page (spec 6.3) */
        primary: 'bg-violet-700 bg-ai text-white shadow-md hover:brightness-110',
        default: 'bg-violet-600 text-white hover:bg-violet-700',
        secondary:
          'border border-border bg-surface text-ink shadow-sm hover:border-border-strong hover:bg-bg-subtle',
        ghost: 'text-ink-2 hover:bg-violet-50 hover:text-ink',
        subtle: 'bg-violet-50 text-violet-700 hover:bg-violet-100',
        danger: 'bg-danger text-white hover:brightness-95',
        success: 'bg-success-text text-white hover:brightness-95',
        link: 'h-auto px-0 text-violet-700 underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-13',
        md: 'h-9 px-4 text-sm',
        lg: 'h-11 px-5 text-sm',
        icon: 'size-9',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? 'button')}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
