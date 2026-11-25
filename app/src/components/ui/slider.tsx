import * as SliderPrimitive from '@radix-ui/react-slider';
import * as React from 'react';
import { cn } from '@/lib/utils';

export const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & { thumbLabel?: string }
>(({ className, thumbLabel, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn('relative flex h-5 w-full touch-none select-none items-center', className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-violet-100">
      <SliderPrimitive.Range className="absolute h-full bg-violet-600" />
    </SliderPrimitive.Track>
    {(props.value ?? props.defaultValue ?? [0]).map((_, i) => (
      <SliderPrimitive.Thumb
        key={i}
        aria-label={thumbLabel}
        className="block size-4 rounded-full border-2 border-violet-600 bg-surface shadow-md transition-transform duration-180 hover:scale-110 disabled:pointer-events-none"
      />
    ))}
  </SliderPrimitive.Root>
));
Slider.displayName = 'Slider';
