import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge must know the custom theme keys, otherwise it treats
 * `text-13` as a text colour (and drops `text-white` next to it) and `bg-ai`
 * as a background colour (and drops the solid fallback under the gradient).
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['2xs', '13'] }],
      'bg-image': [{ bg: ['ai'] }],
      rounded: [{ rounded: ['card', 'panel'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** prefers-reduced-motion, evaluated lazily (can change at runtime). */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}
