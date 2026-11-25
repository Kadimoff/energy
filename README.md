# Smart Industry Energy

AI dəstəkli sənaye enerji və karbon idarəetmə paneli (demo). Fictional plant
"Nümunə Polimer Zavodu" (Sumqayıt), deterministic mock data, no external
network at runtime. Product spec: `SPEC.md` (Azerbaijani), decisions log:
`DECISIONS.md`.

## Install and run

Requirements: Node 22.12+ (CI/Docker use `node:22-alpine`, development also works on Node 26).

```bash
cd app
npm ci                 # exact, pinned versions from package-lock.json
npm run dev            # http://127.0.0.1:5173
npm run build          # type-check + production build into app/dist
npm run preview        # serve the build on 127.0.0.1:5174
```

Quality gates (all must pass before merging):

```bash
npm run lint && npm run typecheck && npm test && npm run build
npm run test:coverage  # domain + data + format coverage (threshold 80 %)
```

Production: the repository `Dockerfile` builds `app/` and serves `dist` with
`deploy/serve.mjs` (SPA fallback, strict CSP: no inline scripts, no external origins).

## Architecture

```
app/src/
  app/            router (lazy routes), providers, navigation config
  pages/<area>/   one folder per page; each page agent owns its folder
  components/
    ui/           shadcn-style Radix primitives (button, card, dialog, sheet, ...)
    charts/       ActualVsOptimalChart (signature "optimal band"), Sparkline
    ai/           AiBadge, ConfidenceMeter, WhyPanel, CopilotPanel (+ copilot/ slot)
    kpi/          KpiCard
    layout/       AppShell, Sidebar, Topbar, BottomNav, PageHeader
    common/       EmptyState, ErrorState, StaleDataBanner, SourceTooltip, skeletons
  domain/         pure calculation functions + Vitest tests (no React)
  data/
    config/       all tariffs, factors, budgets, targets, thresholds (JSON)
    mock/         deterministic generator, injected waste scenarios
    sources/      EnergyDataSource interface, MockDataSource, analysis web worker
  stores/         zustand stores + derived.ts (view-model hooks for pages)
  i18n/<lang>/    one JSON per area (az default, en mirror)
  lib/            format.ts (az numbers/dates/units), utils, hooks
  styles/         tokens.css (design tokens), globals.css
```

Data flow:

1. `dataSource.getDataset()` returns a columnar snapshot: 13 months of hourly
   readings per equipment up to "now", temperature and production plan until
   the end of next month.
2. `analyze()` (src/domain/analysis.ts) fits the optimal-consumption models,
   computes hourly bands and waste, detects anomalies, runs the recommendation
   engine and evaluates M&V. With the mock source this runs in a web worker
   (`analysis.worker.ts`), falling back to the main thread in tests.
3. `src/stores/derived.ts` wraps pure view-model builders
   (`src/domain/viewmodels.ts`) in hooks. Pages call hooks and render; UI
   components never calculate.
4. Money and CO₂ are applied late, from `useRates()` = config JSON + Settings
   overrides, so editing a tariff or factor updates every page.

### Models in short

- Hourly optimal per equipment: robust (iteratively trimmed, MAD sigma)
  regression on production intensity, cooling/heating degree-hours and
  darkness; separate idle-baseload model for non-production hours; band ±1.5σ;
  waste = max(0, actual − upper band). Segments restart after implemented
  measures (static factor change).
- Daily spec model `E = a + b·ton + c·CDD + d·HDD + e·hours` per group and for
  the plant (R², CV(RMSE), low-reliability flag above 20 %), used for model
  quality display and M&V adjusted baselines.
- Forecast: actual so far + optimal model of the remaining hours (plan +
  temperature forecast) + current waste rate per hour-of-week (28 days) −
  accepted recommendations; P10–P90 from daily residual σ and waste
  uncertainty; overrun probability vs budget.
- Recommendations: saving = capture × measured waste of the targeted
  equipment and hours, so a saving can never exceed the waste; overlapping
  recommendations are combined without double counting.

## Swapping MockDataSource for a real API

1. Create `app/src/data/sources/ApiDataSource.ts` implementing
   `EnergyDataSource` (`src/data/sources/EnergyDataSource.ts`): `getPlant`,
   `getEquipment`, `getReadings`, `getProduction`, `getWeather`, `getDataset`,
   `getAnomalies`, `updateAnomalyStatus`, `getRecommendations`,
   `getRecommendationStates`, `updateRecommendationStatus`, `getLiveHistory`,
   `getLiveStream`.
2. `getDataset()` must return the `EnergyDataset` shape from
   `src/data/types.ts` (typed arrays, hour indices). The backend can serve it
   as JSON + base64 arrays, or the client can assemble it from `getReadings`.
3. In `src/data/sources/index.ts` replace
   `export const dataSource: EnergyDataSource = new MockDataSource();` with the
   API implementation. `loadAnalysis()` then runs the same domain analysis on
   the real dataset (or the API can return anomalies/recommendations itself).
4. Nothing in pages or components changes; they only use hooks from
   `src/stores/derived.ts`.

## Configuration and sources

All values are in `app/src/data/config/*.json` and editable in Settings
(overrides persisted in localStorage). Nothing is hardcoded elsewhere.

| Value | Default | Source |
|---|---|---|
| Electricity tariff | 0,11 AZN/kVt·saat (commercial), 0,10 (other non-household) | Tarif (qiymət) Şurası, tariff.gov.az; verify |
| Monthly fixed fee | 3 AZN (three-phase non-household, from 1 Jan 2026) | tariff.gov.az; verify |
| Gas tariff | 0,30 AZN/m³ placeholder, flagged "yoxlanılmalı" | to be entered |
| Scope 1 factor | 0,202 kq CO₂/kVt·saat (56,1 t CO₂/TJ, NCV) | IPCC 2006 Guidelines Vol. 2 Table 2.2 |
| Scope 2 factor | 0,41 kq CO₂/kVt·saat (location based) | Azərenerji renewable project document (8 311 t CO₂e / 20 448 MVt·saat) |
| Gas m³ → kVt·saat | 10 | approximate NCV, verify |
| Budget | 50 000 AZN electricity, 14 000 AZN gas per month | plant assumption |
| CBAM | EU ETS 80 EUR/t, 1 EUR = 1,98 AZN, 50 t exemption | Regulation (EU) 2023/956; parameters |

Tariffs and factors change: the UI always shows source and last-check date next to them.
