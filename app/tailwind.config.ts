import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const c = (name: string) => `rgb(var(--${name}-rgb) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px' },
    extend: {
      colors: {
        bg: { DEFAULT: c('bg'), subtle: c('bg-subtle') },
        surface: { DEFAULT: c('surface'), raised: c('surface-raised') },
        border: { DEFAULT: c('border'), strong: c('border-strong') },
        ink: { DEFAULT: c('text'), 2: c('text-2'), 3: c('text-3') },
        violet: {
          50: c('violet-50'),
          100: c('violet-100'),
          200: c('violet-200'),
          300: c('violet-300'),
          400: c('violet-400'),
          500: c('violet-500'),
          600: c('violet-600'),
          700: c('violet-700'),
          800: c('violet-800'),
        },
        indigo: { accent: c('indigo-accent') },
        success: { DEFAULT: c('success'), surface: c('success-surface'), text: c('success-text') },
        warning: { DEFAULT: c('warning'), surface: c('warning-surface'), text: c('warning-text') },
        danger: { DEFAULT: c('danger'), surface: c('danger-surface'), text: c('danger-text') },
        info: { DEFAULT: c('info'), surface: c('info-surface'), text: c('info-text') },
        chart: {
          1: c('chart-1'),
          2: c('chart-2'),
          3: c('chart-3'),
          4: c('chart-4'),
          5: c('chart-5'),
          6: c('chart-6'),
        },
      },
      fontFamily: { sans: ['var(--font-sans)'] },
      fontSize: {
        '2xs': ['11px', { lineHeight: '16px' }],
        xs: ['12px', { lineHeight: '18px' }],
        '13': ['13px', { lineHeight: '20px' }],
        sm: ['14px', { lineHeight: '22px' }],
        base: ['16px', { lineHeight: '24px' }],
        lg: ['18px', { lineHeight: '26px' }],
        xl: ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px', letterSpacing: '-0.01em' }],
        '3xl': ['30px', { lineHeight: '38px', letterSpacing: '-0.01em' }],
        '4xl': ['36px', { lineHeight: '44px', letterSpacing: '-0.015em' }],
        '5xl': ['48px', { lineHeight: '56px', letterSpacing: '-0.02em' }],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        card: 'var(--radius-card)',
        panel: 'var(--radius-panel)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      transitionTimingFunction: { standard: 'cubic-bezier(0.2, 0, 0, 1)' },
      transitionDuration: { DEFAULT: '180ms', 180: '180ms' },
      width: {
        sidebar: 'var(--sidebar-w)',
        'sidebar-collapsed': 'var(--sidebar-w-collapsed)',
        copilot: 'var(--copilot-w)',
      },
      height: { topbar: 'var(--topbar-h)' },
      backgroundImage: { ai: 'var(--ai-gradient)' },
      keyframes: {
        'pulse-dot': {
          '0%,100%': { opacity: '0.35', transform: 'scale(0.85)' },
          '50%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: { 'pulse-dot': 'pulse-dot 1.2s cubic-bezier(0.2,0,0,1) infinite' },
    },
  },
  plugins: [animate],
} satisfies Config;
