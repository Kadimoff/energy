# Decisions

One line per decision (append only). Phase 1 = foundation agent.

- Phase 1: plan approval waived by owner; this file records the assumptions instead.
- Stack pinned to versions older than 2 weeks: React 18.3.1, Vite 7.3.8, TypeScript 5.9.3, Tailwind 3.4.19 (CSS-variable tokens, pure JS, no native build step), React Router 6.30.6, TanStack Query 5.107.1, Zustand 5.1.0, Recharts 3.10.1, date-fns 4.4.0, framer-motion 12.43.0, lucide-react 1.71.0, Vitest 4.1.12, ESLint 10.14.0, Prettier 3.9.10.
- Font test (Chromium, canvas glyph-width compare + CDP getPlatformFontsForNode, shots/foundation/font-test.png): Plus Jakarta Sans passes all of Əə Ğğ Iı İi Öö Şş Üü Çç; Manrope fails (Ə falls back to a system font); Inter passes. Chosen: Plus Jakarta Sans Variable (first passing candidate), self-hosted via @fontsource-variable.
- Glyphs ₂ ≈ → are missing in all three candidates and render from the system fallback; acceptable for "CO₂" (subscript only), avoid ≈ and → in UI copy.
- --text-3 darkened from spec #8A86A0 (3.5:1) to #6E6A86 (5.2:1) to meet WCAG AA for 12-13 px helper text (spec 6.10 wins over 6.2).
- Semantic colours keep the spec hex for fills/lines; text on tinted surfaces uses darker *-text variants (success #0B7A6D, warning #8F5D00, danger #B23232, info #2F5BD0) for 4.5:1.
- Eight equipment groups (spec lists 8 kinds, "at least 6"); the 6-tone chart palette covers the first six, auxiliary uses #CBD5E1 and the gas boiler #B45309.
- 20 equipment items: K-1..K-3, Çiller-1/2, cooling tower pumps, E-1..E-4, İM-1..İM-3, shop/warehouse AHU, shop/warehouse/site lighting, office, gas boiler.
- Time zone: all timestamps are plant-local = browser local time; tests run with TZ=Asia/Baku (set in vite.config.ts). Data history is keyed by absolute hour so it is stable between loads; waste scenarios are placed relative to today so the demo always looks current.
- Timeline: 13 calendar months of hourly actuals (12 full + current) up to the last complete hour; temperature forecast and production plan until the end of next month (enables month-end, next-month and quarter views).
- Holidays (Nov 2025 to Mar 2027) are a fixed list in plant.json, flagged "holidaysVerify"; holidays are non-production days.
- "Optimal" = robust hourly regression per equipment (production: intensity, CDH, HDH, darkness; idle: CDH, HDH, darkness), MAD-trimmed so anomaly hours are excluded; band ±1.5σ; waste = actual above the upper band. The spec daily model E = a + b·ton + c·CDD + d·HDD + e·hours is fitted per group and plant on non-anomaly days for R²/CV(RMSE) and for M&V.
- Static factor change: a new model segment starts 7 days after an implemented measure (if both sides have ≥ 60 days), so pre-measure history is judged against its own baseline.
- Chart waste area follows spec 3 literally (area between the upper band and the actual line); the numeric waste (tooltip, KPI) is the hourly attributed waste, which can be larger than the visible area.
- Anomalies: 30-day detection window, occurrences grouped per rule + equipment group + ISO week (trend = one continuous event); ids are deterministic for status persistence.
- Peak power rule needs ≥ 3 machines starting in the same hour with an inrush above their band; peak limit 1 280 kW (plant.json) is a demo assumption.
- Spike rule: z > 3 and excess ≥ max(10 kW, 20 % nominal), first production hour excluded (belongs to the peak rule) to avoid false positives.
- EnPI degradation is weekly kWh/t vs the model-normalised expected kWh/t (ISO 50006 style), threshold 10 %.
- Two extra injected samples beyond spec 9.4: extruders kept in heated standby outside production (needed for the "standby mode" recommendation to have real waste) and one E-3 spike (sample for the spike rule).
- Recommendation savings = capture share × measured waste (above the band) of the targeted equipment and hours over 28 days (leak: 7 days), so a saving never exceeds the waste; combined savings deplete a shared pool (no double counting). All 10 together: ~15 % of the electricity run-rate, next full month moves from over to under budget.
- The current month usually cannot close within budget even with all recommendations when only a few days remain; "within budget" is shown for a full month (next month / run-rate). Both are exposed.
- Investments (config/recommendations.json) are planning assumptions; VSD 10 000 AZN gives ~26 months payback at the measured saving.
- Gas tariff 0,30 AZN/m³ and gas budget 14 000 AZN/month are placeholders flagged for verification; gas m³ → kWh = 10.
- M&V: Option B on the measure's meters by default (Option C supported), 120-day baseline, 7-day settling, ≥ 30 reporting days, verified at ≥ 80 % of expected; 90 % CI with the ASHRAE Guideline 14 simplified formula. Truth in the mock: servo 11,5 %, LED 38 %, cooling-tower VSD 14 % (expected 25 %, shows "Gözləniləndən az"), office measure still "Ölçülür".
- Recommendation states: data source initial states (8 proposed, leaks approved, lighting scheduled) overlaid by user decisions persisted in localStorage (try/catch, memory fallback).
- Generation + analysis run in a web worker (Vite module worker, same origin, CSP friendly); tests and non-worker environments fall back to the main thread.
- i18n: tiny typed t() (no library), one JSON per area per language; en files currently mirror az text as placeholders with identical keys (test enforces key parity, no em dash, no ALL CAPS).
- Ctrl/⌘+K toggles the AI Copilot sheet (420 px). The copilot body lives in src/components/ai/copilot/ (owned by the copilot agent).
- Mobile (< 768 px): sidebar becomes a bottom bar with 4 primary items + "Daha çox" sheet; range and role selectors move to a second top row.
- Developer showcase of shared components with live data at /dev/components (not in navigation).
