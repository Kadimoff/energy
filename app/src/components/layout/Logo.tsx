import { useId } from 'react';
import { cn } from '@/lib/utils';

/** Brand mark: a flame-like energy curve over a baseline (optimal band idea). */
export function LogoMark({ className }: { className?: string }) {
  // unique gradient id: a hidden copy (display:none) would otherwise break the url() reference
  const gid = `sie-logo-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7C3AED" />
          <stop offset="0.55" stopColor="#6366F1" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gid})`} />
      <path
        d="M7 20.5h18"
        stroke="#fff"
        strokeOpacity=".45"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M7 21c3-.2 4-7.5 7-7.5s3.2 4.5 5.6 4.5S23 10 25 9"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
