import { cn } from './utils';

describe('cn (tailwind-merge with the project theme)', () => {
  it('keeps the text colour next to the custom 13 px font size', () => {
    expect(cn('bg-violet-600 text-white', 'h-8 px-3 text-13')).toContain('text-white');
    expect(cn('text-ink-2', 'text-13')).toBe('text-ink-2 text-13');
  });
  it('keeps the solid fallback colour under the AI gradient', () => {
    expect(cn('bg-violet-700 bg-ai text-white')).toBe('bg-violet-700 bg-ai text-white');
  });
  it('still merges real conflicts', () => {
    expect(cn('text-xs', 'text-13')).toBe('text-13');
    expect(cn('rounded-card', 'rounded-panel')).toBe('rounded-panel');
  });
});
