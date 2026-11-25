import { formatShare } from '@/lib/format';

/** Overrun probability text: "99%-dən çox" / "1%-dən az" at the extremes. */
export function probabilityText(p: number, above: string, below: string): string {
  return p >= 0.995 ? above : p <= 0.005 ? below : formatShare(p);
}
